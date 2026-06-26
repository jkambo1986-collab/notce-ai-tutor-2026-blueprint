/**
 * @file DailyBriefingModal.tsx
 * @description Personalized daily audio briefing (#3). Fetches a spoken-word
 * digest tailored to the user (readiness, exam countdown, weakest-domain
 * micro-teach, spaced-review due) and plays it aloud as one narration via the
 * existing neural-voice TTS. The transcript is shown so it's readable too.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { BriefingResponse } from '../types';
import { useVoice } from './VoiceContext';
import { SpeakButton } from './ui';

const BRIEFING_ID = 'daily-briefing';

const DailyBriefingModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { speak, cancel, speaking, speakingId, supported } = useVoice();
  const [data, setData] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setData(null); setLoading(true); setError(false);
    api.getBriefing()
      .then(d => { if (active) setData(d); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fullText = useMemo(() => (data?.segments || []).map(s => s.text).join('  '), [data]);
  const isPlaying = speaking && speakingId === BRIEFING_ID;

  if (!isOpen) return null;

  const summary = data?.summary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => { cancel(); onClose(); }} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold">Your Daily Briefing</h2>
            <p className="text-white/70 text-xs mt-0.5">A 2-minute spoken digest, just for you.</p>
          </div>
          <button onClick={() => { cancel(); onClose(); }} aria-label="Close" className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error ? (
            <div className="text-center py-10">
              <h3 className="text-lg font-bold text-gray-800 mb-1">Couldn't build your briefing</h3>
              <p className="text-gray-500 text-sm">Please try again in a moment.</p>
            </div>
          ) : loading || !data ? (
            <div className="flex items-center justify-center py-16"><div className="h-10 w-10 border-4 border-slate-700 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <>
              {/* Summary chips */}
              {summary && (
                <div className="flex flex-wrap gap-2 mb-5">
                  {summary.projected != null && <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">Readiness {summary.projected}% · {summary.band}</span>}
                  {summary.days_to_exam != null && summary.days_to_exam >= 0 && <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-700">{summary.days_to_exam} days to exam</span>}
                  {summary.review_due > 0 && <span className="px-3 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-700">{summary.review_due} due for review</span>}
                  {summary.weakest_domain && <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Focus: {summary.weakest_domain}</span>}
                </div>
              )}

              {/* Play / stop */}
              {supported && (
                <button
                  onClick={() => (isPlaying ? cancel() : speak(fullText, { id: BRIEFING_ID, force: true }))}
                  className="w-full mb-5 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-teal-500 to-cyan-600 hover:opacity-90 transition flex items-center justify-center gap-2"
                >
                  {isPlaying ? (
                    <><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg> Stop</>
                  ) : (
                    <><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg> Play briefing</>
                  )}
                </button>
              )}

              {/* Transcript */}
              <div className="space-y-3">
                {data.segments.map((s, i) => (
                  <div key={i} className="bg-gray-50 rounded-2xl p-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{s.title}</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{s.text}</p>
                    </div>
                    <SpeakButton id={`brief-seg-${i}`} text={s.text} size="sm" label="Play this part" />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyBriefingModal;
