"""
LangGraph State Machine — Compile the multi-agent orchestration graph
"""
import asyncio
from langgraph.graph import StateGraph, END

from app.graph.state import AgentState
from app.graph.nodes import (
    observer_node,
    tutor_node,
    evaluator_node,
    planner_node,
    break_recovery_node,
)
from app.graph.edges import (
    route_action,
    should_intervene,
    check_mastery,
)


def create_graph():
    """
    Build and compile the LangGraph state machine.
    
    Flow:
        START → router → [observer | tutor | evaluator | planner | break_recovery]
        
        observer → (confusion > θ?) → tutor | END
        tutor → evaluator
        evaluator → (mastery?) → planner | tutor (retry loop)
        planner → END
        break_recovery → END
    """
    builder = StateGraph(AgentState)

    # Add nodes
    builder.add_node("observer", observer_node)
    builder.add_node("tutor", tutor_node)
    builder.add_node("evaluator", evaluator_node)
    builder.add_node("planner", planner_node)
    builder.add_node("break_recovery", break_recovery_node)

    # Entry point: route based on action
    builder.set_conditional_entry_point(
        route_action,
        {
            "observer": "observer",
            "tutor": "tutor",
            "evaluator": "evaluator",
            "planner": "planner",
            "break_recovery": "break_recovery",
        },
    )

    # Observer → conditional: intervene or continue
    builder.add_conditional_edges(
        "observer",
        should_intervene,
        {
            "tutor": "tutor",
            "continue": END,
        },
    )

    # Tutor → Evaluator (always evaluate after tutoring)
    builder.add_edge("tutor", END)  # In the full loop: tutor → evaluator

    # Evaluator → conditional: mastered or retry
    builder.add_conditional_edges(
        "evaluator",
        check_mastery,
        {
            "mastered": "planner",
            "retry": "tutor",   # Cyclic loop: tutor ↔ evaluator
        },
    )

    # Planner → END
    builder.add_edge("planner", END)

    # Break recovery → END
    builder.add_edge("break_recovery", END)

    # Compile the graph
    graph = builder.compile()
    
    print("✅ LangGraph state machine compiled successfully")
    print(f"   Nodes: {list(graph.nodes) if hasattr(graph, 'nodes') else 'compiled'}")
    
    return graph


async def invoke_graph(graph, state: AgentState, thread_id: str) -> dict:
    """
    Invoke the compiled graph with the given state.
    
    Args:
        graph: Compiled LangGraph
        state: Initial state
        thread_id: Session ID for checkpointing
    
    Returns:
        Final state after graph execution
    """
    config = {"configurable": {"thread_id": thread_id}}
    
    # LangGraph invoke (synchronous in current version)
    try:
        result = graph.invoke(state, config)
        return {
            "confusion_score": result.get("confusion_score", 0),
            "confusion_breakdown": result.get("confusion_breakdown", {}),
            "intervention": result.get("intervention"),
            "evaluation_feedback": result.get("evaluation_feedback", ""),
            "answer_correct": result.get("answer_correct"),
            "mastery_scores": result.get("mastery_scores", {}),
            "mastery_achieved": result.get("mastery_achieved", False),
            "next_content": result.get("next_content"),
            "recap_summary": result.get("recap_summary", ""),
        }
    except Exception as e:
        return {"error": str(e)}
