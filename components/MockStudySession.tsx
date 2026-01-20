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

    // Scroll to top upon new question
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setPivotData(null); // Reset pivot on new question
    }, [currentQuestion]);

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
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden max-w-2xl w-full">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-10 text-center text-white">
                        <div className="text-6xl mb-4">🎉</div>
                        <h2 className="text-4xl font-extrabold mb-2">Session Complete!</h2>
                        <p className="text-indigo-100 text-lg">Great job practicing your clinical reasoning.</p>
                    </div>
                    
                    <div className="p-10 space-y-8">
                        <div className="grid grid-cols-2 gap-8 text-center">
                            <div className="p-6 bg-green-50 rounded-2xl border border-green-100">
                                <div className="text-4xl font-black text-green-600 mb-1">{finalScore.percentage}%</div>
                                <div className="text-sm font-bold text-green-800 uppercase tracking-wide">Accuracy</div>
                            </div>
                            <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                                <div className="text-4xl font-black text-blue-600 mb-1">{finalScore.correct}/{finalScore.total}</div>
                                <div className="text-sm font-bold text-blue-800 uppercase tracking-wide">Questions Correct</div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button 
                                onClick={onExit}
                                className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition"
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- RENDER: QUESTION VIEW ---
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header / Progress Bar */}
            <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">

                        <button 
                            onClick={handleSaveAndExit}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                            Save & Exit
                        </button>
                        <div>
                            <span className="font-bold text-gray-900">Question {progress.current}</span>
                            <span className="text-gray-400 mx-2">/</span>
                            <span className="text-gray-500">{progress.total}</span>
                        </div>
                    </div>
                    <div className="w-48 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ease-out"
                            style={{ width: `${(progress.current / progress.total) * 100}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 max-w-4xl mx-auto w-full p-6 pb-24 space-y-8">
                {/* Question Stem */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                     <p className="text-sm text-gray-400 font-bold mb-4 uppercase tracking-wide">Question Stem (Highlight Key Details)</p>
                     <HighlightableText 
                        text={currentQuestion.stem}
                        highlights={highlights}
                        onAddHighlight={addHighlight}
                        onRemoveHighlight={removeHighlight}
                    />
                </div>

                {/* Options Grid */}
                <div className="grid grid-cols-1 gap-4">
                    {currentQuestion.options.map((option: any) => {
                        const isSelected = selectedLabel === option.label;
                        const isCorrect = feedback && option.label === feedback.explanation.charAt(feedback.explanation.indexOf('Correct answer (') + 16); // Hacky parsing, better if API returned explicit correct label
                        // Actually, let's rely on feedback state logic properly
                        // If feedback exists:
                        // - If this option was selected and correct -> Green
                        // - If this option was selected and wrong -> Red
                        // - If this is the correct option (even if not selected) -> Green (reveal)
                        
                        let cardClasses = "p-6 rounded-2xl border-2 text-left transition-all relative overflow-hidden group ";
                        
                        if (feedback) {
                            // Review Mode
                            if (isSelected && feedback.is_correct) {
                                cardClasses += "border-green-500 bg-green-50 text-green-900 pointer-events-none";
                            } else if (isSelected && !feedback.is_correct) {
                                cardClasses += "border-red-500 bg-red-50 text-red-900 pointer-events-none";
                            } else if (!feedback.is_correct && feedback.explanation.includes(`Correct answer (${option.label})`)) {
                                cardClasses += "border-green-500 bg-green-50 text-green-900 pointer-events-none opacity-100";
                            } else {
                                cardClasses += "border-gray-100 bg-gray-50 text-gray-400 opacity-60 pointer-events-none";
                            }
                        } else {
                            // Active Mode
                            if (isSelected) {
                                cardClasses += "border-indigo-600 bg-indigo-50 shadow-md transform scale-[1.01] z-10";
                            } else {
                                cardClasses += "border-gray-100 bg-white hover:border-indigo-200 hover:bg-gray-50 hover:shadow-sm cursor-pointer";
                            }
                        }

                        return (
                            <button
                                key={option.label}
                                onClick={() => !feedback && setSelectedLabel(option.label)}
                                className={cardClasses}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0 transition-colors ${
                                        isSelected && !feedback ? 'bg-indigo-600 text-white' : 
                                        feedback && isSelected ? 'bg-transparent border-2 border-current' :
                                        'bg-gray-100 text-gray-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                                    }`}>
                                        {option.label}
                                    </div>
                                    <span className="text-lg font-medium">{option.text}</span>
                                    
                                    {/* Feedback Icons */}
                                    {feedback && isSelected && feedback.is_correct && (
                                        <div className="ml-auto text-green-600">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                    )}
                                    {feedback && isSelected && !feedback.is_correct && (
                                        <div className="ml-auto text-red-500">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </div>
                                    )}
                                </div>
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
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-6 z-40">
                <div className="max-w-4xl mx-auto flex justify-end">
                    {!feedback ? (
                        <button
                            onClick={handleSubmitAnswer}
                            disabled={!selectedLabel || isLoading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                        >
                            {isLoading ? 'Checking...' : 'Check Answer'}
                        </button>
                    ) : (
                        <div className="w-full flex gap-4">
                            {!pivotData ? (
                                <button
                                    onClick={handlePivot}
                                    disabled={isPivoting}
                                    className="flex-1 py-4 bg-white text-indigo-600 font-bold rounded-xl border-2 border-indigo-100 hover:bg-indigo-50 hover:border-indigo-200 transition flex items-center justify-center gap-2"
                                >
                                    {isPivoting ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Analyzing Shift...
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Pivot Scenario
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="flex-1 text-center py-4 text-gray-400 font-medium text-sm flex items-center justify-center border border-dashed border-gray-200 rounded-xl">
                                    Pivot Analyzed
                                </div>
                            )}
                            
                            <button
                                onClick={handleNextQuestion}
                                className="flex-1 py-4 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-xl shadow-gray-200 transition flex items-center justify-center gap-2"
                            >
                                <span>{loadingMessage ? 'Continue...' : (isComplete ? 'Finish Session' : 'Continue')}</span>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MockStudySession;
