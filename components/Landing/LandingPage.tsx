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

/** A reusable feature card for the features grid. */
const Feature: React.FC<{ icon: string; title: string; body: string }> = ({ icon, title, body }) => (
    <Card interactive padding="md" className="h-full">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-soft transition-transform duration-300 group-hover:scale-110">
            <Icon path={icon} className="h-6 w-6" />
        </div>
        <h3 className="mb-1.5 text-lg font-bold text-ink">{title}</h3>
        <p className="text-sm leading-relaxed text-slate-500">{body}</p>
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
            {/* Soft brand ambience */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -left-[10%] top-[-10%] h-[42%] w-[42%] rounded-full bg-brand-200/30 blur-[130px]" />
                <div className="absolute -right-[10%] top-[30%] h-[42%] w-[42%] rounded-full bg-indigo-200/25 blur-[130px]" />
            </div>

            {/* Navbar */}
            <nav className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-canvas/80 backdrop-blur-md">
                <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-xl font-black text-white shadow-glow-teal">N</div>
                        <div>
                            <span className="text-xl font-bold tracking-tight text-ink">NOTCE <span className="text-brand-600">AI-Tutor</span></span>
                            <div className="text-[10px] font-bold uppercase leading-none tracking-widest text-slate-400">2026 Blueprint</div>
                        </div>
                    </div>

                    <div className="hidden items-center gap-7 md:flex">
                        <button onClick={() => scrollTo('features')} className="text-sm font-medium text-slate-500 transition-colors hover:text-ink">Features</button>
                        <button onClick={() => scrollTo('how')} className="text-sm font-medium text-slate-500 transition-colors hover:text-ink">How it works</button>
                        <button onClick={() => scrollTo('schools')} className="text-sm font-medium text-slate-500 transition-colors hover:text-ink">For schools</button>
                        <button onClick={() => scrollTo('faq')} className="text-sm font-medium text-slate-500 transition-colors hover:text-ink">FAQ</button>
                        <div className="h-4 w-px bg-slate-200" />
                        <Button variant="ghost" size="sm" onClick={onLogin}>Login</Button>
                        <Button size="sm" onClick={onRegister}>Start free</Button>
                    </div>
                </div>
            </nav>

            {/* Hero — product-led */}
            <section className="relative px-6 pb-20 pt-36">
                <div className="mx-auto flex max-w-7xl flex-col items-center text-center">
                    <div className="animate-fade-in-up">
                        <Badge tone="brand" className="mb-8 px-4 py-2 text-xs" icon={
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
                            </span>
                        }>
                            Built for the Canadian NOTCE · 2026 Blueprint
                        </Badge>
                    </div>

                    <h1 className="mb-8 animate-fade-in-up text-5xl font-black leading-[1.05] tracking-tight md:text-7xl lg:text-[5.5rem]" style={{ animationDelay: '60ms' }}>
                        Walk into the NOTCE<br />
                        <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-emerald-500 bg-clip-text text-transparent">actually ready.</span>
                    </h1>

                    <p className="mb-10 max-w-2xl animate-fade-in-up text-lg leading-relaxed text-slate-600 md:text-xl" style={{ animationDelay: '120ms' }}>
                        AI-powered prep for the Canadian occupational therapy licensing exam: an
                        <span className="font-semibold text-ink"> independently-vetted question bank</span>, full exam simulations,
                        spaced-repetition review, and a <span className="font-semibold text-ink">readiness score</span> that tells you
                        exactly where you stand — aligned to the 2026 Blueprint (Competencies for Occupational Therapists in Canada, 2021).
                    </p>

                    <div className="flex animate-fade-in-up flex-col gap-4 sm:flex-row" style={{ animationDelay: '180ms' }}>
                        <Button size="lg" onClick={onRegister} rightIcon={<Icon path="M13 7l5 5m0 0l-5 5m5-5H6" className="h-5 w-5" />} className="group">
                            Start studying free
                        </Button>
                        <Button size="lg" variant="outline" onClick={() => scrollTo('how')}>See how it works</Button>
                    </div>
                    <p className="mt-4 animate-fade-in text-xs text-slate-400" style={{ animationDelay: '240ms' }}>Free 7-day trial · No card required</p>

                    {/* Trust strip */}
                    <div className="mt-8 flex animate-fade-in flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-500" style={{ animationDelay: '300ms' }}>
                        {['2026 Blueprint aligned', 'Independently vetted question bank', 'Any device, no LockLizard'].map(t => (
                            <span key={t} className="inline-flex items-center gap-1.5"><Icon path={ICONS.check} className="h-4 w-4 text-brand-500" /> {t}</span>
                        ))}
                    </div>

                    {/* Dashboard Preview Mockup */}
                    <div className="group relative mt-16 w-full max-w-5xl animate-fade-in-up" style={{ animationDelay: '360ms' }}>
                        <div className="absolute inset-x-8 -bottom-6 top-10 rounded-[2.5rem] bg-brand-400/25 blur-[90px]" />
                        <div className="relative overflow-hidden rounded-4xl bg-white shadow-soft-lg ring-1 ring-slate-200/70">
                            <div className="relative z-10 flex h-11 items-center gap-2 border-b border-slate-100 bg-slate-50 px-6">
                                <div className="h-3 w-3 rounded-full bg-red-300" />
                                <div className="h-3 w-3 rounded-full bg-amber-300" />
                                <div className="h-3 w-3 rounded-full bg-emerald-300" />
                                <div className="ml-4 flex h-5 w-56 items-center rounded-full bg-white px-3 ring-1 ring-slate-200">
                                    <div className="mr-2 h-2 w-2 rounded-full bg-brand-400" />
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">notce-ai.app/dashboard</div>
                                </div>
                            </div>
                            <img src="/dashboard-preview.png" alt="NOTCE AI-Tutor dashboard" className="aspect-video w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.03]" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Stat strip */}
            <section className="px-6 pb-8 pt-4">
                <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-4">
                    {[
                        { n: '500+', l: 'Vetted questions' },
                        { n: '6', l: 'Competency domains' },
                        { n: '200', l: 'Question exam sim' },
                        { n: '2026', l: 'Blueprint aligned' },
                    ].map((s, i) => (
                        <Card key={s.l} padding="none" className="animate-fade-in-up py-6 text-center" style={{ animationDelay: `${i * 60}ms` } as React.CSSProperties}>
                            <div className="text-3xl font-black text-ink md:text-4xl">{s.n}</div>
                            <div className="mt-1 text-xs font-medium text-slate-500">{s.l}</div>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Feature grid */}
            <section id="features" className="px-6 py-24">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-14 text-center">
                        <h2 className="mb-4 text-4xl font-black md:text-5xl">Everything you need to pass</h2>
                        <p className="mx-auto max-w-2xl text-slate-500">One platform for focused practice, realistic simulation, and the feedback that turns weak spots into strengths.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
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
            <section id="how" className="border-y border-slate-200/70 bg-white px-6 py-24">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-16 text-center">
                        <h2 className="mb-4 text-4xl font-black md:text-5xl">How it works</h2>
                        <p className="mx-auto max-w-2xl text-slate-500">From "where do I even start?" to a clear daily plan in minutes.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        {[
                            { icon: ICONS.calendar, step: '1', title: 'Set your exam date', body: 'Get a live countdown and a "Today" focus that tells you exactly what to study next.' },
                            { icon: ICONS.target, step: '2', title: 'Practice with purpose', body: 'Run vetted drills, target weak domains, and sit full simulations under real exam conditions.' },
                            { icon: ICONS.chart, step: '3', title: 'Track and improve', body: 'Watch your readiness score climb, review what you missed, and close gaps before exam day.' },
                        ].map((s, i) => (
                            <div key={s.step} className="relative animate-fade-in-up rounded-3xl bg-canvas p-7 ring-1 ring-slate-200/70" style={{ animationDelay: `${i * 80}ms` }}>
                                <div className="absolute -top-4 left-7 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 font-black text-white shadow-glow-teal">{s.step}</div>
                                <div className="mb-4 mt-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100"><Icon path={s.icon} /></div>
                                <h3 className="mb-1.5 text-lg font-bold text-ink">{s.title}</h3>
                                <p className="text-sm leading-relaxed text-slate-500">{s.body}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Differentiators */}
            <section className="px-6 py-24">
                <div className="mx-auto flex max-w-7xl flex-col items-center gap-16 md:flex-row">
                    <div className="flex-1">
                        <h2 className="mb-6 text-4xl font-black leading-tight">Study anywhere.<br /><span className="text-brand-600">No LockLizard. No limits.</span></h2>
                        <p className="mb-8 text-lg leading-relaxed text-slate-600">
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
                                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100"><Icon path={item.icon} className="h-4 w-4" /></div>
                                    <div>
                                        <p className="font-semibold text-ink">{item.t}</p>
                                        <p className="text-sm text-slate-500">{item.d}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="relative flex-1">
                        <div className="absolute inset-0 bg-brand-300/20 blur-[100px]" />
                        <div className="relative rotate-2 rounded-4xl bg-white p-4 shadow-soft-lg ring-1 ring-slate-200/70">
                            <div className="space-y-4 rounded-3xl bg-canvas p-6 ring-1 ring-slate-100">
                                <div className="h-4 w-1/2 rounded bg-slate-200" />
                                <div className="h-32 w-full rounded-xl bg-gradient-to-br from-brand-100 to-emerald-100" />
                                <div className="space-y-2">
                                    <div className="h-3 w-full rounded bg-slate-100" />
                                    <div className="h-3 w-4/5 rounded bg-slate-100" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* For schools & programs (B2B) */}
            <section id="schools" className="border-y border-slate-200/70 bg-white px-6 py-24">
                <div className="mx-auto max-w-6xl">
                    <div className="flex flex-col items-center gap-10 rounded-4xl bg-gradient-to-br from-brand-50 to-indigo-50 p-8 ring-1 ring-brand-100 md:p-12 lg:flex-row">
                        <div className="flex-1">
                            <Badge tone="brand" icon={<Icon path={ICONS.users} className="h-4 w-4" />} className="mb-4">For schools & programs</Badge>
                            <h2 className="mb-4 text-3xl font-black md:text-4xl">Bring NOTCE AI-Tutor to your cohort</h2>
                            <p className="mb-6 leading-relaxed text-slate-600">
                                Equip your OT students with exam-ready practice and give your instructors the visibility to intervene early.
                                Seat licensing, cohort dashboards, and at-risk alerts — built in.
                            </p>
                            <ul className="mb-8 grid gap-3 sm:grid-cols-2">
                                {[
                                    'Seat-based licensing for your cohort',
                                    'Instructor & admin dashboards',
                                    'Assign drills and study targets',
                                    'At-risk alerts to catch struggling students',
                                ].map(t => (
                                    <li key={t} className="flex items-center gap-2 text-sm text-slate-700">
                                        <Icon path={ICONS.check} className="h-4 w-4 flex-shrink-0 text-brand-500" /> {t}
                                    </li>
                                ))}
                            </ul>
                            <a href="/contact"><Button>Talk to us about your program</Button></a>
                        </div>
                        <div className="w-full flex-shrink-0 space-y-3 rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-200/70 lg:w-72">
                            <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-slate-400">Cohort readiness</span><span className="text-xs font-bold text-brand-600">72%</span></div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[72%] rounded-full bg-gradient-to-r from-brand-500 to-emerald-500" /></div>
                            {[['A. Okafor', '88%'], ['J. Tremblay', '64%'], ['S. Patel', '41%']].map(([n, p]) => (
                                <div key={n} className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">{n}</span>
                                    <span className={`font-semibold ${Number(String(p).replace('%','')) < 60 ? 'text-red-500' : 'text-slate-700'}`}>{p}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="px-6 py-24">
                <div className="mx-auto max-w-3xl">
                    <h2 className="mb-12 text-center text-4xl font-black md:text-5xl">Questions, answered</h2>
                    <div className="space-y-3">
                        {[
                            { q: 'Is this for the Canadian NOTCE?', a: 'Yes. NOTCE AI-Tutor is built specifically for the National Occupational Therapy Certification Examination administered by CAOT — not the US NBCOT. Content follows the 2026 Blueprint (Competencies for Occupational Therapists in Canada, 2021).' },
                            { q: 'Is this the official exam?', a: 'No. We are an independent study tool and are not affiliated with CAOT. Our questions are written and reviewed to mirror the style and competencies of the real exam as a preparation aid.' },
                            { q: 'How current is the content?', a: 'The question bank is aligned to the September 2026 Blueprint and is continually reviewed and expanded across all six competency domains.' },
                            { q: 'Does it work on my phone?', a: 'Yes — it runs in any modern browser on any device, with your progress auto-saved so you can switch between phone and laptop seamlessly.' },
                            { q: 'Do you offer group or school licensing?', a: 'Yes. We support seat-based licensing with instructor dashboards, cohort assignments, and at-risk alerts. Reach out via the “For schools” section above.' },
                            { q: 'Is there a free trial?', a: 'Yes — start with a free 7-day trial, no card required.' },
                        ].map(item => (
                            <details key={item.q} className="group rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-200/70 transition open:ring-brand-200">
                                <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-ink">
                                    {item.q}
                                    <span className="text-xl leading-none text-brand-500 transition-transform group-open:rotate-45">+</span>
                                </summary>
                                <p className="mt-3 text-sm leading-relaxed text-slate-500">{item.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* Closing CTA — dark panel for contrast on a light page */}
            <section className="px-6 py-24">
                <div className="relative mx-auto max-w-4xl overflow-hidden rounded-4xl bg-gradient-to-br from-ink to-slate-800 p-12 text-center shadow-soft-lg">
                    <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 animate-float rounded-full bg-brand-500/25 blur-3xl" />
                    <div className="relative">
                        <h2 className="mb-4 text-4xl font-black text-white md:text-5xl">Ready to feel exam-ready?</h2>
                        <p className="mx-auto mb-8 max-w-xl text-slate-300">Start your free 7-day trial and see your readiness score build from your very first session.</p>
                        <Button size="lg" onClick={onRegister}>Start studying free</Button>
                        <p className="mt-4 text-xs text-slate-400">No card required · Cancel anytime</p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-200/70 px-6 py-16">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 md:flex-row">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 text-sm font-black text-white">N</div>
                        <span className="font-bold tracking-tight text-slate-600">NOTCE AI-Tutor</span>
                    </div>
                    <div className="flex gap-8 text-sm font-medium text-slate-500">
                        <a href="/privacy" className="transition-colors hover:text-ink">Privacy</a>
                        <a href="/terms" className="transition-colors hover:text-ink">Terms</a>
                        <a href="/contact" className="transition-colors hover:text-ink">Contact</a>
                    </div>
                    <p className="text-xs text-slate-400">© 2026 Advanced OT Education. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
