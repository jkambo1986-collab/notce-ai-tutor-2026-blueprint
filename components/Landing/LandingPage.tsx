import React from 'react';

interface LandingPageProps {
    onStart: () => void;
    onLogin: () => void;
    onRegister: () => void;
    onSelectPlan?: (tier: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart, onLogin, onRegister, onSelectPlan }) => {
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
                        <a href="#pricing" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Pricing</a>
                        <div className="h-4 w-px bg-white/10" />
                        <button onClick={onLogin} className="text-sm font-bold text-gray-300 hover:text-white transition-colors">Login</button>
                        <button 
                            onClick={onRegister}
                            className="px-6 py-2.5 bg-cyan-500 text-[#0F172A] rounded-full font-bold text-sm hover:bg-cyan-400 transition-all active:scale-95 shadow-lg shadow-cyan-500/20"
                        >
                            Join Now
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
                        The Blueprint is <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-orange-500 to-amber-500">
                            Changing Forever.
                        </span>
                    </h1>
                    
                    <p className="max-w-2xl text-lg md:text-xl text-gray-400 leading-relaxed mb-12">
                        Writing in April? This is your last chance before the NOTCE exam changes to the 2021 Competencies. 
                        Don't risk studying the wrong material. Master the <span className="text-white font-bold">Legacy Standards</span> before it's too late.
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
                        <div className="absolute inset-0 bg-cyan-500/30 blur-[120px] group-hover:bg-cyan-500/40 transition-all" />
                        <div className="relative bg-[#1E293B] rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden aspect-video">
                            {/* Browser Header */}
                            <div className="h-10 bg-black/40 flex items-center px-6 gap-2 border-b border-white/5 relative z-10">
                                <div className="w-3 h-3 rounded-full bg-red-500/30" />
                                <div className="w-3 h-3 rounded-full bg-amber-500/30" />
                                <div className="w-3 h-3 rounded-full bg-green-500/30" />
                                <div className="ml-4 h-5 w-48 bg-white/5 rounded-full flex items-center px-3">
                                    <div className="w-2 h-2 rounded-full bg-cyan-500/50 mr-2" />
                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">notce-ai.app/dashboard</div>
                                </div>
                            </div>
                            
                            {/* High-Fidelity App UI Preivew */}
                            <img 
                                src="/dashboard-preview.png" 
                                alt="NOTCE AI-Tutor Dashboard" 
                                className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-700"
                            />

                            {/* Overlay Gradient for depth */}
                            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0F172A]/40 to-transparent" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Convenience Hook Section */}
            <section id="features" className="py-24 px-6 relative overflow-hidden">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
                    <div className="flex-1">
                        <h2 className="text-4xl font-black mb-6 leading-tight">
                            Stop Struggling with <br />
                            <span className="text-red-400">LockLizard.</span>
                        </h2>
                        <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                            The official CAOT guide locks you to a single device. Our platform works wherever you are. Study on the bus, in the clinic, or even on your phone in bed. 
                            <span className="text-cyan-400 block mt-4 font-bold">No restrictions. No limits. Just mastery.</span>
                        </p>
                        <ul className="space-y-4">
                            {[
                                "Unlimited Device Switching",
                                "Mobile-First Interactive UI",
                                "Offline Progress Syncing",
                                "Cloud-Based Rationale Engine"
                            ].map((item) => (
                                <li key={item} className="flex items-center gap-3 text-gray-200">
                                    <div className="w-5 h-5 bg-cyan-500/20 rounded-full flex items-center justify-center">
                                        <svg className="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="flex-1 relative">
                        <div className="absolute inset-0 bg-blue-600/20 blur-[100px]" />
                        <div className="relative bg-white/5 border border-white/10 p-4 rounded-[2.5rem] shadow-2xl rotate-3">
                             <div className="bg-[#0F172A] rounded-[2rem] p-6 space-y-4 border border-white/5">
                                <div className="h-4 w-1/2 bg-white/10 rounded" />
                                <div className="h-32 w-full bg-cyan-500/10 rounded-xl" />
                                <div className="space-y-2">
                                    <div className="h-3 w-full bg-white/5 rounded" />
                                    <div className="h-3 w-4/5 bg-white/5 rounded" />
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-32 px-6 bg-[#0B1120] relative">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-4xl md:text-5xl font-black mb-6">Choose Your Path to Passing.</h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">
                            Cheaper than failing and paying $755 to re-write. Invest in your career today.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Tier 1: The Crammer */}
                        <div className="relative p-8 rounded-3xl bg-white/5 border border-white/10 flex flex-col">
                            <h3 className="text-xl font-bold mb-2">The Crammer</h3>
                            <div className="flex items-baseline gap-1 mb-6">
                                <span className="text-4xl font-black">$69</span>
                                <span className="text-gray-500 text-sm">CAD / one-time</span>
                            </div>
                            <p className="text-sm text-gray-400 mb-8 italic">Target: April 2026 Writers</p>
                            <ul className="space-y-4 mb-10 flex-1">
                                {[
                                    "200+ Practice Questions",
                                    "Legacy Blueprint Focus",
                                    "Mobile-Friendly (No LockLizard)",
                                    "Valid until April 9, 2026"
                                ].map(item => (
                                    <li key={item} className="flex gap-3 text-sm text-gray-300">
                                        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <button onClick={() => onSelectPlan?.('crammer')} className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-bold transition-all">Buy Now</button>
                        </div>

                        {/* Tier 2: The Guarantee */}
                        <div className="relative p-8 rounded-3xl bg-gradient-to-b from-cyan-500/10 to-transparent border-2 border-cyan-500/50 flex flex-col scale-105 shadow-2xl shadow-cyan-500/10 transform">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 bg-cyan-500 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg">Most Popular</div>
                            <h3 className="text-xl font-bold mb-2 text-cyan-400">The Guarantee</h3>
                            <div className="flex items-baseline gap-1 mb-6">
                                <span className="text-4xl font-black text-white">$99</span>
                                <span className="text-gray-400 text-sm">CAD / one-time</span>
                            </div>
                            <p className="text-sm text-cyan-500/70 mb-8 font-bold">"Blueprint Insurance"</p>
                            <ul className="space-y-4 mb-10 flex-1">
                                {[
                                    "Everything in Crammer",
                                    "Lifetime Access",
                                    "FREE Sept 2026 Update if you fail",
                                    "Personalized Risk Analysis"
                                ].map(item => (
                                    <li key={item} className="flex gap-3 text-sm text-white font-medium">
                                        <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <button onClick={() => onSelectPlan?.('guarantee')} className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-[#0F172A] rounded-2xl font-black text-lg transition-all shadow-lg shadow-cyan-500/30 active:scale-95">Pass Guaranteed</button>
                        </div>

                        {/* Tier 3: The Early Bird */}
                        <div className="relative p-8 rounded-3xl bg-white/5 border border-white/10 flex flex-col">
                            <h3 className="text-xl font-bold mb-2">The Beta Bird</h3>
                            <div className="flex items-baseline gap-1 mb-6">
                                <span className="text-4xl font-black">$49</span>
                                <span className="text-gray-500 text-sm">CAD / month</span>
                            </div>
                            <p className="text-sm text-gray-400 mb-8 italic">Target: Sept 2026 Writers</p>
                            <ul className="space-y-4 mb-10 flex-1">
                                {[
                                    "Full New-Comp Content",
                                    "Active Beta Testing Rights",
                                    "Adaptive SRS Engine",
                                    "Priority Feature Requests"
                                ].map(item => (
                                    <li key={item} className="flex gap-3 text-sm text-gray-300">
                                        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <button onClick={() => onSelectPlan?.('beta')} className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-bold transition-all">Pre-Order Now</button>
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
