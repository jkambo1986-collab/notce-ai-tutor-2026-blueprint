import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useToast } from '../ui/Feedback';
import { Button } from '../ui';

/**
 * VerifyEmailPage
 *
 * Landing page hit from the email-verification link. Reads the `token` from the
 * URL query string, confirms it with the backend, and renders one of three
 * states: verifying (spinner), success, or error. Takes no props.
 */
export const VerifyEmailPage: React.FC = () => {
    const toast = useToast();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [message, setMessage] = useState('');
    // Seconds until we auto-redirect to login after a successful verification.
    const [redirectIn, setRedirectIn] = useState(4);

    // Guard against the verify call firing twice (e.g. React StrictMode double-invokes effects),
    // which would consume a single-use token on the second run and cause a false failure.
    const verifyingRef = React.useRef(false);

    useEffect(() => {
        const verify = async () => {
             if (verifyingRef.current) return;
             verifyingRef.current = true;

            // The verification token is passed as a ?token= query param in the email link.
            const params = new URLSearchParams(window.location.search);
            const token = params.get('token');

            // No token means the link was malformed or visited directly; fail fast.
            if (!token) {
                setStatus('error');
                setMessage('No verification token found.');
                return;
            }

            try {
                // Backend marks the account verified; any rejection (expired/invalid) lands in catch.
                await api.verifyEmail(token);
                setStatus('success');
            } catch (err: any) {
                setStatus('error');
                setMessage(err.message || 'Verification failed. Link may be expired.');
            }
        };

        verify();
    }, []);

    // On success: confirm with a toast and auto-redirect to login with a visible countdown.
    useEffect(() => {
        if (status !== 'success') return;
        toast('Email verified — your account is active!', 'success');
        const timer = setInterval(() => {
            setRedirectIn((s) => {
                if (s <= 1) {
                    clearInterval(timer);
                    navigate('/signin');
                    return 0;
                }
                return s - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [status, toast, navigate]);

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B1120] px-6">
            {/* Ambient brand glows */}
            <div className="pointer-events-none absolute -right-[10%] -top-[20%] h-[55%] w-[55%] rounded-full bg-brand-600/20 blur-[130px]" />
            <div className="pointer-events-none absolute -bottom-[20%] -left-[10%] h-[55%] w-[55%] rounded-full bg-teal-400/15 blur-[130px]" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

            <div className="relative z-10 w-full max-w-md animate-fade-in-up rounded-4xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl backdrop-blur-xl">
                {status === 'verifying' && (
                    <>
                        <div className="mx-auto mb-6 h-16 w-16 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"></div>
                        <h2 className="mb-2 text-2xl font-black tracking-tight text-white">Verifying…</h2>
                        <p className="text-slate-400">Please wait while we activate your account.</p>
                    </>
                )}

                {status === 'success' && (
                    <div className="animate-scale-in">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-glow-teal">
                            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h2 className="mb-2 text-2xl font-black tracking-tight text-white">Email Verified!</h2>
                        <p className="mb-8 text-slate-400">
                            Your account is now fully active. Redirecting you to login in {redirectIn}s…
                        </p>
                        <Button onClick={() => navigate('/signin')} size="lg" fullWidth>
                            Continue to Login Now
                        </Button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="animate-scale-in">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl border border-red-500/20 bg-red-500/10 text-red-300">
                            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        </div>
                        <h2 className="mb-2 text-2xl font-black tracking-tight text-white">Verification Failed</h2>
                        <p className="mb-8 text-slate-400">{message}</p>
                        <Button onClick={() => navigate('/signin')} variant="secondary" size="lg" fullWidth>
                            Back to Sign In
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
