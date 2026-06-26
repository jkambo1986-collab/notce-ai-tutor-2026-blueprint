"""
Mock Study Service

Provides AI-powered generation of standalone practice questions for the Mock Study Flow.
Unlike full case studies, these are individual questions without a vignette narrative.
"""

import os
from google import genai
from google.genai import types
import json
from .gemini_service import clean_json_text, get_client, generate_content


def serve_bank_question(domain: str, difficulty: str, exclude_ids=None) -> dict:
    """
    Pull a vetted, pre-minted question from the premium bank for this
    domain/difficulty, in the SAME dict shape generate_practice_question returns
    so the rest of the mock-study flow is unchanged. Returns None when the bank
    has no (more) matching approved items, so callers fall back to Gemini.

    The returned dict also carries `bank_id` and `source='bank'`, plus the
    pre-minted learning aids (`core_concept`, `explain_differently`).

    Args:
        domain: OT competency domain to match.
        difficulty: Difficulty label to match.
        exclude_ids: Iterable of BankQuestion ids to skip (already-served items).

    Returns:
        A question dict shaped like ``generate_practice_question`` output, or
        ``None`` when no matching approved bank item remains.
    """
    from .models import BankQuestion, DomainTag  # local import to avoid circulars

    # Match approved items, skipping already-used ones, and prefetch distractors
    # to avoid N+1 queries when building the payload. Exam mode passes a
    # pseudo-domain ('MIXED'/'ALL') and/or a non-standard difficulty ('Exam') to
    # mean "any approved question" — so apply each filter only when it's a real
    # value, otherwise treat it as a wildcard.
    valid_domains = {d.value for d in DomainTag}
    valid_difficulties = {'Easy', 'Medium', 'Hard'}

    qs = (BankQuestion.objects
          .filter(status='approved')
          .exclude(id__in=list(exclude_ids or []))
          .prefetch_related('distractors'))
    if domain in valid_domains:
        qs = qs.filter(domain=domain)
    if difficulty in valid_difficulties:
        qs = qs.filter(difficulty=difficulty)
    # order_by('?') picks a random matching question (DB-level RANDOM()).
    bq = qs.order_by('?').first()
    if not bq:
        return None

    distractors = list(bq.distractors.all())
    options = [{"label": d.label, "text": d.text} for d in distractors]
    # Build the incorrect-rationale map for the distractors only (exclude the
    # correct option, and skip blanks).
    incorrect = {
        d.label: d.incorrect_rationale
        for d in distractors
        if d.incorrect_rationale and d.label.upper() != bq.correct_label.upper()
    }
    return {
        "stem": bq.stem,
        "options": options,
        "correct_label": bq.correct_label,
        "correct_rationale": bq.correct_rationale,
        "incorrect_rationales": incorrect,
        "core_concept": bq.core_concept or "",
        "explain_differently": bq.explain_differently or "",
        "topic": bq.topic or "",
        "bank_id": bq.id,
        # Per-question domain so analytics can attribute MIXED/exam answers to the
        # right NOTCE competency (session.domain is 'MIXED' for exams).
        "domain": bq.domain,
        "source": "bank",
    }


def generate_practice_question(domain: str, difficulty: str,
                                question_number: int,
                                total_questions: int,
                                topics_covered: list = None) -> dict:
    """
    Generates a single practice question for the Mock Study Flow.
    
    Args:
        domain: The OT domain to focus on (e.g., 'OT_EXP', 'CEJ_JUSTICE')
        difficulty: 'Easy', 'Medium', or 'Hard'
        question_number: Current question number in the session
        total_questions: Total questions in the session
        topics_covered: List of topics already covered to ensure variety
        
    Returns:
        dict with keys: stem, options, correct_label, rationale, topic

    Side effects:
        Prints a diagnostic line if generation/JSON parsing fails.
    """
    client = get_client()
    if not client:
        return None

    topics_covered = topics_covered or []

    # Map difficulty to question characteristics
    difficulty_guidance = {
        'Easy': 'foundational recall-based question testing basic knowledge and definitions',
        'Medium': 'application-focused question requiring moderate clinical reasoning',
        'Hard': 'advanced multi-step reasoning question with complex clinical scenarios'
    }
    
    # Domain full names for clarity
    domain_names = {
        'OT_EXP': 'Occupational Therapy Expertise (clinical evaluation, intervention, outcomes)',
        'CEJ_JUSTICE': 'Culture, Equity, and Justice (cultural safety, anti-racism, equity)',
        'COMM_COLLAB': 'Communication and Collaboration (interprofessional, client-centered)',
        'PROF_RESP': 'Professional Responsibility (ethics, documentation, supervision)',
        'EXCELLENCE': 'Excellence in Practice (evidence-based, quality improvement)',
        'ENGAGEMENT': 'Engagement in the Profession (advocacy, leadership, lifelong learning)'
    }
    
    domain_full = domain_names.get(domain, domain)
    diff_guidance = difficulty_guidance.get(difficulty, difficulty_guidance['Medium'])
    
    # Inject a "don't repeat" clause only when prior topics exist, to keep the
    # session varied across questions.
    avoid_topics = f"Avoid these specific topics already covered: {topics_covered}" if topics_covered else ""

    # Prompt pins the Canadian NOTCE context and the resolved domain/difficulty
    # guidance, and demands the exact JSON schema the caller parses below.
    prompt = f"""
    Generate a single Occupational Therapy practice question for the Canadian NOTCE (National
    Occupational Therapy Certification Examination, administered by CAOT) under the September 2026
    Blueprint, which is based on the Competencies for Occupational Therapists in Canada (COTC, 2021).

    Use the CANADIAN practice context only: CAOT, provincial regulatory organizations, the Canadian
    Code of Ethics, and Canadian terminology. Do NOT reference US bodies (NBCOT, AOTA, AOTA Practice
    Framework) or US-specific regulations.

    DOMAIN: {domain_full}
    DIFFICULTY: {difficulty} - {diff_guidance}

    This is question {question_number} of {total_questions} in a quick practice session.
    {avoid_topics}

    REQUIREMENTS:
    - Create a standalone question (no extended vignette needed, but include brief clinical context if helpful)
    - Provide 4 answer options (A, B, C, D) with ONE single BEST answer
    - Where appropriate, emphasize the decision word in the stem in capitals (e.g. FIRST, BEST, MOST, NEXT)
    - Use plain language
    - Include educational rationales for both correct and incorrect answers
    - Identify a topic tag for this question (e.g., "sensory processing", "ethics documentation")
    
    Output strictly valid JSON:
    {{
        "stem": "The question text with brief clinical context if needed...",
        "options": [
            {{"label": "A", "text": "First option"}},
            {{"label": "B", "text": "Second option"}},
            {{"label": "C", "text": "Third option"}},
            {{"label": "D", "text": "Fourth option"}}
        ],
        "correct_label": "A",
        "correct_rationale": "Detailed explanation of why this is correct...",
        "incorrect_rationales": {{
            "B": "Why B is incorrect...",
            "C": "Why C is incorrect...",
            "D": "Why D is incorrect..."
        }},
        "topic": "brief topic tag"
    }}
    
    Do not wrap in markdown code blocks. Just raw JSON.
    """
    
    try:
        response = generate_content(
            client,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type='application/json'
            )
        )

        # Strip any markdown fences before decoding the JSON into a dict.
        result = json.loads(clean_json_text(response.text))
        return result

    except Exception as e:
        print(f"Mock Study Question Generation Error: {e}")
        return None


def generate_answer_feedback(question_stem: str, selected_label: str, 
                              correct_label: str, correct_rationale: str,
                              incorrect_rationales: dict) -> dict:
    """
    Generates personalized feedback for the user's answer.

    This is pure local logic (no AI/network call): it compares the chosen label
    to the correct one and assembles a feedback payload.

    Args:
        question_stem: The question text (currently unused in the message body).
        selected_label: The option label the user chose.
        correct_label: The correct option label.
        correct_rationale: Explanation of the correct answer.
        incorrect_rationales: Map of label -> why-it-is-wrong text.

    Returns dict with: is_correct, feedback_message, explanation
    """
    # Case-insensitive comparison so "a" and "A" are treated the same.
    is_correct = selected_label.upper() == correct_label.upper()

    if is_correct:
        return {
            "is_correct": True,
            "feedback_message": "Correct! 🎉",
            "explanation": correct_rationale
        }
    else:
        incorrect_reason = incorrect_rationales.get(selected_label.upper(), 
            "This option does not align with best practices.")
        return {
            "is_correct": False,
            "feedback_message": f"Not quite. The correct answer is {correct_label}.",
            "explanation": f"**Why {selected_label} is incorrect:** {incorrect_reason}\n\n**Correct answer ({correct_label}):** {correct_rationale}"
        }


def generate_pivot_scenario(original_stem: str, original_correct_label: str, original_correct_rationale: str) -> dict:
    """
    Generates a 'What If' pivot scenario based on an existing question.
    It changes a key variable to shift the clinical reasoning.

    Args:
        original_stem: The source question text.
        original_correct_label: The source question's correct option label.
        original_correct_rationale: Why that answer was correct.

    Returns:
        A dict (pivot_variable / new_scenario_snippet / change_explanation), or
        ``None`` if no client is available or generation/parsing fails.

    Side effects:
        Prints a diagnostic line on error.
    """
    client = get_client()
    if not client:
        return None

    # Prompt instructs the model to alter exactly one clinical variable and
    # explain the resulting reasoning shift, returned as the JSON parsed below.
    prompt = f"""
    You are an expert Clinical OT Exam Tutor.
    
    ORIGINAL QUESTION CONTEXT:
    "{original_stem}"
    
    ORIGINAL CORRECT ANSWER: Option {original_correct_label}
    RATIONALE: {original_correct_rationale}
    
    TASK:
    Create a "Clinical Pivot" (What If?) scenario.
    1. Identify a key clinical variable in the original context (e.g., patient's social support, acuity level, setting, age).
    2. Change ONLY that variable to create a hypothetical alternative scenario.
    3. Explain how this change shifts the proper clinical priority or answer.
    
    OUTPUT JSON ONLY:
    {{
        "pivot_variable": "The variable you changed (e.g., 'From Inpatient to Home Health')",
        "new_scenario_snippet": "A 1-2 sentence description of the modified context...",
        "change_explanation": "Explain clearly how the correct clinical action would change and WHY. Focus on the reasoning shift."
    }}
    """
    
    try:
        response = generate_content(
            client,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type='application/json'
            )
        )
        
        # Unwrap any fences and decode the pivot JSON into a dict.
        return json.loads(clean_json_text(response.text))

    except Exception as e:
        print(f"Pivot Generation Error: {e}")
        return None
