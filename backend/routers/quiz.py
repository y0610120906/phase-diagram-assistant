import json
import re
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models.quiz import QuizGenerateRequest, QuizGradeRequest
from services.provider import get_llm_service
from services.knowledge_service import knowledge_service
from difflib import SequenceMatcher

router = APIRouter(prefix="/api/quiz", tags=["quiz"])
_chat_llm = get_llm_service()


def _extract_json(text: str) -> str:
    """Extract JSON array/object from LLM response, handling markdown code fences."""
    text = text.strip()
    # Try to extract from ```json ... ``` code block
    m = re.search(r'```(?:json)?\s*([\[\{][\s\S]*[\]\}])\s*```', text)
    if m:
        return m.group(1)
    # Try to find first JSON array or object
    for start_char, end_char in [('[', ']'), ('{', '}')]:
        start = text.find(start_char)
        end = text.rfind(end_char)
        if start != -1 and end != -1 and start < end:
            return text[start:end + 1]
    return text


@router.post("/generate")
async def generate_quiz(request: QuizGenerateRequest):
    # Search KB for example templates
    kb_context = ""
    results = knowledge_service.search(f"{request.chapter}", top_k=5, content_type="例题模板")
    if results:
        kb_context = "\n\n---\n".join([f"[{r.title}]: {r.content[:800]}" for r in results])

    qtype = request.question_type
    type_instructions = {
        "choice": "全部生成选择题（4个选项A/B/C/D）。每题包含 question, options(数组4个), correct_answer(正确答案字母), explanation(详细解析: 为什么选这个, 为什么其他选项错, 涉及的知识点), max_score=5",
        "short_answer": "全部生成简答题。每题包含 question, correct_answer(完整参考答案, 含推理步骤和公式), max_score=10",
        "fill_blank": "全部生成填空题。每题包含 question, correct_answer(正确答案), explanation(解析), max_score=5",
        "true_false": "全部生成判断题。每题包含 question, correct_answer('对'或'错'), explanation(为什么对/错), max_score=3",
        "mixed": f"混合题型：{request.count}道题，每种题型都要包含 correct_answer 和 explanation",
    }
    type_inst = type_instructions.get(qtype, type_instructions["mixed"])

    system_prompt = f"""你是《物理化学》课程的出题助教。请生成{request.count}道题。

章节: {request.chapter}
难度: {request.difficulty} (basic/medium/advanced)
题型要求: {type_inst}
知识点覆盖: 覆盖不同知识点，避免重复"""

    if kb_context:
        system_prompt += f"""

=== 知识库例题模板（分析题型结构后生成相似格式的新题）===
{kb_context}
=== 例题结束 ===

⚠️ 分析上述例题的题型结构并复刻:
- 选择题是几选几？选项是什么风格？
- 简答题分几小问？每问多少分？
- 保持相同题型风格，但生成全新的、从未出现过的题目内容"""
    else:
        system_prompt += """

（知识库暂无该章节例题，根据你的知识生成）"""

    if qtype == "mixed":
        system_prompt += """

JSON格式（每题必须包含 correct_answer 和 answer_explanation）:
[
  {{"id":"q1","question":"选择题题目","question_type":"choice","options":["A. ...","B. ...","C. ...","D. ..."],"correct_answer":"A","answer_explanation":"为什么选A，其他为什么错，涉及的知识点","chapter":"...","difficulty":"...","max_score":5}},
  {{"id":"q2","question":"简答题题目","question_type":"short_answer","correct_answer":"完整的参考答案含推理步骤","answer_explanation":"解题思路和知识点详解","chapter":"...","difficulty":"...","max_score":10}}
]"""
    else:
        system_prompt += """

JSON数组（每题必须包含 correct_answer 和 answer_explanation）:
[
  {{"id":"q1","question":"...","question_type":"...","options":[...],"correct_answer":"...","answer_explanation":"详细解析...","chapter":"...","difficulty":"...","max_score":...}}
]"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"请生成{request.count}道{request.chapter}的{request.difficulty}难度题目（题型: {qtype}）"},
    ]

    questions_text = ""
    async for event in _chat_llm.chat_stream(messages=messages, temperature=0.7):
        if event["type"] == "chunk" and event.get("content"):
            questions_text += event["content"]

    try:
        questions_data = json.loads(_extract_json(questions_text))
        for q in questions_data:
            if "id" not in q:
                q["id"] = str(uuid.uuid4())
    except (json.JSONDecodeError, ValueError):
        questions_data = [{
            "id": str(uuid.uuid4()),
            "question": q.strip(),
            "chapter": request.chapter,
            "difficulty": request.difficulty,
            "max_score": 10,
        } for q in questions_text.split("\n") if len(q.strip()) > 10]

    return {"questions": questions_data}


def _similarity(a: str, b: str) -> float:
    """Simple text similarity for short answer grading."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

PLACEHOLDER_PATTERNS = ["请提供", "标准答案", "参考答案", "具体问题", "具体内容", "完整正确"]

def _is_placeholder(text: str) -> bool:
    return not text or any(p in text for p in PLACEHOLDER_PATTERNS)

def _build_answer_explanation(qtype: str, correct: str, qtext: str) -> tuple[str, str]:
    if qtype == 'choice':
        std = f"正确答案是 {correct}。{qtext}"
        exp = f"本题考察对相图知识点的理解。{qtext}"
    elif qtype == 'true_false':
        std = f"本题说法是「{correct}」的。"
        exp = f"本题是对相图概念的判断。{qtext}"
    elif qtype == 'fill_blank':
        std = f"正确答案：{correct}"
        exp = f"填空答案为「{correct}」。{qtext}"
    else:
        std = correct if not _is_placeholder(correct) else f"参考答案：{qtext}"
        exp = correct if not _is_placeholder(correct) else f"本题考察相图知识点的理解和应用。{qtext}"
    return std, exp

@router.post("/grade")
async def grade_quiz(request: QuizGradeRequest):
    """Grade without LLM - uses question's built-in correct_answer and answer_explanation."""
    results = []
    for a in request.answers:
        qtype = a.question_type
        correct = (a.correct_answer or "").strip()
        expl = (a.answer_explanation or "").strip()
        student = (a.student_answer or "").strip()
        qtext = (a.question_text or "").strip()
        max_s = a.max_score

        # Fix placeholder answers
        if _is_placeholder(correct) or _is_placeholder(expl):
            correct, expl = _build_answer_explanation(qtype, correct, qtext)

        if qtype in ('choice', 'true_false'):
            expected = correct.upper().replace('对', 'A').replace('错', 'B')
            got = student.upper()
            ok = (got == expected)
            results.append({
                "question_id": a.question_id, "question_type": qtype,
                "score": max_s if ok else 0, "max_score": max_s,
                "correct_answer": correct,
                "errors": [] if ok else ["答案不正确"],
                "correct_points": ["回答正确"] if ok else [],
                "standard_answer": correct,
                "explanation": expl,
            })

        elif qtype == 'fill_blank':
            ok = (student.lower() == correct.lower() or correct.lower() in student.lower())
            score = max_s if ok else (max_s // 2 if student else 0)
            results.append({
                "question_id": a.question_id, "question_type": qtype,
                "score": score, "max_score": max_s,
                "correct_answer": correct,
                "errors": [] if ok else (["答案不完整"] if student else ["未作答"]),
                "correct_points": ["回答正确"] if ok else (["部分正确"] if student else []),
                "standard_answer": correct,
                "explanation": expl,
            })

        else:  # short_answer
            if not student:
                score = 0
                errors = ["未作答"]
                pts = []
            else:
                sim = _similarity(student, correct) if correct else 0.3
                if sim > 0.7:
                    score = max_s
                    errors = []
                    pts = ["回答与标准答案高度一致"]
                elif sim > 0.4:
                    score = max_s // 2
                    errors = ["部分内容不够准确或不够完整"]
                    pts = ["回答有部分正确内容"]
                else:
                    score = max(0, max_s // 4)
                    errors = ["回答与标准答案差异较大"]
                    pts = []

            results.append({
                "question_id": a.question_id, "question_type": qtype,
                "score": score, "max_score": max_s,
                "correct_answer": correct,
                "errors": errors,
                "correct_points": pts,
                "standard_answer": correct,
                "explanation": expl,
            })

    return {"results": results}
