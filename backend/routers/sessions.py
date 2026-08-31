from fastapi import APIRouter, HTTPException

from models.session import CreateSessionRequest, UpdateSessionRequest
from services.session_service import session_service
from services.provider import get_llm_service

router = APIRouter(prefix="/api/sessions", tags=["sessions"])
_chat_llm = get_llm_service()


@router.get("")
async def list_sessions():
    sessions = session_service.list_sessions()
    return {"sessions": [s.model_dump() for s in sessions]}


@router.post("")
async def create_session(request: CreateSessionRequest):
    session = session_service.create_session(title=request.title or "新会话")
    return session.model_dump(by_alias=True)


@router.get("/{session_id}")
async def get_session(session_id: str):
    session = session_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.model_dump(by_alias=True)


@router.patch("/{session_id}")
async def update_session(session_id: str, request: UpdateSessionRequest):
    session = session_service.update_session(
        session_id,
        title=request.title,
        active_skill_id=request.active_skill_id,
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.model_dump(by_alias=True)


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    deleted = session_service.delete_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"deleted": True}


@router.post("/{session_id}/receipt")
async def generate_receipt(session_id: str):
    """Generate a supermarket-receipt style learning summary."""
    session = session_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Build conversation transcript
    transcript = ""
    first_ts = None
    last_ts = None
    for m in session.messages:
        role = "🧑‍🎓" if m.role == "user" else "🤖"
        transcript += f"{role}: {m.content[:300]}\n"
        if m.timestamp:
            if not first_ts: first_ts = m.timestamp
            last_ts = m.timestamp

    # Duration
    duration_min = 0
    if first_ts and last_ts:
        from datetime import datetime
        try:
            t1 = datetime.fromisoformat(first_ts)
            t2 = datetime.fromisoformat(last_ts)
            duration_min = max(1, round((t2 - t1).total_seconds() / 60))
        except: pass

    rounds = len([m for m in session.messages if m.role == "user"])

    prompt = f"""你是学习记录员。根据以下教学对话，撰写一份详细的学习总结。

返回 JSON 格式（不要其他文字）:
{{
  "summary": "用2-3句话概述本次对话讨论了什么（50-100字）",
  "learned": [
    {{"topic": "学会的具体内容", "detail": "学生展示出的理解（如正确的回答、准确的计算、清晰的复述等）"}}
  ],
  "weak": [
    {{"topic": "薄弱点", "detail": "学生哪里没搞懂或答错了"}}
  ],
  "concepts": [
    {{"name": "知识点", "mastery": "mastered|weak|learning"}}
  ],
  "path": [
    {{"step": 1, "name": "知识点名称", "status": "done|current|next"}}
  ],
  "exercises": [
    {{"question": "根据对话内容出的练习题", "answer": "参考答案"}}
  ],
  "suggestions": ["具体可执行的学习建议1", "建议2"],
  "next": "下一步建议学什么（一句话）"
}}

规则:
- learned: 有具体证据的掌握内容，最多5条
- weak: 困惑或错误，最多3条
- path: 按学习顺序列出对话中涉及的知识点路径。done=已学完, current=正在学, next=接下来该学。最多6个
- exercises: 针对本次薄弱点生成2-3道练习题，含参考答案
- 用中文输出

对话:
{transcript[-4000:]}
"""

    try:
        content = ""
        async for event in _chat_llm.chat_stream(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
        ):
            if event["type"] == "chunk" and event.get("content"):
                content += event["content"]
            elif event["type"] == "done":
                break
            elif event["type"] == "error":
                raise HTTPException(status_code=500, detail="LLM analysis failed")

        import json as _json
        analysis = {}
        try:
            # Try to extract valid JSON
            start = content.find("{")
            end = content.rfind("}") + 1
            if start >= 0 and end > start:
                analysis = _json.loads(content[start:end])
        except (_json.JSONDecodeError, ValueError):
            # Try without markdown fences
            cleaned = content.replace("```json", "").replace("```", "").strip()
            try:
                start = cleaned.find("{")
                end = cleaned.rfind("}") + 1
                if start >= 0 and end > start:
                    analysis = _json.loads(cleaned[start:end])
            except (_json.JSONDecodeError, ValueError):
                pass

        return {
            "title": session.title,
            "date": first_ts[:10] if first_ts else "",
            "duration_min": duration_min,
            "rounds": rounds,
            "summary": analysis.get("summary", content[:200] if not analysis else ""),
            "learned": analysis.get("learned", []),
            "weak": analysis.get("weak", []),
            "concepts": analysis.get("concepts", []),
            "path": analysis.get("path", []),
            "exercises": analysis.get("exercises", []),
            "suggestions": analysis.get("suggestions", []),
            "next": analysis.get("next", ""),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
