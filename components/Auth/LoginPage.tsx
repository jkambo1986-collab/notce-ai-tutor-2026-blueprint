import React, { useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../AuthContext';

export const LoginPage: React.FC<{ onSwitch: () => void }> = ({ onSwitch }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await api.login(username, password);
            login(data.access, data.refresh, username);
        } catch (err) {
            setError('Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md w-96">
                <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">NOTCE AI-Tutor Login</h2>
                {error && <div className="bg-red-50 text-red-600 p-2 rounded mb-4 text-sm">{error}</div>}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Username</label>
                        <input 
                            value={username} 
                            onChange={e => setUsername(e.target.value)}
                            className="w-full p-2 border rounded mt-1 focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input 
                            type="password"
                            value={password} 
                            onChange={e => setPassword(e.target.value)}
                            className="w-full p-2 border rounded mt-1 focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 transition disabled:opacity-50"
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
                
                <div className="mt-4 text-center text-sm">
                    Don't have an account? 
                    <button onClick={onSwitch} className="text-blue-600 font-bold ml-1 hover:underline">
                        Register
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
