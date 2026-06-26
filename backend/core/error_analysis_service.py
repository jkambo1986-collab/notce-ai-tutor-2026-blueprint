"""
Cognitive-error / test-taking-trap analysis.

Looks at *how* a candidate gets questions wrong (not just which topics) by mining
their persisted wrong answers from both the case-study (`UserAnswer`) and
mock/exam (`MockStudySession.session_history`) flows. Purely deterministic — no
AI/network — so it's cheap to run on every dashboard load. Detects recurring
failure modes (decision-word misreads, overconfidence, domain concentration) and
attaches plain-language coaching. No new model/migration.
"""
import re
from collections import Counter

from .models import UserAnswer, MockStudySession

# Stem qualifiers whose misreading is a classic licensing-exam trap.
DECISION_WORDS = ["FIRST", "BEST", "MOST", "NEXT", "INITIAL", "LEAST", "PRIORITY", "EXCEPT"]
_DW_RE = re.compile(r"\b(" + "|".join(DECISION_WORDS) + r")\b")


def _iter_wrong(user):
    """Yield each wrong-answer event as a normalized dict."""
    case_answers = (UserAnswer.objects
                    .filter(user=user, is_correct=False)
                    .select_related("question"))
    for a in case_answers:
        yield {
            "stem": a.question.stem or "",
            "domain": a.question.domain,
            "confidence": (a.confidence or "").upper(),
            "source": "case",
        }
    for s in MockStudySession.objects.filter(user=user):
        for h in (s.session_history or []):
            if h.get("is_correct"):
                continue
            yield {
                "stem": h.get("stem") or "",
                "domain": h.get("domain") or s.domain,
                "confidence": "",  # mock/exam flow doesn't capture confidence
                "source": "mock",
            }


def analyze_errors(user):
    """Return ``{total_wrong, enough_data, patterns: [...]}`` for the user."""
    wrong = list(_iter_wrong(user))
    total = len(wrong)
    patterns = []

    # 1) Decision-word misreads: missed items whose stem hinges on a qualifier.
    dw_hits = [w for w in wrong if w["stem"] and _DW_RE.search(w["stem"].upper())]
    if len(dw_hits) >= 3:
        patterns.append({
            "key": "decision_words",
            "label": "Decision-word misreads",
            "count": len(dw_hits),
            "severity": "high" if len(dw_hits) >= 6 else "medium",
            "detail": "You're missing items that turn on a qualifier like FIRST / BEST / MOST / NEXT. "
                      "Before answering, underline the decision word and ask \"first/best for THIS client, right now?\".",
            "examples": [w["stem"][:140] for w in dw_hits[:3]],
        })

    # 2) Overconfidence: high-confidence answers that were wrong (case flow only).
    overconf = [w for w in wrong if w["confidence"] == "HIGH"]
    if len(overconf) >= 3:
        patterns.append({
            "key": "overconfidence",
            "label": "Overconfident errors",
            "count": len(overconf),
            "severity": "high" if len(overconf) >= 6 else "medium",
            "detail": "You rated these \"high confidence\" but got them wrong — a sign of a knowledge gap you can't feel. "
                      "When you're certain, do one deliberate re-check of contraindications and client priorities before locking it in.",
            "examples": [w["stem"][:140] for w in overconf[:3]],
        })

    # 3) Domain concentration: a large share of misses in one competency.
    by_domain = Counter(w["domain"] for w in wrong if w["domain"])
    if total >= 5 and by_domain:
        top_domain, cnt = by_domain.most_common(1)[0]
        if cnt / total >= 0.4:
            patterns.append({
                "key": "domain_concentration",
                "label": "Errors cluster in one domain",
                "count": cnt,
                "severity": "medium",
                "domain": top_domain,
                "detail": f"{round(100 * cnt / total)}% of your misses are in a single competency. "
                          "A focused Smart Drill there will move your score faster than broad practice.",
                "examples": [w["stem"][:140] for w in wrong if w["domain"] == top_domain][:3],
            })

    # Order by severity then size so the worst trap shows first.
    sev_rank = {"high": 0, "medium": 1, "low": 2}
    patterns.sort(key=lambda p: (sev_rank.get(p.get("severity"), 3), -p["count"]))

    return {
        "total_wrong": total,
        "enough_data": total >= 5,
        "patterns": patterns,
    }
