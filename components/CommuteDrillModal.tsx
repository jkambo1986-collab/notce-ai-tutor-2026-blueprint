/**
 * @file CommuteDrillModal.tsx
 * @description Eyes-Free "Commute Drills" (#1). A closed-loop, low-touch voice
 * drill: the question + options are read aloud, the candidate answers by SPEAKING
 * the letter (or the answer), and the app confirms right/wrong and reads the
 * rationale — then advances. Big tap targets provide a visual fallback, so it
 * works hands-free on a commute or fully tappable at a desk. Sourced from the
 * vetted bank via /drill/next/.
 */

import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { DrillQuestion } from '../types';
import { useVoice } from './VoiceContext';
import { useDictation } from './ui/Speech';
import { useToast } from './ui/Feedback';

const ORDINALS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };

/** Map a spoken phrase to an option label, e.g. "b", "option b", "the second one". */
function matchLabel(transcript: string, options: { label: string; text: string }[]): string | null {
  const t = transcript.toLowerCase().trim();
  // Direct letter ("b", "option b", "answer b", "bee")
  for (const o of options) {
    const L = o.label.toLowerCase();
    if (t === L || new RegExp(`\\b(option|answer|letter)?\\s*${L}\\b`).test(t)) return o.label;
  }
  if (/\bbee\b/.test(t)) return options.find(o => o.label.toLowerCase() === 'b')?.label || null;
  // Ordinal ("the second one")
  for (const [word, n] of Object.entries(ORDINALS)) {
    if (t.includes(word) && options[n - 1]) return options[n - 1].label;
  }
  // Fuzzy: longest option whose first few words appear in the transcript
  const byLen = [...options].sort((a, b) => b.text.length - a.text.length);
  for (const o of byLen) {
    const key = o.text.toLowerCase().split(/[,.;:]/)[0].slice(0, 24);
    if (key.length >= 6 && t.includes(key)) return o.label;
  }
  return null;
}

const CommuteDrillModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const toast = useToast();
  const { speak, cancel, supported: ttsSupported } = useVoice();
  const [q, setQ] = useState<DrillQuestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const servedRef = useRef<string[]>([]);

  const speakText = (text: string, id: string) => { if (ttsSupported) speak(text, { id, force: true }); };

  const readQuestion = (question: DrillQuestion) => {
    const opts = question.options.map(o => `Option ${o.label}. ${o.text}.`).join(' ');
    speakText(`${question.stem} ${opts}`, 'drill-q');
  };

  const loadNext = async () => {
    setLoading(true); setRevealed(false); setPicked(null); cancel();
    try {
      const next = await api.drillNext({ exclude: servedRef.current });
      servedRef.current = [...servedRef.current, next.bank_id].slice(-60);
      setQ(next);
      readQuestion(next);
    } catch (e: any) {
      toast(e?.message || 'No more questions right now.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    servedRef.current = [];
    setScore({ correct: 0, total: 0 });
    loadNext();
    return () => cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const answer = (label: string) => {
    if (!q || revealed) return;
    const correct = label.toUpperCase() === q.correct_label.toUpperCase();
    setPicked(label);
    setRevealed(true);
    setScore(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
    const verdict = correct ? 'Correct!' : `Not quite. The answer is ${q.correct_label}, ${q.correct_text}.`;
    speakText(`${verdict} ${q.rationale}`, 'drill-feedback');
  };

  const { listening, start: startListen, stop: stopListen, supported: sttSupported } = useDictation({
    lang: 'en-CA',
    onResult: (text) => {
      if (!q || revealed) return;
      const label = matchLabel(text, q.options);
      if (label) answer(label);
      else toast(`Heard "${text}" — say the letter (A–D) or tap an option.`, 'info');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/10">
        <div>
          <h2 className="text-lg font-extrabold">Eyes-Free Drill</h2>
          <p className="text-white/50 text-xs">Listen, then say the letter — or tap.</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-mono text-white/70">{score.correct}/{score.total}</span>
          <button onClick={() => { cancel(); onClose(); }} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold">Exit</button>
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto">
          {loading || !q ? (
            <div className="flex justify-center py-20"><div className="h-10 w-10 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <>
              <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-teal-300 mb-3">{q.domain}</span>
              <p className="text-lg md:text-xl leading-relaxed mb-6">{q.stem}</p>
              <div className="space-y-2.5">
                {q.options.map(o => {
                  const isCorrect = revealed && o.label.toUpperCase() === q.correct_label.toUpperCase();
                  const isWrongPick = revealed && picked === o.label && !isCorrect;
                  return (
                    <button
                      key={o.label}
                      onClick={() => answer(o.label)}
                      disabled={revealed}
                      className={`w-full text-left p-4 rounded-2xl border-2 flex items-center gap-3 transition ${
                        isCorrect ? 'border-emerald-400 bg-emerald-500/15' :
                        isWrongPick ? 'border-red-400 bg-red-500/15' :
                        'border-white/10 bg-white/5 hover:border-teal-400/50'}`}
                    >
                      <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${isCorrect ? 'bg-emerald-400 text-slate-900' : isWrongPick ? 'bg-red-400 text-slate-900' : 'bg-white/10'}`}>{o.label}</span>
                      <span className="text-base">{o.text}</span>
                    </button>
                  );
                })}
              </div>

              {revealed && (
                <div className="mt-5 bg-white/5 border border-white/10 rounded-2xl p-4">
                  <p className="text-sm font-bold text-teal-300 mb-1">Why {q.correct_label} is correct</p>
                  <p className="text-sm text-white/80 leading-relaxed">{q.rationale}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="border-t border-white/10 p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {ttsSupported && q && !revealed && (
            <button onClick={() => readQuestion(q)} className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-sm">🔊 Repeat</button>
          )}
          {!revealed ? (
            sttSupported ? (
              <button
                onClick={() => (listening ? stopListen() : startListen())}
                disabled={!q}
                className={`flex-1 py-4 rounded-xl font-bold text-base transition ${listening ? 'bg-red-500 animate-pulse' : 'bg-teal-500 hover:bg-teal-400 text-slate-900'}`}
              >
                {listening ? '● Listening… (say A–D)' : '🎤 Speak your answer'}
              </button>
            ) : (
              <div className="flex-1 text-center text-white/50 text-sm py-4">Tap an option above to answer.</div>
            )
          ) : (
            <button onClick={loadNext} className="flex-1 py-4 rounded-xl font-bold text-base bg-teal-500 hover:bg-teal-400 text-slate-900">Next question →</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommuteDrillModal;
