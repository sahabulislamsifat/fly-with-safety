'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { Icon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import {
  AdminTestimonial,
  Pagination,
  TestimonialStatus,
  createAdminTestimonial,
  deleteAdminTestimonial,
  getAdminTestimonials,
  updateAdminTestimonialStatus,
} from '@/lib/api/admin';

const testimonialStatusStyles: Record<TestimonialStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-300',
  APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  REJECTED: 'bg-red-50 text-red-800 border-red-300',
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

export function AdminTestimonialsTab() {
  const [statusFilter, setStatusFilter] = useState<TestimonialStatus | ''>('');
  const [page, setPage] = useState<number>(1);
  const [testimonials, setTestimonials] = useState<AdminTestimonial[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Actions
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [newAuthor, setNewAuthor] = useState<string>('');
  const [newQuote, setNewQuote] = useState<string>('');
  const [newRole, setNewRole] = useState<string>('');
  const [newRating, setNewRating] = useState<number>(5);
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminTestimonials({
        page,
        limit: 20,
        status: statusFilter || undefined,
      });
      setTestimonials(res.testimonials);
      setPagination(res.pagination);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load testimonials');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const handleStatusUpdate = async (id: string, status: TestimonialStatus) => {
    setActionLoadingId(id);
    setActionError(null);
    try {
      await updateAdminTestimonialStatus(id, status);
      await loadData();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to update testimonial status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoadingId(id);
    setActionError(null);
    try {
      await deleteAdminTestimonial(id);
      setDeleteConfirmId(null);
      await loadData();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to delete testimonial');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuthor.trim() || !newQuote.trim()) {
      setCreateError('Author and quote are required.');
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    try {
      await createAdminTestimonial({
        author: newAuthor.trim(),
        quote: newQuote.trim(),
        role: newRole.trim() || undefined,
        rating: Number(newRating),
      });
      setIsCreateOpen(false);
      setNewAuthor('');
      setNewQuote('');
      setNewRole('');
      setNewRating(5);
      await loadData();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Failed to add testimonial');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Add Bar */}
      <div className="rounded-xs border border-neutral-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label htmlFor="testimonial-status-filter" className="text-xs font-semibold text-neutral-600">
              Moderation Status:
            </label>
            <select
              id="testimonial-status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as TestimonialStatus | '');
                setPage(1);
              }}
              className="rounded-xs border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 focus:border-brand-red focus:outline-none"
            >
              <option value="">All Testimonials</option>
              <option value="PENDING">Pending Moderation</option>
              <option value="APPROVED">Approved (Public)</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData()}
              disabled={loading}
              className="rounded-xs"
            >
              <Icon name="swapHorizontal" size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="rounded-xs bg-neutral-900 hover:bg-neutral-800 text-white"
            >
              <Icon name="plus" size={14} />
              <span>Add Verified Review</span>
            </Button>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="rounded-xs border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">
          {actionError}
        </div>
      )}

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

      {/* Testimonials List */}
      <div className="overflow-hidden rounded-xs border border-neutral-200 bg-white shadow-xs">
        <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
            Reviews &amp; Testimonials ({pagination.total})
          </span>
        </div>

        {loading ? (
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-32 animate-pulse rounded-xs bg-neutral-100" />
            ))}
          </div>
        ) : testimonials.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-500">
            No testimonials found matching current filter.
          </div>
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => {
              const isActioning = actionLoadingId === t.id;
              const isConfirmingDelete = deleteConfirmId === t.id;

              return (
                <div
                  key={t.id}
                  className="rounded-xs border border-neutral-200 bg-white p-4 shadow-xs flex flex-col justify-between space-y-4 hover:border-neutral-300 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-amber-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Icon
                            key={i}
                            name="star"
                            size={13}
                            className={i < t.rating ? 'fill-amber-400 text-amber-500' : 'text-neutral-300'}
                          />
                        ))}
                      </div>
                      <span
                        className={`inline-flex rounded-xs border px-2 py-0.5 text-[10px] font-bold ${
                          testimonialStatusStyles[t.status]
                        }`}
                      >
                        {t.status.toLowerCase()}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-700 italic line-clamp-4 leading-relaxed">
                      &quot;{t.quote}&quot;
                    </p>

                    <div>
                      <span className="font-bold text-xs text-neutral-900 block">{t.author}</span>
                      {t.role && <span className="text-[11px] text-neutral-500 block">{t.role}</span>}
                      <span className="text-[10px] text-neutral-400 block mt-1">{formatDate(t.createdAt)}</span>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="border-t border-neutral-100 pt-3 space-y-2">
                    {isConfirmingDelete ? (
                      <div className="rounded-xs bg-red-50 p-2 text-xs border border-red-200 space-y-2">
                        <span className="text-red-800 font-semibold block text-[11px]">
                          Delete this testimonial permanently?
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={isActioning}
                            onClick={() => handleDelete(t.id)}
                            className="rounded-xs bg-red-700 hover:bg-red-800 text-white flex-1 text-[11px] py-1"
                          >
                            {isActioning ? 'Deleting...' : 'Yes, Delete'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isActioning}
                            onClick={() => setDeleteConfirmId(null)}
                            className="rounded-xs flex-1 text-[11px] py-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-1 text-xs">
                        <div className="flex gap-1">
                          {t.status !== 'APPROVED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isActioning}
                              onClick={() => handleStatusUpdate(t.id, 'APPROVED')}
                              className="rounded-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 px-2.5 py-1 text-[11px]"
                            >
                              Approve
                            </Button>
                          )}
                          {t.status !== 'REJECTED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isActioning}
                              onClick={() => handleStatusUpdate(t.id, 'REJECTED')}
                              className="rounded-xs text-neutral-700 border-neutral-200 hover:bg-neutral-50 px-2.5 py-1 text-[11px]"
                            >
                              Reject
                            </Button>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={isActioning}
                          onClick={() => setDeleteConfirmId(t.id)}
                          className="text-[11px] font-bold text-red-600 hover:underline p-1 cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
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

      {/* Create Modal */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-testimonial-title"
        >
          <div className="w-full max-w-md rounded-xs border border-neutral-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 id="add-testimonial-title" className="text-base font-bold text-neutral-900">
                Add Verified Customer Review
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-neutral-400 hover:text-neutral-700"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            {createError && (
              <div className="rounded-xs border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label htmlFor="author-input" className="font-semibold text-neutral-700 block mb-1">
                  Customer Name *
                </label>
                <input
                  id="author-input"
                  type="text"
                  required
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  placeholder="e.g. Farhan Chowdhury"
                  className="w-full rounded-xs border border-neutral-300 p-2 text-xs focus:border-brand-red focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="role-input" className="font-semibold text-neutral-700 block mb-1">
                  Customer Role / Type (Optional)
                </label>
                <input
                  id="role-input"
                  type="text"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="e.g. Frequent Flyer, Tourist"
                  className="w-full rounded-xs border border-neutral-300 p-2 text-xs focus:border-brand-red focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="rating-input" className="font-semibold text-neutral-700 block mb-1">
                  Rating (1–5)
                </label>
                <select
                  id="rating-input"
                  value={newRating}
                  onChange={(e) => setNewRating(Number(e.target.value))}
                  className="w-full rounded-xs border border-neutral-300 p-2 text-xs focus:border-brand-red focus:outline-none"
                >
                  <option value={5}>5 Stars - Excellent</option>
                  <option value={4}>4 Stars - Very Good</option>
                  <option value={3}>3 Stars - Good</option>
                  <option value={2}>2 Stars - Fair</option>
                  <option value={1}>1 Star - Poor</option>
                </select>
              </div>

              <div>
                <label htmlFor="quote-input" className="font-semibold text-neutral-700 block mb-1">
                  Customer Quote / Review Content *
                </label>
                <textarea
                  id="quote-input"
                  required
                  rows={4}
                  value={newQuote}
                  onChange={(e) => setNewQuote(e.target.value)}
                  placeholder="Write the customer's verified review..."
                  className="w-full rounded-xs border border-neutral-300 p-2 text-xs focus:border-brand-red focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={createLoading}
                  className="flex-1 rounded-xs bg-neutral-900 hover:bg-neutral-800 text-white"
                >
                  {createLoading ? 'Submitting...' : 'Save Review (Pending)'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={createLoading}
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xs"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
