/**
 * @file ReviewQueueModal.tsx
 * @description Flashcard-style review of the user's weak items (wrong or
 * low-confidence answers), fetched from GET /api/review-queue/. Each card shows
 * the stem and options; revealing surfaces the correct answer, the user's prior
 * choice, and the rationale. Pure review (no re-grading) — fast spaced revisiting.
 */

import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ReviewItem } from '../types';
import { DOMAIN_INFO } from '../constants';

interface ReviewQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const domainLabel = (code: string) =>
  (DOMAIN_INFO as Record<string, { label: string }>)[code]?.label || code;

const ReviewQueueModal: React.FC<ReviewQueueModalProps> = ({ isOpen, onClose }) => {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setItems(null); setError(false); setIndex(0); setRevealed(false);
    api.getReviewQueue()
      .then(q => setItems(q.items))
      .catch(() => setError(true));
  }, [isOpen]);

  if (!isOpen) return null;

  const item = items?.[index];
  const total = items?.length ?? 0;

  const next = () => {
    setRevealed(false);
    setIndex(i => i + 1);
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
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${item.reason === 'incorrect' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {item.reason === 'incorrect' ? 'Missed' : 'Low confidence'}
                  </span>
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
          <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
            {!revealed ? (
              <button onClick={() => setRevealed(true)} className="px-6 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition">Reveal answer</button>
            ) : (
              <button onClick={next} className="px-6 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition">
                {index + 1 >= total ? 'Finish' : 'Next card'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewQueueModal;
