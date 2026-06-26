/**
 * @file AdaptiveAssessmentModal.tsx
 * @description Computer-adaptive readiness assessment. Serves items at the
 * difficulty most informative for the candidate's estimated ability (no
 * per-item feedback), then reports an estimated readiness score + per-domain
 * ability — mirroring the real exam's scaled measurement. Full-screen modal.
 */

import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { CatQuestion, CatResult } from '../types';
import { DOMAIN_INFO } from '../constants';
import { useToast } from './ui/Feedback';

interface Props { isOpen: boolean; onClose: () => void; }

const domainLabel = (code: string) => (DOMAIN_INFO as Record<string, { label: string }>)[code]?.label || code;
const bandColor = (band: string) => (band === 'Likely pass' ? 'text-emerald-600' : band === 'Borderline' ? 'text-amber-600' : 'text-red-500');

const AdaptiveAssessmentModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const toast = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<CatQuestion | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<CatResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setSessionId(null); setQuestion(null); setSelected(null); setResult(null); setError(false); setBusy(true);
    api.adaptive.start()
      .then(d => { if (active) { setSessionId(d.session_id); setQuestion(d.question); } })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async () => {
    if (!sessionId || !selected || busy) return;
    setBusy(true);
    try {
      const d = await api.adaptive.answer(sessionId, selected);
      if (d.is_complete && d.result) {
        setResult(d.result);
        setQuestion(null);
      } else if (d.question) {
        setQuestion(d.question);
        setSelected(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      toast('Something went wrong. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 text-white flex items-center justify-between sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold leading-none">Adaptive Readiness Test</h2>
          <p className="text-white/70 text-xs mt-1">Difficulty adapts to your ability · no feedback until the end</p>
        </div>
        <button onClick={onClose} className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-bold transition">Exit</button>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        {error ? (
          <div className="text-center py-20">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Couldn't start the assessment</h3>
            <p className="text-gray-500 mb-6">There may not be enough bank questions yet.</p>
            <button onClick={onClose} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold">Close</button>
          </div>
        ) : result ? (
          // --- Result ---
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Estimated readiness</p>
              <p className="text-6xl font-black text-gray-900">{result.readiness}</p>
              <p className={`text-lg font-bold mt-1 ${bandColor(result.band)}`}>{result.band}</p>
              <p className="text-sm text-gray-400 mt-3">{result.correct}/{result.total} correct · ability {result.ability >= 0 ? '+' : ''}{result.ability}</p>
              <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto">An estimate from an adaptive sample — not an official score. Re-take as you improve to watch it climb.</p>
            </div>
            {result.by_domain?.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Ability by domain</h3>
                <div className="space-y-3">
                  {result.by_domain.map(d => (
                    <div key={d.domain}>
                      <div className="flex justify-between text-sm mb-0.5"><span className="text-gray-700 font-medium">{domainLabel(d.domain)}</span><span className="text-gray-400">{d.score}</span></div>
                      <div className="h-2 bg-gray-100 rounded-full"><div className={`h-2 rounded-full ${d.score >= 65 ? 'bg-emerald-500' : d.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${d.score}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={onClose} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition">Done</button>
          </div>
        ) : question ? (
          // --- Question ---
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Question {question.number} of {question.total}</span>
              <div className="h-1.5 w-32 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${(question.number / question.total) * 100}%` }} /></div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <p className="text-lg text-gray-800 leading-relaxed mb-6">{question.stem}</p>
              <div className="space-y-3" role="radiogroup">
                {question.options.map(o => {
                  const on = selected === o.label;
                  return (
                    <button key={o.label} role="radio" aria-checked={on} onClick={() => setSelected(o.label)}
                      className={`w-full text-left p-4 flex items-center gap-4 rounded-xl border-2 transition ${on ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-gray-50/50 hover:border-indigo-200'}`}>
                      <span className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-bold ${on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 text-gray-400'}`}>{o.label}</span>
                      <span className={`text-base ${on ? 'text-indigo-900 font-medium' : 'text-gray-700'}`}>{o.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <button onClick={submit} disabled={!selected || busy} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50">
              {busy ? 'Calibrating…' : (question.number >= question.total ? 'Finish & see readiness' : 'Submit')}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center py-24"><div className="h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
        )}
      </div>
    </div>
  );
};

export default AdaptiveAssessmentModal;
