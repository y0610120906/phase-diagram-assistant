import json
import uuid
from pathlib import Path
from typing import Optional

import chromadb
from chromadb.config import Settings as ChromaSettings

from config import CHROMA_PERSIST_DIR, KNOWLEDGE_DOCS_DIR, DASHSCOPE_API_KEY
from models.knowledge import SearchResult, KnowledgeChunk, UploadResult
from services.pdf_parser import pdf_parser


class KnowledgeService:
    COLLECTION_NAME = "phase_diagram_knowledge"

    def __init__(self) -> None:
        self._client = chromadb.PersistentClient(
            path=CHROMA_PERSIST_DIR,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self._collection = self._client.get_or_create_collection(
            name=self.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

    _EXERCISE_KEYWORDS = ["选择题", "单选题", "多选题", "简答题", "计算题", "填空题",
                           "判断题", "名词解释", "习题", "考题", "试题", "试卷",
                           "答案：", "解析：", "参考答案", "标准答案",
                           "A.", "B.", "C.", "D.", "A、", "B、", "C、", "D、"]

    def search(self, query: str, top_k: int = 3, source_type_filter: Optional[str] = None,
               include_exercises: bool = True, content_type: Optional[str] = None) -> list[SearchResult]:
        fetch_k = top_k * 3 if not include_exercises else top_k

        if self._collection.count() == 0:
            return self._fallback_keyword_search(query, top_k)

        try:
            query_embedding = self._embed(query)
            where_filter = None
            conditions = []
            if source_type_filter:
                conditions.append({"source_type": source_type_filter})
            if content_type:
                conditions.append({"content_type": content_type})
            if len(conditions) == 1:
                where_filter = conditions[0]
            elif len(conditions) > 1:
                where_filter = {"$and": conditions}

            results = self._collection.query(
                query_embeddings=[query_embedding],
                n_results=fetch_k,
                where=where_filter,
                include=["documents", "metadatas", "distances"],
            )

            search_results: list[SearchResult] = []
            if results["ids"] and results["ids"][0]:
                for i, chunk_id in enumerate(results["ids"][0]):
                    metadata = results["metadatas"][0][i] if results["metadatas"] else {}
                    distance = results["distances"][0][i] if results["distances"] else 1.0
                    relevance = max(0, 1 - distance)
                    content = results["documents"][0][i] if results["documents"] else ""

                    if not include_exercises and self._looks_like_exercise(content):
                        continue

                    search_results.append(SearchResult(
                        chunk_id=chunk_id,
                        title=metadata.get("title", ""),
                        content=content,
                        snippet=content[:300],
                        source_type=metadata.get("source_type", "pdf"),
                        source_name=metadata.get("source_name", ""),
                        relevance_score=round(relevance, 4),
                    ))

                    if len(search_results) >= top_k:
                        break

            return search_results
        except Exception:
            return self._fallback_keyword_search(query, top_k)

    def _looks_like_exercise(self, content: str) -> bool:
        head = content[:200]
        return any(kw in head for kw in self._EXERCISE_KEYWORDS)

    async def _auto_classify(self, chunks: list[dict]) -> str:
        """Use LLM to classify document type. Timeout after 8s, fallback to 参考资料."""
        sample = "\n".join(c["content"][:300] for c in chunks[:3])
        if not sample.strip():
            return "参考资料"
        try:
            import asyncio
            from services.provider import get_llm_service
            llm_service = get_llm_service()
            content = ""
            async def _stream():
                nonlocal content
                async for event in llm_service.chat_stream(
                    messages=[{"role": "user", "content": f"判断文档类型，只回答一个词（边缘知识/例题模板/参考资料）:\n- 例题模板: 考题习题有题目答案\n- 边缘知识: 独门方法冷门概念实验数据\n- 参考资料: 普通教材概念公式\n\n文档:\n{sample[:800]}\n\n类型:"}],
                    temperature=0.2,
                ):
                    if event["type"] == "chunk" and event.get("content"):
                        content += event["content"]
                    elif event["type"] in ("done", "error"):
                        break
            await asyncio.wait_for(_stream(), timeout=8.0)
            result = content.strip()
            if "例题" in result: return "例题模板"
            if "边缘" in result: return "边缘知识"
            return "参考资料"
        except (asyncio.TimeoutError, Exception):
            return "参考资料"

    async def _reclassify_async(self, chunks: list[dict], filename: str):
        """Background: reclassify and update ChromaDB metadata."""
        try:
            new_type = await self._auto_classify(chunks)
            if new_type == "参考资料": return
            result = self._collection.get(limit=1000, where={"source_name": filename}, include=["metadatas"])
            if result["ids"]:
                for cid, meta in zip(result["ids"], result["metadatas"]):
                    meta["content_type"] = new_type
                    self._collection.update(ids=[cid], metadatas=[meta])
        except Exception:
            pass

    async def upload_docx(self, filepath: Path, content_type: str = "参考资料") -> UploadResult:
        """Upload a Word document, chunked by paragraphs."""
        try:
            from docx import Document
        except ImportError:
            return UploadResult(success=False, filename=filepath.name, chunks_created=0, message="python-docx is required for .docx files")

        try:
            doc = Document(str(filepath))
            chunks = []
            current = ""
            chunk_idx = 0
            for para in doc.paragraphs:
                text = para.text.strip()
                if not text:
                    continue
                if len(current) + len(text) < 800:
                    current += text + "\n"
                else:
                    if current:
                        chunks.append({"content": current.strip(), "page_number": 1, "chunk_index": chunk_idx})
                        chunk_idx += 1
                    current = text + "\n"
            if current:
                chunks.append({"content": current.strip(), "page_number": 1, "chunk_index": chunk_idx})

            if not chunks:
                return UploadResult(success=False, filename=filepath.name, chunks_created=0, message="No text extracted from DOCX")
        except Exception as e:
            return UploadResult(success=False, filename=filepath.name, chunks_created=0, message=str(e))

        result = self._index_chunks(chunks, filepath, content_type)
        if content_type == "参考资料" and result.success:
            import asyncio as _a
            try: _a.create_task(self._reclassify_async(chunks, filepath.name))
            except RuntimeError: pass
        return result

    def _index_chunks(self, chunks: list[dict], filepath: Path, content_type: str) -> UploadResult:
        """Index pre-processed chunks into ChromaDB."""
        if not chunks:
            return UploadResult(success=False, filename=filepath.name, chunks_created=0, message="No text extracted")

        ids: list[str] = []
        documents: list[str] = []
        metadatas: list[dict] = []
        embeddings: list[list[float]] = []

        for chunk in chunks:
            chunk_id = str(uuid.uuid4())
            ids.append(chunk_id)
            documents.append(chunk["content"])
            source_type = "docx" if filepath.suffix.lower() == '.docx' else "pdf"
            metadatas.append({
                "title": filepath.stem,
                "source_type": source_type,
                "source_name": filepath.name,
                "content_type": content_type,
                "page_number": chunk.get("page_number", 1),
                "chunk_index": chunk.get("chunk_index", 0),
            })
            try:
                emb = self._embed(chunk["content"])
                embeddings.append(emb)
            except Exception:
                embeddings.append([0.0] * 1536)

        if ids:
            try:
                self._collection.add(ids=ids, documents=documents, metadatas=metadatas, embeddings=embeddings)
            except Exception as e:
                return UploadResult(success=False, filename=filepath.name, chunks_created=0, message=str(e))

        return UploadResult(success=True, filename=filepath.name, chunks_created=len(ids),
                           message=f"Successfully indexed {len(ids)} chunks")

    async def upload_pdf(self, filepath: Path, content_type: str = "参考资料") -> UploadResult:
        chunks = pdf_parser.parse(filepath)
        result = self._index_chunks(chunks, filepath, content_type)
        if content_type == "参考资料" and result.success:
            import asyncio as _a
            try: _a.create_task(self._reclassify_async(chunks, filepath.name))
            except RuntimeError: pass
        return result

    def list_documents(self) -> list[dict]:
        """List all unique indexed documents with metadata."""
        if self._collection.count() == 0: return []
        result = self._collection.get(limit=1000, include=["metadatas"])
        docs: dict[str, dict] = {}
        if result["metadatas"]:
            for meta in result["metadatas"]:
                name = meta.get("source_name", "unknown")
                if name not in docs:
                    docs[name] = {"name": name, "title": meta.get("title", name), "chunk_count": 0, "indexed_at": meta.get("source_name", "")}
                docs[name]["chunk_count"] += 1
        return sorted(docs.values(), key=lambda x: x["name"])

    def get_document_chunks(self, doc_name: str) -> list[dict]:
        """Get all chunks for a specific document."""
        if self._collection.count() == 0: return []
        result = self._collection.get(
            limit=1000,
            where={"source_name": doc_name},
            include=["documents", "metadatas"],
        )
        chunks: list[dict] = []
        if result["ids"]:
            for i, cid in enumerate(result["ids"]):
                chunks.append({
                    "chunk_id": cid,
                    "content": result["documents"][i] if result["documents"] else "",
                    "page_number": result["metadatas"][i].get("page_number", 0) if result["metadatas"] else 0,
                    "chunk_index": result["metadatas"][i].get("chunk_index", 0) if result["metadatas"] else 0,
                })
        return sorted(chunks, key=lambda x: (x["page_number"], x["chunk_index"]))

    def delete_document(self, doc_name: str) -> int:
        """Delete all chunks for a document. Returns number of chunks deleted."""
        result = self._collection.get(limit=10000, where={"source_name": doc_name}, include=[])
        if result["ids"]:
            self._collection.delete(ids=result["ids"])
        return len(result["ids"])

    def get_collection_stats(self) -> dict:
        return {
            "total_chunks": self._collection.count(),
            "collection_name": self.COLLECTION_NAME,
        }

    def _embed(self, text: str) -> list[float]:
        import dashscope
        resp = dashscope.TextEmbedding.call(
            api_key=DASHSCOPE_API_KEY,
            model="text-embedding-v2",
            input=text[:2048],
        )
        if resp.status_code == 200:
            return resp.output["embeddings"][0]["embedding"]
        return [0.0] * 1536

    def _fallback_keyword_search(self, query: str, top_k: int = 3) -> list[SearchResult]:
        query_lower = query.lower()
        results: list[SearchResult] = []

        kb_dirs = [
            (Path(__file__).parent.parent / "data", "data"),
        ]
        for kb_dir, source_type in kb_dirs:
            if not kb_dir.exists():
                continue
            for f in kb_dir.glob("*.json"):
                try:
                    content = f.read_text(encoding="utf-8")
                    if any(kw in content.lower() for kw in query_lower.split()):
                        results.append(SearchResult(
                            chunk_id=f.stem,
                            title=f.stem.replace("_", " ").title(),
                            content=content,
                            snippet=content[:300],
                            source_type=source_type,
                            source_name=f.name,
                            relevance_score=0.5,
                        ))
                except Exception:
                    continue

        results.sort(key=lambda x: x.relevance_score, reverse=True)
        return results[:top_k]


knowledge_service = KnowledgeService()
