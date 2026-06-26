"""
Performance Hub aggregation.

Builds a single, cross-session analytics payload for a user from two persisted
sources:

  * ``UserAnswer`` rows — case-study answers (carry domain + self-rated confidence).
  * ``MockStudySession.session_history`` — mock/exam answers (carry per-question
    domain; no confidence captured).

Pure read-only computation (no AI/network). Safe to call on every dashboard load.
"""
from datetime import timedelta

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .models import UserAnswer, MockStudySession, UserProfile, DomainTag

# The six NOTCE competency domains, always returned (even at zero) so the UI can
# render a stable radar/bar set.
DOMAIN_CODES = [d.value for d in DomainTag]


def _accuracy(correct, answered):
    """Percentage correct (0–100), guarding divide-by-zero."""
    return round((correct / answered) * 100, 1) if answered else 0.0


def _as_date(value):
    """Coerce a datetime or ISO-8601 string to a date, or None."""
    if value is None:
        return None
    if isinstance(value, str):
        dt = parse_datetime(value)
        return dt.date() if dt else None
    # Assume a datetime-like with .date()
    try:
        return value.date()
    except AttributeError:
        return None


def _pass_band(projected_accuracy):
    """Map a projected accuracy to an honest, plain-language likelihood band."""
    if projected_accuracy >= 72:
        return "Likely pass"
    if projected_accuracy >= 60:
        return "Borderline"
    return "At risk"


def compute_performance(user):
    """Aggregate a user's full answer history into the Performance Hub payload."""
    # --- Collect a flat list of answer events from both sources ---
    # Each event: {domain, is_correct, confidence|None, date}
    events = []

    case_answers = (UserAnswer.objects
                    .filter(user=user)
                    .select_related('question')
                    .only('is_correct', 'confidence', 'timestamp', 'question__domain'))
    for a in case_answers:
        events.append({
            "domain": a.question.domain,
            "is_correct": bool(a.is_correct),
            "confidence": (a.confidence or "").upper() or None,
            "date": _as_date(a.timestamp),
            "ts": a.timestamp,
        })

    # Only sessions whose session_history holds ANSWER events. Encounter sessions
    # store chat turns there instead, which would otherwise be miscounted as wrong
    # answers and pollute accuracy/domain/trend stats.
    sessions = list(MockStudySession.objects.filter(
        user=user, mode__in=['practice', 'exam', 'adaptive']))
    for s in sessions:
        for item in (s.session_history or []):
            ts = item.get("timestamp")
            events.append({
                "domain": item.get("domain") or s.domain,
                "is_correct": bool(item.get("is_correct")),
                "confidence": None,  # mock flow doesn't capture confidence
                "date": _as_date(ts),
                "ts": ts,
            })

    total = len(events)
    total_correct = sum(1 for e in events if e["is_correct"])

    # --- Per-domain ---
    by_domain = []
    for code in DOMAIN_CODES:
        d_events = [e for e in events if e["domain"] == code]
        answered = len(d_events)
        correct = sum(1 for e in d_events if e["is_correct"])
        by_domain.append({
            "domain": code,
            "answered": answered,
            "correct": correct,
            "accuracy": _accuracy(correct, answered),
        })

    # --- Confidence calibration (case answers only) ---
    confidence = []
    for level in ("HIGH", "MED", "LOW"):
        c_events = [e for e in events if e["confidence"] == level]
        answered = len(c_events)
        correct = sum(1 for e in c_events if e["is_correct"])
        confidence.append({
            "level": level,
            "answered": answered,
            "correct": correct,
            "accuracy": _accuracy(correct, answered),
        })

    # --- Trend: accuracy per active day, last 14 active days ---
    by_day = {}
    for e in events:
        d = e["date"]
        if not d:
            continue
        bucket = by_day.setdefault(d, {"answered": 0, "correct": 0})
        bucket["answered"] += 1
        if e["is_correct"]:
            bucket["correct"] += 1
    trend = [
        {
            "date": d.isoformat(),
            "answered": v["answered"],
            "correct": v["correct"],
            "accuracy": _accuracy(v["correct"], v["answered"]),
        }
        for d, v in sorted(by_day.items())
    ][-14:]

    # --- Projected accuracy / pass band from the most recent answers ---
    # Sort by timestamp where available; events without a parseable ts sink to the
    # front so recent (dated) answers dominate the projection.
    def _sort_key(e):
        d = e["date"]
        return (d is not None, d or timezone.now().date())

    recent = sorted(events, key=_sort_key)[-60:]
    recent_correct = sum(1 for e in recent if e["is_correct"])
    projected = _accuracy(recent_correct, len(recent))
    enough_data = total >= 20

    # --- Activity ---
    today = timezone.now().date()
    week_ago = today - timedelta(days=7)
    answers_last_7 = sum(1 for e in events if e["date"] and e["date"] >= week_ago)
    study_days = len({e["date"] for e in events if e["date"]})
    sessions_completed = sum(1 for s in sessions if not s.is_active or s.completed_at)

    # --- Exam countdown ---
    exam_date = None
    days_to_exam = None
    try:
        profile = user.userprofile
        if profile and profile.target_exam_date:
            exam_date = profile.target_exam_date.isoformat()
            days_to_exam = (profile.target_exam_date - today).days
    except UserProfile.DoesNotExist:
        pass

    # --- Smart Drill recommendation ---
    # Pick the domain to drill next: the lowest-accuracy domain among those with
    # enough attempts to be meaningful; if none qualify yet, steer the user to the
    # least-practiced domain to broaden coverage. Crucially, only recommend a
    # domain that actually has approved 'Medium' bank questions, since Smart Drill
    # auto-starts a Medium mock there — otherwise the drill would 404.
    from .models import BankQuestion
    ATTEMPT_FLOOR = 3
    covered = set(
        BankQuestion.objects
        .filter(difficulty='Medium', status='approved')
        .values_list('domain', flat=True).distinct()
    )
    candidates = [d for d in by_domain if d["domain"] in covered] or by_domain
    practiced = [d for d in candidates if d["answered"] >= ATTEMPT_FLOOR]
    if practiced:
        target = min(practiced, key=lambda d: d["accuracy"])
        reason = f"Your weakest area — {target['accuracy']}% so far."
    else:
        target = min(candidates, key=lambda d: d["answered"])
        reason = "You've practiced this the least."
    recommended_drill = {
        "domain": target["domain"],
        "reason": reason,
        "accuracy": target["accuracy"],
        "answered": target["answered"],
    }

    return {
        "overall": {
            "answered": total,
            "correct": total_correct,
            "accuracy": _accuracy(total_correct, total),
            "enough_data": enough_data,
        },
        "pass_projection": {
            "projected_accuracy": projected,
            "band": _pass_band(projected) if enough_data else "Not enough data",
            "enough_data": enough_data,
            "sample_size": len(recent),
        },
        "by_domain": by_domain,
        "confidence": confidence,
        "trend": trend,
        "activity": {
            "study_days": study_days,
            "sessions_completed": sessions_completed,
            "total_sessions": len(sessions),
            "answers_last_7_days": answers_last_7,
        },
        "exam_date": exam_date,
        "days_to_exam": days_to_exam,
        "recommended_drill": recommended_drill,
    }
