/**
 * @file SavedProgressModal.tsx
 * @description Modal showing user's saved progress and session history
 * with ability to resume previous sessions.
 */

import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

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
  isOpen: boolean;
  onClose: () => void;
  onResumeSession: (caseId: string) => void;
  currentCaseId?: string;
}

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

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      // Get all cases and sessions
      const cases = await api.getCases();
      const sessionsData: Session[] = [];
      
      for (const caseItem of cases.slice(0, 10)) { // Limit to 10 recent
        try {
          const session = await api.getSession(caseItem.id);
          if (session) {
            sessionsData.push({
              id: caseItem.id,
              caseTitle: caseItem.title || 'Untitled Case',
              caseId: caseItem.id,
              currentIndex: session.currentIndex || 0,
              totalQuestions: caseItem.questions?.length || 3,
              isCompleted: session.isCompleted || false,
              lastAccessed: new Date().toLocaleDateString()
            });
          }
        } catch (e) {
          // No session for this case
        }
      }
      
      setSessions(sessionsData);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const getProgressPercent = (current: number, total: number) => {
    return Math.round((current / total) * 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-green-600 via-emerald-600 to-teal-500 p-8 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
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
              <h2 className="text-2xl font-bold">Saved Progress</h2>
              <p className="text-white/80 mt-1">Resume exactly where you left off</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[55vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">No Saved Sessions</h3>
              <p className="text-gray-500">Start a case study to begin tracking your progress</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => {
                const progress = getProgressPercent(session.currentIndex, session.totalQuestions);
                const isCurrent = session.caseId === currentCaseId;
                
                return (
                  <div 
                    key={session.id}
                    className={`p-5 rounded-2xl border-2 transition-all ${
                      session.isCompleted 
                        ? 'bg-green-50 border-green-200' 
                        : isCurrent 
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-white border-gray-100 hover:border-green-200 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-gray-800">{session.caseTitle}</h4>
                          {session.isCompleted && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                              Completed
                            </span>
                          )}
                          {isCurrent && !session.isCompleted && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          Question {session.currentIndex + 1} of {session.totalQuestions}
                        </p>
                        
                        {/* Progress Bar */}
                        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              session.isCompleted ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${session.isCompleted ? 100 : progress}%` }}
                          />
                        </div>
                      </div>
                      
                      {!session.isCompleted && (
                        <button
                          onClick={() => {
                            onResumeSession(session.caseId);
                            onClose();
                          }}
                          className="ml-4 px-5 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Resume
                        </button>
                      )}
                      
                      {session.isCompleted && (
                        <div className="ml-4 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
          <p className="text-sm text-gray-500">
            {sessions.filter(s => !s.isCompleted).length} sessions in progress
          </p>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SavedProgressModal;
