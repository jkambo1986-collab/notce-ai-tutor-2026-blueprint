import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../AuthContext';
import { useToast } from '../ui/Feedback';
import { Button, Input } from '../ui';

const UserIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
);
const LockIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
);

/**
 * LoginPage
 *
 * Authentication screen that lets an existing user sign in.
 *
 * @param onSwitch - Callback to navigate to the RegisterPage (the "Create Account" link).
 *
 * Behavior: collects username/password, calls the login API, and on success
 * hands the returned JWT tokens to the AuthContext. Surfaces network vs.
 * credential errors and supports toggling password visibility.
 */
export const LoginPage: React.FC<{ onSwitch: () => void }> = ({ onSwitch }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    // Form submit handler: authenticate the user against the backend.
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            // On success the backend sets httpOnly auth cookies; we then hydrate
            // the user profile through the context (no tokens touch JS).
            await api.login(username, password);
            await login();
            // Confirm the session started (previously only failures were surfaced).
            toast(`Welcome back, ${username}!`, 'success');
        } catch (err: any) {
            console.error('Login error:', err);
            // Distinguish a server/connectivity failure from a bad-credentials response
            // so we can show the more actionable message (e.g. backend still deploying).
            const isNetworkError = err.message?.toLowerCase().includes('fetch') || 
                                 err.message?.toLowerCase().includes('failed') ||
                                 !window.navigator.onLine;

            // Tailor the user-facing message: infrastructure problem vs. wrong credentials.
            if (isNetworkError) {
                setError('Network error: The backend server is currently unreachable. Please wait 1-2 minutes for the deployment to finish or check your connection.');
            } else {
                setError('Invalid username or password. Please try again.');
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
                    <h1 className="text-3xl font-black tracking-tight text-white">Welcome back</h1>
                    <p className="mt-2 text-slate-400">Log in to continue your prep.</p>
                </div>

                <div className="rounded-4xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl">
                    {error && (
                        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 animate-fade-in">
                            <svg className="mt-0.5 h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Input
                            tone="dark"
                            label="Username"
                            leftIcon={<UserIcon />}
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            autoComplete="username"
                            required
                        />
                        <Input
                            tone="dark"
                            label="Password"
                            type={showPw ? 'text' : 'password'}
                            leftIcon={<LockIcon />}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            required
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
                            {loading ? 'Authenticating…' : 'Sign In'}
                        </Button>
                    </form>

                    <div className="mt-8 text-center text-sm">
                        <span className="text-slate-400">New to NOTCE?</span>
                        <button onClick={onSwitch} className="ml-2 font-bold text-brand-300 transition-colors hover:text-brand-200">Create Account</button>
                    </div>
                </div>

                <button onClick={() => navigate('/')} className="mt-8 w-full text-center text-sm font-medium text-slate-500 transition-colors hover:text-slate-300">
                    ← Back to Home
                </button>
            </div>
        </div>
    );
};

export default LoginPage;
