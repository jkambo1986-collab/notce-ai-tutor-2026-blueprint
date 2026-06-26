/**
 * @file Feedback.tsx
 * @description App-wide, on-brand replacements for the browser's native alert()/confirm().
 * Exposes `useToast()` for transient notifications and `useConfirm()` for a promise-based
 * confirmation dialog. Wrap the app once in <FeedbackProvider> (see AppWrapper).
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

// --- Types ---

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

/** Optional, single inline action rendered inside a toast (e.g. "Try again"). */
interface ToastAction {
  label: string;
  onClick: () => void;
}

/** Per-toast overrides. `duration: 0` keeps the toast up until manually dismissed. */
interface ToastOptions {
  /** Auto-dismiss delay in ms (default 4000; 0 = sticky). */
  duration?: number;
  /** Inline action button (e.g. retry / resume). */
  action?: ToastAction;
}

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' tints the confirm button red (destructive / high-stakes actions). */
  tone?: 'default' | 'danger';
}

interface FeedbackContextType {
  toast: (message: string, variant?: ToastVariant, options?: ToastOptions) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextType | null>(null);

// --- Icons ---

const VARIANT_STYLES: Record<ToastVariant, { ring: string; icon: React.ReactNode }> = {
  success: {
    ring: 'border-emerald-200 bg-white',
    icon: (
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
      </span>
    ),
  },
  error: {
    ring: 'border-red-200 bg-white',
    icon: (
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
      </span>
    ),
  },
  info: {
    ring: 'border-blue-200 bg-white',
    icon: (
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </span>
    ),
  },
  warning: {
    ring: 'border-amber-200 bg-white',
    icon: (
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
      </span>
    ),
  },
};

/**
 * FeedbackProvider
 *
 * Context provider that owns the toast queue and confirm-dialog state, and renders
 * both overlays. Provides `toast` and `confirm` to descendants via context.
 * Mount once near the app root.
 *
 * @param {{ children: React.ReactNode }} props - Wrapped application tree
 * @returns {JSX.Element} Provider with toast stack and confirm dialog
 */
export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<
    (ConfirmOptions & { resolve: (value: boolean) => void }) | null
  >(null);
  // Connectivity banner state (feature: network/offline awareness). Guard for SSR.
  const [online, setOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  // Track browser online/offline events so transient request failures get a single,
  // unifying signal instead of N discrete error toasts.
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  /**
   * Enqueue a toast. Defaults to a 4s auto-dismiss; pass `duration: 0` to keep it
   * up until dismissed, or an `action` to render a single inline button.
   */
  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info', options?: ToastOptions) => {
      const duration = options?.duration ?? 4000;
      // Monotonic id without Date.now()/Math.random() (kept deterministic-friendly).
      setToasts((prev) => {
        const id = (prev.length ? prev[prev.length - 1].id : 0) + 1;
        const next = [...prev, { id, message, variant, action: options?.action }];
        // Auto-dismiss after `duration` ms (0 = sticky, dismiss manually).
        if (duration > 0) {
          setTimeout(() => {
            setToasts((cur) => cur.filter((t) => t.id !== id));
          }, duration);
        }
        return next;
      });
    },
    [],
  );

  // Open the confirm dialog and return a promise that resolves when the user
  // chooses — the stored `resolve` is invoked by closeConfirm below.
  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...options, resolve });
    });
  }, []);

  /** Resolve the pending confirm promise with the user's choice and close the dialog. */
  const closeConfirm = (value: boolean) => {
    if (confirmState) confirmState.resolve(value);
    setConfirmState(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Connectivity banner: a single top-of-screen signal while the browser is offline. */}
      {!online && (
        <div
          role="alert"
          className="fixed inset-x-0 top-0 z-[120] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-lg animate-in slide-in-from-top-2 duration-300"
        >
          <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M5.636 5.636a9 9 0 000 12.728m0 0l2.829-2.829M3 3l18 18" /></svg>
          You appear to be offline — recent changes may not have saved.
        </div>
      )}

      {/* Toast stack */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 w-[calc(100vw-2rem)] max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-xl shadow-gray-900/5 animate-in slide-in-from-bottom-4 fade-in duration-300 ${VARIANT_STYLES[t.variant].ring}`}
          >
            {VARIANT_STYLES[t.variant].icon}
            <div className="pt-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 leading-snug">{t.message}</p>
              {t.action && (
                <button
                  onClick={() => {
                    t.action!.onClick();
                    setToasts((cur) => cur.filter((x) => x.id !== t.id));
                  }}
                  className="mt-2 text-sm font-bold text-teal-600 hover:text-teal-700 transition"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => setToasts((cur) => cur.filter((x) => x.id !== t.id))}
              className="ml-auto -mr-1 -mt-1 p-1 text-gray-300 hover:text-gray-500 transition"
              aria-label="Dismiss notification"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
      </div>

      {/* Confirm dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => closeConfirm(false)} />
          <div
            role="alertdialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl animate-in zoom-in-95 fade-in duration-200"
          >
            <h3 className="text-xl font-bold text-gray-900">{confirmState.title}</h3>
            {confirmState.message && (
              <p className="mt-2 text-gray-500 leading-relaxed">{confirmState.message}</p>
            )}
            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => closeConfirm(false)}
                className="px-5 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition"
              >
                {confirmState.cancelLabel || 'Cancel'}
              </button>
              <button
                onClick={() => closeConfirm(true)}
                autoFocus
                className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg transition active:scale-95 ${
                  confirmState.tone === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                    : 'bg-teal-600 hover:bg-teal-700 shadow-teal-200'
                }`}
              >
                {confirmState.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
};

/** Transient toast notifications. `toast('Saved!', 'success')`. */
export const useToast = () => {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useToast must be used within <FeedbackProvider>');
  return ctx.toast;
};

/** Promise-based confirmation. `if (await confirm({ title: '...' })) { ... }`. */
export const useConfirm = () => {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useConfirm must be used within <FeedbackProvider>');
  return ctx.confirm;
};
