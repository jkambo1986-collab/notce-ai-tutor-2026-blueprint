/**
 * @file AuthContext.tsx
 * @description App-wide authentication state via React Context. Holds the current user,
 * derives login status, and brokers JWT token storage in localStorage. Components read
 * this state through the `useAuth` hook rather than threading props down the tree.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { api } from '../services/api';

/**
 * Shape of the auth context value exposed to consumers.
 * @property user            The authenticated user object, or null when signed out.
 * @property login           Persists JWT tokens and (re)loads the user profile.
 * @property logout          Clears tokens and resets user to null.
 * @property refreshProfile  Re-fetches the current user from the API using the stored token.
 * @property isAuthenticated Convenience boolean derived from `user` being non-null.
 * @property loading         True during the initial profile fetch so the UI can gate routes.
 */
interface AuthContextType {
    user: User | null;
    login: (access: string, refresh: string, username: string) => void;
    logout: () => void;
    refreshProfile: () => Promise<void>;
    isAuthenticated: boolean;
    loading: boolean;
}

// The context object. Default is an empty cast: the real value is always supplied by
// AuthProvider, so consumers under the provider receive the live implementation.
const AuthContext = createContext<AuthContextType>({} as AuthContextType);

/**
 * AuthProvider owns the authentication state and makes it available to all descendants.
 *
 * Token storage strategy: the JWT access/refresh pair lives in localStorage (keys
 * `auth_token` / `refresh_token`) so the session survives reloads. The presence of a token
 * is the source of truth for "is there a session"; the actual `user` object is hydrated by
 * calling the API. This is the provider half of the provider/consumer pattern — `useAuth`
 * is the consumer half.
 *
 * @param children Subtree that gains access to the auth context.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // The resolved user profile; null means logged out (or not yet hydrated).
    const [user, setUser] = useState<User | null>(null);
    // Tracks the in-flight initial fetch so callers can show a spinner instead of
    // briefly flashing the logged-out UI before the token check completes.
    const [loading, setLoading] = useState(true);

    // Hydrate (or re-hydrate) the user from the stored token. Memoized with useCallback so
    // it is stable across renders and safe to use as an effect dependency.
    const refreshProfile = useCallback(async () => {
        const token = localStorage.getItem('auth_token');
        // No token => definitively logged out; skip the network call.
        if (!token) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            // Token present: ask the API who we are (also validates the token server-side).
            const userData = await api.getMe();
            setUser(userData);
        } catch (error) {
            console.error("Failed to fetch user profile:", error);
            // If fetching profile fails (e.g. token expired), we might want to logout
            // but let's be conservative for now and just set user null
            // Treat a failed fetch as a dead session: drop the user and purge stale tokens.
            setUser(null);
            localStorage.removeItem('auth_token');
            localStorage.removeItem('refresh_token');
        } finally {
            // Initial load is resolved regardless of outcome.
            setLoading(false);
        }
    }, []);

    // Run once on mount to restore any existing session from localStorage.
    useEffect(() => {
        refreshProfile();
    }, [refreshProfile]);

    // Called after a successful credential exchange: stash the new tokens, then pull the
    // full User object so `user`/`isAuthenticated` reflect the signed-in state.
    const login = (access: string, refresh: string, username: string) => {
        localStorage.setItem('auth_token', access);
        localStorage.setItem('refresh_token', refresh);
        // Immediately refresh profile after login to get full User object
        refreshProfile();
    };

    // Tear down the session: remove tokens and clear the in-memory user.
    const logout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
    };

    // Expose state + actions to the tree. `isAuthenticated` is derived here so consumers
    // never have to recompute it.
    return (
        <AuthContext.Provider value={{ user, login, logout, refreshProfile, isAuthenticated: !!user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

/** Consumer hook: returns the current auth context. Must be used within an AuthProvider. */
export const useAuth = () => useContext(AuthContext);
