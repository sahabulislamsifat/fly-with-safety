'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { Icon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api/client';
import { submitFlightInquiry } from '@/lib/api/flights';
import { submitHotelInquiry } from '@/lib/api/hotels';
import { submitPackageInquiry } from '@/lib/api/packages';
import { submitVisaInquiry } from '@/lib/api/visa';

export type InquiryKind = 'flight' | 'hotel' | 'package' | 'visa';

export type InquiryDefaults =
  | {
      kind: 'flight';
      from: string;
      to: string;
      departureDate: string;
      returnDate?: string;
      tripType: 'roundTrip' | 'oneWay' | 'multiCity';
      routeNote?: string;
      adults: number;
      children: number;
      infants: number;
      cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
    }
  | {
      kind: 'hotel';
      destination: string;
      checkIn: string;
      checkOut: string;
      guests: number;
      rooms: number;
    }
  | { kind: 'package'; packageTitle: string; travelDate?: string; travellers: number }
  | { kind: 'visa'; destination: string; nationality: string; travelPurpose?: string };

type FieldErrors = Record<string, string>;

const labels: Record<InquiryKind, { title: string; description: string; submit: string }> = {
  flight: {
    title: 'Request flight assistance',
    description:
      'A travel specialist will confirm availability and fare options for this itinerary.',
    submit: 'Send flight request',
  },
  hotel: {
    title: 'Request hotel assistance',
    description: 'A travel specialist will check suitable stays for your dates and guests.',
    submit: 'Send hotel request',
  },
  package: {
    title: 'Request package assistance',
    description: 'A travel specialist will prepare options for the package you are exploring.',
    submit: 'Send package request',
  },
  visa: {
    title: 'Request visa assistance',
    description: 'A visa specialist will review the details you provide and follow up.',
    submit: 'Send visa request',
  },
};

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());

function errorMessage(error: unknown): { message: string; fields: FieldErrors } {
  if (error instanceof ApiError) {
    const details = Object.entries(error.details || {}).reduce<FieldErrors>(
      (all, [field, detail]) => {
        all[field] = Array.isArray(detail) ? String(detail[0] || '') : String(detail);
        return all;
      },
      {},
    );
    return { message: error.message, fields: details };
  }
  return {
    message:
      error instanceof Error
        ? error.message
        : 'We could not submit your request. Please try again.',
    fields: {},
  };
}

export function ServiceInquiryModal({
  defaults,
  onClose,
}: {
  defaults: InquiryDefaults;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState(defaults.kind === 'flight' ? defaults.routeNote || '' : '');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const [from, setFrom] = useState(defaults.kind === 'flight' ? defaults.from : '');
  const [to, setTo] = useState(defaults.kind === 'flight' ? defaults.to : '');
  const [departureDate, setDepartureDate] = useState(
    defaults.kind === 'flight' ? defaults.departureDate : '',
  );
  const [returnDate, setReturnDate] = useState(
    defaults.kind === 'flight' ? defaults.returnDate || '' : '',
  );
  const [adults, setAdults] = useState(defaults.kind === 'flight' ? defaults.adults : 1);
  const [children, setChildren] = useState(defaults.kind === 'flight' ? defaults.children : 0);
  const [infants, setInfants] = useState(defaults.kind === 'flight' ? defaults.infants : 0);
  const [cabinClass, setCabinClass] = useState(
    defaults.kind === 'flight' ? defaults.cabinClass : 'economy',
  );
  const [destination, setDestination] = useState(
    defaults.kind === 'hotel' || defaults.kind === 'visa' ? defaults.destination : '',
  );
  const [checkIn, setCheckIn] = useState(defaults.kind === 'hotel' ? defaults.checkIn : '');
  const [checkOut, setCheckOut] = useState(defaults.kind === 'hotel' ? defaults.checkOut : '');
  const [guests, setGuests] = useState(defaults.kind === 'hotel' ? defaults.guests : 1);
  const [rooms, setRooms] = useState(defaults.kind === 'hotel' ? defaults.rooms : 1);
  const [travelDate, setTravelDate] = useState(
    defaults.kind === 'package' ? defaults.travelDate || '' : '',
  );
  const [travellers, setTravellers] = useState(
    defaults.kind === 'package' ? defaults.travellers : 1,
  );
  const [nationality, setNationality] = useState(
    defaults.kind === 'visa' ? defaults.nationality : '',
  );
  const [travelPurpose, setTravelPurpose] = useState(
    defaults.kind === 'visa' ? defaults.travelPurpose || '' : '',
  );

  useEffect(() => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
      triggerRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) =>
      event.key === 'Escape' && status !== 'submitting' && onClose();
    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('keydown', handleTab);
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('keydown', handleTab);
    };
  }, [onClose, status]);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (name.trim().length < 2) next.name = 'Enter your full name.';
    if (!validEmail.test(email)) next.email = 'Enter a valid email address.';
    if (phone.length > 30) next.phone = 'Phone number must be 30 characters or fewer.';
    if (notes.length > 1000) next.notes = 'Notes must be 1,000 characters or fewer.';

    if (defaults.kind === 'flight') {
      if (from.trim().length < 2 || from.trim().length > 10)
        next.from = 'Enter a valid origin airport code.';
      if (to.trim().length < 2 || to.trim().length > 10)
        next.to = 'Enter a valid destination airport code.';
      if (from.trim().toUpperCase() === to.trim().toUpperCase())
        next.to = 'Origin and destination must be different.';
      if (!validDate(departureDate)) next.departureDate = 'Enter a valid departure date.';
      if (
        defaults.tripType === 'roundTrip' &&
        (!validDate(returnDate) || returnDate < departureDate)
      )
        next.returnDate = 'Return date must be on or after departure.';
      if (!Number.isInteger(adults) || adults < 1 || adults > 9)
        next.adults = 'Adults must be between 1 and 9.';
      if (!Number.isInteger(children) || children < 0 || children > 8)
        next.children = 'Children must be between 0 and 8.';
      if (!Number.isInteger(infants) || infants < 0 || infants > 4)
        next.infants = 'Infants must be between 0 and 4.';
      if (infants > adults) next.infants = 'Infants cannot exceed adults.';
    }
    if (defaults.kind === 'hotel') {
      if (destination.trim().length < 2 || destination.trim().length > 200)
        next.destination = 'Enter a destination of at least 2 characters.';
      if (!validDate(checkIn)) next.checkIn = 'Enter a valid check-in date.';
      if (!validDate(checkOut) || checkOut <= checkIn)
        next.checkOut = 'Check-out must be after check-in.';
      if (!Number.isInteger(guests) || guests < 1 || guests > 20)
        next.guests = 'Guests must be between 1 and 20.';
      if (!Number.isInteger(rooms) || rooms < 1 || rooms > 10)
        next.rooms = 'Rooms must be between 1 and 10.';
    }
    if (
      defaults.kind === 'package' &&
      (!Number.isInteger(travellers) || travellers < 1 || travellers > 20)
    )
      next.travellers = 'Travellers must be between 1 and 20.';
    if (defaults.kind === 'visa') {
      if (destination.trim().length < 2 || destination.trim().length > 100)
        next.destination = 'Enter a destination of at least 2 characters.';
      if (nationality.trim().length < 2 || nationality.trim().length > 100)
        next.nationality = 'Enter a nationality of at least 2 characters.';
      if (travelPurpose.length > 200)
        next.travelPurpose = 'Purpose must be 200 characters or fewer.';
    }
    return next;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (status === 'submitting') return;
    const nextErrors = validate();
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length) return;

    setStatus('submitting');
    try {
      const idempotencyKey = (idempotencyKeyRef.current ||= crypto.randomUUID());
      const contact = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      const result =
        defaults.kind === 'flight'
          ? await submitFlightInquiry(
              {
                ...contact,
                from: from.trim(),
                to: to.trim(),
                departureDate,
                returnDate: defaults.tripType === 'roundTrip' ? returnDate : undefined,
                tripType: defaults.tripType,
                adults,
                children,
                infants,
                passengers: adults + children + infants,
                cabinClass,
              },
              idempotencyKey,
            )
          : defaults.kind === 'hotel'
            ? await submitHotelInquiry(
                { ...contact, destination: destination.trim(), checkIn, checkOut, guests, rooms },
                idempotencyKey,
              )
            : defaults.kind === 'package'
              ? await submitPackageInquiry(
                  {
                    ...contact,
                    packageTitle: defaults.packageTitle,
                    travelDate: travelDate || undefined,
                    travellers,
                  },
                  idempotencyKey,
                )
              : await submitVisaInquiry(
                  {
                    ...contact,
                    destination: destination.trim(),
                    nationality: nationality.trim(),
                    travelPurpose: travelPurpose.trim() || undefined,
                  },
                  idempotencyKey,
                );
      setReferenceNumber(result.referenceNumber);
      setStatus('success');
    } catch (error) {
      const feedback = errorMessage(error);
      setErrors(feedback.fields);
      setFormError(feedback.message);
      setStatus('error');
    }
  };

  const service = labels[defaults.kind];
  if (typeof document === 'undefined') return null;

  const numberInput = (
    value: number,
    onChange: (value: number) => void,
    label: string,
    error?: string,
    min = 0,
    max = 20,
  ) => (
    <Input
      label={label}
      type="number"
      min={min}
      max={max}
      value={value}
      error={error}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[300] grid place-items-center overflow-y-auto overscroll-contain bg-black/60 p-4 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={(event) =>
        event.target === event.currentTarget && status !== 'submitting' && onClose()
      }
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-inquiry-title"
        aria-describedby="service-inquiry-description"
        className="relative my-auto flex w-full max-w-2xl max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-xs bg-white shadow-2xl focus:outline-none sm:max-h-[calc(100dvh-3rem)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="service-inquiry-title" className="text-xl font-bold text-text-primary">
              {service.title}
            </h2>
            <p id="service-inquiry-description" className="mt-1 max-w-xl text-sm text-text-secondary">
              {service.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={status === 'submitting'}
            className="rounded-xs p-2 text-text-tertiary hover:bg-neutral-100 hover:text-text-primary disabled:opacity-50"
            aria-label="Close inquiry form"
          >
            <Icon name="x" size={20} />
          </button>
        </div>
        {status === 'success' ? (
          <div className="space-y-4 overflow-y-auto overscroll-contain p-6 text-center" role="status">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xs bg-emerald-100 text-emerald-700">
              <Icon name="check" size={24} />
            </div>
            <h3 className="text-lg font-bold text-text-primary">Request received</h3>
            <p className="text-sm text-text-secondary">Your request reference is:</p>
            <p className="inline-block rounded-xs border border-emerald-200 bg-emerald-50 px-4 py-2 font-mono font-bold text-brand-primary">
              {referenceNumber}
            </p>
            <p className="text-sm text-text-secondary">
              A travel specialist will use your provided contact details to follow up.
            </p>
            <Button onClick={onClose}>Done</Button>
          </div>
        ) : (
          <form className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 sm:p-6" onSubmit={handleSubmit} noValidate>
            {formError && (
              <div
                role="alert"
                className="rounded-xs border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {formError}
              </div>
            )}
            {defaults.kind === 'flight' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="From"
                  value={from}
                  error={errors.from}
                  onChange={(event) => setFrom(event.target.value.toUpperCase())}
                  required
                />
                <Input
                  label="To"
                  value={to}
                  error={errors.to}
                  onChange={(event) => setTo(event.target.value.toUpperCase())}
                  required
                />
                <Input
                  label="Departure date"
                  type="date"
                  value={departureDate}
                  error={errors.departureDate}
                  onChange={(event) => setDepartureDate(event.target.value)}
                  required
                />
                {defaults.tripType === 'roundTrip' && (
                  <Input
                    label="Return date"
                    type="date"
                    value={returnDate}
                    error={errors.returnDate}
                    onChange={(event) => setReturnDate(event.target.value)}
                    required
                  />
                )}
                {numberInput(adults, setAdults, 'Adults', errors.adults, 1, 9)}
                {numberInput(children, setChildren, 'Children', errors.children, 0, 8)}
                {numberInput(infants, setInfants, 'Infants', errors.infants, 0, 4)}
                <Select
                  label="Cabin"
                  value={cabinClass}
                  onChange={(event) => setCabinClass(event.target.value as typeof cabinClass)}
                  options={[
                    { value: 'economy', label: 'Economy' },
                    { value: 'premium_economy', label: 'Premium economy' },
                    { value: 'business', label: 'Business' },
                    { value: 'first', label: 'First' },
                  ]}
                />
              </div>
            )}
            {defaults.kind === 'hotel' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  className="sm:col-span-2"
                  label="Destination"
                  value={destination}
                  error={errors.destination}
                  onChange={(event) => setDestination(event.target.value)}
                  required
                />
                <Input
                  label="Check-in"
                  type="date"
                  value={checkIn}
                  error={errors.checkIn}
                  onChange={(event) => setCheckIn(event.target.value)}
                  required
                />
                <Input
                  label="Check-out"
                  type="date"
                  value={checkOut}
                  error={errors.checkOut}
                  onChange={(event) => setCheckOut(event.target.value)}
                  required
                />
                {numberInput(guests, setGuests, 'Guests', errors.guests, 1, 20)}
                {numberInput(rooms, setRooms, 'Rooms', errors.rooms, 1, 10)}
              </div>
            )}
            {defaults.kind === 'package' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xs border border-neutral-200 bg-neutral-50 p-3 sm:col-span-2">
                  <p className="text-xs text-text-secondary">Package interest</p>
                  <p className="font-semibold text-text-primary">{defaults.packageTitle}</p>
                </div>
                <Input
                  label="Preferred travel date"
                  type="date"
                  value={travelDate}
                  onChange={(event) => setTravelDate(event.target.value)}
                />
                {numberInput(travellers, setTravellers, 'Travellers', errors.travellers, 1, 20)}
              </div>
            )}
            {defaults.kind === 'visa' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Destination"
                  value={destination}
                  error={errors.destination}
                  onChange={(event) => setDestination(event.target.value)}
                  required
                />
                <Input
                  label="Nationality"
                  value={nationality}
                  error={errors.nationality}
                  onChange={(event) => setNationality(event.target.value)}
                  required
                />
                <Input
                  className="sm:col-span-2"
                  label="Travel purpose"
                  value={travelPurpose}
                  error={errors.travelPurpose}
                  onChange={(event) => setTravelPurpose(event.target.value)}
                />
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 border-t border-neutral-100 pt-5 sm:grid-cols-2">
              <Input
                label="Full name"
                value={name}
                error={errors.name}
                onChange={(event) => setName(event.target.value)}
                required
                autoComplete="name"
              />
              <Input
                label="Email"
                type="email"
                value={email}
                error={errors.email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
              <Input
                label="Phone (optional)"
                type="tel"
                value={phone}
                error={errors.phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
              />
              <div className="hidden sm:block" />
            </div>
            <Textarea
              label="Notes (optional)"
              value={notes}
              error={errors.notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={1000}
              rows={3}
            />
            <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={status === 'submitting'}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={status === 'submitting'}
                disabled={status === 'submitting'}
              >
                {status === 'submitting' ? 'Sending request…' : service.submit}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
