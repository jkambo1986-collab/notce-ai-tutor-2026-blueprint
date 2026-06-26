/**
 * @file TodayPanel.tsx
 * @description The "Today" hero on the home dashboard — the single surface that
 * answers "what should I do right now?". It synthesizes three signals the app
 * already computes:
 *   - exam countdown (days_to_exam from /performance/)
 *   - readiness (pass_projection band + projected score) — surfaced here on Home
 *     rather than buried in the Analytics page
 *   - the single best next action (review items due → drill the weakest domain →
 *     start practicing), with a one-tap CTA
 *
 * Data is fetched once on mount; action callbacks are owned by MainDashboard so
 * this component stays presentational and reuses the existing drill/review flows.
 */

import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { Performance } from '../types';
import { DOMAIN_INFO } from '../constants';

const DOMAIN_LABEL = (code: string): string =>
  (DOMAIN_INFO as Record<string, { label: string }>)[code]?.label || code;

/** Band → chip styling + a plain-language readiness line. */
const BAND: Record<string, { chip: string; line: string }> = {
  'Likely pass': { chip: 'bg-emerald-100 text-emerald-700', line: "You're on track — keep the momentum." },
  'Borderline': { chip: 'bg-amber-100 text-amber-700', line: 'Close to the line — tighten your weak domains.' },
  'At risk': { chip: 'bg-red-100 text-red-700', line: 'Below the pass line — focused daily practice will move this.' },
  'Not enough data': { chip: 'bg-gray-100 text-gray-600', line: 'Answer a few more to project your score.' },
};

interface TodayPanelProps {
  /** Items due in the spaced-review queue (owned/fetched by MainDashboard). */
  reviewCount: number | null;
  /** Premium-gated: one-tap drill of the weakest domain. */
  onSmartDrill?: () => void;
  /** Premium-gated: open the practice setup. */
  onStartPractice?: () => void;
  /** Opens the Daily Review queue modal. */
  onOpenReview?: () => void;
}

const TodayPanel: React.FC<TodayPanelProps> = ({ reviewCount, onSmartDrill, onStartPractice, onOpenReview }) => {
  const { user } = useAuth();
  const isPaid = !!user?.userprofile?.is_paid;
  const isTrial = !!user?.userprofile?.is_trial_active;
  const canDrill = isPaid || isTrial;

  const [perf, setPerf] = useState<Performance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.getPerformance()
      .then(p => { if (active) setPerf(p); })
      .catch(() => { /* non-fatal: panel degrades to a generic prompt */ })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex items-center justify-center h-32">
        <div className="h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const proj = perf?.pass_projection;
  const band = proj?.band || 'Not enough data';
  const bandStyle = BAND[band] || BAND['Not enough data'];
  const daysToExam = perf?.days_to_exam ?? null;

  // Weakest attempted domain drives the "sharpen X" recommendation.
  const weakest = (perf?.by_domain || [])
    .filter(d => d.answered > 0)
    .sort((a, b) => a.accuracy - b.accuracy)[0];
  const answeredAny = (perf?.overall.answered || 0) > 0;

  // The single recommended next action, in priority order.
  let rec: { title: string; sub: string; cta: string; action?: () => void; gated: boolean };
  if (reviewCount && reviewCount > 0) {
    rec = {
      title: `${reviewCount} item${reviewCount === 1 ? '' : 's'} due for review`,
      sub: 'Lock in what you nearly forgot — spaced to stick.',
      cta: 'Start review', action: onOpenReview, gated: false,
    };
  } else if (weakest && weakest.accuracy < 70) {
    rec = {
      title: `Sharpen ${DOMAIN_LABEL(weakest.domain)}`,
      sub: `Your weakest domain right now at ${weakest.accuracy}%. A focused drill moves it fastest.`,
      cta: 'Smart Drill', action: onSmartDrill, gated: true,
    };
  } else if (!answeredAny) {
    rec = {
      title: 'Start your first drill',
      sub: 'Answer a few questions and your readiness score will build here.',
      cta: 'Start practice', action: onStartPractice, gated: true,
    };
  } else {
    rec = {
      title: 'Keep your streak going',
      sub: 'Solid form across the board — a short drill keeps it sharp.',
      cta: 'Practice', action: onStartPractice, gated: true,
    };
  }

  const ctaDisabled = rec.gated && !canDrill;

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 md:p-8 shadow-lg text-white">
      <div className="flex flex-col lg:flex-row gap-6 lg:items-center justify-between">
        {/* Left: Today's focus */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-300">Today's focus</span>
            {daysToExam !== null && daysToExam >= 0 && (
              <span className="text-xs font-semibold text-slate-300">· {daysToExam} day{daysToExam === 1 ? '' : 's'} to your exam</span>
            )}
          </div>
          <h2 className="text-2xl font-extrabold mb-1">{rec.title}</h2>
          <p className="text-slate-300 text-sm max-w-xl">{rec.sub}</p>
          <button
            onClick={() => !ctaDisabled && rec.action?.()}
            disabled={ctaDisabled}
            className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ctaDisabled ? 'Premium required' : rec.cta}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Right: Readiness gauge (F3, surfaced on Home) */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 w-full lg:w-64 flex-shrink-0">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Exam readiness</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-black">{proj?.enough_data ? `${proj.projected_accuracy}%` : '—'}</span>
            <span className={`mb-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${bandStyle.chip}`}>{band}</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">{bandStyle.line}</p>
        </div>
      </div>
    </div>
  );
};

export default TodayPanel;
