from .base import BaseSkill
from .concept_explanation import ConceptExplanationSkill, CONCEPT_EXPLANATION_CONFIG
from .diagram_analysis import DiagramAnalysisSkill, DIAGRAM_ANALYSIS_CONFIG
from .guided_practice import GuidedPracticeSkill, GUIDED_PRACTICE_CONFIG
from .topic_review import TopicReviewSkill, TOPIC_REVIEW_CONFIG

SKILL_REGISTRY: dict[str, BaseSkill] = {
    "concept_explanation": ConceptExplanationSkill(CONCEPT_EXPLANATION_CONFIG),
    "diagram_analysis": DiagramAnalysisSkill(DIAGRAM_ANALYSIS_CONFIG),
    "guided_practice": GuidedPracticeSkill(GUIDED_PRACTICE_CONFIG),
    "topic_review": TopicReviewSkill(TOPIC_REVIEW_CONFIG),
}


def get_skill(skill_id: str) -> BaseSkill | None:
    return SKILL_REGISTRY.get(skill_id)


def list_skills() -> list[dict]:
    return [
        {
            "id": s.config.id,
            "name": s.config.name,
            "description": s.config.description,
            "icon": s.config.icon,
        }
        for s in SKILL_REGISTRY.values()
    ]
