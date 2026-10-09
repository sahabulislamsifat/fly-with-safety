'use client';

import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { closeBookingModal, submitBookingThunk, clearBookingState } from '@/redux/slices/bookingSlice';
import { Button, Input } from '@/components/ui';
import { Icon } from '@/components/ui/Icons';
import { BookingPassenger } from '@/lib/api/bookings';

export function BookingModal() {
  const dispatch = useAppDispatch();
  const { isBookingModalOpen, bookingTarget, submitStatus, submitError, recentBooking } =
    useAppSelector((state) => state.booking);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [passengers, setPassengers] = useState<BookingPassenger[]>([
    { firstName: '', lastName: '', passengerType: 'adult' },
  ]);

  if (!isBookingModalOpen || !bookingTarget) return null;

  const handleAddPassenger = () => {
    setPassengers((prev) => [
      ...prev,
      { firstName: '', lastName: '', passengerType: 'adult' },
    ]);
  };

  const handleRemovePassenger = (index: number) => {
    if (passengers.length > 1) {
      setPassengers((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const updatePassenger = (
    index: number,
    field: keyof BookingPassenger,
    value: string
  ) => {
    setPassengers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerEmail) return;

    dispatch(
      submitBookingThunk({
        bookingType: bookingTarget.type,
        bookingModel: 'AGENCY_INQUIRY',
        customerName,
        customerEmail,
        customerPhone,
        totalPrice: bookingTarget.totalPrice,
        currency: bookingTarget.currency || 'BDT',
        bookingDetails: bookingTarget.details,
        passengers,
        notes,
      })
    );
  };

  const handleClose = () => {
    dispatch(closeBookingModal());
    dispatch(clearBookingState());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-xs shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
              FlyWithsafety Agency Booking
            </span>
            <h2 id="booking-modal-title" className="text-lg font-bold text-text-primary">
              {recentBooking ? 'Booking Request Submitted' : bookingTarget.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-text-tertiary hover:text-text-primary rounded-xs hover:bg-neutral-200 transition-colors"
            aria-label="Close dialog"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {recentBooking ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-xs flex items-center justify-center mx-auto">
                <Icon name="check" size={32} />
              </div>
              <h3 className="text-xl font-bold text-text-primary">
                Thank You, {recentBooking.customerName}!
              </h3>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                Your booking request has been securely registered in our system. A FlyWithsafety travel specialist will review your itinerary and contact you shortly.
              </p>

              <div className="bg-neutral-50 border border-neutral-200 rounded-xs p-4 max-w-md mx-auto text-left space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary">Reference Code:</span>
                  <span className="font-mono font-bold text-brand-primary text-base">
                    {recentBooking.referenceNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary">Status:</span>
                  <span className="px-2 py-0.5 rounded-xs text-xs font-semibold bg-amber-100 text-amber-800">
                    {recentBooking.status}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary">Total Fare:</span>
                  <span className="font-bold text-text-primary">
                    {recentBooking.totalPrice.toLocaleString()} {recentBooking.currency}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary">Confirmation Sent To:</span>
                  <span className="text-text-primary font-medium">{recentBooking.customerEmail}</span>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="primary" onClick={handleClose}>
                  Done
                </Button>
                <a
                  href={`/bookings/lookup?ref=${encodeURIComponent(recentBooking.referenceNumber)}&email=${encodeURIComponent(recentBooking.customerEmail)}`}
                  className="inline-flex items-center justify-center px-4 py-2 border border-neutral-300 rounded-xs text-sm font-medium text-text-primary hover:bg-neutral-50 transition-colors"
                >
                  Track Booking Status
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Summary Banner */}
              <div className="p-4 bg-brand-primary/5 border border-brand-primary/15 rounded-xs flex items-center justify-between">
                <div>
                  <p className="text-xs text-text-secondary">Selected Itinerary</p>
                  <p className="text-sm font-bold text-text-primary">{bookingTarget.title}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-secondary">Total Estimate</p>
                  <p className="text-base font-extrabold text-brand-primary">
                    {bookingTarget.totalPrice.toLocaleString()} {bookingTarget.currency}
                  </p>
                </div>
              </div>

              {/* Demo inventory badge notice */}
              <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xs text-xs text-amber-800">
                <Icon name="info" size={16} />
                <span>
                  <strong>Demo Data:</strong> Flight and fare details reflect demonstration inventory. Our travel agents confirm actual availability upon submission.
                </span>
              </div>

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xs">
                  {submitError}
                </div>
              )}

              {/* Customer Contact */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-text-primary border-b pb-1">
                  1. Primary Contact Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Full Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Mohammad Rahim"
                    required
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="e.g. rahim@example.com"
                    required
                  />
                  <Input
                    label="Phone Number"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+880 1712-345678"
                  />
                  <Input
                    label="Special Requests / Notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Meal preference, wheelchair assistance, etc."
                  />
                </div>
              </div>

              {/* Passengers */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-1">
                  <h4 className="text-sm font-bold text-text-primary">
                    2. Passenger Details ({passengers.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddPassenger}
                    className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1"
                  >
                    <Icon name="plus" size={14} /> Add Passenger
                  </button>
                </div>

                {passengers.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xs space-y-3 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-text-secondary">
                        Passenger #{idx + 1}
                      </span>
                      {passengers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePassenger(idx)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input
                        label="First Name"
                        value={p.firstName}
                        onChange={(e) => updatePassenger(idx, 'firstName', e.target.value)}
                        placeholder="First / Given"
                        required
                      />
                      <Input
                        label="Last Name"
                        value={p.lastName}
                        onChange={(e) => updatePassenger(idx, 'lastName', e.target.value)}
                        placeholder="Last / Surname"
                        required
                      />
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                          Type
                        </label>
                        <select
                          value={p.passengerType}
                          onChange={(e) =>
                            updatePassenger(idx, 'passengerType', e.target.value)
                          }
                          className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xs text-sm font-medium focus:ring-2 focus:ring-brand-primary"
                        >
                          <option value="adult">Adult (12+)</option>
                          <option value="child">Child (2-11)</option>
                          <option value="infant">Infant (&lt;2)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Submit */}
              <div className="pt-4 border-t border-neutral-200 flex items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitStatus === 'loading'}
                >
                  {submitStatus === 'loading' ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-xs animate-spin" />
                      Submitting Request...
                    </span>
                  ) : (
                    'Confirm & Submit Request'
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
