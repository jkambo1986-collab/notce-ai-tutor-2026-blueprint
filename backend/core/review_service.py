"""
Spaced-Repetition Review (SRS).

Two layers:

  * **Discovery** — scan the user's answer history for weak items (wrong OR
    low-confidence case answers; wrong mock/exam answers) and make sure each has
    a ``ReviewItem`` scheduling row (due immediately the first time it's seen).
  * **Scheduling** — `compute_review_queue` returns the items that are *due now*
    with their full question payload rehydrated; `grade_review` reschedules an
    item via a Leitner box ladder (remembered → longer interval; forgot → reset).

This replaces the old "list every weak item every time" behaviour: once you
review something and remember it, it won't resurface until it's due again.
"""
from django.utils import timezone

from .models import UserAnswer, MockStudySession, BankQuestion, Question, ReviewItem

# Leitner ladder: days until an item is due again at each box level.
BOX_INTERVALS_DAYS = [1, 3, 7, 16, 35]
MAX_BOX = len(BOX_INTERVALS_DAYS) - 1


def _correct_text(distractors, correct_label):
    for d in distractors:
        if d.label.upper() == (correct_label or '').upper():
            return d.text
    return ''


def _discover_weak(user):
    """Yield (item_key, source, domain) for every weak item in answer history.

    Deduped by underlying question, most-recent first. This is discovery only —
    it does not build review payloads (that happens for due items in
    compute_review_queue).
    """
    seen = set()

    case_answers = (
        UserAnswer.objects.filter(user=user)
        .select_related('question')
        .order_by('-timestamp')
    )
    for a in case_answers:
        wrong = not a.is_correct
        low = (a.confidence or '').upper() == 'LOW'
        if not (wrong or low):
            continue
        key = f"case:{a.question_id}"
        if key in seen:
            continue
        seen.add(key)
        yield key, 'case', a.question.domain

    for s in MockStudySession.objects.filter(user=user).order_by('-started_at'):
        for h in (s.session_history or []):
            if h.get('is_correct'):
                continue
            bid = h.get('bank_id')
            if not bid:
                continue
            key = f"bank:{bid}"
            if key in seen:
                continue
            seen.add(key)
            yield key, 'bank', h.get('domain', '') or ''


def ensure_review_items(user):
    """Create scheduling rows (due now) for any weak item not yet tracked."""
    existing = set(ReviewItem.objects.filter(user=user).values_list('item_key', flat=True))
    now = timezone.now()
    to_create = []
    for key, source, domain in _discover_weak(user):
        if key in existing:
            continue
        existing.add(key)
        to_create.append(ReviewItem(
            user=user, item_key=key, source=source, domain=domain or '', due_at=now,
        ))
    if to_create:
        ReviewItem.objects.bulk_create(to_create, ignore_conflicts=True)


def _rehydrate(item):
    """Build the review payload for a ReviewItem, or None if its question is gone."""
    source, _, raw_id = item.item_key.partition(':')
    if source == 'case':
        q = (Question.objects.filter(id=raw_id)
             .prefetch_related('distractors').first())
        if not q:
            return None
        distractors = list(q.distractors.all())
        return {
            "id": q.id, "key": item.item_key, "source": "case", "stem": q.stem,
            "domain": q.domain,
            "options": [{"label": d.label, "text": d.text} for d in distractors],
            "correct_label": q.correct_label,
            "correct_text": _correct_text(distractors, q.correct_label),
            "rationale": q.correct_rationale,
        }
    bq = (BankQuestion.objects.filter(id=raw_id)
          .prefetch_related('distractors').first())
    if not bq:
        return None
    distractors = list(bq.distractors.all())
    return {
        "id": bq.id, "key": item.item_key, "source": "bank", "stem": bq.stem,
        "domain": bq.domain,
        "options": [{"label": d.label, "text": d.text} for d in distractors],
        "correct_label": bq.correct_label,
        "correct_text": _correct_text(distractors, bq.correct_label),
        "rationale": bq.correct_rationale,
    }


def compute_review_queue(user, limit=24):
    """Return ``{count, items}`` of items DUE for review right now."""
    ensure_review_items(user)
    now = timezone.now()
    due = (ReviewItem.objects.filter(user=user, due_at__lte=now)
           .order_by('due_at')[:limit])
    items = []
    for it in due:
        payload = _rehydrate(it)
        if payload:
            items.append(payload)
    return {"count": len(items), "items": items}


def grade_review(user, item_key, remembered):
    """Reschedule one item after a review. Returns the updated state (or None)."""
    try:
        item = ReviewItem.objects.get(user=user, item_key=item_key)
    except ReviewItem.DoesNotExist:
        return None

    if remembered:
        item.box = min(item.box + 1, MAX_BOX)
    else:
        item.box = 0
        item.lapses += 1
    item.reps += 1
    item.last_reviewed_at = timezone.now()
    item.due_at = timezone.now() + timezone.timedelta(days=BOX_INTERVALS_DAYS[item.box])
    item.save(update_fields=['box', 'lapses', 'reps', 'last_reviewed_at', 'due_at', 'updated_at'])
    return {"item_key": item.item_key, "box": item.box, "due_at": item.due_at.isoformat()}
