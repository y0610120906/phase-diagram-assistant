from pydantic import BaseModel
from typing import Optional


class QuizGenerateRequest(BaseModel):
    chapter: str = "铁碳相图"
    difficulty: str = "medium"
    count: int = 3
    question_type: str = "mixed"  # "choice" | "short_answer" | "fill_blank" | "true_false" | "mixed"


class QuizQuestion(BaseModel):
    id: str
    question: str
    question_type: str = "short_answer"
    options: list[str] = []
    correct_answer: str = ""
    answer_explanation: str = ""  # detailed explanation from generation
    chapter: str
    difficulty: str
    max_score: int = 10


class StudentAnswer(BaseModel):
    question_id: str
    student_answer: str
    question_text: str = ""
    question_type: str = "short_answer"
    correct_answer: str = ""
    answer_explanation: str = ""
    max_score: int = 10


class QuizGradeRequest(BaseModel):
    answers: list[StudentAnswer]


class GradeResult(BaseModel):
    question_id: str
    question: str
    question_type: str = "short_answer"
    student_answer: str
    score: int
    max_score: int = 10
    correct_answer: str = ""
    errors: list[str] = []
    correct_points: list[str] = []
    standard_answer: str
    explanation: str
