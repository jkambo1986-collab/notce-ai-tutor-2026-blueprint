/**
 * @file AnalyticsModal.tsx
 * @description Performance Analytics modal showing domain-level competency tracking
 * with visual charts and insights aligned with the 2026 NOTCE blueprint.
 */

import React from 'react';
import { DomainStats, DomainTag } from '../types';
import { DOMAIN_INFO } from '../constants';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  domainStats: DomainStats[];
  totalAnswered: number;
  totalCorrect: number;
}

const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ 
  isOpen, 
  onClose, 
  domainStats,
  totalAnswered,
  totalCorrect 
}) => {
  if (!isOpen) return null;

  const overallScore = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  // Calculate color for score
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getDomainColor = (tag: DomainTag) => {
    const colors: Record<DomainTag, string> = {
      [DomainTag.OT_EXP]: 'from-blue-500 to-blue-600',
      [DomainTag.CEJ_JUSTICE]: 'from-purple-500 to-purple-600',
      [DomainTag.COMM_COLLAB]: 'from-green-500 to-green-600',
      [DomainTag.PROF_RESP]: 'from-red-500 to-red-600',
      [DomainTag.EXCELLENCE]: 'from-amber-500 to-amber-600',
      [DomainTag.ENGAGEMENT]: 'from-teal-500 to-teal-600',
    };
    return colors[tag] || 'from-gray-500 to-gray-600';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 p-8 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold">Performance Analytics</h2>
              <p className="text-white/80 mt-1">Track your competency across all 6 OT practice domains</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[60vh]">
          {/* Overall Score Card */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Overall Score</p>
                <p className={`text-5xl font-bold mt-2 ${getScoreColor(overallScore)}`}>{overallScore}%</p>
                <p className="text-gray-500 mt-2">{totalCorrect} of {totalAnswered} questions correct</p>
              </div>
              <div className="w-32 h-32 relative">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="56" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                  <circle 
                    cx="64" cy="64" r="56" fill="none" 
                    stroke={overallScore >= 80 ? '#22c55e' : overallScore >= 60 ? '#eab308' : '#ef4444'} 
                    strokeWidth="12" 
                    strokeLinecap="round"
                    strokeDasharray={`${(overallScore / 100) * 351.8} 351.8`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-700">{overallScore}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Domain Breakdown */}
          <h3 className="text-lg font-bold text-gray-800 mb-4">Domain Breakdown</h3>
          <div className="space-y-4">
            {domainStats.map((stat) => {
              const percentage = stat.total > 0 ? Math.round((stat.score / stat.total) * 100) : 0;
              const info = DOMAIN_INFO[stat.tag];
              
              return (
                <div key={stat.tag} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getDomainColor(stat.tag)} flex items-center justify-center text-white text-lg`}>
                        {info?.label?.charAt(0) || '?'}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">{info?.label || stat.tag}</h4>
                        <p className="text-xs text-gray-500">Target: {stat.weight}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${getScoreColor(percentage)}`}>{percentage}%</p>
                      <p className="text-xs text-gray-500">{stat.score}/{stat.total} correct</p>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${getProgressColor(percentage)}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            
            {domainStats.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-gray-500 font-medium">No data yet</p>
                <p className="text-gray-400 text-sm mt-1">Complete some cases to see your analytics</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsModal;
