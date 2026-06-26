/**
 * @file Modal.tsx
 * @description Accessible modal/dialog primitive: blurred backdrop, scale-in panel,
 * Escape-to-close, click-outside, and body scroll-lock. An optional gradient header
 * gives feature modals a confident, branded top.
 */
import React, { useEffect } from 'react';
import { cn } from './cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  /** Optional eyebrow text above the title (renders the gradient header). */
  eyebrow?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Hide the default close (X) control. */
  hideClose?: boolean;
  className?: string;
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

export const Modal: React.FC<ModalProps> = ({
  open, onClose, title, description, eyebrow, children, footer, size = 'md', hideClose, className,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full overflow-hidden rounded-4xl bg-white shadow-soft-lg ring-1 ring-slate-900/5',
          'animate-in fade-in zoom-in-95 duration-300',
          SIZES[size],
          className,
        )}
      >
        {eyebrow ? (
          <div className="relative bg-gradient-to-br from-brand-500 to-brand-700 px-7 pb-7 pt-6 text-white">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">{eyebrow}</p>
            {title && <h3 className="mt-1 text-2xl font-extrabold">{title}</h3>}
            {description && <p className="mt-1 text-sm text-white/85">{description}</p>}
          </div>
        ) : (
          (title || description) && (
            <div className="px-7 pt-7">
              {title && <h3 className="text-xl font-bold text-ink">{title}</h3>}
              {description && <p className="mt-1.5 leading-relaxed text-slate-500">{description}</p>}
            </div>
          )
        )}

        {!hideClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className={cn(
              'absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full transition',
              eyebrow ? 'text-white/80 hover:bg-white/15 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
            )}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        )}

        {children && <div className="px-7 py-6">{children}</div>}
        {footer && <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-7 py-5">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
