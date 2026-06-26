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
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Trial Banner — tone escalates as the trial nears its end. */}
                {isTrial && !isPaid && (
                     <div className={`${trialUrgency.box} rounded-2xl p-4 shadow-lg flex items-center justify-between text-white`}>
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                                <h3 className="font-bold">{trialUrgency.heading}</h3>
                                <p className={`${trialUrgency.sub} text-sm`}>
                                    {daysRemaining <= 0
                                        ? 'Upgrade now to keep your full premium access.'
                                        : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining of full premium access.`}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleUpgrade}
                            className={`px-4 py-2 bg-white ${trialUrgency.btn} font-bold rounded-lg text-sm transition`}
                        >
                            Lock in Access
                        </button>
                    </div>
                )}

                {/* Header Section */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
                            Welcome back, <span className="text-blue-600">{user?.username}</span>!
                        </h1>
                        <p className="text-gray-500 text-lg">
                            {isPaid ? 'Premium Member' : isTrial ? 'Trial Member' : 'Free Member'} • Ready to master your clinical reasoning?
                        </p>
                    </div>
                    <div className="flex gap-4">
                        {hasActiveCase && onResumeCase && (
                            <button 
                                onClick={() => onResumeCase()}
                                className="px-6 py-3 bg-white border-2 border-green-500 text-green-700 rounded-xl font-bold hover:bg-green-50 transition shadow-sm"
                            >
                                Resume Session
                            </button>
                        )}
                        <button
                            onClick={() => onStartMockStudy?.()}
                            className="px-8 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl font-bold hover:from-teal-700 hover:to-cyan-700 transition shadow-lg shadow-teal-200 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            Start Practice
                        </button>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Vetted Question Bank Card */}
                    <button
                        onClick={() => onStartMockStudy?.()}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-left hover:shadow-lg hover:border-teal-200 transition-all group cursor-pointer"
                    >
                        <div className="h-12 w-12 bg-gradient-to-br from-teal-100 to-cyan-100 text-teal-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-700 transition">Vetted Question Bank</h3>
                        <p className="text-gray-500 text-sm mt-2">Practice independently-reviewed questions aligned to the 2026 NOTCE blueprint.</p>
                        <div className="mt-4 text-teal-600 text-sm font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <span>Start Now</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </button>
                    
                    {/* Performance Analytics Card → canonical Analytics page */}
                    <button
                        onClick={() => onOpenAnalytics?.()}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-left hover:shadow-lg hover:border-blue-200 transition-all group cursor-pointer"
                    >
                        <div className="h-12 w-12 bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg group-hover:text-blue-700 transition">Performance Analytics</h3>
                        <p className="text-gray-500 text-sm mt-2">Track your competence across all 6 OT practice domains in real-time.</p>
                        <div className="mt-4 text-blue-600 text-sm font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <span>View Stats</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </button>
                    
                    {/* Saved Progress Card */}
                    <button 
                        onClick={() => setIsProgressOpen(true)}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-left hover:shadow-lg hover:border-green-200 transition-all group cursor-pointer"
                    >
                        <div className="h-12 w-12 bg-gradient-to-br from-green-100 to-emerald-100 text-green-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg group-hover:text-green-700 transition">Saved Progress</h3>
                        <p className="text-gray-500 text-sm mt-2">Resume exactly where you left off. Your clinical reasoning journey is safe.</p>
                        <div className="mt-4 text-green-600 text-sm font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <span>View Sessions</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </button>

                    {/* Daily Review Card (Adaptive Review Queue) */}
                    <button
                        onClick={() => setIsReviewOpen(true)}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-left hover:shadow-lg hover:border-violet-200 transition-all group cursor-pointer relative"
                    >
                        {reviewCount !== null && reviewCount > 0 && (
                            <span className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-700">{reviewCount} due</span>
                        )}
                        <div className="h-12 w-12 bg-gradient-to-br from-violet-100 to-indigo-100 text-violet-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7M19 16l2 2-2 2m2-2h-4" /></svg>
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg group-hover:text-violet-700 transition">Daily Review</h3>
                        <p className="text-gray-500 text-sm mt-2">Revisit the items you missed or weren't sure about — spaced to stick.</p>
                        <div className="mt-4 text-violet-600 text-sm font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <span>Start Review</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </button>

                    {/* Notebook Card */}
                    <button
                        onClick={() => setIsNotebookOpen(true)}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-left hover:shadow-lg hover:border-amber-200 transition-all group cursor-pointer"
                    >
                        <div className="h-12 w-12 bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg group-hover:text-amber-700 transition">My Notebook</h3>
                        <p className="text-gray-500 text-sm mt-2">Saved rationales in one place — export a printable study sheet.</p>
                        <div className="mt-4 text-amber-600 text-sm font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <span>Open Notebook</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </button>
                </div>

                {/* --- Advanced AI Practice (premium AI differentiators) --- */}
                {(() => {
                    const canUseAI = !!(isPaid || isTrial);
                    const open = (setter: (v: boolean) => void) => () => (canUseAI ? setter(true) : handleUpgrade());
                    const cards = [
                        { onClick: open(setIsAdaptiveOpen), title: 'Adaptive Readiness Test', desc: "A scaled-score estimate that adapts difficulty to your ability — like the real exam.", grad: 'from-indigo-100 to-violet-100', text: 'text-indigo-600', hover: 'hover:border-indigo-200 group-hover:text-indigo-700', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
                        { onClick: open(setIsReasoningOpen), title: 'Reasoning Coach', desc: 'Write your clinical reasoning; the AI grades the thinking, not a letter choice.', grad: 'from-blue-100 to-cyan-100', text: 'text-blue-600', hover: 'hover:border-blue-200 group-hover:text-blue-700', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                        { onClick: open(setIsEncounterOpen), title: 'Client Encounter', desc: 'Interview a simulated client and get scored on client-centred practice.', grad: 'from-teal-100 to-emerald-100', text: 'text-teal-600', hover: 'hover:border-teal-200 group-hover:text-teal-700', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 21l1.9-3.8A7.95 7.95 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
                        { onClick: open(setIsInsightsOpen), title: 'Test-Taking Insights', desc: 'See the recurring traps behind your wrong answers — and how to beat them.', grad: 'from-rose-100 to-pink-100', text: 'text-rose-600', hover: 'hover:border-rose-200 group-hover:text-rose-700', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                    ];
                    return (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <h2 className="text-xl font-black text-gray-900">Advanced AI Practice</h2>
                                <span className="px-2.5 py-1 bg-gray-900 text-white text-[10px] font-bold rounded-full uppercase tracking-wider">Premium</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {cards.map(c => (
                                    <button key={c.title} onClick={c.onClick} className={`bg-white p-5 rounded-2xl shadow-sm border border-gray-100 text-left transition-all group cursor-pointer hover:shadow-lg ${c.hover}`}>
                                        <div className={`h-11 w-11 bg-gradient-to-br ${c.grad} ${c.text} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.icon} /></svg>
                                        </div>
                                        <h3 className="font-bold text-gray-800 group-hover:text-gray-900 transition">{c.title}</h3>
                                        <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">{c.desc}</p>
                                        {!canUseAI && <span className="inline-block mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide">🔒 Upgrade to unlock</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })()}

                <div className={`bg-gradient-to-r from-teal-50 to-emerald-50 rounded-3xl p-8 border border-teal-100 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group ${!isPaid && !isTrial ? 'cursor-not-allowed' : ''}`}>
                     {/* Decorative Elements */}
                     <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-teal-200 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
                     <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-cyan-200 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
                     
                     {/* Locked Overlay */}
                     {!isPaid && (
                         <div className="absolute inset-0 bg-white/80 backdrop-blur-md z-40 flex items-center justify-center">
                             <div className="bg-white p-8 rounded-3xl shadow-2xl border border-teal-100 flex flex-col items-center text-center max-w-sm animate-in zoom-in-95 duration-300">
                                 <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mb-4">
                                     <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                 </div>
                                 <h4 className="text-xl font-bold text-gray-900 mb-2">Premium Drill Mode</h4>
                                 <p className="text-sm text-gray-500 mb-6">Adaptive Mock Study is reserved for Premium Members only. Unlock your path to mastery.</p>
                                 <button onClick={handleUpgrade} className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold text-base hover:bg-teal-700 transition shadow-lg shadow-teal-100 transform active:scale-95">Upgrade to Unlock</button>
                             </div>
                         </div>
                     )}

                     <div className="z-10 flex-1">
                        <div className="flex items-center gap-3 mb-3">
                             <span className="px-3 py-1 bg-teal-200 text-teal-800 text-xs font-bold rounded-full uppercase tracking-wider">New</span>
                             <h2 className="text-2xl font-black text-gray-900">Adaptive Mock Study</h2>
                        </div>
                        <p className="text-gray-600 text-lg leading-relaxed max-w-2xl">
                            Practice vetted, independently-reviewed bank questions one-by-one. Select your specific domain weak spots and get instant, deep-dive feedback on every answer.
                        </p>
                        
                        <div className="mt-6 flex flex-wrap gap-3">
                            {['OT Expertise', 'Ethics', 'Clinical Reasoning'].map(tag => (
                                <span key={tag} className="px-3 py-1 bg-white/60 text-teal-700 text-xs font-bold rounded-lg border border-teal-100">
                                    {tag}
                                </span>
                            ))}
                        </div>
                     </div>
                     
                     <div className="z-10 flex flex-col gap-3">
                        <button
                            onClick={() => isPaid && onStartMockStudy?.()}
                            disabled={!isPaid}
                            className="px-8 py-4 bg-teal-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-teal-200 hover:bg-teal-700 hover:scale-105 transition-all flex items-center gap-3 whitespace-nowrap justify-center w-48 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold text-base hover:bg-gray-800 hover:scale-105 transition-all flex items-center gap-2 whitespace-nowrap justify-center w-48 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg className="w-4 h-4 text-teal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                <span>Smart Drill</span>
                            </button>
                        )}

                        {/* Resume Button */}
                        {onResumeMockStudy && (
                            <button 
                                onClick={() => isPaid && onResumeMockStudy()}
                                disabled={!isPaid}
                                className="px-8 py-3 bg-white text-teal-700 rounded-xl font-bold text-base border-2 border-teal-200 hover:bg-teal-50 hover:border-teal-300 transition-all flex items-center gap-2 whitespace-nowrap justify-center w-48 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span>Resume</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </button>
                        )}
                     </div>
                </div>

                {/* Exam Simulation Feature */}
                <div className={`bg-gray-900 rounded-3xl p-8 border border-gray-800 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group ${!isPaid ? 'cursor-not-allowed' : ''}`}>
                     {/* Decorative Elements */}
                     <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-900 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
                     
                     {/* Locked Overlay */}
                     {!isPaid && (
                         <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-40 flex items-center justify-center">
                             <div className="bg-gray-800 p-8 rounded-3xl shadow-2xl border border-gray-700 flex flex-col items-center text-center max-w-sm animate-in zoom-in-95 duration-300">
                                 <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mb-4">
                                     <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                 </div>
                                 <h4 className="text-xl font-bold text-white mb-2">Full Simulation</h4>
                                 <p className="text-sm text-gray-400 mb-6">Complete exam simulation is restricted to Premium Members. Experience the real deal.</p>
                                 <button onClick={handleUpgrade} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-base hover:bg-indigo-700 transition shadow-lg shadow-indigo-900/50 transform active:scale-95">Unlock Now</button>
                             </div>
                         </div>
                     )}

                     <div className="z-10 flex-1">
                        <div className="flex items-center gap-3 mb-3">
                             <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full uppercase tracking-wider">Timed</span>
                             <h2 className="text-2xl font-black text-white">Full Exam Simulation</h2>
                        </div>
                        <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
                            The real deal. 200 questions. 4 hours. No immediate feedback. Simulate the pressure regardless of the outcome.
                        </p>
                        
                        <div className="mt-6 flex flex-wrap gap-3">
                            <span className="px-3 py-1 bg-gray-800 text-gray-300 text-xs font-bold rounded-lg border border-gray-700">
                                4 Hours
                            </span>
                             <span className="px-3 py-1 bg-gray-800 text-gray-300 text-xs font-bold rounded-lg border border-gray-700">
                                200 Questions
                            </span>
                             <span className="px-3 py-1 bg-gray-800 text-gray-300 text-xs font-bold rounded-lg border border-gray-700">
                                Book 1 & 2
                            </span>
                        </div>
                     </div>
                     
                     <div className="z-10">
                        <button 
                            onClick={() => isPaid && onStartExam?.()} 
                            disabled={!isPaid}
                            className="px-8 py-4 bg-white text-gray-900 rounded-2xl font-bold text-lg shadow-xl hover:bg-gray-100 hover:scale-105 transition-all flex items-center gap-3 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span>Start Exam</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                     </div>
                </div>
                
                {/* Blueprint Compliance Badge */}
                <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-2xl p-6 border border-indigo-100 flex items-center gap-4">
                    <div className="w-14 h-14 bg-white rounded-xl shadow flex items-center justify-center">
                        <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                    </div>
                    <div>
                        <h4 className="font-bold text-indigo-800">2026 NOTCE Blueprint Aligned</h4>
                        <p className="text-indigo-600 text-sm">All questions are independently reviewed and aligned to the latest NOTCE (CAOT) exam specifications.</p>
                    </div>
                </div>
            </div>

            {/* UPGRADE BANNER - Only show for free users not on trial */}
            {!isPaid && !isTrial && (
                <div className="max-w-5xl mx-auto mt-8 bg-gradient-to-r from-amber-200 to-yellow-400 rounded-2xl p-6 shadow-lg flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-white p-3 rounded-xl shadow-sm text-yellow-600">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-amber-900">Unlock Full Access</h3>
                            <p className="text-amber-800 font-medium">Get the "Pass Guarantee" with unlimited detailed rationales.</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleUpgrade}
                        className="px-6 py-3 bg-white text-amber-600 font-bold rounded-xl shadow hover:bg-amber-50 transition transform hover:scale-105"
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
