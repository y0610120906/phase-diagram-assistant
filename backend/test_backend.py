"""
相图学习助手 - 后端功能测试脚本
Usage: python test_backend.py
"""
import httpx
import json
import sys

import os
BASE = f"http://127.0.0.1:{os.environ.get('BACKEND_PORT', '8000')}"
passed = 0
failed = 0


def test(name, fn):
    global passed, failed
    try:
        fn()
    except Exception as e:
        failed += 1
        print(f"  FAIL: {e}")
        return
    passed += 1
    print(f"  OK")


def main():
    global passed, failed
    client = httpx.Client(timeout=120)

    print("=" * 50)
    print("相图学习助手 - 后端功能测试")
    print("=" * 50)

    # 1. Health
    print("\n1. Health Check")
    test("health", lambda: (
        r := client.get(f"{BASE}/api/health"),
        print(f"   status={r.json()['status']}, api_key={r.json()['dashscope_configured']}")
    ))

    # 2. Create session
    print("\n2. Session CRUD")
    sid = None
    def create_session():
        nonlocal sid
        r = client.post(f"{BASE}/api/sessions", json={"title": "测试会话"})
        sid = r.json()["id"]
        print(f"   session_id={sid[:8]}...")
    test("create", create_session)

    def list_sessions():
        r = client.get(f"{BASE}/api/sessions")
        print(f"   count={len(r.json()['sessions'])}")
    test("list", list_sessions)

    # 3. Skills
    print("\n3. Skills")
    def list_skills():
        r = client.get(f"{BASE}/api/skills")
        names = [s["name"] for s in r.json()["skills"]]
        print(f"   {names}")
    test("list", list_skills)

    def activate_skill():
        r = client.post(f"{BASE}/api/skills/activate", json={
            "session_id": sid, "skill_id": "concept_explanation"
        })
        print(f"   active={r.json()['active_skill_id']}")
    test("activate", activate_skill)

    # 4. Chat streaming
    print("\n4. Chat (苏格拉底式对话)")
    def chat():
        text = ""
        with client.stream("POST", f"{BASE}/api/chat/stream", json={
            "session_id": sid,
            "message": "什么是共晶反应？",
            "include_kb": False,
        }) as resp:
            et = ""
            for line in resp.iter_lines():
                if line.startswith("event: "):
                    et = line[7:]
                elif line.startswith("data: "):
                    if et == "chunk":
                        text += json.loads(line[6:]).get("content", "")
                    elif et == "error":
                        print(f"   ERROR: {line}")
        # Check for Socratic questioning
        socratic = "你觉得" in text or "你想" in text or "你能" in text
        print(f"   chars={len(text)}, socratic={socratic}")
        print(f"   preview: {text[:150]}...")
    test("chat", chat)

    # 5. Messages persisted
    print("\n5. Message Persistence")
    def check_msgs():
        r = client.get(f"{BASE}/api/sessions/{sid}")
        msgs = r.json()["messages"]
        print(f"   messages saved={len(msgs)}")
    test("persist", check_msgs)

    # 6. Lever rule tool
    print("\n6. Lever Rule Calculator")
    def lever():
        from tools import execute_tool
        r = execute_tool("lever_rule_calculator", {"system": "Fe-C", "C0": 0.4, "T": 726})
        print(f"   {r.get('microconstituents', r.get('error', '??'))}")
    test("lever", lever)

    # 7. Phase diagram renderer
    print("\n7. Phase Diagram Renderer")
    def diagram():
        from tools import execute_tool
        r = execute_tool("phase_diagram_renderer", {
            "system": "Fe-C",
            "highlight_composition": 0.4,
            "highlight_temperature": 727,
            "show_lever_line": True,
            "mark_points": ["eutectoid"],
        })
        img_len = len(r.get("image_base64", ""))
        caption = r.get("caption", "")
        print(f"   image={img_len} bytes, caption={caption}")
    test("diagram", diagram)

    # 8. Quiz generate
    print("\n8. Quiz Generate")
    def quiz():
        r = client.post(f"{BASE}/api/quiz/generate", json={
            "chapter": "铁碳相图", "difficulty": "basic", "count": 2
        })
        qs = r.json().get("questions", [])
        print(f"   generated {len(qs)} questions")
        for q in qs:
            print(f"   Q: {q.get('question', str(q))[:100]}...")
    test("quiz", quiz)

    # Summary
    print(f"\n{'=' * 50}")
    total = passed + failed
    print(f"Results: {passed}/{total} passed", end="")
    if failed:
        print(f", {failed} FAILED")
    else:
        print(" - ALL PASSED!")

    client.close()


if __name__ == "__main__":
    main()
