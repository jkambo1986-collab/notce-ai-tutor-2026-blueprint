"""
Merge premium-bank mint/review workflow outputs into a `bank_seed.json`.

The actual question minting + independent review runs as Claude Code Workflow
scripts (Sonnet 4.6 mints, a second Sonnet 4.6 blind-solves + audits). Each
workflow returns JSON. This command is the deterministic glue that turns those
outputs into a clean, importable seed:

  - reads one or more workflow output files (raw task output with a top-level
    `result`, OR an already-shaped {cases, questions} object),
  - keeps only APPROVED questions (override with --include-needs-review),
  - optionally merges on top of an existing seed (--base) and de-dups by id,
  - truncates over-length char fields (topic<=160, option text<=600, etc.),
  - rebalances correct answers evenly across A/B/C/D,
  - writes {version, cases, questions} to --out and prints a coverage report.

Typical future run:
  python manage.py merge_mint out1.json out2.json \
      --base core/data/bank_seed.json --out core/data/bank_seed.json --seed-version full-sonnet-v4
  python manage.py import_bank core/data/bank_seed.json
"""
import json
import os
import collections

from django.core.management.base import BaseCommand, CommandError

LABELS = ["A", "B", "C", "D"]


def _result(doc):
    """Accept raw task output ({'result': {...}}) or a bare {cases, questions}."""
    if isinstance(doc, dict) and "result" in doc and isinstance(doc["result"], dict):
        return doc["result"]
    return doc


def _rebalance(q, target):
    opts = q.get("options", [])
    ci = next((i for i, o in enumerate(opts) if o.get("label") == q.get("correct_label")), None)
    if ci is None or len(opts) != 4:
        return
    correct = opts[ci]
    others = [o for i, o in enumerate(opts) if i != ci]
    ordered, oi = [], 0
    for i in range(4):
        if i == target:
            ordered.append(correct)
        else:
            ordered.append(others[oi]); oi += 1
    q["options"] = [
        {"label": LABELS[i], "text": (o.get("text") or "")[:600],
         "incorrect_rationale": o.get("incorrect_rationale")}
        for i, o in enumerate(ordered)
    ]
    q["correct_label"] = LABELS[target]


class Command(BaseCommand):
    help = "Merge mint/review workflow outputs into a bank_seed.json (dedupe, rebalance, truncate)."

    def add_arguments(self, parser):
        parser.add_argument("outputs", nargs="+", help="Workflow output JSON file(s).")
        parser.add_argument("--base", help="Existing seed to merge on top of (kept + de-duped).")
        parser.add_argument("--out", required=True, help="Destination seed JSON path.")
        parser.add_argument("--seed-version", default="merged", help="version string to stamp into the seed.")
        parser.add_argument("--include-needs-review", action="store_true",
                            help="Also keep items whose status != 'approved'.")

    def handle(self, *args, **opts):
        byid = {}
        cases = {}

        # Seed the pool with an existing base seed (so we accumulate over rounds).
        if opts["base"]:
            if not os.path.exists(opts["base"]):
                raise CommandError(f"--base not found: {opts['base']}")
            base = json.load(open(opts["base"], encoding="utf-8"))
            for q in base.get("questions", []):
                byid[q["id"]] = q
            for c in base.get("cases", []):
                cases[c["id"]] = c
        before = len(byid)

        keep_all = opts["include_needs_review"]
        want = (lambda s: True) if keep_all else (lambda s: s == "approved")

        added = 0
        for path in opts["outputs"]:
            if not os.path.exists(path):
                self.stderr.write(f"skip (missing): {path}")
                continue
            try:
                r = _result(json.load(open(path, encoding="utf-8")))
            except Exception as e:
                self.stderr.write(f"skip (bad json): {path} ({e})")
                continue
            for c in r.get("cases", []):
                cases[c["id"]] = c
            for q in r.get("questions", []):
                if not want(q.get("status", "draft")):
                    continue
                if q["id"] in byid:
                    continue
                q["topic"] = (q.get("topic", "") or "")[:160]
                byid[q["id"]] = q
                added += 1

        qs = list(byid.values())
        for i, q in enumerate(qs):
            _rebalance(q, i % 4)

        # Keep only cases referenced by surviving case-format questions.
        used = {q.get("case_id") for q in qs if q.get("case_id")}
        seed_cases = [cases[c] for c in used if c in cases]

        seed = {"version": opts["seed_version"], "cases": seed_cases, "questions": qs}
        os.makedirs(os.path.dirname(os.path.abspath(opts["out"])), exist_ok=True)
        with open(opts["out"], "w", encoding="utf-8", newline="\n") as fh:
            json.dump(seed, fh, ensure_ascii=False, indent=0)

        dom = collections.Counter(q["domain"] for q in qs)
        dd = collections.Counter((q["domain"], q.get("difficulty", "")) for q in qs)
        lab = collections.Counter(q["correct_label"] for q in qs)
        self.stdout.write(self.style.SUCCESS(
            f"Merged: base {before} + added {added} -> {len(qs)} questions, {len(seed_cases)} cases"))
        self.stdout.write(f"  by domain: {dict(dom)}")
        self.stdout.write(f"  answer distribution: {dict(lab)}")
        for k in sorted(dd):
            self.stdout.write(f"    {k[0]} {k[1]}: {dd[k]}")
        self.stdout.write(self.style.SUCCESS(f"Wrote {opts['out']} (version={opts['seed_version']})"))
