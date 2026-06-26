/**
 * @file ConversationPracticeModal.tsx
 * @description Generic scored AI-voice conversation surface, reused by Teach-It-Back
 * (#2) and SBAR Handover (#4). It mirrors the Encounter pattern: the AI counterpart
 * opens, the candidate speaks/types a reply, the counterpart responds aloud, and
 * "End & Score" returns a competency rubric. Configured entirely via `config` so a
 * new spoken scenario type is just a config object — no new component.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useToast } from './ui/Feedback';
import { useVoice } from './VoiceContext';
import { SpeakButton, MicButton } from './ui';
import { ScoredConvoResult } from '../types';

export interface ConvoConfig {
  /** Backend conversation API (start/message/finish). */
  api: {
    start: (domain?: string) => Promise<{ session_id: string; persona: any; opening_line: string }>;
    message: (id: string, msg: string) => Promise<{ reply: string }>;
    finish: (id: string) => Promise<{ result: ScoredConvoResult }>;
  };
  title: string;
  accent: string;                              // header gradient classes
  personaHeader: (p: any) => string;           // header subtitle from persona
  intro?: (p: any) => React.ReactNode;         // optional banner (case brief / concept)
  aiLabel: string;                             // "Student" / "Colleague"
  userLabel: string;                           // "You" / "OT"
  inputPlaceholder: string;
  hint: string;                                // bottom helper line
  minTurns: number;                            // user turns required before scoring
  rubricLabels: Record<string, string>;
  negKey: 'missed' | 'misconceptions';
  negLabel: string;
}

interface Turn { role: 'user' | 'ai'; text: string; }

const barColor = (s: number) => (s >= 70 ? 'bg-emerald-500' : s >= 50 ? 'bg-amber-500' : 'bg-red-500');

const ConversationPracticeModal: React.FC<{ isOpen: boolean; onClose: () => void; config: ConvoConfig }> = ({ isOpen, onClose, config }) => {
  const toast = useToast();
  const { speak, cancel, supported: voiceSupported, settings: voiceSettings } = useVoice();
  const sayAI = (text: string) => { if (voiceSupported && voiceSettings.enabled) speak(text, { id: 'convo-ai' }); };

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [persona, setPersona] = useState<any>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<ScoredConvoResult | null>(null);
  const [error, setError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setSessionId(null); setPersona(null); setTurns([]); setInput(''); setResult(null); setError(false); setStarting(true);
    config.api.start()
      .then(d => { if (active) { setSessionId(d.session_id); setPersona(d.persona); setTurns([{ role: 'ai', text: d.opening_line }]); sayAI(d.opening_line); } })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setStarting(false); });
    return () => { active = false; cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, sending]);

  if (!isOpen) return null;

  const send = async () => {
    const msg = input.trim();
    if (!msg || !sessionId || sending) return;
    setInput('');
    setTurns(prev => [...prev, { role: 'user', text: msg }]);
    setSending(true);
    try {
      const d = await config.api.message(sessionId, msg);
      setTurns(prev => [...prev, { role: 'ai', text: d.reply }]);
      sayAI(d.reply);
    } catch (err: any) {
      setTurns(prev => prev.slice(0, -1));
      setInput(msg);
      toast(err?.message || 'No response. Try again.', 'error');
    } finally {
      setSending(false);
    }
  };

  const finish = async () => {
    if (!sessionId || scoring) return;
    setScoring(true);
    try {
      const d = await config.api.finish(sessionId);
      setResult(d.result);
      cancel();
    } catch {
      toast('Couldn\'t score this. Please try again.', 'error');
    } finally {
      setScoring(false);
    }
  };

  const userTurns = turns.filter(t => t.role === 'user').length;
  const neg = (result && (result[config.negKey] as string[] | undefined)) || [];

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* Header */}
      <div className={`bg-gradient-to-r ${config.accent} px-6 py-4 text-white flex items-center justify-between`}>
        <div>
          <h2 className="text-xl font-bold leading-none">{config.title}</h2>
          {persona && <p className="text-white/80 text-xs mt-1">{config.personaHeader(persona)}</p>}
        </div>
        <div className="flex items-center gap-2">
          {!result && turns.length > 0 && (
            <button onClick={finish} disabled={scoring || userTurns < config.minTurns}
              title={userTurns < config.minTurns ? 'Say a bit more first' : 'End & get feedback'}
              className="px-3 py-1.5 bg-white text-gray-800 rounded-lg text-sm font-bold hover:bg-gray-100 transition disabled:opacity-50">
              {scoring ? 'Scoring…' : 'End & Score'}
            </button>
          )}
          <button onClick={() => { cancel(); onClose(); }} className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-bold transition">Exit</button>
        </div>
      </div>

      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <h3 className="text-xl font-bold text-gray-800 mb-2">Couldn't start</h3>
          <p className="text-gray-500 mb-6">This is unavailable right now. Please try again.</p>
          <button onClick={onClose} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold">Close</button>
        </div>
      ) : result ? (
        // --- Score screen ---
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-xl mx-auto space-y-5">
            <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Score</p>
              <p className="text-6xl font-black text-gray-900">{result.overall_score}</p>
              <p className="text-gray-500 mt-1">{result.verdict}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-6 space-y-2">
              {(Object.entries(result.rubric || {}) as [string, number][]).map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between text-xs mb-0.5"><span className="text-gray-600 font-medium">{config.rubricLabels[k] || k}</span><span className="text-gray-400">{v}</span></div>
                  <div className="h-1.5 bg-gray-100 rounded-full"><div className={`h-1.5 rounded-full ${barColor(v)}`} style={{ width: `${v}%` }} /></div>
                </div>
              ))}
            </div>
            {result.did_well?.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4"><h4 className="text-sm font-bold text-emerald-800 mb-1">Did well</h4><ul className="list-disc list-inside text-sm text-emerald-700 space-y-0.5">{result.did_well.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            )}
            {neg.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4"><h4 className="text-sm font-bold text-amber-800 mb-1">{config.negLabel}</h4><ul className="list-disc list-inside text-sm text-amber-700 space-y-0.5">{neg.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            )}
            {result.coaching && <div className="bg-teal-50 border border-teal-100 rounded-xl p-4"><h4 className="text-sm font-bold text-teal-800 mb-1">Coaching</h4><p className="text-sm text-teal-700">{result.coaching}</p></div>}
            <button onClick={onClose} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition">Done</button>
          </div>
        </div>
      ) : (
        // --- Chat ---
        <>
          {persona && config.intro && (
            <div className="bg-amber-50 border-b border-amber-100 px-6 py-2 text-sm text-amber-900">
              <div className="max-w-2xl mx-auto">{config.intro(persona)}</div>
            </div>
          )}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-3">
              {starting && <div className="flex justify-center py-10"><div className="h-10 w-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}
              {turns.map((t, i) => (
                <div key={i} className={`flex items-end gap-2 ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${t.role === 'user' ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'}`}>
                    {t.text}
                  </div>
                  {t.role === 'ai' && <SpeakButton id={`convo-turn-${i}`} text={t.text} size="sm" label={`Hear the ${config.aiLabel.toLowerCase()}`} />}
                </div>
              ))}
              {sending && <div className="flex justify-start"><div className="bg-white border border-gray-100 text-gray-400 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm shadow-sm">…</div></div>}
            </div>
          </div>
          <div className="border-t border-gray-100 bg-white p-4">
            <div className="max-w-2xl mx-auto flex items-center gap-2">
              <MicButton lang="en-CA" disabled={starting || sending} onTranscript={(t) => setInput(prev => (prev ? prev.trim() + ' ' : '') + t)} />
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={config.inputPlaceholder}
                disabled={starting || sending}
                className="flex-1 border-2 border-gray-200 focus:border-brand-500 rounded-xl px-4 py-3 text-gray-800 outline-none transition"
              />
              <button onClick={send} disabled={!input.trim() || sending || starting} className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition disabled:opacity-50">Send</button>
            </div>
            <p className="max-w-2xl mx-auto text-[11px] text-gray-400 mt-2 text-center">{config.hint}</p>
          </div>
        </>
      )}
    </div>
  );
};

export default ConversationPracticeModal;
