/**
 * @file App.tsx
 * @description The main application component for NOTCE AI-Tutor.
 * Orchestrates the user flow between 'Study Mode' (case study vignette and questions) and 'Dashboard' (analytics).
 * Manages global state including current case, user answers, highlights, and AI-driven feedback.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { CaseStudy, QuestionItem, Highlight, UserAnswer, ConfidenceLevel, DomainTag, DomainStats, ExpertHighlight, EvidenceLinkResult } from './types';
import { VIEW_TO_PATH, PATH_TO_VIEW, isAppPath, HOME_PATH } from './routes';
import { DOMAIN_INFO } from './constants';
import HighlightableText from './components/HighlightableText';
import MainDashboard from './components/MainDashboard';
import { AuthProvider, useAuth } from './components/AuthContext';
import LoginPage from './components/Auth/LoginPage';
import RegisterPage from './components/Auth/RegisterPage';
import { api } from './services/api';
import Dashboard from './components/Dashboard';
import PerformanceHub from './components/PerformanceHub';
import { validateCaseStudy } from './services/geminiService';
import MockStudySession from './components/MockStudySession';
import MockStudySetupModal from './components/MockStudySetupModal';
import ExamSession from './components/ExamSession';

import LandingPage from './components/Landing/LandingPage';
import { VerifyEmailPage } from './components/Auth/VerifyEmailPage';
import AppShell, { ShellView } from './components/AppShell';
import OrgConsole from './components/OrgConsole';
import AcceptInvite, { PENDING_INVITE_KEY } from './components/AcceptInvite';
import { FeedbackProvider, useToast, useConfirm } from './components/ui/Feedback';
import OnboardingModal, { ONBOARDING_DISMISSED_KEY } from './components/OnboardingModal';

/**
 * MainApp
 * The authenticated experience. Mounted once behind a catch-all route so that
 * in-memory study/mock/exam state survives client-side navigation. The active
 * "view" is derived from the URL (see `view` below) rather than local state,
 * making the URL the single source of truth for which screen renders.
 * @returns The AppShell wrapping the currently-selected view.
 */
const MainApp: React.FC = () => {
    // Auth + global UX helpers (toast notifications, confirm dialogs).
    const { logout, user, refreshProfile } = useAuth();
    const toast = useToast();
    const confirm = useConfirm();

  // --- STATE MANAGEMENT ---

  // Signal to open the Case Generator modal from anywhere (sidebar/top-bar
  // "New Case"). Incrementing the nonce triggers MainDashboard to open it, so
  // both "New Case" entry points behave identically (open the picker).
  const [generatorNonce, setGeneratorNonce] = useState(0);

  // Items the user flags for later review during a study case (local to the
  // current case bundle). A real cross-session queue is a backend feature.
  const [flaggedItems, setFlaggedItems] = useState<Set<string>>(new Set());

  // First-run onboarding: shown until the user sets a target exam date (or skips).
  const [onboardingClosed, setOnboardingClosed] = useState(false);

  // Current case study being worked on
  const [currentCase, setCurrentCase] = useState<CaseStudy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false); // New state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Index of the currently displayed question
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  // User-created text highlights in the vignette
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  
  // Collection of user answers
  const [answers, setAnswers] = useState<UserAnswer[]>([]);
  
  // Flag indicating if the user has finished all questions in the case
  const [isCaseComplete, setIsCaseComplete] = useState(false);
  
  // Mobile-specific UI state for the vignette sheet
  const [isMobileVignetteOpen, setIsMobileVignetteOpen] = useState(false);
  
  // Form state for the current question
  const [selectedConfidence, setSelectedConfidence] = useState<ConfidenceLevel | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  
  // AI-generated tip text
  const [evolvingTip, setEvolvingTip] = useState<string | null>(null);
  
  // Result of blueprint validation checks
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  
  // Evidence-Link analysis result (AI-identified clinical indicators)
  const [evidenceLinkResult, setEvidenceLinkResult] = useState<EvidenceLinkResult | null>(null);
  
  // Routing: the current view is derived from the URL (single source of truth).
  const navigate = useNavigate();
  const location = useLocation();
  const view = PATH_TO_VIEW[location.pathname] ?? 'landing';
  
  // Mock Study State
  const [isMockSetupOpen, setIsMockSetupOpen] = useState(false);
  const [mockSessionId, setMockSessionId] = useState<string | null>(null);
  const [mockSessionData, setMockSessionData] = useState<any>(null);
  const [activeMockSession, setActiveMockSession] = useState<any>(null); // New state

  // --- EFFECTS ---

    // On the payment-success route (Stripe redirect target), sync payment status
    // with the backend and refresh the local profile. The route itself carries
    // the ?session_id Stripe appends; we don't need to read it here.
    useEffect(() => {
        if (view === 'payment-success') {
            toast('Confirming your payment…', 'info');
            api.syncPayment().then(() => {
                refreshProfile();
                toast("You're all set — Premium unlocked!", 'success');
            }).catch(err => {
                console.error("Failed to sync payment:", err);
                toast('Payment received, but syncing your account failed. Refresh in a moment.', 'warning', { duration: 8000 });
            });
        }
        // `toast` is stable (useCallback); excluded to keep this a view-change effect.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, refreshProfile]);

    // Route guards: keep the URL and the in-memory app state consistent.
    useEffect(() => {
        // Unknown/public path while authenticated -> the in-app home.
        if (!isAppPath(location.pathname)) {
            navigate(HOME_PATH, { replace: true });
            return;
        }
        // Session-backed views need a live session; a deep-link or refresh has
        // none in memory. Resume an active mock session if possible, else go home.
        if ((view === 'mock-study' || view === 'exam-mode') && !mockSessionId) {
            if (view === 'mock-study' && activeMockSession) {
                handleResumeMockStudy();
            } else {
                navigate(HOME_PATH, { replace: true });
            }
        }
    }, [location.pathname, view, mockSessionId, activeMockSession]);

    // Fetch initial data on mount
    useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        const [cases, mockSession] = await Promise.all([
            api.getCases(),
            api.mockStudy.getActiveSession()
        ]);
        
        if (mockSession) {
            setActiveMockSession(mockSession);
        }

          if (cases.length > 0) {
            const fullCase = await api.getCase(cases[0].id);
            setCurrentCase(fullCase);
            
            try {
                const session = await api.getSession(fullCase.id);
                if (session) {
                    console.log("Found saved session:", session);
                    setCurrentQuestionIndex(session.currentIndex);
                    if (session.isCompleted) {
                        setIsCaseComplete(true);
                    } else if (session.currentIndex > 0) {
                        // Let the user know their place was restored from a prior visit.
                        toast(`Welcome back — resumed at question ${session.currentIndex + 1}.`, 'info');
                    }
                }
            } catch (e) {
                console.warn("Failed to check for saved session", e);
            }
        }
      } catch (err) {
        console.warn("Could not load initial data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // Validate the case study against blueprint standards once loaded
  useEffect(() => {
    if (currentCase) {
        validateCaseStudy(currentCase).then(setValidationResult);
    }
  }, [currentCase]);

  /**
   * Adaptive Logic Effect:
   * Generates an "evolving rationale" or tip using Gemini AI when the user progresses to a new question.
   * Based on their performance in the previous question.
   */
  useEffect(() => {
    if (currentCase && currentQuestionIndex > 0 && view === 'study') {
      const prevAnswer = answers.find(a => a.questionId === currentCase.questions[currentQuestionIndex - 1].id);
      if (prevAnswer) {
        const isCorrect = prevAnswer.selectedLabel === currentCase.questions[currentQuestionIndex - 1].correctLabel;
        const allCorrect = answers.every((a, idx) => {
          if (idx >= currentQuestionIndex) return true;
          return a.selectedLabel === currentCase.questions[idx].correctLabel;
        });
        
        api.getRationale({
          question_id: currentCase.questions[currentQuestionIndex].id,
          previous_answer: { is_correct: isCorrect, selected_label: prevAnswer.selectedLabel },
          all_previous_correct: allCorrect
        }).then(setEvolvingTip).catch(console.error);
      }
    } else {
      setEvolvingTip(null);
    }
  }, [currentQuestionIndex, view, currentCase, answers]);

  /**
   * Background Prefetch Logic:
   * When a user starts a case study, prefetch the next one in the background
   * to reduce latency if they choose to generate another one.
   */
  useEffect(() => {
    if (view === 'study' && currentCase) {
        const domain = currentCase.tags?.find(t => t !== 'AI-Generated' && t !== 'Prefetched') || 'OT Expertise';
        const difficulty = currentCase.tags?.find(t => ['Easy', 'Medium', 'Hard'].includes(t)) || 'Medium';
        
        const timer = setTimeout(() => {
            api.prefetchCase(domain, difficulty);
        }, 8000); // Wait 8s to prioritize current interactive experience
        return () => clearTimeout(timer);
    }
  }, [view, currentCase?.id]);



  /**
   * Keyboard navigation for Study Mode: A–D or 1–4 select an option, and Enter
   * submits when an option + confidence are chosen. Ignored while typing in a
   * field so it never fights real inputs.
   */
  useEffect(() => {
    if (view !== 'study' || !currentCase || isCaseComplete) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      const question = currentCase.questions[currentQuestionIndex];
      if (!question) return;

      const key = e.key.toUpperCase();
      // Letter keys (A–D) map directly to labels.
      const byLetter = question.distractors.find(d => d.label.toUpperCase() === key);
      // Number keys (1–4) map to option position.
      const numIdx = '123456789'.indexOf(e.key);
      const byNumber = numIdx >= 0 ? question.distractors[numIdx] : undefined;
      const picked = byLetter || byNumber;

      if (picked) {
        e.preventDefault();
        setSelectedLabel(picked.label);
      } else if (e.key === 'Enter' && selectedLabel && selectedConfidence && !isSubmitting) {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, currentCase, currentQuestionIndex, isCaseComplete, selectedLabel, selectedConfidence, isSubmitting]);


  // --- ACTIONS ---

  /** Append a new user highlight to the vignette. */
  const addHighlight = (h: Highlight) => setHighlights(prev => [...prev, h]);
  /** Remove a user highlight by its id. */
  const removeHighlight = (id: string) => setHighlights(prev => prev.filter(h => h.id !== id));

  /** Toggle a question's flagged-for-review state (local to the current case). */
  const toggleFlag = (questionId: string) => {
    setFlaggedItems(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
        toast("Flag removed.", "info");
      } else {
        next.add(questionId);
        toast("Item flagged for review.", "success");
      }
      return next;
    });
  };

  /**
   * Handles submission of an answer.
   * Records the answer, confidence, and timestamp.
   * Calls Evidence-Link API for feedback on clinical reasoning.
   * Advances to the next question or completes the case.
   */
  const handleNext = async () => {
    if (!currentCase || !selectedLabel || !selectedConfidence || isSubmitting) return;

    setIsSubmitting(true);
    try {
        const currentQuestion = currentCase.questions[currentQuestionIndex];

    const newAnswer: UserAnswer = {
      questionId: currentQuestion.id,
      selectedLabel: selectedLabel,
      confidence: selectedConfidence,
      timestamp: Date.now()
    };

    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);

    // Persist the answer server-side for the cross-session Performance Hub
    // (best-effort, fire-and-forget — never blocks the study flow).
    api.recordAnswer(currentQuestion.id, selectedLabel, selectedConfidence);

    const hadHighlights = highlights.length > 0;

    // Call Evidence-Link API for clinical reasoning feedback
    try {
      const evidenceResult = await api.getEvidenceLink({
        vignette: currentCase.vignette,
        question_id: currentQuestion.id,
        user_highlights: highlights.map(h => ({ start: h.start, end: h.end, text: h.text }))
      });
      setEvidenceLinkResult(evidenceResult);
      // Only summarise when the user actually highlighted (avoids a misleading
      // "0% match" toast when they didn't engage the Evidence-Link mechanic).
      if (hadHighlights && evidenceResult && typeof evidenceResult.score === 'number') {
        const score = evidenceResult.score;
        toast(
          `Evidence-Link: ${score}% match with expert indicators.`,
          score >= 70 ? 'success' : score >= 40 ? 'info' : 'warning',
        );
      }
    } catch (err) {
      console.warn('Evidence-Link analysis failed:', err);
      setEvidenceLinkResult(null);
    }

    setSelectedLabel(null);
    setSelectedConfidence(null);

    if (currentQuestionIndex < currentCase.questions.length - 1) {
      // Confirm the answer landed; study mode defers correctness to the end summary.
      toast('Answer recorded.', 'success');
      setCurrentQuestionIndex(prev => prev + 1);
      // Clear evidence link result for next question (user will see briefly)
      setTimeout(() => setEvidenceLinkResult(null), 5000);
    } else {
      setIsCaseComplete(true);
    }
    } finally {
        setIsSubmitting(false);
    }
  };

  /**
   * Resets the entire application state for a fresh attempt at the case.
   */
  const resetCase = () => {
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setIsCaseComplete(false);
    navigate('/study');
    setHighlights([]);
  };

  /**
   * Triggers generation of a new AI case with specific domain and difficulty.
   */
    const handleGenerateCase = async (_domain?: string, _difficulty?: string) => {
        // AI minting is disabled — the app serves only vetted, pre-minted bank
        // questions. Route any "new case / generate" entry point into the bank-backed
        // Mock Study flow instead of calling the (now 403) generation endpoint.
        toast('Practice now uses our vetted question bank.', 'info');
        handleStartMockStudySetup();
    };

    /**
     * Builds a premium-gate message tailored to the user's state. Trial users are
     * excluded from premium actions server-side (IsPaidUser checks is_paid only),
     * so spell out that their trial covers Study Mode while the paid plan unlocks
     * the rest — clearer than a generic "Upgrade to Premium".
     */
    const premiumGateMessage = (feature: string) => {
        const profile = user?.userprofile;
        if (profile?.is_trial_active && !profile?.is_paid) {
            return `${feature} needs a paid plan. Your free trial covers Study Mode — upgrade to unlock it.`;
        }
        return `Upgrade to Premium to access ${feature}.`;
    };

    /**
     * Starts the Mock Study Setup process.
     */
    const handleStartMockStudySetup = () => {
        if (!user?.userprofile?.is_paid) {
            toast(premiumGateMessage('Adaptive Mock Study'), 'info');
            navigate(HOME_PATH);
            return;
        }
        setIsMockSetupOpen(true);
    };

    /**
     * Unified "New Case" entry point. Both the sidebar and top-bar buttons route
     * here: go to the in-app home and open the Case Generator picker (instead of
     * silently generating a hardcoded Physical Rehab / Medium case).
     */
    const handleNewCase = () => {
        // AI minting disabled — "New Case" now opens bank-backed practice.
        handleStartMockStudySetup();
    };

    /**
     * Launches a new Mock Study Session.
     */
    const handleLaunchMockStudy = async (domain: string, difficulty: string, length: number) => {
        if (!user?.userprofile?.is_paid) {
            toast(premiumGateMessage('Adaptive Mock Study'), 'info');
            return;
        }
        try {
            setIsGenerating(true);
            const data = await api.mockStudy.start(domain, difficulty, length);
            setMockSessionId(data.session_id);
            setMockSessionData(data);
            navigate('/mock-study');
            setIsMockSetupOpen(false);
            setActiveMockSession(data); // Set as active
        } catch (err) {
            console.error("Failed to start mock study:", err);
            toast("Failed to start mock study session. Please try again.", "error");
        } finally {
            setIsGenerating(false);
        }
    };

    /**
     * Smart Drill: one tap starts a focused mock session targeting the user's
     * weakest domain (from the Performance Hub recommendation), with no manual
     * domain/difficulty/length setup.
     */
    const handleSmartDrill = async () => {
        if (!user?.userprofile?.is_paid) {
            toast(premiumGateMessage('Smart Drill'), 'info');
            return;
        }
        // Resolve the weakest covered domain; if performance can't load, fall back
        // to a default rather than blocking. handleLaunchMockStudy owns the
        // session-start errors/loading state, so we don't double-handle them here.
        let domain = 'OT_EXP';
        try {
            const perf = await api.getPerformance();
            domain = perf.recommended_drill?.domain || 'OT_EXP';
        } catch (err) {
            console.warn('Smart Drill: could not load performance, using default domain:', err);
        }
        const label = (DOMAIN_INFO as Record<string, { label: string }>)[domain]?.label || domain;
        toast(`Smart Drill: targeting ${label}.`, 'info');
        await handleLaunchMockStudy(domain, 'Medium', 10);
    };

    /**
     * Resumes the user's previously-saved (still active) mock study session by
     * rehydrating its id/data into state and navigating to the mock view.
     */
    const handleResumeMockStudy = () => {
        if (activeMockSession) {
            setMockSessionId(activeMockSession.session_id);
            setMockSessionData(activeMockSession);
            navigate('/mock-study');
        }
    };

    /**
     * Launches a full Exam Simulation.
     */
    const handleLaunchExam = async () => {
        if (!user?.userprofile?.is_paid) {
            toast(premiumGateMessage('the Full Exam Simulation'), 'info');
            return;
        }
        const ok = await confirm({
            title: "Start Full Exam Simulation?",
            message: "This starts a timed 4-hour, 200-question simulation with no feedback until the end. Make sure you can finish in one sitting.",
            confirmLabel: "Start Exam",
            cancelLabel: "Not yet",
            tone: "danger",
        });
        if (!ok) return;
        try {
            setIsGenerating(true);
            // Default: Exam Mode = 'exam', 200 questions (although backend default covers it)
            const data = await api.mockStudy.start("MIXED", "Exam", 200, 'exam');
            setMockSessionId(data.session_id);
            setMockSessionData(data);
            navigate('/exam');
        } catch (err) {
            console.error("Failed to start exam:", err);
            toast("Failed to start exam session. Please try again.", "error");
        } finally {
            setIsGenerating(false);
        }
    };

    /**
     * Maps a sidebar nav selection to the right action. Mock Study and Exam
     * need a session, so they trigger their setup/launch flows rather than a
     * bare view switch.
     */
    const handleNavigate = (target: ShellView) => {
        switch (target) {
            case 'mock-study':
                if (activeMockSession) handleResumeMockStudy();
                else handleStartMockStudySetup();
                break;
            case 'exam-mode':
                handleLaunchExam();
                break;
            default:
                navigate(VIEW_TO_PATH[target]);
        }
    };

    /** Upgrade chip routes to Home, where plan/pricing options live. */
    const handleUpgrade = () => navigate(HOME_PATH);


  // --- COMPUTED VALUES ---

  /**
   * Calculates performance statistics per domain based on current answers.
   * Memoized to avoid expensive recalculations on every render.
   */
  const domainStats: DomainStats[] = useMemo(() => {
    if (!currentCase) return [];
    
    return Object.values(DomainTag).map(tag => {
      const tagQuestions = currentCase.questions.filter(q => q.domain === tag);
      const tagAnswers = answers.filter(a => {
        const q = currentCase.questions.find(cq => cq.id === a.questionId);
        return q?.domain === tag;
      });
      const correctCount = tagAnswers.filter(a => {
        const q = currentCase.questions.find(cq => cq.id === a.questionId);
        return q?.correctLabel === a.selectedLabel;
      }).length;

      return {
        tag,
        score: correctCount,
        total: tagQuestions.length,
        weight: DOMAIN_INFO[tag].weight
      };
    });
  }, [answers, currentCase]);

  // Total correct answers count
  const totalCorrect = useMemo(() => {
    if (!currentCase) return 0;
    return answers.filter(answer => {
      const question = currentCase.questions.find(q => q.id === answer.questionId);
      return question && question.correctLabel === answer.selectedLabel;
    }).length;
  }, [answers, currentCase]);

  // Current question being displayed
  const currentQuestion = currentCase?.questions[currentQuestionIndex];


  // --- RENDER ---

  // Render the persistent AppShell (sidebar/top-bar chrome) and conditionally
  // mount exactly one view body based on the URL-derived `view`. Each `view ===`
  // block below is mutually exclusive, acting as a URL-driven switch.
  return (
    <AppShell
      activeView={view}
      onNavigate={handleNavigate}
      user={user}
      onLogout={logout}
      onNewCase={handleNewCase}
      onResumeMock={activeMockSession ? handleResumeMockStudy : undefined}
      onUpgrade={handleUpgrade}
    >
        {/* Generating overlay (sits over content; sidebar stays visible) */}
        {isGenerating && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-gray-50/95 backdrop-blur-sm">
                <div className="text-center">
                    <div className="h-16 w-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Generating Magic...</h2>
                    <p className="text-gray-500 animate-pulse">Our AI is crafting a unique clinical scenario for you.</p>
                </div>
            </div>
        )}

        {/* In-app home: dashboard with stats + entry points to start cases/mock/exam */}
        {view === 'landing' && (
            <MainDashboard
                onStartCase={handleGenerateCase}
                onResumeCase={() => navigate('/study')}
                hasActiveCase={!!currentCase}
                domainStats={domainStats}
                totalAnswered={answers.length}
                totalCorrect={totalCorrect}
                currentCaseId={currentCase?.id}
                onStartMockStudy={handleStartMockStudySetup}
                onResumeMockStudy={activeMockSession ? handleResumeMockStudy : undefined}
                activeMockSession={activeMockSession}
                onStartExam={handleLaunchExam}
                onSmartDrill={handleSmartDrill}
                openGeneratorSignal={generatorNonce}
            />
        )}
        
        <MockStudySetupModal
            isOpen={isMockSetupOpen}
            onClose={() => setIsMockSetupOpen(false)}
            onStart={handleLaunchMockStudy}
        />

        {/* First-run onboarding: capture exam date + goal domains. Shown until the
            user sets a target exam date or skips (skip remembered locally). */}
        <OnboardingModal
            isOpen={
                !!user?.userprofile &&
                !user?.userprofile?.target_exam_date &&
                !onboardingClosed &&
                (() => { try { return localStorage.getItem(ONBOARDING_DISMISSED_KEY) !== 'true'; } catch { return true; } })()
            }
            onClose={() => setOnboardingClosed(true)}
            onComplete={() => { setOnboardingClosed(true); refreshProfile(); }}
        />

        {/* Study Mode: two-pane layout (vignette + question flow) when a case is loaded */}
        {view === 'study' && currentCase && (
          <div className="h-full flex flex-col md:flex-row">
            {/* Desktop Left Panel: Clinical Vignette with Highlighting */}
            <section className="hidden md:block w-1/2 lg:w-2/5 h-full bg-white border-r border-gray-200 overflow-y-auto p-8">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {currentCase.setting}
                  </span>
                  <span className="text-gray-300">|</span>
                  <span className="text-sm text-gray-500 italic">Case ID: {currentCase.id}</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">{currentCase.title}</h2>
                <HighlightableText 
                  text={currentCase.vignette}
                  highlights={highlights}
                  expertHighlights={evidenceLinkResult?.expertHighlights}
                  onAddHighlight={addHighlight}
                  onRemoveHighlight={removeHighlight}
                />
                
                {/* Evidence-Link Feedback Panel */}
                {evidenceLinkResult && (
                  <div className="mt-6 p-4 bg-indigo-50 rounded-xl border border-indigo-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-2 mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <h4 className="font-bold text-indigo-800">Evidence-Link Analysis</h4>
                      <span className={`ml-auto px-2 py-1 rounded-full text-xs font-bold ${
                        evidenceLinkResult.score >= 70 ? 'bg-green-100 text-green-700' : 
                        evidenceLinkResult.score >= 40 ? 'bg-yellow-100 text-yellow-700' : 
                        'bg-red-100 text-red-700'
                      }`}>
                        {evidenceLinkResult.score}% Match
                      </span>
                    </div>
                    
                    <p className="text-indigo-700 text-sm mb-3">{evidenceLinkResult.perceptualTip}</p>
                    
                    {(evidenceLinkResult.missedIndicators?.length ?? 0) > 0 && (
                      <div className="mt-3 pt-3 border-t border-indigo-200">
                        <p className="text-xs font-bold text-indigo-600 uppercase mb-2">Missed Clinical Indicators:</p>
                        <ul className="space-y-1">
                          {(evidenceLinkResult.missedIndicators || []).slice(0, 3).map((indicator, idx) => (
                            <li key={idx} className="text-xs text-indigo-600 flex items-start gap-2">
                              <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${indicator.importance === 'critical' ? 'bg-indigo-500 text-white' : 'bg-indigo-200 text-indigo-600'}`}>
                                {idx + 1}
                              </span>
                              <span className="italic">"{(indicator.text || '').slice(0, 60)}{(indicator.text || '').length > 60 ? '...' : ''}"</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mt-12 p-4 bg-yellow-50 rounded-lg border border-yellow-100 text-xs text-yellow-800">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold">PRO-TIP: HIGHLIGHTING</p>
                    {/* Live count gives quiet feedback that highlights are being captured. */}
                    {highlights.length > 0 && (
                      <span className="inline-flex items-center gap-1 bg-yellow-200 text-yellow-900 font-bold px-2 py-0.5 rounded-full">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {highlights.length} highlighted
                      </span>
                    )}
                  </div>
                  <p>Click and drag text to highlight key clinical indicators. Your highlights will persist across all questions in this case bundle.</p>
                </div>
              </div>
            </section>

            {/* Right Panel: Questions and Interactions */}
            <section className="flex-1 h-full overflow-y-auto bg-gray-50 p-4 md:p-8">
              {!isCaseComplete ? (
                // Active Question View
                <div className="max-w-xl mx-auto space-y-6">
                  {/* Progress Indicator Steps */}
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex gap-2">
                      {currentCase.questions.map((_, i) => (
                        <div 
                          key={i} 
                          className={`h-1.5 w-8 rounded-full transition-all duration-300 ${i === currentQuestionIndex ? 'bg-blue-600' : i < currentQuestionIndex ? 'bg-green-500' : 'bg-gray-200'}`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-bold text-gray-500 uppercase">Item {currentQuestionIndex + 1} of {currentCase.questions.length}</span>
                    <button
                        onClick={async () => {
                            if (currentCase) {
                                try {
                                    await api.saveSession(currentCase.id, currentQuestionIndex, isCaseComplete);
                                    toast("Progress saved.", "success");
                                } catch {
                                    toast("Couldn't save progress. Please try again.", "error");
                                }
                            }
                        }}
                        className="text-xs font-bold text-green-600 hover:text-green-700 underline"
                    >
                        Save Progress
                    </button>
                  </div>

                  {/* AI Evolving Tip Banner */}
                  {evolvingTip && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500 bg-blue-600 text-white p-4 rounded-xl shadow-lg flex gap-3 items-start border border-blue-400">
                      <div className="bg-blue-400 p-1.5 rounded-lg text-white font-bold text-xs">AI</div>
                      <p className="text-sm italic leading-snug">{evolvingTip}</p>
                    </div>
                  )}

                  {/* Question Card */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{currentQuestion && DOMAIN_INFO[currentQuestion.domain].label}</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 leading-tight mb-8">{currentQuestion?.stem}</h3>

                    <div className="space-y-3">
                      {currentQuestion?.distractors.map((d) => (
                        <button
                          key={d.label}
                          onClick={() => setSelectedLabel(d.label)}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all group flex gap-4 items-start ${selectedLabel === d.label ? 'border-blue-600 bg-blue-50 shadow-md' : 'border-gray-100 hover:border-blue-200 hover:bg-gray-50'}`}
                        >
                          <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition ${selectedLabel === d.label ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-400 group-hover:border-blue-400 group-hover:text-blue-600'}`}>
                            {d.label}
                          </span>
                          <span className={`text-base font-medium ${selectedLabel === d.label ? 'text-blue-900' : 'text-gray-700'}`}>{d.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Confidence Selection */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-sm font-bold text-gray-500 mb-4 uppercase text-center tracking-widest">Confidence Level</p>
                    <div className="flex gap-4">
                      {[ConfidenceLevel.LOW, ConfidenceLevel.MED, ConfidenceLevel.HIGH].map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() => setSelectedConfidence(lvl)}
                          className={`flex-1 py-3 px-2 rounded-xl border-2 font-bold text-xs uppercase tracking-widest transition-all ${selectedConfidence === lvl ? 'bg-gray-900 border-gray-900 text-white shadow-lg transform -translate-y-1' : 'border-gray-100 text-gray-400 hover:border-gray-200'}`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    disabled={!selectedLabel || !selectedConfidence || isSubmitting}
                    onClick={handleNext}
                    className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex justify-center items-center gap-2"
                  >
                    {isSubmitting ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Analyzing...</span>
                        </>
                    ) : (
                        currentQuestionIndex === currentCase.questions.length - 1 ? 'Finish Case Bundle' : 'Submit & Continue'
                    )}
                  </button>

                  <div className="flex flex-col items-center gap-2 pt-4">
                    <button
                      onClick={() => currentQuestion && toggleFlag(currentQuestion.id)}
                      className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest transition ${
                        currentQuestion && flaggedItems.has(currentQuestion.id)
                          ? 'text-amber-600'
                          : 'text-gray-400 hover:text-amber-600'
                      }`}
                    >
                      <svg className="w-4 h-4" fill={currentQuestion && flaggedItems.has(currentQuestion.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 2H21l-3 6 3 6h-8.5l-1-2H5a2 2 0 00-2 2z" /></svg>
                      {currentQuestion && flaggedItems.has(currentQuestion.id) ? 'Flagged for Review' : 'Flag Item for Review'}
                    </button>
                    <p className="text-[10px] text-gray-300 font-medium tracking-wide">Tip: press A–D or 1–4 to choose, Enter to submit</p>
                  </div>
                </div>
              ) : (
                // Case Complete / Summary View
                <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 text-green-600 rounded-full mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900">Case Complete</h2>
                    <p className="text-gray-500">You've finished the "{currentCase.title}" bundle. Review your rationales below.</p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-full font-bold text-sm">
                      Score: {totalCorrect} / {currentCase.questions.length}
                      <span className="text-gray-300">·</span>
                      {Math.round((totalCorrect / (currentCase.questions.length || 1)) * 100)}%
                    </div>
                  </div>

                  <div className="space-y-6">
                    {currentCase.questions.map((q, idx) => {
                      const ans = answers.find(a => a.questionId === q.id);
                      const isCorrect = ans?.selectedLabel === q.correctLabel;
                      return (
                        <div key={q.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                          <div className={`p-4 flex items-center justify-between ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                            <span className="font-bold text-sm">Question {idx + 1}</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                              {isCorrect ? 'Correct' : 'Incorrect'}
                            </span>
                          </div>
                          <div className="p-6 space-y-4">
                            <p className="font-bold text-gray-800">{q.stem}</p>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-gray-400 uppercase font-bold mb-1">Your Answer</p>
                                <p className="font-bold text-gray-700">{ans?.selectedLabel}: {q.distractors.find(d => d.label === ans?.selectedLabel)?.text}</p>
                              </div>
                              <div className="bg-blue-50 p-3 rounded-lg">
                                <p className="text-blue-400 uppercase font-bold mb-1">Correct Answer</p>
                                <p className="font-bold text-blue-700">{q.correctLabel}: {q.distractors.find(d => d.label === q.correctLabel)?.text}</p>
                              </div>
                            </div>
                            <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                              <h4 className="text-sm font-bold text-green-800 mb-2">Rationale</h4>
                              <p className="text-sm text-green-700 leading-relaxed">{q.correctRationale}</p>
                            </div>
                            {!isCorrect && q.distractors.find(d => d.label === ans?.selectedLabel)?.incorrect_rationale && (
                                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                    <h4 className="text-sm font-bold text-red-800 mb-2">Why Your Choice was Incorrect</h4>
                                    <p className="text-sm text-red-700 leading-relaxed">
                                        {q.distractors.find(d => d.label === ans?.selectedLabel)?.incorrect_rationale}
                                    </p>
                                </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-3">
                    <button onClick={() => navigate('/dashboard')} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200">View Analytics</button>
                    <div className="flex gap-3">
                      <button onClick={resetCase} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition">Restart Case</button>
                      <button onClick={() => navigate(HOME_PATH)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition">Home</button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Mobile Sheet for Vignette (Responsive) */}
            <div className={`md:hidden fixed inset-x-0 bottom-0 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] rounded-t-[32px] transition-transform duration-500 z-40 ${isMobileVignetteOpen ? 'translate-y-0 h-[80vh]' : 'translate-y-[calc(100%-64px)] h-[80vh]'}`}>
              {/* Handle */}
              <div 
                className="w-full h-16 flex flex-col items-center justify-center cursor-pointer touch-none"
                onClick={() => setIsMobileVignetteOpen(!isMobileVignetteOpen)}
              >
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-3" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">{isMobileVignetteOpen ? 'Swipe Down to Close' : 'Swipe Up for Vignette'}</span>
              </div>
              <div className="px-6 pb-8 overflow-y-auto h-[calc(80vh-64px)]">
                <h2 className="text-xl font-bold mb-4">{currentCase.title}</h2>
                <HighlightableText
                  text={currentCase.vignette}
                  highlights={highlights}
                  expertHighlights={evidenceLinkResult?.expertHighlights}
                  onAddHighlight={addHighlight}
                  onRemoveHighlight={removeHighlight}
                />
                {evidenceLinkResult && (
                  <div className="mt-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-xs text-indigo-700">
                    <span className="font-bold">Evidence-Link: {evidenceLinkResult.score}% match.</span> {evidenceLinkResult.perceptualTip}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Study Mode empty state: no case loaded yet, prompt to generate one */}
        {view === 'study' && !currentCase && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No active case</h2>
            <p className="text-gray-500 mb-8 max-w-sm">Generate an AI-crafted clinical case to start a study session.</p>
            <button onClick={() => handleGenerateCase('Physical Rehabilitation', 'Medium')} className="px-6 py-3 bg-teal-500 text-white rounded-xl font-bold shadow-lg shadow-teal-200 hover:bg-teal-400 transition">
              Generate New Case
            </button>
          </div>
        )}

        {view === 'dashboard' && (
          // Dashboard Analysis View
          <div className="h-full overflow-y-auto p-4 md:p-12 bg-gray-50">
            <div className="max-w-4xl mx-auto space-y-12">
              {/* Cross-session analytics (server-backed, all history) */}
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Performance Hub</h1>
                <p className="text-gray-500 mb-6">Your mastery across every case, drill, and exam.</p>
                <PerformanceHub />
              </div>

              {/* In-session competency radar (current case) */}
              <Dashboard stats={domainStats} />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">AI Validation Status</h4>
                  {validationResult?.valid ? (
                    <div className="flex items-center gap-2 text-green-600 font-bold text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {validationResult.message}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {validationResult?.message}
                    </div>
                  )}
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Review Queue</h4>
                  {(() => {
                    const incorrect = currentCase ? answers.filter(a => a.selectedLabel !== currentCase.questions.find(q => q.id === a.questionId)?.correctLabel).length : 0;
                    const lowConf = answers.filter(a => a.confidence === ConfidenceLevel.LOW).length;
                    const total = flaggedItems.size + incorrect;
                    return (
                      <>
                        <p className="text-gray-900 font-bold">{total} item{total === 1 ? '' : 's'} to revisit</p>
                        <p className="text-xs text-gray-500 mt-1">{flaggedItems.size} flagged · {incorrect} missed · {lowConf} low-confidence (this session)</p>
                      </>
                    );
                  })()}
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Logic Path</h4>
                  <p className="text-gray-900 font-bold">{answers.filter(a => a.selectedLabel === currentCase.questions.find(q => q.id === a.questionId)?.correctLabel).length / (answers.length || 1) > 0.7 ? 'Competent Path' : 'Drifting'}</p>
                  <p className="text-xs text-gray-500 mt-1">Your clinical reasoning is evolving.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Adaptive Mock Study session (premium); requires a live session in memory */}
        {view === 'mock-study' && mockSessionId && mockSessionData && (
            <MockStudySession
                sessionId={mockSessionId}
                initialData={mockSessionData}
                onExit={async () => {
                    navigate(HOME_PATH);
                    setMockSessionId(null);
                    setMockSessionData(null);
                    // Refresh active session status
                    const session = await api.mockStudy.getActiveSession();
                    setActiveMockSession(session);
                }}
            />
        )}

        {/* B2B organization console (admin/instructor): seats, members, cohort
            analytics. OrgConsole self-gates by the caller's membership role. */}
        {view === 'org' && <OrgConsole />}

        {/* Full timed exam simulation (premium); also requires a live session */}
        {view === 'exam-mode' && mockSessionId && mockSessionData && (
            <ExamSession
                sessionId={mockSessionId}
                initialData={mockSessionData}
                onExit={() => navigate(HOME_PATH)}
            />
        )}

        {/* Stripe redirect target on success; payment sync runs in the effect above */}
        {view === 'payment-success' && (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-4">Payment Successful!</h2>
                <p className="text-gray-600 mb-8 max-w-md">Thank you for your purchase. Your account has been upgraded and you now have full access to all features.</p>
                <button onClick={() => navigate(HOME_PATH)} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition">Go to Dashboard</button>
            </div>
        )}

        {/* Stripe redirect target when the user backs out of checkout (no charge) */}
        {view === 'payment-cancel' && (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-4">Payment Cancelled</h2>
                <p className="text-gray-600 mb-8 max-w-md">The payment process was cancelled. No charges were made.</p>
                <button onClick={() => navigate(HOME_PATH)} className="px-8 py-4 bg-gray-200 text-gray-700 rounded-2xl font-bold hover:bg-gray-300 transition">Return Home</button>
            </div>
        )}
    </AppShell>
  );
};

/**
 * App
 * Top-level router. Chooses between the public surface (landing/auth) and the
 * authenticated surface (MainApp) based on auth state, and handles cross-cutting
 * concerns: legacy-link redirects, plan selection / checkout, and deferring
 * route resolution until the auth token check completes.
 * @returns The route table for the current auth state.
 */
const App: React.FC = () => {
    const { isAuthenticated, loading, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const toast = useToast();
    const [pendingPlan, setPendingPlan] = useState<string | null>(null);

    // Back-compat: legacy entrypoints that used to live on "/" as query strings
    // (?token, ?session_id, ?cancel) are now real routes. Redirect old links so
    // existing emails / Stripe configs keep working.
    useEffect(() => {
        if (location.pathname !== '/') return;
        const params = new URLSearchParams(location.search);
        if (params.get('token')) {
            navigate('/verify' + location.search, { replace: true });
        } else if (params.get('session_id')) {
            navigate('/payment/success' + location.search, { replace: true });
        } else if (params.has('cancel')) {
            navigate('/payment/cancel', { replace: true });
        }
    }, [location.pathname, location.search, navigate]);

    /**
     * Handles a pricing-plan selection. Authenticated users go straight to a
     * Stripe checkout session; anonymous users are routed through signup first,
     * with the chosen tier stashed in `pendingPlan` to resume checkout after.
     * @param tier The selected plan/tier identifier.
     */
    const handleSelectPlan = async (tier: string) => {
        if (isAuthenticated) {
            try {
                toast("Redirecting to secure checkout…", "info");
                const { url } = await api.createCheckoutSession(tier);
                window.location.href = url;
            } catch (err) {
                console.error("Checkout failed:", err);
                toast("Failed to initiate checkout. Please try again.", "error");
            }
        } else {
            // Send unauthenticated buyers through onboarding, then resume checkout.
            setPendingPlan(tier);
            navigate('/signup');
        }
    };

    // Resume a deferred checkout: once a previously-anonymous buyer authenticates
    // (post-signup), pick up the stashed plan and continue to checkout.
    useEffect(() => {
        if (isAuthenticated && pendingPlan) {
            const tier = pendingPlan;
            setPendingPlan(null);
            handleSelectPlan(tier);
        }
    }, [isAuthenticated, pendingPlan]);

    // Redeem a deferred org invite: a user who clicked an invite link while logged
    // out is sent through signup with the token stashed; once authenticated, redeem
    // it and drop them in the org console.
    useEffect(() => {
        if (!isAuthenticated) return;
        let token: string | null = null;
        try { token = localStorage.getItem(PENDING_INVITE_KEY); } catch { /* ignore */ }
        if (!token) return;
        (async () => {
            try {
                await api.organizations.acceptInvite(token!);
                await refreshProfile(); // pull new membership + inherited premium
                toast('Invitation accepted — welcome to your organization!', 'success');
                navigate('/org', { replace: true });
            } catch (err) {
                console.warn('Pending invite redemption failed:', err);
            } finally {
                try { localStorage.removeItem(PENDING_INVITE_KEY); } catch { /* ignore */ }
            }
        })();
    }, [isAuthenticated]);

    // Wait for the token check before resolving routes; otherwise a logged-in
    // user refreshing a deep link (e.g. /dashboard) would flash as logged-out
    // and get bounced to /signin before auth resolves.
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
                <div className="h-12 w-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <Routes>
            {/* Email verification works in any auth state (clicked from an email). */}
            <Route path="/verify" element={<VerifyEmailPage />} />
            {/* Org invite links work in any auth state (redeems or defers to signup). */}
            <Route path="/accept-invite" element={<AcceptInvite />} />

            {!isAuthenticated && (
                <>
                    <Route
                        path="/"
                        element={
                            <LandingPage
                                onStart={() => navigate('/signup')}
                                onLogin={() => navigate('/signin')}
                                onRegister={() => navigate('/signup')}
                                onSelectPlan={handleSelectPlan}
                            />
                        }
                    />
                    <Route path="/signin" element={<LoginPage onSwitch={() => navigate('/signup')} />} />
                    <Route path="/signup" element={<RegisterPage onSwitch={() => navigate('/signin')} />} />
                    {/* Aliases for the canonical auth routes. */}
                    <Route path="/login" element={<Navigate to="/signin" replace />} />
                    <Route path="/register" element={<Navigate to="/signup" replace />} />
                    {/* Any protected or unknown path -> sign in. */}
                    <Route path="*" element={<Navigate to="/signin" replace />} />
                </>
            )}

            {isAuthenticated && (
                // A single catch-all keeps MainApp mounted across every in-app
                // navigation, so case / mock / exam state survives route changes.
                // MainApp derives its view from the URL and guards bad paths.
                <Route path="*" element={<MainApp />} />
            )}
        </Routes>
    );
};

/**
 * AppWrapper (default export)
 * Composition root: wraps the app in the global context providers it depends on
 * — AuthProvider (session/user) and FeedbackProvider (toasts/confirm dialogs) —
 * so any descendant can consume them via hooks.
 */
export default function AppWrapper() {
    return (
        <AuthProvider>
            <FeedbackProvider>
                <App />
            </FeedbackProvider>
        </AuthProvider>
    );
}

// Modify MainApp to import correct things if needed, but it's in same file.
