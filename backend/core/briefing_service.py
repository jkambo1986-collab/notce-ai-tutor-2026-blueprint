"""
Personalized Daily Audio Briefing.

Assembles a short, spoken-word "morning briefing" script tailored to the user:
their readiness band, exam countdown, weakest domain (with a 30-second AI
micro-teach of a high-yield concept there), and what's due for spaced review.
The frontend reads each segment aloud via the existing /tts/ neural voice.

Data comes from performance_service + review_service (already computed); only the
micro-teach is an AI call, and it degrades gracefully if the model is unavailable.
"""
from .performance_service import compute_performance
from .review_service import compute_review_queue

DOMAIN_LABELS = {
    'OT_EXP': 'OT Expertise',
    'CEJ_JUSTICE': 'Culture, Equity & Justice',
    'COMM_COLLAB': 'Communication & Collaboration',
    'PROF_RESP': 'Professional Responsibility',
    'EXCELLENCE': 'Excellence in Practice',
    'ENGAGEMENT': 'Engagement in the Profession',
}


def _micro_teach(domain_label):
    """One tight, spoken-word high-yield teaching point for the weak domain."""
    try:
        from google.genai import types
        from .gemini_service import get_client, generate_content
        client = get_client()
        if not client:
            return None
        prompt = f"""Give ONE high-yield teaching point for the Canadian NOTCE exam in the
competency domain "{domain_label}" (CAOT, COTC 2021). Write it to be SPOKEN ALOUD in
about 30 seconds: plain, warm, second person, 2-4 sentences, no markdown, no lists,
no headings. Make it concrete and memorable — a principle or distinction the
candidate can apply on exam day."""
        r = generate_content(client, contents=prompt)
        text = (getattr(r, "text", "") or "").strip()
        return text or None
    except Exception as e:
        print(f"Briefing micro-teach error: {e}")
        return None


def build_briefing(user):
    """Return ``{segments: [{title, text}], summary}`` for the daily briefing."""
    perf = compute_performance(user)
    review = compute_review_queue(user)
    review_count = review.get("count", 0)

    overall = perf.get("overall", {})
    proj = perf.get("pass_projection", {})
    by_domain = perf.get("by_domain", [])
    days = perf.get("days_to_exam")
    name = user.first_name or user.username

    answered = overall.get("answered", 0)
    segments = []

    # 1. Greeting + readiness
    if answered == 0:
        segments.append({
            "title": "Welcome",
            "text": f"Good day, {name}. You haven't logged any practice yet, so let's start building "
                    f"your readiness today. Even ten questions will give you your first projected score.",
        })
    else:
        if proj.get("enough_data"):
            band = proj.get("band", "")
            segments.append({
                "title": "Your readiness",
                "text": f"Good day, {name}. Your projected score is {proj.get('projected_accuracy')} percent — "
                        f"that's the {band} band. Overall you're answering {overall.get('accuracy')} percent correctly.",
            })
        else:
            segments.append({
                "title": "Your readiness",
                "text": f"Good day, {name}. You're at {overall.get('accuracy')} percent accuracy so far. "
                        f"Answer a few more and we'll project your exam score.",
            })

    # 2. Exam countdown
    if isinstance(days, int) and days >= 0:
        segments.append({
            "title": "Exam countdown",
            "text": f"You have {days} day{'s' if days != 1 else ''} until your exam. " +
                    ("Let's make today count." if days <= 30 else "Plenty of runway — steady daily reps win this."),
        })

    # 3. Weakest domain + micro-teach
    attempted = [d for d in by_domain if d.get("answered", 0) > 0]
    weakest = min(attempted, key=lambda d: d.get("accuracy", 0)) if attempted else None
    if weakest and weakest.get("accuracy", 100) < 75:
        label = DOMAIN_LABELS.get(weakest["domain"], weakest["domain"])
        seg_text = (f"Your weakest area right now is {label}, at {weakest.get('accuracy')} percent. "
                    f"Here's a quick win.")
        teach = _micro_teach(label)
        segments.append({"title": f"Focus: {label}", "text": seg_text})
        if teach:
            segments.append({"title": "Today's concept", "text": teach})

    # 4. Spaced review
    if review_count > 0:
        segments.append({
            "title": "Due for review",
            "text": f"You have {review_count} item{'s' if review_count != 1 else ''} due for spaced review. "
                    f"Clearing those locks in what you nearly forgot.",
        })

    # 5. Close
    segments.append({
        "title": "Go get it",
        "text": "That's your briefing. Pick one thing from this and do it now — momentum beats motivation.",
    })

    return {
        "segments": segments,
        "summary": {
            "answered": answered,
            "projected": proj.get("projected_accuracy") if proj.get("enough_data") else None,
            "band": proj.get("band") if proj.get("enough_data") else None,
            "days_to_exam": days,
            "review_due": review_count,
            "weakest_domain": DOMAIN_LABELS.get(weakest["domain"], weakest["domain"]) if weakest else None,
        },
    }
