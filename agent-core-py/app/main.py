"""
MasteryOS Agent Core — FastAPI + LangGraph Multi-Agent State Machine
"""
import os
import sys
import time
import logging
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any

from app.graph.graph import create_graph, invoke_graph
from app.graph.state import AgentState

load_dotenv()

# ─── Logging Setup ──────────────────────────────────────────────────────────

class ColorFormatter(logging.Formatter):
    """Rich colored formatter for terminal output"""
    COLORS = {
        'DEBUG':    '\033[36m',   # Cyan
        'INFO':     '\033[32m',   # Green
        'WARNING':  '\033[33m',   # Yellow
        'ERROR':    '\033[31m',   # Red
        'CRITICAL': '\033[41m',   # Red bg
    }
    RESET = '\033[0m'
    BOLD = '\033[1m'

    def format(self, record):
        color = self.COLORS.get(record.levelname, self.RESET)
        record.levelname = f"{color}{record.levelname:8s}{self.RESET}"
        record.name = f"\033[35m{record.name}\033[0m"
        return super().format(record)

# Configure root logger
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(ColorFormatter(
    fmt='%(asctime)s │ %(levelname)s │ %(name)s │ %(message)s',
    datefmt='%H:%M:%S'
))
logging.basicConfig(level=logging.INFO, handlers=[handler])

# Quiet down noisy libraries
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

logger = logging.getLogger("agent.main")

# ─── App Setup ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="MasteryOS Agent Core",
    description="Multi-agent orchestration for the Agentic Learning Operating System",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request Logging Middleware ─────────────────────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    logger.info("➡️  %s %s", request.method, request.url.path)

    response = await call_next(request)

    elapsed = (time.time() - start) * 1000
    status = response.status_code
    status_icon = "✅" if status < 400 else "⚠️" if status < 500 else "❌"

    logger.info("%s  %s %s → %d [%.1fms]",
                status_icon, request.method, request.url.path, status, elapsed)
    return response

# ─── Initialize Graph ──────────────────────────────────────────────────────

logger.info("")
logger.info("╔══════════════════════════════════════════════════════════════╗")
logger.info("║     🧠 MasteryOS Agent Core — Starting up                   ║")
logger.info("╠══════════════════════════════════════════════════════════════╣")
logger.info("║  GROQ_API_KEY:  %s", "✅ Set" if os.getenv("GROQ_API_KEY", "demo") != "demo" else "❌ Not set (mock mode)")
logger.info("║  GROQ_MODEL:    %s", os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"))
logger.info("╚══════════════════════════════════════════════════════════════╝")
logger.info("")

graph = create_graph()

logger.info("")
logger.info("🟢 Agent Core ready — awaiting requests on port 8000")
logger.info("")


class InvokeRequest(BaseModel):
    sessionId: str
    action: str  # "observe", "tutor", "evaluate", "break_recovery", "plan"
    clickstream: Optional[list] = None
    userAnswer: Optional[str] = None
    currentConcept: Optional[str] = None
    breakDuration: Optional[str] = None
    context: Optional[dict] = None
    transcriptContext: Optional[str] = None
    videoId: Optional[str] = None
    videoTimestamp: Optional[float] = None


class InvokeResponse(BaseModel):
    sessionId: str
    action: str
    result: Any


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "MasteryOS Agent Core",
        "version": "1.0.0",
        "graph_nodes": list(graph.nodes) if hasattr(graph, 'nodes') else [],
    }


@app.post("/invoke")
async def invoke(req: InvokeRequest):
    """Invoke the agent graph with current session state"""
    logger.info("")
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info("📨 /invoke request received")
    logger.info("  ├─ Session:  %s", req.sessionId)
    logger.info("  ├─ Action:   %s", req.action)
    logger.info("  ├─ Concept:  %s", req.currentConcept or "(none)")
    logger.info("  ├─ Events:   %d", len(req.clickstream or []))
    logger.info("  ├─ Answer:   \"%s\"", (req.userAnswer or "")[:40])
    logger.info("  └─ Break:    %s", req.breakDuration or "(none)")
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    try:
        initial_state: AgentState = {
            "session_id": req.sessionId,
            "action": req.action,
            "clickstream_buffer": req.clickstream or [],
            "user_answer": req.userAnswer or "",
            "current_concept": req.currentConcept or "",
            "break_duration": req.breakDuration or "",
            "confusion_score": 0.0,
            "mastery_scores": {},
            "intervention": None,
            "recap_summary": "",
            "next_content": None,
            "messages": [],
            "transcript_context": req.transcriptContext or "",
            "video_id": req.videoId or "",
            "video_timestamp": req.videoTimestamp or 0.0,
        }

        result = await invoke_graph(graph, initial_state, req.sessionId)

        logger.info("📤 Sending response for session=%s action=%s", req.sessionId, req.action)

        return InvokeResponse(
            sessionId=req.sessionId,
            action=req.action,
            result=result,
        )
    except Exception as e:
        logger.error("❌ Invoke error: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/response/{session_id}")
async def get_response(session_id: str):
    """Get the latest agent response for a session"""
    logger.info("📖 /response/%s — returning placeholder", session_id)
    return {
        "sessionId": session_id,
        "status": "ready",
        "message": "Agent response placeholder — connect LangGraph checkpointer for persistence",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
