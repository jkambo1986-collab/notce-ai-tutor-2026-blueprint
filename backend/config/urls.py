"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, re_path, include
from django.http import HttpResponse, HttpResponseNotFound, JsonResponse
from django.conf import settings
from django.views.decorators.cache import never_cache


@never_cache
def spa_index(request):
    """
    SPA fallback: serve the built React index.html for any non-API route so
    client-side deep links (e.g. /dashboard, /signin) work on a full page load
    when the frontend is served by Django (Railway). Real static files are
    served by WhiteNoise before they reach this view; only unmatched app routes
    fall through here. On Vercel the same fallback is handled by vercel.json.
    """
    index_file = settings.FRONTEND_DIST / "index.html"
    try:
        with open(index_file, "rb") as fh:
            return HttpResponse(fh.read(), content_type="text/html")
    except FileNotFoundError:
        # No build present (e.g. local API-only dev without `npm run build`).
        return HttpResponseNotFound(
            "Frontend build not found. Run `npm run build` to generate dist/."
        )


# Root URL configuration. Order matters: more specific prefixes are matched first,
# and the SPA catch-all at the end handles everything else.
urlpatterns = [
    path('admin/', admin.site.urls),                  # Django admin site
    path('api/', include('core.urls')),               # all REST API endpoints (delegated to core/urls.py)
    path('health/', lambda r: HttpResponse("Backend is healthy")),  # plain-text health check
    # Unknown /api/ paths 404 as JSON instead of falling through to the SPA shell.
    re_path(r'^api/', lambda r: JsonResponse({"detail": "Not found."}, status=404)),
    # SPA catch-all: anything not handled above returns the React app shell.
    # The negative lookahead excludes the backend prefixes as WHOLE segments
    # (with or without a trailing slash) so e.g. `/admin` still gets Django's
    # APPEND_SLASH redirect to `/admin/` instead of being swallowed as an SPA route.
    re_path(r'^(?!(?:admin|api|health|static|media)(?:/|$)).*$', spa_index),
]

