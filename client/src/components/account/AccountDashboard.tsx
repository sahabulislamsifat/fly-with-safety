'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Input } from '@/components/ui';
import { Icon } from '@/components/ui/Icons';
import { useAuth } from '@/components/auth/AuthProvider';
import { ApiError } from '@/lib/api';
import { AccountBooking, AccountInquiry, DashboardData, InquiryStatus, InquiryType, getBooking, getBookings, getDashboard, getInquiries, updateProfile } from '@/lib/api/account';

type View = 'overview' | 'requests' | 'bookings' | 'profile';
const views: Array<{ id: View; label: string; icon: 'more' | 'calendar' | 'user' }> = [
  { id: 'overview', label: 'Overview', icon: 'more' },
  { id: 'requests', label: 'My requests', icon: 'calendar' },
  { id: 'bookings', label: 'My bookings', icon: 'calendar' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];
const statusClass: Record<InquiryStatus | AccountBooking['status'], string> = { PENDING: 'bg-amber-50 text-amber-800 border-amber-200', CONFIRMED: 'bg-emerald-50 text-emerald-800 border-emerald-200', CANCELLED: 'bg-red-50 text-red-800 border-red-200', COMPLETED: 'bg-sky-50 text-sky-800 border-sky-200' };
const formatDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('en-BD', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';
const errorText = (error: unknown) => error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Something went wrong. Please try again.';

function StateBlock({ title, detail, retry }: { title: string; detail: string; retry?: () => void }) {
  return <div className="rounded-xs border border-border-light bg-white p-8 text-center shadow-card"><h2 className="text-lg font-bold text-text-primary">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">{detail}</p>{retry && <Button className="mt-5" variant="outline" onClick={retry}>Try again</Button>}</div>;
}

function Status({ value }: { value: InquiryStatus | AccountBooking['status'] }) { return <span className={`inline-flex rounded-xs border px-2 py-1 text-xs font-bold ${statusClass[value]}`}>{value.toLowerCase()}</span>; }

export function AccountDashboard() {
  const { user, logout, refreshUser } = useAuth();
  const [view, setView] = useState<View>('overview');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [inquiries, setInquiries] = useState<AccountInquiry[] | null>(null);
  const [bookings, setBookings] = useState<AccountBooking[] | null>(null);
  const [selected, setSelected] = useState<AccountInquiry | AccountBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<InquiryType | ''>('');
  const [requestStatus, setRequestStatus] = useState<InquiryStatus | ''>('');
  const [name, setName] = useState(user?.name || '');
  const [profileState, setProfileState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const load = useCallback(async (target: View = view) => {
    setLoading(true); setError(null); setSelected(null);
    try {
      if (target === 'overview') setDashboard(await getDashboard());
      if (target === 'requests') setInquiries((await getInquiries({ type: requestType || undefined, status: requestStatus || undefined, limit: 20 })).inquiries);
      if (target === 'bookings') setBookings((await getBookings({ limit: 20 })).bookings);
    } catch (err) { setError(errorText(err)); } finally { setLoading(false); }
  }, [requestStatus, requestType, view]);

  useEffect(() => {
    if (view === 'profile') return;
    const timer = window.setTimeout(() => void load(view), 0);
    return () => window.clearTimeout(timer);
  }, [view, load]);

  const showInquiry = async (item: AccountInquiry) => { try { setLoading(true); setSelected(await import('@/lib/api/account').then(({ getInquiry }) => getInquiry(item.type, item.referenceNumber))); } catch (err) { setError(errorText(err)); } finally { setLoading(false); } };
  const showBooking = async (item: AccountBooking) => { try { setLoading(true); const { booking } = await getBooking(item.referenceNumber); setSelected(booking); } catch (err) { setError(errorText(err)); } finally { setLoading(false); } };
  const saveProfile = async (event: React.FormEvent) => { event.preventDefault(); if (name.trim().length < 2) { setProfileState('error'); return; } setProfileState('saving'); try { await updateProfile({ name: name.trim() }); await refreshUser(); setProfileState('saved'); } catch { setProfileState('error'); } };

  const chooseView = (target: View) => { setView(target); setSelected(null); if (target === 'profile') { setLoading(false); setError(null); } };
  const content = () => {
    if (loading) return <div className="grid gap-4 sm:grid-cols-2"><div className="h-28 animate-pulse rounded-xs bg-neutral-100" /><div className="h-28 animate-pulse rounded-xs bg-neutral-100" /><div className="h-44 animate-pulse rounded-xs bg-neutral-100 sm:col-span-2" /></div>;
    if (error) return <StateBlock title="We could not load this account data" detail={error} retry={() => void load()} />;
    if (selected) return <Detail item={selected} back={() => setSelected(null)} />;
    if (view === 'overview' && dashboard) return <Overview data={dashboard} onRequests={() => chooseView('requests')} />;
    if (view === 'requests') return <Requests items={inquiries || []} type={requestType} status={requestStatus} setType={setRequestType} setStatus={setRequestStatus} open={showInquiry} />;
    if (view === 'bookings') return <Bookings items={bookings || []} open={showBooking} />;
    return <form onSubmit={saveProfile} className="max-w-xl space-y-5 rounded-xs border border-border-light bg-white p-6 shadow-card"><div><h2 className="text-xl font-bold text-text-primary">Profile</h2><p className="mt-1 text-sm text-text-secondary">Keep your account name current. Email and role are protected account properties.</p></div><Input label="Full name" value={name} onChange={(event) => { setName(event.target.value); setProfileState('idle'); }} error={profileState === 'error' && name.trim().length < 2 ? 'Enter at least 2 characters.' : undefined} required autoComplete="name" /><Input label="Email" value={user?.email || ''} disabled /><div className="rounded-xs border border-neutral-200 bg-neutral-50 p-3 text-sm text-text-secondary">Email verification: <strong>{user?.emailVerified ? 'Verified' : 'Not verified'}</strong></div>{profileState === 'saved' && <p className="text-sm text-emerald-700" role="status">Profile saved.</p>}{profileState === 'error' && name.trim().length >= 2 && <p className="text-sm text-red-700" role="alert">Profile could not be saved. Try again.</p>}<Button type="submit" loading={profileState === 'saving'}>Save profile</Button></form>;
  };

  return <section className="page-surface min-h-[calc(100vh-70px)]"><div className="container py-8 lg:py-12"><div className="mb-7"><p className="text-sm font-semibold text-brand-red">Account</p><h1 className="mt-1 text-3xl font-black text-text-primary sm:text-4xl">Welcome{user?.name ? `, ${user.name}` : ''}</h1><p className="mt-2 max-w-2xl text-text-secondary">Review requests and bookings using the records connected to your account.</p></div><div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]"><aside className="rounded-xs border border-border-light bg-white p-3 shadow-card"><nav aria-label="Account navigation" className="flex gap-1 overflow-x-auto lg:flex-col">{views.map((item) => <button key={item.id} type="button" onClick={() => chooseView(item.id)} className={`flex shrink-0 items-center gap-2 rounded-xs px-3 py-2.5 text-left text-sm font-semibold transition-colors ${view === item.id ? 'bg-brand-red text-white' : 'text-text-secondary hover:bg-brand-red-light hover:text-brand-red'}`}><Icon name={item.icon} size={17} />{item.label}</button>)}<button type="button" onClick={() => void logout()} className="flex shrink-0 items-center gap-2 rounded-xs px-3 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50"><Icon name="x" size={17} />Sign out</button></nav></aside><main className="min-w-0" aria-live="polite">{content()}</main></div></div></section>;
}

function Overview({ data, onRequests }: { data: DashboardData; onRequests: () => void }) { const cards = [{ label: 'Total requests', value: data.counts.inquiries }, { label: 'Pending requests', value: data.counts.pendingInquiries }, { label: 'Confirmed bookings', value: data.counts.confirmedBookings }]; return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3">{cards.map((card) => <div key={card.label} className="rounded-xs border border-border-light bg-white p-5 shadow-card"><p className="text-sm text-text-secondary">{card.label}</p><p className="mt-2 text-3xl font-black text-text-primary">{card.value}</p></div>)}</div><div className="rounded-xs border border-border-light bg-white p-6 shadow-card"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-text-primary">Recent requests</h2><p className="mt-1 text-sm text-text-secondary">Only requests linked to your signed-in account appear here.</p></div><Button variant="outline" size="sm" onClick={onRequests}>View all requests</Button></div>{data.recent.length === 0 ? <div className="mt-6 border-t border-neutral-100 pt-6"><p className="text-sm text-text-secondary">No requests yet. Search flights, hotels, packages, or visa help when you are ready.</p><Link href="/flights" className="mt-4 inline-flex text-sm font-bold text-brand-red hover:underline">Explore travel services</Link></div> : <div className="mt-5 divide-y divide-neutral-100">{data.recent.map((item) => <div key={`${item.type}-${item.referenceNumber}`} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold text-text-primary">{item.summary}</p><p className="text-sm text-text-secondary">{item.type} request · {item.referenceNumber}</p></div><Status value={item.status} /></div>)}</div>}</div></div>; }

function Requests({ items, type, status, setType, setStatus, open }: { items: AccountInquiry[]; type: InquiryType | ''; status: InquiryStatus | ''; setType: (value: InquiryType | '') => void; setStatus: (value: InquiryStatus | '') => void; open: (item: AccountInquiry) => void }) { return <div className="rounded-xs border border-border-light bg-white p-5 shadow-card sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-bold text-text-primary">My requests</h2><p className="mt-1 text-sm text-text-secondary">Requests are not confirmed bookings.</p></div><div className="flex gap-2"><select aria-label="Filter request type" value={type} onChange={(event) => setType(event.target.value as InquiryType | '')} className="rounded-xs border border-border-medium bg-white px-3 py-2 text-sm"><option value="">All services</option><option value="flight">Flights</option><option value="hotel">Hotels</option><option value="package">Packages</option><option value="visa">Visa</option></select><select aria-label="Filter request status" value={status} onChange={(event) => setStatus(event.target.value as InquiryStatus | '')} className="rounded-xs border border-border-medium bg-white px-3 py-2 text-sm"><option value="">All statuses</option><option value="PENDING">Pending</option><option value="CONFIRMED">Confirmed</option><option value="CANCELLED">Cancelled</option><option value="COMPLETED">Completed</option></select></div></div>{items.length === 0 ? <div className="mt-6 border-t border-neutral-100 pt-6"><p className="text-sm text-text-secondary">No matching requests. A completed search is not stored here until you send a specialist request.</p></div> : <div className="mt-5 divide-y divide-neutral-100">{items.map((item) => <button key={`${item.type}-${item.referenceNumber}`} type="button" onClick={() => void open(item)} className="flex w-full flex-wrap items-center justify-between gap-3 py-4 text-left hover:bg-neutral-50"><div><p className="font-semibold text-text-primary">{item.summary}</p><p className="text-sm text-text-secondary">{item.referenceNumber} · {formatDate(item.travelDate || item.createdAt)}</p></div><div className="flex items-center gap-3"><Status value={item.status} /><span className="text-sm font-bold text-brand-red">View</span></div></button>)}</div>}</div>; }

function Bookings({ items, open }: { items: AccountBooking[]; open: (item: AccountBooking) => void }) { return <div className="rounded-xs border border-border-light bg-white p-5 shadow-card sm:p-6"><h2 className="text-xl font-bold text-text-primary">My bookings</h2><p className="mt-1 text-sm text-text-secondary">Only booking requests linked to your account appear here.</p>{items.length === 0 ? <div className="mt-6 border-t border-neutral-100 pt-6"><p className="text-sm text-text-secondary">No bookings yet. A travel inquiry remains separate until a booking is created.</p></div> : <div className="mt-5 divide-y divide-neutral-100">{items.map((item) => <button key={item.referenceNumber} type="button" onClick={() => void open(item)} className="flex w-full flex-wrap items-center justify-between gap-3 py-4 text-left hover:bg-neutral-50"><div><p className="font-semibold text-text-primary">{item.bookingType.toLowerCase()} booking · {item.referenceNumber}</p><p className="text-sm text-text-secondary">{item.totalPrice.toLocaleString()} {item.currency} · {formatDate(item.createdAt)}</p></div><Status value={item.status} /></button>)}</div>}</div>; }

function Detail({ item, back }: { item: AccountInquiry | AccountBooking; back: () => void }) { const inquiry = 'type' in item; const values = inquiry ? [['Service', item.type], ['Reference', item.referenceNumber], ['Status', item.status], ['Travel date', formatDate(item.travelDate)], ['Details', item.summary], ['Notes', String(item.notes || '—')]] : [['Reference', item.referenceNumber], ['Status', item.status], ['Service', item.bookingType], ['Amount', `${item.totalPrice.toLocaleString()} ${item.currency}`], ['Created', formatDate(item.createdAt)]]; return <div className="rounded-xs border border-border-light bg-white p-6 shadow-card"><button type="button" onClick={back} className="text-sm font-bold text-brand-red hover:underline">Back to list</button><h2 className="mt-4 text-xl font-bold text-text-primary">{inquiry ? 'Request details' : 'Booking details'}</h2><dl className="mt-5 divide-y divide-neutral-100">{values.map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[150px_1fr]"><dt className="text-sm font-semibold text-text-secondary">{label}</dt><dd className="break-words text-sm text-text-primary">{label === 'Status' ? <Status value={value as InquiryStatus} /> : value}</dd></div>)}</dl></div>; }
