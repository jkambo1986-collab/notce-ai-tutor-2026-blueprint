/**
 * @file OrgConsole.tsx
 * @description B2B organization console — the admin/instructor surface for a
 * tenant (school / OT program / cohort buyer).
 *
 * Role-gated by the caller's membership role (from `useAuth().user.memberships`):
 *   - instructor: sees cohort analytics + roster (read-only)
 *   - admin / owner: additionally manage seats, invites, roles, and removals
 *
 * All data comes from the tenant-scoped /organizations/ API, which enforces the
 * real access control server-side; this UI only hides controls the user can't use.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../services/api';
import { Organization, OrgMember, OrgAnalytics, OrgMembership, OrgRole } from '../types';

const MANAGER_ROLES: OrgRole[] = ['owner', 'admin', 'instructor'];
const ROLE_LABEL: Record<OrgRole, string> = {
  owner: 'Owner', admin: 'Admin', instructor: 'Instructor', member: 'Student',
};

const card = 'bg-white rounded-2xl border border-gray-200 p-5 shadow-sm';

const OrgConsole: React.FC = () => {
  const { user } = useAuth();

  // Orgs where the user can manage/instruct.
  const managerOrgs: OrgMembership[] = useMemo(
    () => (user?.memberships || []).filter(m => MANAGER_ROLES.includes(m.role)),
    [user]
  );

  const [orgId, setOrgId] = useState<number | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('member');
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const myRole: OrgRole | null = useMemo(
    () => managerOrgs.find(m => m.org_id === orgId)?.role ?? null,
    [managerOrgs, orgId]
  );
  const canManage = myRole === 'owner' || myRole === 'admin';

  // Default to the first manageable org once memberships load.
  useEffect(() => {
    if (orgId === null && managerOrgs.length > 0) setOrgId(managerOrgs[0].org_id);
  }, [managerOrgs, orgId]);

  const load = React.useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      // Analytics requires instructor+, members requires instructor+ — both allowed here.
      const [orgData, analyticsData, memberData] = await Promise.all([
        api.organizations.get(id),
        api.organizations.analytics(id),
        api.organizations.members(id),
      ]);
      setOrg(orgData);
      setAnalytics(analyticsData);
      setMembers(memberData);
    } catch (e: any) {
      setError(e?.message || 'Failed to load organization data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (orgId !== null) load(orgId);
  }, [orgId, load]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !inviteEmail.trim()) return;
    setActionMsg(null);
    try {
      await api.organizations.invite(orgId, inviteEmail.trim(), inviteRole);
      setActionMsg(`Invitation sent to ${inviteEmail.trim()}.`);
      setInviteEmail('');
      load(orgId);
    } catch (e: any) {
      setActionMsg(e?.message || 'Invite failed');
    }
  };

  const handleSetRole = async (userId: number, role: OrgRole) => {
    if (!orgId) return;
    try {
      await api.organizations.setRole(orgId, userId, role);
      load(orgId);
    } catch (e: any) {
      setActionMsg(e?.message || 'Could not update role');
    }
  };

  const handleRemove = async (userId: number, username: string) => {
    if (!orgId) return;
    if (!window.confirm(`Remove ${username} from this organization? This frees their seat.`)) return;
    try {
      await api.organizations.removeMember(orgId, userId);
      load(orgId);
    } catch (e: any) {
      setActionMsg(e?.message || 'Could not remove member');
    }
  };

  const handleBuySeats = async () => {
    if (!orgId) return;
    const input = window.prompt('How many seats would you like to purchase?', '10');
    const seats = Number(input);
    if (!seats || seats < 1) return;
    try {
      const { url } = await api.organizations.checkoutSeats(orgId, seats);
      window.location.href = url;
    } catch (e: any) {
      setActionMsg(e?.message || 'Seat checkout is unavailable right now.');
    }
  };

  // --- Empty state: user manages no org ---
  if (managerOrgs.length === 0) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className={`${card} max-w-xl mx-auto text-center`}>
          <h2 className="text-xl font-bold text-gray-800">No organization access</h2>
          <p className="text-gray-500 mt-2">
            You're not an admin or instructor of any organization. If your school or program
            uses NOTCE AI-Tutor, ask your administrator for an invite.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header + org switcher */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">{org?.name || 'Organization'}</h1>
          <p className="text-sm text-gray-500">
            Your role: <span className="font-semibold text-teal-700">{myRole ? ROLE_LABEL[myRole] : '—'}</span>
          </p>
        </div>
        {managerOrgs.length > 1 && (
          <select
            value={orgId ?? ''}
            onChange={e => setOrgId(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold bg-white"
          >
            {managerOrgs.map(m => <option key={m.org_id} value={m.org_id}>{m.org_name}</option>)}
          </select>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">{error}</div>}
      {actionMsg && <div className="bg-teal-50 border border-teal-200 text-teal-800 rounded-xl px-4 py-3">{actionMsg}</div>}

      {loading ? (
        <div className="text-gray-400 py-12 text-center">Loading…</div>
      ) : (
        <>
          {/* Seat / license + summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={card}>
              <p className="text-xs uppercase tracking-wide text-gray-400 font-bold">Seats</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1">
                {org?.seats_used}<span className="text-gray-400 text-lg">/{org?.seats_total}</span>
              </p>
              <p className={`text-xs mt-1 font-semibold ${org?.has_active_license ? 'text-teal-600' : 'text-amber-600'}`}>
                {org?.has_active_license ? 'License active' : 'License inactive'}
              </p>
            </div>
            <div className={card}>
              <p className="text-xs uppercase tracking-wide text-gray-400 font-bold">Members</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1">{analytics?.summary.members ?? 0}</p>
              <p className="text-xs text-gray-400 mt-1">{analytics?.summary.active_learners ?? 0} active</p>
            </div>
            <div className={card}>
              <p className="text-xs uppercase tracking-wide text-gray-400 font-bold">Questions answered</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1">{analytics?.summary.answered ?? 0}</p>
            </div>
            <div className={card}>
              <p className="text-xs uppercase tracking-wide text-gray-400 font-bold">Cohort accuracy</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1">
                {analytics?.summary.accuracy != null ? `${analytics.summary.accuracy}%` : '—'}
              </p>
            </div>
          </div>

          {/* Admin: invite + seats */}
          {canManage && (
            <div className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-bold text-gray-800">Manage members</h2>
                <button
                  onClick={handleBuySeats}
                  className="text-sm font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg px-3 py-1.5"
                >
                  Buy seats
                </button>
              </div>
              <form onSubmit={handleInvite} className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Invite by email</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="student@school.ca"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Role</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as OrgRole)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="member">Student</option>
                    <option value="instructor">Instructor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" className="bg-teal-500 hover:bg-teal-400 text-white font-bold rounded-lg px-4 py-2 text-sm">
                  Send invite
                </button>
              </form>
              {org && org.seats_available <= 0 && org.seats_total > 0 && (
                <p className="text-xs text-amber-600 mt-2 font-semibold">No seats available — buy more before inviting new members.</p>
              )}
            </div>
          )}

          {/* Roster + per-student performance */}
          <div className={card}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Cohort</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="py-2 pr-4 font-semibold">Student</th>
                    <th className="py-2 pr-4 font-semibold">Role</th>
                    <th className="py-2 pr-4 font-semibold">Answered</th>
                    <th className="py-2 pr-4 font-semibold">Accuracy</th>
                    {canManage && <th className="py-2 pr-4 font-semibold">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => {
                    const stat = analytics?.students.find(s => s.user_id === m.user.id);
                    return (
                      <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-4">
                          <div className="font-semibold text-gray-800">{m.user.username}</div>
                          <div className="text-xs text-gray-400">{m.user.email}</div>
                        </td>
                        <td className="py-2 pr-4">
                          {canManage && m.role !== 'owner' ? (
                            <select
                              value={m.role}
                              onChange={e => handleSetRole(m.user.id, e.target.value as OrgRole)}
                              className="border border-gray-200 rounded px-2 py-1 text-xs bg-white"
                            >
                              <option value="member">Student</option>
                              <option value="instructor">Instructor</option>
                              <option value="admin">Admin</option>
                              {myRole === 'owner' && <option value="owner">Owner</option>}
                            </select>
                          ) : (
                            <span className="text-gray-600">{ROLE_LABEL[m.role]}</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-gray-700">{stat?.answered ?? 0}</td>
                        <td className="py-2 pr-4 text-gray-700">{stat?.accuracy != null ? `${stat.accuracy}%` : '—'}</td>
                        {canManage && (
                          <td className="py-2 pr-4">
                            {m.role !== 'owner' && (
                              <button
                                onClick={() => handleRemove(m.user.id, m.user.username)}
                                className="text-xs font-semibold text-red-500 hover:text-red-700"
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {members.length === 0 && (
                    <tr><td colSpan={canManage ? 5 : 4} className="py-6 text-center text-gray-400">No members yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OrgConsole;
