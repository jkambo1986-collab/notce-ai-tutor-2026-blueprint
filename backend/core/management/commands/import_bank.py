"""
Idempotent importer for the premium question bank.

Loads a vetted `bank_seed.json` artifact (produced by the mint->solve->audit
pipeline) into the database. Safe to re-run: upserts by deterministic id, so
the same file applied twice creates nothing new. Designed to run identically
in local dev and production (e.g. `railway run python manage.py import_bank ...`).

Only items with status == 'approved' are written unless --include-nonapproved
is passed. The whole import runs in a single transaction and rolls back on error.

Seed file schema:
{
  "version": "2026.1",
  "cases": [
    {"id", "title", "vignette", "setting", "domain", "tags"?, "provenance"?,
     <descriptors>?}
  ],
  "questions": [
    {"id", "domain", "difficulty", "format", "case_id"?, "stem",
     "correct_label", "correct_rationale", "topic"?, "cognitive_level"?,
     "status", "provenance"?, <descriptors>?,
     "options": [{"label", "text", "incorrect_rationale"?}, ...]}
  ]
}

<descriptors> (NOTCE 2026 Blueprint "other codes/descriptors", all optional):
  "client_type", "practice_setting", "age_group", "pronouns",
  "representation", "diagnosis_category"
Carry these on a case (case-based questions inherit them) or directly on a
standalone question. cognitive_level is one of: knowledge | application | critical_thinking.
"""
import json

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import BankCase, BankQuestion, BankDistractor

# NOTCE 2026 Blueprint scenario descriptor keys (see core.models.BlueprintDescriptors).
DESCRIPTOR_FIELDS = (
    'client_type', 'practice_setting', 'age_group',
    'pronouns', 'representation', 'diagnosis_category',
)


def _descriptors(src):
    """Pull the optional Blueprint descriptor fields out of a seed dict."""
    return {f: src[f] for f in DESCRIPTOR_FIELDS if src.get(f)}


class Command(BaseCommand):
    help = "Idempotently import a vetted premium question bank from a JSON seed file."

    def add_arguments(self, parser):
        parser.add_argument('seed_file', type=str, help='Path to bank_seed.json')
        parser.add_argument('--dry-run', action='store_true',
                            help='Report what would change without writing.')
        parser.add_argument('--include-nonapproved', action='store_true',
                            help='Also import items whose status is not "approved".')

    def handle(self, *args, **opts):
        path = opts['seed_file']
        dry = opts['dry_run']
        include_nonapproved = opts['include_nonapproved']

        try:
            with open(path, 'r', encoding='utf-8') as fh:
                data = json.load(fh)
        except FileNotFoundError:
            raise CommandError(f"Seed file not found: {path}")
        except json.JSONDecodeError as e:
            raise CommandError(f"Seed file is not valid JSON: {e}")

        cases = data.get('cases', [])
        questions = data.get('questions', [])

        stats = {'cases_created': 0, 'cases_updated': 0,
                 'q_created': 0, 'q_updated': 0, 'q_skipped': 0}

        try:
            with transaction.atomic():
                # --- Cases first (questions may FK to them) ---
                for c in cases:
                    obj, created = BankCase.objects.update_or_create(
                        id=c['id'],
                        defaults={
                            'title': c['title'][:255],
                            'vignette': c['vignette'],
                            'setting': c.get('setting', '')[:120],
                            'domain': c['domain'],
                            'tags': c.get('tags', []),
                            'provenance': c.get('provenance', {}),
                            **_descriptors(c),
                        },
                    )
                    stats['cases_created' if created else 'cases_updated'] += 1

                # --- Questions + distractors ---
                for q in questions:
                    status = q.get('status', 'draft')
                    if status != 'approved' and not include_nonapproved:
                        stats['q_skipped'] += 1
                        continue

                    obj, created = BankQuestion.objects.update_or_create(
                        id=q['id'],
                        defaults={
                            'domain': q['domain'],
                            'difficulty': q['difficulty'],
                            'format': q.get('format', 'standalone'),
                            'case_id': q.get('case_id'),
                            'stem': q['stem'],
                            'correct_label': q['correct_label'].upper()[:1],
                            'correct_rationale': q['correct_rationale'],
                            'explain_differently': q.get('explain_differently', ''),
                            'core_concept': q.get('core_concept', ''),
                            'topic': (q.get('topic', '') or '')[:160],
                            'cognitive_level': q.get('cognitive_level', 'application'),
                            'status': status,
                            'provenance': q.get('provenance', {}),
                            **_descriptors(q),
                        },
                    )
                    stats['q_created' if created else 'q_updated'] += 1

                    # Replace distractors wholesale so re-import stays consistent.
                    obj.distractors.all().delete()
                    BankDistractor.objects.bulk_create([
                        BankDistractor(
                            bank_question=obj,
                            label=o['label'].upper()[:1],
                            text=o['text'][:600],
                            incorrect_rationale=o.get('incorrect_rationale'),
                        )
                        for o in q.get('options', [])
                    ])

                if dry:
                    self.stdout.write(self.style.WARNING("DRY RUN — rolling back, nothing written."))
                    raise _Rollback()
        except _Rollback:
            pass

        self.stdout.write(self.style.SUCCESS(
            "Import {}: cases +{}/~{}, questions +{}/~{}, skipped(non-approved) {}".format(
                'previewed' if dry else 'complete',
                stats['cases_created'], stats['cases_updated'],
                stats['q_created'], stats['q_updated'], stats['q_skipped'],
            )
        ))


class _Rollback(Exception):
    """Internal sentinel to roll back a dry-run transaction."""
    pass
