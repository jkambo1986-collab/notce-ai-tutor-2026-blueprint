import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useToast } from '../ui/Feedback';
import { Button, Input } from '../ui';

const UserIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
);
const MailIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
);
const LockIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
);

/**
 * RegisterPage
 *
 * Sign-up screen for new users.
 *
 * @param onSwitch - Callback to navigate to the LoginPage. Used both by the
 *   "Sign In" link and by the post-registration "Continue to Login" button.
 *
 * Behavior: collects username/email/password and calls the register API.
 * On success it swaps the form for a confirmation panel instead of logging the
 * user in automatically, so they explicitly continue to the login screen.
 */
export const RegisterPage: React.FC<{ onSwitch: () => void }> = ({ onSwitch }) => {
    const toast = useToast();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    // Tracks whether registration succeeded; flips the UI to the confirmation panel.
    const [success, setSuccess] = useState(false);

    // Form submit handler: create the account on the backend.
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.register(username, email, password);
            // Don't auto-login; show the success state so the user proceeds to login deliberately.
            setSuccess(true);
            // Accounts are active immediately (email verification is currently auto-completed
            // server-side), so confirm readiness rather than promising a verification email.
            toast('Account created! You can sign in now.', 'success', { duration: 5000 });
        } catch (err: any) {
            console.error('Registration error:', err);
            // Treat connectivity issues differently from validation errors (e.g. taken username).
            const isNetworkError = err.message?.toLowerCase().includes('fetch') ||
                                 err.message?.toLowerCase().includes('failed') ||
                                 !window.navigator.onLine;

            if (isNetworkError) {
                setError('Network error: The backend server is currently unreachable. Please wait for the deployment to finish.');
            } else {
                setError(err.message || 'Registration failed. Please try a different username.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B1120] px-6">
            {/* Ambient brand glows */}
            <div className="pointer-events-none absolute -right-[10%] -top-[20%] h-[55%] w-[55%] rounded-full bg-brand-600/20 blur-[130px]" />
            <div className="pointer-events-none absolute -bottom-[20%] -left-[10%] h-[55%] w-[55%] rounded-full bg-teal-400/15 blur-[130px]" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

            <div className="relative z-10 w-full max-w-md animate-fade-in-up">
                {/* Logo + welcome */}
                <div className="mb-9 flex flex-col items-center text-center">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 to-brand-600 text-3xl font-black text-white shadow-glow-teal">
                        N
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white">Join NOTCE Prep</h1>
                    <p className="mt-2 text-slate-400">Start your journey to mastery.</p>
                </div>

                <div className="rounded-4xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl">
                    {error && (
                        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 animate-fade-in">
                            <svg className="mt-0.5 h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            {error}
                        </div>
                    )}

                    {success ? (
                        <div className="py-6 text-center animate-scale-in">
                            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-glow-teal">
                                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h2 className="mb-2 text-2xl font-black tracking-tight text-white">Account created!</h2>
                            <p className="mb-8 text-slate-400">
                                Welcome, <span className="font-semibold text-white">{username}</span> — your account is
                                ready. Sign in to start your prep.
                            </p>
                            <Button onClick={onSwitch} size="lg" fullWidth>
                                Continue to Login
                            </Button>
                        </div>
                    ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Input
                            tone="dark"
                            label="Choose Username"
                            leftIcon={<UserIcon />}
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="Future OT Expert"
                            autoComplete="username"
                            required
                        />
                        <Input
                            tone="dark"
                            label="Email Address"
                            type="email"
                            leftIcon={<MailIcon />}
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            autoComplete="email"
                            required
                        />
                        <Input
                            tone="dark"
                            label="Secure Password"
                            type={showPw ? 'text' : 'password'}
                            leftIcon={<LockIcon />}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            autoComplete="new-password"
                            required
                            minLength={8}
                            hint="At least 8 characters."
                            rightSlot={
                                <button type="button" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Hide password' : 'Show password'} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:text-slate-300">
                                    {showPw ? (
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    ) : (
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    )}
                                </button>
                            }
                        />
                        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-2">
                            {loading ? 'Creating Account…' : 'Create Account'}
                        </Button>
                    </form>
                    )}

                    <div className="mt-8 text-center text-sm">
                        <span className="text-slate-400">Already a member?</span>
                        <button onClick={onSwitch} className="ml-2 font-bold text-brand-300 transition-colors hover:text-brand-200">Sign In</button>
                    </div>
                </div>

                <button
                    onClick={() => navigate('/')}
                    className="mt-8 w-full text-center text-sm font-medium text-slate-500 transition-colors hover:text-slate-300"
                >
                    ← Back to Home
                </button>
            </div>
        </div>
    );
};

export default RegisterPage;
