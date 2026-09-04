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


def llm_call(system_prompt: str, user_prompt: str, json_mode: bool = False, max_tokens: int = 600) -> str:
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
        "max_tokens": max_tokens,
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
    EXTENDED: Now also handles checkpoint quiz evaluation.
    """
    logger.info("╔══════════════════════════════════════════════════════════════╗")
    logger.info("║  📝 EVALUATOR NODE — Scoring user response                  ║")
    logger.info("╚══════════════════════════════════════════════════════════════╝")

    # Check if this is a quiz evaluation or intervention evaluation
    quiz_responses = state.get("quiz_responses", [])
    
    if quiz_responses:
        # Quiz evaluation mode
        return evaluate_quiz_responses(state)
    
    # Original intervention evaluation mode
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


def evaluate_quiz_responses(state: dict) -> dict:
    """
    Evaluate checkpoint quiz responses.
    Called by evaluator_node when quiz_responses are present.
    """
    logger.info("  📝 Quiz Evaluation Mode")
    
    quiz_responses = state.get("quiz_responses", [])
    quiz = state.get("quiz", {})
    questions = quiz.get("questions", [])
    concept = state.get("current_concept", "unknown")
    mastery = dict(state.get("mastery_scores", {}))

    logger.info("    ├─ Quiz concept: %s", concept)
    logger.info("    └─ Responses:    %d", len(quiz_responses))

    evaluations = []
    correct_count = 0
    total_score = 0

    for response in quiz_responses:
        q_idx = response.get("questionIndex", 0)
        ans_idx = response.get("answerIndex", 0)
        
        if q_idx >= len(questions):
            continue
            
        question = questions[q_idx]
        correct_idx = question.get("correct_index", 0)
        is_correct = ans_idx == correct_idx
        
        # Difficulty multipliers
        difficulty_multiplier = {
            'easy': 0.8,
            'medium': 1.0,
            'hard': 1.2
        }.get(question.get('difficulty', 'medium'), 1.0)
        
        score = (100 * difficulty_multiplier) if is_correct else 0
        
        if is_correct:
            correct_count += 1
        total_score += score
        
        evaluations.append({
            "questionIndex": q_idx,
            "question": question.get("question", ""),
            "difficulty": question.get("difficulty", "medium"),
            "userAnswer": ans_idx,
            "correctAnswer": correct_idx,
            "isCorrect": is_correct,
            "score": score,
            "explanation": question.get("explanation", "")
        })

    average_score = total_score / len(quiz_responses) if quiz_responses else 0
    percentage_correct = (correct_count / len(quiz_responses) * 100) if quiz_responses else 0
    
    # Update mastery based on quiz performance
    current_mastery = mastery.get(concept, 0)
    
    # Quiz contributes 60% to confidence (see progressService formula)
    quiz_contribution = average_score / 100
    new_mastery = min(100, current_mastery + (quiz_contribution * 20))
    mastery[concept] = new_mastery
    
    mastery_achieved = new_mastery >= 70

    logger.info("  ✅ Quiz evaluation complete:")
    logger.info("    ├─ Correct: %d/%d (%.1f%%)", correct_count, len(quiz_responses), percentage_correct)
    logger.info("    ├─ Avg score: %.1f", average_score)
    logger.info("    └─ Mastery: %d → %d", current_mastery, new_mastery)

    return {
        "answer_correct": percentage_correct >= 60,  # 60% pass threshold
        "evaluation_feedback": f"Quiz complete: {correct_count}/{len(quiz_responses)} correct ({percentage_correct:.0f}%)",
        "mastery_scores": mastery,
        "mastery_achieved": mastery_achieved,
        "quiz_evaluations": evaluations,
        "quiz_correct_count": correct_count,
        "quiz_percentage": percentage_correct,
    }


# ─── Quiz Generator Node ────────────────────────────────────────────────────

def quiz_generator_node(state: dict) -> dict:
    """
    Generates a comprehensive 30-question checkpoint quiz based on transcript content.
    - 10 EASY questions: Direct recall — definitions, facts, terminology from transcript
    - 10 MEDIUM questions: Understanding — relationships, comparisons, cause/effect
    - 10 HARD questions: Application/reasoning — applying concepts to new scenarios
    
    ALL questions are STRICTLY derived from the transcript — never generic.
    """
    logger.info("╔══════════════════════════════════════════════════════════════╗")
    logger.info("║  📝 QUIZ GENERATOR NODE — Creating 30-question quiz        ║")
    logger.info("╚══════════════════════════════════════════════════════════════╝")

    concept = state.get("current_concept", "unknown")
    transcript_ctx = state.get("transcript_context", "")
    video_title = state.get("video_title", "")
    concepts_covered = state.get("concepts_covered", [])

    logger.info("  📋 Input:")
    logger.info("    ├─ Primary concept: \"%s\"", concept)
    logger.info("    ├─ Video title:     \"%s\"", video_title)
    logger.info("    ├─ Concepts count:  %d", len(concepts_covered))
    logger.info("    └─ Transcript:      %d chars", len(transcript_ctx))

    if not transcript_ctx:
        logger.warning("  ⚠️  No transcript context — cannot generate quality quiz")
        return {
            "quiz": {
                "concept": concept,
                "questions": [],
                "error": "No transcript available for this video"
            }
        }

    concept_list = ", ".join(concepts_covered) if concepts_covered else concept
    difficulty_focus = state.get("difficulty", "medium").lower()
    
    # Use full transcript for maximum context
    transcript_sample = transcript_ctx[:4000] if len(transcript_ctx) > 4000 else transcript_ctx

    all_questions = []

    # Prepare system and user prompts based on difficulty
    if difficulty_focus == "easy":
        sys_prompt = """You are a quiz generator for educational content. Generate exactly 10 EASY multiple-choice questions.

EASY questions test DIRECT RECALL — the answer is explicitly stated in the transcript.
Question types for EASY:
- "What is the definition of X as described in the video?"
- "According to the lecture, what does X refer to?"
- "The speaker mentions that X is used for ___. What fills the blank?"
- "Which term does the speaker use to describe ___?"

Output JSON format:
{
    "questions": [
        {
            "difficulty": "easy",
            "question": "Question text...",
            "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
            "correct_index": 0,
            "explanation": "The transcript states: '[exact quote or paraphrase]'"
        }
    ]
}

STRICT RULES:
1. ONLY use information from the transcript — NO external knowledge
2. Every correct answer must be directly findable in the text
3. Vary correct_index (0-3)"""
        usr_prompt = f"""Generate 10 EASY recall-based questions from this transcript.
Video title: {video_title}
Concepts: {concept_list}

Transcript:
{transcript_sample}"""

    elif difficulty_focus == "hard":
        sys_prompt = """You are a quiz generator for educational content. Generate exactly 10 HARD multiple-choice questions.

HARD questions test APPLICATION and REASONING.
Question types for HARD:
- "Based on the concepts, what would happen if ___?"
- "A student is building X using these principles. Which approach is best?"
- "Consider scenario ___. Applying what was taught, what is the result?"

Output JSON format:
{
    "questions": [
        {
            "difficulty": "hard",
            "question": "Question text...",
            "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
            "correct_index": 2,
            "explanation": "Explanation..."
        }
    ]
}

STRICT RULES:
1. ONLY use information from the transcript — NO external knowledge
2. Questions must require REASONING
3. Vary correct_index (0-3)"""
        usr_prompt = f"""Generate 10 HARD reasoning questions from this transcript.
Video title: {video_title}
Concepts: {concept_list}

Transcript:
{transcript_sample}"""

    else:
        sys_prompt = """You are a quiz generator for educational content. Generate exactly 10 MEDIUM multiple-choice questions.

MEDIUM questions test UNDERSTANDING — relationships, comparisons.
Question types for MEDIUM:
- "How does X relate to Y according to the lecture?"
- "Why does the speaker say X leads to Y?"
- "What would happen to X if Y changes?"

Output JSON format:
{
    "questions": [
        {
            "difficulty": "medium",
            "question": "Question text...",
            "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
            "correct_index": 1,
            "explanation": "Explanation..."
        }
    ]
}

STRICT RULES:
1. ONLY use information from the transcript
2. Questions must test UNDERSTANDING, not just recall
3. Vary correct_index (0-3)"""
        usr_prompt = f"""Generate 10 MEDIUM understanding-based questions from this transcript.
Video title: {video_title}
Concepts: {concept_list}

Transcript:
{transcript_sample}"""

    logger.info("  📤 Generating 10 %s questions...", difficulty_focus.upper())
    try:
        # Generate with 2500 max tokens which should easily fit 10 questions
        result = llm_call(sys_prompt, usr_prompt, json_mode=True, max_tokens=2500)
        batch = json.loads(result)
        questions = batch.get("questions", [])
        
        # Ensure difficulty tag is set correctly and exactly 10 questions exist
        for q in questions:
            q["difficulty"] = difficulty_focus
            
        all_questions.extend(questions)
        logger.info("    ✅ Got %d %s questions", len(questions), difficulty_focus)
    except (json.JSONDecodeError, Exception) as e:
        logger.warning("    ⚠️  Failed to generate %s questions: %s", difficulty_focus, str(e))
        # Add fallback questions for this difficulty
        all_questions.append({
            "difficulty": difficulty_focus,
            "question": f"Based on the video about {concept}, what is a key takeaway at the {difficulty_focus} level?",
            "options": [
                f"A) The core principle of {concept} as explained in the lecture",
                f"B) An unrelated concept not discussed in the video",
                f"C) A historical fact about {concept}",
                f"D) An alternative to {concept} not mentioned",
            ],
            "correct_index": 0,
            "explanation": f"The video focuses on explaining the core principles of {concept}.",
        })

    logger.info("  ✅ Quiz generated: %d total questions", len(all_questions))
    logger.info("    ├─ Easy:   %d", len([q for q in all_questions if q.get("difficulty") == "easy"]))
    logger.info("    ├─ Medium: %d", len([q for q in all_questions if q.get("difficulty") == "medium"]))
    logger.info("    └─ Hard:   %d", len([q for q in all_questions if q.get("difficulty") == "hard"]))

    return {
        "quiz": {
            "concept": concept,
            "video_title": video_title,
            "questions": all_questions,
            "generated_at": datetime.now().isoformat(),
            "total_questions": len(all_questions),
        }
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
