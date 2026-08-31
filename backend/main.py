from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from routers import chat, sessions, knowledge, quiz, skills, student
from config import BACKEND_PORT, BASE_DIR, GLM_API_KEY, LLM_PROVIDER

app = FastAPI(
    title="相图学习助手 API",
    version="0.1.0",
    description="Phase Diagram Learning Assistant Backend",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(sessions.router)
app.include_router(knowledge.router)
app.include_router(quiz.router)
app.include_router(skills.router)
app.include_router(student.router)


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "backend_version": "0.1.0",
        "llm_provider": LLM_PROVIDER,
        "glm_configured": bool(GLM_API_KEY),
    }


DIST_DIR = BASE_DIR.parent / "dist"
ASSETS_DIR = DIST_DIR / "assets"

if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_frontend(full_path: str):
    """Serve the built React app in review/package mode."""
    if not DIST_DIR.exists():
        return {
            "status": "api-only",
            "message": "Frontend dist/ not found. Run npm run build for package mode.",
        }

    requested = (DIST_DIR / full_path).resolve()
    dist_root = DIST_DIR.resolve()
    if full_path and requested.is_file() and str(requested).startswith(str(dist_root)):
        return FileResponse(requested)

    return FileResponse(DIST_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=BACKEND_PORT, reload=True)
