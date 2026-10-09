'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { lookupBookingThunk } from '@/redux/slices/bookingSlice';
import { Button, Input, Card } from '@/components/ui';

function BookingLookupContent() {
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();

  const refParam = searchParams.get('ref') || '';
  const emailParam = searchParams.get('email') || '';

  const [referenceNumber, setReferenceNumber] = useState(refParam);
  const [email, setEmail] = useState(emailParam);

  const { lookupStatus, lookupError, lookupRecord } = useAppSelector(
    (state) => state.booking
  );

  useEffect(() => {
    if (refParam && emailParam) {
      dispatch(
        lookupBookingThunk({
          referenceNumber: refParam,
          email: emailParam,
        })
      );
    }
  }, [refParam, emailParam, dispatch]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!referenceNumber || !email) return;
    dispatch(
      lookupBookingThunk({
        referenceNumber: referenceNumber.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
      })
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-300';
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-12">
      <div className="container mx-auto px-4 max-w-3xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
            Customer Self-Service
          </span>
          <h1 className="text-3xl font-extrabold text-text-primary">
            Track Booking &amp; Inquiry Status
          </h1>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            Enter your FlyWithSafe booking reference code (e.g. FWS-2026-XXXXXX) and email address to view real-time reservation status and history.
          </p>
        </div>

        {/* Search Card */}
        <Card className="p-6 bg-white border border-neutral-200 shadow-sm rounded-xs">
          <form onSubmit={handleLookup} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Reference Code"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value.toUpperCase())}
                placeholder="FWS-2026-XXXXXX"
                required
              />
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="The email used for booking"
                required
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={lookupStatus === 'loading'}
              className="w-full sm:w-auto"
            >
              {lookupStatus === 'loading' ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-xs animate-spin" />
                  Searching Records...
                </span>
              ) : (
                'Find Booking'
              )}
            </Button>
          </form>
        </Card>

        {/* Error State */}
        {lookupStatus === 'failed' && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xs text-center text-sm text-red-700">
            {lookupError || 'No booking found. Please verify the reference code and email.'}
          </div>
        )}

        {/* Found Record */}
        {lookupStatus === 'succeeded' && lookupRecord && (
          <div className="space-y-6">
            <Card className="p-6 bg-white border border-neutral-200 shadow-sm rounded-xs space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div>
                  <span className="text-xs text-text-secondary block">Booking Reference</span>
                  <span className="text-2xl font-mono font-extrabold text-brand-primary">
                    {lookupRecord.referenceNumber}
                  </span>
                  <span className="text-xs text-text-tertiary block mt-0.5">
                    Created on {new Date(lookupRecord.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex flex-col items-start sm:items-end">
                  <span className="text-xs text-text-secondary block mb-1">Current Lifecycle Status</span>
                  <span
                    className={`px-3 py-1 rounded-xs text-xs font-bold border ${getStatusColor(
                      lookupRecord.status
                    )}`}
                  >
                    {lookupRecord.status}
                  </span>
                </div>
              </div>

              {/* Passenger & Fare Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div className="space-y-2">
                  <h3 className="font-bold text-text-primary text-xs uppercase tracking-wider text-text-secondary">
                    Customer Information
                  </h3>
                  <p>
                    <strong className="text-text-secondary font-medium">Name:</strong>{' '}
                    {lookupRecord.customerName}
                  </p>
                  <p>
                    <strong className="text-text-secondary font-medium">Email:</strong>{' '}
                    {lookupRecord.customerEmail}
                  </p>
                  {lookupRecord.customerPhone && (
                    <p>
                      <strong className="text-text-secondary font-medium">Phone:</strong>{' '}
                      {lookupRecord.customerPhone}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-text-primary text-xs uppercase tracking-wider text-text-secondary">
                    Fare Details
                  </h3>
                  <p className="text-xl font-extrabold text-text-primary">
                    {lookupRecord.totalPrice.toLocaleString()} {lookupRecord.currency}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    Agency Managed · Service Model: {lookupRecord.bookingModel}
                  </p>
                </div>
              </div>

              {/* Passengers */}
              {lookupRecord.passengers && lookupRecord.passengers.length > 0 && (
                <div className="space-y-3 border-t pt-4">
                  <h3 className="font-bold text-text-primary text-xs uppercase tracking-wider text-text-secondary">
                    Passengers ({lookupRecord.passengers.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {lookupRecord.passengers.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-neutral-50 border border-neutral-200 rounded text-xs flex justify-between items-center"
                      >
                        <span className="font-bold text-text-primary">
                          {p.firstName} {p.lastName}
                        </span>
                        <span className="capitalize px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-800 text-[10px]">
                          {p.passengerType}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status History Timeline */}
              {lookupRecord.statusHistory && lookupRecord.statusHistory.length > 0 && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-bold text-text-primary text-xs uppercase tracking-wider text-text-secondary">
                    Status History &amp; Audit Timeline
                  </h3>
                  <div className="space-y-3">
                    {lookupRecord.statusHistory.map((h, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-xs">
                        <div className="w-2 h-2 rounded-xs bg-brand-primary mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <p className="font-bold text-text-primary">
                            Status: <span className="font-mono">{h.toStatus}</span>
                            {h.fromStatus && (
                              <span className="text-text-tertiary font-normal">
                                {' '}
                                (from {h.fromStatus})
                              </span>
                            )}
                          </p>
                          {h.reason && <p className="text-text-secondary mt-0.5">{h.reason}</p>}
                          <span className="text-[10px] text-text-tertiary">
                            {new Date(h.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookingLookupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-neutral-50">
          <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-xs animate-spin" />
        </div>
      }
    >
      <BookingLookupContent />
    </Suspense>
  );
}
