import os
from google import genai
from google.genai import types
import re
import json

def clean_json_text(text):
    """
    Strips markdown code blocks from the text to ensure valid JSON parsing.
    """
    if not text:
        return ""
    # Regex to capture content inside ```json ... ``` or just ``` ... ```
    pattern = r"```(?:json)?\s*(.*?)\s*```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text.strip()

# Initialize Gemini client
# Ensure GEMINI_API_KEY is set in your environment variables

def get_client():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    return genai.Client(api_key=api_key)

def get_evolving_rationale(current_question_stem, current_correct_rationale, 
                           previous_answer_correct, previous_selected_label, 
                           all_previous_correct):
    """
    Generates an 'Evolutionary Tip' using Google Gemini.
    """
    client = get_client()
    if not client:
        return None

    prompt = f"""
    You are an OT exam tutor. The student is answering a series of linked case-study questions.
    Current Question Stem: "{current_question_stem}"
    Correct Rationale: "{current_correct_rationale}"
    
    The user's previous performance in this case: {"All correct so far." if all_previous_correct else "Had some struggle."}
    Previous answer was: {"Correct" if previous_answer_correct else f"Incorrect (Selected {previous_selected_label})"}
    
    Generate a 2-sentence "Evolutionary Tip" that acknowledges their path and reinforces the logic for this CURRENT question.
    If they were wrong previously, guide them back to the "competent" path.
    """

    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt
        )
        return response.text
    except Exception as e:
        print(f"Gemini Error: {e}")
        return None

def generate_full_case_study(domain="OT Expertise", difficulty="Medium"):
    """
    Generates a full structured case study JSON.
    """
    client = get_client()
    if not client:
        return None

    prompt = f"""
    Generate a comprehensive Occupational Therapy case study for an exam prep application.
    The case should focus on domain: "{domain}" with difficulty: "{difficulty}".
    
    CRITICAL REQUIREMENT: Per the 2026 NBCOT Blueprint, at least ONE question MUST have domain "CEJ_JUSTICE" (Culture, Equity, and Justice). This is mandatory.
    
    Output strictly valid JSON with the following structure:
    {{
        "title": "Case Title",
        "vignette": "A detailed clinical scenario...",
        "setting": "Specific clinical setting (e.g., Acute Care, School-based)",
        "questions": [
            {{
                "stem": "Question text...",
                "domain": "OT_EXP",  # Must be one of: OT_EXP, CEJ_JUSTICE, COMM_COLLAB, PROF_RESP, EXCELLENCE, ENGAGEMENT
                "correct_label": "A",
                "correct_rationale": "Detailed explanation...",
                "distractors": [
                    {{ "label": "A", "text": "Option text...", "incorrect_rationale": "Why this is wrong..." }},
                    {{ "label": "B", "text": "Option text...", "incorrect_rationale": "Why this is wrong..." }},
                    {{ "label": "C", "text": "Option text...", "incorrect_rationale": "Why this is wrong..." }},
                    {{ "label": "D", "text": "Option text...", "incorrect_rationale": "Why this is wrong..." }}
                ]
            }}
        ]
    }}
    Generate 6 connected questions for this case. At least one question MUST have domain="CEJ_JUSTICE".
    Ensure rationales are educational.
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
        return clean_json_text(response.text)
    except Exception as e:
        key = os.environ.get("GEMINI_API_KEY", "MISSING")
        masked = f"{key[:5]}...{key[-3:]}" if key and len(key) > 8 else key
        print(f"Gemini Generation Error: {e}")
        print(f"DEBUG: Using API Key: '{masked}' (Length: {len(key) if key else 0})")
        return None

def analyze_evidence_link(vignette: str, question_stem: str, correct_answer: str, 
                          correct_rationale: str, user_highlights: list) -> dict:
    """
    Uses AI to identify expert clinical indicators in the vignette,
    compares them with user highlights, and generates a perceptual training tip.
    
    Args:
        vignette: The clinical scenario text
        question_stem: The question being answered
        correct_answer: The correct answer text
        correct_rationale: Why the correct answer is right
        user_highlights: List of {"start": int, "end": int, "text": str}
    
    Returns:
        {
            "expert_highlights": [{"start": int, "end": int, "text": str, "importance": str}],
            "matched_count": int,
            "missed_indicators": [...],
            "perceptual_tip": str,
            "score": int
        }
    """
    client = get_client()
    if not client:
        return {"expert_highlights": [], "matched_count": 0, "missed_indicators": [], 
                "perceptual_tip": "AI analysis unavailable.", "score": 0}

    user_highlighted_texts = [h.get("text", "") for h in user_highlights]
    
    prompt = f"""
    You are an expert Occupational Therapy clinical reasoning analyzer.
    
    CLINICAL VIGNETTE:
    "{vignette}"
    
    QUESTION: "{question_stem}"
    CORRECT ANSWER: "{correct_answer}"
    RATIONALE: "{correct_rationale}"
    
    USER'S HIGHLIGHTED TEXT (what the student thought was important):
    {user_highlighted_texts if user_highlighted_texts else "No highlights made."}
    
    TASK: Identify the KEY CLINICAL INDICATORS in the vignette that a competent clinician would need 
    to recognize to answer this question correctly. For each indicator:
    1. Extract the EXACT text from the vignette (must match exactly)
    2. Classify importance as "critical" (essential for correct answer) or "supporting" (helpful context)
    
    Then compare with what the user highlighted and provide a "Perceptual Training" tip.
    
    Output strictly valid JSON:
    {{
        "expert_indicators": [
            {{"text": "exact phrase from vignette", "importance": "critical"}},
            {{"text": "another phrase", "importance": "supporting"}}
        ],
        "perceptual_tip": "Educational feedback about what they missed or did well. Be specific about which indicators were key. Max 2 sentences."
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
        
        )
        
        cleaned_text = clean_json_text(response.text)
        result = json.loads(cleaned_text)
        
        # Process expert indicators to find their positions in the vignette
        expert_highlights = []
        for indicator in result.get("expert_indicators", []):
            text = indicator.get("text", "")
            importance = indicator.get("importance", "supporting")
            
            # Find the position of this text in the vignette
            start = vignette.find(text)
            if start != -1:
                expert_highlights.append({
                    "start": start,
                    "end": start + len(text),
                    "text": text,
                    "importance": importance
                })
        
        # Compare with user highlights to find matches and misses
        matched_count = 0
        missed_indicators = []
        
        for eh in expert_highlights:
            found = False
            for uh in user_highlights:
                # Check for overlap (user highlight covers at least part of expert indicator)
                uh_start = uh.get("start", 0)
                uh_end = uh.get("end", 0)
                if uh_start <= eh["start"] < uh_end or uh_start < eh["end"] <= uh_end:
                    found = True
                    break
                # Also check text content match
                if eh["text"].lower() in uh.get("text", "").lower():
                    found = True
                    break
            
            if found:
                matched_count += 1
            else:
                missed_indicators.append(eh)
        
        # Calculate score
        total_indicators = len(expert_highlights)
        score = int((matched_count / total_indicators) * 100) if total_indicators > 0 else 0
        
        return {
            "expert_highlights": expert_highlights,
            "matched_count": matched_count,
            "missed_indicators": missed_indicators,
            "perceptual_tip": result.get("perceptual_tip", "Review the highlighted clinical indicators."),
            "score": score
        }
        
    except Exception as e:
        print(f"Evidence Link Analysis Error: {e}")
        return {"expert_highlights": [], "matched_count": 0, "missed_indicators": [], 
                "perceptual_tip": "Analysis failed. Please try again.", "score": 0}
