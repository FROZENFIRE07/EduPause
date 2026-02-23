"""
MasteryOS Agent Core — FastAPI + LangGraph Multi-Agent State Machine
"""
import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any

from app.graph.graph import create_graph, invoke_graph
from app.graph.state import AgentState

load_dotenv()

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

# Initialize the graph
graph = create_graph()


class InvokeRequest(BaseModel):
    sessionId: str
    action: str  # "observe", "tutor", "evaluate", "break_recovery", "plan"
    clickstream: Optional[list] = None
    userAnswer: Optional[str] = None
    currentConcept: Optional[str] = None
    breakDuration: Optional[str] = None
    context: Optional[dict] = None


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
        }

        result = await invoke_graph(graph, initial_state, req.sessionId)
        
        return InvokeResponse(
            sessionId=req.sessionId,
            action=req.action,
            result=result,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/response/{session_id}")
async def get_response(session_id: str):
    """Get the latest agent response for a session"""
    # In production: fetch from MongoDB checkpoint
    return {
        "sessionId": session_id,
        "status": "ready",
        "message": "Agent response placeholder — connect LangGraph checkpointer for persistence",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
