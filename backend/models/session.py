from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


def _to_camel(s: str) -> str:
    parts = s.split('_')
    return parts[0] + ''.join(p.title() for p in parts[1:])


class Message(BaseModel):
    model_config = {"alias_generator": _to_camel, "populate_by_name": True}

    id: str
    role: str  # "user" | "assistant" | "system"
    content: str
    image_base64: Optional[str] = None
    kb_references: list[dict] = []
    tool_calls: list[dict] = []
    diagram_base64: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())


class Session(BaseModel):
    id: str
    title: str
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    active_skill_id: Optional[str] = None
    messages: list[Message] = []
    history_summary: str = ""


class SessionSummary(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    active_skill_id: Optional[str] = None
    message_count: int = 0


class CreateSessionRequest(BaseModel):
    title: Optional[str] = "新会话"


class UpdateSessionRequest(BaseModel):
    title: Optional[str] = None
    active_skill_id: Optional[str] = None
