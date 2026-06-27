"""
Tests for Mock Study resume self-heal: a stale/empty practice session must not
hand back a blank question — get_active serves a fresh vetted bank question and
persists it instead.
"""
from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from .models import UserProfile, MockStudySession, BankQuestion, BankDistractor


class ResumeSelfHealTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="resumer", email="r@e.com", password="pw12345!")
        UserProfile.objects.update_or_create(user=self.user, defaults={"is_paid": True})
        q = BankQuestion.objects.create(
            id="bq-resume-1", domain="OT_EXP", difficulty="Medium", format="standalone",
            stem="A client recovering from a stroke struggles with dressing. Best initial OT step?",
            correct_label="A", correct_rationale="A is correct.", status="approved",
        )
        for label, text in [("A", "Opt A"), ("B", "Opt B"), ("C", "Opt C"), ("D", "Opt D")]:
            BankDistractor.objects.create(bank_question=q, label=label, text=text)
        self.client.force_authenticate(self.user)

    def _get_active(self):
        resp = self.client.get("/api/mock-study/get_active/")
        if resp.status_code == 404:
            resp = self.client.get("/api/mock-study/get-active/")
        return resp

    def test_empty_practice_session_is_healed(self):
        MockStudySession.objects.create(
            user=self.user, domain="MIXED", difficulty="Medium", total_questions=5,
            current_question=1, mode="practice", is_active=True, current_question_data={})
        resp = self._get_active()
        self.assertEqual(resp.status_code, 200)
        q = resp.data["question"]
        self.assertTrue(q["stem"])              # no longer blank
        self.assertEqual(len(q["options"]), 4)
        # …and it's persisted so subsequent loads stay healthy.
        s = MockStudySession.objects.get(user=self.user, is_active=True)
        self.assertTrue((s.current_question_data or {}).get("stem"))

    def test_valid_session_is_untouched(self):
        good = {"stem": "Existing question", "options": [{"label": "A", "text": "x"}], "source": "bank"}
        MockStudySession.objects.create(
            user=self.user, domain="MIXED", difficulty="Medium", total_questions=5,
            current_question=1, mode="practice", is_active=True, current_question_data=good)
        resp = self._get_active()
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["question"]["stem"], "Existing question")
