'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { Icon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import {
  AdminFlightInquiry,
  AdminHotelInquiry,
  AdminPackageInquiry,
  AdminVisaInquiry,
  InquiryStatus,
  Pagination,
  getAdminFlightInquiries,
  getAdminHotelInquiries,
  getAdminPackageInquiries,
  getAdminVisaInquiries,
  updateFlightInquiryStatus,
  updateHotelInquiryStatus,
  updatePackageInquiryStatus,
  updateVisaInquiryStatus,
  createBookingFromInquiry,
} from '@/lib/api/admin';

type ServiceType = 'flights' | 'hotels' | 'packages' | 'visa';
type AnyInquiry = AdminFlightInquiry | AdminHotelInquiry | AdminPackageInquiry | AdminVisaInquiry;

const statusBadgeStyles: Record<InquiryStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-300',
  CONFIRMED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  CANCELLED: 'bg-red-50 text-red-800 border-red-300',
  COMPLETED: 'bg-sky-50 text-sky-800 border-sky-300',
};

function formatDate(val: string | null | undefined): string {
  if (!val) return '—';
  try {
    return new Intl.DateTimeFormat('en-BD', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(val));
  } catch {
    return val;
  }
}

export function AdminInquiriesTab() {
  const [service, setService] = useState<ServiceType>('flights');
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | ''>('');
  const [page, setPage] = useState<number>(1);
  const [items, setItems] = useState<AnyInquiry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AnyInquiry | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [staffNote, setStaffNote] = useState<string>('');

  // Booking conversion state
  const [showConvertSection, setShowConvertSection] = useState<boolean>(false);
  const [convertPrice, setConvertPrice] = useState<number>(0);
  const [convertCurrency, setConvertCurrency] = useState<string>('BDT');
  const [convertNotes, setConvertNotes] = useState<string>('');
  const [convertPaymentStatus, setConvertPaymentStatus] = useState<
    'AWAITING_PAYMENT_INSTRUCTIONS' | 'AWAITING_PAYMENT_CONFIRMATION' | 'PAYMENT_VERIFIED'
  >('AWAITING_PAYMENT_INSTRUCTIONS');
  const [convertLoading, setConvertLoading] = useState<boolean>(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter = statusFilter ? statusFilter : undefined;
      let res: { inquiries: AnyInquiry[]; pagination: Pagination };
      if (service === 'flights') {
        res = await getAdminFlightInquiries({ page, limit: 20, status: filter });
      } else if (service === 'hotels') {
        res = await getAdminHotelInquiries({ page, limit: 20, status: filter });
      } else if (service === 'packages') {
        res = await getAdminPackageInquiries({ page, limit: 20, status: filter });
      } else {
        res = await getAdminVisaInquiries({ page, limit: 20, status: filter });
      }
      setItems(res.inquiries);
      setPagination(res.pagination);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  }, [service, statusFilter, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const resetConvertState = () => {
    setShowConvertSection(false);
    setConvertPrice(0);
    setConvertCurrency('BDT');
    setConvertNotes('');
    setConvertPaymentStatus('AWAITING_PAYMENT_INSTRUCTIONS');
    setConvertError(null);
    setConvertSuccess(null);
  };

  const handleServiceChange = (nextService: ServiceType) => {
    setService(nextService);
    setPage(1);
    setSelected(null);
    setActionError(null);
    resetConvertState();
  };

  const handleStatusFilterChange = (filter: InquiryStatus | '') => {
    setStatusFilter(filter);
    setPage(1);
    setSelected(null);
    setActionError(null);
    resetConvertState();
  };

  const handleConvertBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || service === 'visa') return;
    setConvertLoading(true);
    setConvertError(null);
    setConvertSuccess(null);
    try {
      const res = await createBookingFromInquiry({
        inquiryType: service,
        inquiryId: selected.id,
        totalPrice: Math.max(0, Math.floor(Number(convertPrice) || 0)),
        currency: convertCurrency,
        notes: convertNotes.trim() || undefined,
        paymentStatus: convertPaymentStatus,
      });
      setConvertSuccess(
        `Booking ${res.booking.referenceNumber} created successfully! Source inquiry confirmed.`
      );
      await loadData();
    } catch (err) {
      setConvertError(err instanceof ApiError ? err.message : 'Failed to create booking from inquiry');
    } finally {
      setConvertLoading(false);
    }
  };

  const handleTransition = async (targetId: string, nextStatus: InquiryStatus) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const note = staffNote.trim() || undefined;
      if (service === 'flights') {
        const { inquiry } = await updateFlightInquiryStatus(targetId, nextStatus, note);
        setSelected(inquiry);
      } else if (service === 'hotels') {
        const { inquiry } = await updateHotelInquiryStatus(targetId, nextStatus, note);
        setSelected(inquiry);
      } else if (service === 'packages') {
        const { inquiry } = await updatePackageInquiryStatus(targetId, nextStatus, note);
        setSelected(inquiry);
      } else {
        const { inquiry } = await updateVisaInquiryStatus(targetId, nextStatus, note);
        setSelected(inquiry);
      }
      setStaffNote('');
      await loadData();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Status transition failed');
    } finally {
      setActionLoading(false);
    }
  };

  const renderServiceDetails = (inq: AnyInquiry) => {
    if (service === 'flights') {
      const f = inq as AdminFlightInquiry;
      return `${f.fromAirport} → ${f.toAirport} (${f.cabinClass}, ${f.passengers} pax)`;
    }
    if (service === 'hotels') {
      const h = inq as AdminHotelInquiry;
      return `${h.destination} (${h.rooms} room(s), ${h.guests} guest(s))`;
    }
    if (service === 'packages') {
      const p = inq as AdminPackageInquiry;
      return `${p.packageTitle || 'Package'} (${p.travellers} traveller(s))`;
    }
    const v = inq as AdminVisaInquiry;
    return `${v.destination} · ${v.nationality} (${v.travelPurpose || 'General'})`;
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Service Selector */}
      <div className="rounded-xs border border-neutral-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Inquiry service type">
            {(['flights', 'hotels', 'packages', 'visa'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={service === s}
                onClick={() => handleServiceChange(s)}
                className={`rounded-xs px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  service === s
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="inquiry-status-filter" className="text-xs font-semibold text-neutral-600">
              Status:
            </label>
            <select
              id="inquiry-status-filter"
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value as InquiryStatus | '')}
              className="rounded-xs border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 focus:border-brand-red focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <Button variant="outline" size="sm" onClick={() => loadData()} disabled={loading} className="rounded-xs">
              <Icon name="swapHorizontal" size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xs border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          <div className="flex items-center gap-2">
            <Icon name="alertCircle" size={16} />
            <span className="font-semibold">{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadData()} className="mt-3 rounded-xs">
            Retry
          </Button>
        </div>
      )}

      {/* Main Grid: List and Detail Pane */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Inquiry List */}
        <div className={selected ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <div className="overflow-hidden rounded-xs border border-neutral-200 bg-white shadow-xs">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                {service} Inquiries ({pagination.total})
              </span>
            </div>

            {loading ? (
              <div className="divide-y divide-neutral-100 p-6">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-16 animate-pulse rounded-xs bg-neutral-100 my-2" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-sm text-neutral-500">
                No {statusFilter ? statusFilter.toLowerCase() : ''} {service} inquiries found.
              </div>
            ) : (
              <div className="divide-y divide-neutral-200 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-500 font-semibold">
                    <tr>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Service Details</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {items.map((inq) => {
                      const isSelected = selected?.id === inq.id;
                      return (
                        <tr
                          key={inq.id}
                          className={`hover:bg-neutral-50/80 transition-colors cursor-pointer ${
                            isSelected ? 'bg-red-50/40' : ''
                          }`}
                          onClick={() => {
                            setSelected(inq);
                            setActionError(null);
                            resetConvertState();
                          }}
                        >
                          <td className="px-4 py-3.5 font-bold text-neutral-900 whitespace-nowrap">
                            {inq.referenceNumber}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="font-semibold text-neutral-800">{inq.name}</div>
                            <div className="text-neutral-500 text-[11px]">{inq.email}</div>
                          </td>
                          <td className="px-4 py-3.5 max-w-[200px] truncate text-neutral-700">
                            {renderServiceDetails(inq)}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-neutral-600">
                            {formatDate(inq.createdAt)}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex rounded-xs border px-2 py-0.5 text-[11px] font-bold ${
                                statusBadgeStyles[inq.status]
                              }`}
                            >
                              {inq.status.toLowerCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              className="text-xs font-bold text-brand-red hover:underline cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelected(inq);
                                setActionError(null);
                                resetConvertState();
                              }}
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
                <span className="text-neutral-600">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-xs"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selected Inquiry Detail & Status Transition Pane */}
        {selected && (
          <div className="lg:col-span-5">
            <div className="rounded-xs border border-neutral-200 bg-white p-5 shadow-xs space-y-5">
              <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-red">
                    Inquiry Details
                  </span>
                  <h3 className="text-lg font-black text-neutral-900">{selected.referenceNumber}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-neutral-400 hover:text-neutral-700 p-1"
                  aria-label="Close detail panel"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>

              {/* Status banner */}
              <div className="flex items-center justify-between rounded-xs border border-neutral-200 bg-neutral-50 p-3">
                <span className="text-xs font-semibold text-neutral-700">Current Status:</span>
                <span
                  className={`inline-flex rounded-xs border px-2.5 py-1 text-xs font-bold ${
                    statusBadgeStyles[selected.status]
                  }`}
                >
                  {selected.status}
                </span>
              </div>

              {/* Details List */}
              <div className="space-y-3 text-xs text-neutral-700 divide-y divide-neutral-100">
                <div className="pt-2">
                  <span className="font-semibold text-neutral-500 block">Customer Name</span>
                  <span className="font-bold text-neutral-900 text-sm">{selected.name}</span>
                </div>
                <div className="pt-2">
                  <span className="font-semibold text-neutral-500 block">Email Address</span>
                  <span className="font-medium text-neutral-800">{selected.email}</span>
                </div>
                {selected.phone && (
                  <div className="pt-2">
                    <span className="font-semibold text-neutral-500 block">Phone</span>
                    <span className="font-medium text-neutral-800">{selected.phone}</span>
                  </div>
                )}
                <div className="pt-2">
                  <span className="font-semibold text-neutral-500 block">Service Type</span>
                  <span className="font-bold uppercase text-neutral-800">{service}</span>
                </div>

                {service === 'flights' && (
                  <>
                    <div className="pt-2">
                      <span className="font-semibold text-neutral-500 block">Route</span>
                      <span className="font-bold text-neutral-900">
                        {(selected as AdminFlightInquiry).fromAirport} → {(selected as AdminFlightInquiry).toAirport}
                      </span>
                    </div>
                    <div className="pt-2">
                      <span className="font-semibold text-neutral-500 block">Dates</span>
                      <span>
                        Depart: {formatDate((selected as AdminFlightInquiry).departureDate)}
                        {(selected as AdminFlightInquiry).returnDate &&
                          ` · Return: ${formatDate((selected as AdminFlightInquiry).returnDate)}`}
                      </span>
                    </div>
                    <div className="pt-2">
                      <span className="font-semibold text-neutral-500 block">Travel Class & Pax</span>
                      <span>
                        {(selected as AdminFlightInquiry).cabinClass} · {(selected as AdminFlightInquiry).passengers}{' '}
                        passenger(s)
                      </span>
                    </div>
                  </>
                )}

                {service === 'hotels' && (
                  <>
                    <div className="pt-2">
                      <span className="font-semibold text-neutral-500 block">Destination</span>
                      <span className="font-bold text-neutral-900">{(selected as AdminHotelInquiry).destination}</span>
                    </div>
                    <div className="pt-2">
                      <span className="font-semibold text-neutral-500 block">Stay Dates</span>
                      <span>
                        Check-in: {formatDate((selected as AdminHotelInquiry).checkIn)} · Check-out:{' '}
                        {formatDate((selected as AdminHotelInquiry).checkOut)}
                      </span>
                    </div>
                    <div className="pt-2">
                      <span className="font-semibold text-neutral-500 block">Occupancy</span>
                      <span>
                        {(selected as AdminHotelInquiry).rooms} room(s) · {(selected as AdminHotelInquiry).guests}{' '}
                        guest(s)
                      </span>
                    </div>
                  </>
                )}

                {service === 'packages' && (
                  <>
                    <div className="pt-2">
                      <span className="font-semibold text-neutral-500 block">Package Title</span>
                      <span className="font-bold text-neutral-900">
                        {(selected as AdminPackageInquiry).packageTitle || 'Custom Package'}
                      </span>
                    </div>
                    <div className="pt-2">
                      <span className="font-semibold text-neutral-500 block">Travellers & Date</span>
                      <span>
                        {(selected as AdminPackageInquiry).travellers} travellers · Travel date:{' '}
                        {formatDate((selected as AdminPackageInquiry).travelDate)}
                      </span>
                    </div>
                  </>
                )}

                {service === 'visa' && (
                  <>
                    <div className="pt-2">
                      <span className="font-semibold text-neutral-500 block">Destination Country</span>
                      <span className="font-bold text-neutral-900">{(selected as AdminVisaInquiry).destination}</span>
                    </div>
                    <div className="pt-2">
                      <span className="font-semibold text-neutral-500 block">Nationality & Purpose</span>
                      <span>
                        {(selected as AdminVisaInquiry).nationality} ·{' '}
                        {(selected as AdminVisaInquiry).travelPurpose || 'N/A'}
                      </span>
                    </div>
                  </>
                )}

                {selected.notes && (
                  <div className="pt-2">
                    <span className="font-semibold text-neutral-500 block">Customer Notes</span>
                    <p className="mt-1 rounded-xs bg-neutral-50 p-2 text-neutral-700 italic border border-neutral-200">
                      &quot;{selected.notes}&quot;
                    </p>
                  </div>
                )}

                <div className="pt-2">
                  <span className="font-semibold text-neutral-500 block">Submission Date</span>
                  <span className="text-neutral-600">{formatDate(selected.createdAt)}</span>
                </div>
              </div>

              {/* Status Transition Action Box */}
              <div className="border-t border-neutral-200 pt-4 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-900 block">
                  Update Inquiry Status
                </span>

                {actionError && (
                  <div className="rounded-xs border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                    {actionError}
                  </div>
                )}

                {selected.status === 'PENDING' && (
                  <div className="space-y-3">
                    <p className="text-xs text-neutral-500">
                      Pending inquiry: You can confirm or cancel this inquiry request.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => handleTransition(selected.id, 'CONFIRMED')}
                        className="rounded-xs flex-1 bg-emerald-700 hover:bg-emerald-800 text-white"
                      >
                        Confirm Request
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => handleTransition(selected.id, 'CANCELLED')}
                        className="rounded-xs flex-1 text-red-700 border-red-200 hover:bg-red-50"
                      >
                        Cancel Request
                      </Button>
                    </div>
                  </div>
                )}

                {selected.status === 'CONFIRMED' && (
                  <div className="space-y-3">
                    <p className="text-xs text-neutral-500">
                      Confirmed inquiry: Mark as completed once fulfilled, or cancel.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => handleTransition(selected.id, 'COMPLETED')}
                        className="rounded-xs flex-1 bg-sky-700 hover:bg-sky-800 text-white"
                      >
                        Complete Request
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => handleTransition(selected.id, 'CANCELLED')}
                        className="rounded-xs flex-1 text-red-700 border-red-200 hover:bg-red-50"
                      >
                        Cancel Request
                      </Button>
                    </div>
                  </div>
                )}

                {(selected.status === 'CANCELLED' || selected.status === 'COMPLETED') && (
                  <div className="rounded-xs bg-neutral-100 p-3 text-center text-xs text-neutral-500">
                    This inquiry is in terminal state ({selected.status}). No further transitions permitted.
                  </div>
                )}
              </div>

              {/* Inquiry-to-Booking Generation Box */}
              {service === 'visa' ? (
                <div className="rounded-xs border border-neutral-200 bg-neutral-50 p-3.5 text-xs text-neutral-600">
                  <span className="font-bold block text-neutral-900 mb-0.5">Advisory Service Notice</span>
                  Visa requests are processed as document consultancy services. Formal ticket/hotel bookings are not generated for visa inquiries.
                </div>
              ) : selected.status !== 'CANCELLED' ? (
                <div className="border-t border-neutral-200 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-neutral-900 block">
                        Booking Lifecycle Conversion
                      </span>
                      <span className="text-[11px] text-neutral-500">
                        Create an official reservation record from this inquiry
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowConvertSection(!showConvertSection)}
                      className="rounded-xs border border-brand-red/30 bg-red-50/50 px-2.5 py-1 text-xs font-bold text-brand-red hover:bg-red-50 cursor-pointer"
                    >
                      {showConvertSection ? 'Close' : 'Convert to Booking'}
                    </button>
                  </div>

                  {convertSuccess && (
                    <div className="rounded-xs border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 font-semibold" role="status">
                      {convertSuccess}
                    </div>
                  )}

                  {convertError && (
                    <div className="rounded-xs border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 font-medium" role="alert">
                      {convertError}
                    </div>
                  )}

                  {showConvertSection && (
                    <form onSubmit={handleConvertBooking} className="space-y-3 rounded-xs border border-neutral-200 bg-neutral-50/80 p-3.5 text-xs">
                      <div>
                        <label htmlFor="convert-price" className="font-semibold text-neutral-700 block mb-1">
                          Confirmed Quotation / Fare (Total):
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="convert-price"
                            type="number"
                            min="0"
                            required
                            value={convertPrice}
                            onChange={(e) => setConvertPrice(Math.max(0, parseInt(e.target.value) || 0))}
                            className="flex-1 rounded-xs border border-neutral-300 bg-white p-2 text-xs focus:border-brand-red focus:outline-none"
                            placeholder="e.g. 55000"
                          />
                          <input
                            type="text"
                            value={convertCurrency}
                            onChange={(e) => setConvertCurrency(e.target.value.toUpperCase())}
                            className="w-20 rounded-xs border border-neutral-300 bg-white p-2 text-xs font-mono text-center focus:border-brand-red focus:outline-none"
                            maxLength={6}
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="convert-payment-status" className="font-semibold text-neutral-700 block mb-1">
                          Payment Readiness Status:
                        </label>
                        <select
                          id="convert-payment-status"
                          value={convertPaymentStatus}
                          onChange={(e) =>
                            setConvertPaymentStatus(
                              e.target.value as
                                | 'AWAITING_PAYMENT_INSTRUCTIONS'
                                | 'AWAITING_PAYMENT_CONFIRMATION'
                                | 'PAYMENT_VERIFIED'
                            )
                          }
                          className="w-full rounded-xs border border-neutral-300 bg-white p-2 text-xs focus:border-brand-red focus:outline-none"
                        >
                          <option value="AWAITING_PAYMENT_INSTRUCTIONS">
                            Awaiting Payment Instructions (Reviewing quotation)
                          </option>
                          <option value="AWAITING_PAYMENT_CONFIRMATION">
                            Awaiting Payment Confirmation (Deposit/MFS pending)
                          </option>
                          <option value="PAYMENT_VERIFIED">
                            Payment Verified (Offline bank receipt verified)
                          </option>
                        </select>
                        <p className="text-[11px] text-neutral-500 mt-1">
                          Truthful fulfillment: No automated card charges. Agency manual verification model.
                        </p>
                      </div>

                      <div>
                        <label htmlFor="convert-notes" className="font-semibold text-neutral-700 block mb-1">
                          Staff Audit / Booking Notes:
                        </label>
                        <textarea
                          id="convert-notes"
                          rows={2}
                          value={convertNotes}
                          onChange={(e) => setConvertNotes(e.target.value)}
                          placeholder="Ticketing details, agent reference, or special requests"
                          className="w-full rounded-xs border border-neutral-300 bg-white p-2 text-xs focus:border-brand-red focus:outline-none resize-none"
                          maxLength={500}
                        />
                      </div>

                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={convertLoading}
                        className="w-full rounded-xs bg-neutral-900 hover:bg-neutral-800 text-white cursor-pointer"
                      >
                        {convertLoading ? 'Creating Booking Record...' : 'Confirm & Create Official Booking'}
                      </Button>
                    </form>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
