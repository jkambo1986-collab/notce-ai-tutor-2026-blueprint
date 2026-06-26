"""
"Teach-It-Back" tutor (the protégé effect).

The candidate teaches a high-yield OT concept ALOUD; Gemini role-plays a curious
junior OT student who asks naive follow-up questions, forcing the candidate to
clarify. At the end the teaching is scored for accuracy, clarity, completeness,
and use of examples — the act of explaining is itself one of the strongest
retention techniques. Mirrors encounter_service's structure (generate → reply →
score) and degrades to None on failure so views can return a graceful 503.
"""
import json

from google.genai import types

from .gemini_service import get_client, generate_content, clean_json_text


def generate_topic(domain=None):
    """Pick a high-yield NOTCE concept for the candidate to teach, plus the
    student's opening ask."""
    client = get_client()
    if not client:
        return None
    focus = f" Focus on the competency domain: {domain}." if domain else ""
    prompt = f"""Pick ONE high-yield concept an occupational therapist must master for
the Canadian NOTCE exam (CAOT, 2026 Blueprint / COTC 2021).{focus} It should be a
concept that rewards clear explanation (a framework, assessment, intervention
principle, or reasoning model) — not a trivia fact.

Output STRICTLY valid JSON (no markdown fences):
{{
  "concept": "<the concept name>",
  "blueprint_domain": "<one of: OT Expertise, Culture/Equity/Justice, Communication & Collaboration, Professional Responsibility, Excellence in Practice, Engagement in the Profession>",
  "opening_line": "<a first-year OT student asking the candidate to explain this concept, in the student's own friendly, slightly unsure voice>"
}}"""
    try:
        r = generate_content(client, contents=prompt, config=types.GenerateContentConfig(response_mime_type='application/json'))
        return json.loads(clean_json_text(r.text))
    except Exception as e:
        print(f"Teachback topic error: {e}")
        return None


def _format_transcript(transcript):
    lines = []
    for t in transcript:
        who = "TEACHER" if t.get("role") == "teacher" else "STUDENT"
        lines.append(f"{who}: {t.get('text', '')}")
    return "\n".join(lines)


def student_reply(topic, transcript, user_message):
    """Generate the curious student's next turn: react to what was just taught and
    ask ONE naive but pointed follow-up that probes a gap or assumption."""
    client = get_client()
    if not client:
        return None
    convo = _format_transcript(transcript)
    prompt = f"""You are role-playing a FIRST-YEAR occupational-therapy STUDENT being
taught by a more senior candidate. You are bright but genuinely unsure, so you ask
naive, honest follow-up questions that probe gaps, assumptions, or "why" — the kind
that force a good teacher to clarify. Stay strictly in character as the student.
Be warm, concise (1-3 sentences), end most turns with ONE question. Never give the
explanation yourself, never break character, never mention being an AI. If the
teacher has explained the concept thoroughly and your questions are answered, you
may say you finally get it and briefly summarise in your own (still-learner) words.

CONCEPT BEING TAUGHT: {topic.get('concept')}

CONVERSATION SO FAR:
{convo}

TEACHER: {user_message}
STUDENT:"""
    try:
        r = generate_content(client, contents=prompt)
        return (getattr(r, "text", "") or "").strip()
    except Exception as e:
        print(f"Teachback reply error: {e}")
        return None


def score_teachback(topic, transcript):
    """Score the candidate's teaching for accuracy, clarity, completeness, and
    examples — and flag any misconceptions they taught."""
    client = get_client()
    if not client:
        return None
    convo = _format_transcript(transcript)
    prompt = f"""You are an OT educator evaluating how well a candidate TAUGHT the
concept below to a junior student, for NOTCE exam preparation (Canadian context,
COTC 2021). Judge the TEACHER's turns only.

CONCEPT: {topic.get('concept')}

TRANSCRIPT:
{convo}

Output STRICTLY valid JSON (no markdown fences):
{{
  "overall_score": <integer 0-100>,
  "verdict": "<one concise sentence>",
  "rubric": {{
    "accuracy": <0-100>,
    "clarity": <0-100>,
    "completeness": <0-100>,
    "use_of_examples": <0-100>,
    "responsiveness": <0-100>
  }},
  "did_well": ["<short bullet>", "..."],
  "misconceptions": ["<anything the teacher stated that is wrong or misleading; empty list if none>"],
  "coaching": "<2-3 sentences of actionable coaching to teach it better next time>"
}}"""
    try:
        r = generate_content(client, contents=prompt, config=types.GenerateContentConfig(response_mime_type='application/json'))
        return json.loads(clean_json_text(r.text))
    except Exception as e:
        print(f"Teachback score error: {e}")
        return None
