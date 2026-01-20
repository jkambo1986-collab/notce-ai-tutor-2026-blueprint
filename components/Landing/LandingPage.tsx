import React from 'react';

interface LandingPageProps {
    onStart: () => void;
    onLogin: () => void;
    onRegister: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart, onLogin, onRegister }) => {
    return (
        <div className="min-h-screen bg-[#0F172A] text-white selection:bg-cyan-500/30">
            {/* Animated Background Blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0F172A]/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-indigo-600 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-cyan-500/20">
                            N
                        </div>
                        <div>
                            <span className="font-bold text-xl tracking-tight">NOTCE <span className="text-cyan-400">AI-Tutor</span></span>
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">2026 Blueprint</div>
                        </div>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Features</a>
                        <a href="#about" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">About</a>
                        <div className="h-4 w-px bg-white/10" />
                        <button onClick={onLogin} className="text-sm font-bold text-gray-300 hover:text-white transition-colors">Login</button>
                        <button 
                            onClick={onRegister}
                            className="px-6 py-2.5 bg-white text-[#0F172A] rounded-full font-bold text-sm hover:bg-cyan-400 transition-all active:scale-95 shadow-lg shadow-white/5"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-40 pb-20 px-6">
                <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-cyan-400 mb-8 animate-fade-in">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                        </span>
                        NEW: 2026 AI-MODELS INTEGRATED
                    </div>
                    
                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-8 leading-[1.1]">
                        Master the NOTCE <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600">
                            with Precision AI.
                        </span>
                    </h1>
                    
                    <p className="max-w-2xl text-lg md:text-xl text-gray-400 leading-relaxed mb-12">
                        The world's most advanced AI-powered tutor for Occupational Therapists. 
                        Interactive case studies, adaptive clinical reasoning, and real-time exam simulations.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button 
                            onClick={onRegister}
                            className="px-10 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl font-extrabold text-lg hover:shadow-[0_0_40px_rgba(6,182,212,0.3)] transition-all active:scale-95"
                        >
                            Start Studying Free
                        </button>
                        <button 
                            onClick={onLogin}
                            className="px-10 py-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-extrabold text-lg transition-all"
                        >
                            View Demo
                        </button>
                    </div>

                    {/* Dashboard Preview Mockup */}
                    <div className="mt-24 relative w-full max-w-5xl group">
                        <div className="absolute inset-0 bg-cyan-500/20 blur-[100px] group-hover:bg-cyan-500/30 transition-all" />
                        <div className="relative bg-[#1E293B] rounded-3xl border border-white/10 shadow-2xl overflow-hidden aspect-video">
                            {/* Mock UI window elements */}
                            <div className="h-10 bg-black/20 flex items-center px-4 gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                                <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                                <div className="w-3 h-3 rounded-full bg-green-500/50" />
                            </div>
                            <div className="p-8 flex gap-8 h-full">
                                <div className="w-1/4 space-y-4">
                                    <div className="h-8 w-full bg-white/5 rounded-lg" />
                                    <div className="h-8 w-full bg-white/5 rounded-lg" />
                                    <div className="h-8 w-full bg-cyan-500/20 rounded-lg" />
                                    <div className="h-8 w-full bg-white/5 rounded-lg" />
                                </div>
                                <div className="flex-1 space-y-6">
                                    <div className="h-40 w-full bg-white/5 rounded-2xl animate-pulse" />
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="h-32 bg-white/5 rounded-2xl" />
                                        <div className="h-32 bg-white/5 rounded-2xl" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-32 px-6 bg-[#0B1120]">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-4xl md:text-5xl font-black mb-6">Built for OT Excellence.</h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">
                            Everything you need to pass the NOTCE on your first attempt, powered by the latest clinical reasoning models.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-cyan-500/50 transition-all hover:translate-y-[-8px] group">
                            <div className="w-14 h-14 bg-cyan-500/20 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                                <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </div>
                            <h3 className="text-2xl font-bold mb-4">Adaptive Mock Session</h3>
                            <p className="text-gray-400 leading-relaxed">
                                Our AI detects your weak areas in real-time and pivoits the case study to challenge your reasoning where it matters most.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-blue-500/50 transition-all hover:translate-y-[-8px] group">
                            <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            </div>
                            <h3 className="text-2xl font-bold mb-4">Real-Time Analytics</h3>
                            <p className="text-gray-400 leading-relaxed">
                                Detailed clinical reasoning heatmaps and confidence-weighted statistics to track your mastery across the 2026 blueprint.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-indigo-500/50 transition-all hover:translate-y-[-8px] group">
                            <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                                <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                            </div>
                            <h3 className="text-2xl font-bold mb-4">Exam Mode Simulation</h3>
                            <p className="text-gray-400 leading-relaxed">
                                Practice under pressure with 1:1 exam timing and question distribution exactly like the official NBCOT examination.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-20 px-6 border-t border-white/5">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center font-black text-sm">N</div>
                        <span className="font-bold text-gray-400 tracking-tight">NOTCE AI-Tutor</span>
                    </div>
                    <div className="flex gap-8 text-sm text-gray-500 font-medium">
                        <a href="#" className="hover:text-white transition-colors">Privacy</a>
                        <a href="#" className="hover:text-white transition-colors">Terms</a>
                        <a href="#" className="hover:text-white transition-colors">Contact</a>
                    </div>
                    <p className="text-gray-600 text-xs">© 2026 Advanced OT Education. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
