from pydantic import BaseModel
from typing import Optional


class SearchResult(BaseModel):
    chunk_id: str
    title: str
    content: str
    snippet: str
    source_type: str  # "topic" | "reference" | "glossary" | "exercise" | "pdf"
    source_name: str
    relevance_score: float
    keywords_matched: list[str] = []


class KnowledgeChunk(BaseModel):
    chunk_id: str
    title: str
    content: str
    source_type: str
    source_name: str
    page_number: Optional[int] = None


class UploadResult(BaseModel):
    success: bool
    filename: str
    chunks_created: int
    message: str
