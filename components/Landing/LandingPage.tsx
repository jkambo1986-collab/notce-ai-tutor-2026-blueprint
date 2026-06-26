import React from 'react';
import { Button, Card, Badge } from '../ui';

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

/** A reusable feature card for the features grid, with a gradient icon tile. */
const Feature: React.FC<{ icon: string; title: string; body: string }> = ({ icon, title, body }) => (
    <Card interactive className="h-full">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center mb-5 shadow-glow-teal transition-transform duration-300 group-hover:-translate-y-0.5">
            <Icon path={icon} className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-lg text-ink mb-1.5 tracking-tight">{title}</h3>
        <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
    </Card>
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
        <div className="min-h-screen bg-canvas text-ink">
            {/* Soft brand wash — calm, never harsh */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-12%] left-[-8%] w-[42%] h-[42%] bg-brand-200/30 rounded-full blur-[140px]" />
                <div className="absolute bottom-[-12%] right-[-8%] w-[42%] h-[42%] bg-indigo-200/25 rounded-full blur-[140px]" />
            </div>

            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-canvas/80 backdrop-blur-md border-b border-slate-200/70">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-glow-teal">N</div>
                        <div>
                            <span className="font-bold text-xl tracking-tight text-ink">NOTCE <span className="text-brand-600">AI-Tutor</span></span>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">2026 Blueprint</div>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center gap-8">
                        <button onClick={() => scrollTo('features')} className="text-sm font-medium text-slate-500 hover:text-ink transition-colors">Features</button>
                        <button onClick={() => scrollTo('how')} className="text-sm font-medium text-slate-500 hover:text-ink transition-colors">How it works</button>
                        <button onClick={() => scrollTo('schools')} className="text-sm font-medium text-slate-500 hover:text-ink transition-colors">For schools</button>
                        <button onClick={() => scrollTo('faq')} className="text-sm font-medium text-slate-500 hover:text-ink transition-colors">FAQ</button>
                        <div className="h-4 w-px bg-slate-200" />
                        <Button variant="ghost" size="md" onClick={onLogin}>Login</Button>
                        <Button variant="primary" size="md" onClick={onRegister}>Start free</Button>
                    </div>
                </div>
            </nav>

            {/* Hero — product-led */}
            <section className="relative pt-40 pb-20 px-6">
                <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
                    <div className="animate-fade-in-up">
                        <Badge tone="brand" className="mb-8" icon={
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
                            </span>
                        }>
                            Built for the Canadian NOTCE · 2026 Blueprint
                        </Badge>
                    </div>

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-8 leading-[1.05] animate-fade-in-up" style={{ animationDelay: '60ms' }}>
                        Walk into the NOTCE<br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-500 via-brand-600 to-indigo-500">actually ready.</span>
                    </h1>

                    <p className="max-w-2xl text-lg md:text-xl text-slate-600 leading-relaxed mb-10 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
                        AI-powered prep for the Canadian occupational therapy licensing exam: an
                        <span className="text-ink font-semibold"> independently-vetted question bank</span>, full exam simulations,
                        spaced-repetition review, and a <span className="text-ink font-semibold">readiness score</span> that tells you
                        exactly where you stand — aligned to the 2026 Blueprint (Competencies for Occupational Therapists in Canada, 2021).
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up" style={{ animationDelay: '180ms' }}>
                        <Button variant="primary" size="lg" onClick={onRegister} rightIcon={
                            <span className="transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
                        }>
                            Start studying free
                        </Button>
                        <Button variant="outline" size="lg" onClick={() => scrollTo('how')}>
                            See how it works
                        </Button>
                    </div>
                    <p className="text-xs text-slate-400 mt-4 animate-fade-in-up" style={{ animationDelay: '220ms' }}>Free 7-day trial · No card required</p>

                    {/* Trust strip — reuses existing claims, no invented stats */}
                    <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-slate-500 font-medium animate-fade-in-up" style={{ animationDelay: '260ms' }}>
                        <span className="inline-flex items-center gap-2"><Icon path={ICONS.shield} className="w-4 h-4 text-brand-600" /> 2026 Blueprint aligned</span>
                        <span className="hidden sm:inline h-4 w-px bg-slate-200" />
                        <span className="inline-flex items-center gap-2"><Icon path={ICONS.check} className="w-4 h-4 text-emerald-600" /> Independently vetted question bank</span>
                        <span className="hidden sm:inline h-4 w-px bg-slate-200" />
                        <span className="inline-flex items-center gap-2"><Icon path={ICONS.device} className="w-4 h-4 text-brand-600" /> Any device, no LockLizard</span>
                    </div>

                    {/* Dashboard Preview Mockup */}
                    <div className="mt-20 relative w-full max-w-5xl group animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                        <div className="absolute -inset-4 bg-brand-300/30 blur-[120px] rounded-[3rem] group-hover:bg-brand-300/40 transition-all" />
                        <div className="relative bg-white rounded-5xl ring-1 ring-slate-200/70 shadow-soft-lg overflow-hidden aspect-video">
                            <div className="h-10 bg-slate-50 flex items-center px-6 gap-2 border-b border-slate-200/70 relative z-10">
                                <div className="w-3 h-3 rounded-full bg-red-300" />
                                <div className="w-3 h-3 rounded-full bg-amber-300" />
                                <div className="w-3 h-3 rounded-full bg-emerald-300" />
                                <div className="ml-4 h-5 w-48 bg-slate-100 rounded-full flex items-center px-3">
                                    <div className="w-2 h-2 rounded-full bg-brand-400 mr-2" />
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">notce-ai.app/dashboard</div>
                                </div>
                            </div>
                            <img src="/dashboard-preview.png" alt="NOTCE AI-Tutor dashboard" className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-700" />
                            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-canvas/30 to-transparent" />
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
                    ].map((s, i) => (
                        <Card key={s.l} padding="none" className="py-6 text-center animate-fade-in-up" style={{ animationDelay: `${i * 70}ms` }}>
                            <div className="text-3xl md:text-4xl font-black text-ink tracking-tight">{s.n}</div>
                            <div className="text-xs text-slate-500 mt-1 font-medium">{s.l}</div>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Feature grid */}
            <section id="features" className="py-24 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">Everything you need to pass</h2>
                        <p className="text-slate-600 max-w-2xl mx-auto">One platform for focused practice, realistic simulation, and the feedback that turns weak spots into strengths.</p>
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
            <section id="how" className="py-24 px-6 bg-white border-y border-slate-200/70">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">How it works</h2>
                        <p className="text-slate-600 max-w-2xl mx-auto">From "where do I even start?" to a clear daily plan in minutes.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { icon: ICONS.calendar, step: '1', title: 'Set your exam date', body: 'Get a live countdown and a "Today" focus that tells you exactly what to study next.' },
                            { icon: ICONS.target, step: '2', title: 'Practice with purpose', body: 'Run vetted drills, target weak domains, and sit full simulations under real exam conditions.' },
                            { icon: ICONS.chart, step: '3', title: 'Track and improve', body: 'Watch your readiness score climb, review what you missed, and close gaps before exam day.' },
                        ].map(s => (
                            <Card key={s.step} className="relative bg-canvas">
                                <div className="absolute -top-4 left-7 w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white font-black flex items-center justify-center shadow-glow-teal">{s.step}</div>
                                <div className="mt-3 w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 flex items-center justify-center mb-4"><Icon path={s.icon} /></div>
                                <h3 className="font-bold text-lg mb-1.5 tracking-tight">{s.title}</h3>
                                <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Differentiators */}
            <section className="py-24 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
                    <div className="flex-1">
                        <h2 className="text-4xl font-black mb-6 leading-tight tracking-tight">Study anywhere.<br /><span className="text-brand-600">No LockLizard. No limits.</span></h2>
                        <p className="text-slate-600 text-lg mb-8 leading-relaxed">
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
                                    <div className="w-8 h-8 flex-shrink-0 bg-brand-50 text-brand-600 ring-1 ring-brand-100 rounded-xl flex items-center justify-center"><Icon path={item.icon} className="w-4 h-4" /></div>
                                    <div>
                                        <p className="font-semibold text-ink">{item.t}</p>
                                        <p className="text-sm text-slate-600">{item.d}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="flex-1 relative">
                        <div className="absolute inset-0 bg-brand-300/25 blur-[100px]" />
                        <div className="relative bg-white ring-1 ring-slate-200/70 p-4 rounded-5xl shadow-soft-lg rotate-3">
                            <div className="bg-canvas rounded-4xl p-6 space-y-4 ring-1 ring-slate-200/70">
                                <div className="h-4 w-1/2 bg-slate-200 rounded" />
                                <div className="h-32 w-full bg-gradient-to-br from-brand-100 to-brand-50 rounded-2xl ring-1 ring-brand-100" />
                                <div className="space-y-2">
                                    <div className="h-3 w-full bg-slate-100 rounded" />
                                    <div className="h-3 w-4/5 bg-slate-100 rounded" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* For schools & programs (B2B) */}
            <section id="schools" className="py-24 px-6 bg-white border-y border-slate-200/70">
                <div className="max-w-6xl mx-auto">
                    <div className="bg-gradient-to-br from-brand-50 to-indigo-50 ring-1 ring-slate-200/70 rounded-4xl shadow-card p-8 md:p-12 flex flex-col lg:flex-row gap-10 items-center">
                        <div className="flex-1">
                            <Badge tone="brand" className="mb-4" icon={<Icon path={ICONS.users} className="w-3.5 h-3.5" />}>
                                For schools & programs
                            </Badge>
                            <h2 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">Bring NOTCE AI-Tutor to your cohort</h2>
                            <p className="text-slate-600 leading-relaxed mb-6">
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
                                    <li key={t} className="flex items-center gap-2 text-sm text-slate-700">
                                        <Icon path={ICONS.check} className="w-4 h-4 text-emerald-600 flex-shrink-0" /> {t}
                                    </li>
                                ))}
                            </ul>
                            <a href="/contact">
                                <Button variant="primary" size="md">Talk to us about your program</Button>
                            </a>
                        </div>
                        <Card className="flex-shrink-0 w-full lg:w-72 space-y-3">
                            <div className="flex items-center justify-between"><span className="text-xs text-slate-500 font-bold uppercase tracking-wide">Cohort readiness</span><span className="text-xs font-bold text-brand-600">72%</span></div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full w-[72%] bg-gradient-to-r from-brand-500 to-brand-600 rounded-full" /></div>
                            {[['A. Okafor', '88%'], ['J. Tremblay', '64%'], ['S. Patel', '41%']].map(([n, p]) => (
                                <div key={n} className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">{n}</span>
                                    <span className={`font-semibold ${Number(String(p).replace('%','')) < 60 ? 'text-red-500' : 'text-ink'}`}>{p}</span>
                                </div>
                            ))}
                        </Card>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="py-24 px-6">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-4xl md:text-5xl font-black mb-12 text-center tracking-tight">Questions, answered</h2>
                    <div className="space-y-4">
                        {[
                            { q: 'Is this for the Canadian NOTCE?', a: 'Yes. NOTCE AI-Tutor is built specifically for the National Occupational Therapy Certification Examination administered by CAOT — not the US NBCOT. Content follows the 2026 Blueprint (Competencies for Occupational Therapists in Canada, 2021).' },
                            { q: 'Is this the official exam?', a: 'No. We are an independent study tool and are not affiliated with CAOT. Our questions are written and reviewed to mirror the style and competencies of the real exam as a preparation aid.' },
                            { q: 'How current is the content?', a: 'The question bank is aligned to the September 2026 Blueprint and is continually reviewed and expanded across all six competency domains.' },
                            { q: 'Does it work on my phone?', a: 'Yes — it runs in any modern browser on any device, with your progress auto-saved so you can switch between phone and laptop seamlessly.' },
                            { q: 'Do you offer group or school licensing?', a: 'Yes. We support seat-based licensing with instructor dashboards, cohort assignments, and at-risk alerts. Reach out via the “For schools” section above.' },
                            { q: 'Is there a free trial?', a: 'Yes — start with a free 7-day trial, no card required.' },
                        ].map(item => (
                            <details key={item.q} className="group bg-white ring-1 ring-slate-200/70 shadow-card rounded-2xl p-5 transition-all duration-300 open:ring-brand-200">
                                <summary className="flex items-center justify-between cursor-pointer list-none font-bold text-ink">
                                    {item.q}
                                    <span className="text-brand-600 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                                </summary>
                                <p className="text-sm text-slate-600 mt-3 leading-relaxed">{item.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* Closing CTA */}
            <section className="py-24 px-6">
                <div className="relative max-w-4xl mx-auto text-center overflow-hidden bg-gradient-to-br from-ink to-slate-800 rounded-4xl shadow-soft-lg p-12">
                    <div className="absolute -top-16 -right-10 w-64 h-64 bg-brand-500/20 rounded-full blur-3xl animate-float pointer-events-none" />
                    <h2 className="relative text-4xl md:text-5xl font-black mb-4 text-white tracking-tight">Ready to feel exam-ready?</h2>
                    <p className="relative text-slate-300 max-w-xl mx-auto mb-8">Start your free 7-day trial and see your readiness score build from your very first session.</p>
                    <div className="relative flex justify-center">
                        <Button variant="primary" size="lg" onClick={onRegister} rightIcon={
                            <span className="transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
                        }>
                            Start studying free
                        </Button>
                    </div>
                    <p className="relative text-xs text-slate-400 mt-4">No card required · Cancel anytime</p>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-16 px-6 border-t border-slate-200/70">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 text-white rounded-xl flex items-center justify-center font-black text-sm">N</div>
                        <span className="font-bold text-slate-600 tracking-tight">NOTCE AI-Tutor</span>
                    </div>
                    <div className="flex gap-8 text-sm text-slate-500 font-medium">
                        <a href="/privacy" className="hover:text-ink transition-colors">Privacy</a>
                        <a href="/terms" className="hover:text-ink transition-colors">Terms</a>
                        <a href="/contact" className="hover:text-ink transition-colors">Contact</a>
                    </div>
                    <p className="text-slate-400 text-xs">© 2026 Advanced OT Education. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
