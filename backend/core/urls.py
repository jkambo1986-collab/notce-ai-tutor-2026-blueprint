from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import CaseStudyViewSet, UserAnswerViewSet, HighlightViewSet, AgentMemoryViewSet, UserSessionViewSet, RegisterView, MockStudyViewSet, CreateCheckoutSessionView, StripeWebhookView, VerifyEmailView, SyncPaymentView, MeView, TestEmailView, PingView

router = DefaultRouter()
router.register(r'cases', CaseStudyViewSet)
router.register(r'answers', UserAnswerViewSet)
router.register(r'highlights', HighlightViewSet)
router.register(r'memory', AgentMemoryViewSet)
router.register(r'sessions', UserSessionViewSet)
router.register(r'mock-study', MockStudyViewSet, basename='mock-study')

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', MeView.as_view(), name='auth_me'),
    path('', include(router.urls)),
    path('stripe/checkout/', CreateCheckoutSessionView.as_view(), name='stripe_checkout'),
    path('stripe/webhook/', StripeWebhookView.as_view(), name='stripe_webhook'),
    path('verify-email/', VerifyEmailView.as_view(), name='verify_email'),
    path('sync-payment/', SyncPaymentView.as_view(), name='sync_payment'),
    path('test-email/', TestEmailView.as_view(), name='test_email'),
    path('ping/', PingView.as_view(), name='ping'),
]
