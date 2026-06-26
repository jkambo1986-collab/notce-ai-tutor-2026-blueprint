"""
URL routing for the core API app. Mounted under ``/api/`` by config/urls.py, so
every path below is relative to ``/api/`` (e.g. ``cases`` -> ``/api/cases/``).

Resource collections (CRUD) are exposed via a DRF DefaultRouter, while auth,
Stripe, email-verification, and diagnostics use explicit path() entries.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CaseStudyViewSet, UserAnswerViewSet, HighlightViewSet, AgentMemoryViewSet, UserSessionViewSet, RegisterView, MockStudyViewSet, CreateCheckoutSessionView, StripeWebhookView, VerifyEmailView, SyncPaymentView, MeView, TestEmailView, PingView, DiagnosticView, BankQuestionViewSet, BankCaseViewSet, EmailOrUsernameTokenObtainPairView, PerformanceView, ReviewQueueView, NotebookView, CookieTokenRefreshView, LogoutView, CsrfView, TTSView
from .org_views import OrganizationViewSet
from .differentiator_views import (
    ErrorAnalysisView, ReasoningCoachView,
    CatStartView, CatAnswerView,
    EncounterStartView, EncounterMessageView, EncounterFinishView,
)

# DRF router: auto-generates list/detail (and other) routes for each ViewSet.
router = DefaultRouter()
router.register(r'cases', CaseStudyViewSet)            # /api/cases/ - case studies + questions
router.register(r'answers', UserAnswerViewSet)         # /api/answers/ - submit/review user answers
router.register(r'highlights', HighlightViewSet)       # /api/highlights/ - vignette text highlights
router.register(r'memory', AgentMemoryViewSet)         # /api/memory/ - AI agent key/value memory
router.register(r'sessions', UserSessionViewSet)       # /api/sessions/ - per-case progress
router.register(r'mock-study', MockStudyViewSet, basename='mock-study')          # /api/mock-study/ - on-the-fly practice/exam
router.register(r'bank/questions', BankQuestionViewSet, basename='bank-questions')  # /api/bank/questions/ - premium standalone items
router.register(r'bank/cases', BankCaseViewSet, basename='bank-cases')              # /api/bank/cases/ - premium case-based items
router.register(r'organizations', OrganizationViewSet, basename='organizations')    # /api/organizations/ - B2B tenants + RBAC

urlpatterns = [
    # --- Auth (JWT) ---
    path('auth/register/', RegisterView.as_view(), name='auth_register'),  # create account
    # Login issues JWT access/refresh tokens; uses the custom view that accepts
    # either an email OR a username as the identifier.
    path('auth/login/', EmailOrUsernameTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),  # refresh access from httpOnly cookie
    path('auth/logout/', LogoutView.as_view(), name='auth_logout'),  # clear auth cookies
    path('auth/csrf/', CsrfView.as_view(), name='auth_csrf'),  # prime CSRF cookie + return token for the SPA
    path('auth/me/', MeView.as_view(), name='auth_me'),  # current user + profile
    path('performance/', PerformanceView.as_view(), name='performance'),  # cross-session analytics (Performance Hub)
    path('review-queue/', ReviewQueueView.as_view(), name='review_queue'),  # adaptive weak-item review
    path('notebook/', NotebookView.as_view(), name='notebook'),  # saved rationales notebook
    path('tts/', TTSView.as_view(), name='tts'),  # free natural neural text-to-speech (edge-tts)
    # --- AI differentiator features ---
    path('error-analysis/', ErrorAnalysisView.as_view(), name='error_analysis'),       # cognitive-error / trap insights
    path('reasoning/evaluate/', ReasoningCoachView.as_view(), name='reasoning_eval'),  # grade free-text clinical reasoning
    path('adaptive/start/', CatStartView.as_view(), name='cat_start'),                 # CAT readiness assessment - start
    path('adaptive/answer/', CatAnswerView.as_view(), name='cat_answer'),              # CAT - answer + next/finish
    path('encounter/start/', EncounterStartView.as_view(), name='encounter_start'),    # OSCE client encounter - start
    path('encounter/message/', EncounterMessageView.as_view(), name='encounter_message'),  # encounter - send turn
    path('encounter/finish/', EncounterFinishView.as_view(), name='encounter_finish'),     # encounter - score
    # Router-generated resource endpoints (cases, answers, bank/*, etc.).
    path('', include(router.urls)),
    # --- Stripe billing ---
    path('stripe/checkout/', CreateCheckoutSessionView.as_view(), name='stripe_checkout'),  # start a checkout session
    path('stripe/webhook/', StripeWebhookView.as_view(), name='stripe_webhook'),            # Stripe -> server payment events
    # --- Account / ops utilities ---
    path('verify-email/', VerifyEmailView.as_view(), name='verify_email'),  # confirm email via token
    path('sync-payment/', SyncPaymentView.as_view(), name='sync_payment'),  # reconcile subscription state from Stripe
    path('test-email/', TestEmailView.as_view(), name='test_email'),        # send a test email (debug/ops)
    path('ping/', PingView.as_view(), name='ping'),                         # lightweight liveness check
    path('diag/', DiagnosticView.as_view(), name='diag'),                   # diagnostics/health detail
]
