'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiError } from '@/lib/api';
import { register, requestPasswordReset, resendVerification, resetPassword, verifyEmail } from '@/lib/api/auth';

type Flow = 'register' | 'verify' | 'forgot' | 'reset';
const input = 'w-full rounded-xs border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red';

export function AuthFlowPage({ flow }: { flow: Flow }) {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState(params.get('email') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = params.get('token') || '';

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setMessage('');
    if ((flow === 'register' || flow === 'reset') && password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if ((flow === 'register' || flow === 'reset') && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/.test(password)) { setError('Use 8+ characters with uppercase, lowercase, and a number.'); return; }
    if ((flow === 'verify' || flow === 'reset') && !token) { setError('This link is missing a valid token.'); return; }
    setIsSubmitting(true);
    try {
      if (flow === 'register') { await register({ name, email, password }); setMessage('Account created. Check your email to verify your address.'); }
      if (flow === 'verify') { await verifyEmail(token); setMessage('Email verified. You can now sign in.'); }
      if (flow === 'forgot') { await requestPasswordReset(email); setMessage('If an account exists, a reset link has been sent.'); }
      if (flow === 'reset') { await resetPassword(token, password); setMessage('Password reset. Redirecting to sign in…'); setTimeout(() => router.push('/?auth=reset'), 1200); }
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to complete this request.'); }
    finally { setIsSubmitting(false); }
  };

  const title = { register: 'Create your account', verify: 'Verify your email', forgot: 'Reset your password', reset: 'Choose a new password' }[flow];
  const subtitle = { register: 'Keep bookings, travellers, and updates in one place.', verify: 'Confirm your email address to activate your account.', forgot: 'Enter your email and we will send a secure reset link.', reset: 'Choose a strong password you have not used elsewhere.' }[flow];

  return <section className="page-surface min-h-[calc(100vh-70px)]"><div className="container max-w-lg"><div className="border border-border-light bg-white p-6 shadow-card rounded-xs sm:p-9">
    <span className="mb-5 block h-1 w-10 bg-brand-red" aria-hidden="true" />
    <h1 className="text-3xl font-black tracking-tight text-neutral-900">{title}</h1><p className="mt-2 text-sm text-neutral-600">{subtitle}</p>
    {message && <div className="mt-6 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 rounded-xs" role="status">{message}</div>}
    {error && <div className="mt-6 border border-red-200 bg-red-50 p-3 text-sm text-red-700 rounded-xs" role="alert">{error}</div>}
    {flow === 'verify' ? <div className="mt-6 space-y-4">
      {!message && <button type="button" disabled={isSubmitting} onClick={() => void submit({ preventDefault() {} } as FormEvent)} className="w-full rounded-xs bg-brand-red px-5 py-3 text-sm font-bold text-white hover:bg-brand-red-hover disabled:opacity-50">{isSubmitting ? 'Verifying…' : 'Verify email'}</button>}
      <ResendForm initialEmail={email} />
      <Link className="block text-center text-sm font-bold text-brand-red hover:underline" href="/">Return home</Link>
    </div> : <form onSubmit={submit} className="mt-6 space-y-4">
      {flow === 'register' && <label className="block text-sm font-bold text-neutral-700">Full name<input required value={name} onChange={(e) => setName(e.target.value)} className={`${input} mt-1`} autoComplete="name" /></label>}
      {(flow === 'register' || flow === 'forgot') && <label className="block text-sm font-bold text-neutral-700">Email address<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${input} mt-1`} autoComplete="email" /></label>}
      {(flow === 'register' || flow === 'reset') && <><label className="block text-sm font-bold text-neutral-700">Password<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${input} mt-1`} autoComplete="new-password" /></label><label className="block text-sm font-bold text-neutral-700">Confirm password<input required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`${input} mt-1`} autoComplete="new-password" /></label></>}
      <button disabled={isSubmitting} className="w-full rounded-xs bg-brand-red px-5 py-3 text-sm font-bold text-white hover:bg-brand-red-hover disabled:opacity-50">{isSubmitting ? 'Please wait…' : flow === 'register' ? 'Create account' : flow === 'forgot' ? 'Send reset link' : 'Save new password'}</button>
    </form>}
    {flow === 'register' && <p className="mt-6 text-center text-sm text-neutral-600">Already have an account? <Link className="font-bold text-brand-red hover:underline" href="/">Sign in</Link></p>}
  </div></div></section>;
}

function ResendForm({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { await resendVerification(email); setMessage('If verification is needed, an email has been sent.'); } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to resend verification.'); } finally { setBusy(false); } };
  return <form onSubmit={submit} className="border-t border-neutral-100 pt-5"><p className="text-xs text-neutral-500">Need another verification email?</p><div className="mt-2 flex gap-2"><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} placeholder="you@example.com" /><button disabled={busy} className="shrink-0 rounded-xs border border-brand-red px-3 text-xs font-bold text-brand-red hover:bg-brand-red-light disabled:opacity-50">Resend</button></div>{message && <p className="mt-2 text-xs text-emerald-700">{message}</p>}{error && <p className="mt-2 text-xs text-red-700">{error}</p>}</form>;
}
