
/**
 * @file api.ts
 * @description Frontend HTTP client for the NOTCE backend (Django REST) API.
 * Exposes a single `api` object whose methods wrap `fetch` calls to the backend
 * REST endpoints (case studies, AI rationale/case generation, auth, sessions,
 * mock-study flow, Stripe checkout, payment sync). Most authenticated requests
 * read a JWT from `localStorage` ('auth_token') and attach it as a Bearer token.
 * Raw backend payloads are normalized into the app's typed models via the data
 * transformers at the bottom of the file.
 */

import { CaseStudy, User, Performance, ReviewQueue, NoteEntry, ExamState, Organization, OrgMember, OrgAnalytics, OrgRole, CohortAssignment } from '../types';

// Base URL for all API requests. Prefers the Vite-injected env var (set per
// deployment), and falls back to the local dev backend when it's not defined.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export const api = {
  /**
   * Fetches all available case studies.
   * GET /cases/ (Bearer auth required). Sends nothing.
   * Returns the list mapped through `transformCaseStudy` into typed CaseStudy objects.
   * Throws on a non-OK response.
   */
  async getCases(): Promise<CaseStudy[]> {
    // /cases/ requires authentication; attach the JWT or the call 401s.
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${API_BASE_URL}/cases/`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch cases: ${response.statusText}`);
    }
    const data = await response.json();
    return data.map(transformCaseStudy);
  },

  /**
   * Fetches a single case study by ID.
   * GET /cases/{id}/ (Bearer auth required). Sends the `id` in the URL path.
   * Returns the normalized CaseStudy. Throws on a non-OK response.
   */
  async getCase(id: string): Promise<CaseStudy> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${API_BASE_URL}/cases/${id}/`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch case ${id}: ${response.statusText}`);
    }
    const data = await response.json();
    return transformCaseStudy(data);
  },

  /**
   * Requests an evolving rationale (AI tutoring feedback) from the AI.
   * POST /answers/get_rationale/ with optional Bearer auth.
   * Sends the question id plus context about the user's previous answer/streak.
   * Returns the rationale string; on failure returns '' (does not throw) so the UI keeps working.
   */
  async getRationale(context: {
    question_id: string;
    previous_answer?: { is_correct: boolean; selected_label: string };
    all_previous_correct: boolean;
  }): Promise<string> {
    // Attach the JWT from localStorage as a Bearer token when the user is signed in.
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/answers/get_rationale/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(context)
    });
    if (!response.ok) {
      console.warn('Failed to fetch rationale:', response.status);
      return ''; // Return empty string instead of throwing to avoid breaking the UI
    }
    const data = await response.json();
    return data.rationale;
  },

  /**
   * Persists a case-study answer for cross-session analytics (Performance Hub).
   * POST /answers/ (auth required). The backend re-grades server-side, so a
   * client-supplied correctness is neither sent nor trusted.
   * Fire-and-forget: best-effort, never throws, so it can't break the study flow.
   */
  recordAnswer(questionId: string, selectedLabel: string, confidence: string): void {
    const token = localStorage.getItem('auth_token');
    if (!token) return; // analytics requires an authed user
    fetch(`${API_BASE_URL}/answers/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ question: questionId, selected_label: selectedLabel, confidence })
    }).catch(err => console.warn('Failed to record answer:', err));
  },

  /**
   * Fetches the cross-session Performance Hub payload for the signed-in user.
   * GET /performance/ (auth required). Returns the aggregated analytics object.
   * Throws on a non-OK response so the caller can render an error state.
   */
  async getPerformance(): Promise<Performance> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/performance/`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch performance: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Fetches the Adaptive Review Queue (weak items to revisit) for the user.
   * GET /review-queue/ (auth required). Throws on a non-OK response.
   */
  async getReviewQueue(): Promise<ReviewQueue> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/review-queue/`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch review queue: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Grades a spaced-repetition review and reschedules the item.
   * POST /review-queue/ { item_key, remembered } (auth). Best-effort: returns
   * null on failure so the review flow keeps moving.
   */
  async gradeReview(itemKey: string, remembered: boolean): Promise<{ box: number; due_at: string } | null> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const response = await fetch(`${API_BASE_URL}/review-queue/`, {
        method: 'POST', headers, body: JSON.stringify({ item_key: itemKey, remembered }),
      });
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  },

  /** Returns the user's saved rationale notebook. GET /notebook/ (auth). */
  async getNotebook(): Promise<{ items: NoteEntry[] }> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${API_BASE_URL}/notebook/`, { headers });
    if (!response.ok) throw new Error(`Failed to fetch notebook: ${response.statusText}`);
    return response.json();
  },

  /** Saves (dedups by id) a rationale to the notebook. POST /notebook/ (auth). */
  async addNote(entry: NoteEntry): Promise<{ items: NoteEntry[] }> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${API_BASE_URL}/notebook/`, { method: 'POST', headers, body: JSON.stringify(entry) });
    if (!response.ok) throw new Error(`Failed to save note: ${response.statusText}`);
    return response.json();
  },

  /** Removes a notebook entry by id. DELETE /notebook/?id=... (auth). */
  async removeNote(id: string): Promise<{ items: NoteEntry[] }> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${API_BASE_URL}/notebook/?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers });
    if (!response.ok) throw new Error(`Failed to remove note: ${response.statusText}`);
    return response.json();
  },

  /**
   * Triggers the generation of a new AI case study and waits for the result.
   * POST /cases/generate/ with optional Bearer auth.
   * Sends { domain, difficulty }. Returns the freshly generated, normalized CaseStudy.
   * Throws on a non-OK response.
   */
  async generateCase(_domain: string, _difficulty: string): Promise<CaseStudy> {
    // AI minting is disabled — the app serves only vetted, pre-minted bank content.
    throw new Error('AI case generation is disabled. Practice uses the vetted question bank.');
  },
  
  /**
   * Warms the backend cache by prefetching a new case study in the background.
   * POST /cases/prefetch/ with optional Bearer auth. Sends { domain, difficulty }.
   * Fire-and-forget: returns immediately without awaiting the response; errors are only logged.
   */
  async prefetchCase(_domain: string, _difficulty: string): Promise<void> {
    // AI minting is disabled — no background case generation. No-op.
    return;
  },

  /**
   * Register a new user.
   * POST /auth/register/ (no auth). Sends { username, email, password }.
   * Returns nothing on success; on failure throws an Error containing the backend's JSON error body.
   */
  async register(username: string, email: string, password: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData) || 'Registration failed');
    }
  },

  /**
   * Verify a user's email address using the token from the verification link.
   * POST /verify-email/ (no auth). Sends { token } (the email-verification token, not a JWT).
   * Returns nothing on success; throws with the backend's error message on failure.
   */
  async verifyEmail(token: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/verify-email/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Verification failed');
    }
  },

  /**
   * Log in and retrieve JWT tokens.
   * POST /auth/login/ (no auth). Sends { username, password }.
   * Returns { access, refresh } JWTs; the caller is responsible for storing `access`
   * (as 'auth_token' in localStorage) for use by the authenticated methods. Throws on failure.
   */
  async login(username: string, password: string): Promise<{ access: string, refresh: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/login/`, { // Changed to specific login path if needed, but using standard JWT endpoint usually
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
        throw new Error('Login failed');
    }
    return response.json();
  },

  /**
   * Saves the user's progress (current question index / completion) for a specific case.
   * POST /sessions/save_progress/ with optional Bearer auth.
   * Sends { case_study_id, current_index, is_completed }. Returns nothing.
   * If the user is unauthenticated (401/403) it silently no-ops instead of throwing.
   */
  async saveSession(caseId: string, index: number, isCompleted: boolean): Promise<void> {
    const token = localStorage.getItem('auth_token'); // Mock auth support
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/sessions/save_progress/`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ 
            case_study_id: caseId, 
            current_index: index, 
            is_completed: isCompleted 
        })
    });
    
    // Treat "not authenticated" as a non-error: just skip server-side persistence.
    if (response.status === 401 || response.status === 403) {
        console.warn("User not logged in, progress not saved to server.");
        return;
    }
  },

  /**
   * Resumes the last saved session for a specific case.
   * GET /sessions/resume/?case_id={caseId} with Bearer auth (required).
   * Returns { currentIndex, isCompleted } if a server session exists, otherwise null.
   */
  async getSession(caseId: string): Promise<{ currentIndex: number, isCompleted: boolean } | null> {
    const token = localStorage.getItem('auth_token');
    if (!token) return null; // No auth, no server session

    const response = await fetch(`${API_BASE_URL}/sessions/resume/?case_id=${caseId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const data = await response.json();
        if (data && typeof data.current_question_index === 'number') {
            return { 
                currentIndex: data.current_question_index, 
                isCompleted: data.is_completed 
            };
        }
    }
    return null;
  },

  /**
   * Analyzes the user's text highlights against expert clinical indicators ("evidence linking").
   * POST /answers/evidence_link/ with optional Bearer auth.
   * Sends { vignette, question_id, user_highlights[] }.
   * Returns expert highlights, match/miss counts, a perceptual tip, and a score.
   * On failure returns a safe empty/default result (does not throw) so the UI stays functional.
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
    // Attach the JWT from localStorage as a Bearer token when present.
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/answers/evidence_link/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      console.warn('Failed to get evidence link:', response.status);
      return {
        expert_highlights: [],
        matched_count: 0,
        missed_indicators: [],
        perceptual_tip: 'Evidence analysis unavailable.',
        score: 0
      };
    }
    
    return response.json();
  },


  /**
   * Mock Study Flow API — grouped endpoints for the timed practice/exam mode.
   * Every method attaches the localStorage JWT as a Bearer token (when present)
   * and talks to the backend's /mock-study/* routes.
   */
  mockStudy: {
    /**
     * Starts a new mock-study session.
     * POST /mock-study/start/ with optional Bearer auth.
     * Sends { domain, difficulty, total_questions, mode } (mode defaults to 'practice').
     * Returns the new session payload (untyped). Throws on failure.
     */
    async start(domain: string, difficulty: string, total_questions: number, mode: 'practice' | 'exam' = 'practice'): Promise<any> {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE_URL}/mock-study/start/`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ domain, difficulty, total_questions, mode })
        });
        if (!response.ok) throw new Error('Failed to start session');
        return response.json();
    },

    /**
     * Submits the user's answer for the current question in a session.
     * POST /mock-study/submit/ with optional Bearer auth.
     * Sends { session_id, selected_label }. Returns the grading result (untyped). Throws on failure.
     */
    async submitAnswer(sessionId: string, selectedLabel: string): Promise<any> {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE_URL}/mock-study/submit/`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ session_id: sessionId, selected_label: selectedLabel })
        });
        if (!response.ok) throw new Error('Failed to submit answer');
        return response.json();
    },

    /**
     * Advances to and fetches the next question in a session.
     * POST /mock-study/next/ with optional Bearer auth.
     * Sends { session_id }. Returns the next question payload (untyped). Throws on failure.
     */
    async nextQuestion(sessionId: string): Promise<any> {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE_URL}/mock-study/next/`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ session_id: sessionId })
        });
        if (!response.ok) throw new Error('Failed to fetch next question');
        return response.json();
    },

    /**
     * Asks the backend to prepare the next question ahead of time.
     * POST /mock-study/prefetch/ with optional Bearer auth. Sends { session_id }.
     * Fire-and-forget: not awaited, errors are only logged.
     */
    async prefetch(sessionId: string): Promise<void> {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // We don't wait for this or handle errors strictly as it's a background prefetch
        fetch(`${API_BASE_URL}/mock-study/prefetch/`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ session_id: sessionId })
        }).catch(err => console.warn('Prefetch failed:', err));
    },

    /**
     * Server-authoritative exam clock for a timed session.
     * GET /mock-study/time/?session_id=... with Bearer auth.
     * Returns { timed, remaining_seconds, total_seconds, expired }. The countdown
     * is computed from the server's stored start time, so it survives refreshes.
     */
    async time(sessionId: string): Promise<{ timed: boolean; remaining_seconds: number | null; total_seconds: number | null; expired: boolean }> {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const response = await fetch(`${API_BASE_URL}/mock-study/time/?session_id=${encodeURIComponent(sessionId)}`, { headers });
        if (!response.ok) throw new Error(`Failed to fetch exam time: ${response.statusText}`);
        return response.json();
    },

    /**
     * Finalizes a session immediately (e.g. exam timed out / ended early) and
     * returns its score. POST /mock-study/finish/ with Bearer auth.
     * Unanswered questions count as not-correct; `answered` reports attempts.
     */
    async finish(sessionId: string): Promise<{ is_complete: boolean; final_score: { correct: number; total: number; percentage: number; answered: number } }> {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const response = await fetch(`${API_BASE_URL}/mock-study/finish/`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ session_id: sessionId })
        });
        if (!response.ok) throw new Error(`Failed to finish session: ${response.statusText}`);
        return response.json();
    },

    /**
     * Exam navigator: full state for (re)hydrating after a refresh.
     * GET /mock-study/exam_state/?session_id=... with Bearer auth.
     */
    async examState(sessionId: string): Promise<ExamState> {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const response = await fetch(`${API_BASE_URL}/mock-study/exam_state/?session_id=${encodeURIComponent(sessionId)}`, { headers });
        if (!response.ok) throw new Error(`Failed to load exam state: ${response.statusText}`);
        return response.json();
    },

    /**
     * Exam navigator: record/clear one answer (label='' clears). Fire-and-forget
     * sync — the authoritative answers map is also sent on submit.
     * POST /mock-study/exam_answer/.
     */
    examAnswer(sessionId: string, index: number, label: string | null): void {
        const token = localStorage.getItem('auth_token');
        if (!token) return;
        fetch(`${API_BASE_URL}/mock-study/exam_answer/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ session_id: sessionId, index, label })
        }).catch(err => console.warn('exam_answer sync failed:', err));
    },

    /** Exam navigator: set/clear a flag on a question. POST /mock-study/exam_flag/. */
    examFlag(sessionId: string, index: number, flagged: boolean): void {
        const token = localStorage.getItem('auth_token');
        if (!token) return;
        fetch(`${API_BASE_URL}/mock-study/exam_flag/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ session_id: sessionId, index, flagged })
        }).catch(err => console.warn('exam_flag sync failed:', err));
    },

    /**
     * Exam navigator: grade + finalize. Sends the authoritative answers map.
     * POST /mock-study/exam_submit/. Returns the score + per-question results.
     */
    async examSubmit(sessionId: string, answers: Record<string, string>): Promise<{ is_complete: boolean; final_score: { correct: number; total: number; percentage: number; answered: number }; results: { index: number; selected_label: string | null; correct_label: string; is_correct: boolean }[] }> {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const response = await fetch(`${API_BASE_URL}/mock-study/exam_submit/`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ session_id: sessionId, answers })
        });
        if (!response.ok) throw new Error(`Failed to submit exam: ${response.statusText}`);
        return response.json();
    },


    /**
     * Looks up any in-progress mock-study session for the current user.
     * GET /mock-study/get_active/ with Bearer auth (required).
     * Returns the active session payload (untyped), or null when unauthenticated / none exists.
     */
    async getActiveSession(): Promise<any> {
        const token = localStorage.getItem('auth_token');
        if (!token) return null;

        const response = await fetch(`${API_BASE_URL}/mock-study/get_active/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 200) {
            const data = await response.json();
            return data;
        }
        return null; // No active session
    },

    /**
     * Persists the user's in-progress highlights for a session.
     * POST /mock-study/save_progress/ with optional Bearer auth.
     * Sends { session_id, highlights[] }. Returns nothing and does not check the response status.
     */
    async saveSession(sessionId: string, highlights: any[]): Promise<void> {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        await fetch(`${API_BASE_URL}/mock-study/save_progress/`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ session_id: sessionId, highlights })
        });
    },

    /**
     * Requests an alternative ("pivot") variant of the current question.
     * POST /mock-study/pivot/ with optional Bearer auth.
     * Sends { session_id }. Returns the pivoted question payload (untyped). Throws on failure.
     */
    async pivotQuestion(sessionId: string): Promise<any> {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE_URL}/mock-study/pivot/`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ session_id: sessionId })
        });

        if (!response.ok) throw new Error('Failed to generate pivot');
        return response.json();
    }
  },

  /**
   * Creates a Stripe Checkout session for a subscription tier.
   * POST /stripe/checkout/ with optional Bearer auth.
   * Sends { tier, success_url, cancel_url } (success/cancel URLs are built from the current origin).
   * Returns { url } — the Stripe-hosted checkout page to redirect the user to. Throws on failure.
   */
  async createCheckoutSession(tier: string): Promise<{ url: string }> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Send Stripe back to the real app routes on whatever origin we're on.
    // The backend appends ?session_id={CHECKOUT_SESSION_ID} to success_url.
    const origin = window.location.origin;
    const response = await fetch(`${API_BASE_URL}/stripe/checkout/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            tier,
            success_url: `${origin}/payment/success`,
            cancel_url: `${origin}/payment/cancel`,
        })
    });
    if (!response.ok) throw new Error('Checkout session creation failed');
    return response.json();
  },

  /**
   * Fetches the currently authenticated user's profile.
   * GET /auth/me/ with Bearer auth. Sends nothing.
   * Returns the typed User object. Throws on a non-OK response.
   */
  async getMe(): Promise<User> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/auth/me/`, {
        method: 'GET',
        headers
    });
    if (!response.ok) throw new Error('Failed to fetch user data');
    return response.json();
  },

  /**
   * Updates onboarding/profile preferences for the current user.
   * PATCH /auth/me/ with Bearer auth. Sends { target_exam_date?, goal_domains? }.
   * Returns the refreshed User. Throws on a non-OK response.
   */
  async updateProfile(data: { target_exam_date?: string | null; goal_domains?: string[] }): Promise<User> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/auth/me/`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update profile');
    return response.json();
  },

  /**
   * Reconciles the user's payment/subscription status with Stripe.
   * POST /sync-payment/ with Bearer auth. Sends nothing.
   * Returns { success, updated, is_paid, tier } reflecting the refreshed status. Throws on failure.
   */
  async syncPayment(): Promise<{ success: boolean; updated: boolean; is_paid: boolean; tier: string }> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/sync-payment/`, {
        method: 'POST',
        headers
    });
    if (!response.ok) throw new Error('Payment sync failed');
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
      const token = localStorage.getItem('auth_token');
      if (!token) return null;
      const response = await fetch(`${API_BASE_URL}/memory/?key=${encodeURIComponent(key)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) return null;
      const rows = await response.json();
      return Array.isArray(rows) && rows.length ? (rows[0].value as T) : null;
    },

    /** Upserts a memory value by key. POST /memory/set/ { key, value, category }. */
    async set(key: string, value: any, category = 'general'): Promise<void> {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      await fetch(`${API_BASE_URL}/memory/set/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ key, value, category }),
      }).catch(err => console.warn('memory.set failed:', err));
    },
  },

  /**
   * Per-case vignette highlights persisted to Django (/highlights/), so a
   * learner's marked passages survive refresh and follow them across devices.
   */
  highlights: {
    /** Lists the user's highlights for one case. GET /highlights/?case_study=... */
    async list(caseId: string): Promise<{ id: string; start: number; end: number; text: string }[]> {
      const token = localStorage.getItem('auth_token');
      if (!token) return [];
      const response = await fetch(`${API_BASE_URL}/highlights/?case_study=${encodeURIComponent(caseId)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) return [];
      const rows = await response.json();
      // Map the snake_case offsets onto the frontend Highlight shape.
      return (rows || []).map((h: any) => ({ id: h.id, start: h.start_index, end: h.end_index, text: h.text }));
    },

    /** Persists one highlight. POST /highlights/. Best-effort; never throws. */
    async create(caseId: string, h: { id: string; start: number; end: number; text: string }): Promise<void> {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      await fetch(`${API_BASE_URL}/highlights/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id: h.id, case_study: caseId, start_index: h.start, end_index: h.end, text: h.text }),
      }).catch(err => console.warn('highlight create failed:', err));
    },

    /** Removes one highlight by id. DELETE /highlights/{id}/. Best-effort. */
    async remove(id: string): Promise<void> {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      await fetch(`${API_BASE_URL}/highlights/${encodeURIComponent(id)}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      }).catch(err => console.warn('highlight remove failed:', err));
    },
  },

  /**
   * Updates onboarding/profile flags. PATCH /auth/me/ — extends updateProfile
   * with the server-persisted onboarding flag (replaces the localStorage flag).
   */
  async setOnboardingCompleted(completed: boolean): Promise<void> {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    await fetch(`${API_BASE_URL}/auth/me/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ onboarding_completed: completed }),
    }).catch(err => console.warn('setOnboardingCompleted failed:', err));
  },

  /**
   * B2B organization (tenant) API — RBAC member management, invites, cohort
   * analytics, and seat billing. All calls require a Bearer token; the backend
   * enforces tenant isolation + role checks, so these never expose another org.
   */
  organizations: {
    async _headers(): Promise<Record<string, string>> {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return headers;
    },

    /** GET /organizations/ — orgs the caller belongs to (staff: all). */
    async list(): Promise<Organization[]> {
      const response = await fetch(`${API_BASE_URL}/organizations/`, { headers: await this._headers() });
      if (!response.ok) throw new Error('Failed to load organizations');
      return response.json();
    },

    /** GET /organizations/{id}/ — one org's seat/license state + caller role. */
    async get(orgId: number): Promise<Organization> {
      const response = await fetch(`${API_BASE_URL}/organizations/${orgId}/`, { headers: await this._headers() });
      if (!response.ok) throw new Error('Failed to load organization');
      return response.json();
    },

    /** GET /organizations/{id}/members/ — roster (instructor/admin/owner). */
    async members(orgId: number): Promise<OrgMember[]> {
      const response = await fetch(`${API_BASE_URL}/organizations/${orgId}/members/`, { headers: await this._headers() });
      if (!response.ok) throw new Error('Failed to load members');
      return response.json();
    },

    /** GET /organizations/{id}/analytics/ — per-student + rollup performance. */
    async analytics(orgId: number): Promise<OrgAnalytics> {
      const response = await fetch(`${API_BASE_URL}/organizations/${orgId}/analytics/`, { headers: await this._headers() });
      if (!response.ok) throw new Error('Failed to load analytics');
      return response.json();
    },

    /** GET /organizations/{id}/pending_invites/ — open invites (admin+). */
    async pendingInvites(orgId: number): Promise<any[]> {
      const response = await fetch(`${API_BASE_URL}/organizations/${orgId}/pending_invites/`, { headers: await this._headers() });
      if (!response.ok) throw new Error('Failed to load invites');
      return response.json();
    },

    /** POST /organizations/{id}/invite/ — invite a member by email (admin+). */
    async invite(orgId: number, email: string, role: OrgRole = 'member'): Promise<any> {
      const response = await fetch(`${API_BASE_URL}/organizations/${orgId}/invite/`, {
        method: 'POST', headers: await this._headers(), body: JSON.stringify({ email, role }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Invite failed');
      return response.json();
    },

    /** POST /organizations/{id}/set_role/ — change a member's role (admin+). */
    async setRole(orgId: number, userId: number, role: OrgRole): Promise<any> {
      const response = await fetch(`${API_BASE_URL}/organizations/${orgId}/set_role/`, {
        method: 'POST', headers: await this._headers(), body: JSON.stringify({ user_id: userId, role }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Role update failed');
      return response.json();
    },

    /** POST /organizations/{id}/remove_member/ — soft-remove a member (admin+). */
    async removeMember(orgId: number, userId: number): Promise<void> {
      const response = await fetch(`${API_BASE_URL}/organizations/${orgId}/remove_member/`, {
        method: 'POST', headers: await this._headers(), body: JSON.stringify({ user_id: userId }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Remove failed');
    },

    /** GET /organizations/{id}/assignments/ — active cohort assignments (members). */
    async assignments(orgId: number): Promise<CohortAssignment[]> {
      const response = await fetch(`${API_BASE_URL}/organizations/${orgId}/assignments/`, { headers: await this._headers() });
      if (!response.ok) throw new Error('Failed to load assignments');
      return response.json();
    },

    /** POST /organizations/{id}/assignments/ — create an assignment (instructor+). */
    async createAssignment(orgId: number, data: Partial<CohortAssignment>): Promise<CohortAssignment> {
      const response = await fetch(`${API_BASE_URL}/organizations/${orgId}/assignments/`, {
        method: 'POST', headers: await this._headers(), body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Could not create assignment');
      return response.json();
    },

    /** POST /organizations/{id}/assignments/{aid}/archive/ — deactivate (instructor+). */
    async archiveAssignment(orgId: number, assignmentId: number): Promise<void> {
      const response = await fetch(`${API_BASE_URL}/organizations/${orgId}/assignments/${assignmentId}/archive/`, {
        method: 'POST', headers: await this._headers(),
      });
      if (!response.ok) throw new Error('Could not archive assignment');
    },

    /** GET /organizations/my_assignments/ — the caller's org assignments (student view). */
    async myAssignments(): Promise<CohortAssignment[]> {
      const response = await fetch(`${API_BASE_URL}/organizations/my_assignments/`, { headers: await this._headers() });
      if (!response.ok) return [];
      return response.json();
    },

    /** POST /organizations/accept_invite/ — redeem an invite token (any user). */
    async acceptInvite(token: string): Promise<Organization> {
      const response = await fetch(`${API_BASE_URL}/organizations/accept_invite/`, {
        method: 'POST', headers: await this._headers(), body: JSON.stringify({ token }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Could not accept invitation');
      return response.json();
    },

    /** POST /organizations/{id}/checkout_seats/ — start Stripe seat checkout (admin+). */
    async checkoutSeats(orgId: number, seats: number): Promise<{ url: string }> {
      const response = await fetch(`${API_BASE_URL}/organizations/${orgId}/checkout_seats/`, {
        method: 'POST', headers: await this._headers(), body: JSON.stringify({ seats }),
      });
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
 * Pure helper (no network/auth); used by getCases/getCase/generateCase.
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
