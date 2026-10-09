'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';

export default function AccountPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!isLoading && !user) router.replace('/?auth=required'); }, [isLoading, user, router]);
  if (isLoading || !user) return <div className="page-surface min-h-[calc(100vh-70px)]" aria-live="polite" />;
  return <section className="page-surface min-h-[calc(100vh-70px)]"><div className="container max-w-3xl"><div className="rounded-xs border border-border-light bg-white p-6 shadow-card sm:p-9"><span className="block h-1 w-10 bg-brand-red" /><h1 className="mt-5 text-3xl font-black text-neutral-900">Your account</h1><p className="mt-2 text-neutral-600">Signed in as {user.email}.</p>{!user.emailVerified && <p className="mt-5 rounded-xs border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Your email is not verified. Check your inbox for the verification link.</p>}</div></div></section>;
}
