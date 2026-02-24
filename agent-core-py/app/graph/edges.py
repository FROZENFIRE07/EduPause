"""
Conditional Edge Functions — Routing logic for the LangGraph state machine
"""
import logging

logger = logging.getLogger("agent.edges")

# Confusion threshold for triggering Socratic intervention
CONFUSION_THRESHOLD = 0.55

# Mastery threshold for considering a concept "learned"
MASTERY_THRESHOLD = 70


def should_intervene(state: dict) -> str:
    """
    After Observer: decide whether confusion warrants intervention.
    """
    confusion = state.get("confusion_score", 0)
    decision = "tutor" if confusion >= CONFUSION_THRESHOLD else "continue"

    logger.info("  🔀 EDGE: should_intervene()")
    logger.info("    ├─ confusion=%.3f threshold=%.2f", confusion, CONFUSION_THRESHOLD)
    logger.info("    └─ Decision: %s %s", decision.upper(),
                "→ triggering Socratic tutor" if decision == "tutor" else "→ no intervention needed")

    return decision


def check_mastery(state: dict) -> str:
    """
    After Evaluator: decide whether the student has achieved mastery.
    """
    mastery_achieved = state.get("mastery_achieved", False)
    answer_correct = state.get("answer_correct", False)

    if mastery_achieved:
        decision = "mastered"
    elif not answer_correct:
        decision = "retry"
    else:
        decision = "mastered"

    logger.info("  🔀 EDGE: check_mastery()")
    logger.info("    ├─ mastery_achieved=%s answer_correct=%s", mastery_achieved, answer_correct)
    logger.info("    └─ Decision: %s %s", decision.upper(),
                "→ advance to planner" if decision == "mastered" else "→ retry with tutor")

    return decision


def check_break(state: dict) -> str:
    """
    At session start: check if a significant break occurred.
    """
    break_duration = state.get("break_duration", "")
    action = state.get("action", "")

    if action == "break_recovery" or (break_duration and break_duration != "0"):
        decision = "break_recovery"
    else:
        decision = "observe"

    logger.info("  🔀 EDGE: check_break()")
    logger.info("    ├─ action=\"%s\" break_duration=\"%s\"", action, break_duration)
    logger.info("    └─ Decision: %s", decision.upper())

    return decision


def route_action(state: dict) -> str:
    """
    Route based on the explicit action request from the frontend.
    """
    action = state.get("action", "observe")

    action_map = {
        "observe": "observer",
        "tutor": "tutor",
        "evaluate": "evaluator",
        "plan": "planner",
        "break_recovery": "break_recovery",
    }

    target = action_map.get(action, "observer")

    logger.info("  🚦 ROUTER: route_action()")
    logger.info("    ├─ Requested action: \"%s\"", action)
    logger.info("    └─ Routing to: [%s] node", target.upper())

    return target
