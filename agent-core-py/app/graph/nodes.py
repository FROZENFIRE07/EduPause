"""
Agent Nodes — Each function is a node in the LangGraph state machine
"""
import os
import json
import logging
import time
from datetime import datetime

# Try to import Groq, fallback to mock
try:
    from groq import Groq
    groq_client = Groq(api_key=os.getenv("GROQ_API_KEY", "demo"))
except Exception:
    groq_client = None

MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

logger = logging.getLogger("agent.nodes")


def llm_call(system_prompt: str, user_prompt: str, json_mode: bool = False) -> str:
    """Helper: call Groq LLM or return mock response"""
    is_mock = not groq_client or os.getenv("GROQ_API_KEY", "demo") == "demo"

    if is_mock:
        logger.warning("  🤖 LLM_CALL [MOCK MODE] — No valid GROQ_API_KEY")
        logger.info("    ├─ System prompt: %s...", system_prompt[:80])
        logger.info("    └─ User prompt:   %s...", user_prompt[:80])
        return json.dumps({
            "response": f"[Mock LLM] Processed: {user_prompt[:100]}...",
            "mock": True,
        })

    logger.info("  🤖 LLM_CALL [%s]", MODEL)
    logger.info("    ├─ json_mode: %s", json_mode)
    logger.info("    ├─ System: %s...", system_prompt[:100])
    logger.info("    └─ User:   %s...", user_prompt[:100])

    start = time.time()
    kwargs = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.4,
        "max_tokens": 600,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    response = groq_client.chat.completions.create(**kwargs)
    elapsed = time.time() - start
    content = response.choices[0].message.content
    usage = response.usage

    logger.info("  ✅ LLM Response [%.2fs]", elapsed)
    logger.info("    ├─ Tokens:  prompt=%d completion=%d total=%d",
                usage.prompt_tokens, usage.completion_tokens, usage.total_tokens)
    logger.info("    └─ Content: %s...", content[:120] if content else "(empty)")

    return content


# ─── Observer Node ───────────────────────────────────────────────────────────

def observer_node(state: dict) -> dict:
    """
    Analyzes clickstream data to compute a probabilistic confusion score.
    """
    logger.info("╔══════════════════════════════════════════════════════════════╗")
    logger.info("║  👁️  OBSERVER NODE — Analyzing clickstream                  ║")
    logger.info("╚══════════════════════════════════════════════════════════════╝")

    events = state.get("clickstream_buffer", [])
    logger.info("  📊 Input: %d clickstream events", len(events))

    if not events:
        logger.info("  ⚠️  No events — returning confusion=0.0")
        return {
            "confusion_score": 0.0,
            "confusion_breakdown": {"rewinds": 0, "pauses": 0, "speed_drops": 0},
        }

    # Count event types
    rewinds = sum(1 for e in events if e.get("type") == "rewind")
    pauses = sum(1 for e in events if e.get("type") == "pause")
    speed_changes = sum(1 for e in events if e.get("type") == "speed_change")

    logger.info("  📈 Event breakdown:")
    logger.info("    ├─ Rewinds:       %d", rewinds)
    logger.info("    ├─ Pauses:        %d", pauses)
    logger.info("    └─ Speed changes: %d", speed_changes)

    # Analyze pause patterns
    pause_durations = []
    for i, e in enumerate(events):
        if e.get("type") == "pause" and i + 1 < len(events):
            next_e = events[i + 1]
            if next_e.get("type") == "play":
                duration = (next_e.get("timestamp", 0) - e.get("timestamp", 0)) / 1000
                pause_durations.append(duration)

    # Short pauses (5-15s) = cognitive processing → higher confusion weight
    short_pauses = sum(1 for d in pause_durations if 5 <= d <= 15)
    # Long pauses (>60s) = likely distraction → reduce confusion weight
    long_pauses = sum(1 for d in pause_durations if d > 60)

    logger.info("  ⏱️  Pause analysis:")
    logger.info("    ├─ Short pauses (5-15s cognitive): %d", short_pauses)
    logger.info("    └─ Long pauses (>60s distraction): %d", long_pauses)

    # Calculate weighted confusion score (0 to 1)
    weights = {
        "rewind": 0.30,
        "short_pause": 0.25,
        "speed_drop": 0.20,
        "click_freq": 0.15,
        "long_pause": -0.10,
    }

    total_events = max(len(events), 1)
    rewind_score = min(rewinds / 3, 1.0)
    short_pause_score = min(short_pauses / 4, 1.0)
    speed_score = min(speed_changes / 2, 1.0)
    click_score = min(total_events / 15, 1.0)
    long_pause_penalty = min(long_pauses / 2, 1.0)

    confusion = (
        weights["rewind"] * rewind_score +
        weights["short_pause"] * short_pause_score +
        weights["speed_drop"] * speed_score +
        weights["click_freq"] * click_score +
        weights["long_pause"] * long_pause_penalty
    )

    confusion = max(0.0, min(1.0, confusion))

    logger.info("  🎯 Confusion Score: %.3f (%.0f%%)", confusion, confusion * 100)
    logger.info("    ├─ rewind_score=%.2f × 0.30 = %.3f", rewind_score, weights["rewind"] * rewind_score)
    logger.info("    ├─ pause_score=%.2f  × 0.25 = %.3f", short_pause_score, weights["short_pause"] * short_pause_score)
    logger.info("    ├─ speed_score=%.2f  × 0.20 = %.3f", speed_score, weights["speed_drop"] * speed_score)
    logger.info("    ├─ click_score=%.2f  × 0.15 = %.3f", click_score, weights["click_freq"] * click_score)
    logger.info("    └─ long_penalty=%.2f × -0.10 = %.3f", long_pause_penalty, weights["long_pause"] * long_pause_penalty)

    result = {
        "confusion_score": round(confusion, 3),
        "confusion_breakdown": {
            "rewinds": rewinds,
            "short_pauses": short_pauses,
            "long_pauses": long_pauses,
            "speed_changes": speed_changes,
            "total_events": total_events,
            "rewind_score": round(rewind_score, 2),
            "short_pause_score": round(short_pause_score, 2),
        },
    }

    logger.info("  ✅ Observer complete → confusion=%.3f, intervene=%s",
                confusion, "YES" if confusion >= 0.55 else "NO")
    return result


# ─── Socratic Tutor Node ────────────────────────────────────────────────────

def tutor_node(state: dict) -> dict:
    """
    Generates contextual Socratic questions, hints, or analogies
    based on the current concept, transcript context, and confusion analysis.
    """
    logger.info("╔══════════════════════════════════════════════════════════════╗")
    logger.info("║  🎓 TUTOR NODE — Generating Socratic intervention           ║")
    logger.info("╚══════════════════════════════════════════════════════════════╝")

    concept = state.get("current_concept", "neural networks")
    confusion = state.get("confusion_score", 0)
    transcript_ctx = state.get("transcript_context", "")
    video_ts = state.get("video_timestamp", 0)

    logger.info("  📖 Concept: \"%s\"", concept)
    logger.info("  📊 Confusion level: %.0f%%", confusion * 100)
    logger.info("  📄 Transcript context: %d chars", len(transcript_ctx))
    logger.info("  🔧 Strategy: %s",
                "foundational question" if confusion > 0.6 else
                "application question" if confusion < 0.3 else
                "standard diagnostic")

    transcript_section = ""
    if transcript_ctx:
        transcript_section = f"""\n\nHere is the EXACT lecture content the student was watching when they got confused:
---
{transcript_ctx[:1500]}
---
Base your question on THIS specific content. Reference specific terms, examples, or explanations from the lecture."""

    system_prompt = f"""You are a Socratic tutor for an AI-powered learning platform.
Generate a diagnostic question to test the student's understanding.

Output JSON:
{{
    "type": "mcq",
    "question": "Clear, specific question about the concept",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct_index": 0,
    "hint": "A guiding hint that doesn't give the answer away",
    "explanation": "Why the correct answer is correct",
    "context": "Brief context about what part of the material this relates to"
}}

Rules:
- Make the question appropriately challenging based on the confusion level
- Higher confusion → simpler, more foundational question
- If lecture content is provided, base the question on THAT specific content
- Include a pedagogically useful hint
- Make distractors plausible but clearly distinguishable"""

    user_prompt = f"""Generate a question about "{concept}".
Student confusion level: {confusion:.0%}
{"The student seems very confused — ask a foundational question." if confusion > 0.6 else ""}
{"The student is doing well — ask a deeper application question." if confusion < 0.3 else ""}{transcript_section}"""

    logger.info("  📤 Calling LLM for question generation...")
    result = llm_call(system_prompt, user_prompt, json_mode=True)

    try:
        intervention = json.loads(result)
        logger.info("  ✅ Intervention generated:")
        logger.info("    ├─ Type: %s", intervention.get("type", "?"))
        logger.info("    ├─ Question: %s", intervention.get("question", "?")[:80])
        logger.info("    ├─ Options: %d choices", len(intervention.get("options", [])))
        logger.info("    └─ Correct: index %d", intervention.get("correct_index", -1))
    except json.JSONDecodeError:
        logger.warning("  ⚠️  Failed to parse LLM response — using fallback question")
        intervention = {
            "type": "mcq",
            "question": f"What is the key principle behind {concept}?",
            "options": [
                f"It optimizes the learning process",
                f"It structures data hierarchically",
                f"It enables pattern recognition",
                f"It reduces computational complexity",
            ],
            "correct_index": 0,
            "hint": f"Think about the fundamental purpose of {concept}.",
            "context": f"From current concept: {concept}",
        }

    return {"intervention": intervention}


# ─── Evaluator Node ──────────────────────────────────────────────────────────

def evaluator_node(state: dict) -> dict:
    """
    Scores user's response and updates mastery state.
    Uses transcript context for more accurate evaluation.
    """
    logger.info("╔══════════════════════════════════════════════════════════════╗")
    logger.info("║  📝 EVALUATOR NODE — Scoring user response                  ║")
    logger.info("╚══════════════════════════════════════════════════════════════╝")

    user_answer = state.get("user_answer", "")
    intervention = state.get("intervention", {})
    concept = state.get("current_concept", "unknown")
    mastery = dict(state.get("mastery_scores", {}))
    transcript_ctx = state.get("transcript_context", "")

    logger.info("  📋 Input:")
    logger.info("    ├─ Concept:     \"%s\"", concept)
    logger.info("    ├─ User answer: \"%s\"", user_answer)
    logger.info("    ├─ Question type: %s", intervention.get("type", "?"))
    logger.info("    ├─ Transcript:   %d chars", len(transcript_ctx))
    logger.info("    └─ Current mastery: %s", json.dumps(mastery))

    correct = False
    feedback = ""

    if intervention.get("type") == "mcq":
        correct_idx = intervention.get("correct_index", 0)
        try:
            answer_idx = int(user_answer) if user_answer.isdigit() else -1
        except (ValueError, AttributeError):
            answer_idx = -1
        correct = answer_idx == correct_idx

        logger.info("  🔍 MCQ evaluation: answer=%s correct=%d → %s",
                    user_answer, correct_idx, "CORRECT ✅" if correct else "INCORRECT ❌")

        if correct:
            feedback = "Excellent! That's correct. " + intervention.get("explanation", "")
        else:
            feedback = f"Not quite. {intervention.get('hint', '')} The correct answer was option {correct_idx + 1}."

    elif intervention.get("type") == "text":
        logger.info("  📝 Free-text evaluation — calling LLM...")
        transcript_hint = f"\nRelevant lecture content: {transcript_ctx[:500]}" if transcript_ctx else ""
        system_prompt = """Evaluate the student's answer. Output JSON:
{"correct": true/false, "score": 0-100, "feedback": "constructive feedback"}"""

        user_prompt = f"""Question: {intervention.get('question', '')}
Student answer: {user_answer}
Expected concept: {concept}{transcript_hint}"""

        result = llm_call(system_prompt, user_prompt, json_mode=True)
        try:
            eval_result = json.loads(result)
            correct = eval_result.get("correct", False)
            feedback = eval_result.get("feedback", "Thank you for your response.")
            logger.info("  📊 LLM eval: correct=%s score=%s",
                       correct, eval_result.get("score", "?"))
        except json.JSONDecodeError:
            feedback = "Thank you for your response."
            logger.warning("  ⚠️  Failed to parse eval response")

    # Update mastery
    current_mastery = mastery.get(concept, 0)
    if correct:
        mastery[concept] = min(100, current_mastery + 15)
    else:
        mastery[concept] = max(0, current_mastery - 5)

    mastery_achieved = mastery.get(concept, 0) >= 70

    logger.info("  📈 Mastery update:")
    logger.info("    ├─ %s: %d → %d", concept, current_mastery, mastery.get(concept, 0))
    logger.info("    ├─ Mastery achieved: %s", "YES 🏆" if mastery_achieved else "NO")
    logger.info("    └─ Feedback: %s...", feedback[:80])

    return {
        "answer_correct": correct,
        "evaluation_feedback": feedback,
        "mastery_scores": mastery,
        "mastery_achieved": mastery_achieved,
    }


# ─── Path Planner Node ──────────────────────────────────────────────────────

def planner_node(state: dict) -> dict:
    """
    Analyzes the Knowledge Graph against mastery state
    to recommend the next learning content.
    Uses transcript context for smarter recommendations.
    """
    logger.info("╔══════════════════════════════════════════════════════════════╗")
    logger.info("║  🗺️  PLANNER NODE — Recommending next content               ║")
    logger.info("╚══════════════════════════════════════════════════════════════╝")

    mastery = state.get("mastery_scores", {})
    concept = state.get("current_concept", "")
    transcript_ctx = state.get("transcript_context", "")

    logger.info("  📋 Input:")
    logger.info("    ├─ Current concept: \"%s\"", concept)
    logger.info("    ├─ Transcript:     %d chars", len(transcript_ctx))
    logger.info("    └─ Mastery state: %s", json.dumps(mastery))

    transcript_section = ""
    if transcript_ctx:
        transcript_section = f"\nRecent lecture content the student was studying:\n{transcript_ctx[:800]}"

    system_prompt = """You are a learning path planner. Based on the student's mastery scores
and what they were recently studying, recommend the next concept they should study.

Output JSON:
{
    "next_concept": "concept-id",
    "reason": "Why this concept should be studied next",
    "prerequisite_gaps": ["list of weak prerequisites"],
    "recommended_action": "study" or "review" or "advance"
}"""

    user_prompt = f"""Current concept: {concept}
Mastery scores: {json.dumps(mastery)}
Recommend the next learning step.{transcript_section}"""

    logger.info("  📤 Calling LLM for path planning...")
    result = llm_call(system_prompt, user_prompt, json_mode=True)

    try:
        plan = json.loads(result)
        next_content = {
            "video_id": "",
            "video_title": plan.get("next_concept", "Next Topic"),
            "chunk_index": 0,
            "reason": plan.get("reason", "Continue with the next concept in the curriculum"),
        }
        logger.info("  ✅ Plan generated:")
        logger.info("    ├─ Next: %s", plan.get("next_concept", "?"))
        logger.info("    ├─ Action: %s", plan.get("recommended_action", "?"))
        logger.info("    ├─ Gaps: %s", plan.get("prerequisite_gaps", []))
        logger.info("    └─ Reason: %s", plan.get("reason", "?")[:80])
    except json.JSONDecodeError:
        logger.warning("  ⚠️  Failed to parse plan — using fallback")
        next_content = {
            "video_id": "",
            "video_title": "Continue Learning",
            "chunk_index": 0,
            "reason": "Proceed to the next topic",
        }

    return {"next_content": next_content}


# ─── Break Recovery Node ────────────────────────────────────────────────────

def break_recovery_node(state: dict) -> dict:
    """
    Implements the Break Recovery Protocol:
    1. Calculate break duration impact
    2. Generate context reinstatement recap
    3. Create warm-up micro-assessment
    """
    logger.info("╔══════════════════════════════════════════════════════════════╗")
    logger.info("║  🔄 BREAK RECOVERY NODE — Cognitive priming                 ║")
    logger.info("╚══════════════════════════════════════════════════════════════╝")

    break_duration = state.get("break_duration", "unknown")
    mastery = state.get("mastery_scores", {})
    concept = state.get("current_concept", "")
    transcript_ctx = state.get("transcript_context", "")

    logger.info("  📋 Input:")
    logger.info("    ├─ Break duration: %s", break_duration)
    logger.info("    ├─ Last concept:   \"%s\"", concept)
    logger.info("    ├─ Transcript:     %d chars", len(transcript_ctx))
    logger.info("    └─ Mastery state:  %s", json.dumps(mastery))

    transcript_section = ""
    if transcript_ctx:
        transcript_section = f"\nHere is what the student was last studying:\n{transcript_ctx[:600]}"

    system_prompt = """You are a cognitive priming specialist. A student is returning after a break.
Generate a brief, welcoming recap and a simple warm-up question.

Output JSON:
{
    "recap": "2-3 sentence summary of what they mastered last time, encouraging tone",
    "warmup_question": {
        "type": "mcq",
        "question": "Simple, low-stakes question to reactivate memory",
        "options": ["A", "B", "C", "D"],
        "correct_index": 0,
        "hint": "Gentle hint"
    },
    "encouragement": "Welcome back message"
}"""

    user_prompt = f"""Student returning after {break_duration}.
Last concept: {concept}
Mastery scores: {json.dumps(mastery)}
Generate a cognitive priming recap.{transcript_section}"""

    logger.info("  📤 Calling LLM for break recovery...")
    result = llm_call(system_prompt, user_prompt, json_mode=True)

    try:
        recovery = json.loads(result)
        recap = recovery.get("recap", f"Welcome back! You were studying {concept}.")
        warmup = recovery.get("warmup_question", None)
        logger.info("  ✅ Recovery generated:")
        logger.info("    ├─ Recap: %s...", recap[:80])
        logger.info("    ├─ Warmup: %s", "yes" if warmup else "no")
        logger.info("    └─ Encouragement: %s", recovery.get("encouragement", "?")[:60])
    except json.JSONDecodeError:
        logger.warning("  ⚠️  Failed to parse recovery — using fallback")
        recap = f"Welcome back! You were making great progress on {concept}. Let's do a quick recap."
        warmup = None

    return {
        "recap_summary": recap,
        "intervention": warmup,
        "break_detected": True,
    }
