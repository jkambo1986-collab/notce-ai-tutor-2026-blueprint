/**
 * @file ReviewQueueModal.tsx
 * @description Spaced-repetition review of the user's weak items, fetched from
 * GET /api/review-queue/ (items that are *due* now). Each card shows the stem and
 * options; revealing surfaces the correct answer + rationale, then the learner
 * grades it (Forgot / Got it) which reschedules the item via the SRS backend.
 */

import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ReviewItem } from '../types';
import { DOMAIN_INFO } from '../constants';
import { useToast } from './ui/Feedback';

interface ReviewQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const domainLabel = (code: string) =>
  (DOMAIN_INFO as Record<string, { label: string }>)[code]?.label || code;

const ReviewQueueModal: React.FC<ReviewQueueModalProps> = ({ isOpen, onClose }) => {
  const toast = useToast();
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setItems(null); setError(false); setIndex(0); setRevealed(false); setSaved(new Set());
    api.getReviewQueue()
      .then(q => { if (active) setItems(q.items); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [isOpen]);

  const saveCurrent = async (it: ReviewItem) => {
    try {
      await api.addNote({
        id: it.id, stem: it.stem, domain: it.domain,
        correct_label: it.correct_label, correct_text: it.correct_text,
        rationale: it.rationale, source: it.source,
      });
      setSaved(prev => new Set(prev).add(it.id));
      toast('Saved to your notebook.', 'success');
    } catch {
      toast('Could not save to notebook.', 'error');
    }
  };

  if (!isOpen) return null;

  const item = items?.[index];
  const total = items?.length ?? 0;

  const next = () => {
    setRevealed(false);
    setIndex(i => i + 1);
  };

  /** Grade the current card (spaced repetition) and advance. */
  const grade = (it: ReviewItem, remembered: boolean) => {
    api.gradeReview(it.key, remembered); // fire-and-forget; UI advances immediately
    next();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 fade-in duration-200 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold">Daily Review</h2>
            <p className="text-white/80 text-sm">Revisit what you missed or weren't sure about.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-7 overflow-y-auto">
          {error ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-bold text-gray-800 mb-1">Couldn't load your review queue</h3>
              <p className="text-gray-500 text-sm">Please try again in a moment.</p>
            </div>
          ) : items === null ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : total === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">Nothing to review — nice!</h3>
              <p className="text-gray-500 max-w-sm mx-auto">Items you miss or mark low-confidence show up here so you can shore them up before exam day.</p>
            </div>
          ) : index >= total ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">Review complete</h3>
              <p className="text-gray-500 mb-6">You revisited {total} weak {total === 1 ? 'item' : 'items'}.</p>
              <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition">Done</button>
            </div>
          ) : item ? (
            <div>
              {/* Progress + tags */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Card {index + 1} of {total}</span>
                <div className="flex gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">{domainLabel(item.domain)}</span>
                  {item.reason && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${item.reason === 'incorrect' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {item.reason === 'incorrect' ? 'Missed' : 'Low confidence'}
                    </span>
                  )}
                </div>
              </div>

              <p className="text-lg font-semibold text-gray-900 leading-snug mb-5">{item.stem}</p>

              <div className="space-y-2.5">
                {item.options.map(o => {
                  const isCorrect = revealed && o.label === item.correct_label;
                  const isYours = revealed && o.label === item.your_label && o.label !== item.correct_label;
                  return (
                    <div key={o.label} className={`flex items-start gap-3 p-3 rounded-xl border-2 ${isCorrect ? 'border-emerald-500 bg-emerald-50' : isYours ? 'border-red-400 bg-red-50' : 'border-gray-100'}`}>
                      <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isCorrect ? 'bg-emerald-500 text-white' : isYours ? 'bg-red-400 text-white' : 'bg-gray-100 text-gray-500'}`}>{o.label}</span>
                      <span className={`text-sm ${isCorrect ? 'text-emerald-900 font-medium' : 'text-gray-700'}`}>{o.text}</span>
                      {isYours && <span className="ml-auto text-[10px] font-bold text-red-500 uppercase">Your pick</span>}
                    </div>
                  );
                })}
              </div>

              {revealed && (
                <div className="mt-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <h4 className="text-sm font-bold text-emerald-800 mb-1">Why {item.correct_label} is correct</h4>
                  <p className="text-sm text-emerald-700 leading-relaxed">{item.rationale}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer actions (only on an active card) */}
        {items && total > 0 && index < total && item && (
          <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-between items-center gap-3">
            {revealed ? (
              <button
                onClick={() => saveCurrent(item)}
                disabled={saved.has(item.id)}
                className="px-4 py-3 rounded-xl font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition flex items-center gap-2 disabled:opacity-60 disabled:cursor-default"
              >
                <svg className="w-4 h-4" fill={saved.has(item.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                {saved.has(item.id) ? 'Saved' : 'Save to notebook'}
              </button>
            ) : <span />}
            {!revealed ? (
              <button onClick={() => setRevealed(true)} className="px-6 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition">Reveal answer</button>
            ) : (
              <div className="flex gap-2">
                {/* Grading drives spaced repetition: "Forgot" resurfaces it soon,
                    "Got it" pushes it further out. */}
                <button onClick={() => grade(item, false)} className="px-5 py-3 rounded-xl font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition">
                  Forgot
                </button>
                <button onClick={() => grade(item, true)} className="px-5 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition">
                  Got it
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewQueueModal;
