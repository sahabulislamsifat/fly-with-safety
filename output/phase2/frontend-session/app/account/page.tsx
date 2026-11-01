'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { AccountDashboard } from '@/components/account/AccountDashboard';

export default function AccountPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!isLoading && !user) router.replace('/?auth=required'); }, [isLoading, user, router]);
  if (isLoading || !user) return <div className="page-surface min-h-[calc(100vh-70px)]" aria-live="polite" />;
  return <AccountDashboard />;
}
