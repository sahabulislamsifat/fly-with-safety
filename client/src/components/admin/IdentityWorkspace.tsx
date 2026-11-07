'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { apiRequest, ApiError } from '@/lib/api/client';
import { AdminPortal } from './AdminPortal';
import { IdentityManagement } from './IdentityManagement';

type Scope = { role: 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'SUPER_ADMIN'; departments: string[]; mfaVerified: boolean };
export function IdentityWorkspace({ owner = false }: { owner?: boolean }) {
  const { user } = useAuth();
  return <Workspace key={user?.id || 'anonymous'} owner={owner} />;
}
function Workspace({ owner }: { owner: boolean }) {
  const { user, isLoading } = useAuth();
  const [scope, setScope] = useState<Scope | null>(null), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (user) void apiRequest<Scope>('/identity/me').then(value => { if (active) setScope(value); }, () => { if (active) setMessage('Identity workspace is unavailable.'); });
    return () => { active = false; };
  }, [user]);
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form = event.currentTarget, data = new FormData(form);
    try {
      const result = await apiRequest<{ delivery: string }>('/identity/invitations', { method: 'POST', body: JSON.stringify({
        email: data.get('email'), role: data.get('role'), departments: data.getAll('department'),
      }) });
      setMessage(result.delivery === 'SUBMITTED' ? 'Invitation submitted to the employee email.' : 'Invitation delivery needs an approved private mail configuration.');
      form.reset();
    } catch (error) { setMessage(error instanceof ApiError ? error.message : 'Invitation could not complete.'); }
    finally { setBusy(false); }
  }
  if (isLoading) return <p className="container py-8" role="status">Checking session…</p>;
  if (!user || !['ADMIN', 'STAFF', 'SUPER_ADMIN'].includes(user.role) || (owner && user.role !== 'SUPER_ADMIN')) return <p className="container py-8">Authorized workspace access is required.</p>;
  return <div><section className="container space-y-4 py-6">
    <h1 className="text-2xl font-bold">{owner ? 'Super Admin Control Center' : user.role === 'ADMIN' ? 'Admin Operations Console' : 'Department Staff Workspace'}</h1>
    <Link className="underline" href="/account/security">Security and MFA verification</Link>
    {scope && <p>{scope.role} · {scope.departments.join(', ') || 'No delegated departments'} · {scope.mfaVerified ? 'MFA verified' : 'MFA required'}</p>}
    <p role="status">{message}</p>
    {scope?.mfaVerified && ['ADMIN', 'SUPER_ADMIN'].includes(scope.role) && <form className="space-y-2" onSubmit={event => void invite(event)}>
      <h2 className="font-bold">Invite an individual employee</h2>
      <label className="block">Employee email<input className="block border p-2" name="email" type="email" required /></label>
      <label>Role<select className="m-2 border p-2" name="role"><option value="STAFF">Staff</option>{scope.role === 'SUPER_ADMIN' && <option value="ADMIN">Admin</option>}</select></label>
      <fieldset><legend>Authorized departments</legend>{(scope.role === 'SUPER_ADMIN' ? ['FLIGHT', 'HOTEL', 'VISA', 'PACKAGES', 'FINANCE', 'SUPPORT'] : scope.departments).map(d => <label className="mr-4 inline-block" key={d}><input type="checkbox" name="department" value={d} /> {d}</label>)}</fieldset>
      <button className="border px-4 py-2" disabled={busy}>Send invitation</button>
    </form>}
    {scope?.mfaVerified && ['ADMIN', 'SUPER_ADMIN'].includes(scope.role) && <IdentityManagement owner={scope.role === 'SUPER_ADMIN'} />}
  </section>{scope?.mfaVerified && <AdminPortal />}</div>;
}
