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

    // Format Time
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
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
                <div className="bg-white p-10 rounded-3xl shadow-xl max-w-2xl w-full text-center">
                    <h2 className="text-4xl font-bold mb-4">Exam Completed</h2>
                    <p className="text-gray-600 mb-8">Review your performance.</p>
                    <div className="text-6xl font-black text-indigo-600 mb-4">{finalScore.percentage}%</div>
                    <div className="text-xl text-gray-800">Score: {finalScore.correct} / {finalScore.total}</div>
                    <button onClick={onExit} className="mt-8 px-8 py-3 bg-gray-900 text-white rounded-xl">Exit Exam</button>
                </div>
            </div>
        );
    }

    // --- RENDER: EXAM VIEW ---
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Exam Header */}
            <div className="bg-gray-900 text-white sticky top-0 z-30 shadow-md">
                <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-lg font-bold text-gray-200">NBCOT Exam Simulation</h1>
                        <div className="text-sm text-gray-400">Question {progress.current} of {progress.total}</div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`text-2xl font-mono font-bold ${timeLeft < 300 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                            {formatTime(timeLeft)}
                        </div>
                    </div>
                </div>
                {/* Progress Bar */}
                <div className="h-1 bg-gray-800">
                    <div 
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    ></div>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 max-w-5xl mx-auto w-full p-6 pb-24 space-y-8">
                {/* Question Stem */}
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                     <HighlightableText 
                        text={currentQuestion.stem}
                        highlights={highlights}
                        onAddHighlight={addHighlight}
                        onRemoveHighlight={removeHighlight}
                    />
                </div>

                {/* Options */}
                <div className="space-y-3">
                    {currentQuestion.options.map((option: any) => (
                        <button
                            key={option.label}
                            onClick={() => setSelectedLabel(option.label)}
                            className={`w-full p-4 text-left rounded-lg border-2 transition-all flex items-start gap-4 ${
                                selectedLabel === option.label 
                                ? 'border-indigo-600 bg-indigo-50 shadow-md' 
                                : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border ${
                                selectedLabel === option.label ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-100 text-gray-500 border-gray-300'
                            }`}>
                                {option.label}
                            </div>
                            <span className="mt-1 text-gray-900 font-medium">{option.text}</span>
                        </button>
                    ))}
                </div>
            </main>

            {/* Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
                <div className="max-w-5xl mx-auto flex justify-end">
                    <button
                        onClick={handleSubmitAndNext}
                        disabled={!selectedLabel || isLoading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                                Next Question
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
