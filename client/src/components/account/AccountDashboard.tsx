'use client';
import { BookingCommercialPanel } from '@/components/booking/BookingCommercialPanel';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Input } from '@/components/ui';
import { Icon, IconName } from '@/components/ui/Icons';
import { useAuth } from '@/components/auth/AuthProvider';
import { ApiError } from '@/lib/api';
import {
  AccountBooking,
  AccountInquiry,
  BookingStatus,
  DashboardData,
  InquiryStatus,
  InquiryType,
  Pagination,
  getBooking,
  getBookings,
  getDashboard,
  getInquiries,
  getInquiry,
  updateProfile,
} from '@/lib/api/account';

type View = 'overview' | 'requests' | 'bookings' | 'profile';
const views: Array<{ id: View; label: string; icon: IconName }> = [
  { id: 'overview', label: 'Overview', icon: 'more' },
  { id: 'requests', label: 'My requests', icon: 'fileText' },
  { id: 'bookings', label: 'My bookings', icon: 'ticket' },
  { id: 'profile', label: 'Manage profile', icon: 'user' },
];
const bookingStatuses: Array<{ value: BookingStatus | ''; label: string }> = [
  { value: '', label: 'All bookings' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];
const statusClass: Record<BookingStatus, string> = {
  PENDING: 'border-amber-200 bg-amber-50 text-amber-800',
  CONFIRMED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  CANCELLED: 'border-red-200 bg-red-50 text-red-800',
  COMPLETED: 'border-sky-200 bg-sky-50 text-sky-800',
};
const formatDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat('en-BD', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  : '—';
const errorText = (error: unknown) => error instanceof ApiError
  ? error.message
  : 'We could not load this information. Try again.';

function Status({ value }: { value: BookingStatus }) {
  return <span className={`inline-flex rounded-xs border px-2 py-1 text-xs font-bold ${statusClass[value]}`}>{value.charAt(0) + value.slice(1).toLowerCase()}</span>;
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="border-t border-neutral-100 py-8 text-center"><h3 className="font-bold text-text-primary">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-secondary">{detail}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

function Pager({ pagination, onPage }: { pagination: Pagination | null; onPage: (page: number) => void }) {
  if (!pagination || pagination.totalPages < 2) return null;
  return <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-4 text-sm"><span className="text-text-secondary">Page {pagination.page} of {pagination.totalPages} · {pagination.total} records</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => onPage(pagination.page + 1)}>Next</Button></div></div>;
}

export function AccountDashboard() {
  const { user, logout, refreshUser } = useAuth();
  const [view, setView] = useState<View>('overview');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [recentBookings, setRecentBookings] = useState<AccountBooking[]>([]);
  const [inquiries, setInquiries] = useState<AccountInquiry[]>([]);
  const [bookings, setBookings] = useState<AccountBooking[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selected, setSelected] = useState<AccountInquiry | AccountBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<InquiryType | ''>('');
  const [requestStatus, setRequestStatus] = useState<InquiryStatus | ''>('');
  const [bookingStatus, setBookingStatus] = useState<BookingStatus | ''>('');
  const [page, setPage] = useState(1);
  const [name, setName] = useState(user?.name || '');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileState, setProfileState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const load = useCallback(async (target: View = view) => {
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      if (target === 'overview') {
        const [summary, recent] = await Promise.all([getDashboard(), getBookings({ limit: 4 })]);
        setDashboard(summary);
        setRecentBookings(recent.bookings);
      } else if (target === 'requests') {
        const result = await getInquiries({ type: requestType || undefined, status: requestStatus || undefined, page, limit: 10 });
        setInquiries(result.inquiries);
        setPagination(result.pagination);
      } else if (target === 'bookings') {
        const result = await getBookings({ status: bookingStatus || undefined, page, limit: 10 });
        setBookings(result.bookings);
        setPagination(result.pagination);
      }
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, [bookingStatus, page, requestStatus, requestType, view]);

  useEffect(() => {
    const syncFromAddress = () => {
      const value = new URLSearchParams(window.location.search).get('tab');
      setView(views.some((item) => item.id === value) ? value as View : 'overview');
    };
    syncFromAddress();
    window.addEventListener('popstate', syncFromAddress);
    return () => window.removeEventListener('popstate', syncFromAddress);
  }, []);

  useEffect(() => {
    if (view === 'profile') return;
    const timer = window.setTimeout(() => void load(view), 0);
    return () => window.clearTimeout(timer);
  }, [view, load]);

  const chooseView = (target: View) => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', target);
    window.history.pushState({}, '', `/account?${params.toString()}`);
    setView(target);
    setPage(1);
    setSelected(null);
    setError(null);
    if (target === 'profile') void load('overview');
  };

  const showInquiry = async (item: AccountInquiry) => {
    setLoading(true);
    setError(null);
    try { setSelected(await getInquiry(item.type, item.referenceNumber)); }
    catch (cause) { setError(errorText(cause)); }
    finally { setLoading(false); }
  };

  const showBooking = async (item: AccountBooking) => {
    setLoading(true);
    setError(null);
    try { setSelected((await getBooking(item.referenceNumber)).booking); }
    catch (cause) { setError(errorText(cause)); }
    finally { setLoading(false); }
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim().length < 2) { setProfileState('error'); return; }
    setProfileState('saving');
    try {
      await updateProfile({ name: name.trim() });
      await refreshUser();
      setProfileState('saved');
      setEditingProfile(false);
    } catch {
      setProfileState('error');
    }
  };

  const title = selected ? ('type' in selected ? 'Request details' : 'Booking details') : views.find((item) => item.id === view)?.label;
  const initials = (user?.name || user?.email || 'F').trim().slice(0, 1).toUpperCase();

  return <section className="page-surface min-h-[calc(100vh-70px)] pb-12">
    <div className="container py-6 sm:py-9">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold text-brand-red">Your travel account</p><h1 className="mt-1 text-3xl font-black text-text-primary sm:text-4xl">Account dashboard</h1></div>
        <Link href="/contact" className="inline-flex items-center gap-2 text-sm font-bold text-brand-red hover:underline"><Icon name="headphones" size={17} />Contact support</Link>
      </div>

      <div className="overflow-hidden rounded-xs border border-neutral-200 bg-white shadow-card">
        <div className="relative h-28 overflow-hidden bg-[#74181E] sm:h-36">
          <div className="absolute inset-0 opacity-20" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(115deg, transparent 0 48%, rgba(255,255,255,.28) 48.2% 48.5%, transparent 48.7%), linear-gradient(25deg, transparent 0 70%, rgba(255,255,255,.18) 70.2% 70.5%, transparent 70.7%)' }} />
          <div className="absolute bottom-4 right-5 hidden items-center gap-2 text-sm font-semibold text-white/85 sm:flex"><Icon name="shield" size={17} />Travel Made Reassuring.</div>
        </div>
        <div className="flex flex-wrap items-end gap-4 px-5 pb-5 sm:px-7">
          <div className="-mt-10 flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-white bg-neutral-100 text-2xl font-black text-brand-red shadow-sm sm:-mt-12 sm:h-24 sm:w-24" aria-label={`${user?.name || 'Customer'} avatar`}>{initials}</div>
          <div className="min-w-0 flex-1 pb-1"><h2 className="truncate text-xl font-black text-text-primary sm:text-2xl">{user?.name || 'Welcome'}</h2><p className="break-all text-sm text-text-secondary">{user?.email}</p><p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary"><Icon name={user?.emailVerified ? 'checkCircle' : 'info'} size={14} className={user?.emailVerified ? 'text-emerald-700' : 'text-amber-700'} />Email {user?.emailVerified ? 'verified' : 'not verified'}</p></div>
          <Button variant="outline" size="sm" className="ml-auto basis-full sm:ml-0 sm:basis-auto" onClick={() => chooseView('profile')}><Icon name="edit" size={15} />Edit profile</Button>
        </div>
      </div>

      <div className="my-5 grid grid-cols-2 overflow-hidden rounded-xs border border-neutral-200 bg-white sm:grid-cols-4">
        <Summary label="Co-travellers" value="Not stored" detail="No traveller records" icon="users" />
        <Summary label="Passport" value="Not stored" detail="Document data not collected" icon="fileText" />
        <Summary label="Frequent flyer" value="Not saved" detail="No loyalty profile" icon="star" />
        <Summary label="Member since" value={formatDate(dashboard?.memberSince)} detail="Account registration" icon="calendar" />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="h-fit min-w-0 rounded-xs border border-neutral-200 bg-white p-3 shadow-card">
          <div className="hidden px-3 pb-3 pt-2 lg:block"><p className="text-sm font-bold text-text-primary">{user?.name || 'FlyWithSafe customer'}</p><p className="mt-0.5 truncate text-xs text-text-secondary">{user?.email}</p></div>
          <div className="mb-2 border-t border-neutral-100 pt-3"><p className="hidden px-3 pb-1 text-[11px] font-bold text-neutral-400 lg:block">ACCOUNT</p><nav aria-label="Account navigation" className="flex flex-wrap gap-1 lg:flex-col">{views.map((item) => <button key={item.id} type="button" aria-current={view === item.id ? 'page' : undefined} onClick={() => chooseView(item.id)} className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xs px-3 py-2.5 lg:w-full text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red ${view === item.id ? 'bg-brand-red text-white' : 'text-text-secondary hover:bg-brand-red-light hover:text-brand-red'}`}><Icon name={item.icon} size={17} />{item.label}</button>)}</nav></div>
          <div className="border-t border-neutral-100 pt-2"><button type="button" onClick={() => void logout()} className="flex w-full items-center gap-3 rounded-xs px-3 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"><Icon name="x" size={17} />Sign out</button></div>
          <div className="mt-2 border-t border-neutral-100 px-3 pt-3"><p className="text-xs font-bold text-text-primary">Need help with a trip?</p><Link href="/contact" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline">Talk to our travel desk <Icon name="arrowRight" size={13} /></Link></div>
        </aside>

        <main className="min-w-0" aria-live="polite">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold text-brand-red">Your account</p><h2 className="text-2xl font-black text-text-primary">{title}</h2></div>{view !== 'profile' && !selected && <Button variant="ghost" size="sm" onClick={() => void load(view)}><Icon name="loader2" size={15} />Refresh</Button>}</div>
          {loading && view !== 'profile' ? <Loading /> : error ? <Panel><div className="py-8 text-center"><h3 className="font-bold text-text-primary">We could not load this account data</h3><p className="mt-2 text-sm text-text-secondary">{error}</p><Button className="mt-4" variant="outline" onClick={() => void load(view)}>Try again</Button></div></Panel> : selected ? <Detail item={selected} back={() => setSelected(null)} onBookingChanged={() => { if (!('type' in selected)) void showBooking(selected); }} /> : view === 'overview' ? <Overview customerName={user?.name} data={dashboard} bookings={recentBookings} onNavigate={chooseView} onOpenInquiry={showInquiry} onOpenBooking={showBooking} /> : view === 'requests' ? <Requests items={inquiries} type={requestType} status={requestStatus} setType={(value) => { setRequestType(value); setPage(1); }} setStatus={(value) => { setRequestStatus(value); setPage(1); }} open={showInquiry} pagination={pagination} onPage={setPage} /> : view === 'bookings' ? <Bookings items={bookings} status={bookingStatus} setStatus={(value) => { setBookingStatus(value); setPage(1); }} open={showBooking} pagination={pagination} onPage={setPage} /> : <Panel><Profile user={user} name={name} setName={setName} editing={editingProfile} setEditing={setEditingProfile} state={profileState} setState={setProfileState} onSave={saveProfile} onCancel={() => { setName(user?.name || ''); setEditingProfile(false); setProfileState('idle'); }} memberSince={formatDate(dashboard?.memberSince)} /></Panel>}
          {view === 'profile' && !dashboard && !loading && <span className="sr-only">Account date unavailable</span>}
        </main>
      </div>
    </div>
  </section>;
}

function Summary({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: IconName }) {
  return <div className="min-w-0 border-b border-r border-neutral-100 p-4 last:border-r-0 even:border-r-0 sm:border-b-0 sm:even:border-r sm:last:border-r-0"><div className="flex items-center gap-2 text-xs font-semibold text-text-secondary"><Icon name={icon} size={15} className="text-brand-red" />{label}</div><p className="mt-2 truncate text-base font-black text-text-primary">{value}</p><p className="mt-0.5 line-clamp-1 text-xs text-text-secondary">{detail}</p></div>;
}

function Panel({ children }: { children: React.ReactNode }) { return <div className="rounded-xs border border-neutral-200 bg-white p-5 shadow-card sm:p-6">{children}</div>; }

function Loading() { return <div className="grid gap-4 sm:grid-cols-2" aria-label="Loading account data" aria-busy="true"><div className="h-28 animate-pulse rounded-xs bg-neutral-100" /><div className="h-28 animate-pulse rounded-xs bg-neutral-100" /><div className="h-44 animate-pulse rounded-xs bg-neutral-100 sm:col-span-2" /></div>; }

function Overview({ customerName, data, bookings, onNavigate, onOpenInquiry, onOpenBooking }: { customerName?: string | null; data: DashboardData | null; bookings: AccountBooking[]; onNavigate: (view: View) => void; onOpenInquiry: (item: AccountInquiry) => void; onOpenBooking: (item: AccountBooking) => void }) {
  if (!data) return <Panel><EmptyState title="Account summary unavailable" detail="Refresh to load your account activity." /></Panel>;
  const cards = [{ label: 'All bookings', value: data.counts.bookings, icon: 'ticket' as IconName, view: 'bookings' as View }, { label: 'Confirmed bookings', value: data.counts.confirmedBookings, icon: 'checkCircle' as IconName, view: 'bookings' as View }, { label: 'Travel requests', value: data.counts.inquiries, icon: 'fileText' as IconName, view: 'requests' as View }, { label: 'Awaiting review', value: data.counts.pendingInquiries, icon: 'calendar' as IconName, view: 'requests' as View }];
  return <div className="space-y-5">
    <div className="rounded-xs border border-neutral-200 bg-white p-5 shadow-card sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-xl font-black text-text-primary">Welcome back{customerName ? `, ${customerName}` : ''}</h3><p className="mt-1 max-w-xl text-sm leading-6 text-text-secondary">Keep your travel requests, bookings, and account details together. Counts below reflect records linked to your account.</p></div><div className="flex gap-2"><Link href="/flights" className="inline-flex items-center gap-2 rounded-xs bg-brand-cta px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-cta-hover"><Icon name="plane" size={16} />Find a flight</Link><Link href="/hotels" className="inline-flex items-center gap-2 rounded-xs border border-neutral-200 px-4 py-2.5 text-sm font-bold text-text-primary hover:border-brand-red hover:text-brand-red"><Icon name="hotel" size={16} />Find a hotel</Link></div></div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <button key={card.label} type="button" onClick={() => onNavigate(card.view)} className="rounded-xs border border-neutral-200 bg-white p-4 text-left shadow-card transition-colors hover:border-brand-red/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"><span className="flex items-center justify-between text-sm text-text-secondary"><span>{card.label}</span><Icon name={card.icon} size={17} className="text-brand-red" /></span><span className="mt-2 block text-3xl font-black text-text-primary">{card.value}</span></button>)}</div>
    <div className="grid gap-5 xl:grid-cols-2"><Panel><SectionHeading title="Recent requests" action={() => onNavigate('requests')} actionLabel="View all" />{data.recent.length ? <div className="mt-3 divide-y divide-neutral-100">{data.recent.map((item) => <button key={`${item.type}-${item.referenceNumber}`} type="button" onClick={() => onOpenInquiry(item)} className="flex w-full flex-wrap items-center justify-between gap-3 py-3 text-left hover:bg-neutral-50"><span className="min-w-0"><span className="block truncate text-sm font-bold text-text-primary">{item.summary}</span><span className="mt-1 block text-xs text-text-secondary">{item.referenceNumber} · {item.type} · {formatDate(item.createdAt)}</span></span><Status value={item.status} /></button>)}</div> : <EmptyState title="No travel requests yet" detail="Send an inquiry for a service and its reference will appear here." action={<Link href="/visa-info" className="text-sm font-bold text-brand-red hover:underline">Explore travel services</Link>} />}</Panel>
    <Panel><SectionHeading title="Recent bookings" action={() => onNavigate('bookings')} actionLabel="View all" />{bookings.length ? <div className="mt-3 divide-y divide-neutral-100">{bookings.map((item) => <button key={item.referenceNumber} type="button" onClick={() => onOpenBooking(item)} className="flex w-full flex-wrap items-center justify-between gap-3 py-3 text-left hover:bg-neutral-50"><span><span className="block text-sm font-bold text-text-primary">{item.bookingType.toLowerCase()} · {item.referenceNumber}</span><span className="mt-1 block text-xs text-text-secondary">{item.totalPrice.toLocaleString()} {item.currency} · {formatDate(item.createdAt)}</span></span><Status value={item.status} /></button>)}</div> : <EmptyState title="No bookings yet" detail="Confirmed travel requests become bookings after the travel desk processes them." action={<Link href="/packages" className="text-sm font-bold text-brand-red hover:underline">Browse holiday packages</Link>} />}</Panel></div>
    <Panel><h3 className="font-black text-text-primary">Plan your next trip</h3><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><QuickAction href="/flights" icon="plane" label="Search flights" /><QuickAction href="/hotels" icon="hotel" label="Search hotels" /><QuickAction href="/packages" icon="palmtree" label="Browse packages" /><QuickAction href="/visa-info" icon="fileText" label="Visa assistance" /></div></Panel>
  </div>;
}

function SectionHeading({ title, action, actionLabel }: { title: string; action: () => void; actionLabel: string }) { return <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-black text-text-primary">{title}</h3><button type="button" onClick={action} className="text-sm font-bold text-brand-red hover:underline">{actionLabel}</button></div>; }
function QuickAction({ href, icon, label }: { href: string; icon: IconName; label: string }) { return <Link href={href} className="flex items-center gap-3 rounded-xs border border-neutral-200 p-3 text-sm font-bold text-text-primary hover:border-brand-red hover:text-brand-red"><Icon name={icon} size={18} className="text-brand-red" />{label}<Icon name="arrowRight" size={15} className="ml-auto" /></Link>; }

function Requests({ items, type, status, setType, setStatus, open, pagination, onPage }: { items: AccountInquiry[]; type: InquiryType | ''; status: InquiryStatus | ''; setType: (value: InquiryType | '') => void; setStatus: (value: InquiryStatus | '') => void; open: (item: AccountInquiry) => void; pagination: Pagination | null; onPage: (page: number) => void }) {
  return <Panel><div className="flex flex-wrap items-end justify-between gap-4"><div><h3 className="text-lg font-black text-text-primary">My requests</h3><p className="mt-1 text-sm text-text-secondary">Requests are separate from confirmed bookings.</p></div><div className="flex flex-wrap gap-2"><select aria-label="Filter request type" value={type} onChange={(event) => setType(event.target.value as InquiryType | '')} className="rounded-xs border border-border-medium bg-white px-3 py-2 text-sm"><option value="">All services</option><option value="flight">Flights</option><option value="hotel">Hotels</option><option value="package">Packages</option><option value="visa">Visa</option></select><select aria-label="Filter request status" value={status} onChange={(event) => setStatus(event.target.value as InquiryStatus | '')} className="rounded-xs border border-border-medium bg-white px-3 py-2 text-sm"><option value="">All statuses</option><option value="PENDING">Pending</option><option value="CONFIRMED">Confirmed</option><option value="CANCELLED">Cancelled</option><option value="COMPLETED">Completed</option></select></div></div>{items.length ? <div className="mt-4 divide-y divide-neutral-100">{items.map((item) => <button key={`${item.type}-${item.referenceNumber}`} type="button" onClick={() => open(item)} className="flex w-full flex-wrap items-center justify-between gap-3 py-4 text-left hover:bg-neutral-50"><span><span className="block font-bold text-text-primary">{item.summary}</span><span className="mt-1 block text-sm text-text-secondary">{item.referenceNumber} · {item.type} · {formatDate(item.createdAt)}</span></span><span className="flex items-center gap-3"><Status value={item.status} /><span className="text-sm font-bold text-brand-red">Details</span></span></button>)}</div> : <EmptyState title="No matching requests" detail="Try another filter or send a new travel inquiry when you are ready." action={<Link href="/flights" className="text-sm font-bold text-brand-red hover:underline">Explore services</Link>} />}<Pager pagination={pagination} onPage={onPage} /></Panel>;
}

function Bookings({ items, status, setStatus, open, pagination, onPage }: { items: AccountBooking[]; status: BookingStatus | ''; setStatus: (value: BookingStatus | '') => void; open: (item: AccountBooking) => void; pagination: Pagination | null; onPage: (page: number) => void }) {
  return <Panel><div className="flex flex-wrap items-end justify-between gap-4"><div><h3 className="text-lg font-black text-text-primary">My bookings</h3><p className="mt-1 text-sm text-text-secondary">Travel requests become bookings after processing by the travel desk.</p></div><select aria-label="Filter booking status" value={status} onChange={(event) => setStatus(event.target.value as BookingStatus | '')} className="rounded-xs border border-border-medium bg-white px-3 py-2 text-sm">{bookingStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>{items.length ? <div className="mt-4 divide-y divide-neutral-100">{items.map((item) => <button key={item.referenceNumber} type="button" onClick={() => open(item)} className="flex w-full flex-wrap items-center justify-between gap-3 py-4 text-left hover:bg-neutral-50"><span><span className="block font-bold text-text-primary">{item.bookingType.toLowerCase()} booking · {item.referenceNumber}</span><span className="mt-1 block text-sm text-text-secondary">{item.totalPrice.toLocaleString()} {item.currency} · Created {formatDate(item.createdAt)}</span></span><span className="flex items-center gap-3"><Status value={item.status} /><span className="text-sm font-bold text-brand-red">Details</span></span></button>)}</div> : <EmptyState title="No bookings in this view" detail="There are no booking records for this status. Travel inquiries remain separate until processed." action={<Link href="/flights" className="text-sm font-bold text-brand-red hover:underline">Search travel</Link>} />}<Pager pagination={pagination} onPage={onPage} /></Panel>;
}

function Profile({ user, name, setName, editing, setEditing, state, setState, onSave, onCancel, memberSince }: { user: ReturnType<typeof useAuth>['user']; name: string; setName: (value: string) => void; editing: boolean; setEditing: (value: boolean) => void; state: 'idle' | 'saving' | 'saved' | 'error'; setState: (value: 'idle' | 'saving' | 'saved' | 'error') => void; onSave: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; memberSince: string }) {
  return <div className="space-y-5"><Panel><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black text-text-primary">Personal details</h3><p className="mt-1 text-sm text-text-secondary">Only fields supported by your account are shown.</p></div>{!editing && <Button variant="outline" size="sm" onClick={() => { setEditing(true); setState('idle'); }}><Icon name="edit" size={15} />Edit details</Button>}</div>
    {editing ? <form onSubmit={onSave} className="mt-5 max-w-xl space-y-4"><Input label="Full name" value={name} onChange={(event) => { setName(event.target.value); setState('idle'); }} error={state === 'error' && name.trim().length < 2 ? 'Enter at least 2 characters.' : undefined} required minLength={2} maxLength={100} autoComplete="name" /><Input label="Email address" value={user?.email || ''} disabled autoComplete="email" hint="Email address cannot be changed here." />{state === 'saved' && <p role="status" className="text-sm text-emerald-700">Profile saved.</p>}{state === 'error' && name.trim().length >= 2 && <p role="alert" className="text-sm text-red-700">We could not save your profile. Try again.</p>}<div className="flex flex-wrap gap-2"><Button type="submit" loading={state === 'saving'}>Save changes</Button><Button type="button" variant="outline" disabled={state === 'saving'} onClick={onCancel}>Cancel</Button></div></form> : <dl className="mt-5 grid gap-x-8 sm:grid-cols-2">{[['Full name', user?.name || 'Not provided'], ['Email address', user?.email || '—'], ['Email verification', user?.emailVerified ? 'Verified' : 'Not verified'], ['Member since', memberSince]].map(([label, value]) => <div key={label} className="border-t border-neutral-100 py-3"><dt className="text-xs font-semibold text-text-secondary">{label}</dt><dd className="mt-1 break-words text-sm font-bold text-text-primary">{value}</dd></div>)}</dl>}
  </Panel>{state === 'saved' && !editing && <p role="status" className="rounded-xs border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Profile updated successfully.</p>}<Panel><h3 className="text-lg font-black text-text-primary">Travel details</h3><p className="mt-1 text-sm text-text-secondary">These details are not stored on your account yet.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><Unavailable label="Co-travellers" detail="No secure traveller profile is available." icon="users" /><Unavailable label="Passport" detail="Passport data is not collected or stored." icon="fileText" /><Unavailable label="Frequent flyer" detail="Loyalty details are not stored." icon="star" /></div></Panel><Panel><h3 className="text-lg font-black text-text-primary">Account security</h3><p className="mt-1 text-sm leading-6 text-text-secondary">Password changes are not currently supported in the authenticated account API. Use the existing password recovery flow to set a new password.</p><Link href="/forgot-password" className="mt-3 inline-flex text-sm font-bold text-brand-red hover:underline">Go to password recovery</Link><p className="mt-3 text-xs text-text-secondary">Google sign-in accounts may not have a local password.</p></Panel></div>;
}

function Unavailable({ label, detail, icon }: { label: string; detail: string; icon: IconName }) { return <div className="rounded-xs border border-neutral-200 bg-neutral-50 p-4"><div className="flex items-center gap-2 text-sm font-bold text-text-primary"><Icon name={icon} size={16} className="text-brand-red" />{label}</div><p className="mt-2 text-xs leading-5 text-text-secondary">{detail}</p></div>; }

function Detail({ item, back, onBookingChanged }: { item: AccountInquiry | (AccountBooking & { passengers?: Array<Record<string, unknown>>; statusHistory?: Array<Record<string, unknown>> }); back: () => void; onBookingChanged: () => void }) {
  const inquiry = 'type' in item;
  const values: Array<[string, string]> = inquiry
    ? [['Service', item.type], ['Reference', item.referenceNumber], ['Status', item.status], ['Submitted', formatDate(item.createdAt)], ['Travel date', formatDate(item.travelDate)], ['Summary', item.summary], ['Notes', String(item.notes || '—')]]
    : [['Reference', item.referenceNumber], ['Status', item.status], ['Service', item.bookingType], ['Booking method', item.bookingModel.replaceAll('_', ' ').toLowerCase()], ['Amount', `${item.totalPrice.toLocaleString()} ${item.currency}`], ['Created', formatDate(item.createdAt)]];
  return <Panel><button type="button" onClick={back} className="text-sm font-bold text-brand-red hover:underline">Back to {inquiry ? 'requests' : 'bookings'}</button><h3 className="mt-4 text-lg font-black text-text-primary">{inquiry ? 'Request details' : 'Booking details'}</h3><dl className="mt-4 divide-y divide-neutral-100">{values.map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[150px_1fr]"><dt className="text-sm font-semibold text-text-secondary">{label}</dt><dd className="break-words text-sm text-text-primary">{label === 'Status' ? <Status value={value as BookingStatus} /> : value}</dd></div>)}</dl>{!inquiry && <BookingCommercialPanel key={item.referenceNumber} reference={item.referenceNumber} currency={item.currency} initial={item.commercial} onChanged={onBookingChanged} />}{!inquiry && 'statusHistory' in item && item.statusHistory?.length ? <div className="mt-5 border-t border-neutral-100 pt-4"><h4 className="font-bold text-text-primary">Status history</h4><ol className="mt-3 space-y-3">{item.statusHistory.map((entry, index) => <li key={index} className="flex flex-wrap justify-between gap-2 text-sm"><span>{String(entry.fromStatus || 'Created')} {entry.toStatus ? `to ${String(entry.toStatus)}` : ''}{entry.reason ? ` · ${String(entry.reason)}` : ''}</span><time className="text-text-secondary">{formatDate(String(entry.createdAt || ''))}</time></li>)}</ol></div> : null}</Panel>;
}
