"""
Tests for the AI voice-driven feature suite endpoints that don't require a live
model (the drill question source and the daily briefing). The conversational
features (teachback/handover) mirror the Encounter pattern and rely on Gemini, so
they're exercised in integration rather than unit-tested here.
"""
from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from .models import UserProfile, BankQuestion, BankDistractor


def make_user(username, *, paid=False):
    u = User.objects.create_user(username=username, email=f"{username}@example.com", password="pw12345!")
    UserProfile.objects.update_or_create(user=u, defaults={"is_paid": paid})
    return u


class DrillNextTests(APITestCase):
    def setUp(self):
        self.q = BankQuestion.objects.create(
            id="bq-drill-1", domain="OT_EXP", difficulty="Medium", format="standalone",
            stem="Which assessment best captures functional ADL performance?",
            correct_label="B", correct_rationale="B is correct because it measures performance.",
            status="approved",
        )
        for label, text in [("A", "Option A"), ("B", "Option B (correct)"), ("C", "Option C"), ("D", "Option D")]:
            BankDistractor.objects.create(bank_question=self.q, label=label, text=text)

    def test_paid_user_gets_a_drill_question_with_answer(self):
        self.client.force_authenticate(make_user("drill_paid", paid=True))
        resp = self.client.post("/api/drill/next/", {}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["stem"], self.q.stem)
        self.assertEqual(len(resp.data["options"]), 4)
        self.assertEqual(resp.data["correct_label"], "B")
        self.assertIn("correct because", resp.data["rationale"])

    def test_free_user_is_gated(self):
        self.client.force_authenticate(make_user("drill_free", paid=False))
        resp = self.client.post("/api/drill/next/", {}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_no_questions_returns_503(self):
        BankQuestion.objects.all().delete()
        self.client.force_authenticate(make_user("drill_empty", paid=True))
        resp = self.client.post("/api/drill/next/", {}, format="json")
        self.assertEqual(resp.status_code, 503)


class BriefingTests(APITestCase):
    def test_new_user_gets_a_briefing(self):
        self.client.force_authenticate(make_user("brief_user", paid=True))
        resp = self.client.get("/api/briefing/")
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(len(resp.data["segments"]), 1)
        # Each segment has a title + spoken text.
        for seg in resp.data["segments"]:
            self.assertTrue(seg["title"])
            self.assertTrue(seg["text"])
        self.assertIn("summary", resp.data)

    def test_briefing_requires_auth(self):
        resp = self.client.get("/api/briefing/")
        self.assertIn(resp.status_code, (401, 403))
