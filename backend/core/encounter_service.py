"""
OSCE-style simulated client encounter.

Gemini role-plays an OT client/caregiver from a hidden clinical profile; the
candidate interviews them, then is scored on the relational + information-
gathering competencies that MCQs can't assess. All helpers degrade to None on
failure so the views can return a graceful 503.
"""
import json

from google.genai import types

from .gemini_service import get_client, generate_content, clean_json_text


def generate_profile():
    """Create a client persona + hidden clinical profile for an encounter."""
    client = get_client()
    if not client:
        return None
    prompt = """Create a realistic Canadian occupational-therapy client persona for a
simulated clinical interview (NOTCE exam practice). Canadian context only (CAOT,
provincial regulators); avoid US references.

Output STRICTLY valid JSON (no markdown fences):
{
  "name": "<first name>",
  "age": <integer>,
  "pronouns": "<e.g. she/her>",
  "setting": "<practice setting, e.g. home care, inpatient rehab, community mental health>",
  "presenting": "<one short line the candidate is told up front>",
  "hidden_profile": "<the full clinical picture the candidate must uncover: diagnosis/history, functional status, occupations affected, social/cultural context, risks/safety concerns, goals. 4-6 sentences. NOT shown to the candidate.>",
  "opening_line": "<the first thing the client says, in their own voice>"
}"""
    try:
        r = generate_content(client, contents=prompt, config=types.GenerateContentConfig(response_mime_type='application/json'))
        return json.loads(clean_json_text(r.text))
    except Exception as e:
        print(f"Encounter profile error: {e}")
        return None


def _format_transcript(transcript):
    lines = []
    for t in transcript:
        who = "OT" if t.get("role") == "ot" else "CLIENT"
        lines.append(f"{who}: {t.get('text', '')}")
    return "\n".join(lines)


def client_reply(profile, transcript, user_message):
    """Generate the client's next line, staying strictly in character."""
    client = get_client()
    if not client:
        return None
    convo = _format_transcript(transcript)
    prompt = f"""You are role-playing the following occupational-therapy CLIENT in a
simulated interview. Stay strictly in character as the client (or their caregiver
if that fits the persona). Reveal details from your hidden profile ONLY when the
candidate (the OT) asks relevant questions — don't volunteer everything at once.
Be realistic, human, and concise (1-3 sentences). Never break character, never
give clinical advice, never mention that you are an AI.

HIDDEN PROFILE (yours; the OT does not see this): {profile.get('hidden_profile')}
PERSONA: {profile.get('name')}, {profile.get('age')}, {profile.get('pronouns')}, in {profile.get('setting')}.

CONVERSATION SO FAR:
{convo}

OT: {user_message}
CLIENT:"""
    try:
        r = generate_content(client, contents=prompt)
        return (getattr(r, "text", "") or "").strip()
    except Exception as e:
        print(f"Encounter reply error: {e}")
        return None


def score_encounter(profile, transcript):
    """Score the completed interview against COTC 2021 competencies."""
    client = get_client()
    if not client:
        return None
    convo = _format_transcript(transcript)
    prompt = f"""You are an OT examiner scoring a candidate's SIMULATED CLIENT
INTERVIEW against the Competencies for Occupational Therapists in Canada (COTC,
2021). Canadian context only. The client's hidden profile (what an excellent
candidate should have uncovered) was:

{profile.get('hidden_profile')}

INTERVIEW TRANSCRIPT:
{convo}

Output STRICTLY valid JSON (no markdown fences):
{{
  "overall_score": <integer 0-100>,
  "verdict": "<one concise sentence>",
  "rubric": {{
    "rapport": <0-100>,
    "information_gathering": <0-100>,
    "client_centred": <0-100>,
    "cultural_safety": <0-100>,
    "safety_screening": <0-100>
  }},
  "did_well": ["<short bullet>", "..."],
  "missed": ["<key things the candidate failed to ask or uncover>", "..."],
  "coaching": "<2-3 sentences of actionable coaching>"
}}"""
    try:
        r = generate_content(client, contents=prompt, config=types.GenerateContentConfig(response_mime_type='application/json'))
        return json.loads(clean_json_text(r.text))
    except Exception as e:
        print(f"Encounter score error: {e}")
        return None
