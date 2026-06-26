/**
 * @file ExamSession.tsx
 * @description Full timed exam-mode session (NOTCE simulation). Unlike the practice
 * Mock Study flow, this is a strict 4-hour timed run with NO per-question feedback:
 * the user answers and immediately advances, only seeing a pass/fail result at the end.
 * Handles the persisted countdown timer, question advancement, highlighting, and the
 * final score screen.
 */

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import HighlightableText from './HighlightableText';
import { Highlight } from '../types';
import { useToast } from './ui/Feedback';

/** Score (%) at or above which the exam is reported as a pass. */
const PASS_THRESHOLD = 60;
/** Total exam duration in seconds (4 hours). */
const EXAM_DURATION = 4 * 60 * 60;

interface ExamSessionProps {
    /** Backend session identifier used for all answer/next/prefetch calls. */
    sessionId: string;
    /** First question + progress/highlights payload fetched before mounting. */
    initialData: any;
    /** Called to leave the exam (e.g. after completion or time-up). */
    onExit: () => void;
}

/**
 * ExamSession Component
 *
 * Drives the timed exam: renders the current question, captures a single answer,
 * submits-and-advances without showing feedback, and surfaces the final score.
 * The countdown is anchored to a persisted deadline so it survives page refreshes.
 *
 * @param {ExamSessionProps} props - Component props
 * @returns {JSX.Element} The exam view, loading state, or completion screen
 */
const ExamSession: React.FC<ExamSessionProps> = ({ sessionId, initialData, onExit }) => {
    const toast = useToast();
    // Session State
    const [currentQuestion, setCurrentQuestion] = useState(initialData.question);
    const [progress, setProgress] = useState({
        current: initialData.current_question,
        total: initialData.total_questions,
        correct: 0
    });

    // Timer State (persisted so it survives refresh — the deadline, not the count).
    const deadlineKey = `exam_deadline_${sessionId}`;
    const [timeLeft, setTimeLeft] = useState<number>(EXAM_DURATION);
    const [timeUp, setTimeUp] = useState(false);
    // Remaining-time milestones (in seconds) that should warn the user once each.
    // The ≤5-min mark already has a visual pulse, so these cover the earlier marks.
    const firedMilestonesRef = React.useRef<Set<number>>(new Set());

    // UI State
    const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [isComplete, setIsComplete] = useState(false);
    const [finalScore, setFinalScore] = useState<any>(null);
    const [highlights, setHighlights] = useState<Highlight[]>(initialData.highlights || []);

    // Server-authoritative countdown. The deadline is derived from the backend's
    // stored exam start time (GET /mock-study/time/), so it survives refreshes,
    // can't be reset by clearing storage, and is consistent across devices. A
    // localStorage cache seeds an instant render; the server then corrects it and
    // we re-sync every 30s. The local 1s tick keeps the display smooth between syncs.
    useEffect(() => {
        if (finalScore) return;
        let cancelled = false;
        // Fast-path seed from cache (or a fresh 4h) until the server responds.
        let deadline = Number(localStorage.getItem(deadlineKey)) || (Date.now() + EXAM_DURATION * 1000);

        // Warn once as the clock crosses each milestone (60 / 30 / 10 minutes left).
        const MILESTONES: { at: number; label: string }[] = [
            { at: 3600, label: '1 hour remaining' },
            { at: 1800, label: '30 minutes remaining' },
            { at: 600, label: '10 minutes remaining' },
        ];
        const seedPastMilestones = (remaining: number) => {
            for (const m of MILESTONES) {
                if (remaining < m.at - 5) firedMilestonesRef.current.add(m.at);
            }
        };
        seedPastMilestones(Math.max(0, Math.round((deadline - Date.now()) / 1000)));

        // Pull the authoritative remaining time and re-anchor the deadline.
        const syncWithServer = async () => {
            try {
                const t = await api.mockStudy.time(sessionId);
                if (cancelled) return;
                if (t.timed && t.remaining_seconds != null) {
                    deadline = Date.now() + t.remaining_seconds * 1000;
                    localStorage.setItem(deadlineKey, String(deadline));
                    if (t.expired) setTimeUp(true);
                }
            } catch {
                /* keep cached/client deadline if the server is unreachable */
            }
        };
        syncWithServer();

        const tick = () => {
            const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
            setTimeLeft(remaining);
            if (remaining <= 0) setTimeUp(true);
            for (const m of MILESTONES) {
                if (remaining <= m.at && remaining > 0 && !firedMilestonesRef.current.has(m.at)) {
                    firedMilestonesRef.current.add(m.at);
                    toast(`⏳ ${m.label} — pace yourself.`, 'warning', { duration: 6000 });
                }
            }
        };
        tick();
        const timer = setInterval(tick, 1000);
        const sync = setInterval(syncWithServer, 30000); // re-sync with the server clock
        return () => { cancelled = true; clearInterval(timer); clearInterval(sync); };
        // `toast` is stable (useCallback); intentionally not a dependency.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deadlineKey, finalScore, sessionId]);

    // Clear the persisted deadline once the exam is finished.
    useEffect(() => {
        if (finalScore) localStorage.removeItem(deadlineKey);
    }, [finalScore, deadlineKey]);

    // Warn before refresh/close mid-exam (the timer keeps running on the server-side deadline).
    useEffect(() => {
        if (finalScore) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [finalScore]);

    /** Format a duration in seconds as HH:MM:SS for the exam countdown display. */
    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Scroll to top upon new question & trigger prefetch
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Background prefetch the next question to reduce latency
        if (!isComplete) {
            api.mockStudy.prefetch(sessionId);
        }
    }, [currentQuestion, isComplete]);


    /** Append a user-created highlight to local state. */
    const addHighlight = (h: Highlight) => setHighlights(prev => [...prev, h]);
    /** Remove a user highlight by id (clicking an existing highlight). */
    const removeHighlight = (id: string) => setHighlights(prev => prev.filter(h => h.id !== id));

    /**
     * Submit the selected answer and immediately advance — exam mode shows no
     * per-question feedback. If the backend reports completion, fetch and store
     * the final score instead of another question.
     */
    const handleSubmitAndNext = async () => {
        if (!selectedLabel) return;

        // Optimistic UI update: show loading immediately
        setLoadingMessage('Saving & Advancing...');
        setIsLoading(true);

        try {
            // 1. Submit Answer
            const submitData = await api.mockStudy.submitAnswer(sessionId, selectedLabel);

            // If that was the last question, pull the final score and stop here.
            if (submitData.is_complete) {
                setIsComplete(true);
                // Fetch final results if complete
                const nextData = await api.mockStudy.nextQuestion(sessionId);
                if (nextData.is_complete) {
                    setFinalScore(nextData.final_score);
                }
                setIsLoading(false);
                return;
            }

            // 2. Fetch Next Question immediately (no feedback step in exam mode)
            const nextData = await api.mockStudy.nextQuestion(sessionId);
            
            // Update UI
            setCurrentQuestion(nextData.question);
            setProgress(prev => ({
                ...prev,
                current: nextData.current_question
            }));
            setSelectedLabel(null);

        } catch (error) {
            console.error("Exam Error:", error);
            toast("Error communicating with server. Please try again.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    // --- RENDER: LOADING STATE ---
    if (isLoading && !currentQuestion && !finalScore) {
         return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
                <div className="text-2xl font-bold animate-pulse">Loading Exam Content...</div>
            </div>
        );
    }

    // --- RENDER: COMPLETION SCREEN ---
    if (finalScore) {
        const passed = finalScore.percentage >= PASS_THRESHOLD;
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                {/* Gradient Header */}
                <div className={`p-12 text-center text-white bg-gradient-to-r ${passed ? 'from-cyan-400 to-emerald-400' : 'from-amber-400 to-orange-500'}`}>
                    <h2 className="text-4xl font-extrabold mb-2">Exam Complete</h2>
                    <p className="text-white/90 text-xl">
                        {passed
                            ? `You scored ${finalScore.percentage}% — above the ${PASS_THRESHOLD}% pass line.`
                            : `You scored ${finalScore.percentage}%. The pass line is ${PASS_THRESHOLD}%.`}
                    </p>
                </div>

                <main className="flex-1 max-w-2xl mx-auto w-full p-6 space-y-6 -mt-8">
                    {/* Your Result Card */}
                    <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
                        <h3 className="text-xl font-bold text-gray-800 text-center">Your Result</h3>

                        {/* Status Icon (reflects pass/fail) */}
                        <div className="flex justify-center">
                            <div className={`w-32 h-32 rounded-full flex items-center justify-center relative ${passed ? 'bg-cyan-100' : 'bg-amber-100'}`}>
                                <div className={`w-24 h-24 rounded-full flex items-center justify-center text-white ${passed ? 'bg-cyan-400' : 'bg-amber-400'}`}>
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
                                <span className="text-sm font-bold text-emerald-500">{finalScore.percentage}%</span>
                                <span className="text-sm font-bold text-red-400">{100 - finalScore.percentage}%</span>
                            </div>
                            <div className="h-2 w-full bg-gray-100 rounded-full flex overflow-hidden">
                                <div className="h-full bg-emerald-400" style={{ width: `${finalScore.percentage}%` }} />
                                <div className="h-full bg-red-400" style={{ width: `${100 - finalScore.percentage}%` }} />
                            </div>
                            
                            {/* Legend */}
                            <div className="flex flex-col gap-2 pt-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-3 bg-emerald-400 rounded" />
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Correct Answers</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-3 bg-red-400 rounded" />
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Incorrect Answers</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Question Summary TABLE */}
                    <div className="bg-white rounded-2xl shadow-sm p-8 space-y-6">
                        <h3 className="text-xl font-bold text-gray-800 text-center">Question Summary</h3>
                        
                        <div className="space-y-3">
                            <div className="bg-emerald-400/10 p-4 rounded-lg flex justify-between items-center text-emerald-800">
                                <div className="flex items-center gap-3 font-bold">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Total Questions
                                </div>
                                <span className="font-mono text-xl">{finalScore.total.toString().padStart(2, '0')}</span>
                            </div>
                            <div className="bg-emerald-400 text-white p-4 rounded-lg flex justify-between items-center">
                                <div className="flex items-center gap-3 font-bold">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Correct Answers
                                </div>
                                <span className="font-mono text-xl">{finalScore.correct.toString().padStart(2, '0')}</span>
                            </div>
                            <div className="bg-red-400/10 p-4 rounded-lg flex justify-between items-center text-red-800">
                                <div className="flex items-center gap-3 font-bold">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Wrong Answers
                                </div>
                                <span className="font-mono text-xl">{(finalScore.total - finalScore.correct).toString().padStart(2, '0')}</span>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button 
                                onClick={onExit}
                                className="flex-1 py-4 bg-cyan-500 text-white font-bold rounded-xl"
                            >
                                Exit Exam
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // --- RENDER: EXAM VIEW ---
    return (
        <div className="min-h-screen bg-white flex flex-col">
            {/* Header: Gradient + Step Indicators */}
            <div className="bg-gradient-to-r from-cyan-400 to-emerald-400 p-6 text-white relative">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-2xl font-bold">Exam Mode</h1>
                        <div className={`flex items-center gap-2 rounded-full px-3 py-1 ${timeLeft <= 300 ? 'bg-red-600/90 animate-pulse' : 'opacity-90'}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-mono text-lg font-bold">Time left - {formatTime(timeLeft)}</span>
                        </div>
                    </div>

                    {/* Step Indicators */}
                    <div className="flex items-center justify-center relative">
                        {/* Connecting Line */}
                        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/30 -translate-y-1/2 mx-[10%]" />
                        
                        <div className="flex justify-between w-full max-w-sm relative z-10">
                            {(() => {
                                // Show a sliding window of at most 5 step bubbles centered on the
                                // current question, clamped to the [1, total] range so the count
                                // stays constant near the start and end of the exam.
                                const maxVisible = 5;
                                let start = Math.max(1, progress.current - Math.floor(maxVisible / 2));
                                let end = Math.min(progress.total, start + maxVisible - 1);

                                if (end - start + 1 < maxVisible) {
                                    start = Math.max(1, end - maxVisible + 1);
                                }

                                return Array.from({ length: end - start + 1 }).map((_, i) => {
                                    const stepNum = start + i;
                                    const isPassed = progress.current > stepNum;
                                    const isCurrent = progress.current === stepNum;
                                    
                                    return (
                                        <div key={stepNum} className="flex flex-col items-center">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all shadow-lg ${
                                                isCurrent ? 'bg-blue-600 text-white border-2 border-white' : 
                                                isPassed ? 'bg-emerald-500 text-white' : 
                                                'bg-white text-cyan-500'
                                            }`}>
                                                {stepNum}
                                                {isCurrent && <div className="absolute -bottom-1 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sub-Header: Context */}
            <div className="bg-white px-6 py-4 flex justify-between items-center border-b border-gray-100">
                <div className="text-gray-400 font-bold text-sm">
                    {progress.current}. Question
                </div>
                <div className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                    NOTCE Simulation
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 max-w-6xl mx-auto w-full px-6 lg:px-12 pb-24 pt-6 space-y-6">
                {/* Question Stem */}
                <div className="bg-white p-2">
                     <div className="text-lg leading-relaxed text-gray-700">
                        <span className="font-bold mr-2">{progress.current}.</span>
                        <HighlightableText 
                            text={currentQuestion.stem}
                            highlights={highlights}
                            onAddHighlight={addHighlight}
                            onRemoveHighlight={removeHighlight}
                        />
                     </div>
                </div>

                {/* Options List (single-select; radio semantics) */}
                <div className="space-y-3" role="radiogroup" aria-label="Answer options">
                    {currentQuestion.options.map((option: any) => {
                        const isSelected = selectedLabel === option.label;

                        let cardClasses = "w-full text-left p-4 flex items-center gap-4 transition-all rounded-xl border-2 ";
                        cardClasses += isSelected ? "border-emerald-400 bg-emerald-50" : "border-transparent bg-gray-100/50 hover:border-emerald-200";

                        return (
                            <button
                                key={option.label}
                                role="radio"
                                aria-checked={isSelected}
                                disabled={timeUp}
                                onClick={() => setSelectedLabel(option.label)}
                                className={cardClasses}
                            >
                                <div className={`w-6 h-6 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                                    isSelected ? 'border-emerald-500' : 'border-gray-300'
                                }`}>
                                    {isSelected && <div className="w-3 h-3 rounded-full bg-emerald-500" />}
                                </div>
                                <span className={`text-lg ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                                    {option.label}. {option.text}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </main>

            {/* Time-up overlay: locks the exam and routes the user out. */}
            {timeUp && !finalScore && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Time's up</h3>
                        <p className="text-gray-500 mb-6">Your 4-hour exam window has closed. Answers submitted up to now have been recorded.</p>
                        <button onClick={onExit} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition">View Results &amp; Exit</button>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 z-40">
                <div className="max-w-6xl mx-auto px-6 lg:px-12 flex justify-end">
                    <button
                        onClick={handleSubmitAndNext}
                        disabled={!selectedLabel || isLoading}
                        className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600 text-white px-12 py-4 rounded font-bold text-lg transition-all flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Saving...
                            </>
                        ) : (
                            <>
                                Next
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExamSession;
