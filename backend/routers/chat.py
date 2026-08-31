import json
import uuid
import asyncio
from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models.chat import ChatRequest, ImageChatRequest
from models.session import Message
from services.provider import get_llm_service
from services.session_service import session_service
from services.knowledge_service import knowledge_service
from services.prompt_service import build_system_prompt, build_messages_with_compression
from tools import get_tool_definitions, execute_tool

_chat_llm = get_llm_service()

router = APIRouter(prefix="/api", tags=["chat"])


def _format_sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _execute_tool_and_emit(tool_name: str, tool_args: dict):
    """Execute a tool and build SSE events + return the collected tool call record.

    Returns (text_events, diagram_event_or_none, record). Diagram events are
    returned separately so the caller can buffer them and only emit the last one.
    """
    tool_result = execute_tool(tool_name, tool_args)
    text_events = [_format_sse("tool_result", {"tool_name": tool_name, "result": tool_result})]
    diagram_event = None
    if "image_base64" in tool_result:
        diagram_event = _format_sse("diagram", {"image_base64": tool_result["image_base64"], "caption": tool_result.get("caption", "")})
    record = {"tool_name": tool_name, "arguments": tool_args, "result": tool_result}
    return text_events, diagram_event, record


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    session = session_service.get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    kb_context = ""
    kb_chunks = []
    if request.include_kb:
        # Only inject edge-knowledge & reference, skip exam templates (they're for quiz)
        results = knowledge_service.search(request.message, top_k=3, content_type="边缘知识")
        if len(results) < 3:
            ref = knowledge_service.search(request.message, top_k=3 - len(results), content_type="参考资料")
            results.extend(ref)
        if results:
            kb_context = "\n\n".join([f"[{r.title} ({r.source_name})]: {r.content}" for r in results])
            kb_chunks = [{"chunk_id": r.chunk_id, "title": r.title, "snippet": r.snippet} for r in results]

    system_prompt, history_summary = await build_messages_with_compression(
        session_id=request.session_id,
        kb_context=kb_context,
    )

    # Build base conversation messages (everything before the current user message)
    conversation = [{"role": "system", "content": system_prompt}]
    if history_summary:
        conversation.append({"role": "system", "content": f"[对话历史摘要]: {history_summary}"})

    for msg in session.messages[-20:]:
        content = msg.content
        if msg.role == "user" and msg.image_base64:
            content = [
                {"image": f"data:image/png;base64,{msg.image_base64}"},
                {"text": msg.content},
            ]
        conversation.append({"role": msg.role, "content": content})
    conversation.append({"role": "user", "content": request.message})

    temperature = 0.7
    tools = get_tool_definitions()  # all tools enabled by default

    # Track rounds for multi-message output
    message_index = 0  # count of saved assistant messages this turn

    async def event_generator():
        nonlocal message_index

        if kb_chunks:
            yield _format_sse("kb", {"chunk_ids": [c["chunk_id"] for c in kb_chunks], "titles": [c["title"] for c in kb_chunks], "snippets": [c["snippet"] for c in kb_chunks]})

        # Save user message FIRST so it appears before assistant responses
        user_msg = Message(
            id=str(uuid.uuid4()),
            role="user",
            content=request.message,
            timestamp=datetime.now().isoformat(),
        )
        session_service.add_message(request.session_id, user_msg)

        try:
            # Multi-turn loop: each round may produce one standalone message
            while True:
                round_tool_calls: list[dict] = []
                round_content = ""
                round_diagram_b64: str | None = None

                async for event in _chat_llm.chat_stream(messages=conversation, temperature=temperature, tools=tools):
                    if event["type"] == "chunk":
                        if event.get("content"):
                            chunk_text = event["content"]
                            round_content += chunk_text
                            yield _format_sse("chunk", {"content": chunk_text, "done": False})

                    elif event["type"] == "tool_call":
                        tool_name = event.get("tool_name", "")
                        tool_call_id = event.get("tool_call_id", str(uuid.uuid4()))
                        tool_args_raw = event.get("arguments", "{}")
                        if isinstance(tool_args_raw, str):
                            try:
                                tool_args_raw = json.loads(tool_args_raw)
                            except json.JSONDecodeError:
                                tool_args_raw = {}
                        yield _format_sse("tool_call", {"tool_name": tool_name, "arguments": tool_args_raw})
                        text_events, diagram_event, record = _execute_tool_and_emit(tool_name, tool_args_raw)
                        record["id"] = tool_call_id
                        round_tool_calls.append(record)
                        for ev in text_events:
                            yield ev
                        if diagram_event:
                            round_diagram_b64 = record["result"].get("image_base64")

                    elif event["type"] == "error":
                        yield _format_sse("error", {"message": event["message"]})

                    elif event["type"] == "done":
                        if round_tool_calls:
                            # LLM requested tools — add messages to conversation, continue loop
                            if round_content:
                                conversation.append({"role": "assistant", "content": round_content})
                            api_tool_calls = []
                            for tc in round_tool_calls:
                                api_tool_calls.append({
                                    "id": tc.get("id", str(uuid.uuid4())),
                                    "type": "function",
                                    "function": {
                                        "name": tc["tool_name"],
                                        "arguments": json.dumps(tc["arguments"], ensure_ascii=False),
                                    },
                                })
                            conversation.append({"role": "assistant", "content": None, "tool_calls": api_tool_calls})
                            for tc in round_tool_calls:
                                result_for_llm = dict(tc["result"])
                                result_for_llm.pop("image_base64", None)
                                caption = result_for_llm.get("caption", "")
                                conversation.append({
                                    "role": "tool",
                                    "content": f"[系统提示] 相图「{caption}」已生成并显示在对话中。你无需、也不能使用 ![]() 语法引用它。直接讲解即可。",
                                    "tool_call_id": tc.get("id", ""),
                                })

                            # Emit diagram for this round if any
                            if round_diagram_b64:
                                yield _format_sse("diagram", {"image_base64": round_diagram_b64, "caption": round_tool_calls[-1]["result"].get("caption", "")})

                            # Save this round as a standalone message
                            msg_sse = _save_round_message(round_content, round_tool_calls, round_diagram_b64)
                            if msg_sse: yield msg_sse
                            break  # continue while loop

                        # No tool calls — final round
                        # Emit any pending diagram
                        if round_diagram_b64:
                            yield _format_sse("diagram", {"image_base64": round_diagram_b64, "caption": ""})

                        # Save final round as assistant message
                        msg_sse = _save_round_message(round_content, round_tool_calls, round_diagram_b64)
                        if msg_sse: yield msg_sse

                        yield _format_sse("done", {"message_id": str(uuid.uuid4()), "done": True, "usage": {}})

                        # Fire-and-forget: analyze & update student profile
                        asyncio.create_task(_analyze_and_update_profile(request.message, round_content, request.session_id))
                        return

        except Exception as e:
            yield _format_sse("error", {"message": str(e)})

    def _save_round_message(content: str, tool_calls: list[dict], diagram_b64: str | None) -> str | None:
        """Save a single round as an independent assistant message. Returns SSE string or None."""
        nonlocal message_index
        if not content and not tool_calls and not diagram_b64:
            return None
        cleaned_tool_calls = []
        for tc in tool_calls:
            tc_clean = {"tool_name": tc["tool_name"], "arguments": tc["arguments"]}
            result = dict(tc.get("result", {}))
            result.pop("image_base64", None)
            tc_clean["result"] = result
            cleaned_tool_calls.append(tc_clean)

        msg_id = str(uuid.uuid4())
        assistant_msg = Message(
            id=msg_id,
            role="assistant",
            content=content,
            kb_references=kb_chunks if message_index == 0 else [],
            tool_calls=cleaned_tool_calls,
            diagram_base64=diagram_b64,
            timestamp=datetime.now().isoformat(),
        )
        session_service.add_message(request.session_id, assistant_msg)
        message_index += 1

        return _format_sse("msg", {
            "id": msg_id,
            "role": "assistant",
            "content": content,
            "diagram_base64": diagram_b64 or "",
            "tool_calls": cleaned_tool_calls,
            "timestamp": assistant_msg.timestamp,
            "kb_references": kb_chunks if message_index == 1 else [],
        })

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _analyze_and_update_profile(user_msg: str, assistant_reply: str, session_id: str = ""):
    """Fire-and-forget: analyze conversation turn and update student profile."""
    if not assistant_reply:
        return
    try:
        print(f"[profile] Analyzing conversation turn...")
        from services.student_service import student_service
        analysis_prompt = f"""分析以下教学对话，提取学生涉及的知识点及其掌握程度。

学生: {user_msg[:500]}
老师: {assistant_reply[:500]}

返回 JSON: {{"concepts": [{{"name": "知识点名称(简洁，5-10字)", "mastery": "mastered|weak|learning", "note": "简短说明(10字内)"}}]}}

规则:
- mastered: 学生明确展示了正确理解（正确回答、清晰复述、独立计算）。非常严格——不确定时不要标mastered
- weak: 学生明显表现出困惑或错误
- learning: 正在讨论中，尚未确认是否掌握（默认选这个）
- 最多3个概念，宁缺毋滥
- 相似概念合并为一个（"Fe-C相图""铁碳相图"选一个）"""

        content = ""
        async for event in _chat_llm.chat_stream(
            messages=[{"role": "user", "content": analysis_prompt}],
            temperature=0.2,
        ):
            if event["type"] == "chunk" and event.get("content"):
                content += event["content"]
            elif event["type"] == "done":
                break
            elif event["type"] == "error":
                return

        import json as _json
        try:
            # Extract JSON from response
            start = content.find("{")
            end = content.rfind("}") + 1
            if start >= 0 and end > start:
                analysis = _json.loads(content[start:end])
                student_service.update_from_conversation(analysis, session_id)
                print(f"[profile] Updated: {_json.dumps(analysis, ensure_ascii=False)}")
        except (_json.JSONDecodeError, KeyError):
            pass
    except Exception as e:
        print(f"[profile] Analysis skipped: {e}")


@router.post("/chat/image")
async def chat_image(request: ImageChatRequest):
    session = session_service.get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    system_prompt, _ = await build_messages_with_compression(
        session_id=request.session_id,
        kb_context="",
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in session.messages[-10:]:
        messages.append({"role": msg.role, "content": msg.content})

    temperature = 0.5
    accumulated_content = ""

    async def event_generator():
        nonlocal accumulated_content

        try:
            async for event in _chat_llm.chat_image_stream(
                messages=messages,
                image_base64=request.image,
                user_message=request.message,
                temperature=temperature,
            ):
                if event["type"] == "chunk":
                    if event.get("content"):
                        accumulated_content += event["content"]
                        yield _format_sse("chunk", {"content": event["content"], "done": False})
                elif event["type"] == "error":
                    yield _format_sse("error", {"message": event["message"]})
                elif event["type"] == "done":
                    user_msg = Message(
                        id=str(uuid.uuid4()),
                        role="user",
                        content=request.message,
                        image_base64=request.image,
                        timestamp=datetime.now().isoformat(),
                    )
                    session_service.add_message(request.session_id, user_msg)

                    if accumulated_content:
                        assistant_msg = Message(
                            id=str(uuid.uuid4()),
                            role="assistant",
                            content=accumulated_content,
                            timestamp=datetime.now().isoformat(),
                        )
                        session_service.add_message(request.session_id, assistant_msg)

                    yield _format_sse("done", {"message_id": str(uuid.uuid4()), "done": True, "usage": {}})

        except Exception as e:
            yield _format_sse("error", {"message": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/sessions/{session_id}/auto-title")
async def auto_title(session_id: str):
    """Generate a smart title for the session based on the first exchange."""
    session = session_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.title != "新会话":
        return {"title": session.title}

    user_msgs = [m for m in session.messages if m.role == "user"]
    assistant_msgs = [m for m in session.messages if m.role == "assistant"]

    if not user_msgs or not assistant_msgs:
        return {"title": session.title}

    first_q = user_msgs[0].content[:200]
    first_a = assistant_msgs[0].content[:200]

    prompt = f"""用一句话完整概括这段教学对话的核心内容，像文章标题一样自然通顺。
必须包含具体知识点名称和讨论重点。

例: "共晶反应概念解析与铁碳相图中的杠杆定律计算"
例: "Cu-Ni匀晶相图分析及固溶体概念对比讲解"
例: "Fe-C相图共析点标注及珠光体比例计算方法"

对话:
学生: {first_q}
老师: {first_a[:500]}

标题:"""

    try:
        async for event in _chat_llm.chat_stream(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
        ):
            if event["type"] == "chunk" and event.get("content"):
                title = event["content"].strip().strip('"''「」')
                vague = {'探讨', '讨论', '学习', '了解', '问答', '对话', '交流', '请教', '新会话', '新对话'}
                if len(title) >= 6 and title not in vague:
                    session_service.update_session(session_id, title=title[:60])
                    return {"title": title[:60]}
            elif event["type"] == "error":
                break
            elif event["type"] == "done":
                break
    except Exception:
        pass

    fallback = first_q[:30] + ("..." if len(first_q) > 30 else "")
    session_service.update_session(session_id, title=fallback)
    return {"title": fallback}
