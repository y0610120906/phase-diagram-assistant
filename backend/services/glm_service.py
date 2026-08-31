"""GLM / Zhipu AI service — OpenAI-compatible streaming chat."""
import json
import httpx
from typing import AsyncGenerator, Optional

from config import GLM_API_KEY, GLM_CHAT_MODEL, GLM_VL_MODEL, GLM_BASE_URL


class GLMService:
    def __init__(self) -> None:
        self.api_key = GLM_API_KEY
        self.base_url = GLM_BASE_URL

    async def chat_stream(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        tools: Optional[list[dict]] = None,
    ) -> AsyncGenerator[dict, None]:
        """Stream chat with GLM API (OpenAI-compatible)."""
        if not self.api_key:
            yield {"type": "error", "message": "GLM_API_KEY not configured"}
            return

        body = {
            "model": GLM_CHAT_MODEL,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
        }
        if tools:
            body["tools"] = self._convert_tools(tools)
            body["tool_choice"] = "auto"

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=body,
                ) as response:
                    if response.status_code == 429:
                        import asyncio
                        await asyncio.sleep(3)  # Rate limit wait
                        text = await response.aread()
                        yield {"type": "error", "message": "GLM 速率限制，请稍后再试"}
                        return
                    if response.status_code != 200:
                        text = await response.aread()
                        yield {"type": "error", "message": f"GLM API error {response.status_code}: {text[:200]}"}
                        return

                    full_content = ""
                    yielded_tool_indices: set[int] = set()
                    tool_call_buffer: dict[int, dict] = {}

                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break

                        try:
                            data = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue

                        delta = data.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "") or ""

                        # Tool calls in delta
                        tc_list = delta.get("tool_calls")
                        if tc_list:
                            for tc in tc_list:
                                idx = tc.get("index", 0)
                                if idx in yielded_tool_indices:
                                    continue
                                fn = tc.get("function", {})
                                if idx not in tool_call_buffer:
                                    tool_call_buffer[idx] = {"name": fn.get("name", ""), "arguments": ""}
                                if fn.get("name"):
                                    tool_call_buffer[idx]["name"] = fn["name"]
                                tool_call_buffer[idx]["arguments"] += fn.get("arguments", "")

                                # Try to emit complete tool calls
                                name = tool_call_buffer[idx]["name"]
                                args_str = tool_call_buffer[idx]["arguments"]
                                if name and args_str:
                                    try:
                                        parsed_args = json.loads(args_str)
                                        yielded_tool_indices.add(idx)
                                        tool_call_buffer.pop(idx, None)
                                        yield {
                                            "type": "tool_call",
                                            "tool_name": name,
                                            "arguments": parsed_args,
                                            "tool_call_id": tc.get("id", ""),
                                            "done": False,
                                        }
                                    except json.JSONDecodeError:
                                        continue

                        if content:
                            if content.startswith(full_content):
                                delta_text = content[len(full_content):]
                                full_content = content
                            else:
                                delta_text = content
                                full_content = content
                            if delta_text:
                                yield {"type": "chunk", "content": delta_text, "done": False}

                    # Emit any remaining buffered tool calls
                    for idx, buf in tool_call_buffer.items():
                        if buf["name"] and buf["arguments"]:
                            try:
                                parsed = json.loads(buf["arguments"])
                                yield {
                                    "type": "tool_call",
                                    "tool_name": buf["name"],
                                    "arguments": parsed,
                                    "tool_call_id": "",
                                    "done": False,
                                }
                            except json.JSONDecodeError:
                                pass

                    yield {"type": "done", "done": True, "finish_reason": "stop"}

        except httpx.TimeoutException:
            yield {"type": "error", "message": "GLM API timeout"}
        except Exception as e:
            yield {"type": "error", "message": f"GLM error: {str(e)}"}

    async def chat_image_stream(
        self,
        messages: list[dict],
        image_base64: str,
        user_message: str,
        temperature: float = 0.5,
    ) -> AsyncGenerator[dict, None]:
        """Stream vision chat with GLM's OpenAI-compatible multimodal API."""
        if not self.api_key:
            yield {"type": "error", "message": "GLM_API_KEY not configured"}
            return

        vision_messages = list(messages)
        vision_messages.append({
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{image_base64}"},
                },
                {"type": "text", "text": user_message},
            ],
        })

        body = {
            "model": GLM_VL_MODEL,
            "messages": vision_messages,
            "temperature": temperature,
            "stream": True,
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=body,
                ) as response:
                    if response.status_code != 200:
                        text = await response.aread()
                        yield {"type": "error", "message": f"GLM VL API error {response.status_code}: {text[:200]}"}
                        return

                    full_content = ""
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue
                        delta = data.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "") or ""
                        if not content:
                            continue
                        if content.startswith(full_content):
                            delta_text = content[len(full_content):]
                            full_content = content
                        else:
                            delta_text = content
                            full_content = content
                        if delta_text:
                            yield {"type": "chunk", "content": delta_text, "done": False}

                    yield {"type": "done", "done": True}
        except httpx.TimeoutException:
            yield {"type": "error", "message": "GLM VL API timeout"}
        except Exception as e:
            yield {"type": "error", "message": f"GLM VL error: {str(e)}"}

    @staticmethod
    def _convert_tools(tools: list[dict]) -> list[dict]:
        """Convert our tool format to OpenAI function calling format."""
        result = []
        for t in tools:
            func = t.get("function", t)
            result.append({
                "type": "function",
                "function": {
                    "name": func["name"],
                    "description": func.get("description", ""),
                    "parameters": func.get("parameters", {"type": "object", "properties": {}}),
                },
            })
        return result


glm_service = GLMService()
