/**
 * @file OnboardingModal.tsx
 * @description First-run wizard shown to a freshly signed-in user who hasn't set
 * a target exam date yet. Captures the exam date (drives the countdown across the
 * app) and goal domains (a soft personalization signal), persisting both via
 * PATCH /auth/me/. Dismissible — a skip is remembered locally so it won't nag.
 */

import React, { useState } from 'react';
import { api } from '../services/api';
import { DomainTag } from '../types';
import { DOMAIN_INFO } from '../constants';
import { useToast } from './ui/Feedback';

/** localStorage flag so a skipped wizard doesn't reappear every load. */
export const ONBOARDING_DISMISSED_KEY = 'onboarding_dismissed';

interface OnboardingModalProps {
  isOpen: boolean;
  /** Skip/close without finishing (records a local dismissal). */
  onClose: () => void;
  /** Called after a successful save so the parent can refresh the profile. */
  onComplete: () => void;
}

const DOMAINS = Object.values(DomainTag).map(tag => ({ id: tag, label: DOMAIN_INFO[tag].label }));

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose, onComplete }) => {
  const toast = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [examDate, setExamDate] = useState('');
  const [goals, setGoals] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const toggleGoal = (id: string) => {
    setGoals(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const dismiss = () => {
    try { localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true'); } catch { /* ignore */ }
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateProfile({
        target_exam_date: examDate || null,
        goal_domains: Array.from(goals),
      });
      try { localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true'); } catch { /* ignore */ }
      toast("You're set up — let's get studying!", 'success');
      onComplete();
    } catch (err) {
      console.error('Onboarding save failed:', err);
      toast('Could not save your setup. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-500 to-cyan-600 p-7 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-white/80 mb-1">Welcome aboard</p>
          <h2 className="text-2xl font-extrabold">Let's personalize your prep</h2>
          <div className="mt-4 flex gap-2">
            <span className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-white' : 'bg-white/30'}`} />
            <span className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-white' : 'bg-white/30'}`} />
          </div>
        </div>

        <div className="p-7">
          {step === 1 ? (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">When's your exam?</h3>
              <p className="text-sm text-gray-500 mb-5">We'll show a live countdown and pace your study plan.</p>
              <input
                type="date"
                value={examDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setExamDate(e.target.value)}
                className="w-full border-2 border-gray-200 focus:border-teal-500 rounded-xl p-4 text-gray-800 outline-none transition"
              />
              <p className="text-xs text-gray-400 mt-2">You can change this anytime. Leave blank to skip.</p>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Where do you want to focus?</h3>
              <p className="text-sm text-gray-500 mb-5">Pick the domains you most want to strengthen (optional).</p>
              <div className="grid grid-cols-2 gap-3">
                {DOMAINS.map(d => {
                  const on = goals.has(d.id);
                  return (
                    <button
                      key={d.id}
                      onClick={() => toggleGoal(d.id)}
                      className={`text-left p-3 rounded-xl border-2 text-sm font-semibold transition ${on ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 text-gray-600 hover:border-teal-200'}`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 bg-gray-50 border-t border-gray-100">
          <button onClick={dismiss} className="text-sm font-bold text-gray-400 hover:text-gray-600 transition">Skip for now</button>
          <div className="flex gap-3">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="px-5 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition">Back</button>
            )}
            {step === 1 ? (
              <button onClick={() => setStep(2)} className="px-6 py-3 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-200 transition">Continue</button>
            ) : (
              <button onClick={handleSave} disabled={saving} className="px-6 py-3 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-200 transition disabled:opacity-60">
                {saving ? 'Saving…' : 'Finish'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
