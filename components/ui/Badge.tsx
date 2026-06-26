/**
 * @file Badge.tsx
 * @description Small status/label pill used for tiers, tags, "New", correctness,
 * and metadata chips. Quiet by default, with tonal variants.
 */
import React from 'react';
import { cn } from './cn';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'premium';

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-700 ring-amber-100',
  danger: 'bg-red-50 text-red-600 ring-red-100',
  info: 'bg-blue-50 text-blue-700 ring-blue-100',
  premium: 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white ring-0 shadow-soft',
};

export const Badge: React.FC<{
  tone?: Tone;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ tone = 'neutral', icon, className, children }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ring-inset',
      TONES[tone],
      className,
    )}
  >
    {icon}
    {children}
  </span>
);

export default Badge;
