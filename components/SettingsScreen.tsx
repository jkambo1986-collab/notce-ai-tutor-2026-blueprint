/**
 * @file SettingsScreen.tsx
 * @description Account / study-profile settings. Lets the user edit their exam
 * date and goal domains at any time — previously these were collected once in
 * onboarding with no way to revisit (a dead end). The exam date feeds the home
 * countdown + readiness projection, so being able to change it matters.
 */

import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../services/api';
import { useToast } from './ui/Feedback';
import { DomainTag } from '../types';
import { DOMAIN_INFO } from '../constants';

const DOMAINS = Object.values(DomainTag).map(tag => ({
  id: tag as string,
  label: (DOMAIN_INFO as Record<string, { label: string }>)[tag]?.label || tag,
}));

const SettingsScreen: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const toast = useToast();

  const profile = user?.userprofile;
  const [examDate, setExamDate] = useState<string>(profile?.target_exam_date || '');
  const [goals, setGoals] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const toggleGoal = (id: string) => {
    setGoals(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateProfile({
        target_exam_date: examDate || null,
        // Only send goals if the user touched them, so an untouched save doesn't
        // wipe previously-set goals (they aren't read back into this form).
        ...(goals.size > 0 ? { goal_domains: Array.from(goals) } : {}),
      });
      await refreshProfile();
      toast('Settings saved.', 'success');
    } catch (err) {
      console.error('Settings save failed:', err);
      toast('Could not save your settings. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6 md:p-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Settings</h1>
          <p className="text-gray-500">Manage your study profile. Signed in as <span className="font-semibold text-gray-700">{user?.username}</span>.</p>
        </div>

        {/* Exam date */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Exam date</h2>
          <p className="text-sm text-gray-500 mb-4">Drives your home countdown and readiness projection.</p>
          <input
            type="date"
            min={today}
            value={examDate}
            onChange={e => setExamDate(e.target.value)}
            className="border border-gray-300 rounded-xl px-4 py-3 text-gray-800 w-full max-w-xs outline-none focus:border-teal-500"
          />
          {examDate && (
            <button onClick={() => setExamDate('')} className="ml-3 text-sm text-gray-400 hover:text-gray-600">Clear</button>
          )}
        </div>

        {/* Goal domains */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Focus domains</h2>
          <p className="text-sm text-gray-500 mb-4">Pick the competencies you most want to strengthen (optional).</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DOMAINS.map(d => {
              const on = goals.has(d.id);
              return (
                <button
                  key={d.id}
                  onClick={() => toggleGoal(d.id)}
                  className={`text-left px-4 py-3 rounded-xl border-2 transition ${on ? 'border-teal-500 bg-teal-50 text-teal-800 font-semibold' : 'border-gray-200 text-gray-600 hover:border-teal-200'}`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
};

export default SettingsScreen;
