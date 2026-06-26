"""
Django REST Framework views for the NOTCE AI Tutor backend.

This module exposes the HTTP API surface for the application, including:

- Health / diagnostics: ``PingView``, ``DiagnosticView``, ``TestEmailView``.
- Authentication & accounts: ``EmailOrUsernameTokenObtainPairView`` (JWT login
  by username *or* email), ``RegisterView``, ``MeView``, ``VerifyEmailView``.
- Study/practice domain: ``UserSessionViewSet``, ``CaseStudyViewSet`` (with AI
  case generation via Gemini), ``UserAnswerViewSet``, ``HighlightViewSet``,
  ``MockStudyViewSet`` (the one-question-at-a-time practice/exam flow),
  ``AgentMemoryViewSet``.
- Vetted question bank (premium, paid-only): ``BankQuestionViewSet``,
  ``BankCaseViewSet``.
- Billing: ``CreateCheckoutSessionView``, ``StripeWebhookView``, ``SyncPaymentView``.

Permission notes: most endpoints require authentication; AI generation and the
question bank additionally require a paid (or trial) subscription. Several
endpoints were deliberately tightened (e.g. admin-only diagnostics) and the
email-verification flow is intentionally disabled but kept in place for an easy
re-enable. See inline comments for the "why" behind these decisions.
"""

from rest_framework import viewsets, status, permissions, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from .models import CaseStudy, Question, UserAnswer, Highlight, DomainTag, UserSession
from .serializers import CaseStudySerializer, UserAnswerSerializer, HighlightSerializer, UserSessionSerializer, UserSerializer
from .mock_study_service import generate_practice_question, generate_answer_feedback, generate_pivot_scenario, serve_bank_question
import logging
import uuid
import traceback
import os
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from .models import UserProfile
from .permissions import IsPaidUser, IsPaidOrTrialUser
from .entitlements import active_org_for

logger = logging.getLogger(__name__)

class PingView(APIView):
    """Simple liveness probe.

    GET /ping/ -> ``{"status": "pong"}``. Public (no auth) so load balancers and
    uptime monitors can confirm the service is responding.
    """
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        return Response({"status": "pong"})

class DiagnosticView(APIView):
    """Admin-only configuration dump for troubleshooting prod.

    GET /diagnostic/ -> non-secret view of email/Stripe/frontend settings, with
    credentials obfuscated. Admin-only because it exposes config; never public.
    """
    permission_classes = [permissions.IsAdminUser]  # Exposes config; admin-only

    def get(self, request):
        # Mask secrets so they can be eyeballed (first/last 2 chars) without
        # leaking the full value in the response body or logs.
        def obfuscate(val):
            if not val: return None
            if len(str(val)) < 4: return "***"
            return str(val)[:2] + "..." + str(val)[-2:]

        diag_data = {
            "EMAIL_HOST": settings.EMAIL_HOST,
            "EMAIL_PORT": settings.EMAIL_PORT,
            "EMAIL_USE_TLS": settings.EMAIL_USE_TLS,
            "EMAIL_HOST_USER": obfuscate(settings.EMAIL_HOST_USER),
            "EMAIL_HOST_PASSWORD": obfuscate(settings.EMAIL_HOST_PASSWORD),
            "DEFAULT_FROM_EMAIL": settings.DEFAULT_FROM_EMAIL,
            "FRONTEND_URL": settings.FRONTEND_URL,
            "DEBUG": settings.DEBUG,
            "STRIPE_PUBLIC_KEY": obfuscate(settings.STRIPE_PUBLIC_KEY),
            "DATABASE_URL_SET": bool(os.environ.get('DATABASE_URL')),
        }
        return Response(diag_data)

class TestEmailView(APIView):
    """Admin-only SMTP smoke test.

    GET /test-email/?email=someone@example.com sends a diagnostic message to the
    given recipient (defaults to DEFAULT_FROM_EMAIL) and reports success/failure
    plus the (masked) email config. Used to verify production SMTP works.
    """
    # Admin-only: AllowAny here was an open mail relay (sends to any ?email=)
    # and leaked SMTP config / tracebacks.
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        import socket
        from django.core.mail import get_connection

        test_recipient = request.query_params.get('email', settings.DEFAULT_FROM_EMAIL)
        
        # Get config info for response
        config_info = {
            "EMAIL_HOST": settings.EMAIL_HOST,
            "EMAIL_PORT": settings.EMAIL_PORT,
            "EMAIL_USE_TLS": settings.EMAIL_USE_TLS,
            "EMAIL_HOST_USER": settings.EMAIL_HOST_USER[:4] + "..." if settings.EMAIL_HOST_USER else None,
            "DEFAULT_FROM_EMAIL": settings.DEFAULT_FROM_EMAIL,
        }
        
        try:
            # Set a socket timeout to prevent hanging
            # A blocked/slow SMTP port would otherwise hang the request worker
            # indefinitely; bound it and always restore the previous default.
            old_timeout = socket.getdefaulttimeout()
            socket.setdefaulttimeout(10)  # 10 second timeout

            try:
                send_mail(
                    subject="Diagnostic: NOTCE AI Tutor Email Test",
                    message="If you are reading this, your production SMTP settings are working correctly.",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[test_recipient],
                    fail_silently=False,
                )
            finally:
                socket.setdefaulttimeout(old_timeout)
                
            return Response({
                "success": True, 
                "message": f"Test email sent to {test_recipient}",
                "config": config_info
            })
        except Exception as e:
            # Report the failure as HTTP 200 with details so the admin tool can
            # render the diagnostic info instead of choking on an error status.
            # Full traceback only leaks when DEBUG is on.
            logger.error(f"SMTP Diagnostic Failure: {str(e)}")
            return Response({
                "success": False,
                "error": str(e),
                "error_type": type(e).__name__,
                "config": config_info,
                "traceback": traceback.format_exc() if settings.DEBUG else "Set DEBUG=True for full traceback"
            }, status=status.HTTP_200_OK)


from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class EmailOrUsernameTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Allows logging in with either a username or an email address. SimpleJWT
    authenticates by username only, so if the supplied identifier looks like an
    email we resolve it to the matching account's username first. This prevents
    the common "I entered my email and got 401" login failure.
    """
    def validate(self, attrs):
        login = (attrs.get(self.username_field) or "").strip()
        # If the identifier looks like an email, swap it for the matching
        # account's username before SimpleJWT does its username-only auth.
        # order_by("id").first() picks the oldest account on duplicate emails.
        if login and "@" in login:
            match = User.objects.filter(email__iexact=login).order_by("id").first()
            if match:
                attrs[self.username_field] = match.username
        return super().validate(attrs)


class EmailOrUsernameTokenObtainPairView(TokenObtainPairView):
    """JWT login endpoint (POST) accepting username *or* email as the identifier.

    Returns access/refresh tokens. Public so unauthenticated users can log in;
    the email->username resolution lives in the serializer above.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = EmailOrUsernameTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    """User signup endpoint.

    POST /register/ with the fields ``UserSerializer`` expects (username, email,
    password, ...). Creates the ``User`` and an associated ``UserProfile``,
    starts the free trial, and (currently) auto-verifies the email. Public.
    """
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = UserSerializer

    def perform_create(self, serializer):
        """Create the user, attach a profile, start the trial, auto-verify.

        Everything after the ``return`` below is the (intentionally disabled)
        email-verification path and is never executed in the current flow.
        """
        user = serializer.save()
        profile, created = UserProfile.objects.get_or_create(user=user)
        profile.trial_start_date = timezone.now()
        # Email verification flow is disabled for now: auto-verify on signup and
        # skip sending the (currently unavailable) verification email so users
        # can log in immediately. Re-enable by restoring the email send below.
        profile.email_verified = True
        profile.verification_token = None
        profile.save()
        return

        # --- Verification email (disabled) ---
        # NOTE: The block below is intentionally disabled (it sits after the
        # early ``return`` above) and is kept here so the email-verification
        # flow can be re-enabled by removing that return. Do not delete.
        token = str(uuid.uuid4())
        profile.verification_token = token
        profile.email_verified = False
        profile.save()
        verify_link = f"{settings.FRONTEND_URL}/verify?token={token}"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                .button {{
                    background-color: #0d9488;
                    border: none;
                    color: white !important;
                    padding: 12px 24px;
                    text-align: center;
                    text-decoration: none;
                    display: inline-block;
                    font-size: 16px;
                    margin: 4px 2px;
                    cursor: pointer;
                    border-radius: 12px;
                    font-weight: bold;
                }}
            </style>
        </head>
        <body style="font-family: 'Inter', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #134e4a 0%, #0d9488 100%); padding: 40px; border-radius: 24px; color: white; text-align: center; margin-bottom: 30px;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.025em;">NOTCE AI Tutor</h1>
                <p style="opacity: 0.9; margin-top: 10px;">Master your O.T. journey.</p>
            </div>
            
            <h2 style="font-size: 24px; font-weight: 800; color: #111; margin-bottom: 16px;">Welcome to the future of Prep, {user.username}!</h2>
            
            <p style="font-size: 16px; color: #444; margin-bottom: 24px;">
                You're one step away from unlocking personalized AI tutoring designed specifically for the NOTCE. Click the button below to verify your email and get started with your 7-day free trial.
            </p>
            
            <div style="text-align: center; margin: 40px 0;">
                <a href="{verify_link}" class="button">Verify My Account</a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="{verify_link}" style="color: #0d9488;">{verify_link}</a>
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
                If you did not sign up for NOTCE AI Tutor, please ignore this email.
            </p>
        </body>
        </html>
        """
        
        try:
            import socket
            old_timeout = socket.getdefaulttimeout()
            socket.setdefaulttimeout(5)  # 5 second timeout for registration emails
            try:
                send_mail(
                    subject="Verify your NOTCE AI Tutor Account",
                    message=f"Welcome {user.username}! Please verify your account at: {verify_link}",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                    html_message=html_content
                )
                logger.info(f"Verification email sent to {user.email}")
            finally:
                socket.setdefaulttimeout(old_timeout)
        except Exception as e:
            logger.error(f"Failed to send verification email to {user.email}: {str(e)}")
            # Don't block registration if email fails - user is still created


class MeView(APIView):
    """Returns the currently authenticated user's profile.

    GET /me/ -> serialized ``request.user`` (via ``UserSerializer``). Used by the
    frontend to hydrate session/account state. Requires authentication.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

class VerifyEmailView(APIView):
    """Confirms a user's email from a verification token.

    POST /verify-email/ with ``{"token": "..."}``. Marks the matching profile as
    verified and clears the token. Public (the user is not yet logged in). This
    backs the disabled RegisterView email flow; safe to keep for re-enable.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get('token')
        if not token:
            return Response({'error': 'Token required'}, status=400)
        
        try:
            profile = UserProfile.objects.get(verification_token=token)
            profile.email_verified = True
            profile.verification_token = None # Clear token after use (optional, or keep for record)
            profile.save()
            return Response({'status': 'verified', 'username': profile.user.username})
        except UserProfile.DoesNotExist:
            return Response({'error': 'Invalid token'}, status=400)

class UserSessionViewSet(viewsets.ModelViewSet):
    """Tracks per-user progress through curated case studies.

    Standard CRUD under /sessions/ plus ``save_progress`` and ``resume`` custom
    actions. All access is scoped to the requesting user. Requires authentication.
    """
    queryset = UserSession.objects.all()
    serializer_class = UserSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Scope every list/detail operation to the caller's own sessions.
        return UserSession.objects.filter(user=self.request.user)

    @action(detail=False, methods=['post'])
    def save_progress(self, request):
        """
        Saves the current question index for a specific case.
        Expects: { "case_study_id": "case-1", "current_index": 2 }
        """
        case_id = request.data.get('case_study_id')
        index = request.data.get('current_index', 0)
        is_completed = request.data.get('is_completed', False)

        case = get_object_or_404(CaseStudy, id=case_id)
        
        session, created = UserSession.objects.update_or_create(
            user=request.user,
            case_study=case,
            defaults={
                'current_question_index': index,
                'is_completed': is_completed,
                'organization': active_org_for(request.user),
            }
        )
        return Response({"status": "saved", "index": session.current_question_index})
    
    @action(detail=False, methods=['get'])
    def resume(self, request):
        """
        Gets the last session for a specific case.
        Query param: ?case_id=case-1
        """
        case_id = request.query_params.get('case_id')
        if not case_id:
            return Response({"error": "case_id required"}, status=400)
        
        session = UserSession.objects.filter(user=self.request.user, case_study_id=case_id).first()
        if session:
            return Response(self.get_serializer(session).data)
        return Response({}, status=200)

from .gemini_service import get_evolving_rationale

class CaseStudyViewSet(viewsets.ModelViewSet):  # Changed to ModelViewSet to allow creation
    """CRUD for case studies plus AI-backed generation.

    Standard /cases/ CRUD, plus ``generate`` (create + return an AI case) and
    ``prefetch`` (create one in the background). Authentication is required
    because create/update/delete and the Gemini-powered actions consume quota
    and must not be reachable anonymously.
    """
    queryset = CaseStudy.objects.all()
    serializer_class = CaseStudySerializer
    # Require authentication: AllowAny exposed create/update/delete and the
    # expensive AI generate/prefetch actions (Gemini quota) to anonymous users.
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """
        Triggers AI generation of a new case study, saves it, and returns it.

        POST /cases/generate/ with ``{"domain": ..., "difficulty": ...}``.
        Calls Gemini to produce a full case (vignette + questions + distractors),
        persists it, records it in agent memory, and returns the serialized case.
        Returns 503 if the AI returns nothing (likely an API key/quota issue).
        """
        domain = request.data.get('domain', 'OT Expertise')
        difficulty = request.data.get('difficulty', 'Medium')

        try:
            from .gemini_service import generate_full_case_study
            import json
            import uuid
            from .models import CaseStudy, Question, Distractor

            # AI call: synchronously ask Gemini for a JSON-encoded case study.
            json_str = generate_full_case_study(domain, difficulty)
            if not json_str:
                return Response({"error": "AI Generation failed (returned empty). Possible API Key issue."}, status=503)

            data = json.loads(json_str)

            # Create Case
            case_id = f"case-{uuid.uuid4().hex[:8]}"
            case = CaseStudy.objects.create(
                id=case_id,
                title=data.get('title', 'Untitled Case'),
                vignette=data.get('vignette', ''),
                setting=data.get('setting', 'General'),
                tags=["AI-Generated", domain, difficulty] # Add tags
            )
            
            # Record in Agent Memory so the agent can recall what it has already
            # generated for this user (avoids repetition, enables continuity).
            from .memory_service import store_memory
            store_memory(
                user_id=request.user.id if request.user.is_authenticated else None,
                key=f"generated_case:{case_id}",
                value={"title": case.title, "domain": domain},
                category="case_history"
            )
            
            # Create Questions & Distractors
            # Persist the nested AI payload: one Question per item, each with its
            # answer options (Distractors) including per-option rationale text.
            for idx, q_data in enumerate(data.get('questions', [])):
                q_id = f"{case_id}-q{idx+1}"
                question = Question.objects.create(
                    id=q_id,
                    case_study=case,
                    stem=q_data.get('stem'),
                    domain=q_data.get('domain', 'OT_EXP'),
                    correct_label=q_data.get('correct_label'),
                    correct_rationale=q_data.get('correct_rationale')
                )

                for d_data in q_data.get('distractors', []):
                    Distractor.objects.create(
                        question=question,
                        label=d_data.get('label'),
                        text=d_data.get('text'),
                        incorrect_rationale=d_data.get('incorrect_rationale')
                    )
            
            # Return serialized full structure
            serializer = self.get_serializer(case)
            return Response(serializer.data, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
            
    @action(detail=False, methods=['post'])

    def prefetch(self, request):
        """
        Generates a new case study in the background and saves it to the library.

        POST /cases/prefetch/ with ``{"domain": ..., "difficulty": ...}``. Same
        Gemini-backed generation as ``generate`` but returns only a status/case_id
        (no full payload) so the frontend can warm the library ahead of demand.
        """
        domain = request.data.get('domain', 'OT Expertise')
        difficulty = request.data.get('difficulty', 'Medium')
        
        # We'll just reuse the generation logic
        try:
            from .gemini_service import generate_full_case_study
            import json
            import uuid
            from .models import CaseStudy, Question, Distractor
            
            json_str = generate_full_case_study(domain, difficulty)
            if not json_str:
                return Response({"status": "failed", "reason": "empty"}, status=503)
            
            data = json.loads(json_str)
            case_id = f"case-{uuid.uuid4().hex[:8]}"
            case = CaseStudy.objects.create(
                id=case_id,
                title=data.get('title', 'Untitled Case'),
                vignette=data.get('vignette', ''),
                setting=data.get('setting', 'General'),
                tags=["Prefetched", domain, difficulty]
            )
            
            for idx, q_data in enumerate(data.get('questions', [])):
                q_id = f"{case_id}-q{idx+1}"
                question = Question.objects.create(
                    id=q_id,
                    case_study=case,
                    stem=q_data.get('stem'),
                    domain=q_data.get('domain', 'OT_EXP'),
                    correct_label=q_data.get('correct_label'),
                    correct_rationale=q_data.get('correct_rationale')
                )
                for d_data in q_data.get('distractors', []):
                    Distractor.objects.create(
                        question=question,
                        label=d_data.get('label'),
                        text=d_data.get('text'),
                        incorrect_rationale=d_data.get('incorrect_rationale')
                    )
            return Response({"status": "success", "case_id": case_id}, status=201)
        except Exception as e:
            return Response({"status": "failed", "error": str(e)}, status=500)


from .models import AgentMemory
from .serializers import AgentMemorySerializer

class AgentMemoryViewSet(viewsets.ModelViewSet):
    """
    API endpoint for the agent to store/retrieve persistent memory.
    """
    queryset = AgentMemory.objects.all()
    serializer_class = AgentMemorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Users only see their own memories? Or global agent memories?
        # For this prototype, return user's memories.
        return AgentMemory.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Stamp ownership server-side so callers can't write memories for others.
        serializer.save(user=self.request.user)

class UserAnswerViewSet(viewsets.ModelViewSet):
    """Records and auto-grades a user's answers to case-study questions.

    CRUD under /answers/ (scoped to the user) plus two AI actions:
    ``get_rationale`` (evolving explanation) and ``evidence_link`` (compares the
    user's highlights against expert clinical indicators). Requires auth.
    """
    queryset = UserAnswer.objects.all()
    serializer_class = UserAnswerSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        # Auto-grade on save: compare the chosen label to the question's correct
        # label (case-insensitive) so correctness is computed server-side and
        # can't be spoofed by the client. Ownership is also set here.
        question = serializer.validated_data['question']
        selected = serializer.validated_data['selected_label']
        is_correct = (selected.upper() == question.correct_label.upper())
        # Stamp the tenant so org instructors can aggregate cohort performance.
        serializer.save(user=self.request.user, is_correct=is_correct,
                        organization=active_org_for(self.request.user))

    @action(detail=False, methods=['post'])
    def get_rationale(self, request):
        """
        Custom endpoint to fetch AI rationale based on current state.
        Expects: { 
            "question_id": "q-2",
            "previous_answer": { "is_correct": false, "selected_label": "A" },
            "all_previous_correct": true
        }
        """
        data = request.data
        question = get_object_or_404(Question, id=data.get('question_id'))
        
        previous_ans = data.get('previous_answer', None) # Dict or None
        # When no prior answer is supplied, treat history as "all correct" so the
        # rationale tone stays neutral rather than remedial.
        prev_correct = previous_ans['is_correct'] if previous_ans else True
        prev_label = previous_ans['selected_label'] if previous_ans else None

        # AI call: generate an explanation that adapts to the user's running
        # performance (e.g. reinforce vs. remediate).
        rationale = get_evolving_rationale(
            current_question_stem=question.stem,
            current_correct_rationale=question.correct_rationale,
            previous_answer_correct=prev_correct,
            previous_selected_label=prev_label,
            all_previous_correct=data.get('all_previous_correct', True)
        )
        
        if rationale:
            return Response({"rationale": rationale})
        return Response({"error": "Failed to generate rationale"}, status=503)

    @action(detail=False, methods=['post'])
    def evidence_link(self, request):
        """
        Analyzes user highlights against expert clinical indicators.
        POST /api/answers/evidence_link/
        Expects: { 
            "vignette": "...",
            "question_id": "q-1",
            "user_highlights": [{"start": 0, "end": 50, "text": "..."}]
        }
        Returns: {
            "expert_highlights": [...],
            "matched_count": int,
            "missed_indicators": [...],
            "perceptual_tip": str,
            "score": int
        }
        """
        from .gemini_service import analyze_evidence_link
        
        try:
            data = request.data
            question_id = data.get('question_id')
            
            if not question_id:
                return Response({"error": "question_id required", "expert_highlights": [], "matched_count": 0, "missed_indicators": [], "perceptual_tip": "Question ID missing.", "score": 0}, status=200)
            
            question = Question.objects.filter(id=question_id).first()
            if not question:
                return Response({"error": f"Question {question_id} not found", "expert_highlights": [], "matched_count": 0, "missed_indicators": [], "perceptual_tip": "Question not found.", "score": 0}, status=200)
            
            # Resolve the correct option's display text (fall back to the label
            # itself if the matching distractor row is missing).
            correct_distractor = question.distractor_set.filter(label=question.correct_label).first()
            correct_answer_text = correct_distractor.text if correct_distractor else question.correct_label

            # AI call: score the user's highlighted evidence against expert
            # clinical indicators and surface what they missed.
            result = analyze_evidence_link(
                vignette=data.get('vignette', ''),
                question_stem=question.stem,
                correct_answer=correct_answer_text,
                correct_rationale=question.correct_rationale,
                user_highlights=data.get('user_highlights', [])
            )
            
            return Response(result)
        except Exception as e:
            # Always return HTTP 200 with a zero-score, empty result shape so the
            # frontend can render gracefully instead of treating analysis hiccups
            # (e.g. AI errors) as a hard failure.
            print(f"Evidence Link Error: {e}")
            return Response({"error": str(e), "expert_highlights": [], "matched_count": 0, "missed_indicators": [], "perceptual_tip": "Analysis error.", "score": 0}, status=200)

class HighlightViewSet(viewsets.ModelViewSet):
    """CRUD for a user's text highlights on case vignettes.

    /highlights/ scoped to the requesting user; used to persist what passages the
    learner marked while reading. Requires authentication.
    """
    queryset = Highlight.objects.all()
    serializer_class = HighlightSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Only ever expose the caller's own highlights.
        return Highlight.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Force ownership to the authenticated user.
        serializer.save(user=self.request.user)

# --- MOCK STUDY VIEWS ---

from .models import MockStudySession
from .serializers import MockStudySessionSerializer
# Imports moved to top of file

class MockStudyViewSet(viewsets.ModelViewSet):
    """
    API endpoints for Mock Study Flow.
    Allows users to practice with AI-generated questions one at a time.
    """
    queryset = MockStudySession.objects.all()
    serializer_class = MockStudySessionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_permissions(self):
        """
        Enforce IsPaidOrTrial for actions that start or progress the study.

        The "consuming" actions (start/next/prefetch/pivot) generate or serve
        questions and so are gated behind a paid-or-trial subscription; all other
        actions (e.g. reading/saving state) only require authentication.
        """
        if self.action in ['start', 'next', 'prefetch', 'pivot']:
            return [permissions.IsAuthenticated(), IsPaidOrTrialUser()]
        return [permissions.IsAuthenticated()]

    @staticmethod
    def _served_bank_ids(session):
        """Bank question ids already used in this session (served or answered).

        Collected from the current/next question slots and the answer history so
        the bank selector can exclude them and avoid repeats within a session.
        """
        ids = set()
        for d in (session.current_question_data, session.next_question_data):
            if d and d.get('bank_id'):
                ids.add(d['bank_id'])
        for h in (session.session_history or []):
            if h.get('bank_id'):
                ids.add(h['bank_id'])
        return ids
    
    def get_queryset(self):
        if self.request.user.is_authenticated:
            return MockStudySession.objects.filter(user=self.request.user)
        return MockStudySession.objects.none()
    
    @action(detail=False, methods=['post'])
    def start(self, request):
        """
        Start a new mock study session.
        Expects: { "domain": "OT_EXP", "difficulty": "Medium", "total_questions": 10 }
        Returns: session info with first question
        """
        domain = request.data.get('domain', 'OT_EXP')
        difficulty = request.data.get('difficulty', 'Medium')
        total_questions = request.data.get('total_questions', 10)
        
        mode = request.data.get('mode', 'practice')

        # Override for exam mode
        # Exam mode mimics the real NOTCE: large fixed length (200 = 2 "books",
        # 100 = 1) and a timer; practice mode is shorter and self-paced.
        if mode == 'exam':
            # Default to 200 questions (2 books)
            total_questions = request.data.get('total_questions', 200)
            # Or 100 if just one book is selected (simplified for now)
            # Initialize with empty exam config if none provided
            exam_config = {"book": 1, "total_books": 2} if total_questions == 200 else {"book": 1, "total_books": 1}
        else:
             exam_config = {}

        # Validate total_questions for practice mode
        # Clamp to a supported set length; reject arbitrary client values.
        if mode == 'practice' and total_questions not in [10, 25, 50]:
            total_questions = 10
        
        # Create session
        session = MockStudySession.objects.create(
            user=request.user if request.user.is_authenticated else None,
            organization=active_org_for(request.user) if request.user.is_authenticated else None,
            domain=domain,
            difficulty=difficulty,
            total_questions=total_questions,
            current_question=1,
            topics_covered=[],
            is_active=True,
            mode=mode,
            exam_config=exam_config,
            timer_start=timezone.now() if mode == 'exam' else None
        )
        
        # Serve a vetted bank question first; fall back to Gemini if the bank
        # has no approved item for this domain/difficulty.
        question_data = serve_bank_question(domain, difficulty)
        if not question_data:
            question_data = generate_practice_question(
                domain=domain,
                difficulty=difficulty,
                question_number=1,
                total_questions=total_questions,
                topics_covered=[]
            )

        if not question_data:
            session.delete()
            return Response({"error": "Failed to generate question"}, status=503)

        # Store current question data for answer validation
        session.current_question_data = question_data
        session.save()

        # Return session info and question (without correct answer)
        return Response({
            "session_id": session.id,
            "domain": domain,
            "difficulty": difficulty,
            "total_questions": total_questions,
            "current_question": 1,
            "question": {
                "stem": question_data.get("stem"),
                "options": question_data.get("options", []),
                "vetted": question_data.get("source") == "bank"
            }
        }, status=201)

    @action(detail=False, methods=['post'])
    def prefetch(self, request):
        """
        Background endpoint to generate the NEXT question ahead of time.
        """
        session_id = request.data.get('session_id')
        try:
            session = MockStudySession.objects.get(id=session_id, user=request.user, is_active=True)
        except MockStudySession.DoesNotExist:
            return Response({"error": "Session not found"}, status=404)

        # Don't prefetch if we're at the end
        if session.current_question >= session.total_questions:
            return Response({"status": "no_more_questions"})

        # Only generate if we don't already have one
        if not session.next_question_data:
            next_num = session.current_question + 1
            question_data = serve_bank_question(
                session.domain, session.difficulty,
                exclude_ids=self._served_bank_ids(session)
            )
            if not question_data:
                question_data = generate_practice_question(
                    domain=session.domain,
                    difficulty=session.difficulty,
                    question_number=next_num,
                    total_questions=session.total_questions,
                    topics_covered=session.topics_covered or []
                )
            if question_data:
                session.next_question_data = question_data
                session.save()
                return Response({"status": "prefetched", "question_number": next_num})
        
        return Response({"status": "already_prefetched"})

    
    @action(detail=False, methods=['post'])
    def save_progress(self, request):
        """
        Saves the current session state (e.g. highlights).
        Expects: { "session_id": 1, "highlights": [...] }
        """
        session_id = request.data.get('session_id')
        highlights = request.data.get('highlights', [])

        try:
            session = MockStudySession.objects.get(id=session_id, user=request.user, is_active=True)
            session.highlights = highlights
            session.save()
            return Response({"status": "saved"})
        except MockStudySession.DoesNotExist:
            return Response({"error": "Session not found"}, status=404)

    @action(detail=False, methods=['get'])
    def get_active(self, request):
        """
        Gets the user's most recent active session.
        """
        if not request.user.is_authenticated:
            return Response(None)
            
        session = MockStudySession.objects.filter(
            user=request.user, 
            is_active=True
        ).order_by('-last_accessed').first()
        
        if not session:
            return Response(None)
            
        return Response({
            "session_id": session.id,
            "domain": session.domain,
            "difficulty": session.difficulty,
            "total_questions": session.total_questions,
            "current_question": session.current_question,
            "question": {
                "stem": session.current_question_data.get("stem"),
                "options": session.current_question_data.get("options", [])
            },
            "highlights": session.highlights,
            "progress": {
                "current": session.current_question,
                "total": session.total_questions,
                "correct": session.correct_count
            }
        })

    @action(detail=False, methods=['post'])
    def submit(self, request):
        """
        Submit an answer for the current question.
        Expects: { "session_id": 1, "selected_label": "A" }
        Returns: feedback and updated progress
        """
        session_id = request.data.get('session_id')
        selected_label = request.data.get('selected_label', '').upper()
        
        try:
            session = MockStudySession.objects.get(id=session_id, user=request.user)
            # We don't check is_active here strictly to allow viewing results of completed,
            # but for submission it should be active.
            if not session.is_active:
                 return Response({"error": "Session is already completed"}, status=400)
        except MockStudySession.DoesNotExist:
            return Response({"error": "Session not found"}, status=404)
        
        question_data = session.current_question_data
        if not question_data:
            return Response({"error": "No active question"}, status=400)
        
        # Generate feedback
        # AI call: grade the selection and produce per-option rationale feedback.
        feedback = generate_answer_feedback(
            question_stem=question_data.get("stem", ""),
            selected_label=selected_label,
            correct_label=question_data.get("correct_label", ""),
            correct_rationale=question_data.get("correct_rationale", ""),
            incorrect_rationales=question_data.get("incorrect_rationales", {})
        )
        
        # Update session stats
        is_correct = feedback["is_correct"]
        if is_correct:
            session.correct_count += 1
        
        # Add topic to covered list
        topic = question_data.get("topic", "")
        if topic and topic not in session.topics_covered:
            topics = session.topics_covered or []
            topics.append(topic)
            session.topics_covered = topics
            
        # Record history. `domain` is captured per-question for analytics: prefer
        # the question's own domain (bank items carry it; matters for MIXED exams)
        # and fall back to the session's domain for single-domain practice runs.
        history_item = {
            "question_number": session.current_question,
            "stem": question_data.get("stem"),
            "selected_label": selected_label,
            "correct_label": question_data.get("correct_label"),
            "is_correct": is_correct,
            "bank_id": question_data.get("bank_id"),
            "domain": question_data.get("domain") or session.domain,
            "timestamp": timezone.now().isoformat()
        }
        history = session.session_history or []
        history.append(history_item)
        session.session_history = history
        
        is_complete = session.current_question >= session.total_questions
        
        session.save()
        
        response_data = {
            "progress": {
                "current": session.current_question,
                "total": session.total_questions,
                "correct": session.correct_count,
                "percentage": int((session.current_question / session.total_questions) * 100)
            },
            "is_complete": is_complete
        }

        # If exam mode, DO NOT return feedback
        # Real exam conditions: withhold correctness/rationale until the session
        # is finished, so the learner can't course-correct mid-exam.
        if session.mode == 'exam':
            response_data["feedback"] = None # Explicitly None
            response_data["next_question_ready"] = True # Simplified for now
        else:
            response_data["feedback"] = feedback
            # Pre-minted student learning aids (present only on bank questions).
            response_data["learning"] = {
                "core_concept": question_data.get("core_concept", ""),
                "explain_differently": question_data.get("explain_differently", "")
            }

        return Response(response_data)

    @action(detail=False, methods=['post'])
    def pivot(self, request):
        """
        Generates a pivot scenario for the current question.
        Expects: { "session_id": 1 }
        """
        session_id = request.data.get('session_id')
        
        try:
            session = MockStudySession.objects.get(id=session_id, user=request.user)
        except MockStudySession.DoesNotExist:
            return Response({"error": "Session not found"}, status=404)

        question_data = session.current_question_data
        if not question_data:
            return Response({"error": "No active question data to pivot"}, status=400)
            
        # AI call: spin a "what if" variant of the current question to test the
        # same concept under changed conditions.
        pivot_data = generate_pivot_scenario(
            original_stem=question_data.get("stem", ""),
            original_correct_label=question_data.get("correct_label", ""),
            original_correct_rationale=question_data.get("correct_rationale", "")
        )
        
        if not pivot_data:
            return Response({"error": "Failed to generate pivot"}, status=503)
            
        return Response(pivot_data)
    
    @action(detail=False, methods=['post'])
    def next(self, request):
        """
        Get the next question in the session.
        Expects: { "session_id": 1 }
        Returns: next question or completion status
        """
        from django.utils import timezone
        
        session_id = request.data.get('session_id')
        
        try:
            session = MockStudySession.objects.get(id=session_id, user=request.user, is_active=True)
        except MockStudySession.DoesNotExist:
            return Response({"error": "Session not found or expired"}, status=404)
        
        # Check if session is complete
        if session.current_question >= session.total_questions:
            session.is_active = False
            session.completed_at = timezone.now()
            session.save()
            
            return Response({
                "is_complete": True,
                "final_score": {
                    "correct": session.correct_count,
                    "total": session.total_questions,
                    "percentage": int((session.correct_count / session.total_questions) * 100)
                }
            })
        
        # Advance to next question
        session.current_question += 1
        
        # USE PREFETCHED DATA IF AVAILABLE
        if session.next_question_data:
            question_data = session.next_question_data
            session.next_question_data = None # Clear it
        else:
            # Vetted bank question first, else fall back to Gemini.
            question_data = serve_bank_question(
                session.domain, session.difficulty,
                exclude_ids=self._served_bank_ids(session)
            )
            if not question_data:
                question_data = generate_practice_question(
                    domain=session.domain,
                    difficulty=session.difficulty,
                    question_number=session.current_question,
                    total_questions=session.total_questions,
                    topics_covered=session.topics_covered or []
                )

        if not question_data:
            return Response({"error": "Failed to generate question"}, status=503)

        session.current_question_data = question_data
        session.save()

        return Response({
            "is_complete": False,
            "current_question": session.current_question,
            "total_questions": session.total_questions,
            "question": {
                "stem": question_data.get("stem"),
                "options": question_data.get("options", []),
                "vetted": question_data.get("source") == "bank"
            },
             "highlights": session.highlights
        })

from .models import BankCase, BankQuestion
from .serializers import BankCaseSerializer, BankQuestionSerializer


class PerformanceView(APIView):
    """
    Performance Hub: a single cross-session analytics payload for the signed-in
    user (overall accuracy, per-domain mastery, confidence calibration, recent
    trend, projected accuracy/pass band, and study activity).

    Read-only and self-scoped. Aggregates persisted answer history from both the
    case-study (`UserAnswer`) and mock/exam (`MockStudySession.session_history`)
    flows. See `performance_service.compute_performance`.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .performance_service import compute_performance
        try:
            return Response(compute_performance(request.user))
        except Exception:
            logger.exception("Failed to compute performance for %s", request.user)
            return Response({"error": "Failed to compute performance"}, status=500)


class BankQuestionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Serves the vetted premium question bank. Approved items only.
    Filter via ?domain=&difficulty=&format=&topic=
    """
    serializer_class = BankQuestionSerializer
    permission_classes = [IsPaidUser]

    # NOTCE 2026 Blueprint scenario descriptors that can be filtered on directly.
    DESCRIPTOR_FILTERS = (
        'cognitive_level', 'client_type', 'practice_setting',
        'age_group', 'pronouns', 'representation', 'diagnosis_category',
    )

    def get_queryset(self):
        qs = BankQuestion.objects.filter(status='approved').prefetch_related('distractors')
        params = self.request.query_params
        if params.get('domain'):
            qs = qs.filter(domain=params['domain'])
        if params.get('difficulty'):
            qs = qs.filter(difficulty=params['difficulty'])
        if params.get('format'):
            qs = qs.filter(format=params['format'])
        if params.get('topic'):
            qs = qs.filter(topic__icontains=params['topic'])
        for field in self.DESCRIPTOR_FILTERS:
            if params.get(field):
                qs = qs.filter(**{field: params[field]})
        return qs

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Coverage summary for approved items: counts by domain x difficulty, by
        cognitive taxonomy, and by each NOTCE 2026 Blueprint scenario descriptor.
        Descriptor coverage spans standalone questions plus distinct cases, since
        case-based questions inherit their scenario from the case.
        """
        from django.db.models import Count
        approved = BankQuestion.objects.filter(status='approved')

        rows = (approved.values('domain', 'difficulty')
                .annotate(n=Count('id')).order_by('domain', 'difficulty'))
        by_cognitive = (approved.values('cognitive_level')
                        .annotate(n=Count('id')).order_by('cognitive_level'))

        # Per-descriptor coverage over scenarios = standalone questions + cases.
        descriptor_fields = ('client_type', 'practice_setting', 'age_group',
                             'pronouns', 'representation', 'diagnosis_category')
        standalone = approved.filter(format='standalone')
        cases = BankCase.objects.all()
        descriptors = {}
        for field in descriptor_fields:
            counts = {}
            for qs in (standalone, cases):
                for row in qs.exclude(**{field: ''}).values(field).annotate(n=Count('id')):
                    counts[row[field]] = counts.get(row[field], 0) + row['n']
            descriptors[field] = [{"value": k, "n": v} for k, v in sorted(counts.items())]

        return Response({
            "total": approved.count(),
            "breakdown": list(rows),
            "by_cognitive_level": list(by_cognitive),
            "by_descriptor": descriptors,
        })


class BankCaseViewSet(viewsets.ReadOnlyModelViewSet):
    """Serves vetted premium case-based clusters (vignette + linked questions)."""
    serializer_class = BankCaseSerializer
    permission_classes = [IsPaidUser]

    def get_queryset(self):
        qs = BankCase.objects.prefetch_related('questions__distractors')
        if self.request.query_params.get('domain'):
            qs = qs.filter(domain=self.request.query_params['domain'])
        return qs


from .stripe_service import create_checkout_session, handle_stripe_webhook
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

class CreateCheckoutSessionView(APIView):
    """Starts a Stripe Checkout session for a subscription tier.

    POST /create-checkout-session/ with ``{"tier", "success_url", "cancel_url"}``.
    Returns ``{"sessionId", "url"}`` to redirect the user to Stripe. Requires
    auth and is gated by the PAYMENTS_ENABLED env kill-switch.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # Stripe flow kill-switch. Disabled by default until we flip
        # PAYMENTS_ENABLED=true in the environment when prod is ready.
        if os.environ.get('PAYMENTS_ENABLED', 'false').lower() != 'true':
            return Response(
                {'error': 'Payments are temporarily unavailable. Please check back soon.',
                 'payments_disabled': True},
                status=503,
            )

        tier = request.data.get('tier')
        success_url = request.data.get('success_url', 'http://localhost:5173/?session_id={CHECKOUT_SESSION_ID}')
        cancel_url = request.data.get('cancel_url', 'http://localhost:5173/?cancel=true')

        try:
            # Delegates to the Stripe service; ValueError signals bad input
            # (e.g. unknown tier) -> 400, anything else -> 500.
            session = create_checkout_session(request.user, tier, success_url, cancel_url)
            return Response({'sessionId': session.id, 'url': session.url})
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

# csrf_exempt: Stripe posts server-to-server and can't supply a CSRF token.
@method_decorator(csrf_exempt, name='dispatch')
class StripeWebhookView(APIView):
    """Receives Stripe webhook events (payment lifecycle).

    POST /stripe-webhook/ with the raw Stripe payload. Public/CSRF-exempt because
    Stripe calls it directly; authenticity is verified inside
    ``handle_stripe_webhook`` via the Stripe-Signature header, not via DRF auth.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        payload = request.body
        # Signature header lets the service confirm the event really came from
        # Stripe (HMAC against the webhook secret) before acting on it.
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')

        try:
            handle_stripe_webhook(payload, sig_header)
            return Response(status=200)
        except Exception as e:
            # 400 tells Stripe the event failed verification/processing so it
            # will retry per its delivery policy.
            return Response({'error': str(e)}, status=400)

from .stripe_service import verify_payment_status

class SyncPaymentView(APIView):
    """Reconciles the user's local subscription state with Stripe.

    POST /sync-payment/ -> re-checks Stripe for the user and returns the updated
    paid status/tier. Used after checkout (or on app load) so the UI reflects a
    payment even if the webhook is delayed. Requires authentication.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # Pull current status from Stripe and persist any change to the profile.
        updated = verify_payment_status(request.user)
        # Refresh from DB to get latest status
        # verify_payment_status may have written via a separate instance, so
        # reload to return the freshest values.
        request.user.userprofile.refresh_from_db()
        return Response({
            'success': True, 
            'updated': updated,
            'is_paid': request.user.userprofile.is_paid,
            'tier': request.user.userprofile.subscription_tier
        })


