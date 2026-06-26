import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useToast } from '../ui/Feedback';

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
        <div className="min-h-screen flex items-center justify-center bg-[#0F172A] px-6">
            <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 shadow-2xl max-w-md w-full text-center">
                {status === 'verifying' && (
                    <>
                        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                        <h2 className="text-2xl font-bold text-white mb-2">Verifying...</h2>
                        <p className="text-gray-400">Please wait while we activate your account.</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Email Verified!</h2>
                        <p className="text-gray-400 mb-6">
                            Your account is now fully active. Redirecting you to login in {redirectIn}s…
                        </p>
                        <button
                            onClick={() => navigate('/signin')}
                            className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-600 transition-colors w-full"
                        >
                            Continue to Login Now
                        </button>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Verification Failed</h2>
                        <p className="text-gray-400 mb-6">{message}</p>
                        <button
                            onClick={() => navigate('/signin')}
                            className="bg-white/10 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors w-full"
                        >
                            Back to Sign In
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
