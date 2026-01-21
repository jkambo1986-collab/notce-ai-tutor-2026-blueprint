import React, { useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { DomainStats } from '../types';
import CaseGeneratorModal from './CaseGeneratorModal';
import AnalyticsModal from './AnalyticsModal';
import SavedProgressModal from './SavedProgressModal';

interface MainDashboardProps {
    onStartCase: (domain: string, difficulty: string) => Promise<void>;
    onResumeCase?: (caseId?: string) => void;
    hasActiveCase: boolean;
    domainStats?: DomainStats[];
    totalAnswered?: number;
    totalCorrect?: number;
    totalCorrect?: number;
    currentCaseId?: string;
    onStartMockStudy?: () => void;
    onResumeMockStudy?: () => void;
    onStartExam?: () => void;
}

const MainDashboard: React.FC<MainDashboardProps> = ({ 
    onStartCase, 
    onResumeCase, 
    hasActiveCase,
    domainStats = [],
    totalAnswered = 0,
    totalCorrect = 0,
    currentCaseId,
    onStartMockStudy,
    onResumeMockStudy,
    onStartExam
}) => {
    const { user, refreshProfile } = useAuth();
    const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
    const [isProgressOpen, setIsProgressOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    React.useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('success') === 'true') {
            const sync = async () => {
                setIsSyncing(true);
                try {
                    await api.syncPayment();
                    await refreshProfile();
                    // Clean URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                } catch (err) {
                    console.error("Sync failed:", err);
                } finally {
                    setIsSyncing(false);
                }
            };
            sync();
        }
    }, [refreshProfile]);

    const handleUpgrade = async () => {
        try {
            // Using 'guarantee' tier for the upgrade button
            const { url } = await api.createCheckoutSession('guarantee');
            window.location.href = url;
        } catch (err) {
            console.error("Upgrade failed:", err);
            alert("Failed to start upgrade process. Please try again.");
        }
    };

    const profile = user?.userprofile;
    const isPaid = profile?.is_paid;
    const isTrial = profile?.is_trial_active;
    const trialEndDate = profile?.trial_end_date ? new Date(profile.trial_end_date) : null;
    const daysRemaining = trialEndDate ? Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Trial Banner */}
                {isTrial && !isPaid && (
                     <div className="bg-indigo-600 rounded-2xl p-4 shadow-lg flex items-center justify-between text-white animate-pulse">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                                <h3 className="font-bold">7-Day Free Trial Active</h3>
                                <p className="text-indigo-100 text-sm">{daysRemaining} days remaining of full premium access.</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleUpgrade}
                            className="px-4 py-2 bg-white text-indigo-600 font-bold rounded-lg text-sm hover:bg-indigo-50 transition"
                        >
                            Lock in Access
                        </button>
                    </div>
                )}

                {/* Header Section */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
                            Welcome back, <span className="text-blue-600">{user?.username}</span>!
                        </h1>
                        <p className="text-gray-500 text-lg">
                            {isPaid ? 'Premium Member' : isTrial ? 'Trial Member' : 'Free Member'} • Ready to master your clinical reasoning?
                        </p>
                    </div>
                    <div className="flex gap-4">
                        {hasActiveCase && onResumeCase && (
                            <button 
                                onClick={() => onResumeCase()}
                                className="px-6 py-3 bg-white border-2 border-green-500 text-green-700 rounded-xl font-bold hover:bg-green-50 transition shadow-sm"
                            >
                                Resume Session
                            </button>
                        )}
                        <button 
                            onClick={() => setIsGeneratorOpen(true)}
                            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition shadow-lg shadow-indigo-200 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Generate New Case
                        </button>
                    </div>
                </div>

                {/* Quick Stats / Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* AI-Powered Cases Card */}
                    <button 
                        onClick={() => setIsGeneratorOpen(true)}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-left hover:shadow-lg hover:border-purple-200 transition-all group cursor-pointer"
                    >
                        <div className="h-12 w-12 bg-gradient-to-br from-purple-100 to-indigo-100 text-purple-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg group-hover:text-purple-700 transition">AI-Powered Cases</h3>
                        <p className="text-gray-500 text-sm mt-2">Generate infinite scenarios tailored to the 2026 NOTCE blueprint.</p>
                        <div className="mt-4 text-purple-600 text-sm font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <span>Create Now</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </button>
                    
                    {/* Performance Analytics Card */}
                    <button 
                        onClick={() => setIsAnalyticsOpen(true)}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-left hover:shadow-lg hover:border-blue-200 transition-all group cursor-pointer"
                    >
                        <div className="h-12 w-12 bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg group-hover:text-blue-700 transition">Performance Analytics</h3>
                        <p className="text-gray-500 text-sm mt-2">Track your competence across all 6 OT practice domains in real-time.</p>
                        <div className="mt-4 text-blue-600 text-sm font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <span>View Stats</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </button>
                    
                    {/* Saved Progress Card */}
                    <button 
                        onClick={() => setIsProgressOpen(true)}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-left hover:shadow-lg hover:border-green-200 transition-all group cursor-pointer"
                    >
                        <div className="h-12 w-12 bg-gradient-to-br from-green-100 to-emerald-100 text-green-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg group-hover:text-green-700 transition">Saved Progress</h3>
                        <p className="text-gray-500 text-sm mt-2">Resume exactly where you left off. Your clinical reasoning journey is safe.</p>
                        <div className="mt-4 text-green-600 text-sm font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <span>View Sessions</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </button>
                </div>

                <div className={`bg-gradient-to-r from-teal-50 to-emerald-50 rounded-3xl p-8 border border-teal-100 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group ${!isPaid && !isTrial ? 'cursor-not-allowed' : ''}`}>
                     {/* Decorative Elements */}
                     <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-teal-200 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
                     <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-cyan-200 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
                     
                     {/* Locked Overlay */}
                     {!isPaid && (
                         <div className="absolute inset-0 bg-white/80 backdrop-blur-md z-40 flex items-center justify-center">
                             <div className="bg-white p-8 rounded-3xl shadow-2xl border border-teal-100 flex flex-col items-center text-center max-w-sm animate-in zoom-in-95 duration-300">
                                 <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mb-4">
                                     <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                 </div>
                                 <h4 className="text-xl font-bold text-gray-900 mb-2">Premium Drill Mode</h4>
                                 <p className="text-sm text-gray-500 mb-6">Adaptive Mock Study is reserved for Premium Members only. Unlock your path to mastery.</p>
                                 <button onClick={handleUpgrade} className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold text-base hover:bg-teal-700 transition shadow-lg shadow-teal-100 transform active:scale-95">Upgrade to Unlock</button>
                             </div>
                         </div>
                     )}

                     <div className="z-10 flex-1">
                        <div className="flex items-center gap-3 mb-3">
                             <span className="px-3 py-1 bg-teal-200 text-teal-800 text-xs font-bold rounded-full uppercase tracking-wider">New</span>
                             <h2 className="text-2xl font-black text-gray-900">Adaptive Mock Study</h2>
                        </div>
                        <p className="text-gray-600 text-lg leading-relaxed max-w-2xl">
                            Practice with AI-generated questions one-by-one. Select your specific domain weak spots and get instant, deep-dive feedback on every answer.
                        </p>
                        
                        <div className="mt-6 flex flex-wrap gap-3">
                            {['OT Expertise', 'Ethics', 'Clinical Reasoning'].map(tag => (
                                <span key={tag} className="px-3 py-1 bg-white/60 text-teal-700 text-xs font-bold rounded-lg border border-teal-100">
                                    {tag}
                                </span>
                            ))}
                        </div>
                     </div>
                     
                     <div className="z-10 flex flex-col gap-3">
                        <button 
                            onClick={() => isPaid && onStartMockStudy?.()} 
                            disabled={!isPaid}
                            className="px-8 py-4 bg-teal-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-teal-200 hover:bg-teal-700 hover:scale-105 transition-all flex items-center gap-3 whitespace-nowrap justify-center w-48 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span>Start Drill</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </button>

                        {/* Resume Button */}
                        {onResumeMockStudy && (
                            <button 
                                onClick={() => isPaid && onResumeMockStudy()}
                                disabled={!isPaid}
                                className="px-8 py-3 bg-white text-teal-700 rounded-xl font-bold text-base border-2 border-teal-200 hover:bg-teal-50 hover:border-teal-300 transition-all flex items-center gap-2 whitespace-nowrap justify-center w-48 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span>Resume</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </button>
                        )}
                     </div>
                </div>

                {/* Exam Simulation Feature */}
                <div className={`bg-gray-900 rounded-3xl p-8 border border-gray-800 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group ${!isPaid ? 'cursor-not-allowed' : ''}`}>
                     {/* Decorative Elements */}
                     <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-900 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
                     
                     {/* Locked Overlay */}
                     {!isPaid && (
                         <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-40 flex items-center justify-center">
                             <div className="bg-gray-800 p-8 rounded-3xl shadow-2xl border border-gray-700 flex flex-col items-center text-center max-w-sm animate-in zoom-in-95 duration-300">
                                 <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mb-4">
                                     <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                 </div>
                                 <h4 className="text-xl font-bold text-white mb-2">Full Simulation</h4>
                                 <p className="text-sm text-gray-400 mb-6">Complete exam simulation is restricted to Premium Members. Experience the real deal.</p>
                                 <button onClick={handleUpgrade} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-base hover:bg-indigo-700 transition shadow-lg shadow-indigo-900/50 transform active:scale-95">Unlock Now</button>
                             </div>
                         </div>
                     )}

                     <div className="z-10 flex-1">
                        <div className="flex items-center gap-3 mb-3">
                             <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full uppercase tracking-wider">Timed</span>
                             <h2 className="text-2xl font-black text-white">Full Exam Simulation</h2>
                        </div>
                        <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
                            The real deal. 200 questions. 4 hours. No immediate feedback. Simulate the pressure regardless of the outcome.
                        </p>
                        
                        <div className="mt-6 flex flex-wrap gap-3">
                            <span className="px-3 py-1 bg-gray-800 text-gray-300 text-xs font-bold rounded-lg border border-gray-700">
                                4 Hours
                            </span>
                             <span className="px-3 py-1 bg-gray-800 text-gray-300 text-xs font-bold rounded-lg border border-gray-700">
                                200 Questions
                            </span>
                             <span className="px-3 py-1 bg-gray-800 text-gray-300 text-xs font-bold rounded-lg border border-gray-700">
                                Book 1 & 2
                            </span>
                        </div>
                     </div>
                     
                     <div className="z-10">
                        <button 
                            onClick={() => isPaid && onStartExam?.()} 
                            disabled={!isPaid}
                            className="px-8 py-4 bg-white text-gray-900 rounded-2xl font-bold text-lg shadow-xl hover:bg-gray-100 hover:scale-105 transition-all flex items-center gap-3 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span>Start Exam</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                     </div>
                </div>
                
                {/* Blueprint Compliance Badge */}
                <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-2xl p-6 border border-indigo-100 flex items-center gap-4">
                    <div className="w-14 h-14 bg-white rounded-xl shadow flex items-center justify-center">
                        <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                    </div>
                    <div>
                        <h4 className="font-bold text-indigo-800">2026 NOTCE Blueprint Aligned</h4>
                        <p className="text-indigo-600 text-sm">All cases are generated according to the latest NBCOT exam specifications.</p>
                    </div>
                </div>
            </div>

            {/* UPGRADE BANNER - Only show for free users not on trial */}
            {!isPaid && !isTrial && (
                <div className="max-w-5xl mx-auto mt-8 bg-gradient-to-r from-amber-200 to-yellow-400 rounded-2xl p-6 shadow-lg flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-white p-3 rounded-xl shadow-sm text-yellow-600">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-amber-900">Unlock Full Access</h3>
                            <p className="text-amber-800 font-medium">Get the "Pass Guarantee" with unlimited detailed rationales.</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleUpgrade}
                        className="px-6 py-3 bg-white text-amber-600 font-bold rounded-xl shadow hover:bg-amber-50 transition transform hover:scale-105"
                    >
                        Upgrade Now
                    </button>
                </div>
            )}

            {/* Modals */}
            <CaseGeneratorModal
                isOpen={isGeneratorOpen}
                onClose={() => setIsGeneratorOpen(false)}
                onGenerate={onStartCase}
            />
            
            <AnalyticsModal
                isOpen={isAnalyticsOpen}
                onClose={() => setIsAnalyticsOpen(false)}
                domainStats={domainStats}
                totalAnswered={totalAnswered}
                totalCorrect={totalCorrect}
            />
            
            <SavedProgressModal
                isOpen={isProgressOpen}
                onClose={() => setIsProgressOpen(false)}
                onResumeSession={(caseId) => onResumeCase?.(caseId)}
                currentCaseId={currentCaseId}
            />

            {/* Mock Study Components will be lifted to App.tsx for session state, but entry point is here */}
        </div>
    );
};

export default MainDashboard;
