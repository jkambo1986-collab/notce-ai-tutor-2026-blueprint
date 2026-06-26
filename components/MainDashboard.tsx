/**
 * @file MainDashboard.tsx
 * @description The authenticated home screen. Greets the user, surfaces trial/upgrade
 * banners, exposes the primary learning entry points (AI case generator, analytics, saved
 * progress, adaptive mock study, full exam sim), and gates premium features behind the
 * user's subscription state. Also handles the post-Stripe-checkout payment sync.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { DomainStats } from '../types';
import CaseGeneratorModal from './CaseGeneratorModal';
import SavedProgressModal from './SavedProgressModal';
import ReviewQueueModal from './ReviewQueueModal';
import NotebookModal from './NotebookModal';
import ErrorInsightsModal from './ErrorInsightsModal';
import ReasoningCoachModal from './ReasoningCoachModal';
import AdaptiveAssessmentModal from './AdaptiveAssessmentModal';
import EncounterModal from './EncounterModal';
import TodayPanel from './TodayPanel';
import { useToast } from './ui/Feedback';
import { Button, Card, Badge } from './ui';

/**
 * Props for {@link MainDashboard}.
 * @property onStartCase         Generates and opens a new case for the given domain/difficulty.
 * @property onResumeCase        Optional; resumes an in-progress case (optionally by id).
 * @property hasActiveCase       Whether a resumable case exists (toggles the Resume button).
 * @property domainStats         Per-domain stats forwarded to the analytics modal.
 * @property totalAnswered       Total answered count for analytics.
 * @property totalCorrect        Total correct count for analytics.
 * @property currentCaseId       Id of the active case, used to highlight it in saved progress.
 * @property onStartMockStudy    Optional; launches the adaptive mock study drill.
 * @property onResumeMockStudy   Optional; resumes a saved mock study session.
 * @property onStartExam         Optional; launches the full timed exam simulation.
 * @property openGeneratorSignal Counter bumped by the parent to programmatically open the generator.
 */
interface MainDashboardProps {
    onStartCase: (domain: string, difficulty: string) => Promise<void>;
    onResumeCase?: (caseId?: string) => void;
    hasActiveCase: boolean;
    domainStats?: DomainStats[];
    totalAnswered?: number;
    totalCorrect?: number;
    currentCaseId?: string;
    onStartMockStudy?: () => void;
    onResumeMockStudy?: () => void;
    onStartExam?: () => void;
    /** One-tap Smart Drill: starts a mock targeting the user's weakest domain. */
    onSmartDrill?: () => void;
    /** Opens the full cross-session Analytics page (canonical analytics view). */
    onOpenAnalytics?: () => void;
    /** Bumping this number opens the Case Generator (used by sidebar "New Case"). */
    openGeneratorSignal?: number;
    /** Bumping these opens the Daily Review / Notebook modals from global nav. */
    openReviewSignal?: number;
    openNotebookSignal?: number;
}

/**
 * MainDashboard renders the post-login landing page and orchestrates the modals
 * (generator, analytics, saved progress) plus premium-gated feature cards.
 *
 * @param props See {@link MainDashboardProps}.
 */
const MainDashboard: React.FC<MainDashboardProps> = ({
    onStartCase,
    onResumeCase,
    hasActiveCase,
    domainStats = [],
    totalAnswered = 0,
    totalCorrect = 0,
    currentCaseId,
    onStartMockStudy,
    onResumeMockStudy,
    onStartExam,
    onSmartDrill,
    onOpenAnalytics,
    openGeneratorSignal = 0,
    openReviewSignal = 0,
    openNotebookSignal = 0
}) => {
    // Auth gives us the user (for greeting/tier gating) and a way to refetch the profile
    // after a payment so paid features unlock without a manual reload.
    const { user, refreshProfile } = useAuth();
    const toast = useToast();
    // Visibility flags for the three modals owned by this screen.
    const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
    const [isProgressOpen, setIsProgressOpen] = useState(false);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [isNotebookOpen, setIsNotebookOpen] = useState(false);
    // AI differentiator feature modals.
    const [isInsightsOpen, setIsInsightsOpen] = useState(false);
    const [isReasoningOpen, setIsReasoningOpen] = useState(false);
    const [isAdaptiveOpen, setIsAdaptiveOpen] = useState(false);
    const [isEncounterOpen, setIsEncounterOpen] = useState(false);
    // Number of weak items due for review (badge on the Daily Review card).
    const [reviewCount, setReviewCount] = useState<number | null>(null);
    // True while the post-checkout payment sync request is in flight.
    const [isSyncing, setIsSyncing] = useState(false);

    // Best-effort fetch of the review-queue size for the dashboard badge.
    useEffect(() => {
        let active = true;
        api.getReviewQueue().then(q => { if (active) setReviewCount(q.count); }).catch(() => {});
        return () => { active = false; };
    }, []);

    // Open the generator when the parent bumps the signal (skip the initial 0).
    // Lets the sidebar's "New Case" action drive this child without a shared ref.
    useEffect(() => {
        if (openGeneratorSignal > 0) setIsGeneratorOpen(true);
    }, [openGeneratorSignal]);

    // Global-nav entry points: the sidebar can open Review / Notebook from any
    // screen by navigating home and bumping these signals.
    useEffect(() => { if (openReviewSignal > 0) setIsReviewOpen(true); }, [openReviewSignal]);
    useEffect(() => { if (openNotebookSignal > 0) setIsNotebookOpen(true); }, [openNotebookSignal]);

    // On return from Stripe checkout the URL carries ?success=true. Detect it, confirm the
    // payment server-side, refresh the profile to reflect the new tier, then strip the query
    // param so a refresh doesn't re-trigger the sync.
    React.useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('success') === 'true') {
            const sync = async () => {
                setIsSyncing(true);
                try {
                    await api.syncPayment();
                    await refreshProfile();
                    // Clean URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                } catch (err) {
                    console.error("Sync failed:", err);
                } finally {
                    setIsSyncing(false);
                }
            };
            sync();
        }
    }, [refreshProfile]);

    // Once per browser session, surface a short progress recap when there's
    // something to report. Guarded by sessionStorage so it greets the user a
    // single time (and never duplicates the login "Welcome back" toast).
    useEffect(() => {
        if (totalAnswered <= 0) return;
        try {
            if (sessionStorage.getItem('notce_summary_shown')) return;
            sessionStorage.setItem('notce_summary_shown', '1');
        } catch {
            /* sessionStorage unavailable (private mode) — just skip the recap. */
            return;
        }
        const pct = Math.round((totalCorrect / totalAnswered) * 100);
        toast(`So far: ${totalAnswered} question${totalAnswered === 1 ? '' : 's'} answered — ${pct}% accuracy. Keep it up!`, 'info');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalAnswered, totalCorrect]);

    /** Starts a Stripe checkout session for the 'guarantee' tier and redirects the browser to it. */
    const handleUpgrade = async () => {
        try {
            toast("Redirecting to secure checkout…", "info");
            // Using 'guarantee' tier for the upgrade button
            const { url } = await api.createCheckoutSession('guarantee');
            window.location.href = url;
        } catch (err) {
            console.error("Upgrade failed:", err);
            toast("Failed to start upgrade process. Please try again.", "error");
        }
    };

    // Derive entitlement flags from the profile; these drive both the banners and the
    // locked overlays on the premium feature cards below.
    const profile = user?.userprofile;
    const isPaid = profile?.is_paid;
    const isTrial = profile?.is_trial_active;
    const trialEndDate = profile?.trial_end_date ? new Date(profile.trial_end_date) : null;
    // Whole days left in the trial (rounded up), shown in the trial banner.
    const daysRemaining = trialEndDate ? Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

    // Escalate the trial banner's tone as expiry nears: calm (>3d) → amber (≤3d)
    // → red (final day). Keeps the countdown honest and gently raises urgency.
    const trialUrgency = daysRemaining <= 1
        ? { box: 'bg-red-600', sub: 'text-red-100', btn: 'text-red-600 hover:bg-red-50', heading: daysRemaining <= 0 ? 'Trial ends today' : 'Final day of your trial' }
        : daysRemaining <= 3
        ? { box: 'bg-amber-500', sub: 'text-amber-50', btn: 'text-amber-600 hover:bg-amber-50', heading: 'Your trial is ending soon' }
        : { box: 'bg-indigo-600', sub: 'text-indigo-100', btn: 'text-indigo-600 hover:bg-indigo-50', heading: '7-Day Free Trial Active' };

    return (
        <div className="min-h-screen bg-canvas overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
                {/* Trial Banner — tone escalates as the trial nears its end. */}
                {isTrial && !isPaid && (
                     <div className={`${trialUrgency.box} rounded-3xl p-5 shadow-soft-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white animate-fade-in-down`}>
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 ring-1 ring-white/20 p-2.5 rounded-2xl flex-shrink-0">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-base">{trialUrgency.heading}</h3>
                                <p className={`${trialUrgency.sub} text-sm`}>
                                    {daysRemaining <= 0
                                        ? 'Upgrade now to keep your full premium access.'
                                        : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining of full premium access.`}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleUpgrade}
                            className={`px-5 py-2.5 bg-white ${trialUrgency.btn} font-bold rounded-xl text-sm shadow-soft hover:-translate-y-0.5 active:translate-y-0 active:scale-[.98] transition-all duration-200 whitespace-nowrap`}
                        >
                            Lock in Access
                        </button>
                    </div>
                )}

                {/* Header Section */}
                <div className="relative overflow-hidden bg-white rounded-4xl p-6 sm:p-8 shadow-card ring-1 ring-slate-200/70 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-fade-in-up">
                    <div className="absolute -top-20 -right-16 w-64 h-64 bg-brand-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
                    <div className="relative">
                        <Badge tone="brand" className="mb-3">
                            {isPaid ? 'Premium Member' : isTrial ? 'Trial Member' : 'Free Member'}
                        </Badge>
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-ink mb-2">
                            Welcome back, <span className="text-brand-600">{user?.username}</span>
                        </h1>
                        <p className="text-slate-500 text-lg">
                            Ready to master your clinical reasoning?
                        </p>
                    </div>
                    <div className="relative flex flex-wrap gap-3">
                        {hasActiveCase && onResumeCase && (
                            <Button
                                onClick={() => onResumeCase()}
                                variant="outline"
                                leftIcon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                            >
                                Resume Session
                            </Button>
                        )}
                        <Button
                            onClick={() => onStartMockStudy?.()}
                            rightIcon={<svg className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
                        >
                            Start Practice
                        </Button>
                    </div>
                </div>

                {/* Today's focus hero: synthesizes exam countdown + readiness +
                    the single best next action (review / weakest-domain drill). */}
                <TodayPanel
                    reviewCount={reviewCount}
                    onSmartDrill={onSmartDrill}
                    onStartPractice={onStartMockStudy}
                    onOpenReview={() => setIsReviewOpen(true)}
                />

                {/* Quick Stats / Info Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                    {/* Vetted Question Bank Card */}
                    <Card
                        as="button"
                        interactive
                        onClick={() => onStartMockStudy?.()}
                        className="animate-fade-in-up"
                        style={{ animationDelay: '0ms' }}
                    >
                        <div className="h-12 w-12 bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-glow-teal rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h3 className="font-bold text-ink text-lg group-hover:text-brand-700 transition-colors">Vetted Question Bank</h3>
                        <p className="text-slate-500 text-sm mt-2">Practice independently-reviewed questions aligned to the 2026 NOTCE blueprint.</p>
                        <div className="mt-4 text-brand-600 text-sm font-semibold flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <span>Start Now</span>
                            <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </Card>

                    {/* Performance Analytics Card → canonical Analytics page */}
                    <Card
                        as="button"
                        interactive
                        onClick={() => onOpenAnalytics?.()}
                        className="animate-fade-in-up"
                        style={{ animationDelay: '60ms' }}
                    >
                        <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-soft rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                        <h3 className="font-bold text-ink text-lg group-hover:text-blue-700 transition-colors">Performance Analytics</h3>
                        <p className="text-slate-500 text-sm mt-2">Track your competence across all 6 OT practice domains in real-time.</p>
                        <div className="mt-4 text-blue-600 text-sm font-semibold flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <span>View Stats</span>
                            <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </Card>

                    {/* Saved Progress Card */}
                    <Card
                        as="button"
                        interactive
                        onClick={() => setIsProgressOpen(true)}
                        className="animate-fade-in-up"
                        style={{ animationDelay: '120ms' }}
                    >
                        <div className="h-12 w-12 bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-soft rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 className="font-bold text-ink text-lg group-hover:text-emerald-700 transition-colors">Saved Progress</h3>
                        <p className="text-slate-500 text-sm mt-2">Resume exactly where you left off. Your clinical reasoning journey is safe.</p>
                        <div className="mt-4 text-emerald-600 text-sm font-semibold flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <span>View Sessions</span>
                            <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </Card>

                    {/* Daily Review Card (Adaptive Review Queue) */}
                    <Card
                        as="button"
                        interactive
                        onClick={() => setIsReviewOpen(true)}
                        className="relative animate-fade-in-up"
                        style={{ animationDelay: '180ms' }}
                    >
                        {reviewCount !== null && reviewCount > 0 && (
                            <Badge tone="info" className="absolute top-4 right-4">{reviewCount} due</Badge>
                        )}
                        <div className="h-12 w-12 bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-soft rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7M19 16l2 2-2 2m2-2h-4" /></svg>
                        </div>
                        <h3 className="font-bold text-ink text-lg group-hover:text-violet-700 transition-colors">Daily Review</h3>
                        <p className="text-slate-500 text-sm mt-2">Revisit the items you missed or weren't sure about — spaced to stick.</p>
                        <div className="mt-4 text-violet-600 text-sm font-semibold flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <span>Start Review</span>
                            <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </Card>

                    {/* Notebook Card */}
                    <Card
                        as="button"
                        interactive
                        onClick={() => setIsNotebookOpen(true)}
                        className="animate-fade-in-up"
                        style={{ animationDelay: '240ms' }}
                    >
                        <div className="h-12 w-12 bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-soft rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        </div>
                        <h3 className="font-bold text-ink text-lg group-hover:text-amber-700 transition-colors">My Notebook</h3>
                        <p className="text-slate-500 text-sm mt-2">Saved rationales in one place — export a printable study sheet.</p>
                        <div className="mt-4 text-amber-600 text-sm font-semibold flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <span>Open Notebook</span>
                            <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </Card>
                </div>

                {/* --- Advanced AI Practice (premium AI differentiators) --- */}
                {(() => {
                    const canUseAI = !!(isPaid || isTrial);
                    const open = (setter: (v: boolean) => void) => () => (canUseAI ? setter(true) : handleUpgrade());
                    const cards = [
                        { onClick: open(setIsAdaptiveOpen), title: 'Adaptive Readiness Test', desc: "A scaled-score estimate that adapts difficulty to your ability — like the real exam.", grad: 'from-indigo-500 to-violet-500', hover: 'group-hover:text-indigo-700', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
                        { onClick: open(setIsReasoningOpen), title: 'Reasoning Coach', desc: 'Write your clinical reasoning; the AI grades the thinking, not a letter choice.', grad: 'from-blue-500 to-cyan-500', hover: 'group-hover:text-blue-700', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                        { onClick: open(setIsEncounterOpen), title: 'Client Encounter', desc: 'Interview a simulated client and get scored on client-centred practice.', grad: 'from-brand-500 to-emerald-500', hover: 'group-hover:text-brand-700', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 21l1.9-3.8A7.95 7.95 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
                        { onClick: open(setIsInsightsOpen), title: 'Test-Taking Insights', desc: 'See the recurring traps behind your wrong answers — and how to beat them.', grad: 'from-rose-500 to-pink-500', hover: 'group-hover:text-rose-700', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                    ];
                    return (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <h2 className="text-xl font-black text-ink">Advanced AI Practice</h2>
                                <Badge tone="premium">Premium</Badge>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {cards.map((c, i) => (
                                    <Card key={c.title} as="button" interactive padding="sm" onClick={c.onClick} className="animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
                                        <div className={`h-11 w-11 bg-gradient-to-br ${c.grad} text-white shadow-soft rounded-xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}>
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.icon} /></svg>
                                        </div>
                                        <h3 className={`font-bold text-ink transition-colors ${c.hover}`}>{c.title}</h3>
                                        <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">{c.desc}</p>
                                        {!canUseAI && <span className="inline-flex items-center gap-1 mt-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>Upgrade to unlock</span>}
                                    </Card>
                                ))}
                            </div>
                        </div>
                    );
                })()}

                <div className={`bg-gradient-to-br from-brand-50 via-white to-emerald-50 rounded-4xl p-6 sm:p-8 ring-1 ring-brand-100 shadow-card flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group ${!isPaid && !isTrial ? 'cursor-not-allowed' : ''}`}>
                     {/* Decorative Elements */}
                     <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-brand-200 rounded-full blur-3xl opacity-25 pointer-events-none"></div>
                     <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-emerald-200 rounded-full blur-3xl opacity-25 pointer-events-none"></div>

                     {/* Locked Overlay */}
                     {!isPaid && (
                         <div className="absolute inset-0 bg-white/70 backdrop-blur-md z-40 flex items-center justify-center p-4">
                             <div className="bg-white p-8 rounded-4xl shadow-soft-lg ring-1 ring-slate-200/70 flex flex-col items-center text-center max-w-sm animate-scale-in">
                                 <div className="w-16 h-16 bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-glow-teal rounded-2xl flex items-center justify-center mb-4">
                                     <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                 </div>
                                 <h4 className="text-xl font-bold text-ink mb-2">Premium Drill Mode</h4>
                                 <p className="text-sm text-slate-500 mb-6">Adaptive Mock Study is reserved for Premium Members only. Unlock your path to mastery.</p>
                                 <Button onClick={handleUpgrade} fullWidth size="lg">Upgrade to Unlock</Button>
                             </div>
                         </div>
                     )}

                     <div className="z-10 flex-1">
                        <div className="flex items-center gap-3 mb-3">
                             <Badge tone="premium">New</Badge>
                             <h2 className="text-2xl font-black text-ink">Adaptive Mock Study</h2>
                        </div>
                        <p className="text-slate-600 text-lg leading-relaxed max-w-2xl">
                            Practice vetted, independently-reviewed bank questions one-by-one. Select your specific domain weak spots and get instant, deep-dive feedback on every answer.
                        </p>

                        <div className="mt-6 flex flex-wrap gap-2.5">
                            {['OT Expertise', 'Ethics', 'Clinical Reasoning'].map(tag => (
                                <span key={tag} className="px-3 py-1 bg-white/70 text-brand-700 text-xs font-bold rounded-lg ring-1 ring-brand-100">
                                    {tag}
                                </span>
                            ))}
                        </div>
                     </div>

                     <div className="z-10 flex flex-col gap-3 w-full md:w-auto">
                        <button
                            onClick={() => isPaid && onStartMockStudy?.()}
                            disabled={!isPaid}
                            className="px-8 py-4 bg-gradient-to-b from-brand-500 to-brand-600 text-white rounded-2xl font-bold text-lg shadow-glow-teal hover:from-brand-500 hover:to-brand-700 hover:-translate-y-0.5 active:translate-y-0 active:scale-[.98] transition-all duration-200 flex items-center gap-3 whitespace-nowrap justify-center w-full md:w-48 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
                        >
                            <span>Start Drill</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </button>

                        {/* Smart Drill: one-tap, auto-targets the weakest domain */}
                        {onSmartDrill && (
                            <button
                                onClick={() => isPaid && onSmartDrill()}
                                disabled={!isPaid}
                                title="Auto-target your weakest domain"
                                className="px-8 py-3 bg-ink text-white rounded-xl font-bold text-base hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 active:scale-[.98] transition-all duration-200 flex items-center gap-2 whitespace-nowrap justify-center w-full md:w-48 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
                            >
                                <svg className="w-4 h-4 text-brand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                <span>Smart Drill</span>
                            </button>
                        )}

                        {/* Resume Button */}
                        {onResumeMockStudy && (
                            <button
                                onClick={() => isPaid && onResumeMockStudy()}
                                disabled={!isPaid}
                                className="px-8 py-3 bg-white text-brand-700 rounded-xl font-bold text-base ring-1 ring-brand-200 hover:ring-brand-300 hover:bg-brand-50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[.98] transition-all duration-200 flex items-center gap-2 whitespace-nowrap justify-center w-full md:w-48 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
                            >
                                <span>Resume</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </button>
                        )}
                     </div>
                </div>

                {/* Exam Simulation Feature */}
                <div className={`bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-4xl p-6 sm:p-8 ring-1 ring-slate-800 shadow-card flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group ${!isPaid ? 'cursor-not-allowed' : ''}`}>
                     {/* Decorative Elements */}
                     <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-600 rounded-full blur-3xl opacity-25 pointer-events-none"></div>
                     <div className="absolute bottom-0 left-1/3 -mb-20 w-64 h-64 bg-brand-700 rounded-full blur-3xl opacity-15 pointer-events-none"></div>

                     {/* Locked Overlay */}
                     {!isPaid && (
                         <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md z-40 flex items-center justify-center p-4">
                             <div className="bg-slate-800 p-8 rounded-4xl shadow-2xl ring-1 ring-slate-700 flex flex-col items-center text-center max-w-sm animate-scale-in">
                                 <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-soft rounded-2xl flex items-center justify-center mb-4">
                                     <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                 </div>
                                 <h4 className="text-xl font-bold text-white mb-2">Full Simulation</h4>
                                 <p className="text-sm text-slate-400 mb-6">Complete exam simulation is restricted to Premium Members. Experience the real deal.</p>
                                 <button onClick={handleUpgrade} className="w-full py-3.5 bg-gradient-to-b from-indigo-500 to-indigo-600 text-white rounded-2xl font-bold text-base hover:-translate-y-0.5 active:translate-y-0 active:scale-[.98] transition-all duration-200 shadow-[0_10px_28px_-8px_rgba(99,102,241,.6)]">Unlock Now</button>
                             </div>
                         </div>
                     )}

                     <div className="z-10 flex-1">
                        <div className="flex items-center gap-3 mb-3">
                             <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-red-500 text-white shadow-soft">Timed</span>
                             <h2 className="text-2xl font-black text-white">Full Exam Simulation</h2>
                        </div>
                        <p className="text-slate-400 text-lg leading-relaxed max-w-2xl">
                            The real deal. 200 questions. 4 hours. No immediate feedback. Simulate the pressure regardless of the outcome.
                        </p>

                        <div className="mt-6 flex flex-wrap gap-2.5">
                            <span className="px-3 py-1 bg-white/5 text-slate-300 text-xs font-bold rounded-lg ring-1 ring-white/10">
                                4 Hours
                            </span>
                             <span className="px-3 py-1 bg-white/5 text-slate-300 text-xs font-bold rounded-lg ring-1 ring-white/10">
                                200 Questions
                            </span>
                             <span className="px-3 py-1 bg-white/5 text-slate-300 text-xs font-bold rounded-lg ring-1 ring-white/10">
                                Book 1 & 2
                            </span>
                        </div>
                     </div>

                     <div className="z-10 w-full md:w-auto">
                        <button
                            onClick={() => isPaid && onStartExam?.()}
                            disabled={!isPaid}
                            className="px-8 py-4 bg-white text-ink rounded-2xl font-bold text-lg shadow-soft-lg hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[.98] transition-all duration-200 flex items-center gap-3 whitespace-nowrap justify-center w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
                        >
                            <span>Start Exam</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                     </div>
                </div>
                
                {/* Blueprint Compliance Badge */}
                <div className="bg-white rounded-3xl p-6 ring-1 ring-slate-200/70 shadow-card flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-500 text-white rounded-2xl shadow-soft flex items-center justify-center flex-shrink-0">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                    </div>
                    <div>
                        <h4 className="font-bold text-ink">2026 NOTCE Blueprint Aligned</h4>
                        <p className="text-slate-500 text-sm">All questions are independently reviewed and aligned to the latest NOTCE (CAOT) exam specifications.</p>
                    </div>
                </div>
            </div>

            {/* UPGRADE BANNER - Only show for free users not on trial */}
            {!isPaid && !isTrial && (
                <div className="max-w-5xl mx-auto mt-6 md:mt-8 bg-gradient-to-r from-amber-100 to-amber-300 rounded-3xl p-6 shadow-soft-lg ring-1 ring-amber-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-white p-3 rounded-2xl shadow-soft text-amber-500 flex-shrink-0">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-amber-900">Unlock Full Access</h3>
                            <p className="text-amber-800 font-medium">Get the "Pass Guarantee" with unlimited detailed rationales.</p>
                        </div>
                    </div>
                    <button
                        onClick={handleUpgrade}
                        className="px-6 py-3 bg-white text-amber-600 font-bold rounded-xl shadow-soft hover:bg-amber-50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[.98] transition-all duration-200 whitespace-nowrap"
                    >
                        Upgrade Now
                    </button>
                </div>
            )}

            {/* Modals */}
            <CaseGeneratorModal
                isOpen={isGeneratorOpen}
                onClose={() => setIsGeneratorOpen(false)}
                onGenerate={onStartCase}
            />
            
            <SavedProgressModal
                isOpen={isProgressOpen}
                onClose={() => setIsProgressOpen(false)}
                onResumeSession={(caseId) => onResumeCase?.(caseId)}
                currentCaseId={currentCaseId}
            />

            <ReviewQueueModal
                isOpen={isReviewOpen}
                onClose={() => setIsReviewOpen(false)}
            />

            <NotebookModal
                isOpen={isNotebookOpen}
                onClose={() => setIsNotebookOpen(false)}
            />

            {isInsightsOpen && <ErrorInsightsModal isOpen={isInsightsOpen} onClose={() => setIsInsightsOpen(false)} />}
            {isReasoningOpen && <ReasoningCoachModal isOpen={isReasoningOpen} onClose={() => setIsReasoningOpen(false)} />}
            {isAdaptiveOpen && <AdaptiveAssessmentModal isOpen={isAdaptiveOpen} onClose={() => setIsAdaptiveOpen(false)} />}
            {isEncounterOpen && <EncounterModal isOpen={isEncounterOpen} onClose={() => setIsEncounterOpen(false)} />}

            {/* Mock Study Components will be lifted to App.tsx for session state, but entry point is here */}
        </div>
    );
};

export default MainDashboard;
