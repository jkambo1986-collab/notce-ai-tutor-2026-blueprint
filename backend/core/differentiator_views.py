"""
API views for the four AI-differentiator features, kept in their own module so
the large core/views.py stays untouched:

  * ErrorAnalysisView     — cognitive-error / test-taking-trap analysis (read-only)
  * ReasoningCoachView    — AI grading of free-text clinical reasoning
  * CAT (adaptive)        — start/answer for the scaled-score readiness assessment
  * Encounter (OSCE)      — start/message/finish for the simulated client encounter

All are self-scoped to the authenticated user (cookie-JWT auth applies globally).
"""
import logging

from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsPaidOrTrialUser

logger = logging.getLogger(__name__)


class ErrorAnalysisView(APIView):
    """
    Cognitive-error / test-taking-trap insights for the signed-in user, computed
    live from their wrong-answer history. Read-only, deterministic.
    See `error_analysis_service.analyze_errors`.
    """
    # Premium, to match the other "Advanced AI Practice" cards on the dashboard.
    permission_classes = [IsPaidOrTrialUser]

    def get(self, request):
        from .error_analysis_service import analyze_errors
        try:
            return Response(analyze_errors(request.user))
        except Exception:
            logger.exception("Failed to analyze errors for %s", request.user)
            return Response({"error": "Failed to analyze errors"}, status=500)


# --- Feature 2: Clinical Reasoning Coach -------------------------------------

class ReasoningCoachView(APIView):
    """
    GET  -> a case scenario + reasoning prompt to respond to.
    POST -> grades the candidate's free-text reasoning (Gemini) vs the COTC rubric.
    Premium (paid or trial). See `reasoning_service`.
    """
    permission_classes = [IsPaidOrTrialUser]
    PROMPT = ("What is your FIRST priority for this client, and what is your clinical "
              "reasoning? Outline how you'd gather information, address safety, centre "
              "the client's occupations, and sequence your next steps.")

    def get(self, request):
        from .models import BankCase, CaseStudy
        bc = BankCase.objects.order_by('?').first()
        if bc:
            return Response({"case_id": bc.id, "title": bc.title, "vignette": bc.vignette, "prompt": self.PROMPT})
        cs = CaseStudy.objects.order_by('?').first()
        if not cs:
            return Response({"error": "No case scenarios available yet."}, status=404)
        return Response({"case_id": cs.id, "title": cs.title, "vignette": cs.vignette, "prompt": self.PROMPT})

    def post(self, request):
        from .reasoning_service import evaluate_reasoning
        vignette = (request.data.get("vignette") or "").strip()
        prompt = (request.data.get("prompt") or self.PROMPT).strip()
        text = (request.data.get("response") or "").strip()
        if len(text) < 15:
            return Response({"error": "Please write a fuller reasoning response (a few sentences)."}, status=400)
        if not vignette:
            return Response({"error": "Missing case context."}, status=400)
        result = evaluate_reasoning(vignette, prompt, text)
        if result is None:
            return Response({"error": "AI evaluation is unavailable right now. Please try again."}, status=503)
        return Response(result)


# --- Feature 3: Computer-Adaptive (CAT) readiness assessment ------------------

class CatStartView(APIView):
    """Start an adaptive readiness assessment (no per-item feedback)."""
    permission_classes = [IsPaidOrTrialUser]
    DEFAULT_LENGTH = 20

    def post(self, request):
        from .models import MockStudySession, AgentMemory
        from .cat_service import select_item, item_payload, client_item

        try:
            length = max(5, min(40, int(request.data.get("length") or self.DEFAULT_LENGTH)))
        except (TypeError, ValueError):
            length = self.DEFAULT_LENGTH

        theta = 0.0
        mem = AgentMemory.objects.filter(user=request.user, key="cat_theta").first()
        if mem and isinstance(mem.value, dict):
            try:
                theta = float(mem.value.get("theta", 0.0))
            except (TypeError, ValueError):
                theta = 0.0

        bq = select_item(theta, [])
        if not bq:
            return Response({"error": "No questions are available for an assessment yet."}, status=404)
        item = item_payload(bq)
        # Retire any abandoned adaptive session so they don't pile up active.
        MockStudySession.objects.filter(user=request.user, mode="adaptive", is_active=True).update(is_active=False)
        session = MockStudySession.objects.create(
            user=request.user, domain="MIXED", difficulty="Adaptive",
            total_questions=length, current_question=1, mode="adaptive", is_active=True,
            current_question_data=item,
            exam_config={"theta": theta, "theta_by_domain": {}, "served": [item["bank_id"]]},
        )
        return Response({
            "session_id": session.id,
            "question": client_item(item, 1, length),
            "ability": round(theta, 2),
        }, status=201)


class CatAnswerView(APIView):
    """Submit an adaptive answer; returns the next item or the final readiness."""
    permission_classes = [IsPaidOrTrialUser]

    def _finalize(self, session, theta, tbd, cfg):
        from .models import AgentMemory
        from .cat_service import readiness
        session.is_active = False
        session.completed_at = timezone.now()
        cfg["theta"] = theta
        cfg["theta_by_domain"] = tbd
        session.exam_config = cfg
        session.save()
        AgentMemory.objects.update_or_create(
            user=session.user, key="cat_theta",
            defaults={"value": {"theta": theta, "by_domain": tbd}, "category": "adaptive"},
        )
        score, band = readiness(theta)
        by_domain = [{"domain": d, "ability": round(v, 2), "score": readiness(v)[0]} for d, v in tbd.items()]
        return Response({
            "is_complete": True,
            "result": {
                "readiness": score, "band": band, "ability": round(theta, 2),
                "correct": session.correct_count, "total": session.total_questions,
                "by_domain": by_domain,
            },
        })

    def post(self, request):
        from .models import MockStudySession
        from .cat_service import update_theta, select_item, item_payload, client_item

        try:
            session = MockStudySession.objects.get(
                id=request.data.get("session_id"), user=request.user, mode="adaptive", is_active=True)
        except MockStudySession.DoesNotExist:
            return Response({"error": "Assessment session not found"}, status=404)

        item = session.current_question_data or {}
        cfg = session.exam_config or {}
        theta = float(cfg.get("theta", 0.0))
        b = float(item.get("b", 0.0))
        label = request.data.get("label")
        correct = bool(label) and str(label).upper() == str(item.get("correct_label", "")).upper()
        if correct:
            session.correct_count += 1
        theta = update_theta(theta, b, correct)

        tbd = cfg.get("theta_by_domain", {})
        dom = item.get("domain")
        if dom:
            tbd[dom] = update_theta(float(tbd.get(dom, 0.0)), b, correct)

        history = session.session_history or []
        history.append({
            "question_number": session.current_question, "stem": item.get("stem"),
            "selected_label": label, "correct_label": item.get("correct_label"),
            "is_correct": correct, "bank_id": item.get("bank_id"),
            "domain": dom or session.domain, "timestamp": timezone.now().isoformat(),
        })
        session.session_history = history
        served = cfg.get("served", [])

        if session.current_question >= session.total_questions:
            return self._finalize(session, theta, tbd, cfg)

        bq = select_item(theta, served)
        if not bq:  # ran out of bank items — finalize early
            return self._finalize(session, theta, tbd, cfg)
        nxt = item_payload(bq)
        served.append(nxt["bank_id"])
        session.current_question += 1
        session.current_question_data = nxt
        cfg["theta"] = theta
        cfg["theta_by_domain"] = tbd
        cfg["served"] = served
        session.exam_config = cfg
        session.save()
        return Response({
            "is_complete": False,
            "question": client_item(nxt, session.current_question, session.total_questions),
            "ability": round(theta, 2),
        })


# --- Feature 4: OSCE simulated client encounter ------------------------------

class EncounterStartView(APIView):
    """Begin a simulated client interview (Gemini role-plays the client)."""
    permission_classes = [IsPaidOrTrialUser]

    def post(self, request):
        from .models import MockStudySession
        from .encounter_service import generate_profile
        profile = generate_profile()
        if not profile:
            return Response({"error": "Couldn't start an encounter right now. Please try again."}, status=503)
        opening = profile.get("opening_line", "Hello.")
        # Retire any abandoned encounter so they don't pile up active.
        MockStudySession.objects.filter(user=request.user, mode="encounter", is_active=True).update(is_active=False)
        session = MockStudySession.objects.create(
            user=request.user, domain="MIXED", difficulty="Encounter",
            total_questions=0, current_question=0, mode="encounter", is_active=True,
            current_question_data=profile,
            session_history=[{"role": "client", "text": opening}],
        )
        persona = {k: profile.get(k) for k in ("name", "age", "pronouns", "setting", "presenting")}
        return Response({"session_id": session.id, "persona": persona, "opening_line": opening}, status=201)


class EncounterMessageView(APIView):
    """Send the OT's turn; returns the client's in-character reply."""
    permission_classes = [IsPaidOrTrialUser]

    def post(self, request):
        from .models import MockStudySession
        from .encounter_service import client_reply
        message = (request.data.get("message") or "").strip()
        if not message:
            return Response({"error": "Message required"}, status=400)
        try:
            session = MockStudySession.objects.get(
                id=request.data.get("session_id"), user=request.user, mode="encounter", is_active=True)
        except MockStudySession.DoesNotExist:
            return Response({"error": "Encounter not found"}, status=404)
        profile = session.current_question_data or {}
        transcript = session.session_history or []
        # client_reply appends the new OT line itself, so pass the PRIOR transcript
        # (avoids duplicating the message in the prompt). Persist only on success,
        # so a failed turn doesn't leave an orphaned OT line in the history.
        reply = client_reply(profile, transcript, message)
        if reply is None:
            return Response({"error": "The client didn't respond. Please try again."}, status=503)
        transcript.append({"role": "ot", "text": message})
        transcript.append({"role": "client", "text": reply})
        session.session_history = transcript
        session.save()
        return Response({"reply": reply})


class EncounterFinishView(APIView):
    """End the interview and score it against COTC competencies."""
    permission_classes = [IsPaidOrTrialUser]

    def post(self, request):
        from .models import MockStudySession
        from .encounter_service import score_encounter
        try:
            session = MockStudySession.objects.get(
                id=request.data.get("session_id"), user=request.user, mode="encounter")
        except MockStudySession.DoesNotExist:
            return Response({"error": "Encounter not found"}, status=404)
        profile = session.current_question_data or {}
        transcript = session.session_history or []
        result = score_encounter(profile, transcript)
        if session.is_active:
            session.is_active = False
            session.completed_at = timezone.now()
            session.save()
        if result is None:
            return Response({"error": "Scoring is unavailable right now. Please try again."}, status=503)
        return Response({"result": result})
