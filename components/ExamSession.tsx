import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import HighlightableText from './HighlightableText';
import { Highlight } from '../types';

interface ExamSessionProps {
    sessionId: string;
    initialData: any;
    onExit: () => void;
}

const ExamSession: React.FC<ExamSessionProps> = ({ sessionId, initialData, onExit }) => {
    // Session State
    const [currentQuestion, setCurrentQuestion] = useState(initialData.question);
    const [progress, setProgress] = useState({
        current: initialData.current_question,
        total: initialData.total_questions,
        correct: 0
    });
    
    // Timer State
    const [timeLeft, setTimeLeft] = useState<number>(4 * 60 * 60); // Default 4 hours
    
    // UI State
    const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [isComplete, setIsComplete] = useState(false);
    const [finalScore, setFinalScore] = useState<any>(null);
    const [highlights, setHighlights] = useState<Highlight[]>(initialData.highlights || []);

    // Initialize Timer
    useEffect(() => {
        // ideally calculate from server timestamp, but simple countdown for now
        const timer = setInterval(() => {
            setTimeLeft(prev => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Format Time (HH:MM:SS for Exam)
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


    const addHighlight = (h: Highlight) => setHighlights(prev => [...prev, h]);
    const removeHighlight = (id: string) => setHighlights(prev => prev.filter(h => h.id !== id));

    const handleSubmitAndNext = async () => {
        if (!selectedLabel) return;
        
        // Optimistic UI update: show loading immediately
        setLoadingMessage('Saving & Advancing...');
        setIsLoading(true);

        try {
            // 1. Submit Answer
            const submitData = await api.mockStudy.submitAnswer(sessionId, selectedLabel);
            
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

            // 2. Fetch Next Question immediately
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
            alert("Error communicating with server. Please try again.");
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
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                {/* Gradient Header */}
                <div className="bg-gradient-to-r from-cyan-400 to-emerald-400 p-12 text-center text-white">
                    <h2 className="text-4xl font-extrabold mb-2">Congratulations !</h2>
                    <p className="text-emerald-50 text-xl">You Completed the Exam.</p>
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
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-2xl font-bold">Exam Mode</h1>
                        <div className="flex items-center gap-2 opacity-90">
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
                    NBCOT Simulation
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
                        
                        let cardClasses = "w-full p-4 flex items-center gap-4 transition-all rounded bg-gray-100/50 ";
                        if (isSelected) {
                            cardClasses += "ring-2 ring-emerald-400 bg-emerald-50";
                        }

                        return (
                            <button
                                key={option.label}
                                onClick={() => setSelectedLabel(option.label)}
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
            </main>

            {/* Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 z-40">
                <div className="max-w-4xl mx-auto flex justify-end">
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
