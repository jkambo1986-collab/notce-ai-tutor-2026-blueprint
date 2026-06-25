/**
 * @file AppShell.tsx
 * @description Application shell layout: a collapsible dark left sidebar (navigation,
 * primary actions, account/trial info) paired with a light content area that carries a
 * contextual top bar. Wraps the authenticated app views (study, mock, exam, analytics).
 */

import React, { useEffect, useState } from 'react';
import { User } from '../types';

export type ShellView =
  | 'landing'
  | 'study'
  | 'dashboard'
  | 'mock-study'
  | 'exam-mode'
  | 'payment-success'
  | 'payment-cancel';

interface NavItem {
  key: ShellView;
  label: string;
  icon: React.ReactNode;
}

interface AppShellProps {
  activeView: ShellView;
  onNavigate: (view: ShellView) => void;
  user: User | null;
  onLogout: () => void;
  onNewCase: () => void;
  onResumeMock?: () => void;
  onUpgrade?: () => void;
  children: React.ReactNode;
}

const STORAGE_KEY = 'sidebar_collapsed';

// --- Icons (inline so the shell has no asset/icon dependency) ---
const Icon: React.FC<{ path: string; className?: string }> = ({ path, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className || 'h-5 w-5'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const ICONS = {
  home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  book: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  target: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  bolt: 'M13 10V3L4 14h7v7l9-11h-7z',
  logout: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 18L18 6M6 6l12 12',
  chevronLeft: 'M15 19l-7-7 7-7',
  play: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
};

const NAV: NavItem[] = [
  { key: 'landing', label: 'Home', icon: <Icon path={ICONS.home} /> },
  { key: 'study', label: 'Study', icon: <Icon path={ICONS.book} /> },
  { key: 'mock-study', label: 'Mock Study', icon: <Icon path={ICONS.target} /> },
  { key: 'exam-mode', label: 'Exam', icon: <Icon path={ICONS.clock} /> },
  { key: 'dashboard', label: 'Analytics', icon: <Icon path={ICONS.chart} /> },
];

const PAGE_TITLES: Record<ShellView, string> = {
  'landing': 'Home',
  'study': 'Study Mode',
  'dashboard': 'Analytics',
  'mock-study': 'Mock Study',
  'exam-mode': 'Exam Simulation',
  'payment-success': 'Payment',
  'payment-cancel': 'Payment',
};

const TIER_STYLES: Record<string, { label: string; className: string }> = {
  free: { label: 'Free', className: 'bg-slate-700 text-slate-200' },
  crammer: { label: 'Crammer', className: 'bg-blue-500/20 text-blue-300' },
  guarantee: { label: 'Guarantee', className: 'bg-teal-500/20 text-teal-300' },
  beta: { label: 'Beta', className: 'bg-purple-500/20 text-purple-300' },
};

/** Whole days from now until an ISO date string (negative if in the past). */
function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24));
}

const AppShell: React.FC<AppShellProps> = ({
  activeView,
  onNavigate,
  user,
  onLogout,
  onNewCase,
  onResumeMock,
  onUpgrade,
  children,
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      /* ignore storage failures */
    }
  }, [collapsed]);

  // Close the mobile drawer whenever the active view changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [activeView]);

  const profile = user?.userprofile;
  const tier = (profile?.subscription_tier || 'free').toLowerCase();
  const tierStyle = TIER_STYLES[tier] || TIER_STYLES.free;
  const trialDays = profile?.is_trial_active ? daysUntil(profile.trial_end_date) : null;
  const examDays = daysUntil(profile?.target_exam_date);
  const showUpgrade = !profile?.is_paid && !profile?.is_trial_active;

  const handleNavClick = (key: ShellView) => {
    onNavigate(key);
    setMobileOpen(false);
  };

  // --- Sidebar contents (shared between desktop rail and mobile drawer) ---
  const sidebarBody = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className={`flex items-center gap-3 px-4 h-16 border-b border-slate-800 ${collapsed ? 'md:justify-center md:px-0' : ''}`}>
        <div className="bg-teal-500 text-white p-2 rounded-lg font-bold text-xl leading-none shadow-lg shadow-teal-500/20">N</div>
        <div className={collapsed ? 'md:hidden' : ''}>
          <h1 className="text-base font-bold text-white leading-none">NOTCE AI-Tutor</h1>
          <p className="text-[10px] text-teal-400 font-semibold tracking-wider mt-1">2026 BLUEPRINT</p>
        </div>
      </div>

      {/* Primary action */}
      <div className="px-3 pt-4">
        <button
          onClick={() => { onNewCase(); setMobileOpen(false); }}
          title="Generate New Case"
          className={`w-full flex items-center gap-3 bg-teal-500 hover:bg-teal-400 text-white font-bold rounded-xl transition shadow-lg shadow-teal-500/20 ${collapsed ? 'md:justify-center md:px-0 px-4 py-3' : 'px-4 py-3'}`}
        >
          <Icon path={ICONS.bolt} className="h-5 w-5 flex-shrink-0" />
          <span className={collapsed ? 'md:hidden' : ''}>New Case</span>
        </button>
      </div>

      {/* Resume banner */}
      {onResumeMock && (
        <div className="px-3 pt-3">
          <button
            onClick={() => { onResumeMock(); setMobileOpen(false); }}
            title="Resume active session"
            className={`w-full flex items-center gap-3 bg-slate-800 hover:bg-slate-700 text-teal-300 font-semibold rounded-xl transition px-4 py-2.5 ${collapsed ? 'md:justify-center md:px-0' : ''}`}
          >
            <Icon path={ICONS.play} className="h-5 w-5 flex-shrink-0" />
            <span className={`text-sm ${collapsed ? 'md:hidden' : ''}`}>Resume Session</span>
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(item => {
          const active = activeView === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handleNavClick(item.key)}
              title={item.label}
              className={`relative w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition group ${
                active ? 'bg-teal-500/10 text-teal-300' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              } ${collapsed ? 'md:justify-center md:px-0' : ''}`}
            >
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r bg-teal-400" />}
              <span className="flex-shrink-0">{item.icon}</span>
              <span className={collapsed ? 'md:hidden' : ''}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Exam countdown */}
      {examDays !== null && examDays >= 0 && (
        <div className={`px-3 pb-2 ${collapsed ? 'md:hidden' : ''}`}>
          <div className="flex items-center gap-2 bg-slate-800/70 rounded-xl px-3 py-2.5 border border-slate-700">
            <Icon path={ICONS.calendar} className="h-5 w-5 text-teal-400 flex-shrink-0" />
            <div className="leading-tight">
              <p className="text-white font-bold text-sm">{examDays} {examDays === 1 ? 'day' : 'days'}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">to your exam</p>
            </div>
          </div>
        </div>
      )}

      {/* Account footer */}
      <div className="border-t border-slate-800 p-3">
        <div className={`flex items-center gap-3 ${collapsed ? 'md:justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-full bg-slate-700 text-teal-300 flex items-center justify-center font-bold uppercase flex-shrink-0">
            {user?.username?.[0] || '?'}
          </div>
          <div className={`min-w-0 flex-1 ${collapsed ? 'md:hidden' : ''}`}>
            <p className="text-sm font-semibold text-white truncate">{user?.username || 'Account'}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tierStyle.className}`}>{tierStyle.label}</span>
              {trialDays !== null && trialDays >= 0 && (
                <span className="text-[10px] text-amber-300 font-semibold">Trial: {trialDays}d left</span>
              )}
            </div>
          </div>
        </div>

        {showUpgrade && onUpgrade && (
          <button
            onClick={() => { onUpgrade(); setMobileOpen(false); }}
            className={`mt-3 w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-bold rounded-lg py-2 hover:opacity-90 transition ${collapsed ? 'md:hidden' : ''}`}
          >
            Upgrade
          </button>
        )}

        <button
          onClick={onLogout}
          title="Logout"
          className={`mt-3 w-full flex items-center gap-3 text-slate-400 hover:text-red-400 text-sm font-semibold rounded-lg px-3 py-2 hover:bg-slate-800 transition ${collapsed ? 'md:justify-center md:px-0' : ''}`}
        >
          <Icon path={ICONS.logout} className="h-5 w-5 flex-shrink-0" />
          <span className={collapsed ? 'md:hidden' : ''}>Logout</span>
        </button>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden md:flex mt-2 w-full items-center justify-center text-slate-500 hover:text-teal-300 py-2 transition"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon path={ICONS.chevronLeft} className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex flex-col bg-slate-900 transition-[width] duration-300 flex-shrink-0 ${collapsed ? 'w-20' : 'w-64'}`}>
        {sidebarBody}
      </aside>

      {/* Mobile drawer + overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-slate-900 h-full shadow-2xl animate-in slide-in-from-left duration-200">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 text-slate-400 hover:text-white z-10"
              aria-label="Close menu"
            >
              <Icon path={ICONS.close} />
            </button>
            {sidebarBody}
          </aside>
        </div>
      )}

      {/* Content column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center gap-3 px-4 flex-shrink-0 z-20">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden text-gray-600 hover:text-gray-900"
            aria-label="Open menu"
          >
            <Icon path={ICONS.menu} className="h-6 w-6" />
          </button>
          <h2 className="text-lg font-bold text-gray-800">{PAGE_TITLES[activeView]}</h2>
          <button
            onClick={onNewCase}
            className="ml-auto hidden md:flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition border border-teal-200"
          >
            <Icon path={ICONS.bolt} className="h-4 w-4" />
            New Case
          </button>
        </header>

        {/* View content */}
        <main className="flex-1 overflow-hidden relative">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
