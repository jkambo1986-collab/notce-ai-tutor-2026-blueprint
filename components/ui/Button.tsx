/**
 * @file Button.tsx
 * @description The app's primary button primitive. On-brand "Clinical Trust"
 * styling with tasteful micro-interactions: a subtle hover-lift, an active press,
 * a soft focus ring, and an inline loading spinner. Variants cover the common
 * roles (primary / secondary / outline / ghost / subtle / danger).
 */
import React from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'subtle' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  // Solid teal with a soft glow — the single most important action on a screen.
  primary:
    'bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-glow-teal hover:from-brand-500 hover:to-brand-700 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:ring-brand-500/40',
  secondary:
    'bg-ink text-white shadow-soft hover:bg-slate-800 hover:-translate-y-0.5 focus-visible:ring-slate-500/40',
  outline:
    'bg-white text-ink ring-1 ring-inset ring-slate-200 shadow-soft hover:ring-brand-300 hover:text-brand-700 hover:-translate-y-0.5 focus-visible:ring-brand-500/40',
  ghost:
    'text-slate-600 hover:text-ink hover:bg-slate-100 focus-visible:ring-slate-400/30',
  subtle:
    'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100 hover:bg-brand-100 focus-visible:ring-brand-500/30',
  danger:
    'bg-gradient-to-b from-red-500 to-red-600 text-white shadow-soft hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-8px_rgba(239,68,68,.5)] focus-visible:ring-red-500/40',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-xl gap-1.5',
  md: 'h-11 px-5 text-sm rounded-xl gap-2',
  lg: 'h-14 px-7 text-base rounded-2xl gap-2.5',
};

const Spinner = () => (
  <svg className="animate-spin h-[1.1em] w-[1.1em]" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
  </svg>
);

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, fullWidth, leftIcon, rightIcon, className, children, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'group relative inline-flex select-none items-center justify-center font-bold tracking-tight',
        'transition-all duration-200 ease-out outline-none focus-visible:ring-4',
        'active:translate-y-0 active:scale-[.98] disabled:pointer-events-none disabled:opacity-55 disabled:shadow-none disabled:translate-y-0',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : leftIcon}
      {children && <span className="truncate">{children}</span>}
      {!loading && rightIcon}
    </button>
  ),
);
Button.displayName = 'Button';

export default Button;
