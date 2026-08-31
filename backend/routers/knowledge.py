import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

from config import KNOWLEDGE_DOCS_DIR
from services.knowledge_service import knowledge_service

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])

CONTENT_TYPES = ["边缘知识", "例题模板", "参考资料"]


@router.get("/search")
async def search_knowledge(q: str = "", top_k: int = 3, content_type: Optional[str] = None):
    results = knowledge_service.search(q, top_k=top_k, content_type=content_type)
    return {"results": [r.model_dump() for r in results]}


@router.post("/upload")
async def upload_knowledge(
    file: UploadFile = File(...),
    content_type: str = Form("参考资料"),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    if content_type not in CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid content_type. Must be one of: {CONTENT_TYPES}")

    ext = Path(file.filename).suffix.lower()
    if ext not in ['.pdf', '.txt', '.md', '.docx']:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}. Supported: PDF, DOCX, TXT, MD")

    KNOWLEDGE_DOCS_DIR.mkdir(parents=True, exist_ok=True)
    file_path = KNOWLEDGE_DOCS_DIR / file.filename

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    if ext == '.docx':
        result = await knowledge_service.upload_docx(file_path, content_type=content_type)
    else:
        result = await knowledge_service.upload_pdf(file_path, content_type=content_type)

    return result.model_dump()


@router.get("/documents")
async def list_documents():
    return {"documents": knowledge_service.list_documents()}


@router.get("/documents/{doc_name}/chunks")
async def get_document_chunks(doc_name: str):
    return {"chunks": knowledge_service.get_document_chunks(doc_name)}


@router.post("/index-folder")
async def index_folder(content_type: str = "参考资料"):
    """Batch index all files from knowledge_docs/ directory."""
    if content_type not in CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid content_type: {content_type}")
    if not KNOWLEDGE_DOCS_DIR.exists():
        return {"indexed": 0, "message": "knowledge_docs/ folder not found"}

    results = []
    for f in sorted(KNOWLEDGE_DOCS_DIR.iterdir()):
        if f.is_dir(): continue
        ext = f.suffix.lower()
        if ext not in ['.pdf', '.docx', '.txt', '.md']: continue
        try:
            if ext == '.docx':
                r = knowledge_service.upload_docx(f, content_type=content_type)
            else:
                r = knowledge_service.upload_pdf(f, content_type=content_type)
            results.append({"file": f.name, "chunks": r.chunks_created, "ok": r.success})
        except Exception as e:
            results.append({"file": f.name, "chunks": 0, "ok": False, "error": str(e)})

    return {"indexed": len(results), "results": results}


@router.delete("/documents/{doc_name}")
async def delete_document(doc_name: str):
    deleted = knowledge_service.delete_document(doc_name)
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"deleted": deleted}


@router.get("/stats")
async def knowledge_stats():
    return knowledge_service.get_collection_stats()
