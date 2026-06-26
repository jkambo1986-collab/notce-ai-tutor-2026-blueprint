import React from 'react';

/**
 * Props for LandingPage.
 *
 * @property onStart      - Generic "get started" entry point.
 * @property onLogin      - Navigate to the login screen (navbar "Login").
 * @property onRegister   - Navigate to the sign-up screen (CTAs / "Join Now").
 * @property onSelectPlan - Optional; retained for when self-serve pricing is
 *                          re-enabled. The marketing page no longer renders
 *                          pricing (checkout is gated by PAYMENTS_ENABLED), so
 *                          this is currently unused here.
 */
interface LandingPageProps {
    onStart: () => void;
    onLogin: () => void;
    onRegister: () => void;
    onSelectPlan?: (tier: string) => void;
}

/** Small inline icon: renders a single stroked path. */
const Icon: React.FC<{ path: string; className?: string }> = ({ path, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || 'w-6 h-6'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
);

const ICONS = {
    check: 'M5 13l4 4L19 7',
    bank: 'M5 13l4 4L19 7',
    target: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    refresh: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    bulb: 'M9.663 17h4.673M12 3v1m0 13a4 4 0 002-7.464A4 4 0 1010 9.536',
    calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    users: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8zm6 0a4 4 0 10-3-7.75',
    bolt: 'M13 10V3L4 14h7v7l9-11h-7z',
    device: 'M9 17H7A2 2 0 015 15V5a2 2 0 012-2h10a2 2 0 012 2v2M9 21h10a2 2 0 002-2v-7a2 2 0 00-2-2H9a2 2 0 00-2 2v7a2 2 0 002 2z',
    shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
};

/** A reusable feature card for the features grid. */
const Feature: React.FC<{ icon: string; title: string; body: string }> = ({ icon, title, body }) => (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-cyan-500/40 hover:bg-white/[0.07] transition-all">
        <div className="w-11 h-11 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center mb-4">
            <Icon path={icon} className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-lg text-white mb-1.5">{title}</h3>
        <p className="text-sm text-gray-400 leading-relaxed">{body}</p>
    </div>
);

/**
 * LandingPage
 *
 * Product-led marketing/home page: hero, stats, feature grid, how-it-works,
 * differentiators, a B2B (schools) section, FAQ, and a closing CTA. Purely
 * presentational — navigation is delegated to the callbacks via props, and the
 * legal/contact links are plain routes.
 */
const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onRegister }) => {
    const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

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
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-indigo-600 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-cyan-500/20">N</div>
                        <div>
                            <span className="font-bold text-xl tracking-tight">NOTCE <span className="text-cyan-400">AI-Tutor</span></span>
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">2026 Blueprint</div>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center gap-8">
                        <button onClick={() => scrollTo('features')} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Features</button>
                        <button onClick={() => scrollTo('how')} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">How it works</button>
                        <button onClick={() => scrollTo('schools')} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">For schools</button>
                        <button onClick={() => scrollTo('faq')} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">FAQ</button>
                        <div className="h-4 w-px bg-white/10" />
                        <button onClick={onLogin} className="text-sm font-bold text-gray-300 hover:text-white transition-colors">Login</button>
                        <button onClick={onRegister} className="px-6 py-2.5 bg-cyan-500 text-[#0F172A] rounded-full font-bold text-sm hover:bg-cyan-400 transition-all active:scale-95 shadow-lg shadow-cyan-500/20">Start free</button>
                    </div>
                </div>
            </nav>

            {/* Hero — product-led */}
            <section className="relative pt-40 pb-20 px-6">
                <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-cyan-400 mb-8">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                        </span>
                        Built for the Canadian NOTCE · 2026 Blueprint
                    </div>

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-8 leading-[1.05]">
                        Walk into the NOTCE<br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400">actually ready.</span>
                    </h1>

                    <p className="max-w-2xl text-lg md:text-xl text-gray-400 leading-relaxed mb-10">
                        AI-powered prep for the Canadian occupational therapy licensing exam: an
                        <span className="text-white font-semibold"> independently-vetted question bank</span>, full exam simulations,
                        spaced-repetition review, and a <span className="text-white font-semibold">readiness score</span> that tells you
                        exactly where you stand — aligned to the 2026 Blueprint (Competencies for Occupational Therapists in Canada, 2021).
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <button onClick={onRegister} className="px-10 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl font-extrabold text-lg hover:shadow-[0_0_40px_rgba(6,182,212,0.3)] transition-all active:scale-95">
                            Start studying free
                        </button>
                        <button onClick={() => scrollTo('how')} className="px-10 py-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-extrabold text-lg transition-all">
                            See how it works
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-4">Free 7-day trial · No card required</p>

                    {/* Dashboard Preview Mockup */}
                    <div className="mt-20 relative w-full max-w-5xl group">
                        <div className="absolute inset-0 bg-cyan-500/30 blur-[120px] group-hover:bg-cyan-500/40 transition-all" />
                        <div className="relative bg-[#1E293B] rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden aspect-video">
                            <div className="h-10 bg-black/40 flex items-center px-6 gap-2 border-b border-white/5 relative z-10">
                                <div className="w-3 h-3 rounded-full bg-red-500/30" />
                                <div className="w-3 h-3 rounded-full bg-amber-500/30" />
                                <div className="w-3 h-3 rounded-full bg-green-500/30" />
                                <div className="ml-4 h-5 w-48 bg-white/5 rounded-full flex items-center px-3">
                                    <div className="w-2 h-2 rounded-full bg-cyan-500/50 mr-2" />
                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">notce-ai.app/dashboard</div>
                                </div>
                            </div>
                            <img src="/dashboard-preview.png" alt="NOTCE AI-Tutor dashboard" className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-700" />
                            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0F172A]/40 to-transparent" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Stat strip */}
            <section className="px-6 pb-8">
                <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { n: '500+', l: 'Vetted questions' },
                        { n: '6', l: 'Competency domains' },
                        { n: '200', l: 'Question exam sim' },
                        { n: '2026', l: 'Blueprint aligned' },
                    ].map(s => (
                        <div key={s.l} className="bg-white/5 border border-white/10 rounded-2xl py-6 text-center">
                            <div className="text-3xl md:text-4xl font-black text-white">{s.n}</div>
                            <div className="text-xs text-gray-400 mt-1 font-medium">{s.l}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Feature grid */}
            <section id="features" className="py-24 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-4xl md:text-5xl font-black mb-4">Everything you need to pass</h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">One platform for focused practice, realistic simulation, and the feedback that turns weak spots into strengths.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        <Feature icon={ICONS.bank} title="Vetted question bank" body="Hundreds of independently solved-and-reviewed questions across all six NOTCE competency domains — with deep, exam-style rationales for every option." />
                        <Feature icon={ICONS.target} title="Adaptive mock drills" body="Target a specific domain and difficulty, or let Smart Drill auto-pick your weakest area. Instant feedback and an 'explain it differently' analogy on every answer." />
                        <Feature icon={ICONS.clock} title="Full exam simulation" body="A timed 200-question, 4-hour simulation that mirrors the real exam — free navigation, flagging, and no feedback until you submit." />
                        <Feature icon={ICONS.refresh} title="Spaced-repetition review" body="Missed or low-confidence items resurface on a smart schedule, so they stick long-term instead of being crammed and forgotten." />
                        <Feature icon={ICONS.chart} title="Readiness & analytics" body="A projected score and pass-likelihood band, per-domain mastery, confidence calibration, and a study-activity trend — all in one Performance Hub." />
                        <Feature icon={ICONS.bulb} title="Evidence-Link reasoning" body="Highlight the clinical cues in a vignette and see how your reasoning compares to an expert's — training the perception skills the exam rewards." />
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section id="how" className="py-24 px-6 bg-[#0B1120]">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-4xl md:text-5xl font-black mb-4">How it works</h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">From "where do I even start?" to a clear daily plan in minutes.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { icon: ICONS.calendar, step: '1', title: 'Set your exam date', body: 'Get a live countdown and a "Today" focus that tells you exactly what to study next.' },
                            { icon: ICONS.target, step: '2', title: 'Practice with purpose', body: 'Run vetted drills, target weak domains, and sit full simulations under real exam conditions.' },
                            { icon: ICONS.chart, step: '3', title: 'Track and improve', body: 'Watch your readiness score climb, review what you missed, and close gaps before exam day.' },
                        ].map(s => (
                            <div key={s.step} className="relative bg-white/5 border border-white/10 rounded-2xl p-7">
                                <div className="absolute -top-4 left-7 w-9 h-9 rounded-full bg-cyan-500 text-[#0F172A] font-black flex items-center justify-center">{s.step}</div>
                                <div className="mt-3 w-11 h-11 rounded-xl bg-white/5 text-cyan-400 flex items-center justify-center mb-4"><Icon path={s.icon} /></div>
                                <h3 className="font-bold text-lg mb-1.5">{s.title}</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">{s.body}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Differentiators */}
            <section className="py-24 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
                    <div className="flex-1">
                        <h2 className="text-4xl font-black mb-6 leading-tight">Study anywhere.<br /><span className="text-cyan-400">No LockLizard. No limits.</span></h2>
                        <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                            The official CAOT guide locks you to a single device. NOTCE AI-Tutor runs in any browser, on any device —
                            study on the bus, in the clinic, or on your phone in bed.
                        </p>
                        <ul className="space-y-4">
                            {[
                                { icon: ICONS.device, t: 'Mobile-first, any device', d: 'Switch between laptop and phone freely — your progress follows you.' },
                                { icon: ICONS.bulb, t: 'AI explanations that click', d: 'Plain-language rationales plus an "explain it differently" analogy on every question.' },
                                { icon: ICONS.shield, t: '2026 Blueprint aligned', d: 'Built on the Competencies for Occupational Therapists in Canada (2021).' },
                                { icon: ICONS.bolt, t: 'Auto-saved progress', d: 'Pick up exactly where you left off — drills, exams, and highlights are saved for you.' },
                            ].map(item => (
                                <li key={item.t} className="flex items-start gap-3">
                                    <div className="w-8 h-8 flex-shrink-0 bg-cyan-500/15 text-cyan-400 rounded-lg flex items-center justify-center"><Icon path={item.icon} className="w-4 h-4" /></div>
                                    <div>
                                        <p className="font-semibold text-white">{item.t}</p>
                                        <p className="text-sm text-gray-400">{item.d}</p>
                                    </div>
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

            {/* For schools & programs (B2B) */}
            <section id="schools" className="py-24 px-6 bg-[#0B1120]">
                <div className="max-w-6xl mx-auto">
                    <div className="bg-gradient-to-br from-indigo-600/15 to-cyan-600/10 border border-white/10 rounded-3xl p-8 md:p-12 flex flex-col lg:flex-row gap-10 items-center">
                        <div className="flex-1">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-cyan-300 mb-4">
                                <Icon path={ICONS.users} className="w-4 h-4" /> For schools & programs
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black mb-4">Bring NOTCE AI-Tutor to your cohort</h2>
                            <p className="text-gray-300 leading-relaxed mb-6">
                                Equip your OT students with exam-ready practice and give your instructors the visibility to intervene early.
                                Seat licensing, cohort dashboards, and at-risk alerts — built in.
                            </p>
                            <ul className="grid sm:grid-cols-2 gap-3 mb-8">
                                {[
                                    'Seat-based licensing for your cohort',
                                    'Instructor & admin dashboards',
                                    'Assign drills and study targets',
                                    'At-risk alerts to catch struggling students',
                                ].map(t => (
                                    <li key={t} className="flex items-center gap-2 text-sm text-gray-200">
                                        <Icon path={ICONS.check} className="w-4 h-4 text-cyan-400 flex-shrink-0" /> {t}
                                    </li>
                                ))}
                            </ul>
                            <a href="/contact" className="inline-flex px-7 py-3.5 bg-cyan-500 text-[#0F172A] rounded-xl font-bold hover:bg-cyan-400 transition-all">Talk to us about your program</a>
                        </div>
                        <div className="flex-shrink-0 w-full lg:w-72 bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                            <div className="flex items-center justify-between"><span className="text-xs text-gray-400 font-bold uppercase tracking-wide">Cohort readiness</span><span className="text-xs font-bold text-cyan-400">72%</span></div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full w-[72%] bg-cyan-500 rounded-full" /></div>
                            {[['A. Okafor', '88%'], ['J. Tremblay', '64%'], ['S. Patel', '41%']].map(([n, p]) => (
                                <div key={n} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-300">{n}</span>
                                    <span className={`font-semibold ${Number(String(p).replace('%','')) < 60 ? 'text-red-400' : 'text-gray-200'}`}>{p}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="py-24 px-6">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-4xl md:text-5xl font-black mb-12 text-center">Questions, answered</h2>
                    <div className="space-y-4">
                        {[
                            { q: 'Is this for the Canadian NOTCE?', a: 'Yes. NOTCE AI-Tutor is built specifically for the National Occupational Therapy Certification Examination administered by CAOT — not the US NBCOT. Content follows the 2026 Blueprint (Competencies for Occupational Therapists in Canada, 2021).' },
                            { q: 'Is this the official exam?', a: 'No. We are an independent study tool and are not affiliated with CAOT. Our questions are written and reviewed to mirror the style and competencies of the real exam as a preparation aid.' },
                            { q: 'How current is the content?', a: 'The question bank is aligned to the September 2026 Blueprint and is continually reviewed and expanded across all six competency domains.' },
                            { q: 'Does it work on my phone?', a: 'Yes — it runs in any modern browser on any device, with your progress auto-saved so you can switch between phone and laptop seamlessly.' },
                            { q: 'Do you offer group or school licensing?', a: 'Yes. We support seat-based licensing with instructor dashboards, cohort assignments, and at-risk alerts. Reach out via the “For schools” section above.' },
                            { q: 'Is there a free trial?', a: 'Yes — start with a free 7-day trial, no card required.' },
                        ].map(item => (
                            <details key={item.q} className="group bg-white/5 border border-white/10 rounded-2xl p-5 open:bg-white/[0.07]">
                                <summary className="flex items-center justify-between cursor-pointer list-none font-bold text-white">
                                    {item.q}
                                    <span className="text-cyan-400 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                                </summary>
                                <p className="text-sm text-gray-400 mt-3 leading-relaxed">{item.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* Closing CTA */}
            <section className="py-24 px-6">
                <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-cyan-500/10 to-indigo-600/10 border border-white/10 rounded-3xl p-12">
                    <h2 className="text-4xl md:text-5xl font-black mb-4">Ready to feel exam-ready?</h2>
                    <p className="text-gray-400 max-w-xl mx-auto mb-8">Start your free 7-day trial and see your readiness score build from your very first session.</p>
                    <button onClick={onRegister} className="px-10 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl font-extrabold text-lg hover:shadow-[0_0_40px_rgba(6,182,212,0.3)] transition-all active:scale-95">
                        Start studying free
                    </button>
                    <p className="text-xs text-gray-500 mt-4">No card required · Cancel anytime</p>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-16 px-6 border-t border-white/5">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center font-black text-sm">N</div>
                        <span className="font-bold text-gray-400 tracking-tight">NOTCE AI-Tutor</span>
                    </div>
                    <div className="flex gap-8 text-sm text-gray-500 font-medium">
                        <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
                        <a href="/terms" className="hover:text-white transition-colors">Terms</a>
                        <a href="/contact" className="hover:text-white transition-colors">Contact</a>
                    </div>
                    <p className="text-gray-600 text-xs">© 2026 Advanced OT Education. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
