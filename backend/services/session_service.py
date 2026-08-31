import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from config import SESSION_STORAGE_DIR
from models.session import Session, SessionSummary, Message


class SessionService:
    def __init__(self) -> None:
        SESSION_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    def _session_path(self, session_id: str) -> Path:
        return SESSION_STORAGE_DIR / f"{session_id}.json"

    def list_sessions(self) -> list[SessionSummary]:
        summaries: list[SessionSummary] = []
        for f in sorted(SESSION_STORAGE_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
            try:
                session = Session.model_validate_json(f.read_text(encoding="utf-8"))
                summaries.append(SessionSummary(
                    id=session.id,
                    title=session.title,
                    created_at=session.created_at,
                    updated_at=session.updated_at,
                    active_skill_id=session.active_skill_id,
                    message_count=len(session.messages),
                ))
            except Exception:
                continue
        return summaries

    def get_session(self, session_id: str) -> Optional[Session]:
        path = self._session_path(session_id)
        if not path.exists():
            return None
        return Session.model_validate_json(path.read_text(encoding="utf-8"))

    def create_session(self, title: str = "新会话") -> Session:
        session = Session(
            id=str(uuid.uuid4()),
            title=title,
        )
        self._save(session)
        return session

    def update_session(self, session_id: str, title: Optional[str] = None, active_skill_id: Optional[str] = None) -> Optional[Session]:
        session = self.get_session(session_id)
        if not session:
            return None
        if title is not None:
            session.title = title
        if active_skill_id is not None:
            session.active_skill_id = active_skill_id
        session.updated_at = datetime.now().isoformat()
        self._save(session)
        return session

    def delete_session(self, session_id: str) -> bool:
        path = self._session_path(session_id)
        if not path.exists():
            return False
        path.unlink()
        return True

    def add_message(self, session_id: str, message: Message) -> Optional[Session]:
        session = self.get_session(session_id)
        if not session:
            return None
        session.messages.append(message)
        session.updated_at = datetime.now().isoformat()
        self._save(session)
        return session

    def _save(self, session: Session) -> None:
        path = self._session_path(session.id)
        path.write_text(session.model_dump_json(indent=2, by_alias=True), encoding="utf-8")


session_service = SessionService()
