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
import { Button } from './ui';

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
    // Persist the dismissal server-side so the wizard doesn't reappear on other
    // devices (best-effort; the modal closes regardless).
    api.setOnboardingCompleted(true);
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateProfile({
        target_exam_date: examDate || null,
        goal_domains: Array.from(goals),
      });
      await api.setOnboardingCompleted(true);
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
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm animate-in fade-in duration-200" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-4xl bg-white shadow-soft-lg ring-1 ring-slate-900/5 animate-in zoom-in-95 fade-in duration-300">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700 p-7 text-white">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80 mb-1">Welcome aboard</p>
          <h2 className="text-2xl font-extrabold">Let's personalize your prep</h2>
          <div className="mt-4 flex gap-2">
            <span className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-white' : 'bg-white/30'}`} />
            <span className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-white' : 'bg-white/30'}`} />
          </div>
        </div>

        <div className="p-7">
          {step === 1 ? (
            <div className="animate-fade-in">
              <h3 className="text-lg font-bold text-ink mb-1">When's your exam?</h3>
              <p className="text-sm text-slate-500 mb-5">We'll show a live countdown and pace your study plan.</p>
              <input
                type="date"
                value={examDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setExamDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-ink shadow-inner-soft outline-none transition-all duration-200 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15"
              />
              <p className="text-xs text-slate-400 mt-2">You can change this anytime. Leave blank to skip.</p>
            </div>
          ) : (
            <div className="animate-fade-in">
              <h3 className="text-lg font-bold text-ink mb-1">Where do you want to focus?</h3>
              <p className="text-sm text-slate-500 mb-5">Pick the domains you most want to strengthen (optional).</p>
              <div className="grid grid-cols-2 gap-3">
                {DOMAINS.map(d => {
                  const on = goals.has(d.id);
                  return (
                    <button
                      key={d.id}
                      onClick={() => toggleGoal(d.id)}
                      className={`text-left p-3.5 rounded-2xl border text-sm font-semibold transition-all duration-200 active:scale-[.98] ${on ? 'border-brand-400 bg-brand-50 text-brand-700 shadow-soft ring-1 ring-brand-200' : 'border-slate-200 text-slate-600 hover:border-brand-200 hover:bg-slate-50'}`}
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
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 p-6">
          <Button variant="ghost" size="sm" onClick={dismiss}>Skip for now</Button>
          <div className="flex gap-3">
            {step === 2 && (
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            )}
            {step === 1 ? (
              <Button onClick={() => setStep(2)}>Continue</Button>
            ) : (
              <Button onClick={handleSave} loading={saving}>
                {saving ? 'Saving…' : 'Finish'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
