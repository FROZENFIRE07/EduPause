"""
Agent State Schema — Central state for the LangGraph multi-agent system
"""
from typing import TypedDict, Optional, Any


class Intervention(TypedDict, total=False):
    """Socratic intervention data"""
    type: str          # "mcq" or "text"
    question: str
    options: list[str]
    correct_index: int
    hint: str
    explanation: str
    context: str


class NextContent(TypedDict, total=False):
    """Next content recommendation"""
    video_id: str
    video_title: str
    chunk_index: int
    reason: str


class AgentState(TypedDict, total=False):
    """
    The central state object shared by all agent nodes.
    
    Every node reads from and writes to this state,
    ensuring absolute contextual awareness and synchronization.
    """
    # Session identity
    session_id: str
    action: str  # Current action being processed
    
    # Clickstream data
    clickstream_buffer: list[dict]  # Raw clickstream events
    
    # Cognitive metrics
    confusion_score: float          # 0.0 to 1.0 probabilistic score
    confusion_breakdown: dict       # Detailed metric breakdown
    
    # User input
    user_answer: str               # User's response to intervention
    current_concept: str           # Currently active concept
    
    # Transcript context (from Node.js backend enrichment)
    transcript_context: str        # The relevant lecture text at the user's playback position
    video_id: str                  # Current video being watched
    video_timestamp: float         # Current playback position in seconds
    
    # Mastery tracking
    mastery_scores: dict[str, float]   # concept_id -> score (0-100)
    
    # Agent outputs
    intervention: Optional[Intervention]  # Socratic question/hint
    recap_summary: str                    # Break recovery recap
    next_content: Optional[NextContent]   # Planner recommendation
    
    # Break recovery
    break_duration: str           # Human-readable break duration
    break_detected: bool          # Whether a significant break was detected
    
    # Conversation
    messages: list[dict]          # Chat history for tutor
    
    # Evaluation
    answer_correct: bool          # Whether user's answer was correct
    evaluation_feedback: str      # Evaluator's feedback message
    mastery_achieved: bool        # Whether mastery threshold reached
