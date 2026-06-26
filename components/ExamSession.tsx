/**
 * @file ExamSession.tsx
 * @description Full timed NOTCE exam simulation with a free-navigation engine:
 * the entire question set is pre-generated server-side and delivered up front, so
 * the candidate can answer in any order, skip, revisit, change answers, and flag
 * items for review — exactly like the real exam. No per-question feedback; a
 * server-authoritative countdown drives an auto-submit at expiry. On submit the
 * backend grades everything (unanswered = incorrect) and returns per-question
 * results. Answers/flags are synced to the server so a refresh resumes cleanly.
 */

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import HighlightableText from './HighlightableText';
import { Highlight, ExamQuestion } from '../types';
import { useToast, useConfirm } from './ui/Feedback';
import { DOMAIN_INFO } from '../constants';

/** Score (%) at or above which the exam is reported as a pass. */
const PASS_THRESHOLD = 60;
/** Total exam duration in seconds (4 hours). */
const EXAM_DURATION = 4 * 60 * 60;

const domainLabel = (code: string) =>
  (DOMAIN_INFO as Record<string, { label: string }>)[code]?.label || code;

interface ExamSessionProps {
  /** Backend session id used for all exam_* calls. */
  sessionId: string;
  /** The exam start (or exam_state) payload: questions/answers/flags/remaining. */
  initialData: any;
  /** Called to leave the exam (after completion / exit). */
  onExit: () => void;
}

const ExamSession: React.FC<ExamSessionProps> = ({ sessionId, initialData, onExit }) => {
  const toast = useToast();
  const confirm = useConfirm();

  const questions: ExamQuestion[] = initialData.questions || [];
  const total = questions.length;

  const [answers, setAnswers] = useState<Record<string, string>>(initialData.answers || {});
  const [flags, setFlags] = useState<Set<number>>(new Set<number>(initialData.flags || []));
  const [current, setCurrent] = useState(0);
  const [highlights, setHighlights] = useState<Highlight[]>(initialData.highlights || []);
  const [navOpen, setNavOpen] = useState(false); // mobile navigator sheet

  const [finalScore, setFinalScore] = useState<any>(null);
  const [results, setResults] = useState<any[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // --- Server-authoritative countdown (same model as before) ---
  const deadlineKey = `exam_deadline_${sessionId}`;
  const [timeLeft, setTimeLeft] = useState<number>(initialData.remaining_seconds ?? EXAM_DURATION);
  const [timeUp, setTimeUp] = useState(false);
  const firedMilestonesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (finalScore) return;
    let cancelled = false;
    let deadline = Number(localStorage.getItem(deadlineKey)) || (Date.now() + (initialData.remaining_seconds ?? EXAM_DURATION) * 1000);

    const MILESTONES: { at: number; label: string }[] = [
      { at: 3600, label: '1 hour remaining' },
      { at: 1800, label: '30 minutes remaining' },
      { at: 600, label: '10 minutes remaining' },
    ];
    for (const m of MILESTONES) {
      if (Math.max(0, Math.round((deadline - Date.now()) / 1000)) < m.at - 5) firedMilestonesRef.current.add(m.at);
    }

    const syncWithServer = async () => {
      try {
        const t = await api.mockStudy.time(sessionId);
        if (cancelled) return;
        if (t.timed && t.remaining_seconds != null) {
          deadline = Date.now() + t.remaining_seconds * 1000;
          localStorage.setItem(deadlineKey, String(deadline));
          if (t.expired) setTimeUp(true);
        }
      } catch { /* keep cached deadline if offline */ }
    };
    syncWithServer();

    const tick = () => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) setTimeUp(true);
      for (const m of MILESTONES) {
        if (remaining <= m.at && remaining > 0 && !firedMilestonesRef.current.has(m.at)) {
          firedMilestonesRef.current.add(m.at);
          toast(`⏳ ${m.label} — pace yourself.`, 'warning', { duration: 6000 });
        }
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    const sync = setInterval(syncWithServer, 30000);
    return () => { cancelled = true; clearInterval(timer); clearInterval(sync); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineKey, finalScore, sessionId]);

  useEffect(() => {
    if (finalScore) localStorage.removeItem(deadlineKey);
  }, [finalScore, deadlineKey]);

  // Warn before refresh/close mid-exam (server clock keeps running).
  useEffect(() => {
    if (finalScore) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [finalScore]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- Answer / flag / navigation ---
  const answeredCount = Object.keys(answers).length;

  const selectAnswer = (label: string) => {
    if (finalScore || timeUp) return;
    setAnswers(prev => ({ ...prev, [String(current)]: label }));
    api.mockStudy.examAnswer(sessionId, current, label);
  };

  const clearAnswer = () => {
    if (finalScore || timeUp) return;
    setAnswers(prev => { const n = { ...prev }; delete n[String(current)]; return n; });
    api.mockStudy.examAnswer(sessionId, current, null);
  };

  const toggleFlag = () => {
    setFlags(prev => {
      const n = new Set(prev);
      const on = n.has(current);
      if (on) n.delete(current); else n.add(current);
      api.mockStudy.examFlag(sessionId, current, !on);
      return n;
    });
  };

  const goTo = (i: number) => { setCurrent(Math.max(0, Math.min(total - 1, i))); setNavOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  // Keyboard: A–D/1–4 select, ←/→ navigate, F flags, Enter advances (or submits
  // on the last item). Matches the candidate-friendly shortcuts of a real exam.
  useEffect(() => {
    if (finalScore || timeUp) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const opts = questions[current]?.options || [];
      const byLetter = opts.find((o: any) => o.label?.toUpperCase() === e.key.toUpperCase());
      const num = parseInt(e.key, 10);
      if (byLetter) { selectAnswer(byLetter.label); e.preventDefault(); return; }
      if (!Number.isNaN(num) && num >= 1 && num <= opts.length) { selectAnswer(opts[num - 1].label); e.preventDefault(); return; }
      if (e.key === 'ArrowLeft') { goTo(current - 1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { goTo(current + 1); e.preventDefault(); }
      else if (e.key === 'f' || e.key === 'F') { toggleFlag(); e.preventDefault(); }
      else if (e.key === 'Enter') { e.preventDefault(); current < total - 1 ? goTo(current + 1) : doSubmit(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, total, finalScore, timeUp, questions]);

  const addHighlight = (h: Highlight) => setHighlights(prev => [...prev, h]);
  const removeHighlight = (id: string) => setHighlights(prev => prev.filter(h => h.id !== id));

  // --- Submit / auto-submit ---
  const doSubmit = async (auto: boolean) => {
    if (submitting || finalScore) return;
    if (!auto) {
      const unanswered = total - answeredCount;
      const ok = await confirm({
        title: 'Submit your exam?',
        message: `${answeredCount} answered, ${unanswered} unanswered. Unanswered questions count as incorrect, and you can't change answers after submitting.`,
        confirmLabel: 'Submit exam',
        cancelLabel: 'Keep working',
        tone: unanswered > 0 ? 'danger' : 'default',
      });
      if (!ok) return;
    }
    setSubmitting(true);
    try {
      const data = await api.mockStudy.examSubmit(sessionId, answers);
      setFinalScore(data.final_score);
      setResults(data.results);
    } catch (err) {
      console.error('Exam submit failed:', err);
      toast('Failed to submit exam. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-submit when the clock expires.
  useEffect(() => {
    if (timeUp && !finalScore && !submitting) doSubmit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp]);

  // --- RENDER: empty/guard ---
  if (total === 0 && !finalScore) {
    return (
      <div className="h-full bg-gray-50 flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">No exam questions available</h2>
        <p className="text-gray-500 mb-6">The question bank doesn't have enough approved items for an exam yet.</p>
        <button onClick={onExit} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold">Exit</button>
      </div>
    );
  }

  // --- RENDER: COMPLETION SCREEN ---
  if (finalScore) {
    const passed = finalScore.percentage >= PASS_THRESHOLD;
    return (
      <div className="h-full bg-gray-50 flex flex-col overflow-y-auto">
        <div className={`p-12 text-center text-white bg-gradient-to-r ${passed ? 'from-cyan-400 to-emerald-400' : 'from-amber-400 to-orange-500'}`}>
          <h2 className="text-4xl font-extrabold mb-2">Exam Complete</h2>
          <p className="text-white/90 text-xl">
            {passed
              ? `You scored ${finalScore.percentage}% — above the ${PASS_THRESHOLD}% pass line.`
              : `You scored ${finalScore.percentage}%. The pass line is ${PASS_THRESHOLD}%.`}
          </p>
        </div>

        <main className="flex-1 max-w-2xl mx-auto w-full p-6 space-y-6 -mt-8">
          <div className="bg-white rounded-2xl shadow-sm p-8 space-y-6">
            <h3 className="text-xl font-bold text-gray-800 text-center">Your Result</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-emerald-50 rounded-xl p-4">
                <p className="text-2xl font-black text-emerald-600">{finalScore.correct}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Correct</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-2xl font-black text-red-500">{finalScore.total - finalScore.correct}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Wrong</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-2xl font-black text-gray-700">{finalScore.answered}/{finalScore.total}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Answered</p>
              </div>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full flex overflow-hidden">
              <div className="h-full bg-emerald-400" style={{ width: `${finalScore.percentage}%` }} />
              <div className="h-full bg-red-400" style={{ width: `${100 - finalScore.percentage}%` }} />
            </div>
          </div>

          {/* Per-question review */}
          {results && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Question Review</h3>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {results.map(r => {
                  const q = questions[r.index];
                  const skipped = !r.selected_label;
                  return (
                    <div key={r.index} className={`p-3 rounded-xl border ${r.is_correct ? 'border-emerald-200 bg-emerald-50/50' : skipped ? 'border-gray-200 bg-gray-50' : 'border-red-200 bg-red-50/50'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-400">Q{r.index + 1} · {domainLabel(q?.domain || '')}</span>
                        <span className={`text-xs font-bold ${r.is_correct ? 'text-emerald-600' : skipped ? 'text-gray-400' : 'text-red-500'}`}>
                          {r.is_correct ? 'Correct' : skipped ? 'Skipped' : 'Incorrect'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1 line-clamp-2">{q?.stem}</p>
                      <p className="text-xs text-gray-500 mt-1">Your answer: <b>{r.selected_label || '—'}</b> · Correct: <b className="text-emerald-700">{r.correct_label}</b></p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button onClick={onExit} className="w-full py-4 bg-cyan-500 text-white font-bold rounded-xl hover:bg-cyan-600 transition">Exit Exam</button>
        </main>
      </div>
    );
  }

  // --- RENDER: EXAM (navigator) ---
  const q = questions[current];
  const selected = answers[String(current)];
  const isFlagged = flags.has(current);

  const navigator = (
    <div className="space-y-4">
      <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-5 gap-2">
        {questions.map((_, i) => {
          const ans = !!answers[String(i)];
          const fl = flags.has(i);
          const cur = i === current;
          return (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`relative h-9 rounded-lg text-xs font-bold transition ${
                cur ? 'ring-2 ring-offset-1 ring-blue-600 bg-blue-600 text-white'
                  : ans ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {i + 1}
              {fl && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-white" />}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Answered</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 inline-block" /> Unanswered</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Flagged</span>
      </div>
      <button
        onClick={() => doSubmit(false)}
        disabled={submitting}
        className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition disabled:opacity-60"
      >
        {submitting ? 'Submitting…' : `Submit Exam (${answeredCount}/${total})`}
      </button>
    </div>
  );

  return (
    <div className="h-full bg-gray-50 flex flex-col overflow-hidden">
      {/* Header (fixed; only the body below scrolls) */}
      <div className="bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-white flex items-center justify-between flex-shrink-0 z-30">
        <div>
          <h1 className="text-xl font-bold leading-none">Exam Simulation</h1>
          <p className="text-white/70 text-xs mt-1">{answeredCount} of {total} answered{flags.size ? ` · ${flags.size} flagged` : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setNavOpen(true)} className="lg:hidden px-3 py-1.5 bg-white/15 rounded-lg text-sm font-bold">Navigator</button>
          <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${timeLeft <= 300 ? 'bg-red-600 animate-pulse' : 'bg-white/15'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="font-mono text-base font-bold">{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
       <div className="w-full max-w-6xl mx-auto px-4 lg:px-8 py-5 flex gap-6">
        {/* Question column */}
        <main className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 lg:p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                Question {current + 1} of {total} · {domainLabel(q?.domain || '')}
              </span>
              <button
                onClick={toggleFlag}
                className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide transition ${isFlagged ? 'text-amber-600' : 'text-gray-400 hover:text-amber-600'}`}
              >
                <svg className="w-4 h-4" fill={isFlagged ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 2H21l-3 6 3 6h-8.5l-1-2H5a2 2 0 00-2 2z" /></svg>
                {isFlagged ? 'Flagged' : 'Flag'}
              </button>
            </div>

            <div className="text-base md:text-lg leading-relaxed text-gray-800 mb-5">
              <HighlightableText
                text={q?.stem || ''}
                highlights={highlights}
                onAddHighlight={addHighlight}
                onRemoveHighlight={removeHighlight}
              />
            </div>

            <div className="space-y-2.5" role="radiogroup" aria-label="Answer options">
              {(q?.options || []).map(option => {
                const isSelected = selected === option.label;
                return (
                  <button
                    key={option.label}
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => selectAnswer(option.label)}
                    className={`w-full text-left p-3.5 flex items-center gap-3.5 rounded-xl border-2 transition ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-gray-50/50 hover:border-blue-200'}`}
                  >
                    <span className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-bold ${isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-400'}`}>{option.label}</span>
                    <span className={`text-base ${isSelected ? 'text-blue-900 font-medium' : 'text-gray-700'}`}>{option.text}</span>
                  </button>
                );
              })}
            </div>

            {selected && (
              <button onClick={clearAnswer} className="mt-4 text-xs font-bold text-gray-400 hover:text-gray-600 uppercase tracking-wide">Clear answer</button>
            )}

            {/* Prev / Next */}
            <div className="mt-6 flex items-center justify-between">
              <button onClick={() => goTo(current - 1)} disabled={current === 0} className="px-5 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition disabled:opacity-40">← Previous</button>
              {current < total - 1 ? (
                <button onClick={() => goTo(current + 1)} className="px-6 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition">Next →</button>
              ) : (
                <button onClick={() => doSubmit(false)} disabled={submitting} className="px-6 py-3 rounded-xl font-bold text-white bg-gray-900 hover:bg-gray-800 transition disabled:opacity-60">Review &amp; Submit</button>
              )}
            </div>
          </div>
        </main>

        {/* Desktop navigator */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sticky top-2">
            <h3 className="text-sm font-bold text-gray-700 mb-4">Question Navigator</h3>
            {navigator}
          </div>
        </aside>
       </div>
      </div>

      {/* Mobile navigator sheet */}
      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setNavOpen(false)} />
          <div className="relative ml-auto w-80 max-w-[85vw] h-full bg-white p-5 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-700">Question Navigator</h3>
              <button onClick={() => setNavOpen(false)} aria-label="Close" className="text-gray-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            {navigator}
          </div>
        </div>
      )}

      {/* Time-up overlay (auto-submit in flight) */}
      {timeUp && !finalScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Time's up</h3>
            <p className="text-gray-500">Submitting your exam and tallying your score…</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamSession;
