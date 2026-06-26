/**
 * @file ErrorInsightsModal.tsx
 * @description Surfaces *why* a candidate gets questions wrong (test-taking traps:
 * decision-word misreads, overconfidence, domain concentration) from
 * GET /api/error-analysis/, with plain-language coaching. Read-only.
 */

import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ErrorAnalysis } from '../types';
import { DOMAIN_INFO } from '../constants';

interface Props { isOpen: boolean; onClose: () => void; }

const domainLabel = (code?: string) =>
  code ? ((DOMAIN_INFO as Record<string, { label: string }>)[code]?.label || code) : '';

const SEV: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
};

const ErrorInsightsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<ErrorAnalysis | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setData(null); setError(false);
    api.getErrorAnalysis().then(d => { if (active) setData(d); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 fade-in duration-200 flex flex-col">
        <div className="bg-gradient-to-r from-rose-500 to-pink-600 p-6 text-white flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold">Test-Taking Insights</h2>
            <p className="text-white/80 text-sm">How your thinking trips up — and how to fix it.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-7 overflow-y-auto">
          {error ? (
            <p className="text-center text-gray-500 py-12">Couldn't load your insights. Please try again.</p>
          ) : data === null ? (
            <div className="flex items-center justify-center py-16"><div className="h-10 w-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : !data.enough_data ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">Not enough data yet</h3>
              <p className="text-gray-500 max-w-sm mx-auto">Answer more questions (you have {data.total_wrong} miss{data.total_wrong === 1 ? '' : 'es'} so far) and we'll surface your recurring test-taking patterns.</p>
            </div>
          ) : data.patterns.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">No clear trap patterns</h3>
              <p className="text-gray-500 max-w-sm mx-auto">Your errors don't cluster into a recurring test-taking trap — they look like ordinary content gaps. Keep drilling weak domains.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">From {data.total_wrong} missed questions, we found these patterns:</p>
              {data.patterns.map(p => (
                <div key={p.key} className="rounded-2xl border border-gray-100 p-5">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="font-bold text-gray-900">{p.label}{p.domain ? ` · ${domainLabel(p.domain)}` : ''}</h3>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${SEV[p.severity] || SEV.low}`}>{p.count}×</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{p.detail}</p>
                  {p.examples?.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {p.examples.map((ex, i) => (
                        <li key={i} className="text-xs text-gray-400 italic border-l-2 border-gray-200 pl-3">"{ex}…"</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorInsightsModal;
