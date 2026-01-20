/**
 * @file MockStudySetupModal.tsx
 * @description Modal for configuring a new Mock Study session.
 * Allows users to select Domain, Difficulty, and Number of Questions.
 */

import React, { useState } from 'react';

interface MockStudySetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: (domain: string, difficulty: string, length: number) => void;
}

/** Domain options aligned with 2026 NOTCE Blueprint */
const DOMAINS = [
  { id: 'OT_EXP', label: 'OT Expertise', icon: '🧠', description: 'Clinical evaluation & intervention', color: 'blue' },
  { id: 'CEJ_JUSTICE', label: 'Equity & Justice', icon: '⚖️', description: 'Cultural safety & advocacy', color: 'purple' },
  { id: 'COMM_COLLAB', label: 'Comm. & Collab', icon: '🤝', description: 'Interprofessional practice', color: 'green' },
  { id: 'PROF_RESP', label: 'Prof. Responsibility', icon: '📋', description: 'Ethics & documentation', color: 'indigo' },
  { id: 'EXCELLENCE', label: 'Excellence', icon: '✨', description: 'Evidence-based practice', color: 'amber' },
  { id: 'ENGAGEMENT', label: 'Engagement', icon: '🚀', description: 'Leadership & learning', color: 'pink' },
];

const DIFFICULTIES = [
  { id: 'Easy', label: 'Foundation', description: 'Core knowledge recall', icon: '🌱' },
  { id: 'Medium', label: 'Clinical', description: 'Applied reasoning', icon: '🏥' },
  { id: 'Hard', label: 'Expert', description: 'Complex scenarios', icon: '🎯' },
];

const LENGTHS = [10, 25, 50];

const MockStudySetupModal: React.FC<MockStudySetupModalProps> = ({ isOpen, onClose, onStart }) => {
    const [selectedDomain, setSelectedDomain] = useState<string>('OT_EXP');
    const [selectedDifficulty, setSelectedDifficulty] = useState<string>('Medium');
    const [selectedLength, setSelectedLength] = useState<number>(10);
    const [isStarting, setIsStarting] = useState(false);

    if (!isOpen) return null;

    const handleStart = async () => {
        setIsStarting(true);
        // Add small artificial delay for UX feel
        await new Promise(resolve => setTimeout(resolve, 600)); 
        onStart(selectedDomain, selectedDifficulty, selectedLength);
        setIsStarting(false);
        onClose();
    };

    const getColorClasses = (color: string, isSelected: boolean) => {
        const base = `cursor-pointer rounded-xl p-4 border-2 transition-all duration-200 flex flex-col gap-2 relative overflow-hidden`;
        if (isSelected) {
            return `${base} border-${color}-500 bg-${color}-50 shadow-md transform scale-[1.02]`;
        }
        return `${base} border-slate-100 hover:border-${color}-200 hover:bg-slate-50 opacity-70 hover:opacity-100`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
                className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-8 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
                    <div>
                        <h2 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
                            <span className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-lg shadow-teal-200">
                                📚
                            </span>
                            Start Mock Study Session
                        </h2>
                        <p className="text-gray-500 mt-2 text-lg">Focus your practice with tailored drill sessions.</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-8 space-y-10">
                    {/* DOMAIN SELECTION */}
                    <section>
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">1</span>
                            Select Domain
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {DOMAINS.map((domain) => (
                                <div 
                                    key={domain.id}
                                    onClick={() => setSelectedDomain(domain.id)}
                                    className={getColorClasses(domain.color, selectedDomain === domain.id)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="text-3xl">{domain.icon}</div>
                                        {selectedDomain === domain.id && (
                                            <div className={`w-5 h-5 bg-${domain.color}-500 rounded-full flex items-center justify-center`}>
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-900">{domain.label}</div>
                                        <div className="text-xs text-gray-500 mt-1">{domain.description}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="flex flex-col md:flex-row gap-8">
                        {/* DIFFICULTY SELECTION */}
                        <section className="flex-1">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">2</span>
                                Select Difficulty
                            </h3>
                            <div className="space-y-3">
                                {DIFFICULTIES.map((diff) => (
                                    <div 
                                        key={diff.id}
                                        onClick={() => setSelectedDifficulty(diff.id)}
                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${
                                            selectedDifficulty === diff.id 
                                                ? 'border-indigo-500 bg-indigo-50 shadow-sm' 
                                                : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50 opacity-80'
                                        }`}
                                    >
                                        <div className="text-2xl">{diff.icon}</div>
                                        <div className="flex-1">
                                            <div className="font-bold text-gray-900">{diff.label}</div>
                                            <div className="text-xs text-gray-500">{diff.description}</div>
                                        </div>
                                        {selectedDifficulty === diff.id && (
                                            <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* LENGTH SELECTION */}
                        <section className="flex-1">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">3</span>
                                Question Count
                            </h3>
                            <div className="grid grid-cols-3 gap-4">
                                {LENGTHS.map((len) => (
                                    <div 
                                        key={len}
                                        onClick={() => setSelectedLength(len)}
                                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                                            selectedLength === len 
                                                ? 'border-teal-500 bg-teal-50 shadow-sm transform scale-105' 
                                                : 'border-slate-100 hover:border-teal-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className={`text-2xl font-black ${selectedLength === len ? 'text-teal-600' : 'text-gray-400'}`}>
                                            {len}
                                        </div>
                                        <div className="text-xs text-gray-500 font-medium">Questions</div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-gray-100 bg-gray-50 rounded-b-3xl flex justify-end gap-3 sticky bottom-0">
                    <button 
                        onClick={onClose}
                        className="px-6 py-3 font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleStart}
                        disabled={isStarting}
                        className="px-8 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-bold hover:from-teal-600 hover:to-cyan-700 transition shadow-lg shadow-teal-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 w-48 justify-center"
                    >
                        {isStarting ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Starting...
                            </>
                        ) : (
                            <>
                                Start Session
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MockStudySetupModal;
