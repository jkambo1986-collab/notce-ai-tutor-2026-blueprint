"""
API views for the AI voice-driven feature suite (built on the existing TTS/STT
infrastructure and the Encounter scored-conversation pattern):

  * Teach-It-Back   — /api/teachback/{start,message,finish}/
  * SBAR Handover   — /api/handover/{start,message,finish}/
  * Daily Briefing  — /api/briefing/            (personalized spoken digest)
  * Commute Drills  — /api/drill/next/          (one vetted question + answer)

The conversational features persist state on MockStudySession (mode-tagged, so
they're excluded from SRS/analytics like Encounter is). All AI calls degrade to a
503 with a friendly message rather than a 500.
"""
import random

from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsPaidOrTrialUser
from .models import MockStudySession, BankQuestion


# --- Shared helper for the start/message/finish conversation pattern ---------

class _ConversationStart(APIView):
    """Start a scored AI conversation. Subclasses set `mode`, `generate` (profile
    factory), and `persona_keys` (fields echoed back to the client)."""
    permission_classes = [IsPaidOrTrialUser]
    mode = None
    persona_keys = ()

    def generate(self, request):
        raise NotImplementedError

    def post(self, request):
        profile = self.generate(request)
        if not profile:
            return Response({"error": "Couldn't start right now. Please try again."}, status=503)
        opening = profile.get("opening_line", "Hi.")
        MockStudySession.objects.filter(user=request.user, mode=self.mode, is_active=True).update(is_active=False)
        # First speaker is the AI counterpart ("student"/"colleague" by feature).
        session = MockStudySession.objects.create(
            user=request.user, domain="MIXED", difficulty=self.mode.title(),
            total_questions=0, current_question=0, mode=self.mode, is_active=True,
            current_question_data=profile,
            session_history=[{"role": self.first_speaker, "text": opening}],
        )
        persona = {k: profile.get(k) for k in self.persona_keys}
        return Response({"session_id": session.id, "persona": persona, "opening_line": opening}, status=201)


class _ConversationMessage(APIView):
    """Send the user's turn; return the AI counterpart's reply."""
    permission_classes = [IsPaidOrTrialUser]
    mode = None

    def reply_fn(self, profile, transcript, message):
        raise NotImplementedError

    def post(self, request):
        message = (request.data.get("message") or "").strip()
        if not message:
            return Response({"error": "Message required"}, status=400)
        try:
            session = MockStudySession.objects.get(
                id=request.data.get("session_id"), user=request.user, mode=self.mode, is_active=True)
        except MockStudySession.DoesNotExist:
            return Response({"error": "Session not found"}, status=404)
        profile = session.current_question_data or {}
        transcript = session.session_history or []
        reply = self.reply_fn(profile, transcript, message)
        if reply is None:
            return Response({"error": "No response — please try again."}, status=503)
        transcript.append({"role": self.user_role, "text": message})
        transcript.append({"role": self.first_speaker, "text": reply})
        session.session_history = transcript
        session.save()
        return Response({"reply": reply})


class _ConversationFinish(APIView):
    """End the conversation and score it."""
    permission_classes = [IsPaidOrTrialUser]
    mode = None

    def score_fn(self, profile, transcript):
        raise NotImplementedError

    def post(self, request):
        try:
            session = MockStudySession.objects.get(
                id=request.data.get("session_id"), user=request.user, mode=self.mode)
        except MockStudySession.DoesNotExist:
            return Response({"error": "Session not found"}, status=404)
        profile = session.current_question_data or {}
        transcript = session.session_history or []
        result = self.score_fn(profile, transcript)
        if session.is_active:
            session.is_active = False
            session.completed_at = timezone.now()
            session.save()
        if result is None:
            return Response({"error": "Scoring is unavailable right now. Please try again."}, status=503)
        return Response({"result": result})


# --- Feature 2: Teach-It-Back ------------------------------------------------

class TeachbackStartView(_ConversationStart):
    mode = "teachback"
    first_speaker = "student"
    persona_keys = ("concept", "blueprint_domain")

    def generate(self, request):
        from .teachback_service import generate_topic
        return generate_topic(request.data.get("domain"))


class TeachbackMessageView(_ConversationMessage):
    mode = "teachback"
    first_speaker = "student"
    user_role = "teacher"

    def reply_fn(self, profile, transcript, message):
        from .teachback_service import student_reply
        return student_reply(profile, transcript, message)


class TeachbackFinishView(_ConversationFinish):
    mode = "teachback"

    def score_fn(self, profile, transcript):
        from .teachback_service import score_teachback
        return score_teachback(profile, transcript)


# --- Feature 4: SBAR Handover ------------------------------------------------

class HandoverStartView(_ConversationStart):
    mode = "handover"
    first_speaker = "colleague"
    persona_keys = ("title", "setting", "brief", "colleague_name")

    def generate(self, request):
        from .handover_service import generate_case
        return generate_case(request.data.get("domain"))


class HandoverMessageView(_ConversationMessage):
    mode = "handover"
    first_speaker = "colleague"
    user_role = "ot"

    def reply_fn(self, profile, transcript, message):
        from .handover_service import colleague_reply
        return colleague_reply(profile, transcript, message)


class HandoverFinishView(_ConversationFinish):
    mode = "handover"

    def score_fn(self, profile, transcript):
        from .handover_service import score_handover
        return score_handover(profile, transcript)


# --- Feature 3: Daily Audio Briefing -----------------------------------------

class DailyBriefingView(APIView):
    """Personalized spoken-word daily digest (read aloud client-side via /tts/)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .briefing_service import build_briefing
        try:
            return Response(build_briefing(request.user))
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Briefing build failed")
            return Response({"error": "Couldn't build your briefing right now."}, status=500)


# --- Feature 1: Commute Drills (question source) -----------------------------

class DrillNextView(APIView):
    """Return one vetted bank question with its answer + rationale, for the
    eyes-free voice drill. Body/query: domain?, difficulty?, exclude?[]."""
    permission_classes = [IsPaidOrTrialUser]

    def post(self, request):
        return self._serve(request)

    def get(self, request):
        return self._serve(request)

    def _serve(self, request):
        data = request.data if request.method == "POST" else request.query_params
        domain = data.get("domain")
        difficulty = data.get("difficulty")
        exclude = request.data.get("exclude") if request.method == "POST" else None
        exclude = exclude or []

        qs = BankQuestion.objects.filter(status="approved")
        if domain:
            qs = qs.filter(domain=domain)
        if difficulty:
            qs = qs.filter(difficulty=difficulty)
        ids = list(qs.exclude(id__in=exclude).values_list("id", flat=True))
        if not ids:  # exhausted the filtered pool — allow repeats rather than dead-end
            ids = list(qs.values_list("id", flat=True))
        if not ids:
            return Response({"error": "No questions available."}, status=503)

        q = BankQuestion.objects.prefetch_related("distractors").get(id=random.choice(ids))
        distractors = list(q.distractors.all())
        correct_text = next((d.text for d in distractors if d.label.upper() == (q.correct_label or "").upper()), "")
        return Response({
            "bank_id": q.id,
            "domain": q.domain,
            "stem": q.stem,
            "options": [{"label": d.label, "text": d.text} for d in distractors],
            "correct_label": q.correct_label,
            "correct_text": correct_text,
            "rationale": q.correct_rationale,
        })
