/**
 * @file MockStudySetupModal.tsx
 * @description Modal for configuring a new Mock Study session.
 * Allows users to select Domain, Difficulty, and Number of Questions.
 */

import React, { useState } from 'react';
import { Button } from './ui';

interface MockStudySetupModalProps {
    /** Controls modal visibility; renders nothing when false. */
    isOpen: boolean;
    /** Dismiss the modal without starting. */
    onClose: () => void;
    /** Begin a session with the chosen domain, difficulty, and question count. */
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

/** Selectable session lengths (number of questions). */
const LENGTHS = [10, 25, 50];

/**
 * MockStudySetupModal Component
 *
 * Configuration dialog shown before a practice session. Lets the user pick a
 * domain, difficulty, and question count, then hands the choices to `onStart`.
 *
 * @param {MockStudySetupModalProps} props - Component props
 * @returns {JSX.Element | null} The modal, or null when closed
 */
const MockStudySetupModal: React.FC<MockStudySetupModalProps> = ({ isOpen, onClose, onStart }) => {
    const [selectedDomain, setSelectedDomain] = useState<string>('OT_EXP');
    const [selectedDifficulty, setSelectedDifficulty] = useState<string>('Medium');
    const [selectedLength, setSelectedLength] = useState<number>(10);
    const [isStarting, setIsStarting] = useState(false);

    if (!isOpen) return null;

    /** Show a brief spinner, then fire onStart with the current selections and close. */
    const handleStart = async () => {
        setIsStarting(true);
        // Add small artificial delay for UX feel
        await new Promise(resolve => setTimeout(resolve, 600));
        onStart(selectedDomain, selectedDifficulty, selectedLength);
        setIsStarting(false);
        onClose();
    };

    /**
     * Build the Tailwind class string for a domain card. The color is interpolated
     * per-domain, so these classes must be present in the safelist/JIT scan to
     * survive purging.
     */
    const getColorClasses = (color: string, isSelected: boolean) => {
        const base = `cursor-pointer rounded-2xl p-4 border transition-all duration-200 flex flex-col gap-2 relative overflow-hidden active:scale-[.98]`;
        if (isSelected) {
            return `${base} border-brand-400 bg-brand-50 shadow-soft ring-1 ring-brand-200 -translate-y-0.5`;
        }
        return `${base} border-slate-200 hover:border-brand-200 hover:bg-slate-50 hover:-translate-y-0.5`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white rounded-4xl shadow-soft-lg ring-1 ring-slate-900/5 w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col animate-in fade-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
                    <div>
                        <h2 className="text-3xl font-extrabold text-ink flex items-center gap-3">
                            <span className="bg-gradient-to-br from-brand-500 to-brand-700 text-white w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-glow-teal">
                                📚
                            </span>
                            Start Mock Study Session
                        </h2>
                        <p className="text-slate-500 mt-2 text-lg">Focus your practice with tailored drill sessions.</p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-8 space-y-10">
                    {/* DOMAIN SELECTION */}
                    <section>
                        <h3 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100 flex items-center justify-center text-xs font-bold">1</span>
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
                                            <div className="w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center">
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-bold text-ink">{domain.label}</div>
                                        <div className="text-xs text-slate-500 mt-1">{domain.description}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="flex flex-col md:flex-row gap-8">
                        {/* DIFFICULTY SELECTION */}
                        <section className="flex-1">
                            <h3 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100 flex items-center justify-center text-xs font-bold">2</span>
                                Select Difficulty
                            </h3>
                            <div className="space-y-3">
                                {DIFFICULTIES.map((diff) => (
                                    <div
                                        key={diff.id}
                                        onClick={() => setSelectedDifficulty(diff.id)}
                                        className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-center gap-4 active:scale-[.98] ${
                                            selectedDifficulty === diff.id
                                                ? 'border-brand-400 bg-brand-50 shadow-soft ring-1 ring-brand-200'
                                                : 'border-slate-200 hover:border-brand-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="text-2xl">{diff.icon}</div>
                                        <div className="flex-1">
                                            <div className="font-bold text-ink">{diff.label}</div>
                                            <div className="text-xs text-slate-500">{diff.description}</div>
                                        </div>
                                        {selectedDifficulty === diff.id && (
                                            <div className="w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center">
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
                            <h3 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100 flex items-center justify-center text-xs font-bold">3</span>
                                Question Count
                            </h3>
                            <div className="grid grid-cols-3 gap-4">
                                {LENGTHS.map((len) => (
                                    <div
                                        key={len}
                                        onClick={() => setSelectedLength(len)}
                                        className={`p-6 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 active:scale-[.98] ${
                                            selectedLength === len
                                                ? 'border-brand-400 bg-brand-50 shadow-soft ring-1 ring-brand-200 -translate-y-0.5'
                                                : 'border-slate-200 hover:border-brand-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className={`text-2xl font-black ${selectedLength === len ? 'text-brand-600' : 'text-slate-400'}`}>
                                            {len}
                                        </div>
                                        <div className="text-xs text-slate-500 font-medium">Questions</div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-slate-100 bg-slate-50/60 rounded-b-4xl flex justify-end gap-3 sticky bottom-0">
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleStart}
                        loading={isStarting}
                        className="w-48"
                        rightIcon={!isStarting ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        ) : undefined}
                    >
                        {isStarting ? 'Starting...' : 'Start Session'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default MockStudySetupModal;
