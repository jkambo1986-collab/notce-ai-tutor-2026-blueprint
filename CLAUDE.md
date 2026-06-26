# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

NOTCE AI-Tutor is an AI-powered study companion for the **Canadian NOTCE** (National Occupational Therapy Certification Examination, administered by CAOT) occupational therapy licensing exam, targeting the September 2026 Blueprint (built on the Competencies for Occupational Therapists in Canada, COTC 2021). Note: this is the **Canadian** exam — it is *not* the US NBCOT, and content should never reference NBCOT/AOTA frameworks. It generates clinical case studies and practice questions on the fly via Google Gemini, grades answers, and gives adaptive feedback. Monetized through Stripe subscription tiers with a 7-day trial.

It is a **split repo**: a Vite + React 19 + TypeScript SPA at the root, and a Django REST backend under `backend/`. The two deploy separately (Vercel frontend, Railway backend) and talk over a JSON API.

## Architecture

### Two AI paths — the backend is the real one
All live AI generation happens **server-side** in `backend/core/`:
- `gemini_service.py` — full case studies (`generate_full_case_study`), evolving rationale tips, and the Evidence-Link analysis (`analyze_evidence_link`, which finds expert clinical indicators in a vignette and diffs them against the user's highlights).
- `mock_study_service.py` — standalone practice questions, answer feedback, and "Clinical Pivot" what-if scenarios for the Mock Study flow.

The frontend `services/geminiService.ts` is **largely vestigial**: only `validateCaseStudy` is actually called (and it does no AI — it just checks that a case contains a `CEJ_JUSTICE` question). Its `getEvolvingRationale` is dead code. Don't add new AI calls to the frontend; route them through the Django API instead.

Both backend services use the `gemini-2.0-flash` model and the `google-genai` SDK, prompt for raw JSON, and run it through `clean_json_text()` (strips markdown fences) before `json.loads`. The frontend dead path references `gemini-3-flash-preview` — ignore it.

### Frontend
- No router. `App.tsx` (~870 lines) is the whole app; navigation is a single `view` state union (`'landing' | 'study' | 'dashboard' | 'mock-study' | 'exam-mode' | 'payment-success' | 'payment-cancel'`). Auth has its own `authView` sub-state (`landing | login | register | verify`).
- `services/api.ts` is the single source of all backend calls. **Auth is cookie-based**: the JWT access/refresh tokens live in **httpOnly cookies** set by the backend (never in `localStorage`/JS). All requests go through one central `request()` helper that sends cookies (`credentials: 'include'`), attaches the CSRF token (`X-CSRFToken`) on unsafe methods, and silently refreshes the access token on a 401 before retrying once. The CSRF token is fetched from `/api/auth/csrf/` and cached in memory (the cross-site SPA can't read the API domain's `csrftoken` cookie). Backend side: `core/authentication.py::CookieJWTAuthentication` reads the cookie + enforces CSRF; login/`/auth/refresh/`/`/auth/logout/`/`/auth/csrf/` manage the cookies. Cookies are `SameSite=None; Secure` in prod and relaxed to `Lax`/insecure under `DEBUG` for `http://localhost`.
- **Durable preferences/flags** that used to sit in `localStorage` now persist server-side via the per-user `/api/memory/` K/V store (`AgentMemory`): sidebar-collapsed state, study flagged-for-review questions, etc. `services/preferences.ts` wraps this with a `localStorage` cache for instant first paint. Onboarding-dismissed is a `UserProfile.onboarding_completed` flag; study highlights persist to `/api/highlights/`. The only intentional browser-local state left: the exam-deadline cache (server timer is authoritative), and pre-auth handoffs (`pending_plan`, `pending_invite_token`) that exist before there's a user to attach them to.
- `api.ts`'s `transformCaseStudy()` converts the backend's snake_case shape into the camelCase `types.ts` interfaces (e.g. flattening distractor `incorrect_rationale`s into an `incorrectRationales` map). Keep `types.ts`, the Django serializers, and this transformer in sync when changing the case/question shape.
- `components/AuthContext.tsx` provides `useAuth()`; on mount and after login it calls `/auth/me/` to hydrate the full `User` (including `userprofile` with tier/trial state).
- Tailwind is loaded via CDN `<script>` in `index.html` (no build step, no config file). Styling is inline utility classes.
- Two key reusable pieces: `components/HighlightableText.tsx` (vignette highlighting that powers Evidence-Link) and `recharts` for dashboard analytics.

### Backend (single `core` app)
- `core/models.py` is the data model: content (`CaseStudy` → `Question` → `Distractor`, all with manual string PKs like `case-001`, `q-1`), user data (`UserProfile` with `is_paid`/`subscription_tier`/trial + `email_verified`, `UserSession`, `UserAnswer`, `Highlight`), `AgentMemory` (per-user K/V store), and `MockStudySession`.
- `MockStudySession` is the heart of the Mock Study flow and stores question state as JSON on the row: `current_question_data` (used to grade the current answer) and `next_question_data` (prefetched ahead of time to hide Gemini latency). Exam mode (`mode='exam'`) withholds feedback until the end; practice mode returns feedback per answer.
- `core/views.py` — DRF `ViewSet`s registered via router in `core/urls.py`, mounted under `/api/`. Custom flows are `@action` methods (e.g. `MockStudyViewSet.start/next/submit/prefetch/pivot`, `CaseStudyViewSet.generate/prefetch`, `UserAnswerViewSet.get_rationale/evidence_link`).
- Default DRF permission is `IsAuthenticated` (JWT via `rest_framework_simplejwt`). Premium gating uses `core/permissions.py::IsPaidUser`, applied selectively in `MockStudyViewSet.get_permissions` to `start/next/prefetch/pivot`. Note `IsPaidUser` checks `is_paid` only — **trial users are excluded** from those premium actions.
- Stripe: `core/stripe_service.py` maps tiers (`crammer`, `guarantee`, `beta`) to hardcoded Price IDs; `beta` is a subscription, others are one-time. Fulfillment happens via webhook (`/api/stripe/webhook/`) **and** a manual fallback `/api/sync-payment/` (`verify_payment_status`) for when webhooks fail. Both call `fulfill_order`, which also sends a confirmation email.
- Email is SMTP (Gmail by default) for verification + payment confirmation. There are several `AllowAny` diagnostic endpoints (`/api/ping/`, `/api/diag/`, `/api/test-email/`) added for production debugging — they expose obfuscated config and should be treated as temporary.

## Commands

### Frontend (run from repo root)
```bash
npm install
npm run dev          # Vite dev server on http://localhost:5173 (host 0.0.0.0)
npm run build        # production build to dist/
npm run preview      # serve the built dist/
npx tsc --noEmit     # typecheck (no dedicated lint/test script exists)
```
Frontend env: `.env.local` needs `GEMINI_API_KEY` (mapped to `process.env.API_KEY` by `vite.config.ts`, only used by the dead frontend path). The API base URL is `VITE_API_BASE_URL`, defaulting to `http://localhost:8000/api`. Import alias `@/` resolves to repo root.

### Backend (run from `backend/`)
```bash
pip install -r requirements.txt
python create_db.py                  # creates local Postgres db 'notce_db' (expects local postgres)
python manage.py migrate
python seed.py                       # seeds the canonical case-001 (TBI community integration)
python manage.py runserver           # http://localhost:8000
python manage.py createsuperuser     # Django admin at /admin/
```
Backend env (`backend/.env`, gitignored): `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `EMAIL_HOST*`, and in production `DATABASE_URL`, `SECRET_KEY`, `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL`.

There are **no automated tests** (`core/tests.py` is empty). "Testing" means running both servers and exercising flows manually.

## Deployment
- **Backend → Railway**: `nixpacks.toml` (Python 3.12 + Postgres, `collectstatic`, gunicorn) and `Procfile`. Static served by WhiteNoise. Postgres comes from `DATABASE_URL` (overrides the hardcoded local default in `settings.py`).
- **Frontend → Vercel**: `vercel.json`. `runtime.txt` pins Python 3.12.
- Note the **two `requirements.txt`** (root and `backend/`) — the backend one is authoritative for the Django app; `nixpacks.toml` installs from `backend/`.

## Constraints & gotchas
- `backend/config/settings.py` currently ships with `DEBUG = True`, `ALLOWED_HOSTS = ['*']`, `CORS_ALLOW_ALL_ORIGINS = True`, a committed insecure `SECRET_KEY` default, and hardcoded local Postgres credentials. These are intentional debugging shortcuts, not production-correct — be deliberate before relying on or "cleaning up" them.
- Question/case PKs are **manually assigned strings** (`case-<uuid8>`, `<case>-q<n>`), not auto-increment. Generation code in `views.py` builds these IDs explicitly.
- The 2026 Blueprint rule "every case must contain a `CEJ_JUSTICE` (Culture/Equity/Justice) question" is enforced by prompt instruction in `generate_full_case_study` and checked client-side in `validateCaseStudy`. Preserve this when touching generation.
- Gemini calls can fail or return junk; service functions return `None`/empty fallbacks and views translate that to 503. Keep that graceful-degradation pattern rather than letting exceptions bubble to 500.
