from pydantic import BaseModel, Field
from typing import Optional


class ChatRequest(BaseModel):
    session_id: str
    message: str
    skill_id: Optional[str] = None
    include_kb: bool = True


class ImageChatRequest(BaseModel):
    session_id: str
    message: str
    image: str = Field(..., description="Base64-encoded image data")
    skill_id: Optional[str] = None
    include_kb: bool = True


class SSEEvent(BaseModel):
    event: str
    data: dict
