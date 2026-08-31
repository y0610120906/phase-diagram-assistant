import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
GLM_API_KEY = os.getenv("GLM_API_KEY", "")
BACKEND_PORT = int(os.environ.get("BACKEND_PORT", "8001"))

# Model provider: "glm" by default for the web review package.
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "glm").lower()

DASHSCOPE_CHAT_MODEL = "qwen-max"
DASHSCOPE_VL_MODEL = "qwen-vl-max"
DASHSCOPE_EMBEDDING_MODEL = "text-embedding-v2"

GLM_CHAT_MODEL = os.getenv("GLM_CHAT_MODEL", "glm-5.1")
GLM_VL_MODEL = os.getenv("GLM_VL_MODEL", "glm-5v-turbo")
GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"

KB_DATA_DIR = Path(os.environ.get("KB_DATA_DIR", str(BASE_DIR / "knowledge_base")))
SESSION_STORAGE_DIR = Path(os.environ.get("SESSION_STORAGE_DIR", str(BASE_DIR / "storage" / "sessions")))
CHROMA_PERSIST_DIR = str(BASE_DIR / "storage" / "chroma")
KNOWLEDGE_DOCS_DIR = BASE_DIR.parent / "knowledge_docs"

SESSION_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
KB_DATA_DIR.mkdir(parents=True, exist_ok=True)
