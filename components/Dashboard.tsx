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

  // Per-domain bar colors, cycled by index so each progress bar is visually distinct.
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Empty state: a radar over all-zero data is meaningless, so prompt the user
  // to answer some questions first.
  const answeredTotal = stats.reduce((sum, s) => sum + s.total, 0);
  if (answeredTotal === 0) {
    return (
      <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-100 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Your Competency Profile</h2>
        <p className="text-gray-500 max-w-md mx-auto">Answer a few questions in a case study or mock session and your strengths across the six NOTCE domains will appear here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Your 2026 Competency Profile</h2>
        <p className="text-gray-500">Real-time performance across weighted NOTCE domains.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Radar Chart Section */}
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} />
              <Radar
                name="Proficiency"
                dataKey="A"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Stats Section */}
        <div className="space-y-4">
          {stats.map((s, idx) => (
            <div key={s.tag} className="flex flex-col">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">{DOMAIN_INFO[s.tag].label}</span>
                <span className="text-xs text-gray-400">Target: {s.weight}</span>
              </div>
              
              {/* Progress Bar Container */}
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div 
                  className="h-2 rounded-full transition-all duration-500" 
                  style={{ 
                    width: `${(s.score / (s.total || 1)) * 100}%`,
                    backgroundColor: COLORS[idx % COLORS.length]
                  }}
                />
              </div>
              
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-400">{s.score}/{s.total} Correct</span>
                <span className="text-xs font-bold text-gray-600">{Math.round((s.score / (s.total || 1)) * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
