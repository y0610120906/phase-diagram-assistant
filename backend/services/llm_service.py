import json
import base64
import tempfile
import os
from typing import AsyncGenerator, Optional
from dashscope.aigc.generation import AioGeneration
from dashscope.aigc.multimodal_conversation import AioMultiModalConversation
from dashscope.common.error import DashScopeException

import dashscope
from config import DASHSCOPE_API_KEY, DASHSCOPE_CHAT_MODEL, DASHSCOPE_VL_MODEL

dashscope.api_key = DASHSCOPE_API_KEY


class LLMService:
    def __init__(self) -> None:
        self.api_key = DASHSCOPE_API_KEY

    async def chat_stream(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        tools: Optional[list[dict]] = None,
    ) -> AsyncGenerator[dict, None]:
        gen = AioGeneration()
        kwargs = {
            "model": DASHSCOPE_CHAT_MODEL,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
            "result_format": "message",
        }
        if tools:
            kwargs["tools"] = tools

        try:
            response = await gen.call(
                api_key=self.api_key,
                **kwargs,
            )
            full_content = ""
            yielded_tool_indices: set[int] = set()
            finish_reason = None
            async for chunk in response:
                if chunk.status_code == 200:
                    choice = chunk.output.choices[0]
                    msg = choice.message
                    content = msg.get("content", "") or ""
                    tc = msg.get("tool_calls")
                    finish_reason = choice.finish_reason if hasattr(choice, 'finish_reason') else None
                    if tc and not content:
                        tc_list = tc if isinstance(tc, list) else [tc]
                        for i, t in enumerate(tc_list):
                            if i in yielded_tool_indices:
                                continue
                            fn = t.get("function", {}) if isinstance(t, dict) else {}
                            raw_args = fn.get("arguments", "{}")
                            # DashScope streams args progressively — only emit when JSON is complete
                            if isinstance(raw_args, str):
                                try:
                                    parsed_args = json.loads(raw_args)
                                except json.JSONDecodeError:
                                    continue  # skip incomplete JSON chunks
                            else:
                                parsed_args = raw_args  # already a dict
                            yielded_tool_indices.add(i)
                            yield {
                                "type": "tool_call",
                                "tool_name": fn.get("name", ""),
                                "arguments": parsed_args,
                                "tool_call_id": t.get("id", "") if isinstance(t, dict) else "",
                                "done": False,
                            }
                    if content:
                        if content.startswith(full_content):
                            delta = content[len(full_content):]
                            full_content = content
                        else:
                            delta = content
                            full_content = content
                        if delta:
                            yield {"type": "chunk", "content": delta, "done": False}
                else:
                    yield {
                        "type": "error",
                        "message": f"API error: code={chunk.code}, message={chunk.message}",
                    }
            yield {"type": "done", "done": True, "finish_reason": finish_reason}
        except DashScopeException as e:
            yield {"type": "error", "message": f"DashScope error: {str(e)}"}
        except Exception as e:
            yield {"type": "error", "message": f"Unexpected error: {str(e)}"}

    async def chat_image_stream(
        self,
        messages: list[dict],
        image_base64: str,
        user_message: str,
        temperature: float = 0.5,
    ) -> AsyncGenerator[dict, None]:
        # Save base64 image to temp file for DashScope MultiModalConversation
        tmp_path = None
        try:
            img_data = base64.b64decode(image_base64)
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
                f.write(img_data)
                tmp_path = f.name
        except Exception as e:
            yield {"type": "error", "message": f"Image decode error: {str(e)}"}
            return

        try:
            mm = AioMultiModalConversation()
            messages_with_image = list(messages)
            messages_with_image.append({
                "role": "user",
                "content": [
                    {"image": f"file://{tmp_path}"},
                    {"text": user_message},
                ],
            })

            full_content = ""
            response = await mm.call(
                api_key=self.api_key,
                model=DASHSCOPE_VL_MODEL,
                messages=messages_with_image,
                temperature=temperature,
                stream=True,
            )
            async for chunk in response:
                if chunk.status_code == 200:
                    content = ""
                    if hasattr(chunk.output, 'choices') and chunk.output.choices:
                        msg = chunk.output.choices[0].message
                        raw_content = msg.get("content", "")
                        if isinstance(raw_content, list):
                            for item in raw_content:
                                if isinstance(item, dict) and "text" in item:
                                    content += item["text"]
                                elif isinstance(item, str):
                                    content += item
                        else:
                            content = raw_content or ""
                        if content:
                            if content.startswith(full_content):
                                delta = content[len(full_content):]
                                full_content = content
                            else:
                                delta = content
                                full_content = content
                            if delta:
                                yield {"type": "chunk", "content": delta, "done": False}
                else:
                    yield {"type": "error", "message": f"VL API error: {chunk.code} {chunk.message}"}
            yield {"type": "done", "done": True}
        except Exception as e:
            yield {"type": "error", "message": f"VL error: {str(e)}"}
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass


llm_service = LLMService()
