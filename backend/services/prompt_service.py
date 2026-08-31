from skills.base import SOCRATIC_BASE_PROMPT

COMPRESSION_THRESHOLD = 16
KEEP_RECENT = 8


def build_system_prompt(kb_context: str = "") -> str:
    from services.student_service import student_service
    prompt = SOCRATIC_BASE_PROMPT
    student_ctx = student_service.build_context()
    if student_ctx:
        prompt += f"\n\n{student_ctx}"
    if kb_context:
        prompt += f"\n\n=== 知识库参考内容 ===\n{kb_context}\n=== 知识库内容结束 ==="
    return prompt


async def build_messages_with_compression(
    session_id: str,
    kb_context: str = "",
) -> tuple[str, str]:
    """Build system prompt + optional history summary. Compresses old messages when needed."""
    from services.session_service import session_service

    system_prompt = build_system_prompt(kb_context=kb_context)

    session = session_service.get_session(session_id)
    if not session:
        return system_prompt, ""

    total = len(session.messages)
    if total <= COMPRESSION_THRESHOLD:
        return system_prompt, session.history_summary

    old_count = total - KEEP_RECENT
    if old_count < 4:
        return system_prompt, session.history_summary

    if session.history_summary:
        return system_prompt, session.history_summary

    old_messages = session.messages[:old_count]
    summary = await _summarize_messages(old_messages)

    if summary:
        session.history_summary = summary
        session_service._save(session)

    return system_prompt, summary


async def _summarize_messages(messages: list) -> str:
    from services.provider import get_llm_service
    llm_service = get_llm_service()

    transcript = ""
    for m in messages:
        role = "学生" if m.role == "user" else "助教"
        text = (m.content or "")[:300]
        transcript += f"{role}: {text}\n"

    prompt = f"""将以下对话历史压缩为一段简短摘要（80字以内），只保留：
- 学生问了哪些关键问题
- 学生表现出对哪些概念的掌握或困惑
- 教学进行到了哪个阶段

对话:
{transcript}

摘要:"""

    try:
        content = ""
        async for event in llm_service.chat_stream(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        ):
            if event["type"] == "chunk" and event.get("content"):
                content += event["content"]
            elif event["type"] == "done":
                break
            elif event["type"] == "error":
                return ""
        return content.strip()[:200]
    except Exception:
        return ""
