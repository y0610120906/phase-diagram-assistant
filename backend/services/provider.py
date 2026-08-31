from config import LLM_PROVIDER


def get_llm_service():
    if LLM_PROVIDER == "glm":
        from services.glm_service import glm_service
        return glm_service

    from services.llm_service import llm_service
    return llm_service

