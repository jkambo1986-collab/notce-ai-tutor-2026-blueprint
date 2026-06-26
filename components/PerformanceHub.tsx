/**
 * @file PerformanceHub.tsx
 * @description Cross-session analytics view backed by GET /api/performance/.
 * Aggregates every recorded answer (case studies + mock/exam) into overall
 * accuracy, a projected-accuracy / pass-likelihood gauge tied to the exam date,
 * per-domain mastery, confidence calibration, a recent-accuracy trend, and study
 * activity. Unlike the in-session radar, this reflects the user's whole history.
 */

import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Performance } from '../types';
import { DOMAIN_INFO } from '../constants';

const DOMAIN_LABEL = (code: string): string =>
  (DOMAIN_INFO as Record<string, { label: string }>)[code]?.label || code;

/** Tailwind classes for the pass-likelihood band. */
const BAND_STYLE: Record<string, string> = {
  'Likely pass': 'text-emerald-700 bg-emerald-100',
  'Borderline': 'text-amber-700 bg-amber-100',
  'At risk': 'text-red-700 bg-red-100',
  'Not enough data': 'text-gray-600 bg-gray-100',
};

const accuracyColor = (a: number): string =>
  a >= 70 ? 'bg-emerald-500' : a >= 50 ? 'bg-amber-500' : 'bg-red-500';

const PerformanceHub: React.FC = () => {
  const [data, setData] = useState<Performance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    api.getPerformance()
      .then(p => { if (active) setData(p); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 text-center">
        <h3 className="text-lg font-bold text-gray-800 mb-1">Couldn't load your performance</h3>
        <p className="text-gray-500 text-sm">Please try again in a moment.</p>
      </div>
    );
  }

  // Empty state: nothing answered yet anywhere.
  if (data.overall.answered === 0) {
    return (
      <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Your Performance Hub</h2>
        <p className="text-gray-500 max-w-md mx-auto">Answer questions in a case study, mock drill, or exam and your cross-session mastery, calibration, and projected score will build here.</p>
      </div>
    );
  }

  const { overall, pass_projection, by_domain, confidence, trend, activity, days_to_exam } = data;
  const maxTrend = Math.max(...trend.map(t => t.answered), 1);

  return (
    <div className="space-y-6">
      {/* --- Top row: overall + projection + activity --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Overall accuracy */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Overall Accuracy</h4>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-black text-gray-900">{overall.accuracy}%</span>
            <span className="text-sm text-gray-400 mb-1.5">{overall.correct}/{overall.answered} correct</span>
          </div>
          <div className="mt-3 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${accuracyColor(overall.accuracy)}`} style={{ width: `${overall.accuracy}%` }} />
          </div>
        </div>

        {/* Projected accuracy / pass band */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Projected Score</h4>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-black text-gray-900">{pass_projection.enough_data ? `${pass_projection.projected_accuracy}%` : '—'}</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${BAND_STYLE[pass_projection.band] || BAND_STYLE['Not enough data']}`}>
              {pass_projection.band}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {pass_projection.enough_data
              ? `Based on your last ${pass_projection.sample_size} answers.`
              : `Answer ${20 - overall.answered} more to unlock your projection.`}
          </p>
        </div>

        {/* Activity / exam countdown */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Activity</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-2xl font-black text-gray-900">{activity.study_days}</p>
              <p className="text-xs text-gray-400">active days</p>
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">{activity.answers_last_7_days}</p>
              <p className="text-xs text-gray-400">answers this week</p>
            </div>
          </div>
          {days_to_exam !== null && days_to_exam >= 0 && (
            <p className="mt-3 text-xs font-bold text-teal-600">{days_to_exam} days to your exam</p>
          )}
        </div>
      </div>

      {/* --- Per-domain mastery --- */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-1">Domain Mastery</h3>
        <p className="text-gray-500 text-sm mb-5">Accuracy across all your answers, per NOTCE competency.</p>
        <div className="space-y-4">
          {by_domain.map(d => (
            <div key={d.domain}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">{DOMAIN_LABEL(d.domain)}</span>
                <span className="text-xs text-gray-400">{d.answered === 0 ? 'Not attempted' : `${d.correct}/${d.answered} · ${d.accuracy}%`}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all duration-500 ${d.answered === 0 ? 'bg-gray-200' : accuracyColor(d.accuracy)}`} style={{ width: `${d.answered === 0 ? 0 : d.accuracy}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- Confidence calibration + trend --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calibration */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-1">Confidence Calibration</h3>
          <p className="text-gray-500 text-sm mb-5">How often you're right at each confidence level (case studies).</p>
          {confidence.every(c => c.answered === 0) ? (
            <p className="text-sm text-gray-400 py-4">Rate your confidence on case answers to see calibration.</p>
          ) : (
            <div className="space-y-4">
              {confidence.map(c => (
                <div key={c.level}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700 capitalize">{c.level.toLowerCase()} confidence</span>
                    <span className="text-xs text-gray-400">{c.answered === 0 ? '—' : `${c.accuracy}% (${c.answered})`}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${c.answered === 0 ? 'bg-gray-200' : accuracyColor(c.accuracy)}`} style={{ width: `${c.answered === 0 ? 0 : c.accuracy}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-gray-400 pt-1">Tip: if "High confidence" accuracy is low, you may be over-confident — slow down on those.</p>
            </div>
          )}
        </div>

        {/* Trend */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-1">Recent Trend</h3>
          <p className="text-gray-500 text-sm mb-5">Accuracy per active day (last {trend.length || 0}).</p>
          {trend.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No dated activity yet.</p>
          ) : (
            <div className="flex items-end gap-2 h-40">
              {trend.map(t => (
                <div key={t.date} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${t.date}: ${t.accuracy}% (${t.correct}/${t.answered})`}>
                  <div className={`w-full rounded-t ${accuracyColor(t.accuracy)}`} style={{ height: `${Math.max(4, t.accuracy)}%`, opacity: 0.4 + 0.6 * (t.answered / maxTrend) }} />
                  <span className="text-[9px] text-gray-400">{t.date.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceHub;
