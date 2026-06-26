/**
 * @file Loaders.tsx
 * @description Loading + skeleton + empty-state primitives. Shimmer skeletons and
 * a branded spinner replace abrupt blank screens, so waits feel intentional.
 */
import React from 'react';
import { cn } from './cn';

/** Branded ring spinner. `size` is the px diameter. */
export const Spinner: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <span
    role="status"
    aria-label="Loading"
    style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 9)) }}
    className={cn('inline-block animate-spin rounded-full border-brand-500 border-t-transparent align-[-0.125em]', className)}
  />
);

/** Shimmering skeleton block. Compose several to mock a card/list while loading. */
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('relative overflow-hidden rounded-xl bg-slate-100', className)}>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
  </div>
);

/** A pre-composed card skeleton for grid placeholders. */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('rounded-3xl bg-white p-6 ring-1 ring-slate-200/70 shadow-card', className)}>
    <Skeleton className="h-12 w-12 rounded-2xl" />
    <Skeleton className="mt-5 h-4 w-2/3" />
    <Skeleton className="mt-3 h-3 w-full" />
    <Skeleton className="mt-2 h-3 w-4/5" />
  </div>
);

/** Full-bleed centered loading state with a branded spinner + message. */
export const LoadingScreen: React.FC<{ title?: string; subtitle?: string; className?: string }> = ({
  title = 'Loading…',
  subtitle,
  className,
}) => (
  <div className={cn('flex h-full min-h-[40vh] w-full flex-col items-center justify-center gap-5 p-8 text-center', className)}>
    <div className="relative">
      <span className="absolute inset-0 animate-ping rounded-full bg-brand-400/30" />
      <Spinner size={52} />
    </div>
    <div className="animate-fade-in-up">
      <h3 className="text-xl font-bold text-ink">{title}</h3>
      {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
    </div>
  </div>
);

/** Friendly empty state with an icon, copy, and optional action. */
export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon, title, description, action, className }) => (
  <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center animate-fade-in-up', className)}>
    {icon && (
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
        {icon}
      </div>
    )}
    <h3 className="text-2xl font-bold text-ink">{title}</h3>
    {description && <p className="mt-2 max-w-sm text-slate-500">{description}</p>}
    {action && <div className="mt-7">{action}</div>}
  </div>
);
