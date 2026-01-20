"""
Mock Study Service

Provides AI-powered generation of standalone practice questions for the Mock Study Flow.
Unlike full case studies, these are individual questions without a vignette narrative.
"""

import os
from google import genai
from google.genai import types
import json


def get_client():
    """Initialize Gemini client with API key from environment."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    return genai.Client(api_key=api_key)


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
    
    avoid_topics = f"Avoid these specific topics already covered: {topics_covered}" if topics_covered else ""
    
    prompt = f"""
    Generate a single Occupational Therapy practice question for NBCOT exam preparation.
    
    DOMAIN: {domain_full}
    DIFFICULTY: {difficulty} - {diff_guidance}
    
    This is question {question_number} of {total_questions} in a quick practice session.
    {avoid_topics}
    
    REQUIREMENTS:
    - Create a standalone question (no extended vignette needed, but include brief clinical context if helpful)
    - Provide 4 answer options (A, B, C, D)
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
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type='application/json'
            )
        )
        
        result = json.loads(response.text)
        return result
        
    except Exception as e:
        print(f"Mock Study Question Generation Error: {e}")
        return None


def generate_answer_feedback(question_stem: str, selected_label: str, 
                              correct_label: str, correct_rationale: str,
                              incorrect_rationales: dict) -> dict:
    """
    Generates personalized feedback for the user's answer.
    
    Returns dict with: is_correct, feedback_message, explanation
    """
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
    """
    client = get_client()
    if not client:
        return None
        
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
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type='application/json'
            )
        )
        
        return json.loads(response.text)
        
    except Exception as e:
        print(f"Pivot Generation Error: {e}")
        return None
