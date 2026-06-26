/**
 * @file CaseGeneratorModal.tsx
 * @description A polished modal for AI-powered case generation with domain selection,
 * difficulty settings, and enhanced loading animations. Tailored to the 2026 NOTCE blueprint.
 */

import React, { useState, useEffect } from 'react';
import { Button, Badge, Spinner } from './ui';

/**
 * Props for {@link CaseGeneratorModal}.
 * @property isOpen     Controls visibility; renders nothing when false.
 * @property onClose    Dismisses the modal (disabled while generation is in flight).
 * @property onGenerate Async callback that performs the actual case generation given the
 *                      chosen domain id and difficulty id; its promise gates the loading UI.
 */
interface CaseGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (domain: string, difficulty: string) => Promise<void>;
}

/** Domain options aligned with 2026 NOTCE Blueprint */
const DOMAINS = [
  { id: 'OT_EXP', label: 'OT Expertise', icon: '🧠', description: 'Clinical evaluation & intervention', color: 'blue' },
  { id: 'CEJ_JUSTICE', label: 'Culture, Equity & Justice', icon: '⚖️', description: 'Diversity, inclusion, advocacy', color: 'purple' },
  { id: 'COMM_COLLAB', label: 'Communication & Collab', icon: '🤝', description: 'Interprofessional teamwork', color: 'green' },
  { id: 'PROF_RESP', label: 'Professional Responsibility', icon: '📋', description: 'Ethics, documentation, laws', color: 'red' },
  { id: 'EXCELLENCE', label: 'Excellence in Practice', icon: '⭐', description: 'Evidence-based best practices', color: 'amber' },
  { id: 'ENGAGEMENT', label: 'Engagement in OT', icon: '💼', description: 'Leadership & advancement', color: 'teal' },
];

const DIFFICULTIES = [
  { id: 'Easy', label: 'Foundation', description: 'Core concepts', icon: '🌱' },
  { id: 'Medium', label: 'Clinical', description: 'Applied scenarios', icon: '🏥' },
  { id: 'Hard', label: 'Expert', description: 'Complex cases', icon: '🎯' },
];

/** Loading messages that rotate during generation */
const LOADING_MESSAGES = [
  { text: 'Analyzing clinical scenarios...', icon: '🔬' },
  { text: 'Consulting evidence-based resources...', icon: '📚' },
  { text: 'Crafting realistic patient details...', icon: '👤' },
  { text: 'Generating assessment questions...', icon: '✏️' },
  { text: 'Aligning with NOTCE standards...', icon: '📋' },
  { text: 'Preparing your case study...', icon: '✨' },
];

/**
 * CaseGeneratorModal walks the user through a two-step wizard (pick domain, pick
 * difficulty) and then drives an animated loading state while {@link CaseGeneratorModalProps.onGenerate}
 * runs. All selection/loading state is local; the parent only learns the chosen values
 * when generation is triggered.
 *
 * @param props See {@link CaseGeneratorModalProps}.
 */
const CaseGeneratorModal: React.FC<CaseGeneratorModalProps> = ({ isOpen, onClose, onGenerate }) => {
  // Chosen domain id (null until the user picks one; gates the Continue button).
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  // Chosen difficulty id; defaults to the middle "Medium" tier.
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('Medium');
  // True while onGenerate is pending; swaps the UI to the loading view and locks dismissal.
  const [isGenerating, setIsGenerating] = useState(false);
  // Wizard step: 1 = domain selection, 2 = difficulty selection.
  const [step, setStep] = useState<1 | 2>(1);
  // Index into LOADING_MESSAGES for the rotating status text.
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  // Simulated progress percentage shown during generation (not tied to real progress).
  const [loadingProgress, setLoadingProgress] = useState(0);

  // While generating, cycle the status message and creep the progress bar forward on
  // separate intervals; both are cleared on cleanup to avoid leaks/overlap.
  useEffect(() => {
    if (!isGenerating) return;
    
    const messageInterval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);

    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => Math.min(prev + Math.random() * 15, 95));
    }, 500);

    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
    };
  }, [isGenerating]);

  // Reset loading state when modal closes
  // Restore the wizard to its initial state on close so the next open starts fresh.
  useEffect(() => {
    if (!isOpen) {
      setLoadingMessageIndex(0);
      setLoadingProgress(0);
      setStep(1);
      setSelectedDomain(null);
      setSelectedDifficulty('Medium');
    }
  }, [isOpen]);

  // Hooks above must run unconditionally, so this early-out lives after them.
  if (!isOpen) return null;

  /**
   * Runs the generation flow: enters the loading state, awaits the parent's onGenerate,
   * snaps the bar to 100% and auto-closes on success. The finally block always clears the
   * generating flag so a failure returns the user to the wizard.
   */
  const handleGenerate = async () => {
    if (!selectedDomain) return;
    setIsGenerating(true);
    setLoadingProgress(0);
    try {
      await onGenerate(selectedDomain, selectedDifficulty);
      setLoadingProgress(100);
      // Brief pause lets the user see the completed bar before the modal dismisses.
      setTimeout(() => onClose(), 500);
    } catch (err) {
      console.error('Generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  /** Builds the Tailwind classes for a domain card, branching on its selected state. */
  const getColorClasses = (color: string, isSelected: boolean) => {
    return isSelected
      ? 'bg-brand-50 border-brand-400 text-brand-700 ring-1 ring-brand-200 shadow-soft -translate-y-0.5'
      : 'bg-white border-slate-200 text-ink hover:border-brand-200 hover:bg-slate-50';
  };

  const currentLoadingMessage = LOADING_MESSAGES[loadingMessageIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={!isGenerating ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-4xl shadow-soft-lg ring-1 ring-slate-900/5 max-w-3xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700 p-8 text-white">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          {!isGenerating && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white/90 hover:text-white flex items-center justify-center transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          
          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              {isGenerating ? (
                <div className="relative">
                  <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping" />
                </div>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {isGenerating ? 'Creating Your Case...' : 'AI-Powered Case Generator'}
              </h2>
              <p className="text-white/80 mt-1">
                {isGenerating 
                  ? 'Please wait while our AI crafts your personalized scenario'
                  : 'Create unlimited scenarios aligned with the 2026 NOTCE Blueprint'}
              </p>
            </div>
          </div>
          
          {/* Progress Steps / Loading Bar */}
          {isGenerating ? (
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="flex items-center gap-2">
                  <span className="text-2xl animate-bounce">{currentLoadingMessage.icon}</span>
                  <span className="animate-pulse">{currentLoadingMessage.text}</span>
                </span>
                <span className="font-bold">{Math.round(loadingProgress)}%</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-300 via-brand-200 to-white rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="relative flex items-center gap-4 mt-6">
              <div className={`flex items-center gap-2 ${step >= 1 ? 'text-white' : 'text-white/50'}`}>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 ${step >= 1 ? 'bg-white text-brand-700' : 'bg-white/20'}`}>1</span>
                <span className="text-sm font-medium">Select Domain</span>
              </div>
              <div className="flex-1 h-0.5 bg-white/30 rounded">
                <div className={`h-full bg-white rounded transition-all duration-300 ${step >= 2 ? 'w-full' : 'w-0'}`} />
              </div>
              <div className={`flex items-center gap-2 ${step >= 2 ? 'text-white' : 'text-white/50'}`}>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 ${step >= 2 ? 'bg-white text-brand-700' : 'bg-white/20'}`}>2</span>
                <span className="text-sm font-medium">Set Difficulty</span>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[50vh]">
          {isGenerating ? (
            /* Loading State - Skeleton Preview */
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-700 ring-1 ring-brand-100 rounded-full text-sm font-semibold">
                  <span>{DOMAINS.find(d => d.id === selectedDomain)?.icon}</span>
                  <span>{DOMAINS.find(d => d.id === selectedDomain)?.label}</span>
                  <span className="mx-2 text-brand-300">•</span>
                  <span>{selectedDifficulty} Difficulty</span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-3xl p-6 ring-1 ring-slate-200/70 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-2xl" />
                  <div className="flex-1">
                    <div className="h-5 bg-slate-200 rounded-full w-3/4 mb-2" />
                    <div className="h-3 bg-slate-200 rounded-full w-1/2" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-4 bg-slate-200 rounded-full w-full" />
                  <div className="h-4 bg-slate-200 rounded-full w-5/6" />
                  <div className="h-4 bg-slate-200 rounded-full w-4/6" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-slate-50 rounded-2xl p-4 ring-1 ring-slate-200/70 animate-pulse">
                    <div className="h-4 bg-slate-200 rounded-full w-3/4 mb-2" />
                    <div className="h-3 bg-slate-200 rounded-full w-1/2" />
                  </div>
                ))}
              </div>

              <div className="flex justify-center">
                <div className="flex items-center gap-3 text-slate-500">
                  <Spinner size={20} />
                  <span className="text-sm font-medium">Building your personalized case...</span>
                </div>
              </div>
            </div>
          ) : step === 1 ? (
            <div className="space-y-4 animate-fade-in">
              <p className="text-slate-500 text-center mb-6">Choose a primary domain focus for your case study:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DOMAINS.map((domain) => (
                  <button
                    key={domain.id}
                    onClick={() => setSelectedDomain(domain.id)}
                    className={`p-5 rounded-2xl border text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[.98] ${getColorClasses(domain.color, selectedDomain === domain.id)}`}
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-3xl">{domain.icon}</span>
                      <div>
                        <h4 className="font-bold text-base">{domain.label}</h4>
                        <p className="text-sm opacity-75 mt-1">{domain.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              <p className="text-slate-500 text-center mb-6">Select the complexity level:</p>
              <div className="flex gap-4 justify-center">
                {DIFFICULTIES.map((diff) => (
                  <button
                    key={diff.id}
                    onClick={() => setSelectedDifficulty(diff.id)}
                    className={`flex-1 max-w-[180px] p-6 rounded-2xl border text-center transition-all duration-200 hover:-translate-y-0.5 active:scale-[.98] ${
                      selectedDifficulty === diff.id
                        ? 'bg-brand-50 border-brand-400 text-brand-700 ring-1 ring-brand-200 shadow-soft'
                        : 'bg-white border-slate-200 text-ink hover:border-brand-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-4xl block mb-3">{diff.icon}</span>
                    <h4 className="font-bold text-lg">{diff.label}</h4>
                    <p className="text-sm opacity-75 mt-1">{diff.description}</p>
                  </button>
                ))}
              </div>

              {/* Selected Summary */}
              <div className="mt-8 p-4 bg-brand-50 rounded-2xl ring-1 ring-brand-100">
                <p className="text-sm text-brand-800">
                  <span className="font-bold">Your Configuration:</span> {DOMAINS.find(d => d.id === selectedDomain)?.label} • {selectedDifficulty} Difficulty
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isGenerating && (
          <div className="p-6 bg-slate-50/60 border-t border-slate-100 flex justify-between items-center">
            {step === 2 && (
              <Button variant="ghost" onClick={() => setStep(1)} leftIcon={<span aria-hidden>←</span>}>
                Back
              </Button>
            )}
            {step === 1 && <div />}

            {step === 1 ? (
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedDomain}
                rightIcon={<span aria-hidden>→</span>}
              >
                Continue
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                size="lg"
                leftIcon={(
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
              >
                Generate Case
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CaseGeneratorModal;

