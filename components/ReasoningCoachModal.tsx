/**
 * @file ReasoningCoachModal.tsx
 * @description Free-text clinical-reasoning practice. Presents a case + prompt
 * (GET /api/reasoning/evaluate/), the candidate writes their reasoning, and the
 * AI grades the *process* against the COTC rubric (POST). Trains the skill MCQs
 * can't — articulating a reasoning chain.
 */

import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ReasoningScenario, ReasoningResult } from '../types';
import { useToast } from './ui/Feedback';

interface Props { isOpen: boolean; onClose: () => void; }

const scoreColor = (s: number) => (s >= 70 ? 'text-emerald-600' : s >= 50 ? 'text-amber-600' : 'text-red-500');
const barColor = (s: number) => (s >= 70 ? 'bg-emerald-500' : s >= 50 ? 'bg-amber-500' : 'bg-red-500');
const RUBRIC_LABELS: Record<string, string> = {
  safety: 'Safety', client_centred: 'Client-centred', clinical_reasoning: 'Reasoning',
  evidence_use: 'Evidence use', prioritization: 'Prioritization',
};

const ReasoningCoachModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const toast = useToast();
  const [scenario, setScenario] = useState<ReasoningScenario | null>(null);
  const [text, setText] = useState('');
  const [result, setResult] = useState<ReasoningResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const loadScenario = () => {
    let active = true;
    setScenario(null); setResult(null); setText(''); setError(false); setLoading(true);
    api.reasoning.scenario()
      .then(s => { if (active) setScenario(s); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  };

  useEffect(() => {
    if (!isOpen) return;
    return loadScenario();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async () => {
    if (!scenario || text.trim().length < 15) {
      toast('Write a few sentences of reasoning first.', 'info');
      return;
    }
    setSubmitting(true);
    try {
      const r = await api.reasoning.evaluate({ vignette: scenario.vignette, prompt: scenario.prompt, response: text.trim() });
      setResult(r);
    } catch (err: any) {
      toast(err?.message || 'Evaluation failed. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 fade-in duration-200 flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold">Reasoning Coach</h2>
            <p className="text-white/80 text-sm">Explain your clinical reasoning — get graded on the thinking, not a letter.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-7 overflow-y-auto">
          {error ? (
            <p className="text-center text-gray-500 py-12">Couldn't load a scenario. Please try again.</p>
          ) : loading || !scenario ? (
            <div className="flex items-center justify-center py-16"><div className="h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : result ? (
            // --- Result view ---
            <div className="space-y-5">
              <div className="text-center">
                <p className={`text-5xl font-black ${scoreColor(result.overall_score)}`}>{result.overall_score}</p>
                <p className="text-gray-500 mt-1">{result.verdict}</p>
              </div>
              <div className="space-y-2">
                {(Object.entries(result.rubric || {}) as [string, number][]).map(([k, v]) => (
                  <div key={k}>
                    <div className="flex justify-between text-xs mb-0.5"><span className="text-gray-600 font-medium">{RUBRIC_LABELS[k] || k}</span><span className="text-gray-400">{v}</span></div>
                    <div className="h-1.5 bg-gray-100 rounded-full"><div className={`h-1.5 rounded-full ${barColor(v)}`} style={{ width: `${v}%` }} /></div>
                  </div>
                ))}
              </div>
              {result.strengths?.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-emerald-800 mb-1">Strengths</h4>
                  <ul className="list-disc list-inside text-sm text-emerald-700 space-y-0.5">{result.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {result.gaps?.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-amber-800 mb-1">Gaps</h4>
                  <ul className="list-disc list-inside text-sm text-amber-700 space-y-0.5">{result.gaps.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {result.coaching && <div className="bg-blue-50 border border-blue-100 rounded-xl p-4"><h4 className="text-sm font-bold text-blue-800 mb-1">Coaching</h4><p className="text-sm text-blue-700">{result.coaching}</p></div>}
              {result.model_answer && <div className="bg-gray-50 border border-gray-100 rounded-xl p-4"><h4 className="text-sm font-bold text-gray-700 mb-1">Expert reasoning</h4><p className="text-sm text-gray-600 leading-relaxed">{result.model_answer}</p></div>}
              <button onClick={loadScenario} className="w-full py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition">Try another case</button>
            </div>
          ) : (
            // --- Answer view ---
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{scenario.title}</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{scenario.vignette}</p>
              </div>
              <p className="font-semibold text-gray-900">{scenario.prompt}</p>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={7}
                placeholder="Walk through your reasoning: what's your first priority and why, what would you assess, how do you keep the client safe and centred, and what's your sequence of next steps…"
                className="w-full border-2 border-gray-200 focus:border-blue-500 rounded-xl p-4 text-gray-800 outline-none transition text-sm leading-relaxed"
              />
              <button
                onClick={submit}
                disabled={submitting}
                className="w-full py-3.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition disabled:opacity-60"
              >
                {submitting ? 'Evaluating your reasoning…' : 'Submit for evaluation'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReasoningCoachModal;
