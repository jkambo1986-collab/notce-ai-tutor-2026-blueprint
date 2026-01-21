import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

export const VerifyEmailPage: React.FC = () => {
    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [message, setMessage] = useState('');

    const verifyingRef = React.useRef(false);

    useEffect(() => {
        const verify = async () => {
             if (verifyingRef.current) return;
             verifyingRef.current = true;

            const params = new URLSearchParams(window.location.search);
            const token = params.get('token');

            if (!token) {
                setStatus('error');
                setMessage('No verification token found.');
                return;
            }

            try {
                await api.verifyEmail(token);
                setStatus('success');
            } catch (err: any) {
                setStatus('error');
                setMessage(err.message || 'Verification failed. Link may be expired.');
            }
        };

        verify();
    }, []);

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
                        <p className="text-gray-400 mb-6">Your account is now fully active.</p>
                        <button 
                            onClick={() => window.location.href = '/'}
                            className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-600 transition-colors w-full"
                        >
                            Continue to Login
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
                            onClick={() => window.location.href = '/'}
                            className="bg-white/10 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors w-full"
                        >
                            Back to Home
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
