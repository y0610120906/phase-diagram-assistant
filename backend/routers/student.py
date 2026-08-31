from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.student_service import student_service, VALID_MASTERY

router = APIRouter(prefix="/api/student", tags=["student"])


class UpdateConceptRequest(BaseModel):
    concept: str
    mastery: str
    note: str = ""
    session_id: str = ""


@router.get("/profile")
async def get_profile():
    return student_service.get_profile()


@router.post("/concept")
async def update_concept(req: UpdateConceptRequest):
    if req.mastery not in VALID_MASTERY:
        raise HTTPException(status_code=400, detail=f"Invalid mastery: {req.mastery}. Valid: {VALID_MASTERY}")
    return student_service.update_concept(req.concept, req.mastery, req.note, req.session_id)


@router.get("/timeline")
async def get_timeline():
    return student_service.get_timeline()

@router.get("/trends")
async def get_trends():
    return student_service.get_trends()

@router.delete("/profile")
async def reset_profile():
    return student_service.reset()
