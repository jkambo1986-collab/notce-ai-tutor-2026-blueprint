import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
    user: { username: string } | null;
    login: (access: string, refresh: string, username: string) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Helper to get payload from token (simple decode)
const parseJwt = (token: string) => {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<{ username: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('auth_token');
        if (token) {
            const payload = parseJwt(token);
            // Basic check if expired
            if (payload && payload.exp * 1000 > Date.now()) {
                 // We don't have username in standard SIMPLE_JWT payload typically unless customized
                 // But let's assume valid for now or fetch profile
                 setUser({ username: payload.user_id || 'User' }); 
            } else {
                logout();
            }
        }
        setLoading(false);
    }, []);

    const login = (access: string, refresh: string, username: string) => {
        localStorage.setItem('auth_token', access);
        localStorage.setItem('refresh_token', refresh);
        setUser({ username });
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
