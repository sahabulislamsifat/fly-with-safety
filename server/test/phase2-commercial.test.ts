import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock('../src/lib/prisma.js', () => ({ prisma: db }));
vi.mock('pg', () => { throw new Error('OFFLINE_DATABASE_FORBIDDEN'); });
vi.mock('dotenv', () => { throw new Error('OFFLINE_ENV_FORBIDDEN'); });
import { applyCommercial, changeBookingCommercial, commercialCommandSchema, readCommercial, type CommercialCommand } from '../src/services/booking-commercial.service.js';
import { bookingDTO } from '../src/utils/booking-dto.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = new Date('2026-10-31T00:00:00Z');
const staff = { id: 'synthetic-staff', role: 'STAFF' as const };
const owner = { id: 'synthetic-owner', role: 'CUSTOMER' as const };
const row = () => ({ id: 'booking', referenceNumber: 'FWS-SYNTHETIC', userId: owner.id, status: 'PENDING', currency: 'BDT', bookingDetails: {} as unknown });
const offer = (n = 1): Extract<CommercialCommand, {action: 'OFFER_QUOTE'}> => ({ action: 'OFFER_QUOTE', requestId: id(n), expectedRevision: 0, amount: 123, currency: 'BDT', validUntil: '2026-11-01T00:00:00Z' });
const accept = (): Extract<CommercialCommand, {action: 'ACCEPT_QUOTE'}> => ({ action: 'ACCEPT_QUOTE', requestId: id(2), quoteId: id(1), expectedRevision: 1 });
const pay = (): Extract<CommercialCommand, {action: 'RECORD_PAYMENT'}> => ({ action: 'RECORD_PAYMENT', requestId: id(3), expectedRevision: 2, amount: 100, currency: 'BDT', method: 'BANK_TRANSFER' });
function offered() { const b = row(); b.bookingDetails = { itinerary: 'preserve', commercial: applyCommercial(b, staff, offer(), now).state }; return b; }
function accepted() { const b = offered(); b.bookingDetails = { commercial: applyCommercial(b, owner, accept(), now).state }; return b; }
beforeEach(() => vi.clearAllMocks());
it('loads legacy bookings without mutating their metadata', () => expect(readCommercial({ itinerary: 'legacy' }).revision).toBe(0));
it('fails closed on malformed persisted commercial data', () => expect(() => readCommercial({ commercial: { version: 2 } })).toThrow('require review'));
it('offers and accepts a quote without confirming inventory or charging', () => {
  const b = offered(), result = applyCommercial(b, owner, accept(), now);
  expect(result.acceptedAmount).toBe(123); expect(result.state.revision).toBe(2);
  expect(result.state.quotes[0].acceptedAt).toBe(now.toISOString()); expect(b.status).toBe('PENDING');
});
it('records a payment only as unverified', () => expect(applyCommercial(accepted(), staff, pay(), now).state.payments[0].status).toBe('RECORDED_UNVERIFIED'));
it('replays the identical actor/request after expiry and closure without another record', () => {
  const b = offered(); b.status = 'CANCELLED'; const r = applyCommercial(b, staff, offer(), new Date('2027-01-01Z'));
  expect(r.replayed).toBe(true); expect(r.state.quotes).toHaveLength(1);
});
it('rejects request-key reuse with a changed amount', () => expect(() => applyCommercial(offered(), staff, { ...offer(), amount: 999 } as CommercialCommand, now)).toThrow('already used'));
it('rejects request-key reuse by another staff identity', () => expect(() => applyCommercial(offered(), { ...staff, id: 'other' }, offer(), now)).toThrow('already used'));
it('rejects stale revisions', () => expect(() => applyCommercial(offered(), staff, offer(9), now)).toThrow('changed'));
for (const role of ['CUSTOMER'] as const) {
  it('denies customer quote issuance', () => expect(() => applyCommercial(row(), { ...owner, role }, offer(), now)).toThrow('Forbidden'));
  it('denies customer payment recording', () => expect(() => applyCommercial(accepted(), { ...owner, role }, pay(), now)).toThrow('Forbidden'));
}
it('denies another customer quote acceptance', () => expect(() => applyCommercial(offered(), { ...owner, id: 'other' }, accept(), now)).toThrow('Forbidden'));
it('denies staff acceptance on the customer behalf', () => expect(() => applyCommercial(offered(), staff, accept(), now)).toThrow('Forbidden'));
it('denies equality at quote expiry', () => expect(() => applyCommercial(offered(), owner, accept(), new Date('2026-11-01Z'))).toThrow('expired'));
it('denies superseded quotes', () => {
  const b = offered(); b.bookingDetails = { commercial: applyCommercial(b, staff, { ...offer(7), expectedRevision: 1 }, now).state };
  expect(() => applyCommercial(b, owner, { ...accept(), expectedRevision: 2 }, now)).toThrow('unavailable');
});
it('denies re-quoting after acceptance', () => expect(() => applyCommercial(accepted(), staff, { ...offer(7), expectedRevision: 2 }, now)).toThrow('no longer quotable'));
it('denies payment without an accepted quote', () => expect(() => applyCommercial(offered(), staff, { ...pay(), expectedRevision: 1 }, now)).toThrow('accepted quotation'));
it('denies mismatching payment currency', () => expect(() => applyCommercial(accepted(), staff, { ...pay(), currency: 'USD' }, now)).toThrow('currency mismatch'));
for (const status of ['COMPLETED', 'CANCELLED']) it('denies new writes to ' + status, () => expect(() => applyCommercial({ ...accepted(), status }, staff, pay(), now)).toThrow('closed'));
for (const amount of [0, -1, 1.1, 2_000_000_001]) it('rejects invalid amount ' + amount, () => expect(commercialCommandSchema.safeParse({ ...offer(), amount }).success).toBe(false));
it('rejects client-supplied verification or ownership', () => expect(commercialCommandSchema.safeParse({ ...pay(), status: 'VERIFIED', actor: 'admin' }).success).toBe(false));
it('minimizes DTO, never exposing receipts to customers or anything commercial to guests', () => {
  const b = accepted(); const dto = bookingDTO(b, 'customer');
  expect(dto.commercial.revision).toBe(2); expect(dto.commercial.receipts).toBeUndefined(); expect(bookingDTO(b, 'guest').commercial).toBeUndefined();
});
it('locks before reading, preserves legacy JSON, uses DB time and writes once', async () => {
  const b = row(); b.bookingDetails = { itinerary: 'legacy' }; const order: string[] = [];
  const tx = { $queryRaw: vi.fn().mockImplementation(async () => { order.push('sql'); return [{ now }]; }),
    booking: { findUnique: vi.fn(async () => { order.push('read'); return b; }), update: vi.fn(async args => args) } };
  db.$transaction.mockImplementation(cb => cb(tx));
  await changeBookingCommercial('fws-synthetic', staff, offer());
  expect(order).toEqual(['sql', 'read', 'sql']); expect(tx.$queryRaw.mock.calls[0][0].sql).toContain('FOR UPDATE');
  expect(tx.booking.update.mock.calls[0][0].data.bookingDetails.itinerary).toBe('legacy'); expect(tx.booking.update).toHaveBeenCalledTimes(1);
});
it('hides existence from a foreign customer before DB time or mutation', async () => {
  const update = vi.fn(), query = vi.fn().mockResolvedValue([]);
  db.$transaction.mockImplementation(cb => cb({ $queryRaw: query, booking: { findUnique: vi.fn().mockResolvedValue(row()), update } }));
  await expect(changeBookingCommercial('FWS-SYNTHETIC', { ...owner, id: 'foreign' }, accept())).rejects.toThrow('not found');
  expect(query).toHaveBeenCalledTimes(1); expect(update).not.toHaveBeenCalled();
});
it('does not persist an idempotent replay twice', async () => {
  const update = vi.fn(), query = vi.fn().mockResolvedValue([{ now }]);
  db.$transaction.mockImplementation(cb => cb({ $queryRaw: query, booking: { findUnique: vi.fn().mockResolvedValue(offered()), update } }));
  await changeBookingCommercial('FWS-SYNTHETIC', staff, offer()); expect(update).not.toHaveBeenCalled();
});
it('propagates a failed write to the transaction owner; never sends a notification', async () => {
  const update = vi.fn().mockRejectedValue(new Error('synthetic-storage-failure'));
  db.$transaction.mockImplementation(cb => cb({ $queryRaw: vi.fn().mockResolvedValue([{ now }]), booking: { findUnique: vi.fn().mockResolvedValue(row()), update } }));
  await expect(changeBookingCommercial('FWS-SYNTHETIC', staff, offer())).rejects.toThrow('synthetic-storage-failure');
  expect(update).toHaveBeenCalledTimes(1);
});
it('caps the receipt ledger without evicting an earlier idempotency identity', () => {
  const b = row(); const state = readCommercial({}); state.revision = 100;
  state.receipts = Array.from({ length: 100 }, (_, n) => ({ id: id(n + 20), actor: staff.id, command: 'retained' }));
  b.bookingDetails = { commercial: state };
  expect(() => applyCommercial(b, staff, { ...offer(), expectedRevision: 100 }, now)).toThrow('record limit');
  expect(readCommercial(b.bookingDetails).receipts).toHaveLength(100);
});
