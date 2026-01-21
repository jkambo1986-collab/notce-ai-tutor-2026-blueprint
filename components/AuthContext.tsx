import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
    user: User | null;
    login: (access: string, refresh: string, username: string) => void;
    logout: () => void;
    refreshProfile: () => Promise<void>;
    isAuthenticated: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshProfile = useCallback(async () => {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            const userData = await api.getMe();
            setUser(userData);
        } catch (error) {
            console.error("Failed to fetch user profile:", error);
            // If fetching profile fails (e.g. token expired), we might want to logout
            // but let's be conservative for now and just set user null
            setUser(null);
            localStorage.removeItem('auth_token');
            localStorage.removeItem('refresh_token');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshProfile();
    }, [refreshProfile]);

    const login = (access: string, refresh: string, username: string) => {
        localStorage.setItem('auth_token', access);
        localStorage.setItem('refresh_token', refresh);
        // Immediately refresh profile after login to get full User object
        refreshProfile();
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, refreshProfile, isAuthenticated: !!user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
