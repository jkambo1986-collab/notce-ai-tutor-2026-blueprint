"""
Clinical-reasoning coach.

Grades a candidate's FREE-TEXT clinical reasoning for a case (not a multiple-
choice answer) against the Competencies for Occupational Therapists in Canada
(COTC, 2021) using Gemini. Returns structured JSON; degrades to None on failure
so the view returns a graceful 503.
"""
import json

from google.genai import types

from .gemini_service import get_client, generate_content, clean_json_text


def evaluate_reasoning(vignette: str, prompt: str, user_text: str):
    """Return a structured evaluation of the candidate's reasoning, or None."""
    client = get_client()
    if not client:
        return None

    instruction = f"""
You are an expert examiner for the Canadian NOTCE (administered by CAOT). You are
assessing a candidate's CLINICAL REASONING PROCESS in their own words — not a
multiple-choice answer — against the Competencies for Occupational Therapists in
Canada (COTC, 2021). Use the CANADIAN practice context only (CAOT, provincial
regulatory organizations, the Canadian Code of Ethics). Do NOT reference US bodies
(NBCOT, AOTA) or US frameworks.

CASE VIGNETTE:
{vignette}

PROMPT THE CANDIDATE RESPONDED TO:
{prompt}

CANDIDATE'S WRITTEN REASONING:
{user_text}

Judge the *reasoning*, not prose: did they protect client safety, centre the
client's priorities/occupations, gather and use the right information, justify
with evidence/sound OT principles, and sequence their actions appropriately?
Be specific and constructive; reward sound reasoning even if phrased simply.

Output STRICTLY valid JSON (no markdown fences):
{{
  "overall_score": <integer 0-100>,
  "verdict": "<one concise sentence on the overall quality>",
  "rubric": {{
    "safety": <0-100>,
    "client_centred": <0-100>,
    "clinical_reasoning": <0-100>,
    "evidence_use": <0-100>,
    "prioritization": <0-100>
  }},
  "strengths": ["<short bullet>", "..."],
  "gaps": ["<short bullet on what was missing or wrong>", "..."],
  "coaching": "<2-3 sentences of actionable coaching>",
  "model_answer": "<a concise expert reasoning for this prompt, 3-5 sentences>"
}}
"""
    try:
        response = generate_content(
            client,
            contents=instruction,
            config=types.GenerateContentConfig(response_mime_type='application/json'),
        )
        return json.loads(clean_json_text(response.text))
    except Exception as e:
        print(f"Reasoning evaluation error: {e}")
        return None
