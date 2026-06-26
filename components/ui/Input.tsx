/**
 * @file Input.tsx
 * @description Text input + field wrapper for the "Clinical Trust" look. Supports
 * a label, leading icon, error text, and a soft animated focus ring. Designed for
 * both the light app surfaces and the dark auth screens (via `tone`).
 */
import React from 'react';
import { cn } from './cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  /** 'light' for app surfaces, 'dark' for the auth glass cards. */
  tone?: 'light' | 'dark';
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightSlot, tone = 'light', className, containerClassName, id, ...rest }, ref) => {
    const autoId = id || rest.name || label?.toLowerCase().replace(/\s+/g, '-');
    const dark = tone === 'dark';
    return (
      <div className={cn('w-full', containerClassName)}>
        {label && (
          <label
            htmlFor={autoId}
            className={cn(
              'mb-2 block px-1 text-xs font-bold uppercase tracking-widest',
              dark ? 'text-slate-400' : 'text-slate-500',
            )}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className={cn('pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4', dark ? 'text-slate-500' : 'text-slate-400')}>
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={autoId}
            className={cn(
              'w-full rounded-2xl p-4 text-base outline-none transition-all duration-200',
              leftIcon && 'pl-12',
              rightSlot && 'pr-12',
              dark
                ? 'border border-white/10 bg-white/5 text-white placeholder:text-slate-600 focus:border-brand-400/50 focus:bg-white/10 focus:ring-4 focus:ring-brand-500/20'
                : 'border border-slate-200 bg-white text-ink placeholder:text-slate-400 shadow-inner-soft focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15',
              error && (dark ? 'border-red-500/50 focus:ring-red-500/20' : 'border-red-300 focus:border-red-400 focus:ring-red-500/15'),
              className,
            )}
            {...rest}
          />
          {rightSlot && <span className="absolute inset-y-0 right-0 flex items-center pr-2">{rightSlot}</span>}
        </div>
        {error ? (
          <p className="mt-2 flex items-center gap-1.5 px-1 text-xs font-medium text-red-500 animate-fade-in">
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.7-3L13.7 4a2 2 0 00-3.4 0L3.3 16A2 2 0 005 19z" /></svg>
            {error}
          </p>
        ) : hint ? (
          <p className={cn('mt-2 px-1 text-xs', dark ? 'text-slate-500' : 'text-slate-400')}>{hint}</p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';

export default Input;
