import React, { useState } from 'react';
import { api } from '../../services/api';

export const RegisterPage: React.FC<{ onSwitch: () => void }> = ({ onSwitch }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.register(username, password);
            alert("Registration successful! Please login.");
            onSwitch();
        } catch (err: any) {
            console.error('Registration error:', err);
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
        <div className="min-h-screen flex items-center justify-center bg-[#0F172A] relative overflow-hidden px-6">
             {/* Background Accents */}
             <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-600/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px]" />

            <div className="w-full max-w-md relative z-10">
                {/* Logo Area */}
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-cyan-600 rounded-2xl flex items-center justify-center font-black text-3xl shadow-2xl shadow-emerald-500/20 mb-4">
                        N
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Join NOTCE Prep</h1>
                    <p className="text-gray-400 mt-2">Start your journey to mastery.</p>
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
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Choose Username</label>
                            <input 
                                value={username} 
                                onChange={e => setUsername(e.target.value)}
                                placeholder="Future OT Expert"
                                className="w-full bg-white/5 border border-white/10 focus:border-emerald-500/50 p-4 rounded-xl text-white outline-none transition-all placeholder:text-gray-600"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Secure Password</label>
                            <input 
                                type="password"
                                value={password} 
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-white/5 border border-white/10 focus:border-emerald-500/50 p-4 rounded-xl text-white outline-none transition-all placeholder:text-gray-600"
                                required
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-emerald-500 to-cyan-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 mt-4"
                        >
                            {loading ? 'Creating Account...' : 'Create Account'}
                        </button>
                    </form>
                    
                    <div className="mt-8 text-center">
                        <span className="text-gray-400 text-sm">Already a member?</span>
                        <button onClick={onSwitch} className="text-white font-bold ml-2 hover:text-emerald-400 transition-colors text-sm">
                            Sign In
                        </button>
                    </div>
                </div>

                <button 
                    onClick={() => window.location.reload()}
                    className="mt-8 w-full text-center text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors"
                >
                    ← Back to Home
                </button>
            </div>
        </div>
    );
};

export default RegisterPage;
