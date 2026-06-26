"""
Cookie-based JWT authentication for the NOTCE API.

The SPA used to keep its JWT access/refresh tokens in browser ``localStorage`` and
send them as ``Authorization: Bearer`` headers. That exposes the tokens to any
XSS on the page. This module moves the tokens into **httpOnly** cookies that
JavaScript can't read, and authenticates requests from those cookies.

Because the frontend (Vercel) and API (Railway) live on different sites, the auth
cookies must be ``SameSite=None``, which means the browser sends them on
cross-site requests — so CSRF protection is mandatory for unsafe methods. We rely
on Django's CSRF machinery: the client fetches a CSRF token (``/auth/csrf/``) and
echoes it in the ``X-CSRFToken`` header; this module enforces it for cookie-authed
writes (a Bearer-header request, e.g. server-to-server, skips the CSRF check).
"""

from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware, get_token
from rest_framework import exceptions
from rest_framework_simplejwt.authentication import JWTAuthentication

# Cookie names (overridable via settings) and the HTTP methods that don't mutate
# state and therefore don't require a CSRF token.
ACCESS_COOKIE = getattr(settings, 'AUTH_ACCESS_COOKIE', 'access_token')
REFRESH_COOKIE = getattr(settings, 'AUTH_REFRESH_COOKIE', 'refresh_token')
SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS', 'TRACE')


def _cookie_kwargs(max_age):
    """Shared cookie attributes. Secure + SameSite=None in prod (cross-site);
    relaxed to Lax/insecure under DEBUG so http://localhost dev still works."""
    secure = getattr(settings, 'AUTH_COOKIE_SECURE', not settings.DEBUG)
    samesite = getattr(settings, 'AUTH_COOKIE_SAMESITE', 'Lax' if settings.DEBUG else 'None')
    return {
        'httponly': True,
        'secure': secure,
        'samesite': samesite,
        'path': '/',
        'max_age': max_age,
    }


def set_auth_cookies(response, access=None, refresh=None):
    """Attach the access (and optionally refresh) JWT as httpOnly cookies."""
    simple_jwt = getattr(settings, 'SIMPLE_JWT', {})
    if access is not None:
        access_ttl = simple_jwt.get('ACCESS_TOKEN_LIFETIME')
        max_age = int(access_ttl.total_seconds()) if access_ttl else 3600
        response.set_cookie(ACCESS_COOKIE, str(access), **_cookie_kwargs(max_age))
    if refresh is not None:
        refresh_ttl = simple_jwt.get('REFRESH_TOKEN_LIFETIME')
        max_age = int(refresh_ttl.total_seconds()) if refresh_ttl else 30 * 24 * 3600
        response.set_cookie(REFRESH_COOKIE, str(refresh), **_cookie_kwargs(max_age))
    return response


def clear_auth_cookies(response):
    """Remove both auth cookies (logout / dead session)."""
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(name, path='/')
    return response


class _CSRFCheck(CsrfViewMiddleware):
    """CsrfViewMiddleware subclass whose rejection returns the reason string
    instead of an HttpResponse, so we can raise a DRF error from it."""
    def _reject(self, request, reason):
        return reason


def enforce_csrf(request):
    """Run Django's CSRF check; raise PermissionDenied on failure.

    Mirrors DRF's SessionAuthentication.enforce_csrf so cookie-authed writes are
    protected exactly like session-authed ones would be.
    """
    check = _CSRFCheck(lambda req: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise exceptions.PermissionDenied(f'CSRF Failed: {reason}')


class CookieJWTAuthentication(JWTAuthentication):
    """JWT auth that reads the access token from an httpOnly cookie.

    Falls back to the standard ``Authorization`` header when present (so existing
    Bearer clients / server-to-server calls keep working during the transition).
    For cookie-sourced auth, unsafe methods must carry a valid CSRF token.
    """

    def authenticate(self, request):
        header = self.get_header(request)
        from_cookie = False

        if header is not None:
            raw_token = self.get_raw_token(header)
        else:
            # No Authorization header — try the httpOnly access cookie.
            raw_token = request.COOKIES.get(ACCESS_COOKIE)
            from_cookie = True

        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)

        # Only cookie-authed writes need CSRF (header/Bearer callers are exempt).
        if from_cookie and request.method not in SAFE_METHODS:
            enforce_csrf(request)

        return (user, validated_token)


def prime_csrf(request):
    """Ensure a CSRF cookie is set and return the matching token value (to be sent
    back in the response body so the cross-site SPA can echo it as a header)."""
    return get_token(request)
