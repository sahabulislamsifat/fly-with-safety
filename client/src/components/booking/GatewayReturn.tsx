'use client';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { GatewayPaymentPanel } from './GatewayPaymentPanel';
export function GatewayReturn({ reference }: { reference: string | null }) {
  const { user, isLoading } = useAuth();
  return <main className="page-surface min-h-[60vh] px-4 py-12"><section className="mx-auto max-w-2xl rounded-xs border border-neutral-200 bg-white p-6">
    <h1 className="text-xl font-bold">Sandbox payment verification</h1>
    <p className="mt-3 text-sm text-neutral-600">Returning from checkout does not confirm payment. Only the verified status saved by our server is authoritative. No ticket or supplier reservation has been issued.</p>
    {isLoading ? <p role="status" className="mt-3 text-sm">Checking your session…</p> : user && reference ? <GatewayPaymentPanel key={reference} reference={reference} staff={user.role !== 'CUSTOMER'} /> : <p className="mt-3 text-sm">Sign in with the booking owner account to review payment status.</p>}
    <Link href={user ? '/account' : '/?auth=required'} className="mt-5 inline-block text-sm font-bold text-brand-red hover:underline">{user ? 'Open my bookings' : 'Sign in'}</Link>
  </section></main>;
}
