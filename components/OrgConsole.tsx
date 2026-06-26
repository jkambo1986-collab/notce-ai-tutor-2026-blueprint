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
import { Organization, OrgMember, OrgAnalytics, OrgMembership, OrgRole, CohortAssignment } from '../types';
import { DomainTag } from '../types';
import { DOMAIN_INFO } from '../constants';

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
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<CohortAssignment[]>([]);
  const [newAssignment, setNewAssignment] = useState({ title: '', domain: '', target_questions: 20, due_date: '' });
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

  // At-risk learners (F5): students who've practised but are below the pass line.
  // Surfaced so instructors can intervene early instead of reading the whole table.
  const atRiskIds = useMemo(() => {
    const ids = new Set<number>();
    for (const s of analytics?.students || []) {
      if (s.role === 'member' && s.answered > 0 && s.accuracy != null && s.accuracy < 60) {
        ids.add(s.user_id);
      }
    }
    return ids;
  }, [analytics]);
  const inactiveCount = (analytics?.students || []).filter(s => s.role === 'member' && s.answered === 0).length;

  // Default to the first manageable org once memberships load.
  useEffect(() => {
    if (orgId === null && managerOrgs.length > 0) setOrgId(managerOrgs[0].org_id);
  }, [managerOrgs, orgId]);

  const load = React.useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      // Analytics requires instructor+, members requires instructor+ — both allowed here.
      const [orgData, analyticsData, memberData, assignmentData] = await Promise.all([
        api.organizations.get(id),
        api.organizations.analytics(id),
        api.organizations.members(id),
        api.organizations.assignments(id),
      ]);
      setOrg(orgData);
      setAnalytics(analyticsData);
      setMembers(memberData);
      setAssignments(assignmentData);
    } catch (e: any) {
      setError(e?.message || 'Failed to load organization data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (orgId !== null) load(orgId);
  }, [orgId, load]);

  // Pending invites are admin-only; load them separately so an instructor's view
  // (which would 403 here) isn't broken by the roster/analytics fetch.
  const refreshInvites = React.useCallback(async (id: number) => {
    try { setPendingInvites(await api.organizations.pendingInvites(id)); }
    catch { setPendingInvites([]); }
  }, []);

  useEffect(() => {
    if (orgId !== null && canManage) refreshInvites(orgId);
    else setPendingInvites([]);
  }, [orgId, canManage, refreshInvites]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !inviteEmail.trim()) return;
    setActionMsg(null);
    try {
      await api.organizations.invite(orgId, inviteEmail.trim(), inviteRole);
      setActionMsg(`Invitation sent to ${inviteEmail.trim()}.`);
      setInviteEmail('');
      refreshInvites(orgId);
    } catch (e: any) {
      setActionMsg(e?.message || 'Invite failed');
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !newAssignment.title.trim()) return;
    try {
      await api.organizations.createAssignment(orgId, {
        title: newAssignment.title.trim(),
        domain: newAssignment.domain || '',
        target_questions: Number(newAssignment.target_questions) || 20,
        due_date: newAssignment.due_date || null,
      });
      setNewAssignment({ title: '', domain: '', target_questions: 20, due_date: '' });
      setAssignments(await api.organizations.assignments(orgId));
      setActionMsg('Assignment posted to your cohort.');
    } catch (e: any) {
      setActionMsg(e?.message || 'Could not create assignment');
    }
  };

  const handleArchiveAssignment = async (id: number) => {
    if (!orgId) return;
    try {
      await api.organizations.archiveAssignment(orgId, id);
      setAssignments(prev => prev.filter(a => a.id !== id));
    } catch (e: any) {
      setActionMsg(e?.message || 'Could not archive assignment');
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

          {/* At-risk strip: early-warning so instructors can intervene. */}
          {(atRiskIds.size > 0 || inactiveCount > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 text-sm text-amber-800 flex flex-wrap gap-x-6 gap-y-1">
              {atRiskIds.size > 0 && (
                <span><span className="font-bold">{atRiskIds.size}</span> student{atRiskIds.size === 1 ? '' : 's'} below the 60% pass line</span>
              )}
              {inactiveCount > 0 && (
                <span><span className="font-bold">{inactiveCount}</span> ha{inactiveCount === 1 ? "sn't" : "ven't"} started practising yet</span>
              )}
            </div>
          )}

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

              {pendingInvites.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <p className="text-xs uppercase tracking-wide text-gray-400 font-bold mb-2">
                    Pending invites ({pendingInvites.length})
                  </p>
                  <ul className="space-y-1">
                    {pendingInvites.map(inv => (
                      <li key={inv.id} className="flex items-center justify-between text-sm text-gray-600">
                        <span>{inv.email}</span>
                        <span className="text-xs text-gray-400">{ROLE_LABEL[inv.role as OrgRole] ?? inv.role}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Cohort assignments (F5): instructors set targets students see on Home. */}
          <div className={card}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Assignments</h2>
            <form onSubmit={handleCreateAssignment} className="flex flex-wrap gap-2 items-end mb-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Title</label>
                <input
                  value={newAssignment.title}
                  onChange={e => setNewAssignment(a => ({ ...a, title: e.target.value }))}
                  placeholder="e.g. Drill Professional Responsibility"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Domain</label>
                <select
                  value={newAssignment.domain}
                  onChange={e => setNewAssignment(a => ({ ...a, domain: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">Any</option>
                  {Object.values(DomainTag).map(d => (
                    <option key={d} value={d}>{(DOMAIN_INFO as Record<string, { label: string }>)[d]?.label || d}</option>
                  ))}
                </select>
              </div>
              <div className="w-20">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Target</label>
                <input
                  type="number" min={1}
                  value={newAssignment.target_questions}
                  onChange={e => setNewAssignment(a => ({ ...a, target_questions: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Due</label>
                <input
                  type="date"
                  value={newAssignment.due_date}
                  onChange={e => setNewAssignment(a => ({ ...a, due_date: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <button type="submit" className="bg-teal-500 hover:bg-teal-400 text-white font-bold rounded-lg px-4 py-2 text-sm">Post</button>
            </form>
            {assignments.length === 0 ? (
              <p className="text-sm text-gray-400">No active assignments.</p>
            ) : (
              <ul className="space-y-2">
                {assignments.map(a => (
                  <li key={a.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{a.title}</p>
                      <p className="text-xs text-gray-400">
                        {a.domain ? `${(DOMAIN_INFO as Record<string, { label: string }>)[a.domain]?.label || a.domain} · ` : ''}
                        {a.target_questions} questions{a.due_date ? ` · due ${a.due_date}` : ''}
                      </p>
                    </div>
                    <button onClick={() => handleArchiveAssignment(a.id)} className="text-xs font-semibold text-gray-400 hover:text-red-600">Archive</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800">{m.user.username}</span>
                            {atRiskIds.has(m.user.id) && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700" title="Below the 60% pass line">At risk</span>
                            )}
                          </div>
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
