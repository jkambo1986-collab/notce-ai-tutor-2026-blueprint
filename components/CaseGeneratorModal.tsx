/**
 * @file CaseGeneratorModal.tsx
 * @description A polished modal for AI-powered case generation with domain selection,
 * difficulty settings, and loading animations. Tailored to the 2026 NOTCE blueprint.
 */

import React, { useState } from 'react';

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

const CaseGeneratorModal: React.FC<CaseGeneratorModalProps> = ({ isOpen, onClose, onGenerate }) => {
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('Medium');
  const [isGenerating, setIsGenerating] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!selectedDomain) return;
    setIsGenerating(true);
    try {
      await onGenerate(selectedDomain, selectedDifficulty);
      onClose();
    } catch (err) {
      console.error('Generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const getColorClasses = (color: string, isSelected: boolean) => {
    const colors: Record<string, { bg: string; border: string; text: string }> = {
      blue: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700' },
      purple: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-700' },
      green: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-700' },
      red: { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-700' },
      amber: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-700' },
      teal: { bg: 'bg-teal-50', border: 'border-teal-400', text: 'text-teal-700' },
    };
    const c = colors[color] || colors.blue;
    return isSelected ? `${c.bg} ${c.border} ${c.text} ring-2 ring-offset-2 ring-${color}-400` : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-8 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold">AI-Powered Case Generator</h2>
              <p className="text-white/80 mt-1">Create unlimited scenarios aligned with the 2026 NOTCE Blueprint</p>
            </div>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center gap-4 mt-6">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-white' : 'text-white/50'}`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-white text-indigo-600' : 'bg-white/20'}`}>1</span>
              <span className="text-sm font-medium">Select Domain</span>
            </div>
            <div className="flex-1 h-0.5 bg-white/30 rounded">
              <div className={`h-full bg-white rounded transition-all ${step >= 2 ? 'w-full' : 'w-0'}`} />
            </div>
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-white' : 'text-white/50'}`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-white text-indigo-600' : 'bg-white/20'}`}>2</span>
              <span className="text-sm font-medium">Set Difficulty</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[50vh]">
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-gray-600 text-center mb-6">Choose a primary domain focus for your case study:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DOMAINS.map((domain) => (
                  <button
                    key={domain.id}
                    onClick={() => setSelectedDomain(domain.id)}
                    className={`p-5 rounded-2xl border-2 text-left transition-all transform hover:scale-[1.02] ${getColorClasses(domain.color, selectedDomain === domain.id)}`}
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
          )}

          {step === 2 && (
            <div className="space-y-6">
              <p className="text-gray-600 text-center mb-6">Select the complexity level:</p>
              <div className="flex gap-4 justify-center">
                {DIFFICULTIES.map((diff) => (
                  <button
                    key={diff.id}
                    onClick={() => setSelectedDifficulty(diff.id)}
                    className={`flex-1 max-w-[180px] p-6 rounded-2xl border-2 text-center transition-all transform hover:scale-[1.02] ${
                      selectedDifficulty === diff.id 
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-700 ring-2 ring-offset-2 ring-indigo-400' 
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-4xl block mb-3">{diff.icon}</span>
                    <h4 className="font-bold text-lg">{diff.label}</h4>
                    <p className="text-sm opacity-75 mt-1">{diff.description}</p>
                  </button>
                ))}
              </div>
              
              {/* Selected Summary */}
              <div className="mt-8 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                <p className="text-sm text-indigo-800">
                  <span className="font-bold">Your Configuration:</span> {DOMAINS.find(d => d.id === selectedDomain)?.label} • {selectedDifficulty} Difficulty
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 text-gray-600 font-medium hover:text-gray-900 transition"
            >
              ← Back
            </button>
          )}
          {step === 1 && <div />}
          
          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              disabled={!selectedDomain}
              className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-70 transition-all flex items-center gap-3"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Generating Case...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Generate Case</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseGeneratorModal;
