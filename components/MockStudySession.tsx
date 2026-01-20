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

interface MockStudySessionProps {
    sessionId: string;
    initialData: any;
    onExit: () => void;
}

const MockStudySession: React.FC<MockStudySessionProps> = ({ sessionId, initialData, onExit }) => {
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

    // Scroll to top upon new question & trigger prefetch
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setPivotData(null); // Reset pivot on new question
        
        // Background prefetch the next question to reduce latency
        if (!isComplete && sessionId) {
            api.mockStudy.prefetch(sessionId);
        }
    }, [currentQuestion, isComplete, sessionId]);

    // Simple timer logic if none exists (mocking it for UI parity with mockup)
    const [secondsLeft, setSecondsLeft] = useState(841); // 14:01
    useEffect(() => {
        if (isComplete || finalScore) return;
        const timer = setInterval(() => {
            setSecondsLeft(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [isComplete, finalScore]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };


    const handlePivot = async () => {
        setIsPivoting(true);
        try {
            const data = await api.mockStudy.pivotQuestion(sessionId);
            setPivotData(data);
        } catch (error) {
            console.error("Failed to generate pivot:", error);
            alert("Failed to generate pivot scenario. Please try again.");
        } finally {
            setIsPivoting(false);
        }
    };

    const handleSaveAndExit = async () => {
        setIsLoading(true);
        try {
            await api.mockStudy.saveSession(sessionId, highlights);
            onExit();
        } catch (error) {
            console.error("Failed to save session:", error);
            alert("Failed to save progress. Please try again.");
            setIsLoading(false);
        }
    };

    const addHighlight = (h: Highlight) => setHighlights(prev => [...prev, h]);
    const removeHighlight = (id: string) => setHighlights(prev => prev.filter(h => h.id !== id));

    const handleSubmitAnswer = async () => {
        if (!selectedLabel) return;
        
        setIsLoading(true);
        try {
            const data = await api.mockStudy.submitAnswer(sessionId, selectedLabel);
            setFeedback(data.feedback);
            setProgress(prev => ({
                ...prev,
                correct: data.progress.correct
            }));
            
            if (data.is_complete) {
                // If this was the last question, prepare for completion
                setIsComplete(true);
            }
        } catch (error) {
            console.error("Failed to submit answer:", error);
            alert("Failed to submit answer. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleNextQuestion = async () => {
        if (isComplete) {
            // Fetch final results
            setIsLoading(true);
            try {
                const data = await api.mockStudy.nextQuestion(sessionId);
                if (data.is_complete) {
                    setFinalScore(data.final_score);
                }
            } catch (error) {
                console.error("Failed to finish session:", error);
            } finally {
                setIsLoading(false);
            }
            return;
        }

        setLoadingMessage(`Generating Question ${progress.current + 1} of ${progress.total}...`);
        setIsLoading(true);
        setFeedback(null);
        setSelectedLabel(null);

        try {
            const data = await api.mockStudy.nextQuestion(sessionId);
            setCurrentQuestion(data.question);
            setProgress(prev => ({
                ...prev,
                current: data.current_question
            }));
        } catch (error) {
            console.error("Failed to fetch next question:", error);
            alert("Failed to generate next question. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- RENDER: LOADING STATE ---
    if (isLoading && !feedback && !finalScore) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
                <div className="bg-white p-10 rounded-3xl shadow-xl flex flex-col items-center max-w-lg w-full text-center space-y-6 animate-pulse">
                    <div className="w-20 h-20 relative">
                        <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-t-indigo-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center text-2xl">🧠</div>
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">Thinking...</h3>
                        <p className="text-gray-500">{loadingMessage || 'Analyzing domain requirements...'}</p>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-indigo-500 animate-progress-indeterminate"></div>
                    </div>
                </div>
            </div>
        );
    }

    // --- RENDER: COMPLETION SCREEN ---
    if (finalScore) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                {/* Gradient Header */}
                <div className="bg-gradient-to-r from-cyan-400 to-emerald-400 p-12 text-center text-white">
                    <h2 className="text-4xl font-extrabold mb-2">Congratulations !</h2>
                    <p className="text-emerald-50 text-xl">You Passed the test.</p>
                </div>
                
                <main className="flex-1 max-w-2xl mx-auto w-full p-6 space-y-6 -mt-8">
                    {/* Your Result Card */}
                    <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
                        <h3 className="text-xl font-bold text-gray-800 text-center">Your Result</h3>
                        
                        {/* Status Checkmark */}
                        <div className="flex justify-center">
                            <div className="w-32 h-32 rounded-full bg-cyan-100 flex items-center justify-center relative">
                                <div className="w-24 h-24 rounded-full bg-cyan-400 flex items-center justify-center text-white">
                                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
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
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-3 bg-amber-400 rounded" />
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Skipped Questions</span>
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
                            <div className="bg-emerald-400/10 p-4 rounded-lg flex justify-between items-center text-emerald-800">
                                <div className="flex items-center gap-3 font-bold">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Wrong Answers
                                </div>
                                <span className="font-mono text-xl">{(finalScore.total - finalScore.correct).toString().padStart(2, '0')}</span>
                            </div>
                            <div className="bg-emerald-400/10 p-4 rounded-lg flex justify-between items-center text-emerald-800">
                                <div className="flex items-center gap-3 font-bold">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                                    Skipped Questions
                                </div>
                                <span className="font-mono text-xl">00</span>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button 
                                onClick={() => window.location.reload()}
                                className="flex-1 py-4 bg-gray-200 text-gray-700 font-bold rounded-xl"
                            >
                                Restart
                            </button>
                            <button 
                                onClick={onExit}
                                className="flex-1 py-4 bg-cyan-500 text-white font-bold rounded-xl"
                            >
                                Exit
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // --- RENDER: QUESTION VIEW ---
    return (
        <div className="min-h-screen bg-white flex flex-col">
            {/* Header: Gradient + Step Indicators */}
            <div className="bg-gradient-to-r from-cyan-400 to-emerald-400 p-6 text-white relative">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-2xl font-bold">Multichoice MCQ</h1>
                        <div className="flex items-center gap-2 opacity-90">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-mono text-lg font-bold">Time left - {formatTime(secondsLeft)}</span>
                        </div>
                    </div>

                    {/* Step Indicators */}
                    <div className="flex items-center justify-center relative">
                        {/* Connecting Line */}
                        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/30 -translate-y-1/2 mx-[10%]" />
                        
                        <div className="flex justify-between w-full max-w-sm relative z-10">
                            {(() => {
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

            {/* Sub-Header: Save/Exit & Context */}
            <div className="bg-white px-6 py-4 flex justify-between items-center border-b border-gray-100">
                <button 
                    onClick={handleSaveAndExit}
                    disabled={isLoading}
                    className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Previous
                </button>
                <div className="text-gray-400 font-bold text-sm">
                    {progress.current}. Question
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 max-w-4xl mx-auto w-full p-6 pb-24 space-y-6">
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

                {/* Options List */}
                <div className="space-y-3">
                    {currentQuestion.options.map((option: any) => {
                        const isSelected = selectedLabel === option.label;
                        const isCorrect = feedback && option.label === feedback.explanation.charAt(feedback.explanation.indexOf('Correct answer (') + 16);
                        
                        let cardClasses = "w-full p-4 flex items-center gap-4 transition-all rounded bg-gray-100/50 ";
                        
                        if (feedback) {
                            if (isSelected && feedback.is_correct) {
                                cardClasses += "border border-emerald-500 bg-emerald-50";
                            } else if (isSelected && !feedback.is_correct) {
                                cardClasses += "border border-red-500 bg-red-50";
                            } else if (!feedback.is_correct && feedback.explanation.includes(`Correct answer (${option.label})`)) {
                                cardClasses += "border border-emerald-500 bg-emerald-50";
                            }
                        } else if (isSelected) {
                            cardClasses += "ring-2 ring-emerald-400 bg-emerald-50";
                        }

                        return (
                            <button
                                key={option.label}
                                onClick={() => !feedback && setSelectedLabel(option.label)}
                                className={cardClasses}
                            >
                                <div className={`w-5 h-5 rounded-sm border flex items-center justify-center transition-colors ${
                                    isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-300'
                                }`}>
                                    {isSelected && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                <span className={`text-lg transition-colors ${isSelected ? 'text-emerald-900 font-medium' : 'text-gray-600'}`}>
                                    {option.label}. {option.text}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Feedback Panel */}
                {feedback && (
                    <div className={`rounded-3xl p-8 animate-in slide-in-from-bottom-4 duration-300 border ${feedback.is_correct ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                        <div className="flex gap-4 mb-4">
                            <div className={`text-4xl ${feedback.is_correct ? 'animate-bounce' : ''}`}>
                                {feedback.is_correct ? '🎉' : '💡'}
                            </div>
                            <div>
                                <h3 className={`text-xl font-bold ${feedback.is_correct ? 'text-green-800' : 'text-red-800'}`}>
                                    {feedback.feedback_message}
                                </h3>
                                <p className={`font-medium mt-1 ${feedback.is_correct ? 'text-green-700' : 'text-red-700'}`}>
                                    Let's look at the reasoning.
                                </p>
                            </div>
                        </div>
                        <div className="prose prose-sm max-w-none bg-white/50 p-6 rounded-2xl">
                             <div className="whitespace-pre-wrap text-gray-700 text-base leading-relaxed">
                                {feedback.explanation}
                             </div>
                        </div>
                    </div>
                )}

                {/* Pivot Scenario Display */}
                {pivotData && (
                    <div className="bg-amber-50 rounded-3xl p-8 border border-amber-200 animate-in fade-in duration-500">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-amber-900">Clinical Pivot: What If?</h3>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="bg-white/60 p-4 rounded-xl border border-amber-100">
                                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">The Shift</span>
                                <p className="font-semibold text-gray-900 mt-1">{pivotData.change_explanation ? pivotData.pivot_variable : "Scenario Shift"}</p>
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <span className="text-xs font-bold text-gray-400 uppercase">New Scenario Context</span>
                                    <p className="text-gray-700 mt-2 text-sm italic">"{pivotData.new_scenario_snippet}"</p>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                                    <span className="text-xs font-bold text-indigo-400 uppercase">How Reasoning Changes</span>
                                    <p className="text-gray-700 mt-2 text-sm">{pivotData.change_explanation}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 z-40">
                <div className="max-w-4xl mx-auto flex justify-end">
                    {!feedback ? (
                        <button
                            onClick={handleSubmitAnswer}
                            disabled={!selectedLabel || isLoading}
                            className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600 text-white px-12 py-4 rounded font-bold text-lg transition-all flex items-center justify-center gap-2"
                        >
                            {isLoading ? 'Checking...' : 'Next'}
                            {!isLoading && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
                        </button>
                    ) : (
                        <div className="w-full flex gap-4">
                            <button
                                onClick={handleNextQuestion}
                                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-4 rounded font-bold text-lg transition-all flex items-center justify-center gap-2"
                            >
                                <span>{loadingMessage ? 'Continue...' : (isComplete ? 'Finish Session' : 'Next')}</span>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MockStudySession;
