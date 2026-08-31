from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from skills import list_skills, get_skill
from services.session_service import session_service

router = APIRouter(prefix="/api/skills", tags=["skills"])


class ActivateSkillRequest(BaseModel):
    session_id: str
    skill_id: str | None = None


@router.get("")
async def get_skills():
    return {"skills": list_skills()}


@router.post("/activate")
async def activate_skill(request: ActivateSkillRequest):
    if request.skill_id:
        skill = get_skill(request.skill_id)
        if not skill:
            raise HTTPException(status_code=404, detail=f"Skill not found: {request.skill_id}")

    session = session_service.update_session(
        request.session_id,
        active_skill_id=request.skill_id,
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"session_id": request.session_id, "active_skill_id": request.skill_id}
