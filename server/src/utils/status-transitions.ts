import { AppError } from './errors.js';

/**
 * Lifecycle rules for customer-facing records. Terminal states have no exits.
 */
const INQUIRY_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Contact lifecycle: NEW -> IN_PROGRESS -> RESOLVED (reopen allowed).
 * Legacy rows created before NEW existed use OPEN/CLOSED; they behave as
 * NEW/RESOLVED so no data migration is required.
 */
const CONTACT_TRANSITIONS: Record<string, readonly string[]> = {
  NEW: ['IN_PROGRESS'],
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['IN_PROGRESS'],
  CLOSED: ['IN_PROGRESS'],
};

/**
 * Booking lifecycle: PENDING -> CONFIRMED/CANCELLED, CONFIRMED -> COMPLETED/CANCELLED.
 */
const BOOKING_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const INQUIRY_STATUSES = Object.keys(INQUIRY_TRANSITIONS) as [string, ...string[]];
export const BOOKING_STATUSES = Object.keys(BOOKING_TRANSITIONS) as [string, ...string[]];
export const CONTACT_STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED'] as const;

function assertTransition(
  table: Record<string, readonly string[]>,
  from: string,
  to: string,
  label: string
): void {
  const allowed = table[from];
  if (!allowed) {
    throw AppError.unprocessable(`Unknown current ${label} status`);
  }
  if (!allowed.includes(to)) {
    throw AppError.unprocessable(
      `Cannot change ${label} status from ${from} to ${to}`,
      { from, to, allowed: [...allowed] }
    );
  }
}

export function assertInquiryTransition(from: string, to: string): void {
  assertTransition(INQUIRY_TRANSITIONS, from, to, 'inquiry');
}

export function assertBookingTransition(from: string, to: string): void {
  assertTransition(BOOKING_TRANSITIONS, from, to, 'booking');
}

export function assertContactTransition(from: string, to: string): void {
  assertTransition(CONTACT_TRANSITIONS, from, to, 'contact');
}

export function canTransitionInquiry(from: string, to: string): boolean {
  return INQUIRY_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionStatus(
  type: 'inquiry' | 'contact' | 'booking' | string,
  from: string,
  to: string
): boolean {
  if (type === 'contact') {
    return CONTACT_TRANSITIONS[from]?.includes(to) ?? false;
  }
  if (type === 'booking') {
    return BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
  }
  return INQUIRY_TRANSITIONS[from]?.includes(to) ?? false;
}
