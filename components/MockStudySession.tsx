/**
 * @file MockStudySession.tsx
 * @description Interactive session component for the Mock Study Flow.
 * Handles fetching questions one-by-one, displaying them, submitting answers,
 * and showing feedback/progress.
 */

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import HighlightableText from './HighlightableText';
import { Highlight } from '../types';
import { useToast } from './ui/Feedback';
import { Button, Badge, LoadingScreen } from './ui';

/** Score (%) at or above which a session is reported as a pass. */
const PASS_THRESHOLD = 60;

interface MockStudySessionProps {
    /** Backend session identifier used for all answer/next/pivot/save calls. */
    sessionId: string;
    /** First question + progress/highlights payload fetched before mounting. */
    initialData: any;
    /** Called to leave the session (after save/exit or completion). */
    onExit: () => void;
}

/**
 * MockStudySession Component
 *
 * Drives the untimed practice flow: submit an answer, show inline feedback +
 * optional learning aids, then advance to the next question. Also supports the
 * "Clinical Pivot" what-if scenario and Save & Exit for resuming later.
 *
 * @param {MockStudySessionProps} props - Component props
 * @returns {JSX.Element} The question view, loading state, or completion screen
 */
const MockStudySession: React.FC<MockStudySessionProps> = ({ sessionId, initialData, onExit }) => {
    const toast = useToast();
    // Session State
    const [currentQuestion, setCurrentQuestion] = useState(initialData.question);
    const [progress, setProgress] = useState({
        current: initialData.current_question,
        total: initialData.total_questions,
        correct: 0
    });
    
    // UI State
    const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [isComplete, setIsComplete] = useState(false);
    const [finalScore, setFinalScore] = useState<any>(null);
    const [highlights, setHighlights] = useState<Highlight[]>(initialData.highlights || []);
    const [pivotData, setPivotData] = useState<any>(null);
    const [isPivoting, setIsPivoting] = useState(false);
    // Persistent (non-toast) error for failed submit/next so the user isn't left
    // staring at an unchanged screen with only a transient toast. We don't
    // auto-retry (submit/next aren't idempotent) — we offer a clear escape.
    const [actionError, setActionError] = useState<string | null>(null);
    // Pre-minted learning aids (bank questions only) + collapse state
    const [learning, setLearning] = useState<any>(null);
    const [showConcept, setShowConcept] = useState(false);
    const [showDiff, setShowDiff] = useState(false);
    // Consecutive-correct streak, used to surface encouragement toasts at milestones.
    const [streak, setStreak] = useState(0);

    // Scroll to top upon new question & trigger prefetch
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setPivotData(null); // Reset pivot on new question
        
        // Background prefetch the next question to reduce latency
        if (!isComplete && sessionId) {
            api.mockStudy.prefetch(sessionId);
        }
    }, [currentQuestion, isComplete, sessionId]);

    // Keyboard support: A–D / 1–4 select an option, Enter submits, then Enter
    // again advances. Mirrors the shortcuts already in Study mode so power users
    // can run a drill without the mouse. Ignored while loading or typing in a field.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (isLoading || isComplete || finalScore) return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            const options = currentQuestion?.options || [];
            if (!feedback) {
                const byLetter = options.find((o: any) => o.label?.toUpperCase() === e.key.toUpperCase());
                const num = parseInt(e.key, 10);
                if (byLetter) { setSelectedLabel(byLetter.label); e.preventDefault(); return; }
                if (!Number.isNaN(num) && num >= 1 && num <= options.length) {
                    setSelectedLabel(options[num - 1].label); e.preventDefault(); return;
                }
                if (e.key === 'Enter' && selectedLabel) { e.preventDefault(); handleSubmitAnswer(); }
            } else if (e.key === 'Enter') {
                e.preventDefault(); handleNextQuestion();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentQuestion, feedback, selectedLabel, isLoading, isComplete, finalScore]);

    // Honest stopwatch: time spent on this practice session, counting up from 0.
    // (Practice mode is untimed; this is informational, not a countdown.)
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        if (isComplete || finalScore) return;
        const timer = setInterval(() => {
            setElapsed(prev => prev + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [isComplete, finalScore]);

    /** Format elapsed seconds as M:SS for the stopwatch display. */
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };


    /** Request an AI "what-if" pivot variant of the current scenario. */
    const handlePivot = async () => {
        setIsPivoting(true);
        try {
            const data = await api.mockStudy.pivotQuestion(sessionId);
            setPivotData(data);
        } catch (error) {
            console.error("Failed to generate pivot:", error);
            toast("Failed to generate pivot scenario. Please try again.", "error");
        } finally {
            setIsPivoting(false);
        }
    };

    /** Persist progress (including highlights) so the session can be resumed, then exit. */
    const handleSaveAndExit = async () => {
        setIsLoading(true);
        try {
            await api.mockStudy.saveSession(sessionId, highlights);
            toast('Progress saved — resume any time from where you left off.', 'success');
            onExit();
        } catch (error) {
            console.error("Failed to save session:", error);
            toast("Failed to save progress. Please try again.", "error");
            setIsLoading(false);
        }
    };

    /** Append a user-created highlight to local state. */
    const addHighlight = (h: Highlight) => setHighlights(prev => [...prev, h]);
    /** Remove a user highlight by id (clicking an existing highlight). */
    const removeHighlight = (id: string) => setHighlights(prev => prev.filter(h => h.id !== id));

    /**
     * Submit the selected answer and reveal feedback + learning aids inline.
     * Does NOT advance — the user reviews the reasoning, then taps Next.
     */
    const handleSubmitAnswer = async () => {
        if (!selectedLabel) return;

        setActionError(null);
        setIsLoading(true);
        try {
            const data = await api.mockStudy.submitAnswer(sessionId, selectedLabel);
            setFeedback(data.feedback);
            const lrn = data.learning || null;
            setLearning(lrn);
            // On a wrong answer, auto-expand the learning aids — that's exactly when
            // the learner needs the reframing/core concept, instead of hiding them
            // behind a toggle they might not notice.
            if (lrn && !data.feedback?.is_correct) {
                setShowDiff(!!lrn.explain_differently);
                setShowConcept(!!lrn.core_concept);
            }
            setProgress(prev => ({
                ...prev,
                correct: data.progress.correct
            }));

            // Track a correct-answer streak and cheer the user on at milestones; a
            // wrong answer quietly resets it (the feedback panel already explains why).
            if (data.feedback?.is_correct) {
                const next = streak + 1;
                setStreak(next);
                if (next === 3 || next === 5 || next === 10 || (next > 10 && next % 5 === 0)) {
                    toast(`🔥 ${next} correct in a row — keep it up!`, 'success');
                }
            } else {
                setStreak(0);
            }

            if (data.is_complete) {
                // If this was the last question, prepare for completion
                setIsComplete(true);
            }
        } catch (error) {
            console.error("Failed to submit answer:", error);
            setActionError("We couldn't submit your answer — check your connection, then tap your answer and submit again.");
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Advance from the feedback view. If the session is finished, fetch the final
     * score; otherwise reset per-question UI state and load the next question.
     */
    const handleNextQuestion = async () => {
        setActionError(null);
        if (isComplete) {
            // Fetch final results
            setIsLoading(true);
            try {
                const data = await api.mockStudy.nextQuestion(sessionId);
                if (data.is_complete) {
                    setFinalScore(data.final_score);
                    const pct = data.final_score?.percentage;
                    if (typeof pct === 'number') {
                        toast(`Session complete — you scored ${pct}%.`, pct >= PASS_THRESHOLD ? 'success' : 'info');
                    }
                }
            } catch (error) {
                console.error("Failed to finish session:", error);
                toast('Failed to load your results. Please try again.', 'error');
            } finally {
                setIsLoading(false);
            }
            return;
        }

        setLoadingMessage(`Generating Question ${progress.current + 1} of ${progress.total}...`);
        setIsLoading(true);
        setFeedback(null);
        setSelectedLabel(null);
        setLearning(null);
        setShowConcept(false);
        setShowDiff(false);

        try {
            const data = await api.mockStudy.nextQuestion(sessionId);
            setCurrentQuestion(data.question);
            setProgress(prev => ({
                ...prev,
                current: data.current_question
            }));
        } catch (error) {
            console.error("Failed to fetch next question:", error);
            setActionError("We couldn't load the next question — check your connection and tap Next again.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- RENDER: LOADING STATE ---
    if (isLoading && !feedback && !finalScore) {
        return (
            <div className="h-full bg-canvas flex items-center justify-center p-8">
                <LoadingScreen title="Thinking…" subtitle={loadingMessage || 'Analyzing domain requirements…'} />
            </div>
        );
    }

    // --- RENDER: COMPLETION SCREEN ---
    if (finalScore) {
        const passed = finalScore.percentage >= PASS_THRESHOLD;
        return (
            <div className="h-full bg-canvas flex flex-col overflow-y-auto">
                {/* Gradient Header */}
                <div className={`px-6 py-14 text-center text-white bg-gradient-to-br ${passed ? 'from-brand-500 to-brand-600' : 'from-amber-500 to-orange-600'}`}>
                    <div className="animate-fade-in-up">
                        <h2 className="text-4xl font-extrabold mb-2">{passed ? 'Well done!' : 'Keep going.'}</h2>
                        <p className="text-white/90 text-lg max-w-xl mx-auto">
                            {passed
                                ? `You scored ${finalScore.percentage}% — above the ${PASS_THRESHOLD}% pass line.`
                                : `You scored ${finalScore.percentage}%. The pass line is ${PASS_THRESHOLD}% — review and try again.`}
                        </p>
                    </div>
                </div>

                <main className="flex-1 max-w-2xl mx-auto w-full p-6 space-y-6 -mt-8 animate-scale-in">
                    {/* Your Result Card */}
                    <div className="bg-white rounded-3xl shadow-card ring-1 ring-slate-200/70 p-8 space-y-8">
                        <h3 className="text-lg font-bold text-ink text-center">Your Result</h3>

                        {/* Status Icon (reflects pass/fail) */}
                        <div className="flex justify-center">
                            <div className={`w-32 h-32 rounded-full flex items-center justify-center ${passed ? 'bg-brand-50 ring-1 ring-brand-100' : 'bg-amber-50 ring-1 ring-amber-100'}`}>
                                <div className={`w-24 h-24 rounded-full flex items-center justify-center text-white shadow-soft ${passed ? 'bg-gradient-to-br from-brand-500 to-brand-600' : 'bg-gradient-to-br from-amber-400 to-amber-500'}`}>
                                    {passed ? (
                                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                                    ) : (
                                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Accuracy Bar */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-sm font-bold text-emerald-600">{finalScore.percentage}%</span>
                                <span className="text-sm font-bold text-red-500">{100 - finalScore.percentage}%</span>
                            </div>
                            <div className="h-2.5 w-full bg-slate-100 rounded-full flex overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${finalScore.percentage}%` }} />
                                <div className="h-full bg-red-400 transition-all duration-500" style={{ width: `${100 - finalScore.percentage}%` }} />
                            </div>

                            {/* Legend */}
                            <div className="flex flex-col gap-2 pt-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-3 bg-emerald-500 rounded" />
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Correct Answers</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-3 bg-red-400 rounded" />
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Incorrect Answers</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Question Summary TABLE */}
                    <div className="bg-white rounded-3xl shadow-card ring-1 ring-slate-200/70 p-8 space-y-6">
                        <h3 className="text-lg font-bold text-ink text-center">Question Summary</h3>

                        <div className="space-y-3">
                            <div className="bg-slate-50 ring-1 ring-slate-200/70 p-4 rounded-2xl flex justify-between items-center text-ink">
                                <div className="flex items-center gap-3 font-bold">
                                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Total Questions
                                </div>
                                <span className="font-mono text-xl">{finalScore.total.toString().padStart(2, '0')}</span>
                            </div>
                            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-4 rounded-2xl flex justify-between items-center shadow-soft">
                                <div className="flex items-center gap-3 font-bold">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Correct Answers
                                </div>
                                <span className="font-mono text-xl">{finalScore.correct.toString().padStart(2, '0')}</span>
                            </div>
                            <div className="bg-red-50 ring-1 ring-red-100 p-4 rounded-2xl flex justify-between items-center text-red-700">
                                <div className="flex items-center gap-3 font-bold">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Wrong Answers
                                </div>
                                <span className="font-mono text-xl">{(finalScore.total - finalScore.correct).toString().padStart(2, '0')}</span>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button size="lg" fullWidth onClick={onExit}>Back to Dashboard</Button>
                            <p className="text-center text-xs text-slate-400 mt-3">Start a fresh drill any time from your dashboard.</p>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // Robustly derive the correct option label from feedback instead of the old
    // fragile character-offset scan of the explanation string. If the user was
    // right, their selection is correct; otherwise pull the letter from the
    // stable "The correct answer is X." message (falling back to the explanation).
    const correctLabel: string | null = feedback
        ? (feedback.is_correct
            ? selectedLabel
            : (feedback.feedback_message?.match(/correct answer is\s+([A-Z])/i)?.[1]
                || feedback.explanation?.match(/Correct answer \(([A-Z])\)/i)?.[1]
                || null))
        : null;

    // --- RENDER: QUESTION VIEW ---
    return (
        <div className="h-full bg-canvas flex flex-col overflow-hidden">
            {/* Compact header: title, progress dots, timer + Save/Exit on one row */}
            <div className="bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-3 text-white flex-shrink-0 shadow-soft z-20">
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <h1 className="text-base font-bold whitespace-nowrap">Practice MCQ</h1>
                        {/* Step dots: compact sliding window */}
                        <div className="hidden sm:flex items-center gap-1.5">
                            {(() => {
                                const maxVisible = 5;
                                let start = Math.max(1, progress.current - Math.floor(maxVisible / 2));
                                let end = Math.min(progress.total, start + maxVisible - 1);
                                if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
                                return Array.from({ length: end - start + 1 }).map((_, i) => {
                                    const stepNum = start + i;
                                    const isPassed = progress.current > stepNum;
                                    const isCurrent = progress.current === stepNum;
                                    return (
                                        <div key={stepNum} className={`rounded-full flex items-center justify-center font-bold text-[11px] transition-all duration-200 ${
                                            isCurrent ? 'w-7 h-7 bg-white text-brand-700 shadow-soft' :
                                            isPassed ? 'w-6 h-6 bg-white/45 text-white' :
                                            'w-6 h-6 bg-white/20 text-white/80'
                                        }`}>{stepNum}</div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                        <span className="inline-flex items-center gap-1.5 font-mono text-sm font-bold whitespace-nowrap bg-white/15 rounded-full px-3 py-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {formatTime(elapsed)}
                        </span>
                        <button
                            onClick={handleSaveAndExit}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 text-sm font-bold text-white/90 hover:text-white transition-colors disabled:opacity-60"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v6h6M3 13a9 9 0 109-9" /></svg>
                            <span className="hidden sm:inline">Save &amp; Exit</span>
                        </button>
                    </div>
                </div>
                {/* Thin progress bar (replaces the tall step row's vertical cost). */}
                <div className="max-w-6xl mx-auto mt-2.5 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }} />
                </div>
            </div>

            {/* Scrollable content region — only this scrolls, header + action bar stay put */}
            <main className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto w-full px-6 lg:px-8 py-5 space-y-4">
                {/* Persistent action error with a clear escape (A9). */}
                {actionError && (
                    <div className="bg-red-50 ring-1 ring-red-100 rounded-2xl p-4 flex items-start gap-3 animate-fade-in-up">
                        <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" /></svg>
                        <div className="flex-1">
                            <p className="text-sm text-red-700">{actionError}</p>
                            <div className="mt-2 flex gap-3">
                                <button onClick={() => setActionError(null)} className="text-sm font-semibold text-red-600 hover:text-red-800">Dismiss</button>
                                <button onClick={handleSaveAndExit} className="text-sm font-semibold text-slate-500 hover:text-slate-700">Save &amp; Exit</button>
                            </div>
                        </div>
                    </div>
                )}
                {/* Question Stem */}
                <div className="bg-white rounded-3xl shadow-card ring-1 ring-slate-200/70 p-5 md:p-6">
                     {currentQuestion.vetted && (
                        <div className="mb-3">
                            <Badge tone="success" icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}>
                                Vetted · Premium Bank
                            </Badge>
                        </div>
                     )}
                     <p className="text-base md:text-lg leading-relaxed text-ink">
                        {currentQuestion.stem}
                     </p>
                </div>

                {/* Options List (single-select; radio semantics) */}
                <div className="space-y-2.5" role="radiogroup" aria-label="Answer options">
                    {currentQuestion.options.map((option: any) => {
                        const isSelected = selectedLabel === option.label;
                        const isTheCorrect = !!feedback && correctLabel === option.label;
                        const isWrongPick = !!feedback && isSelected && !feedback.is_correct;

                        let cardClasses = "w-full text-left p-4 flex items-center gap-3.5 transition-all duration-200 rounded-2xl ring-1 ";

                        if (feedback) {
                            if (isTheCorrect) {
                                cardClasses += "ring-2 ring-emerald-500 bg-emerald-50";
                            } else if (isWrongPick) {
                                cardClasses += "ring-2 ring-red-500 bg-red-50";
                            } else {
                                cardClasses += "ring-slate-200/70 bg-white opacity-70";
                            }
                        } else if (isSelected) {
                            cardClasses += "ring-2 ring-brand-500 bg-brand-50 shadow-soft";
                        } else {
                            cardClasses += "ring-slate-200/70 bg-white hover:ring-brand-300 hover:-translate-y-0.5 hover:shadow-soft";
                        }

                        return (
                            <button
                                key={option.label}
                                role="radio"
                                aria-checked={isSelected}
                                disabled={!!feedback}
                                onClick={() => !feedback && setSelectedLabel(option.label)}
                                className={cardClasses}
                            >
                                {/* Radio dot, or result icon after feedback (icon = non-color cue) */}
                                <div className={`w-7 h-7 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                                    feedback
                                        ? (isTheCorrect ? 'bg-emerald-500 border-emerald-500 text-white'
                                            : isWrongPick ? 'bg-red-500 border-red-500 text-white'
                                            : 'border-slate-300')
                                        : (isSelected ? 'border-brand-500' : 'border-slate-300')
                                }`}>
                                    {feedback ? (
                                        isTheCorrect ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                                            : isWrongPick ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M6 18L18 6M6 6l12 12" /></svg>
                                            : null
                                    ) : (
                                        isSelected && <div className="w-3 h-3 rounded-full bg-brand-500" />
                                    )}
                                </div>
                                <span className={`text-base md:text-lg ${isSelected || isTheCorrect ? 'text-ink font-medium' : 'text-slate-600'}`}>
                                    {option.label}. {option.text}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Feedback Panel */}
                {feedback && (
                    <div className={`rounded-3xl p-5 animate-fade-in-up ring-1 ${feedback.is_correct ? 'bg-emerald-50 ring-emerald-100' : 'bg-red-50 ring-red-100'}`}>
                        <div className="flex gap-3 mb-3 items-center">
                            <div className={`text-2xl ${feedback.is_correct ? 'animate-bounce' : ''}`}>
                                {feedback.is_correct ? '🎉' : '💡'}
                            </div>
                            <h3 className={`text-base font-bold ${feedback.is_correct ? 'text-emerald-800' : 'text-red-800'}`}>
                                {feedback.feedback_message}
                            </h3>
                        </div>
                        <div className="bg-white/70 ring-1 ring-white/60 p-4 rounded-2xl">
                             <div className="text-slate-700 text-sm md:text-base leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
                                {(feedback.explanation || '')
                                    .replace(/\*\*([^*]+)\*\*/g, '$1')
                                    .replace(/\*([^*]+)\*/g, '$1')
                                    .replace(/\*\*/g, '')
                                }
                             </div>
                        </div>

                        {/* Pre-minted student learning aids (bank questions) */}
                        {learning && (learning.explain_differently || learning.core_concept) && (
                            <div className="mt-4 space-y-3">
                                {learning.explain_differently && (
                                    <div className="bg-white/80 rounded-2xl ring-1 ring-brand-100 overflow-hidden">
                                        <button
                                            onClick={() => setShowDiff(s => !s)}
                                            className="w-full flex items-center justify-between p-4 font-bold text-brand-800 hover:bg-brand-50/60 transition-colors"
                                        >
                                            <span className="flex items-center gap-2">🔄 Explain it differently</span>
                                            <span className="text-xl leading-none">{showDiff ? '−' : '+'}</span>
                                        </button>
                                        {showDiff && (
                                            <p className="px-4 pb-4 text-slate-700 text-base leading-relaxed animate-fade-in">{learning.explain_differently}</p>
                                        )}
                                    </div>
                                )}
                                {learning.core_concept && (
                                    <div className="bg-white/80 rounded-2xl ring-1 ring-indigo-100 overflow-hidden">
                                        <button
                                            onClick={() => setShowConcept(s => !s)}
                                            className="w-full flex items-center justify-between p-4 font-bold text-indigo-800 hover:bg-indigo-50/60 transition-colors"
                                        >
                                            <span className="flex items-center gap-2">💡 Core concept</span>
                                            <span className="text-xl leading-none">{showConcept ? '−' : '+'}</span>
                                        </button>
                                        {showConcept && (
                                            <p className="px-4 pb-4 text-slate-700 text-base leading-relaxed animate-fade-in">{learning.core_concept}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Pivot Scenario Display */}
                {pivotData && (
                    <div className="bg-amber-50 rounded-3xl p-5 ring-1 ring-amber-200 animate-fade-in-up">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-amber-100 rounded-xl text-amber-700">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-amber-900">Clinical Pivot: What If?</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-white/70 p-4 rounded-2xl ring-1 ring-amber-100">
                                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">The Shift</span>
                                <p className="font-semibold text-ink mt-1">{pivotData.change_explanation ? pivotData.pivot_variable : "Scenario Shift"}</p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-2xl ring-1 ring-slate-200/70 shadow-soft">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">New Scenario Context</span>
                                    <p className="text-slate-700 mt-2 text-sm italic">"{pivotData.new_scenario_snippet}"</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl ring-1 ring-indigo-100 shadow-soft">
                                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">How Reasoning Changes</span>
                                    <p className="text-slate-700 mt-2 text-sm">{pivotData.change_explanation}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
              </div>
            </main>

            {/* Pinned action bar — part of the column, always visible (no scrolling). */}
            <div className="flex-shrink-0 bg-white/80 backdrop-blur border-t border-slate-200/70 px-6 lg:px-8 py-3">
                <div className="max-w-3xl mx-auto flex justify-end">
                    {!feedback ? (
                        <Button
                            size="lg"
                            onClick={handleSubmitAnswer}
                            disabled={!selectedLabel}
                            loading={isLoading}
                            className="w-full sm:w-auto"
                            rightIcon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
                        >
                            {isLoading ? 'Checking…' : 'Submit'}
                        </Button>
                    ) : (
                        <Button
                            size="lg"
                            onClick={handleNextQuestion}
                            className="w-full sm:w-auto"
                            rightIcon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
                        >
                            {loadingMessage ? 'Continue…' : (isComplete ? 'Finish Session' : 'Next Question')}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MockStudySession;
