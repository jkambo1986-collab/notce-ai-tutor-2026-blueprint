/**
 * @file Card.tsx
 * @description Surface primitive for the "Clinical Trust" look: warm-white panels
 * with a hairline border, soft layered shadow, and generous rounding. Optional
 * `interactive` adds a quiet hover-lift for clickable cards.
 */
import React from 'react';
import { cn } from './cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds hover-lift + pointer affordance for clickable cards. */
  interactive?: boolean;
  /** Renders as a <button> instead of a <div> (keeps a11y for clickable cards). */
  as?: 'div' | 'button';
  /** Tighter / looser inner padding. Default 'md'. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PAD: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const Card: React.FC<CardProps> = ({ interactive, as = 'div', padding = 'md', className, children, ...rest }) => {
  const Comp: any = as;
  return (
    <Comp
      className={cn(
        'rounded-3xl bg-white ring-1 ring-slate-200/70 shadow-card',
        PAD[padding],
        interactive &&
          'group cursor-pointer text-left transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-card-hover hover:ring-brand-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30',
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
};

export default Card;
