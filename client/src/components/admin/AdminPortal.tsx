'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui';
import { Icon } from '@/components/ui/Icons';
import { AdminInquiriesTab } from './AdminInquiriesTab';
import { AdminBookingsTab } from './AdminBookingsTab';
import { AdminContactTab } from './AdminContactTab';
import { AdminTestimonialsTab } from './AdminTestimonialsTab';

type AdminTab = 'inquiries' | 'bookings' | 'contact' | 'testimonials';

export function AdminPortal() {
  const { user, isLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('inquiries');

  // Loading state
  if (isLoading) {
    return (
      <section className="min-h-[calc(100vh-70px)] bg-neutral-50 py-10">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="space-y-4">
            <div className="h-10 w-64 animate-pulse rounded-xs bg-neutral-200" />
            <div className="h-6 w-96 max-w-full animate-pulse rounded-xs bg-neutral-200" />
            <div className="h-14 animate-pulse rounded-xs bg-neutral-200 mt-6" />
            <div className="h-96 animate-pulse rounded-xs bg-neutral-200 mt-4" />
          </div>
        </div>
      </section>
    );
  }

  // Unauthenticated state
  if (!user) {
    return (
      <section className="min-h-[calc(100vh-70px)] bg-neutral-50 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md rounded-xs border border-neutral-200 bg-white p-8 text-center shadow-card space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xs bg-red-100 text-brand-red">
            <Icon name="lock" size={24} />
          </div>
          <h1 className="text-2xl font-black text-neutral-900">Staff Authentication Required</h1>
          <p className="text-xs text-neutral-600 leading-relaxed">
            The FlyWithSafety Operations Portal requires staff or administrator authentication. Please sign in with an authorized account to access operations.
          </p>
          <div className="pt-2">
            <Link href="/account">
              <Button variant="primary" className="w-full rounded-xs bg-brand-red hover:bg-[#74181E] text-white">
                Go to Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // Forbidden: CUSTOMER role state
  if (!['ADMIN', 'STAFF', 'SUPER_ADMIN'].includes(user.role)) {
    return (
      <section className="min-h-[calc(100vh-70px)] bg-neutral-50 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-lg rounded-xs border border-neutral-200 bg-white p-8 text-center shadow-card space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xs bg-amber-100 text-amber-800">
            <Icon name="shield" size={28} />
          </div>
          <div>
            <span className="inline-flex rounded-xs border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">
              403 Forbidden Access
            </span>
            <h1 className="text-2xl font-black text-neutral-900">Staff Role Required</h1>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed max-w-md mx-auto">
            You are signed in as <strong className="text-neutral-900">{user.email}</strong> with role{' '}
            <strong className="text-neutral-900">{user.role}</strong>. This account does not possess staff or administrative permissions to operate the management portal.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/account">
              <Button variant="outline" className="w-full sm:w-auto rounded-xs text-xs">
                Back to Customer Dashboard
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => void logout()}
              className="w-full sm:w-auto rounded-xs text-xs text-red-700 border-red-200 hover:bg-red-50"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // Authorized: STAFF or ADMIN role
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  return (
    <section className="min-h-[calc(100vh-70px)] bg-neutral-50 py-8 lg:py-10">
      <div className="container mx-auto px-4 max-w-7xl space-y-6">
        {/* Operations Header */}
        <div className="rounded-xs border border-neutral-200 bg-white p-6 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-red">
                  FlyWithSafety Operations
                </span>
                <span
                  className={`inline-flex rounded-xs border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                    isSuperAdmin
                      ? 'bg-purple-50 text-purple-800 border-purple-200'
                      : 'bg-blue-50 text-blue-800 border-blue-200'
                  }`}
                >
                  {user.role} Portal
                </span>
              </div>
              <h1 className="text-2xl font-black text-neutral-900 sm:text-3xl">Staff &amp; Admin Operations</h1>
              <p className="text-xs text-neutral-500">
                Authorized session: <strong className="text-neutral-800">{user.name || user.email}</strong> ({user.email})
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/account/security" className="text-xs font-bold underline">Security &amp; MFA</Link>
              <Link href="/staff" className="text-xs font-bold underline">Identity &amp; assignments</Link>
              <Link href="/account">
                <Button variant="outline" size="sm" className="rounded-xs text-xs">
                  My Profile
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void logout()}
                className="rounded-xs text-xs text-red-700 border-red-200 hover:bg-red-50"
              >
                Sign Out
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 border-t border-neutral-200 pt-4">
            <nav className="flex gap-2 overflow-x-auto" aria-label="Operations sections">
              <button
                type="button"
                onClick={() => setActiveTab('inquiries')}
                className={`flex shrink-0 items-center gap-2 rounded-xs px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'inquiries'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                <Icon name="plane" size={15} />
                <span>Inquiries Management</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('bookings')}
                className={`flex shrink-0 items-center gap-2 rounded-xs px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'bookings'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                <Icon name="ticket" size={15} />
                <span>Bookings Processing</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('contact')}
                className={`flex shrink-0 items-center gap-2 rounded-xs px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'contact'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                <Icon name="mail" size={15} />
                <span>Support Messages</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('testimonials')}
                className={`flex shrink-0 items-center gap-2 rounded-xs px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'testimonials'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                <Icon name="star" size={15} />
                <span>Testimonial Moderation</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content Panes */}
        <main aria-live="polite">
          {activeTab === 'inquiries' && <AdminInquiriesTab />}
          {activeTab === 'bookings' && <AdminBookingsTab />}
          {activeTab === 'contact' && <AdminContactTab />}
          {activeTab === 'testimonials' && <AdminTestimonialsTab />}
        </main>
      </div>
    </section>
  );
}
