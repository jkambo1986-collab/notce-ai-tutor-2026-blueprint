/**
 * @file EncounterModal.tsx
 * @description OSCE-style simulated client encounter. The AI role-plays a client
 * with a hidden profile (/api/encounter/start); the candidate interviews them
 * (/message) and ends to get scored on the relational + information-gathering
 * competencies (/finish). Full-screen chat modal.
 */

import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { EncounterPersona, EncounterResult } from '../types';
import { useToast } from './ui/Feedback';

interface Props { isOpen: boolean; onClose: () => void; }
interface Turn { role: 'ot' | 'client'; text: string; }

const barColor = (s: number) => (s >= 70 ? 'bg-emerald-500' : s >= 50 ? 'bg-amber-500' : 'bg-red-500');
const RUBRIC_LABELS: Record<string, string> = {
  rapport: 'Rapport', information_gathering: 'Information gathering', client_centred: 'Client-centred',
  cultural_safety: 'Cultural safety', safety_screening: 'Safety screening',
};

const EncounterModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const toast = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [persona, setPersona] = useState<EncounterPersona | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<EncounterResult | null>(null);
  const [error, setError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setSessionId(null); setPersona(null); setTurns([]); setInput(''); setResult(null); setError(false); setStarting(true);
    api.encounter.start()
      .then(d => { if (active) { setSessionId(d.session_id); setPersona(d.persona); setTurns([{ role: 'client', text: d.opening_line }]); } })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setStarting(false); });
    return () => { active = false; };
  }, [isOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, sending]);

  if (!isOpen) return null;

  const send = async () => {
    const msg = input.trim();
    if (!msg || !sessionId || sending) return;
    setInput('');
    setTurns(prev => [...prev, { role: 'ot', text: msg }]);
    setSending(true);
    try {
      const d = await api.encounter.message(sessionId, msg);
      setTurns(prev => [...prev, { role: 'client', text: d.reply }]);
    } catch (err: any) {
      // Roll back the optimistic OT turn (the server didn't record it) and
      // restore the text so the user can retry cleanly.
      setTurns(prev => prev.slice(0, -1));
      setInput(msg);
      toast(err?.message || 'The client didn\'t respond. Try again.', 'error');
    } finally {
      setSending(false);
    }
  };

  const finish = async () => {
    if (!sessionId || scoring) return;
    setScoring(true);
    try {
      const d = await api.encounter.finish(sessionId);
      setResult(d.result);
    } catch {
      toast('Couldn\'t score the encounter. Please try again.', 'error');
    } finally {
      setScoring(false);
    }
  };

  const otTurns = turns.filter(t => t.role === 'ot').length;

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-4 text-white flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold leading-none">Client Encounter</h2>
          {persona && <p className="text-white/80 text-xs mt-1">{persona.name}, {persona.age} ({persona.pronouns}) · {persona.setting}</p>}
        </div>
        <div className="flex items-center gap-2">
          {!result && turns.length > 0 && (
            <button onClick={finish} disabled={scoring || otTurns < 2} title={otTurns < 2 ? 'Ask a few questions first' : 'End & get feedback'}
              className="px-3 py-1.5 bg-white text-teal-700 rounded-lg text-sm font-bold hover:bg-teal-50 transition disabled:opacity-50">
              {scoring ? 'Scoring…' : 'End & Score'}
            </button>
          )}
          <button onClick={onClose} className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-bold transition">Exit</button>
        </div>
      </div>

      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <h3 className="text-xl font-bold text-gray-800 mb-2">Couldn't start the encounter</h3>
          <p className="text-gray-500 mb-6">The simulator is unavailable right now. Please try again.</p>
          <button onClick={onClose} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold">Close</button>
        </div>
      ) : result ? (
        // --- Score screen ---
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-xl mx-auto space-y-5">
            <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Encounter score</p>
              <p className="text-6xl font-black text-gray-900">{result.overall_score}</p>
              <p className="text-gray-500 mt-1">{result.verdict}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-6 space-y-2">
              {(Object.entries(result.rubric || {}) as [string, number][]).map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between text-xs mb-0.5"><span className="text-gray-600 font-medium">{RUBRIC_LABELS[k] || k}</span><span className="text-gray-400">{v}</span></div>
                  <div className="h-1.5 bg-gray-100 rounded-full"><div className={`h-1.5 rounded-full ${barColor(v)}`} style={{ width: `${v}%` }} /></div>
                </div>
              ))}
            </div>
            {result.did_well?.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4"><h4 className="text-sm font-bold text-emerald-800 mb-1">Did well</h4><ul className="list-disc list-inside text-sm text-emerald-700 space-y-0.5">{result.did_well.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            )}
            {result.missed?.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4"><h4 className="text-sm font-bold text-amber-800 mb-1">Missed</h4><ul className="list-disc list-inside text-sm text-amber-700 space-y-0.5">{result.missed.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            )}
            {result.coaching && <div className="bg-teal-50 border border-teal-100 rounded-xl p-4"><h4 className="text-sm font-bold text-teal-800 mb-1">Coaching</h4><p className="text-sm text-teal-700">{result.coaching}</p></div>}
            <button onClick={onClose} className="w-full py-4 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition">Done</button>
          </div>
        </div>
      ) : (
        // --- Chat ---
        <>
          {persona && (
            <div className="bg-amber-50 border-b border-amber-100 px-6 py-2 text-center text-sm text-amber-800">
              <b>Presenting:</b> {persona.presenting}
            </div>
          )}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-3">
              {starting && <div className="flex justify-center py-10"><div className="h-10 w-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}
              {turns.map((t, i) => (
                <div key={i} className={`flex ${t.role === 'ot' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${t.role === 'ot' ? 'bg-teal-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'}`}>
                    {t.text}
                  </div>
                </div>
              ))}
              {sending && <div className="flex justify-start"><div className="bg-white border border-gray-100 text-gray-400 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm shadow-sm">…</div></div>}
            </div>
          </div>
          <div className="border-t border-gray-100 bg-white p-4">
            <div className="max-w-2xl mx-auto flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask the client a question…"
                disabled={starting || sending}
                className="flex-1 border-2 border-gray-200 focus:border-teal-500 rounded-xl px-4 py-3 text-gray-800 outline-none transition"
              />
              <button onClick={send} disabled={!input.trim() || sending || starting} className="px-6 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition disabled:opacity-50">Send</button>
            </div>
            <p className="max-w-2xl mx-auto text-[11px] text-gray-400 mt-2 text-center">Interview the client, then tap "End &amp; Score" for competency feedback.</p>
          </div>
        </>
      )}
    </div>
  );
};

export default EncounterModal;
