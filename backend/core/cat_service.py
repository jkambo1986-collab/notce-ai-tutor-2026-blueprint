"""
Lightweight computer-adaptive testing (CAT).

Estimates a candidate's ability on the logit scale (a Rasch-style theta) and
selects each next item at the difficulty that's most informative for their
current ability — the measurement model the real (scaled) NOTCE uses. The math is
deliberately light (1-parameter logistic + a step update); no heavy deps.

Item difficulty (b) is seeded from the bank's Easy/Medium/Hard labels. A final
theta maps to an estimated readiness score + pass band.
"""
import math

from .models import BankQuestion

# Bank difficulty label -> Rasch b-parameter (item difficulty on the logit scale).
DIFFICULTY_B = {'Easy': -1.0, 'Medium': 0.0, 'Hard': 1.0}
# Ability update step (larger = faster but noisier convergence).
K = 0.5


def item_b(difficulty: str) -> float:
    return DIFFICULTY_B.get(difficulty, 0.0)


def prob_correct(theta: float, b: float) -> float:
    """1-parameter logistic probability of a correct response."""
    return 1.0 / (1.0 + math.exp(-(theta - b)))


def update_theta(theta: float, b: float, correct: bool) -> float:
    """Rasch-style ability update toward the observed outcome."""
    p = prob_correct(theta, b)
    return theta + K * ((1.0 if correct else 0.0) - p)


def _target_difficulty(theta: float) -> str:
    """The difficulty bucket whose b is closest to the current ability."""
    if theta < -0.5:
        return 'Easy'
    if theta > 0.5:
        return 'Hard'
    return 'Medium'


def select_item(theta: float, exclude_ids):
    """Pick the most informative unused approved bank question for this ability.

    Prefers the difficulty bucket nearest theta; falls back to adjacent buckets,
    then any approved item, so the assessment never stalls.
    """
    base = (BankQuestion.objects
            .filter(status='approved')
            .exclude(id__in=list(exclude_ids or []))
            .prefetch_related('distractors'))

    target = _target_difficulty(theta)
    order = {
        'Easy': ['Easy', 'Medium', 'Hard'],
        'Medium': ['Medium', 'Easy', 'Hard'],
        'Hard': ['Hard', 'Medium', 'Easy'],
    }[target]
    for diff in order:
        bq = base.filter(difficulty=diff).order_by('?').first()
        if bq:
            return bq
    return base.order_by('?').first()


def item_payload(bq):
    """Full server-side item dict (includes the answer; the view strips it)."""
    distractors = list(bq.distractors.all())
    return {
        "bank_id": bq.id,
        "stem": bq.stem,
        "options": [{"label": d.label, "text": d.text} for d in distractors],
        "correct_label": bq.correct_label,
        "domain": bq.domain,
        "difficulty": bq.difficulty,
        "b": item_b(bq.difficulty),
    }


def client_item(item: dict, number: int, total: int) -> dict:
    """Answer-free payload for the client."""
    return {
        "number": number,
        "total": total,
        "stem": item.get("stem"),
        "options": item.get("options", []),
        "domain": item.get("domain"),
    }


def readiness(theta: float):
    """Map an overall ability to an estimated readiness score (0-100) + band."""
    p = 1.0 / (1.0 + math.exp(-1.2 * theta))  # squashed pass-likelihood
    score = round(p * 100)
    band = "Likely pass" if score >= 65 else ("Borderline" if score >= 50 else "Not yet")
    return score, band
