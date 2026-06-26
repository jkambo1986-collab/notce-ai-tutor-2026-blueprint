"""
Adaptive Review Queue.

Builds a prioritized list of items the user should revisit, computed on the fly
from their persisted answer history — no extra model/migration. Two sources feed
it:

  * ``UserAnswer`` — case-study answers that were wrong OR marked low-confidence;
    the linked ``Question`` gives us the full stem/options/rationale to re-present.
  * ``MockStudySession.session_history`` — mock/exam answers that were wrong; the
    stored ``bank_id`` lets us rehydrate the vetted ``BankQuestion`` for review.

Ordering: incorrect items before low-confidence ones, most-recent first, deduped
by question so a repeatedly-missed item appears once.
"""
from .models import UserAnswer, MockStudySession, BankQuestion


def _correct_text(distractors, correct_label):
    """Return the option text for the correct label from a distractor iterable."""
    for d in distractors:
        if d.label.upper() == (correct_label or '').upper():
            return d.text
    return ''


def compute_review_queue(user, limit=24):
    """Return ``{count, items}`` of weak items for the user to review."""
    items = []
    seen = set()  # dedup key per underlying question

    # --- Case-study answers (full Question available) ---
    case_answers = (
        UserAnswer.objects
        .filter(user=user)
        .select_related('question')
        .prefetch_related('question__distractors')
        .order_by('-timestamp')
    )
    for a in case_answers:
        wrong = not a.is_correct
        low = (a.confidence or '').upper() == 'LOW'
        if not (wrong or low):
            continue
        q = a.question
        key = ('case', q.id)
        if key in seen:
            continue
        seen.add(key)
        distractors = list(q.distractors.all())
        items.append({
            "id": q.id,
            "source": "case",
            "stem": q.stem,
            "domain": q.domain,
            "options": [{"label": d.label, "text": d.text} for d in distractors],
            "your_label": a.selected_label,
            "correct_label": q.correct_label,
            "correct_text": _correct_text(distractors, q.correct_label),
            "rationale": q.correct_rationale,
            "reason": "incorrect" if wrong else "low_confidence",
        })

    # --- Mock/exam wrong answers (rehydrate the bank question) ---
    bank_ids = []
    history_meta = {}  # bank_id -> (selected_label, correct_label)
    for s in MockStudySession.objects.filter(user=user).order_by('-started_at'):
        for h in (s.session_history or []):
            if h.get("is_correct"):
                continue
            bid = h.get("bank_id")
            if not bid or ('bank', bid) in seen:
                continue
            seen.add(('bank', bid))
            bank_ids.append(bid)
            history_meta[bid] = (h.get("selected_label"), h.get("correct_label"))

    if bank_ids:
        bank_qs = (BankQuestion.objects
                   .filter(id__in=bank_ids)
                   .prefetch_related('distractors'))
        bank_by_id = {bq.id: bq for bq in bank_qs}
        # Preserve the recency order captured above.
        for bid in bank_ids:
            bq = bank_by_id.get(bid)
            if not bq:
                continue
            distractors = list(bq.distractors.all())
            sel, corr = history_meta.get(bid, (None, bq.correct_label))
            items.append({
                "id": bq.id,
                "source": "bank",
                "stem": bq.stem,
                "domain": bq.domain,
                "options": [{"label": d.label, "text": d.text} for d in distractors],
                "your_label": sel,
                "correct_label": bq.correct_label,
                "correct_text": _correct_text(distractors, bq.correct_label),
                "rationale": bq.correct_rationale,
                "reason": "incorrect",
            })

    # Incorrect first, then low-confidence (recency already baked into append order).
    items.sort(key=lambda it: 0 if it["reason"] == "incorrect" else 1)
    items = items[:limit]
    return {"count": len(items), "items": items}
