"""
Conditional Edge Functions — Routing logic for the LangGraph state machine
"""


# Confusion threshold for triggering Socratic intervention
CONFUSION_THRESHOLD = 0.55

# Mastery threshold for considering a concept "learned"
MASTERY_THRESHOLD = 70


def should_intervene(state: dict) -> str:
    """
    After Observer: decide whether confusion warrants intervention.
    
    Returns:
        "tutor" → confusion > threshold → trigger Socratic tutor
        "continue" → confusion is low → keep observing
    """
    confusion = state.get("confusion_score", 0)
    
    if confusion >= CONFUSION_THRESHOLD:
        return "tutor"
    return "continue"


def check_mastery(state: dict) -> str:
    """
    After Evaluator: decide whether the student has achieved mastery.
    
    Returns:
        "mastered" → mastery threshold reached → go to planner
        "retry" → mastery not yet achieved → go back to tutor for hint/retry
    """
    mastery_achieved = state.get("mastery_achieved", False)
    answer_correct = state.get("answer_correct", False)
    
    if mastery_achieved:
        return "mastered"
    elif not answer_correct:
        return "retry"
    else:
        # Correct but not mastered yet → plan next
        return "mastered"


def check_break(state: dict) -> str:
    """
    At session start: check if a significant break occurred.
    
    Returns:
        "break_recovery" → break detected → run recovery protocol
        "observe" → no break → start normal observation
    """
    break_duration = state.get("break_duration", "")
    action = state.get("action", "")
    
    if action == "break_recovery" or (break_duration and break_duration != "0"):
        return "break_recovery"
    return "observe"


def route_action(state: dict) -> str:
    """
    Route based on the explicit action request from the frontend.
    
    This is the entry-point router that directs to the appropriate node
    based on what the frontend is asking for.
    """
    action = state.get("action", "observe")
    
    action_map = {
        "observe": "observer",
        "tutor": "tutor",
        "evaluate": "evaluator",
        "plan": "planner",
        "break_recovery": "break_recovery",
    }
    
    return action_map.get(action, "observer")
