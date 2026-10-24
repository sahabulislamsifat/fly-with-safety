'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { Icon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import {
  AdminBooking,
  BookingStatus,
  Pagination,
  getAdminBookings,
  updateAdminBookingStatus,
} from '@/lib/api/admin';

interface AdminBookingDetailsMeta {
  sourceInquiryId?: string;
  sourceInquiryReference?: string;
  sourceInquiryType?: string;
  paymentStatus?: string;
  paymentPolicy?: string;
}

const bookingStatusStyles: Record<BookingStatus, string> = {
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
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(val));
  } catch {
    return val;
  }
}

export function AdminBookingsTab() {
  const [statusFilter, setStatusFilter] = useState<BookingStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminBooking | null>(null);

  // Transition form state
  const [targetStatus, setTargetStatus] = useState<BookingStatus>('CONFIRMED');
  const [reason, setReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminBookings({
        page,
        limit: 20,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
      });
      setBookings(res.bookings);
      setPagination(res.pagination);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const handleSelectBooking = (b: AdminBooking) => {
    setSelected(b);
    setActionError(null);
    setReason('');
    if (b.status === 'PENDING') setTargetStatus('CONFIRMED');
    else if (b.status === 'CONFIRMED') setTargetStatus('COMPLETED');
    else setTargetStatus('CANCELLED');
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await updateAdminBookingStatus(selected.id, targetStatus, reason.trim() || undefined);
      setSelected(res.booking);
      setReason('');
      await loadData();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to update booking status');
    } finally {
      setActionLoading(false);
    }
  };

  const allowedNextStatuses: BookingStatus[] = selected?.status === 'PENDING'
    ? ['CONFIRMED', 'CANCELLED']
    : selected?.status === 'CONFIRMED'
    ? ['COMPLETED', 'CANCELLED']
    : [];

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="rounded-xs border border-neutral-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label htmlFor="booking-status-filter" className="text-xs font-semibold text-neutral-600 mr-2">
                Status:
              </label>
              <select
                id="booking-status-filter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as BookingStatus | '');
                  setPage(1);
                  setSelected(null);
                }}
                className="rounded-xs border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 focus:border-brand-red focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            <div>
              <label htmlFor="booking-type-filter" className="text-xs font-semibold text-neutral-600 mr-2">
                Type:
              </label>
              <select
                id="booking-type-filter"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                  setSelected(null);
                }}
                className="rounded-xs border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 focus:border-brand-red focus:outline-none"
              >
                <option value="">All Types</option>
                <option value="FLIGHT">Flight</option>
                <option value="HOTEL">Hotel</option>
                <option value="PACKAGE">Package</option>
              </select>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => loadData()} disabled={loading} className="rounded-xs">
            <Icon name="swapHorizontal" size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

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

      {/* Main Grid: List and Booking Detail */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className={selected ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <div className="overflow-hidden rounded-xs border border-neutral-200 bg-white shadow-xs">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                Bookings ({pagination.total})
              </span>
            </div>

            {loading ? (
              <div className="divide-y divide-neutral-100 p-6">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-16 animate-pulse rounded-xs bg-neutral-100 my-2" />
                ))}
              </div>
            ) : bookings.length === 0 ? (
              <div className="p-8 text-center text-sm text-neutral-500">
                No bookings found matching current criteria.
              </div>
            ) : (
              <div className="divide-y divide-neutral-200 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-500 font-semibold">
                    <tr>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Total Amount</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {bookings.map((b) => {
                      const isSelected = selected?.id === b.id;
                      return (
                        <tr
                          key={b.id}
                          className={`hover:bg-neutral-50/80 transition-colors cursor-pointer ${
                            isSelected ? 'bg-red-50/40' : ''
                          }`}
                          onClick={() => handleSelectBooking(b)}
                        >
                          <td className="px-4 py-3.5 font-bold text-neutral-900 whitespace-nowrap">
                            {b.referenceNumber}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap font-medium text-neutral-700">
                            {b.bookingType}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="font-semibold text-neutral-800">{b.customerName}</div>
                            <div className="text-neutral-500 text-[11px]">{b.customerEmail}</div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap font-bold text-neutral-900">
                            {b.totalPrice.toLocaleString()} {b.currency}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-neutral-600">
                            {formatDate(b.createdAt)}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex rounded-xs border px-2 py-0.5 text-[11px] font-bold ${
                                bookingStatusStyles[b.status]
                              }`}
                            >
                              {b.status.toLowerCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              className="text-xs font-bold text-brand-red hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectBooking(b);
                              }}
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

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

        {/* Selected Booking Detail & Audit Trail */}
        {selected && (
          <div className="lg:col-span-5">
            <div className="rounded-xs border border-neutral-200 bg-white p-5 shadow-xs space-y-5">
              <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-red">
                    Booking Detail &amp; Manifest
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

              {/* Status and Summary Header */}
              <div className="flex items-center justify-between rounded-xs border border-neutral-200 bg-neutral-50 p-3">
                <div>
                  <span className="text-xs font-semibold text-neutral-500 block">Total Amount</span>
                  <span className="text-sm font-black text-neutral-900">
                    {selected.totalPrice.toLocaleString()} {selected.currency}
                  </span>
                </div>
                <span
                  className={`inline-flex rounded-xs border px-2.5 py-1 text-xs font-bold ${
                    bookingStatusStyles[selected.status]
                  }`}
                >
                  {selected.status}
                </span>
              </div>

              {/* Customer & Booking Details */}
              <div className="space-y-3 text-xs text-neutral-700 divide-y divide-neutral-100">
                <div className="pt-2">
                  <span className="font-semibold text-neutral-500 block">Customer</span>
                  <span className="font-bold text-neutral-900 text-sm">{selected.customerName}</span>
                  <div className="text-neutral-600 mt-0.5">{selected.customerEmail}</div>
                  {selected.customerPhone && <div className="text-neutral-600">{selected.customerPhone}</div>}
                </div>

                <div className="pt-2">
                  <span className="font-semibold text-neutral-500 block">Service Type &amp; Fulfillment Model</span>
                  <span className="font-bold text-neutral-900">
                    {selected.bookingType} · {selected.bookingModel}
                  </span>
                </div>

                {Boolean((selected.bookingDetails as AdminBookingDetailsMeta | null)?.sourceInquiryReference) && (
                  <div className="pt-2">
                    <span className="font-semibold text-neutral-500 block">Originating Travel Inquiry</span>
                    <span className="inline-flex items-center gap-1.5 rounded-xs border border-brand-red/20 bg-red-50/60 px-2 py-0.5 text-[11px] font-bold text-brand-red mt-0.5">
                      {(selected.bookingDetails as AdminBookingDetailsMeta | null)?.sourceInquiryType || 'INQUIRY'} · {(selected.bookingDetails as AdminBookingDetailsMeta | null)?.sourceInquiryReference}
                    </span>
                  </div>
                )}

                <div className="pt-2">
                  <span className="font-semibold text-neutral-500 block mb-1">Payment Readiness &amp; Settlement</span>
                  <div className="rounded-xs border border-neutral-200 bg-neutral-50/80 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-neutral-600 font-medium">Payment State:</span>
                      <span className="font-bold text-[11px] font-mono px-2 py-0.5 rounded-xs border border-neutral-300 bg-white text-neutral-800">
                        {String((selected.bookingDetails as AdminBookingDetailsMeta | null)?.paymentStatus || (selected.status === 'CONFIRMED' ? 'AWAITING_PAYMENT_CONFIRMATION' : selected.status === 'COMPLETED' ? 'PAYMENT_VERIFIED' : 'AWAITING_PAYMENT_INSTRUCTIONS'))}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 leading-relaxed">
                      {String((selected.bookingDetails as AdminBookingDetailsMeta | null)?.paymentPolicy || 'Manual agency settlement. No automated card charge.')}
                    </p>
                  </div>
                </div>

                {/* Passenger Manifest */}
                {selected.passengers && selected.passengers.length > 0 && (
                  <div className="pt-2">
                    <span className="font-semibold text-neutral-500 block mb-1">
                      Passenger Manifest ({selected.passengers.length})
                    </span>
                    <div className="rounded-xs border border-neutral-200 divide-y divide-neutral-100 bg-neutral-50/50">
                      {selected.passengers.map((p, idx) => (
                        <div key={p.id || idx} className="p-2 text-xs">
                          <span className="font-bold text-neutral-800">
                            {idx + 1}. {p.firstName} {p.lastName}
                          </span>
                          <span className="text-neutral-500 ml-2">({p.passengerType})</span>
                          {p.passportNumberMasked && (
                            <div className="text-[11px] text-neutral-600">
                              Passport: {p.passportNumberMasked} {p.nationality ? `(${p.nationality})` : ''}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selected.notes && (
                  <div className="pt-2">
                    <span className="font-semibold text-neutral-500 block">Special Notes</span>
                    <p className="mt-1 rounded-xs bg-neutral-50 p-2 text-neutral-700 italic border border-neutral-200">
                      &quot;{selected.notes}&quot;
                    </p>
                  </div>
                )}

                {/* Audit History Timeline */}
                <div className="pt-2">
                  <span className="font-semibold text-neutral-500 block mb-2">Audit Status History</span>
                  {selected.statusHistory && selected.statusHistory.length > 0 ? (
                    <div className="space-y-2 border-l-2 border-neutral-200 pl-3">
                      {selected.statusHistory.map((h) => (
                        <div key={h.id} className="text-xs">
                          <div className="font-semibold text-neutral-800">
                            {h.fromStatus} → <span className="text-brand-red">{h.toStatus}</span>
                          </div>
                          {h.reason && <div className="text-neutral-600 italic text-[11px]">&quot;{h.reason}&quot;</div>}
                          <div className="text-[10px] text-neutral-400">
                            By {h.changedBy || 'STAFF'} · {formatDate(h.createdAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-neutral-500 text-xs">No status transitions logged yet.</div>
                  )}
                </div>
              </div>

              {/* Status Update Form */}
              <div className="border-t border-neutral-200 pt-4 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-900 block">
                  Staff Status Transition
                </span>

                {actionError && (
                  <div className="rounded-xs border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                    {actionError}
                  </div>
                )}

                {allowedNextStatuses.length > 0 ? (
                  <form onSubmit={handleUpdateStatus} className="space-y-3 text-xs">
                    <div>
                      <label htmlFor="target-booking-status" className="font-semibold text-neutral-700 block mb-1">
                        Transition To:
                      </label>
                      <select
                        id="target-booking-status"
                        value={targetStatus}
                        onChange={(e) => setTargetStatus(e.target.value as BookingStatus)}
                        className="w-full rounded-xs border border-neutral-300 bg-white p-2 text-xs focus:border-brand-red focus:outline-none"
                      >
                        {allowedNextStatuses.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="status-reason" className="font-semibold text-neutral-700 block mb-1">
                        Reason / Staff Audit Note:
                      </label>
                      <input
                        id="status-reason"
                        type="text"
                        placeholder="e.g. Verified by agent / Payment received"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full rounded-xs border border-neutral-300 bg-white p-2 text-xs focus:border-brand-red focus:outline-none"
                        maxLength={500}
                      />
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={actionLoading}
                      className="w-full rounded-xs bg-neutral-900 hover:bg-neutral-800 text-white"
                    >
                      {actionLoading ? 'Recording Transition...' : `Confirm Transition to ${targetStatus}`}
                    </Button>
                  </form>
                ) : (
                  <div className="rounded-xs bg-neutral-100 p-3 text-center text-xs text-neutral-500">
                    This booking is in terminal state ({selected.status}). No further transitions permitted.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
