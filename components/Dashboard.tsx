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

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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
