import os
from google import genai
from google.genai import types
import re
import json

# Model selection. Primary is the cheaper/faster gemini-2.5-flash-lite; if a
# request to it fails (e.g. unavailable, quota, transient error) we fall back
# to gemini-2.5-flash. Both are available on Vertex and the Developer API.
# Override either via GEMINI_MODEL / GEMINI_FALLBACK_MODEL.
MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite")
FALLBACK_MODEL_NAME = os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash")

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

# Initialize Gemini client.
#
# Two modes are supported, in priority order:
#   1. Vertex AI (production) -- billed against Google Cloud / Vertex credits.
#      Enabled when GOOGLE_GENAI_USE_VERTEXAI is truthy OR a service-account
#      JSON is provided via GCP_SERVICE_ACCOUNT_JSON. Auth uses the service
#      account; project/location come from env (or the JSON's project_id).
#   2. Gemini Developer API (local dev) -- billed against GEMINI_API_KEY.
#
# Relevant env vars:
#   GOOGLE_GENAI_USE_VERTEXAI = "True"
#   GCP_SERVICE_ACCOUNT_JSON  = <full service-account JSON, as a single string>
#   GOOGLE_CLOUD_PROJECT      = <gcp project id>           (optional; falls back to JSON project_id)
#   GOOGLE_CLOUD_LOCATION     = <region, e.g. us-central1> (optional; defaults to us-central1)
#   GEMINI_API_KEY            = <dev api key>              (fallback only)

def _truthy(val):
    return str(val).strip().lower() in ("1", "true", "yes", "on")

def get_client():
    use_vertex = _truthy(os.environ.get("GOOGLE_GENAI_USE_VERTEXAI", ""))
    sa_json = os.environ.get("GCP_SERVICE_ACCOUNT_JSON")

    if use_vertex or sa_json:
        try:
            credentials = None
            project = os.environ.get("GOOGLE_CLOUD_PROJECT")
            location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")

            if sa_json:
                from google.oauth2 import service_account
                info = json.loads(sa_json)
                credentials = service_account.Credentials.from_service_account_info(
                    info, scopes=["https://www.googleapis.com/auth/cloud-platform"]
                )
                project = project or info.get("project_id")

            return genai.Client(
                vertexai=True,
                project=project,
                location=location,
                credentials=credentials,
            )
        except Exception as e:
            print(f"Vertex AI client init failed, falling back to API key: {e}")

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    return genai.Client(api_key=api_key)

def generate_content(client, contents, config=None):
    """
    Calls generate_content with the primary model (MODEL_NAME) and transparently
    falls back to FALLBACK_MODEL_NAME if the primary model errors. Raises the
    last error only if every model fails.
    """
    models = [m for m in (MODEL_NAME, FALLBACK_MODEL_NAME) if m]
    last_error = None
    for model in models:
        try:
            if config is not None:
                return client.models.generate_content(model=model, contents=contents, config=config)
            return client.models.generate_content(model=model, contents=contents)
        except Exception as e:
            last_error = e
            print(f"Model '{model}' failed: {e}. Falling back to next model if available.")
    if last_error:
        raise last_error

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
        response = generate_content(client, contents=prompt)
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

    CONTEXT: This prepares candidates for the Canadian NOTCE (National Occupational Therapy
    Certification Examination, administered by CAOT) under the September 2026 Blueprint, which is
    built on the Competencies for Occupational Therapists in Canada (COTC, 2021). Use the CANADIAN
    practice context only: CAOT, provincial regulatory organizations (e.g. COTO, ACOTRO), the
    Canadian Code of Ethics, and Canadian terminology. Do NOT reference US bodies (NBCOT, AOTA,
    AOTA Practice Framework) or US-specific regulations. Reflect Truth & Reconciliation, Indigenous
    cultural safety, equity and anti-racism where relevant.

    The case should focus on domain: "{domain}" with difficulty: "{difficulty}".

    Each question must have exactly 4 options (A-D) with ONE single BEST answer. Where appropriate,
    emphasize the decision word in the stem in capitals (e.g. FIRST, BEST, MOST, NEXT). Use plain
    language. Vary clients realistically across the descriptors the NOTCE Blueprint samples: type of
    client (individual, family, group, community, organization, population), age, pronouns
    (he/she/they, non-binary, transgender), Black/Indigenous/People of Colour representation, and
    diagnosis categories (neurological, musculoskeletal, mental health, general medical).

    CRITICAL REQUIREMENT: Per the 2026 NOTCE Blueprint, at least ONE question MUST have domain "CEJ_JUSTICE" (Culture, Equity, and Justice). This is mandatory.

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
        response = generate_content(
            client,
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
        response = generate_content(
            client,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type='application/json'
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
