'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthProvider';
import { apiRequest, ApiError } from '@/lib/api/client';

export function IdentitySecurity() {
  const { user } = useAuth();
  if (!user) return <p className="container py-8">Sign in to manage your account security.</p>;
  return <SecurityForms key={user.id} />;
}
function SecurityForms() {
  const [secret, setSecret] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>, operation: 'enroll' | 'confirm' | 'verify' | 'recover') {
    event.preventDefault(); setBusy(true); setMessage('');
    const form = event.currentTarget, data = new FormData(form);
    try {
      const result = await apiRequest<{ secret?: string; recoveryCodes?: string[] }>(`/identity/mfa/${operation}`, {
        method: 'POST', body: JSON.stringify(operation === 'enroll' ? { password: data.get('password') } : { code: data.get('code') }),
      });
      form.reset();
      if (operation === 'enroll') setSecret(result.secret || '');
      if (operation === 'confirm') { setSecret(''); setCodes(result.recoveryCodes || []); }
      setMessage(operation === 'enroll' ? 'Add the secret to your authenticator, then confirm its code.' : 'Security check completed. Return to your workspace.');
    } catch (error) { setMessage(error instanceof ApiError ? error.message : 'Security check could not complete.'); }
    finally { setBusy(false); }
  }
  return <section className="container max-w-2xl space-y-5 py-8">
    <h1 className="text-2xl font-bold">Account security</h1>
    <p>Privileged work requires a recent second-factor check. Store recovery codes privately.</p>
    <form className="space-y-2" onSubmit={event => void submit(event, 'enroll')}>
      <label className="block">Current password<input className="block w-full border p-2" name="password" type="password" autoComplete="current-password" required maxLength={128} /></label>
      <button className="rounded border px-4 py-2" disabled={busy}>Begin authenticator setup</button>
    </form>
    {secret && <div className="space-y-2"><p>Authenticator secret</p><code className="block break-all select-all">{secret}</code>
      <form onSubmit={event => void submit(event, 'confirm')}><label>Confirmation code<input className="block border p-2" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /></label><button disabled={busy} className="border px-4 py-2">Confirm setup</button></form></div>}
    <form onSubmit={event => void submit(event, 'verify')}><label>Authenticator code<input className="block border p-2" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /></label><button disabled={busy} className="border px-4 py-2">Verify second factor</button></form>
    <details><summary>Use a recovery code</summary><form onSubmit={event => void submit(event, 'recover')}><label>Private recovery code<input className="block w-full border p-2" type="password" name="code" autoComplete="off" pattern="[a-f0-9]{32}" required /></label><button disabled={busy} className="border px-4 py-2">Use code once</button></form></details>
    {codes.length > 0 && <div><p>Save these one-use recovery codes privately.</p><pre className="overflow-auto">{codes.join('\n')}</pre><button className="border px-4 py-2" onClick={() => setCodes([])}>I have saved them</button></div>}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
