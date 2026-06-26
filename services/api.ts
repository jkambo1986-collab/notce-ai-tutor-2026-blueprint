/**
 * @file api.ts
 * @description Frontend HTTP client for the NOTCE backend (Django REST) API.
 * Exposes a single `api` object whose methods wrap calls to the backend REST
 * endpoints (cases, answers, sessions, mock-study, prefs/memory, highlights,
 * Stripe, orgs).
 *
 * Auth: the JWT access/refresh tokens live in **httpOnly cookies** set by the
 * backend (never in localStorage / JS). Every request goes through `request()`,
 * which sends cookies (`credentials: 'include'`), attaches the CSRF token on
 * unsafe methods, and silently refreshes the access token on a 401 before
 * retrying once. Raw payloads are normalized via the transformers at the bottom.
 */

import { CaseStudy, User, Performance, ReviewQueue, NoteEntry, ExamState, Organization, OrgMember, OrgAnalytics, OrgRole, CohortAssignment, ErrorAnalysis, ReasoningScenario, ReasoningResult, CatQuestion, CatResult, EncounterPersona, EncounterResult } from '../types';

// Base URL for all API requests. Prefers the Vite-injected env var (set per
// deployment), and falls back to the local dev backend when it's not defined.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Methods that mutate state and therefore require a CSRF token.
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// In-memory CSRF token. The SPA can't read the API domain's csrftoken cookie
// cross-site, so the backend hands us the value via /auth/csrf/ and we echo it
// back in the X-CSRFToken header on unsafe requests.
let _csrfToken: string | null = null;
// Dedupes concurrent first-write fetches so we only hit /auth/csrf/ once.
let _csrfInflight: Promise<string | null> | null = null;

/** Lazily fetch (and cache) the CSRF token; primes the csrftoken cookie too. */
async function ensureCsrf(): Promise<string | null> {
  if (_csrfToken) return _csrfToken;
  if (_csrfInflight) return _csrfInflight;
  _csrfInflight = (async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/auth/csrf/`, { credentials: 'include' });
      if (r.ok) _csrfToken = (await r.json()).csrfToken;
    } catch {
      /* offline / network error — unsafe requests will 403 until reachable */
    }
    _csrfInflight = null;
    return _csrfToken;
  })();
  return _csrfInflight;
}

/**
 * Central fetch wrapper. Always sends cookies, adds JSON + CSRF headers as
 * needed, and on a 401 attempts a one-time silent token refresh then retries.
 * `path` is relative to API_BASE_URL (e.g. '/cases/').
 */
async function request(path: string, init: RequestInit = {}, _retried = false): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers || {});
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (UNSAFE_METHODS.has(method)) {
    const token = await ensureCsrf();
    if (token) headers.set('X-CSRFToken', token);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: 'include' });

  // Access cookie expired → refresh once from the refresh cookie, then retry.
  // Skip for the auth endpoints themselves to avoid loops.
  if (res.status === 401 && !_retried && !path.startsWith('/auth/')) {
    const refreshed = await fetch(`${API_BASE_URL}/auth/refresh/`, { method: 'POST', credentials: 'include' });
    if (refreshed.ok) return request(path, init, true);
  }

  // Stale/missing CSRF token on a write (cookie cleared or rotated server-side)
  // → drop the cached token, re-prime, and retry once before giving up.
  if (res.status === 403 && UNSAFE_METHODS.has(method) && !_retried && !path.startsWith('/auth/')) {
    _csrfToken = null;
    await ensureCsrf();
    return request(path, init, true);
  }

  return res;
}

/** Convenience: JSON body serializer for request() bodies. */
const body = (data: any) => JSON.stringify(data);

export const api = {
  // --- Auth ---

  /** Primes the CSRF cookie/token. Call once on app start. GET /auth/csrf/. */
  async primeCsrf(): Promise<void> {
    await ensureCsrf();
  },

  /**
   * Log in by username OR email. POST /auth/login/. On success the backend sets
   * httpOnly access/refresh cookies; nothing sensitive is returned to JS. Throws
   * on failure.
   */
  async login(username: string, password: string): Promise<void> {
    const response = await request('/auth/login/', { method: 'POST', body: body({ username, password }) });
    if (!response.ok) throw new Error('Login failed');
  },

  /** Logs out by clearing the auth cookies server-side. POST /auth/logout/. */
  async logout(): Promise<void> {
    _csrfToken = null;
    await request('/auth/logout/', { method: 'POST' }).catch(() => { /* best-effort */ });
  },

  /**
   * Register a new user. POST /auth/register/ (no auth). Throws an Error whose
   * message is the backend's JSON error body on failure.
   */
  async register(username: string, email: string, password: string): Promise<void> {
    const response = await request('/auth/register/', { method: 'POST', body: body({ username, email, password }) });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(JSON.stringify(errorData) || 'Registration failed');
    }
  },

  /** Verify a user's email from the link token. POST /verify-email/ (no auth). */
  async verifyEmail(token: string): Promise<void> {
    const response = await request('/verify-email/', { method: 'POST', body: body({ token }) });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Verification failed');
    }
  },

  /** Fetches the authenticated user's profile. GET /auth/me/. Throws on non-OK. */
  async getMe(): Promise<User> {
    const response = await request('/auth/me/');
    if (!response.ok) throw new Error('Failed to fetch user data');
    return response.json();
  },

  /** Updates onboarding/profile prefs. PATCH /auth/me/. Returns refreshed User. */
  async updateProfile(data: { target_exam_date?: string | null; goal_domains?: string[] }): Promise<User> {
    const response = await request('/auth/me/', { method: 'PATCH', body: body(data) });
    if (!response.ok) throw new Error('Failed to update profile');
    return response.json();
  },

  /** Persists the server-side onboarding-completed flag. PATCH /auth/me/. Best-effort. */
  async setOnboardingCompleted(completed: boolean): Promise<void> {
    await request('/auth/me/', { method: 'PATCH', body: body({ onboarding_completed: completed }) })
      .catch(err => console.warn('setOnboardingCompleted failed:', err));
  },

  // --- Cases & study ---

  /** Fetches all available case studies. GET /cases/. Throws on non-OK. */
  async getCases(): Promise<CaseStudy[]> {
    const response = await request('/cases/');
    if (!response.ok) throw new Error(`Failed to fetch cases: ${response.statusText}`);
    const data = await response.json();
    return data.map(transformCaseStudy);
  },

  /** Fetches a single case study by ID. GET /cases/{id}/. Throws on non-OK. */
  async getCase(id: string): Promise<CaseStudy> {
    const response = await request(`/cases/${id}/`);
    if (!response.ok) throw new Error(`Failed to fetch case ${id}: ${response.statusText}`);
    const data = await response.json();
    return transformCaseStudy(data);
  },

  /**
   * Requests an evolving rationale (AI tutoring feedback).
   * POST /answers/get_rationale/. Returns '' on failure (never throws) so the UI keeps working.
   */
  async getRationale(context: {
    question_id: string;
    previous_answer?: { is_correct: boolean; selected_label: string };
    all_previous_correct: boolean;
  }): Promise<string> {
    const response = await request('/answers/get_rationale/', { method: 'POST', body: body(context) });
    if (!response.ok) {
      console.warn('Failed to fetch rationale:', response.status);
      return '';
    }
    const data = await response.json();
    return data.rationale;
  },

  /**
   * Persists a case-study answer for the Performance Hub. POST /answers/.
   * Fire-and-forget: best-effort, never throws, so it can't break the study flow.
   */
  recordAnswer(questionId: string, selectedLabel: string, confidence: string): void {
    request('/answers/', { method: 'POST', body: body({ question: questionId, selected_label: selectedLabel, confidence }) })
      .catch(err => console.warn('Failed to record answer:', err));
  },

  /** Cross-session Performance Hub payload. GET /performance/. Throws on non-OK. */
  async getPerformance(): Promise<Performance> {
    const response = await request('/performance/');
    if (!response.ok) throw new Error(`Failed to fetch performance: ${response.statusText}`);
    return response.json();
  },

  /** Adaptive review queue (weak items). GET /review-queue/. Throws on non-OK. */
  async getReviewQueue(): Promise<ReviewQueue> {
    const response = await request('/review-queue/');
    if (!response.ok) throw new Error(`Failed to fetch review queue: ${response.statusText}`);
    return response.json();
  },

  /** Grades a spaced-repetition review. POST /review-queue/. Returns null on failure. */
  async gradeReview(itemKey: string, remembered: boolean): Promise<{ box: number; due_at: string } | null> {
    try {
      const response = await request('/review-queue/', { method: 'POST', body: body({ item_key: itemKey, remembered }) });
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  },

  // --- AI differentiator features ---

  /** Cognitive-error / trap insights. GET /error-analysis/. Throws on non-OK. */
  async getErrorAnalysis(): Promise<ErrorAnalysis> {
    const response = await request('/error-analysis/');
    if (!response.ok) throw new Error(`Failed to fetch error analysis: ${response.statusText}`);
    return response.json();
  },

  /** Clinical-reasoning coach: scenario fetch + free-text evaluation. */
  reasoning: {
    /** Fetch a case scenario + reasoning prompt. GET /reasoning/evaluate/. */
    async scenario(): Promise<ReasoningScenario> {
      const response = await request('/reasoning/evaluate/');
      if (!response.ok) throw new Error(`Failed to load scenario: ${response.statusText}`);
      return response.json();
    },
    /** Grade the candidate's free-text reasoning. POST /reasoning/evaluate/. */
    async evaluate(payload: { vignette: string; prompt: string; response: string }): Promise<ReasoningResult> {
      const response = await request('/reasoning/evaluate/', { method: 'POST', body: body(payload) });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Evaluation failed: ${response.statusText}`);
      }
      return response.json();
    },
  },

  /** Computer-adaptive readiness assessment. */
  adaptive: {
    /** Start an adaptive assessment. POST /adaptive/start/. */
    async start(length?: number): Promise<{ session_id: string; question: CatQuestion; ability: number }> {
      const response = await request('/adaptive/start/', { method: 'POST', body: body({ length }) });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Failed to start assessment: ${response.statusText}`);
      }
      return response.json();
    },
    /** Submit an answer; returns the next item or the final result. POST /adaptive/answer/. */
    async answer(sessionId: string, label: string): Promise<{ is_complete: boolean; question?: CatQuestion; ability?: number; result?: CatResult }> {
      const response = await request('/adaptive/answer/', { method: 'POST', body: body({ session_id: sessionId, label }) });
      if (!response.ok) throw new Error(`Failed to submit answer: ${response.statusText}`);
      return response.json();
    },
  },

  /** OSCE-style simulated client encounter. */
  encounter: {
    /** Start an encounter. POST /encounter/start/. */
    async start(): Promise<{ session_id: string; persona: EncounterPersona; opening_line: string }> {
      const response = await request('/encounter/start/', { method: 'POST', body: body({}) });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Failed to start encounter: ${response.statusText}`);
      }
      return response.json();
    },
    /** Send the OT's turn; returns the client's reply. POST /encounter/message/. */
    async message(sessionId: string, message: string): Promise<{ reply: string }> {
      const response = await request('/encounter/message/', { method: 'POST', body: body({ session_id: sessionId, message }) });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `The client didn't respond: ${response.statusText}`);
      }
      return response.json();
    },
    /** End + score the encounter. POST /encounter/finish/. */
    async finish(sessionId: string): Promise<{ result: EncounterResult }> {
      const response = await request('/encounter/finish/', { method: 'POST', body: body({ session_id: sessionId }) });
      if (!response.ok) throw new Error(`Failed to score encounter: ${response.statusText}`);
      return response.json();
    },
  },

  /** Returns the user's saved rationale notebook. GET /notebook/. */
  async getNotebook(): Promise<{ items: NoteEntry[] }> {
    const response = await request('/notebook/');
    if (!response.ok) throw new Error(`Failed to fetch notebook: ${response.statusText}`);
    return response.json();
  },

  /** Saves (dedups by id) a rationale to the notebook. POST /notebook/. */
  async addNote(entry: NoteEntry): Promise<{ items: NoteEntry[] }> {
    const response = await request('/notebook/', { method: 'POST', body: body(entry) });
    if (!response.ok) throw new Error(`Failed to save note: ${response.statusText}`);
    return response.json();
  },

  /** Removes a notebook entry by id. DELETE /notebook/?id=... */
  async removeNote(id: string): Promise<{ items: NoteEntry[] }> {
    const response = await request(`/notebook/?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(`Failed to remove note: ${response.statusText}`);
    return response.json();
  },

  /** AI case generation is disabled — the app serves only vetted bank content. */
  async generateCase(_domain: string, _difficulty: string): Promise<CaseStudy> {
    throw new Error('AI case generation is disabled. Practice uses the vetted question bank.');
  },

  /** AI minting is disabled — no background case generation. No-op. */
  async prefetchCase(_domain: string, _difficulty: string): Promise<void> {
    return;
  },

  /**
   * Saves study progress (current question index / completion) for a case.
   * POST /sessions/save_progress/. Non-fatal on auth failure.
   */
  async saveSession(caseId: string, index: number, isCompleted: boolean): Promise<void> {
    const response = await request('/sessions/save_progress/', {
      method: 'POST',
      body: body({ case_study_id: caseId, current_index: index, is_completed: isCompleted }),
    });
    if (response.status === 401 || response.status === 403) {
      console.warn('User not logged in, progress not saved to server.');
    }
  },

  /** Resumes the last saved session for a case. GET /sessions/resume/?case_id=... */
  async getSession(caseId: string): Promise<{ currentIndex: number, isCompleted: boolean } | null> {
    const response = await request(`/sessions/resume/?case_id=${caseId}`);
    if (response.ok) {
      const data = await response.json();
      if (data && typeof data.current_question_index === 'number') {
        return { currentIndex: data.current_question_index, isCompleted: data.is_completed };
      }
    }
    return null;
  },

  /**
   * Evidence-Link analysis of the user's highlights vs. expert indicators.
   * POST /answers/evidence_link/. Returns a safe default on failure (never throws).
   */
  async getEvidenceLink(params: {
    vignette: string;
    question_id: string;
    user_highlights: { start: number; end: number; text: string }[];
  }): Promise<{
    expert_highlights: { start: number; end: number; text: string; importance: string }[];
    matched_count: number;
    missed_indicators: { start: number; end: number; text: string; importance: string }[];
    perceptual_tip: string;
    score: number;
  }> {
    const response = await request('/answers/evidence_link/', { method: 'POST', body: body(params) });
    if (!response.ok) {
      console.warn('Failed to get evidence link:', response.status);
      return { expert_highlights: [], matched_count: 0, missed_indicators: [], perceptual_tip: 'Evidence analysis unavailable.', score: 0 };
    }
    return response.json();
  },

  /**
   * Durable per-user preference/flag store backed by Django's /memory/ endpoint
   * (AgentMemory). Replaces ad-hoc browser localStorage so device UI prefs and
   * study flags follow the user across devices. Values are arbitrary JSON.
   */
  memory: {
    /** Reads a single memory value by key, or null if unset. GET /memory/?key=... */
    async get<T = any>(key: string): Promise<T | null> {
      const response = await request(`/memory/?key=${encodeURIComponent(key)}`);
      if (!response.ok) return null;
      const rows = await response.json();
      return Array.isArray(rows) && rows.length ? (rows[0].value as T) : null;
    },

    /** Upserts a memory value by key. POST /memory/set/. Best-effort. */
    async set(key: string, value: any, category = 'general'): Promise<void> {
      await request('/memory/set/', { method: 'POST', body: JSON.stringify({ key, value, category }) })
        .catch(err => console.warn('memory.set failed:', err));
    },
  },

  /**
   * Per-case vignette highlights persisted to Django (/highlights/), so a
   * learner's marked passages survive refresh and follow them across devices.
   */
  highlights: {
    /** Lists the user's highlights for one case. GET /highlights/?case_study=... */
    async list(caseId: string): Promise<{ id: string; start: number; end: number; text: string }[]> {
      const response = await request(`/highlights/?case_study=${encodeURIComponent(caseId)}`);
      if (!response.ok) return [];
      const rows = await response.json();
      return (rows || []).map((h: any) => ({ id: h.id, start: h.start_index, end: h.end_index, text: h.text }));
    },

    /** Persists one highlight. POST /highlights/. Best-effort; never throws. */
    async create(caseId: string, h: { id: string; start: number; end: number; text: string }): Promise<void> {
      await request('/highlights/', {
        method: 'POST',
        body: JSON.stringify({ id: h.id, case_study: caseId, start_index: h.start, end_index: h.end, text: h.text }),
      }).catch(err => console.warn('highlight create failed:', err));
    },

    /** Removes one highlight by id. DELETE /highlights/{id}/. Best-effort. */
    async remove(id: string): Promise<void> {
      await request(`/highlights/${encodeURIComponent(id)}/`, { method: 'DELETE' })
        .catch(err => console.warn('highlight remove failed:', err));
    },
  },

  /**
   * Mock Study Flow API — grouped endpoints for the timed practice/exam mode.
   */
  mockStudy: {
    /** Starts a new mock-study session. POST /mock-study/start/. Throws on failure. */
    async start(domain: string, difficulty: string, total_questions: number, mode: 'practice' | 'exam' = 'practice'): Promise<any> {
      const response = await request('/mock-study/start/', { method: 'POST', body: body({ domain, difficulty, total_questions, mode }) });
      if (!response.ok) throw new Error('Failed to start session');
      return response.json();
    },

    /** Submits the current question's answer. POST /mock-study/submit/. Throws on failure. */
    async submitAnswer(sessionId: string, selectedLabel: string): Promise<any> {
      const response = await request('/mock-study/submit/', { method: 'POST', body: body({ session_id: sessionId, selected_label: selectedLabel }) });
      if (!response.ok) throw new Error('Failed to submit answer');
      return response.json();
    },

    /** Advances to and fetches the next question. POST /mock-study/next/. Throws on failure. */
    async nextQuestion(sessionId: string): Promise<any> {
      const response = await request('/mock-study/next/', { method: 'POST', body: body({ session_id: sessionId }) });
      if (!response.ok) throw new Error('Failed to fetch next question');
      return response.json();
    },

    /** Asks the backend to prepare the next question ahead of time. Fire-and-forget. */
    async prefetch(sessionId: string): Promise<void> {
      request('/mock-study/prefetch/', { method: 'POST', body: body({ session_id: sessionId }) })
        .catch(err => console.warn('Prefetch failed:', err));
    },

    /** Server-authoritative exam clock. GET /mock-study/time/?session_id=... */
    async time(sessionId: string): Promise<{ timed: boolean; remaining_seconds: number | null; total_seconds: number | null; expired: boolean }> {
      const response = await request(`/mock-study/time/?session_id=${encodeURIComponent(sessionId)}`);
      if (!response.ok) throw new Error(`Failed to fetch exam time: ${response.statusText}`);
      return response.json();
    },

    /** Finalizes a session immediately and returns its score. POST /mock-study/finish/. */
    async finish(sessionId: string): Promise<{ is_complete: boolean; final_score: { correct: number; total: number; percentage: number; answered: number } }> {
      const response = await request('/mock-study/finish/', { method: 'POST', body: body({ session_id: sessionId }) });
      if (!response.ok) throw new Error(`Failed to finish session: ${response.statusText}`);
      return response.json();
    },

    /** Full exam state for (re)hydrating after a refresh. GET /mock-study/exam_state/?session_id=... */
    async examState(sessionId: string): Promise<ExamState> {
      const response = await request(`/mock-study/exam_state/?session_id=${encodeURIComponent(sessionId)}`);
      if (!response.ok) throw new Error(`Failed to load exam state: ${response.statusText}`);
      return response.json();
    },

    /** Record/clear one exam answer (label=null clears). Fire-and-forget. POST /mock-study/exam_answer/. */
    examAnswer(sessionId: string, index: number, label: string | null): void {
      request('/mock-study/exam_answer/', { method: 'POST', body: body({ session_id: sessionId, index, label }) })
        .catch(err => console.warn('exam_answer sync failed:', err));
    },

    /** Set/clear a flag on an exam question. Fire-and-forget. POST /mock-study/exam_flag/. */
    examFlag(sessionId: string, index: number, flagged: boolean): void {
      request('/mock-study/exam_flag/', { method: 'POST', body: body({ session_id: sessionId, index, flagged }) })
        .catch(err => console.warn('exam_flag sync failed:', err));
    },

    /** Grade + finalize the exam with the authoritative answers map. POST /mock-study/exam_submit/. */
    async examSubmit(sessionId: string, answers: Record<string, string>): Promise<{ is_complete: boolean; final_score: { correct: number; total: number; percentage: number; answered: number }; results: { index: number; selected_label: string | null; correct_label: string; is_correct: boolean }[] }> {
      const response = await request('/mock-study/exam_submit/', { method: 'POST', body: body({ session_id: sessionId, answers }) });
      if (!response.ok) throw new Error(`Failed to submit exam: ${response.statusText}`);
      return response.json();
    },

    /** Any in-progress session for the current user. GET /mock-study/get_active/. Null if none. */
    async getActiveSession(): Promise<any> {
      const response = await request('/mock-study/get_active/');
      if (!response.ok) return null;
      // "No active session" can come back as an empty body (204/empty 200), which
      // would make response.json() throw "Unexpected end of JSON input" and break
      // the whole initial-data load. Parse defensively.
      const text = await response.text();
      if (!text) return null;
      try { return JSON.parse(text); } catch { return null; }
    },

    /** Persists the session's in-progress highlights. POST /mock-study/save_progress/. */
    async saveSession(sessionId: string, highlights: any[]): Promise<void> {
      await request('/mock-study/save_progress/', { method: 'POST', body: body({ session_id: sessionId, highlights }) });
    },

    /** Requests an alternative ("pivot") variant of the current question. POST /mock-study/pivot/. */
    async pivotQuestion(sessionId: string): Promise<any> {
      const response = await request('/mock-study/pivot/', { method: 'POST', body: body({ session_id: sessionId }) });
      if (!response.ok) throw new Error('Failed to generate pivot');
      return response.json();
    }
  },

  /** Creates a Stripe Checkout session for a tier. POST /stripe/checkout/. Returns { url }. */
  async createCheckoutSession(tier: string): Promise<{ url: string }> {
    const origin = window.location.origin;
    const response = await request('/stripe/checkout/', {
      method: 'POST',
      body: body({ tier, success_url: `${origin}/payment/success`, cancel_url: `${origin}/payment/cancel` }),
    });
    if (!response.ok) throw new Error('Checkout session creation failed');
    return response.json();
  },

  /**
   * Free natural neural text-to-speech. POST /tts/ → MP3 audio Blob (or null on
   * failure, so the caller can fall back to browser speechSynthesis).
   */
  async tts(text: string, voice?: string | null, rate?: number): Promise<Blob | null> {
    try {
      const res = await request('/tts/', { method: 'POST', body: body({ text, voice: voice || undefined, rate: rate ?? 1 }) });
      if (!res.ok) return null;
      const blob = await res.blob();
      return blob.size > 0 ? blob : null;
    } catch {
      return null;
    }
  },

  /** Reconciles payment/subscription status with Stripe. POST /sync-payment/. */
  async syncPayment(): Promise<{ success: boolean; updated: boolean; is_paid: boolean; tier: string }> {
    const response = await request('/sync-payment/', { method: 'POST' });
    if (!response.ok) throw new Error('Payment sync failed');
    return response.json();
  },

  /**
   * B2B organization (tenant) API — RBAC member management, invites, cohort
   * analytics, and seat billing. The backend enforces tenant isolation + role
   * checks, so these never expose another org.
   */
  organizations: {
    /** GET /organizations/ — orgs the caller belongs to (staff: all). */
    async list(): Promise<Organization[]> {
      const response = await request('/organizations/');
      if (!response.ok) throw new Error('Failed to load organizations');
      return response.json();
    },

    /** GET /organizations/{id}/ — one org's seat/license state + caller role. */
    async get(orgId: number): Promise<Organization> {
      const response = await request(`/organizations/${orgId}/`);
      if (!response.ok) throw new Error('Failed to load organization');
      return response.json();
    },

    /** GET /organizations/{id}/members/ — roster (instructor/admin/owner). */
    async members(orgId: number): Promise<OrgMember[]> {
      const response = await request(`/organizations/${orgId}/members/`);
      if (!response.ok) throw new Error('Failed to load members');
      return response.json();
    },

    /** GET /organizations/{id}/analytics/ — per-student + rollup performance. */
    async analytics(orgId: number): Promise<OrgAnalytics> {
      const response = await request(`/organizations/${orgId}/analytics/`);
      if (!response.ok) throw new Error('Failed to load analytics');
      return response.json();
    },

    /** GET /organizations/{id}/pending_invites/ — open invites (admin+). */
    async pendingInvites(orgId: number): Promise<any[]> {
      const response = await request(`/organizations/${orgId}/pending_invites/`);
      if (!response.ok) throw new Error('Failed to load invites');
      return response.json();
    },

    /** POST /organizations/{id}/invite/ — invite a member by email (admin+). */
    async invite(orgId: number, email: string, role: OrgRole = 'member'): Promise<any> {
      const response = await request(`/organizations/${orgId}/invite/`, { method: 'POST', body: body({ email, role }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Invite failed');
      return response.json();
    },

    /** POST /organizations/{id}/set_role/ — change a member's role (admin+). */
    async setRole(orgId: number, userId: number, role: OrgRole): Promise<any> {
      const response = await request(`/organizations/${orgId}/set_role/`, { method: 'POST', body: body({ user_id: userId, role }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Role update failed');
      return response.json();
    },

    /** POST /organizations/{id}/remove_member/ — soft-remove a member (admin+). */
    async removeMember(orgId: number, userId: number): Promise<void> {
      const response = await request(`/organizations/${orgId}/remove_member/`, { method: 'POST', body: body({ user_id: userId }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Remove failed');
    },

    /** GET /organizations/{id}/assignments/ — active cohort assignments (members). */
    async assignments(orgId: number): Promise<CohortAssignment[]> {
      const response = await request(`/organizations/${orgId}/assignments/`);
      if (!response.ok) throw new Error('Failed to load assignments');
      return response.json();
    },

    /** POST /organizations/{id}/assignments/ — create an assignment (instructor+). */
    async createAssignment(orgId: number, data: Partial<CohortAssignment>): Promise<CohortAssignment> {
      const response = await request(`/organizations/${orgId}/assignments/`, { method: 'POST', body: body(data) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Could not create assignment');
      return response.json();
    },

    /** POST /organizations/{id}/assignments/{aid}/archive/ — deactivate (instructor+). */
    async archiveAssignment(orgId: number, assignmentId: number): Promise<void> {
      const response = await request(`/organizations/${orgId}/assignments/${assignmentId}/archive/`, { method: 'POST' });
      if (!response.ok) throw new Error('Could not archive assignment');
    },

    /** GET /organizations/my_assignments/ — the caller's org assignments (student view). */
    async myAssignments(): Promise<CohortAssignment[]> {
      const response = await request('/organizations/my_assignments/');
      if (!response.ok) return [];
      return response.json();
    },

    /** POST /organizations/accept_invite/ — redeem an invite token (any user). */
    async acceptInvite(token: string): Promise<Organization> {
      const response = await request('/organizations/accept_invite/', { method: 'POST', body: body({ token }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Could not accept invitation');
      return response.json();
    },

    /** POST /organizations/{id}/checkout_seats/ — start Stripe seat checkout (admin+). */
    async checkoutSeats(orgId: number, seats: number): Promise<{ url: string }> {
      const response = await request(`/organizations/${orgId}/checkout_seats/`, { method: 'POST', body: body({ seats }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Checkout failed');
      return response.json();
    },
  }
};

// --- DATA TRANSFORMERS ---

/**
 * Normalizes a raw backend case-study payload into the app's typed CaseStudy model.
 * Maps snake_case API fields to camelCase, and folds each distractor's
 * `incorrect_rationale` into a label -> rationale lookup (`incorrectRationales`).
 */
function transformCaseStudy(data: any): CaseStudy {
  return {
    id: data.id,
    title: data.title,
    vignette: data.vignette,
    setting: data.setting,
    questions: data.questions.map((q: any) => ({
      id: q.id,
      stem: q.stem,
      domain: q.domain, // Enum matching relies on string equality
      correctLabel: q.correct_label,
      correctRationale: q.correct_rationale,
      distractors: q.distractors.map((d: any) => ({
        label: d.label,
        text: d.text
      })),
      incorrectRationales: q.distractors.reduce((acc: any, d: any) => {
        if (d.incorrect_rationale) {
          acc[d.label] = d.incorrect_rationale;
        }
        return acc;
      }, {} as Record<string, string>)
    }))
  };
}
