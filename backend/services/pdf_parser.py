import re
from pathlib import Path
from typing import Optional


class PDFParser:
    CHUNK_SIZE = 500
    CHUNK_OVERLAP = 50

    def parse(self, filepath: Path) -> list[dict]:
        try:
            import fitz  # PyMuPDF
        except ImportError:
            raise ImportError("PyMuPDF is required. Install with: pip install PyMuPDF")

        doc = fitz.open(str(filepath))
        chunks: list[dict] = []

        for page_num, page in enumerate(doc, 1):
            text = page.get_text()
            text = self._clean_text(text)
            if not text.strip():
                continue
            page_chunks = self._split_text(text)
            for i, chunk_text in enumerate(page_chunks):
                chunks.append({
                    "content": chunk_text,
                    "page_number": page_num,
                    "chunk_index": i,
                    "source_name": filepath.name,
                })

        doc.close()
        return chunks

    def _clean_text(self, text: str) -> str:
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r'[ \t]{3,}', '  ', text)
        return text.strip()

    def _split_text(self, text: str) -> list[str]:
        paragraphs = text.split('\n\n')
        chunks: list[str] = []
        current_chunk = ""
        current_len = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            para_len = len(para)
            if current_len + para_len > self.CHUNK_SIZE and current_chunk:
                chunks.append(current_chunk.strip())
                overlap_text = current_chunk[-self.CHUNK_OVERLAP:] if len(current_chunk) > self.CHUNK_OVERLAP else current_chunk
                current_chunk = overlap_text + '\n\n' + para
                current_len = len(current_chunk)
            else:
                current_chunk = (current_chunk + '\n\n' + para).strip()
                current_len = len(current_chunk)

        if current_chunk.strip():
            chunks.append(current_chunk.strip())

        return chunks


pdf_parser = PDFParser()
