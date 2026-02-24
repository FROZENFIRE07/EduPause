"""
LangGraph State Machine — Compile the multi-agent orchestration graph
"""
import asyncio
import logging
import time
import json
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

logger = logging.getLogger("agent.graph")


def create_graph():
    """
    Build and compile the LangGraph state machine.
    """
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info("🔧 Compiling LangGraph state machine...")
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    builder = StateGraph(AgentState)

    # Add nodes
    builder.add_node("observer", observer_node)
    builder.add_node("tutor", tutor_node)
    builder.add_node("evaluator", evaluator_node)
    builder.add_node("planner", planner_node)
    builder.add_node("break_recovery", break_recovery_node)

    logger.info("  ✅ Nodes added: observer, tutor, evaluator, planner, break_recovery")

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
    logger.info("  ✅ Entry router configured")

    # Observer → conditional: intervene or continue
    builder.add_conditional_edges(
        "observer",
        should_intervene,
        {
            "tutor": "tutor",
            "continue": END,
        },
    )

    # Tutor → END
    builder.add_edge("tutor", END)

    # Evaluator → conditional: mastered or retry
    builder.add_conditional_edges(
        "evaluator",
        check_mastery,
        {
            "mastered": "planner",
            "retry": "tutor",
        },
    )

    # Planner → END
    builder.add_edge("planner", END)

    # Break recovery → END
    builder.add_edge("break_recovery", END)

    logger.info("  ✅ Edges configured:")
    logger.info("    ├─ observer → [should_intervene] → tutor | END")
    logger.info("    ├─ tutor → END")
    logger.info("    ├─ evaluator → [check_mastery] → planner | tutor")
    logger.info("    ├─ planner → END")
    logger.info("    └─ break_recovery → END")

    # Compile the graph
    graph = builder.compile()

    logger.info("  ✅ Graph compiled successfully!")
    logger.info("  📊 Nodes: %s", list(graph.nodes) if hasattr(graph, 'nodes') else 'compiled')

    return graph


async def invoke_graph(graph, state: AgentState, thread_id: str) -> dict:
    """
    Invoke the compiled graph with the given state.
    """
    config = {"configurable": {"thread_id": thread_id}}

    logger.info("")
    logger.info("┌──────────────────────────────────────────────────────────────┐")
    logger.info("│  🚀 GRAPH INVOCATION — session=%s", thread_id)
    logger.info("├──────────────────────────────────────────────────────────────┤")
    logger.info("│  Action:    %s", state.get("action", "?"))
    logger.info("│  Concept:   %s", state.get("current_concept", "(none)"))
    logger.info("│  Events:    %d clickstream items", len(state.get("clickstream_buffer", [])))
    logger.info("│  Answer:    \"%s\"", state.get("user_answer", "")[:40])
    logger.info("│  Break:     %s", state.get("break_duration", "(none)"))
    logger.info("└──────────────────────────────────────────────────────────────┘")

    start = time.time()

    try:
        result = graph.invoke(state, config)
        elapsed = time.time() - start

        output = {
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

        logger.info("")
        logger.info("┌──────────────────────────────────────────────────────────────┐")
        logger.info("│  ✅ GRAPH COMPLETE [%.2fs] — session=%s", elapsed, thread_id)
        logger.info("├──────────────────────────────────────────────────────────────┤")
        logger.info("│  Confusion:    %.3f", output["confusion_score"])
        logger.info("│  Intervention: %s", "YES" if output["intervention"] else "NO")
        logger.info("│  Feedback:     %s", output["evaluation_feedback"][:50] if output["evaluation_feedback"] else "(none)")
        logger.info("│  Mastery:      %s", json.dumps(output["mastery_scores"]) if output["mastery_scores"] else "{}")
        logger.info("│  Next content: %s", output["next_content"].get("video_title", "?") if output["next_content"] else "(none)")
        logger.info("│  Recap:        %s", output["recap_summary"][:50] if output["recap_summary"] else "(none)")
        logger.info("└──────────────────────────────────────────────────────────────┘")

        return output
    except Exception as e:
        elapsed = time.time() - start
        logger.error("❌ GRAPH ERROR [%.2fs]: %s", elapsed, str(e))
        return {"error": str(e)}
