/**
 * @file SavedProgressModal.tsx
 * @description Modal showing user's saved progress and session history
 * with ability to resume previous sessions.
 */

import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Button, Badge, Spinner, EmptyState } from './ui';

/** A single resumable session row, flattened from a case + its saved session. */
interface Session {
  id: string;
  caseTitle: string;
  caseId: string;
  currentIndex: number;
  totalQuestions: number;
  isCompleted: boolean;
  lastAccessed: string;
}

interface SavedProgressModalProps {
  /** Controls modal visibility; renders nothing when false. */
  isOpen: boolean;
  /** Dismiss the modal. */
  onClose: () => void;
  /** Resume the chosen case's session. */
  onResumeSession: (caseId: string) => void;
  /** Case currently open, if any — its row is badged as "Current". */
  currentCaseId?: string;
}

/**
 * SavedProgressModal Component
 *
 * Lists the user's recent cases that have saved sessions and lets them resume
 * an in-progress one. Sessions are loaded on open.
 *
 * @param {SavedProgressModalProps} props - Component props
 * @returns {JSX.Element | null} The modal, or null when closed
 */
const SavedProgressModal: React.FC<SavedProgressModalProps> = ({
  isOpen, 
  onClose, 
  onResumeSession,
  currentCaseId 
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);

  /**
   * Load the 10 most recent cases and resolve their saved sessions in parallel,
   * dropping any case that has no session. See the inline note re: avoiding the
   * old N+1 sequential waterfall.
   */
  const loadSessions = async () => {
    setIsLoading(true);
    try {
      // Get all cases, then fetch their sessions concurrently (was an N+1
      // sequential waterfall that made the modal slow to open).
      const cases = await api.getCases();
      const recent = cases.slice(0, 10); // Limit to 10 recent

      const results = await Promise.all(
        recent.map(async (caseItem): Promise<Session | null> => {
          try {
            const session = await api.getSession(caseItem.id);
            if (!session) return null;
            return {
              id: caseItem.id,
              caseTitle: caseItem.title || 'Untitled Case',
              caseId: caseItem.id,
              currentIndex: session.currentIndex || 0,
              totalQuestions: caseItem.questions?.length || 3,
              isCompleted: session.isCompleted || false,
              lastAccessed: new Date().toLocaleDateString()
            };
          } catch (e) {
            return null; // No session for this case
          }
        })
      );

      setSessions(results.filter((s): s is Session => s !== null));
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  /** Percentage of questions completed, rounded for the progress bar width. */
  const getProgressPercent = (current: number, total: number) => {
    return Math.round((current / total) * 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-4xl shadow-soft-lg ring-1 ring-slate-900/5 max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700 p-8 text-white">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full text-white/80 hover:bg-white/15 hover:text-white flex items-center justify-center transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-extrabold">Saved Progress</h2>
              <p className="text-white/85 mt-1">Resume exactly where you left off</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[55vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size={32} />
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState
              icon={(
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              title="No Saved Sessions"
              description="Start a case study to begin tracking your progress"
            />
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => {
                const progress = getProgressPercent(session.currentIndex, session.totalQuestions);
                const isCurrent = session.caseId === currentCaseId;

                return (
                  <div
                    key={session.id}
                    className={`p-5 rounded-3xl border transition-all duration-200 ${
                      session.isCompleted
                        ? 'bg-emerald-50 border-emerald-200'
                        : isCurrent
                          ? 'bg-brand-50 border-brand-300'
                          : 'bg-white border-slate-200/70 shadow-soft hover:border-brand-200 hover:-translate-y-0.5 hover:shadow-card-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-ink">{session.caseTitle}</h4>
                          {session.isCompleted && (
                            <Badge tone="success">Completed</Badge>
                          )}
                          {isCurrent && !session.isCompleted && (
                            <Badge tone="brand">Current</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">
                          Question {session.currentIndex + 1} of {session.totalQuestions}
                        </p>

                        {/* Progress Bar */}
                        <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              session.isCompleted ? 'bg-emerald-500' : 'bg-brand-500'
                            }`}
                            style={{ width: `${session.isCompleted ? 100 : progress}%` }}
                          />
                        </div>
                      </div>

                      {!session.isCompleted && (
                        <Button
                          size="sm"
                          className="ml-4"
                          onClick={() => {
                            onResumeSession(session.caseId);
                            onClose();
                          }}
                          leftIcon={(
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        >
                          Resume
                        </Button>
                      )}

                      {session.isCompleted && (
                        <div className="ml-4 w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50/60 border-t border-slate-100 flex justify-between items-center">
          <p className="text-sm text-slate-500">
            {sessions.filter(s => !s.isCompleted).length} sessions in progress
          </p>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SavedProgressModal;
