'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { Icon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import {
  AdminContactDetail,
  AdminContactSummary,
  ContactStatus,
  Pagination,
  getAdminContactMessage,
  getAdminContactMessages,
  updateAdminContactStatus,
} from '@/lib/api/admin';

const contactStatusStyles: Record<ContactStatus, string> = {
  NEW: 'bg-amber-50 text-amber-800 border-amber-300',
  IN_PROGRESS: 'bg-sky-50 text-sky-800 border-sky-300',
  RESOLVED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
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

export function AdminContactTab() {
  const [statusFilter, setStatusFilter] = useState<ContactStatus | ''>('');
  const [page, setPage] = useState<number>(1);
  const [messages, setMessages] = useState<AdminContactSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected detail
  const [selectedDetail, setSelectedDetail] = useState<AdminContactDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminContactMessages({
        page,
        limit: 20,
        status: statusFilter || undefined,
      });
      setMessages(res.messages);
      setPagination(res.pagination);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const handleSelectMessage = async (summary: AdminContactSummary) => {
    setDetailLoading(true);
    setActionError(null);
    try {
      const res = await getAdminContactMessage(summary.id);
      setSelectedDetail(res.message);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to load message details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleTransition = async (nextStatus: ContactStatus) => {
    if (!selectedDetail) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await updateAdminContactStatus(selectedDetail.id, nextStatus);
      setSelectedDetail(res.message);
      await loadData();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to update message status');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="rounded-xs border border-neutral-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label htmlFor="contact-status-filter" className="text-xs font-semibold text-neutral-600">
              Filter Status:
            </label>
            <select
              id="contact-status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ContactStatus | '');
                setPage(1);
                setSelectedDetail(null);
              }}
              className="rounded-xs border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 focus:border-brand-red focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="NEW">New</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
            </select>
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

      {/* Grid: List and Detail Pane */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className={selectedDetail ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <div className="overflow-hidden rounded-xs border border-neutral-200 bg-white shadow-xs">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                Contact Inquiries ({pagination.total})
              </span>
            </div>

            {loading ? (
              <div className="divide-y divide-neutral-100 p-6">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-16 animate-pulse rounded-xs bg-neutral-100 my-2" />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="p-8 text-center text-sm text-neutral-500">
                No contact messages found matching current criteria.
              </div>
            ) : (
              <div className="divide-y divide-neutral-200 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-500 font-semibold">
                    <tr>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Sender</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {messages.map((m) => {
                      const isSelected = selectedDetail?.id === m.id;
                      return (
                        <tr
                          key={m.id}
                          className={`hover:bg-neutral-50/80 transition-colors cursor-pointer ${
                            isSelected ? 'bg-red-50/40' : ''
                          }`}
                          onClick={() => handleSelectMessage(m)}
                        >
                          <td className="px-4 py-3.5 font-bold text-neutral-900 whitespace-nowrap">
                            {m.referenceNumber}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="font-semibold text-neutral-800">
                              {m.firstName} {m.lastName}
                            </div>
                            <div className="text-neutral-500 text-[11px]">{m.email}</div>
                          </td>
                          <td className="px-4 py-3.5 max-w-[200px] truncate text-neutral-700 font-medium">
                            {m.subject}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-neutral-600">
                            {formatDate(m.createdAt)}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex rounded-xs border px-2 py-0.5 text-[11px] font-bold ${
                                contactStatusStyles[m.status]
                              }`}
                            >
                              {m.status.replace('_', ' ').toLowerCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              className="text-xs font-bold text-brand-red hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectMessage(m);
                              }}
                            >
                              Read
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

        {/* Selected Message Detail & Workflow Pane */}
        {selectedDetail && (
          <div className="lg:col-span-5">
            <div className="rounded-xs border border-neutral-200 bg-white p-5 shadow-xs space-y-5">
              <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-red">
                    Customer Message
                  </span>
                  <h3 className="text-lg font-black text-neutral-900">{selectedDetail.referenceNumber}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDetail(null)}
                  className="text-neutral-400 hover:text-neutral-700 p-1"
                  aria-label="Close message view"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>

              {detailLoading ? (
                <div className="p-6 text-center text-xs text-neutral-500">Loading message body...</div>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-xs border border-neutral-200 bg-neutral-50 p-3">
                    <span className="text-xs font-semibold text-neutral-700">Status:</span>
                    <span
                      className={`inline-flex rounded-xs border px-2.5 py-1 text-xs font-bold ${
                        contactStatusStyles[selectedDetail.status]
                      }`}
                    >
                      {selectedDetail.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs text-neutral-700 divide-y divide-neutral-100">
                    <div className="pt-2">
                      <span className="font-semibold text-neutral-500 block">Sender Name</span>
                      <span className="font-bold text-neutral-900 text-sm">
                        {selectedDetail.firstName} {selectedDetail.lastName}
                      </span>
                    </div>

                    <div className="pt-2">
                      <span className="font-semibold text-neutral-500 block">Email &amp; Phone</span>
                      <div className="font-medium text-neutral-800">{selectedDetail.email}</div>
                      {selectedDetail.phone && <div className="text-neutral-600">{selectedDetail.phone}</div>}
                    </div>

                    <div className="pt-2">
                      <span className="font-semibold text-neutral-500 block">Subject &amp; Category</span>
                      <span className="font-bold text-neutral-900">{selectedDetail.subject}</span>
                      {selectedDetail.serviceType && (
                        <div className="text-neutral-500 uppercase text-[11px] mt-0.5">
                          Category: {selectedDetail.serviceType}
                        </div>
                      )}
                    </div>

                    <div className="pt-2">
                      <span className="font-semibold text-neutral-500 block mb-1">Message Content</span>
                      <div className="rounded-xs bg-neutral-50 p-3 border border-neutral-200 text-neutral-800 whitespace-pre-wrap leading-relaxed text-xs">
                        {selectedDetail.message}
                      </div>
                    </div>

                    <div className="pt-2">
                      <span className="font-semibold text-neutral-500 block">Received At</span>
                      <span className="text-neutral-600">{formatDate(selectedDetail.createdAt)}</span>
                    </div>
                  </div>

                  {/* Status Action Buttons */}
                  <div className="border-t border-neutral-200 pt-4 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-900 block">
                      Support Workflow Actions
                    </span>

                    {actionError && (
                      <div className="rounded-xs border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                        {actionError}
                      </div>
                    )}

                    {selectedDetail.status === 'NEW' && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => handleTransition('IN_PROGRESS')}
                        className="w-full rounded-xs bg-sky-700 hover:bg-sky-800 text-white"
                      >
                        {actionLoading ? 'Updating...' : 'Start Processing (Mark In Progress)'}
                      </Button>
                    )}

                    {selectedDetail.status === 'IN_PROGRESS' && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => handleTransition('RESOLVED')}
                        className="w-full rounded-xs bg-emerald-700 hover:bg-emerald-800 text-white"
                      >
                        {actionLoading ? 'Updating...' : 'Mark Resolved'}
                      </Button>
                    )}

                    {selectedDetail.status === 'RESOLVED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => handleTransition('IN_PROGRESS')}
                        className="w-full rounded-xs text-neutral-800 border-neutral-300 hover:bg-neutral-50"
                      >
                        {actionLoading ? 'Updating...' : 'Reopen Inquiry (In Progress)'}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
