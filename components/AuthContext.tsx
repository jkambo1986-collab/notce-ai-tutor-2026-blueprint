/**
 * @file AuthContext.tsx
 * @description App-wide authentication state via React Context. Holds the current
 * user and derives login status. The JWT access/refresh tokens live in httpOnly
 * cookies managed by the backend (never in JS/localStorage); this context simply
 * hydrates the user from /auth/me/, which authenticates via those cookies.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { api } from '../services/api';

/**
 * Shape of the auth context value exposed to consumers.
 * @property user            The authenticated user object, or null when signed out.
 * @property login           Re-hydrates the user after the cookies were set by api.login().
 * @property logout          Clears the auth cookies (server-side) and resets user to null.
 * @property refreshProfile  Re-fetches the current user from the API (cookie-authed).
 * @property isAuthenticated Convenience boolean derived from `user` being non-null.
 * @property loading         True during the initial profile fetch so the UI can gate routes.
 */
interface AuthContextType {
    user: User | null;
    login: () => Promise<void>;
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

    // Hydrate (or re-hydrate) the user from the auth cookies via /auth/me/.
    // Memoized so it is stable across renders and safe as an effect dependency.
    const refreshProfile = useCallback(async () => {
        try {
            // Cookie-authed: the API tells us who we are (or 401s when logged out,
            // after a silent refresh attempt inside the client).
            const userData = await api.getMe();
            setUser(userData);
        } catch (error) {
            // No valid session (or it expired): treat as logged out.
            setUser(null);
        } finally {
            // Initial load is resolved regardless of outcome.
            setLoading(false);
        }
    }, []);

    // On mount: prime the CSRF token, then restore any existing cookie session.
    useEffect(() => {
        api.primeCsrf().finally(() => refreshProfile());
    }, [refreshProfile]);

    // Called after api.login() has set the auth cookies: pull the full User object
    // so `user`/`isAuthenticated` reflect the signed-in state.
    const login = useCallback(async () => {
        await refreshProfile();
    }, [refreshProfile]);

    // Tear down the session: clear the cookies server-side and the in-memory user.
    const logout = () => {
        api.logout().finally(() => setUser(null));
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
