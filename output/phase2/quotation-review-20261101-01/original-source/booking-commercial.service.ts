import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/errors.js';
import { createHash } from 'node:crypto';

// Amounts use the existing booking whole-currency unit, never floating point.
const amount = z.number().int().min(1).max(2_000_000_000);
const currency = z.enum(['BDT', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'MYR', 'THB', 'SGD', 'INR']);
const time = z.iso.datetime();
const identity = z.uuid().transform(value => value.toLowerCase());
const description = z.string().trim().min(1).max(500);
const reference = z.string().trim().regex(/^[A-Za-z][A-Za-z0-9/_-]{2,63}$/).transform(value => value.toUpperCase());
const quote = z.object({ id: identity, amount, currency, validUntil: time,
  description: description.optional(), createdAt: time, acceptedAt: time.nullable() }).strict();
const payment = z.object({ id: identity, amount, currency,
  method: z.enum(['BANK_TRANSFER', 'CASH', 'MOBILE_BANKING']), recordedAt: time,
  quoteId: identity.optional(), reference: reference.optional(),
  status: z.literal('RECORDED_UNVERIFIED') }).strict();
const receipt = z.object({ id: identity, actor: z.string().max(255), command: z.string().max(1024) }).strict();
export const commercialSchema = z.object({ version: z.literal(1), revision: z.number().int().nonnegative(),
  quotes: z.array(quote).max(100), payments: z.array(payment).max(100), receipts: z.array(receipt).max(100) }).strict();
const base = { requestId: identity, expectedRevision: z.number().int().nonnegative() };
export const commercialCommandSchema = z.discriminatedUnion('action', [
  z.object({ ...base, action: z.literal('OFFER_QUOTE'), amount, currency, validUntil: time, description: description.optional() }).strict(),
  z.object({ ...base, action: z.literal('ACCEPT_QUOTE'), quoteId: identity }).strict(),
  z.object({ ...base, action: z.literal('RECORD_PAYMENT'), amount, currency,
    quoteId: identity.optional(), reference: reference.optional(),
    method: z.enum(['BANK_TRANSFER', 'CASH', 'MOBILE_BANKING']) }).strict(),
]);
export type CommercialCommand = z.infer<typeof commercialCommandSchema>;
export type BookingActor = { id: string; role: 'CUSTOMER' | 'STAFF' | 'ADMIN' };
type BookingState = { userId: string | null; status: string; currency: string; bookingDetails: unknown };

export function readCommercial(details: unknown) {
  const object = details && typeof details === 'object' && !Array.isArray(details) ? details as Record<string, unknown> : {};
  if (object.commercial === undefined) return commercialSchema.parse({ version: 1, revision: 0, quotes: [], payments: [], receipts: [] });
  const parsed = commercialSchema.safeParse(object.commercial);
  if (!parsed.success) throw AppError.conflict('Booking commercial records require review');
  return parsed.data;
}

/** Pure transition; persistence owns serialization and commit/rollback. No provider side effects. */
export function applyCommercial(booking: BookingState, actor: BookingActor, raw: CommercialCommand, now: Date) {
  const command = commercialCommandSchema.parse(raw);
  const staff = actor.role === 'ADMIN' || actor.role === 'STAFF';
  if (command.action === 'ACCEPT_QUOTE' ? actor.role !== 'CUSTOMER' || booking.userId !== actor.id : !staff) {
    throw AppError.forbidden();
  }
  const state = readCommercial(booking.bookingDetails);
  // Canonical parsed property order. New receipts keep a digest, never free text/reference.
  const serialized = JSON.stringify(command);
  const commandDigest = 'sha256:' + createHash('sha256').update(serialized).digest('hex');
  const previous = state.receipts.find(r => r.id === command.requestId);
  if (previous) {
    if (previous.actor !== actor.id || (previous.command !== serialized && previous.command !== commandDigest)) throw AppError.conflict('Request identity already used');
    return { state, replayed: true, acceptedAmount: undefined };
  }
  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) throw AppError.conflict('Booking is closed');
  if (state.revision !== command.expectedRevision) throw AppError.conflict('Booking changed; refresh before continuing');
  if (state.receipts.length >= 100) throw AppError.conflict('Booking record limit reached; review required');
  let acceptedAmount: number | undefined;
  if (command.action === 'OFFER_QUOTE') {
    if (booking.status !== 'PENDING' || state.payments.length || state.quotes.some(q => q.acceptedAt)) throw AppError.conflict('Booking is no longer quotable');
    if (command.currency !== booking.currency || +new Date(command.validUntil) <= +now) throw AppError.badRequest('Invalid quotation currency or expiry');
    state.quotes.push({ id: command.requestId, amount: command.amount, currency: command.currency,
      ...(command.description ? { description: command.description } : {}),
      validUntil: command.validUntil, createdAt: now.toISOString(), acceptedAt: null });
  } else if (command.action === 'ACCEPT_QUOTE') {
    const latest = state.quotes.at(-1);
    if (booking.status !== 'PENDING' || !latest || latest.id !== command.quoteId || latest.currency !== booking.currency || latest.acceptedAt || +new Date(latest.validUntil) <= +now) {
      throw AppError.conflict('Quotation unavailable or expired');
    }
    latest.acceptedAt = now.toISOString(); acceptedAmount = latest.amount;
  } else {
    const accepted = state.quotes.find(q => q.acceptedAt);
    if (!accepted) throw AppError.conflict('An accepted quotation is required');
    if (command.quoteId && command.quoteId !== accepted.id) throw AppError.conflict('Payment quotation mismatch');
    if (command.currency !== booking.currency || command.currency !== accepted.currency) throw AppError.badRequest('Payment currency mismatch');
    if (command.method !== 'CASH' && !command.reference) throw AppError.badRequest('An agency payment reference is required');
    if (command.reference && state.payments.some(p => p.reference === command.reference)) throw AppError.conflict('Payment reference already recorded');
    const recorded = state.payments.reduce((sum, p) => sum + p.amount, 0);
    if (recorded + command.amount > accepted.amount) throw AppError.badRequest('Payment records exceed the accepted quotation amount');
    state.payments.push({ id: command.requestId, amount: command.amount, currency: command.currency,
      quoteId: accepted.id, ...(command.reference ? { reference: command.reference } : {}),
      method: command.method, recordedAt: now.toISOString(), status: 'RECORDED_UNVERIFIED' });
  }
  state.revision++; state.receipts.push({ id: command.requestId, actor: actor.id, command: commandDigest });
  return { state: commercialSchema.parse(state), replayed: false, acceptedAmount };
}

export async function changeBookingCommercial(reference: string, actor: BookingActor, command: CommercialCommand) {
  return prisma.$transaction(async tx => {
    // Shared row lock with status transitions; existing schema/role permissions suffice.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM public."Booking" WHERE "referenceNumber" = ${reference.toUpperCase()} FOR UPDATE`);
    const booking = await tx.booking.findUnique({ where: { referenceNumber: reference.toUpperCase() } });
    if (!booking || (actor.role === 'CUSTOMER' && booking.userId !== actor.id)) throw AppError.notFound('Booking not found');
    const [{ now }] = await tx.$queryRaw<{ now: Date }[]>(Prisma.sql`SELECT clock_timestamp() AS now`);
    const result = applyCommercial(booking, actor, command, now);
    if (result.replayed) return booking;
    const details = booking.bookingDetails && typeof booking.bookingDetails === 'object' && !Array.isArray(booking.bookingDetails) ? booking.bookingDetails : {};
    const updated = await tx.booking.update({ where: { id: booking.id }, data: {
      bookingDetails: { ...details, commercial: result.state } as Prisma.InputJsonValue,
      ...(result.acceptedAmount === undefined ? {} : { totalPrice: result.acceptedAmount }),
    } });
    if (command.action === 'ACCEPT_QUOTE') {
      await tx.bookingStatusHistory.create({ data: { bookingId: booking.id, fromStatus: booking.status, toStatus: booking.status,
        reason: 'Quotation accepted; awaiting staff processing', changedBy: actor.id } });
    }
    return updated;
  });
}
