"""
Interprofessional SBAR handover simulator (Communication & Collaboration).

Gemini presents a brief clinical case, the candidate delivers a spoken handover
to the incoming OT/team, an AI colleague may ask a clarifying question, and the
handover is scored on SBAR structure, completeness, prioritization, and
professional language — a real verbal skill the MCQ bank can't assess. Mirrors
encounter_service (generate → reply → score); helpers degrade to None on failure.
"""
import json

from google.genai import types

from .gemini_service import get_client, generate_content, clean_json_text


def generate_case(domain=None):
    """Create a brief clinical scenario the candidate must hand over, plus the
    colleague's opening prompt requesting the handover."""
    client = get_client()
    if not client:
        return None
    focus = f" Bias the setting/case toward: {domain}." if domain else ""
    prompt = f"""Create a realistic Canadian occupational-therapy clinical scenario that a
candidate must verbally HAND OVER to an incoming OT/team (NOTCE exam practice,
CAOT, COTC 2021). Canadian context only.{focus} Give enough that a strong SBAR
handover is possible (situation, background, assessment findings, and an open
recommendation/plan question).

Output STRICTLY valid JSON (no markdown fences):
{{
  "title": "<short case label>",
  "setting": "<practice setting>",
  "brief": "<the case the candidate reads before handing over: client, reason for OT, key history, current functional status, assessments done, risks, and what's pending. 4-7 sentences.>",
  "colleague_name": "<incoming OT first name>",
  "opening_line": "<the incoming colleague asking for the handover, in their own voice, e.g. 'Hey, I'm picking up your caseload — can you hand over Mr. R for me?'>"
}}"""
    try:
        r = generate_content(client, contents=prompt, config=types.GenerateContentConfig(response_mime_type='application/json'))
        return json.loads(clean_json_text(r.text))
    except Exception as e:
        print(f"Handover case error: {e}")
        return None


def _format_transcript(transcript):
    lines = []
    for t in transcript:
        who = "COLLEAGUE" if t.get("role") == "colleague" else "OT"
        lines.append(f"{who}: {t.get('text', '')}")
    return "\n".join(lines)


def colleague_reply(case, transcript, user_message):
    """The incoming colleague reacts to the handover and asks ONE realistic
    clarifying question about anything that was vague, missing, or risk-relevant."""
    client = get_client()
    if not client:
        return None
    convo = _format_transcript(transcript)
    prompt = f"""You are role-playing the INCOMING occupational therapist receiving a
verbal handover from a colleague. Stay strictly in character. You are competent and
busy: briefly acknowledge, then ask ONE sharp clarifying question about something
that was vague, missing, or safety-relevant in what you just heard (e.g. discharge
plan, risk, equipment, consent, the actual recommendation). Concise (1-3 sentences),
end with the question. If the handover was clearly complete and you have no real
gap to probe, say you've got what you need to take over. Never break character.

CASE (you only know what the colleague tells you): {case.get('title')} — {case.get('setting')}

HANDOVER SO FAR:
{convo}

OT: {user_message}
COLLEAGUE:"""
    try:
        r = generate_content(client, contents=prompt)
        return (getattr(r, "text", "") or "").strip()
    except Exception as e:
        print(f"Handover reply error: {e}")
        return None


def score_handover(case, transcript):
    """Score the candidate's verbal handover against an SBAR + safety rubric."""
    client = get_client()
    if not client:
        return None
    convo = _format_transcript(transcript)
    prompt = f"""You are an OT preceptor scoring a candidate's VERBAL HANDOVER of the
case below to an incoming colleague, for NOTCE practice (Canadian context, COTC
2021, Communication & Collaboration competency). Judge the OT/candidate turns only,
against the SBAR framework (Situation, Background, Assessment, Recommendation).

FULL CASE (ground truth of what should have been conveyed):
{case.get('brief')}

HANDOVER TRANSCRIPT:
{convo}

Output STRICTLY valid JSON (no markdown fences):
{{
  "overall_score": <integer 0-100>,
  "verdict": "<one concise sentence>",
  "rubric": {{
    "situation": <0-100>,
    "background": <0-100>,
    "assessment": <0-100>,
    "recommendation": <0-100>,
    "prioritization": <0-100>,
    "professional_language": <0-100>
  }},
  "did_well": ["<short bullet>", "..."],
  "missed": ["<key facts/risks omitted from the handover>", "..."],
  "coaching": "<2-3 sentences of actionable coaching for a tighter SBAR handover>"
}}"""
    try:
        r = generate_content(client, contents=prompt, config=types.GenerateContentConfig(response_mime_type='application/json'))
        return json.loads(clean_json_text(r.text))
    except Exception as e:
        print(f"Handover score error: {e}")
        return None
