/**
 * @file App.tsx
 * @description The main application component for NOTCE AI-Tutor.
 * Orchestrates the user flow between 'Study Mode' (case study vignette and questions) and 'Dashboard' (analytics).
 * Manages global state including current case, user answers, highlights, and AI-driven feedback.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { CaseStudy, QuestionItem, Highlight, UserAnswer, ConfidenceLevel, DomainTag, DomainStats, ExpertHighlight, EvidenceLinkResult } from './types';
import { DOMAIN_INFO } from './constants';
import HighlightableText from './components/HighlightableText';
import MainDashboard from './components/MainDashboard';
import { AuthProvider, useAuth } from './components/AuthContext';
import LoginPage from './components/Auth/LoginPage';
import RegisterPage from './components/Auth/RegisterPage';
import { api } from './services/api';
import Dashboard from './components/Dashboard';
import { validateCaseStudy } from './services/geminiService';
import MockStudySession from './components/MockStudySession';
import MockStudySetupModal from './components/MockStudySetupModal';
import ExamSession from './components/ExamSession';
import LandingPage from './components/Landing/LandingPage';

// The main application logic, assumed to be authenticated
const MainApp: React.FC = () => {
    const { logout, user } = useAuth();

  // --- STATE MANAGEMENT ---

  // Current case study being worked on
  const [currentCase, setCurrentCase] = useState<CaseStudy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false); // New state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Index of the currently displayed question
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  // User-created text highlights in the vignette
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  
  // Collection of user answers
  const [answers, setAnswers] = useState<UserAnswer[]>([]);
  
  // Flag indicating if the user has finished all questions in the case
  const [isCaseComplete, setIsCaseComplete] = useState(false);
  
  // Mobile-specific UI state for the vignette sheet
  const [isMobileVignetteOpen, setIsMobileVignetteOpen] = useState(false);
  
  // Form state for the current question
  const [selectedConfidence, setSelectedConfidence] = useState<ConfidenceLevel | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  
  // AI-generated tip text
  const [evolvingTip, setEvolvingTip] = useState<string | null>(null);
  
  // Result of blueprint validation checks
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  
  // Evidence-Link analysis result (AI-identified clinical indicators)
  const [evidenceLinkResult, setEvidenceLinkResult] = useState<EvidenceLinkResult | null>(null);
  
  // Current view mode
  const [view, setView] = useState<'landing' | 'study' | 'dashboard' | 'mock-study' | 'exam-mode' | 'payment-success' | 'payment-cancel'>('landing');
  
  // Mock Study State
  const [isMockSetupOpen, setIsMockSetupOpen] = useState(false);
  const [mockSessionId, setMockSessionId] = useState<string | null>(null);
  const [mockSessionData, setMockSessionData] = useState<any>(null);
  const [activeMockSession, setActiveMockSession] = useState<any>(null); // New state

  // --- EFFECTS ---

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('session_id')) {
            setView('payment-success');
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (urlParams.has('cancel')) {
            setView('payment-cancel');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    // Fetch initial data on mount
    useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        const [cases, mockSession] = await Promise.all([
            api.getCases(),
            api.mockStudy.getActiveSession()
        ]);
        
        if (mockSession) {
            setActiveMockSession(mockSession);
        }

          if (cases.length > 0) {
            const fullCase = await api.getCase(cases[0].id);
            setCurrentCase(fullCase);
            
            try {
                const session = await api.getSession(fullCase.id);
                if (session) {
                    console.log("Found saved session:", session);
                    setCurrentQuestionIndex(session.currentIndex);
                    if (session.isCompleted) setIsCaseComplete(true);
                }
            } catch (e) {
                console.warn("Failed to check for saved session", e);
            }
        }
      } catch (err) {
        console.warn("Could not load initial data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // Validate the case study against blueprint standards once loaded
  useEffect(() => {
    if (currentCase) {
        validateCaseStudy(currentCase).then(setValidationResult);
    }
  }, [currentCase]);

  /**
   * Adaptive Logic Effect:
   * Generates an "evolving rationale" or tip using Gemini AI when the user progresses to a new question.
   * Based on their performance in the previous question.
   */
  useEffect(() => {
    if (currentCase && currentQuestionIndex > 0 && view === 'study') {
      const prevAnswer = answers.find(a => a.questionId === currentCase.questions[currentQuestionIndex - 1].id);
      if (prevAnswer) {
        const isCorrect = prevAnswer.selectedLabel === currentCase.questions[currentQuestionIndex - 1].correctLabel;
        const allCorrect = answers.every((a, idx) => {
          if (idx >= currentQuestionIndex) return true;
          return a.selectedLabel === currentCase.questions[idx].correctLabel;
        });
        
        api.getRationale({
          question_id: currentCase.questions[currentQuestionIndex].id,
          previous_answer: { is_correct: isCorrect, selected_label: prevAnswer.selectedLabel },
          all_previous_correct: allCorrect
        }).then(setEvolvingTip).catch(console.error);
      }
    } else {
      setEvolvingTip(null);
    }
  }, [currentQuestionIndex, view, currentCase, answers]);

  /**
   * Background Prefetch Logic:
   * When a user starts a case study, prefetch the next one in the background
   * to reduce latency if they choose to generate another one.
   */
  useEffect(() => {
    if (view === 'study' && currentCase) {
        const domain = currentCase.tags?.find(t => t !== 'AI-Generated' && t !== 'Prefetched') || 'OT Expertise';
        const difficulty = currentCase.tags?.find(t => ['Easy', 'Medium', 'Hard'].includes(t)) || 'Medium';
        
        const timer = setTimeout(() => {
            api.prefetchCase(domain, difficulty);
        }, 8000); // Wait 8s to prioritize current interactive experience
        return () => clearTimeout(timer);
    }
  }, [view, currentCase?.id]);



  // --- ACTIONS ---

  const addHighlight = (h: Highlight) => setHighlights(prev => [...prev, h]);
  const removeHighlight = (id: string) => setHighlights(prev => prev.filter(h => h.id !== id));

  /**
   * Handles submission of an answer.
   * Records the answer, confidence, and timestamp.
   * Calls Evidence-Link API for feedback on clinical reasoning.
   * Advances to the next question or completes the case.
   */
  const handleNext = async () => {
    if (!currentCase || !selectedLabel || !selectedConfidence || isSubmitting) return;

    setIsSubmitting(true);
    try {
        const currentQuestion = currentCase.questions[currentQuestionIndex];

    const newAnswer: UserAnswer = {
      questionId: currentQuestion.id,
      selectedLabel: selectedLabel,
      confidence: selectedConfidence,
      timestamp: Date.now()
    };

    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);
    
    // Call Evidence-Link API for clinical reasoning feedback
    try {
      const evidenceResult = await api.getEvidenceLink({
        vignette: currentCase.vignette,
        question_id: currentQuestion.id,
        user_highlights: highlights.map(h => ({ start: h.start, end: h.end, text: h.text }))
      });
      setEvidenceLinkResult(evidenceResult);
    } catch (err) {
      console.warn('Evidence-Link analysis failed:', err);
      setEvidenceLinkResult(null);
    }

    setSelectedLabel(null);
    setSelectedConfidence(null);

    if (currentQuestionIndex < currentCase.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      // Clear evidence link result for next question (user will see briefly)
      setTimeout(() => setEvidenceLinkResult(null), 5000);
    } else {
      setIsCaseComplete(true);
    }
    } finally {
        setIsSubmitting(false);
    }
  };

  /**
   * Resets the entire application state for a fresh attempt at the case.
   */
  const resetCase = () => {
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setIsCaseComplete(false);
    setView('study');
    setHighlights([]);
  };

  /**
   * Triggers generation of a new AI case with specific domain and difficulty.
   */
    const handleGenerateCase = async (domain: string, difficulty: string) => {
        try {
            setIsGenerating(true);
            setError(null);
            const newCase = await api.generateCase(domain, difficulty);
            setCurrentCase(newCase);
            resetCase();
        } catch (err) {
            console.error(err);
            setError("Failed to generate case. Please try again.");
            setIsGenerating(false);
        } finally {
            setIsGenerating(false);
        }
    };

    /**
     * Starts the Mock Study Setup process.
     */
    const handleStartMockStudySetup = () => {
        setIsMockSetupOpen(true);
    };

    /**
     * Launches a new Mock Study Session.
     */
    const handleLaunchMockStudy = async (domain: string, difficulty: string, length: number) => {
        try {
            setIsGenerating(true);
            const data = await api.mockStudy.start(domain, difficulty, length);
            setMockSessionId(data.session_id);
            setMockSessionData(data);
            setView('mock-study');
            setIsMockSetupOpen(false);
            setActiveMockSession(data); // Set as active
        } catch (err) {
            console.error("Failed to start mock study:", err);
            alert("Failed to start mock study session. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleResumeMockStudy = () => {
        if (activeMockSession) {
            setMockSessionId(activeMockSession.session_id);
            setMockSessionData(activeMockSession);
            setView('mock-study');
        }
    };

    /**
     * Launches a full Exam Simulation.
     */
    const handleLaunchExam = async () => {
        try {
            if (!confirm("Start Full Exam Simulation? This will start a 4-hour timer.")) return;
            
            setIsGenerating(true);
            // Default: Exam Mode = 'exam', 200 questions (although backend default covers it)
            const data = await api.mockStudy.start("MIXED", "Exam", 200, 'exam');
            setMockSessionId(data.session_id);
            setMockSessionData(data);
            setView('exam-mode');
        } catch (err) {
            console.error("Failed to start exam:", err);
            alert("Failed to start exam session. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };


  // --- COMPUTED VALUES ---

  /**
   * Calculates performance statistics per domain based on current answers.
   * Memoized to avoid expensive recalculations on every render.
   */
  const domainStats: DomainStats[] = useMemo(() => {
    if (!currentCase) return [];
    
    return Object.values(DomainTag).map(tag => {
      const tagQuestions = currentCase.questions.filter(q => q.domain === tag);
      const tagAnswers = answers.filter(a => {
        const q = currentCase.questions.find(cq => cq.id === a.questionId);
        return q?.domain === tag;
      });
      const correctCount = tagAnswers.filter(a => {
        const q = currentCase.questions.find(cq => cq.id === a.questionId);
        return q?.correctLabel === a.selectedLabel;
      }).length;

      return {
        tag,
        score: correctCount,
        total: tagQuestions.length,
        weight: DOMAIN_INFO[tag].weight
      };
    });
  }, [answers, currentCase]);

  // Total correct answers count
  const totalCorrect = useMemo(() => {
    if (!currentCase) return 0;
    return answers.filter(answer => {
      const question = currentCase.questions.find(q => q.id === answer.questionId);
      return question && question.correctLabel === answer.selectedLabel;
    }).length;
  }, [answers, currentCase]);

  // Current question being displayed
  const currentQuestion = currentCase?.questions[currentQuestionIndex];


  // --- RENDER ---

    // Show generating overlay
    if (isGenerating) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="h-16 w-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Generating Magic...</h2>
                    <p className="text-gray-500 animate-pulse">Our AI is crafting a unique clinical scenario for you.</p>
                </div>
            </div>
        );
    }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('landing')}>
          <div className="bg-blue-600 text-white p-2 rounded-lg font-bold text-xl">N</div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 leading-none">NOTCE AI-Tutor</h1>
            <p className="text-xs text-gray-500 font-medium tracking-wide">2026 BLUEPRINT COMPLIANT</p>
          </div>
        </div>
        <nav className="flex items-center gap-4">
          <button onClick={logout} className="text-sm font-semibold text-gray-500 hover:text-red-500 transition">
             Logout ({user?.username})
          </button>
          
          {view !== 'landing' && (
              <>
                <button 
                    onClick={handleGenerateCase}
                    className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-md transition border border-purple-200"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    New Case
                </button>
                <div className="hidden md:block h-6 w-px bg-gray-200"></div>
                <button 
                  onClick={() => setView('study')}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-md transition ${view === 'study' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Study Mode
                </button>
                <button 
                  onClick={() => setView('dashboard')}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-md transition ${view === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Analytics
                </button>
              </>
          )}
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {view === 'landing' && (
            <MainDashboard 
                onStartCase={handleGenerateCase} 
                onResumeCase={() => setView('study')}
                hasActiveCase={!!currentCase}
                domainStats={domainStats}
                totalAnswered={answers.length}
                totalCorrect={totalCorrect}
                currentCaseId={currentCase?.id}
                onStartMockStudy={handleStartMockStudySetup}
                onResumeMockStudy={activeMockSession ? handleResumeMockStudy : undefined}
                activeMockSession={activeMockSession}
                onStartExam={handleLaunchExam}
            />
        )}
        
        <MockStudySetupModal 
            isOpen={isMockSetupOpen}
            onClose={() => setIsMockSetupOpen(false)}
            onStart={handleLaunchMockStudy}
        />

        {view === 'study' && currentCase && (
          <div className="h-full flex flex-col md:flex-row">
            {/* Desktop Left Panel: Clinical Vignette with Highlighting */}
            <section className="hidden md:block w-1/2 lg:w-2/5 h-full bg-white border-r border-gray-200 overflow-y-auto p-8">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {currentCase.setting}
                  </span>
                  <span className="text-gray-300">|</span>
                  <span className="text-sm text-gray-500 italic">Case ID: {currentCase.id}</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">{currentCase.title}</h2>
                <HighlightableText 
                  text={currentCase.vignette}
                  highlights={highlights}
                  expertHighlights={evidenceLinkResult?.expertHighlights}
                  onAddHighlight={addHighlight}
                  onRemoveHighlight={removeHighlight}
                />
                
                {/* Evidence-Link Feedback Panel */}
                {evidenceLinkResult && (
                  <div className="mt-6 p-4 bg-indigo-50 rounded-xl border border-indigo-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-2 mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <h4 className="font-bold text-indigo-800">Evidence-Link Analysis</h4>
                      <span className={`ml-auto px-2 py-1 rounded-full text-xs font-bold ${
                        evidenceLinkResult.score >= 70 ? 'bg-green-100 text-green-700' : 
                        evidenceLinkResult.score >= 40 ? 'bg-yellow-100 text-yellow-700' : 
                        'bg-red-100 text-red-700'
                      }`}>
                        {evidenceLinkResult.score}% Match
                      </span>
                    </div>
                    
                    <p className="text-indigo-700 text-sm mb-3">{evidenceLinkResult.perceptualTip}</p>
                    
                    {(evidenceLinkResult.missedIndicators?.length ?? 0) > 0 && (
                      <div className="mt-3 pt-3 border-t border-indigo-200">
                        <p className="text-xs font-bold text-indigo-600 uppercase mb-2">Missed Clinical Indicators:</p>
                        <ul className="space-y-1">
                          {(evidenceLinkResult.missedIndicators || []).slice(0, 3).map((indicator, idx) => (
                            <li key={idx} className="text-xs text-indigo-600 flex items-start gap-2">
                              <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${indicator.importance === 'critical' ? 'bg-indigo-500 text-white' : 'bg-indigo-200 text-indigo-600'}`}>
                                {idx + 1}
                              </span>
                              <span className="italic">"{(indicator.text || '').slice(0, 60)}{(indicator.text || '').length > 60 ? '...' : ''}"</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mt-12 p-4 bg-yellow-50 rounded-lg border border-yellow-100 text-xs text-yellow-800">
                  <p className="font-bold mb-1">PRO-TIP: HIGHLIGHTING</p>
                  <p>Click and drag text to highlight key clinical indicators. Your highlights will persist across all questions in this case bundle.</p>
                </div>
              </div>
            </section>

            {/* Right Panel: Questions and Interactions */}
            <section className="flex-1 h-full overflow-y-auto bg-gray-50 p-4 md:p-8">
              {!isCaseComplete ? (
                // Active Question View
                <div className="max-w-xl mx-auto space-y-6">
                  {/* Progress Indicator Steps */}
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex gap-2">
                      {currentCase.questions.map((_, i) => (
                        <div 
                          key={i} 
                          className={`h-1.5 w-8 rounded-full transition-all duration-300 ${i === currentQuestionIndex ? 'bg-blue-600' : i < currentQuestionIndex ? 'bg-green-500' : 'bg-gray-200'}`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-bold text-gray-500 uppercase">Item {currentQuestionIndex + 1} of {currentCase.questions.length}</span>
                    <button 
                        onClick={async () => {
                            if (currentCase) {
                                await api.saveSession(currentCase.id, currentQuestionIndex, isCaseComplete);
                                alert("Progress Saved!");
                            }
                        }}
                        className="text-xs font-bold text-green-600 hover:text-green-700 underline"
                    >
                        Save Progress
                    </button>
                  </div>

                  {/* AI Evolving Tip Banner */}
                  {evolvingTip && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500 bg-blue-600 text-white p-4 rounded-xl shadow-lg flex gap-3 items-start border border-blue-400">
                      <div className="bg-blue-400 p-1.5 rounded-lg text-white font-bold text-xs">AI</div>
                      <p className="text-sm italic leading-snug">{evolvingTip}</p>
                    </div>
                  )}

                  {/* Question Card */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{currentQuestion && DOMAIN_INFO[currentQuestion.domain].label}</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 leading-tight mb-8">{currentQuestion?.stem}</h3>

                    <div className="space-y-3">
                      {currentQuestion?.distractors.map((d) => (
                        <button
                          key={d.label}
                          onClick={() => setSelectedLabel(d.label)}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all group flex gap-4 items-start ${selectedLabel === d.label ? 'border-blue-600 bg-blue-50 shadow-md' : 'border-gray-100 hover:border-blue-200 hover:bg-gray-50'}`}
                        >
                          <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition ${selectedLabel === d.label ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-400 group-hover:border-blue-400 group-hover:text-blue-600'}`}>
                            {d.label}
                          </span>
                          <span className={`text-base font-medium ${selectedLabel === d.label ? 'text-blue-900' : 'text-gray-700'}`}>{d.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Confidence Selection */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-sm font-bold text-gray-500 mb-4 uppercase text-center tracking-widest">Confidence Level</p>
                    <div className="flex gap-4">
                      {[ConfidenceLevel.LOW, ConfidenceLevel.MED, ConfidenceLevel.HIGH].map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() => setSelectedConfidence(lvl)}
                          className={`flex-1 py-3 px-2 rounded-xl border-2 font-bold text-xs uppercase tracking-widest transition-all ${selectedConfidence === lvl ? 'bg-gray-900 border-gray-900 text-white shadow-lg transform -translate-y-1' : 'border-gray-100 text-gray-400 hover:border-gray-200'}`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    disabled={!selectedLabel || !selectedConfidence || isSubmitting}
                    onClick={handleNext}
                    className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex justify-center items-center gap-2"
                  >
                    {isSubmitting ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Analyzing...</span>
                        </>
                    ) : (
                        currentQuestionIndex === currentCase.questions.length - 1 ? 'Finish Case Bundle' : 'Submit & Continue'
                    )}
                  </button>

                  <div className="flex justify-center pt-4">
                    <button className="text-gray-400 text-xs font-bold uppercase tracking-widest hover:text-blue-600 transition">Flag Item for Review</button>
                  </div>
                </div>
              ) : (
                // Case Complete / Summary View
                <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 text-green-600 rounded-full mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900">Case Complete</h2>
                    <p className="text-gray-500">You've finished the "{currentCase.title}" bundle. Review your rationales below.</p>
                  </div>

                  <div className="space-y-6">
                    {currentCase.questions.map((q, idx) => {
                      const ans = answers.find(a => a.questionId === q.id);
                      const isCorrect = ans?.selectedLabel === q.correctLabel;
                      return (
                        <div key={q.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                          <div className={`p-4 flex items-center justify-between ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                            <span className="font-bold text-sm">Question {idx + 1}</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                              {isCorrect ? 'Correct' : 'Incorrect'}
                            </span>
                          </div>
                          <div className="p-6 space-y-4">
                            <p className="font-bold text-gray-800">{q.stem}</p>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-gray-400 uppercase font-bold mb-1">Your Answer</p>
                                <p className="font-bold text-gray-700">{ans?.selectedLabel}: {q.distractors.find(d => d.label === ans?.selectedLabel)?.text}</p>
                              </div>
                              <div className="bg-blue-50 p-3 rounded-lg">
                                <p className="text-blue-400 uppercase font-bold mb-1">Correct Answer</p>
                                <p className="font-bold text-blue-700">{q.correctLabel}: {q.distractors.find(d => d.label === q.correctLabel)?.text}</p>
                              </div>
                            </div>
                            <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                              <h4 className="text-sm font-bold text-green-800 mb-2">Rationale</h4>
                              <p className="text-sm text-green-700 leading-relaxed">{q.correctRationale}</p>
                            </div>
                            {!isCorrect && q.distractors.find(d => d.label === ans?.selectedLabel)?.incorrect_rationale && (
                                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                    <h4 className="text-sm font-bold text-red-800 mb-2">Why Your Choice was Incorrect</h4>
                                    <p className="text-sm text-red-700 leading-relaxed">
                                        {q.distractors.find(d => d.label === ans?.selectedLabel)?.incorrect_rationale}
                                    </p>
                                </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-4">
                    <button onClick={resetCase} className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition">Restart Case</button>
                    <button onClick={() => setView('dashboard')} className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">View Analytics</button>
                    {/* Return to Dashboard */}
                    <button onClick={() => setView('landing')} className="flex-1 py-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition">Home</button>
                  </div>
                </div>
              )}
            </section>

            {/* Mobile Sheet for Vignette (Responsive) */}
            <div className={`md:hidden fixed inset-x-0 bottom-0 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] rounded-t-[32px] transition-transform duration-500 z-40 ${isMobileVignetteOpen ? 'translate-y-0 h-[80vh]' : 'translate-y-[calc(100%-64px)] h-[80vh]'}`}>
              {/* Handle */}
              <div 
                className="w-full h-16 flex flex-col items-center justify-center cursor-pointer touch-none"
                onClick={() => setIsMobileVignetteOpen(!isMobileVignetteOpen)}
              >
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-3" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">{isMobileVignetteOpen ? 'Swipe Down to Close' : 'Swipe Up for Vignette'}</span>
              </div>
              <div className="px-6 pb-8 overflow-y-auto h-[calc(80vh-64px)]">
                <h2 className="text-xl font-bold mb-4">{currentCase.title}</h2>
                <HighlightableText 
                  text={currentCase.vignette}
                  highlights={highlights}
                  onAddHighlight={addHighlight}
                  onRemoveHighlight={removeHighlight}
                />
              </div>
            </div>
          </div>
        )}

        {view === 'dashboard' && (
          // Dashboard Analysis View
          <div className="h-full overflow-y-auto p-4 md:p-12 bg-gray-50">
            <div className="max-w-4xl mx-auto space-y-12">
              <Dashboard stats={domainStats} />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">AI Validation Status</h4>
                  {validationResult?.valid ? (
                    <div className="flex items-center gap-2 text-green-600 font-bold text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {validationResult.message}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {validationResult?.message}
                    </div>
                  )}
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Next SRS Session</h4>
                  <p className="text-gray-900 font-bold">48h from now</p>
                  <p className="text-xs text-gray-500 mt-1">Focusing on {answers.filter(a => a.confidence === ConfidenceLevel.LOW).length} Low Confidence items.</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Logic Path</h4>
                  <p className="text-gray-900 font-bold">{answers.filter(a => a.selectedLabel === currentCase.questions.find(q => q.id === a.questionId)?.correctLabel).length / (answers.length || 1) > 0.7 ? 'Competent Path' : 'Drifting'}</p>
                  <p className="text-xs text-gray-500 mt-1">Your clinical reasoning is evolving.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'mock-study' && mockSessionId && mockSessionData && (
            <MockStudySession 
                sessionId={mockSessionId}
                initialData={mockSessionData}
                onExit={async () => {
                    setView('landing');
                    setMockSessionId(null);
                    setMockSessionData(null);
                    // Refresh active session status
                    const session = await api.mockStudy.getActiveSession();
                    setActiveMockSession(session);
                }}
            />
        )}

        {view === 'exam-mode' && mockSessionId && mockSessionData && (
            <ExamSession 
                sessionId={mockSessionId}
                initialData={mockSessionData}
                onExit={() => setView('landing')}
            />
        )}

        {view === 'payment-success' && (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-4">Payment Successful!</h2>
                <p className="text-gray-600 mb-8 max-w-md">Thank you for your purchase. Your account has been upgraded and you now have full access to all features.</p>
                <button onClick={() => setView('landing')} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition">Go to Dashboard</button>
            </div>
        )}

        {view === 'payment-cancel' && (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-4">Payment Cancelled</h2>
                <p className="text-gray-600 mb-8 max-w-md">The payment process was cancelled. No charges were made.</p>
                <button onClick={() => setView('landing')} className="px-8 py-4 bg-gray-200 text-gray-700 rounded-2xl font-bold hover:bg-gray-300 transition">Return Home</button>
            </div>
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => {
    const { isAuthenticated } = useAuth();
    const [authView, setAuthView] = useState<'landing' | 'login' | 'register'>('landing');
    const [pendingPlan, setPendingPlan] = useState<string | null>(null);

    const handleSelectPlan = async (tier: string) => {
        if (isAuthenticated) {
            try {
                const { url } = await api.createCheckoutSession(tier);
                window.location.href = url;
            } catch (err) {
                console.error("Checkout failed:", err);
                alert("Failed to initiate checkout. Please try again.");
            }
        } else {
            setPendingPlan(tier);
            setAuthView('register');
        }
    };

    useEffect(() => {
        if (isAuthenticated && pendingPlan) {
            const tier = pendingPlan;
            setPendingPlan(null);
            handleSelectPlan(tier);
        }
    }, [isAuthenticated, pendingPlan]);

    if (isAuthenticated) {
        return <MainApp />;
    }

    if (authView === 'landing') {
        return (
            <LandingPage 
                onStart={() => setAuthView('register')}
                onLogin={() => setAuthView('login')}
                onRegister={() => setAuthView('register')}
                onSelectPlan={handleSelectPlan}
            />
        );
    }

    return authView === 'login' 
        ? <LoginPage onSwitch={() => setAuthView('register')} /> 
        : <RegisterPage onSwitch={() => setAuthView('login')} />;
};

export default function AppWrapper() {
    return (
        <AuthProvider>
            <App />
        </AuthProvider>
    );
}

// Modify MainApp to import correct things if needed, but it's in same file.
