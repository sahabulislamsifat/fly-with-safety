'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiRequest, ApiError } from '@/lib/api/client';
export default function InvitationPage() {
  const [token, setToken] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const initialToken = useRef<string | null>(null);
  useEffect(() => {
    if (initialToken.current === null) initialToken.current = window.location.hash.slice(1);
    const value = initialToken.current; window.history.replaceState(null, '', '/invite');
    const timer = window.setTimeout(() => setToken(/^[A-Za-z0-9_-]{43}$/.test(value) ? value : ''), 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form = event.currentTarget, data = new FormData(form);
    try {
      await apiRequest('/identity/invitations/accept', { method: 'POST', body: JSON.stringify({ token, name: data.get('name'), password: data.get('password') }) });
      setToken(''); initialToken.current = ''; form.reset(); setMessage('Individual account activated. Sign in, then enroll your authenticator in Account security.');
    } catch (error) { setMessage(error instanceof ApiError ? error.message : 'Invitation could not complete.'); }
    finally { setBusy(false); }
  }
  return <section className="container max-w-xl space-y-4 py-8"><h1 className="text-2xl font-bold">Set up your individual account</h1>
    <form className="space-y-3" onSubmit={event => void accept(event)}><label className="block">Name<input className="block w-full border p-2" name="name" required minLength={2} maxLength={100} /></label>
      <label className="block">Personal password (8–128 characters, uppercase, lowercase and number)<input className="block w-full border p-2" type="password" name="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label><button className="border px-4 py-2" disabled={busy || !token}>Activate account</button></form><p role="status">{message || (!token ? 'Open your private invitation link to continue.' : '')}</p></section>;
}
