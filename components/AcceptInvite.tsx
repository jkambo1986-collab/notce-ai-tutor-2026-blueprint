/**
 * @file AcceptInvite.tsx
 * @description Landing page for organization invitation links
 * (`/accept-invite?token=...`, emailed by an org admin).
 *
 * Flow:
 *   - Authenticated user  -> redeem the token immediately, refresh their profile
 *     (so the new membership + inherited premium take effect), then go to /org.
 *   - Unauthenticated user -> stash the token in localStorage and send them to
 *     sign-up; App.tsx redeems the stashed token once they authenticate.
 *
 * The actual access grant is enforced server-side; this page only orchestrates
 * redemption + navigation.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

/** localStorage key holding a not-yet-redeemed invite token across signup. */
export const PENDING_INVITE_KEY = 'pending_invite_token';

const AcceptInvite: React.FC = () => {
  const { isAuthenticated, loading, refreshProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'working' | 'error'>('working');
  const [message, setMessage] = useState('Processing your invitation…');
  const handled = useRef(false);

  useEffect(() => {
    if (loading || handled.current) return;
    handled.current = true;

    const token = new URLSearchParams(location.search).get('token');
    if (!token) {
      setStatus('error');
      setMessage('This invitation link is missing its token.');
      return;
    }

    if (!isAuthenticated) {
      // Defer redemption until after sign-up/login (see App.tsx).
      try { localStorage.setItem(PENDING_INVITE_KEY, token); } catch { /* ignore */ }
      navigate('/signup', { replace: true });
      return;
    }

    (async () => {
      try {
        await api.organizations.acceptInvite(token);
        try { localStorage.removeItem(PENDING_INVITE_KEY); } catch { /* ignore */ }
        await refreshProfile(); // pull new membership + premium state
        navigate('/org', { replace: true });
      } catch (e: any) {
        setStatus('error');
        setMessage(e?.message || 'This invitation is invalid or has expired.');
      }
    })();
  }, [loading, isAuthenticated, location.search, navigate, refreshProfile]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F172A] p-6">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
        {status === 'working' ? (
          <>
            <div className="h-12 w-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h1 className="text-xl font-bold text-gray-800">{message}</h1>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Invitation problem</h1>
            <p className="text-gray-500 mb-6">{message}</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white font-bold rounded-xl"
            >
              Go home
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AcceptInvite;
