import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../AuthContext';
import { useToast } from '../ui/Feedback';

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
            // On success the API returns access/refresh tokens which we persist via AuthContext.login.
            const data = await api.login(username, password);
            login(data.access, data.refresh, username);
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
        <div className="min-h-screen flex items-center justify-center bg-[#0F172A] relative overflow-hidden px-6">
            {/* Background Accents */}
            <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-600/20 rounded-full blur-[120px]" />

            <div className="w-full max-w-md relative z-10">
                {/* Logo Area */}
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-indigo-600 rounded-2xl flex items-center justify-center font-black text-3xl shadow-2xl shadow-cyan-500/20 mb-4">
                        N
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Welcome Back</h1>
                    <p className="text-gray-400 mt-2">Log in to continue your prep.</p>
                </div>

                <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 shadow-2xl">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm flex items-center gap-3">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            {error}
                        </div>
                    )}
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Username</label>
                            <input 
                                value={username} 
                                onChange={e => setUsername(e.target.value)}
                                placeholder="Enter your username"
                                className="w-full bg-white/5 border border-white/10 focus:border-cyan-500/50 p-4 rounded-xl text-white outline-none transition-all placeholder:text-gray-600"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Password</label>
                            <div className="relative">
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-white/5 border border-white/10 focus:border-cyan-500/50 p-4 pr-12 rounded-xl text-white outline-none transition-all placeholder:text-gray-600"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(s => !s)}
                                    aria-label={showPw ? 'Hide password' : 'Show password'}
                                    className="absolute inset-y-0 right-0 px-4 flex items-center text-gray-500 hover:text-gray-300 transition"
                                >
                                    {showPw ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-cyan-500/20 transition-all active:scale-95 disabled:opacity-50 mt-4"
                        >
                            {loading ? 'Authenticating...' : 'Sign In'}
                        </button>
                    </form>
                    
                    <div className="mt-8 text-center">
                        <span className="text-gray-400 text-sm">New to NOTCE?</span>
                        <button onClick={onSwitch} className="text-white font-bold ml-2 hover:text-cyan-400 transition-colors text-sm">
                            Create Account
                        </button>
                    </div>
                </div>

                <button
                    onClick={() => navigate('/')}
                    className="mt-8 w-full text-center text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors"
                >
                    ← Back to Home
                </button>
            </div>
        </div>
    );
};

export default LoginPage;
