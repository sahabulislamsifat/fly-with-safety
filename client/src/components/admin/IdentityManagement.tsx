'use client';
import { useState, type FormEvent } from 'react';
import { apiRequest, ApiError } from '@/lib/api/client';

const departments = ['FLIGHT', 'HOTEL', 'VISA', 'PACKAGES', 'FINANCE', 'SUPPORT'];
/** Identifiers come from existing operations records; the server rechecks every permission. */
export function IdentityManagement({ owner }: { owner: boolean }) {
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<Array<{ id: string; action: string; reason: string; createdAt: string }> | null>(null);
  async function loadAudit() {
    setBusy(true);
    try { setAudit(await apiRequest('/identity/audit')); }
    catch (error) { setMessage(error instanceof ApiError ? error.message : 'Security audit is unavailable.'); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>, operation: 'account' | 'assign' | 'departments') {
    event.preventDefault(); setBusy(true);
    const form = event.currentTarget, data = new FormData(form), id = encodeURIComponent(String(data.get('userId')));
    const role = data.get('role');
    const path = operation === 'assign' ? '/identity/assignments' : `/identity/users/${id}${operation === 'departments' ? '/departments' : ''}`;
    const body = operation === 'assign' ? { userId: data.get('userId'), resource: data.get('resource'), resourceId: data.get('resourceId'), department: data.get('department'), active: data.get('active') === 'true' } :
      operation === 'departments' ? { departments: data.getAll('department') } : { suspended: data.get('suspended') === 'true', ...(role ? { role } : {}), reason: data.get('reason') };
    try {
      await apiRequest(path, { method: operation === 'assign' ? 'POST' : operation === 'departments' ? 'PUT' : 'PATCH', body: JSON.stringify(body) });
      form.reset(); setMessage('Change saved. Affected sessions were revoked; the employee must sign in again.');
    } catch (error) { setMessage(error instanceof ApiError ? error.message : 'Change could not complete.'); }
    finally { setBusy(false); }
  }
  const identity = <label className="block">Exact user ID<input name="userId" required maxLength={100} className="block border p-2" /></label>;
  return <section className="space-y-5"><h2 className="font-bold">Account and assignment controls</h2>
    <form className="space-y-2" onSubmit={e => void submit(e, 'account')}>{identity}
      <label>Status<select name="suspended" className="m-2 border p-2"><option value="false">Active</option><option value="true">Suspended</option></select></label>
      {owner && <label>Role<select name="role" className="m-2 border p-2"><option value="">Keep current role</option>{['CUSTOMER', 'STAFF', 'ADMIN'].map(role => <option key={role}>{role}</option>)}</select></label>}
      <label>Reason<select name="reason" className="m-2 border p-2">{['ACCOUNT_SUPPORT', 'ROLE_POLICY', 'INCIDENT_RESPONSE'].map(reason => <option key={reason}>{reason}</option>)}</select></label>
      <button disabled={busy} className="border px-4 py-2">Apply account change</button>
    </form>
    {owner && <form className="space-y-2" onSubmit={e => void submit(e, 'departments')}>{identity}<fieldset><legend>Replace delegated departments</legend>{departments.map(d => <label key={d} className="mr-3"><input type="checkbox" name="department" value={d} />{d}</label>)}</fieldset><button disabled={busy} className="border px-4 py-2">Set departments</button></form>}
    <form className="space-y-2" onSubmit={e => void submit(e, 'assign')}>{identity}
      <label>Resource<select name="resource" className="m-2 border p-2">{['booking', 'flightInquiry', 'hotelInquiry', 'visaInquiry', 'packageInquiry', 'contactMessage'].map(r => <option key={r}>{r}</option>)}</select></label>
      <label className="block">Exact record ID<input name="resourceId" required maxLength={100} className="block border p-2" /></label>
      <label>Department<select name="department" className="m-2 border p-2">{departments.map(d => <option key={d}>{d}</option>)}</select></label>
      <label>Assignment<select name="active" className="m-2 border p-2"><option value="true">Active</option><option value="false">Revoke</option></select></label>
      <button disabled={busy} className="border px-4 py-2">Apply assignment</button>
    </form><p role="status">{message}</p>
    {owner && <section className="space-y-2"><h3 className="font-bold">Security audit</h3>
      <button className="border px-4 py-2" disabled={busy} onClick={() => void loadAudit()}>Load security audit</button>
      {audit && <ul className="space-y-1 text-sm">{audit.map(row => <li key={row.id}>{row.action} · {row.reason} · {new Date(row.createdAt).toLocaleString()}</li>)}</ul>}
    </section>}
  </section>;
}
