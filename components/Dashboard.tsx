/**
 * @file Dashboard.tsx
 * @description A visualization component that displays student performance statistics.
 * Uses 'recharts' to render a Radar Chart comparing performance across weighted domains 
 * and a bar-like visualization for target alignment.
 */

import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { DomainStats } from '../types';
import { DOMAIN_INFO } from '../constants';

/**
 * Props for the Dashboard component.
 */
interface Props {
  /** Array of statistics for each domain, including score and total questions. */
  stats: DomainStats[];
}

/**
 * Dashboard Component
 * 
 * Renders a competency profile using a spider/radar chart to visualize the student's
 * strengths and weaknesses across the blueprint domains.
 * 
 * @param {Props} props - Component props
 * @returns {JSX.Element} The rendered dashboard
 */
const Dashboard: React.FC<Props> = ({ stats }) => {
  // Transform domain stats into data format compatible with Recharts
  const chartData = stats.map(s => ({
    subject: DOMAIN_INFO[s.tag].label,
    A: (s.score / (s.total || 1)) * 100, // Normalized score (0-100)
    fullMark: 100,
  }));

  // Per-domain bar colors, cycled by index. Harmonized to the brand teal/emerald
  // family so the dashboard reads as one calm, cohesive palette.
  const COLORS = ['#0d9488', '#10b981', '#14b8a6', '#0f766e', '#34d399', '#5eead4'];

  // Empty state: a radar over all-zero data is meaningless, so prompt the user
  // to answer some questions first.
  const answeredTotal = stats.reduce((sum, s) => sum + s.total, 0);
  if (answeredTotal === 0) {
    return (
      <div className="bg-white p-10 rounded-3xl shadow-card ring-1 ring-slate-200/70 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-3xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 flex items-center justify-center">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-ink mb-2">Your Competency Profile</h2>
        <p className="text-slate-500 max-w-md mx-auto">Answer a few questions in a case study or mock session and your strengths across the six NOTCE domains will appear here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-card ring-1 ring-slate-200/70 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-ink mb-2">Your 2026 Competency Profile</h2>
        <p className="text-slate-500">Real-time performance across weighted NOTCE domains.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Radar Chart Section */}
        <div className="h-[300px] w-full rounded-3xl bg-canvas/60 ring-1 ring-slate-200/60 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} />
              <Radar
                name="Proficiency"
                dataKey="A"
                stroke="#0d9488"
                fill="#14b8a6"
                fillOpacity={0.5}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Stats Section */}
        <div className="space-y-4">
          {stats.map((s, idx) => (
            <div key={s.tag} className="flex flex-col">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-sm font-semibold text-slate-700">{DOMAIN_INFO[s.tag].label}</span>
                <span className="text-xs text-slate-400">Target: {s.weight}</span>
              </div>

              {/* Progress Bar Container */}
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${(s.score / (s.total || 1)) * 100}%`,
                    backgroundColor: COLORS[idx % COLORS.length]
                  }}
                />
              </div>

              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-slate-400">{s.score}/{s.total} Correct</span>
                <span className="text-xs font-bold text-slate-600">{Math.round((s.score / (s.total || 1)) * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
