import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import { readCommercial, type BookingActor } from '../services/booking-commercial.service.js';
import type { Evidence } from './sslcommerz.js';

export const billingSchema = z.object({ requestId: z.uuid().transform(v => v.toLowerCase()), address: z.string().trim().min(1).max(100), city: z.string().trim().min(1).max(50), country: z.string().regex(/^[A-Z]{2}$/) }).strict();
export type Billing = z.infer<typeof billingSchema>;
export type PaymentStatus = 'INITIATING' | 'SESSION_READY' | 'UNKNOWN' | 'VERIFIED' | 'RISK_REVIEW' | 'EXCEPTION_REVIEW' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
export type Attempt = {
  id: string; bookingId: string; userId: string; requestId: string; digest: string; tranId: string;
  quoteId: string; quoteRevision: number; amountMinor: string; currency: 'BDT'; status: PaymentStatus;
  session?: string; valId?: string; bankId?: string; channel?: string; captured: boolean;
  checks: number; due: number; lease?: { owner: string; until: number }; created: number; updated: number;
};
export type Refund = { id: string; paymentId: string; requestId: string; actorId: string; digest: string; amountMinor: string; status: 'INITIATING' | 'UNKNOWN' | 'PROCESSING' | 'REFUNDED' | 'CANCELLED'; reference?: string; created: number; updated: number };
export type Booking = { id: string; referenceNumber: string; userId: string | null; status: string; currency: string; totalPrice: number; bookingDetails: unknown; customerName: string; customerEmail: string; customerPhone: string | null };
export const active = (a: Attempt) => ['INITIATING', 'SESSION_READY', 'UNKNOWN'].includes(a.status);
export function authorize(booking: Booking, actor: BookingActor, customerOnly = false) {
  if (actor.role === 'CUSTOMER' ? booking.userId !== actor.id : customerOnly || !['ADMIN', 'STAFF', 'SUPER_ADMIN'].includes(actor.role)) throw AppError.notFound('Booking not found');
}
export function payable(booking: Booking, actor: BookingActor, now: number) {
  authorize(booking, actor, true);
  const c = readCommercial(booking.bookingDetails), quote = c.quotes.at(-1);
  if (!['PENDING', 'CONFIRMED'].includes(booking.status) || booking.currency !== 'BDT' || !quote?.acceptedAt || quote.currency !== 'BDT' || +new Date(quote.validUntil) <= now || quote.amount !== booking.totalPrice || c.payments.length || !booking.customerPhone)
    throw AppError.conflict('Booking requires an eligible accepted BDT quotation, contact details and no unresolved manual payment');
  const amountMinor = (BigInt(quote.amount) * 100n).toString();
  if (BigInt(amountMinor) > 9_999_999_999n) throw AppError.badRequest('Gateway amount is outside supported bounds');
  return { quote, revision: c.revision, amountMinor };
}
export function digest(input: unknown) { return createHash('sha256').update(JSON.stringify(input)).digest('hex'); }
/** Only authoritative provider API evidence enters here, never callback fields. */
export function settle(attempt: Attempt, booking: Booking, evidence: Evidence, now: number): Attempt {
  if (evidence.tranId !== attempt.tranId || evidence.amountMinor !== attempt.amountMinor || evidence.currency !== attempt.currency) throw AppError.conflict('Gateway evidence does not match the payment intent');
  if (['VALID', 'VALIDATED'].includes(evidence.status)) {
    if (!evidence.valId || !evidence.bankId) throw AppError.conflict('Incomplete gateway verification');
    if (attempt.captured && (attempt.valId !== evidence.valId || attempt.bankId !== evidence.bankId)) throw AppError.conflict('Conflicting gateway transaction identity');
    const c = readCommercial(booking.bookingDetails), q = c.quotes.find(q => q.id === attempt.quoteId);
    const exception = !q?.acceptedAt || (BigInt(q.amount) * 100n).toString() !== attempt.amountMinor || q.currency !== attempt.currency || booking.currency !== attempt.currency || (BigInt(booking.totalPrice) * 100n).toString() !== attempt.amountMinor || c.payments.length > 0 || !['PENDING', 'CONFIRMED'].includes(booking.status);
    // A duplicate validation cannot clear an existing hold or exception.
    const status = exception || attempt.status === 'EXCEPTION_REVIEW' ? 'EXCEPTION_REVIEW' : evidence.risk || attempt.status === 'RISK_REVIEW' ? 'RISK_REVIEW' : 'VERIFIED';
    return { ...attempt, status, captured: true, valId: evidence.valId, bankId: evidence.bankId, channel: evidence.channel, due: 0, updated: now };
  }
  if (attempt.captured) return attempt; // delayed failure/cancellation never downgrades captured funds
  const negative = ['FAILED', 'CANCELLED', 'EXPIRED'];
  // The query contract supplies no ordering proof for conflicting terminal outcomes.
  const terminal = negative.includes(evidence.status) && (!negative.includes(attempt.status) || attempt.status === evidence.status);
  return { ...attempt, status: terminal ? evidence.status as PaymentStatus : 'UNKNOWN', due: terminal ? 0 : now + 60_000, updated: now };
}
export function reserveRefund(payment: Attempt, refunds: Refund[], amount: string) {
  if (!/^[1-9][0-9]{0,9}$/.test(amount) || BigInt(amount) < 1n || !payment.captured || !payment.bankId) throw AppError.conflict('A verified capture and valid refund amount are required');
  const reserved = refunds.filter(r => r.paymentId === payment.id && r.status !== 'CANCELLED').reduce((n, r) => n + BigInt(r.amountMinor), 0n);
  if (BigInt(amount) + reserved > BigInt(payment.amountMinor)) throw AppError.conflict('Refund exceeds the remaining captured balance');
}
export function paymentView(a: Attempt, refunds: Refund[] = []) {
  const own = refunds.filter(r => r.paymentId === a.id), refunded = own.filter(r => r.status === 'REFUNDED').reduce((n, r) => n + BigInt(r.amountMinor), 0n);
  const pending = own.some(r => ['INITIATING', 'UNKNOWN', 'PROCESSING'].includes(r.status));
  const financialState = pending ? 'REFUND_PENDING' : refunded === BigInt(a.amountMinor) ? 'REFUNDED' : refunded > 0n ? 'PARTIALLY_REFUNDED' : a.status;
  const fulfillment = pending || refunded > 0n ? 'REFUND_REVIEW' : a.status === 'VERIFIED' ? 'AWAITING_OPERATIONS' : a.captured ? a.status : 'NOT_PAID';
  return { id: a.id, mode: 'sandbox' as const, status: a.status, financialState, amountMinor: a.amountMinor, currency: a.currency, captured: a.captured, channel: a.channel, createdAt: new Date(a.created).toISOString(), updatedAt: new Date(a.updated).toISOString(), fulfillment };
}
