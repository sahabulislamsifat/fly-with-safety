import { expect, it, vi } from 'vitest';
vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));
vi.mock('pg', () => { throw Error('OFFLINE_DATABASE_FORBIDDEN'); });
import { assertRetainedPaymentFixture, retainedPaymentFixture as f, type RetainedSnapshot } from './phase3-retained-fixtures.js';
const now = Date.parse('2026-11-03T00:00:00Z');
function snapshot(delta = 3600000): RetainedSnapshot {
  return {
    users: f.users.map(u => ({ ...u, emailVerified: true })),
    bookings: f.bookings.map((id, i) => ({ id, referenceNumber: f.references[i], userId: f.users[0].id, status: 'PENDING', currency: 'BDT', totalPrice: 12000, customerName: 'Synthetic Phase3 Owner', customerEmail: f.users[0].email, customerPhone: '01000000000', bookingDetails: { integrationFixture: { phase: 3, provider: 'MOCK_ONLY' }, commercial: { version: 1, revision: 2, quotes: [{ id: '00000000-0000-4000-8000-000000000001', amount: 12000, currency: 'BDT', createdAt: new Date(now - 60000).toISOString(), acceptedAt: new Date(now - 30000).toISOString(), validUntil: new Date(now + delta).toISOString() }], payments: [], receipts: [] } } })),
    passengers: f.passengers.map((id, i) => ({ id, bookingId: f.bookings[i], firstName: 'Synthetic', lastName: 'Traveller', passengerType: 'adult' })),
    history: f.initialHistory.map((id, i) => ({ id, bookingId: f.bookings[i], fromStatus: 'PENDING', toStatus: 'PENDING', changedBy: f.users[0].id, reason: 'Synthetic Phase3 accepted-quote fixture prestate; no provider action' })),
  };
}
it('admits exact retained actors/owned rows without changing any data', () => {
  const s = snapshot(), before = JSON.stringify(s); expect(() => assertRetainedPaymentFixture(s, now)).not.toThrow(); expect(JSON.stringify(s)).toBe(before);
});
it.each([-1, 0, 90000, 90001])('fails closed unless quote window exceeds the unchanged execution budget: %d', delta => {
  const run = () => assertRetainedPaymentFixture(snapshot(delta), now);
  if (delta <= 90000) expect(run).toThrow('PHASE3_RETAINED_PRESTATE_MISMATCH'); else expect(run).not.toThrow();
});
const mutations: Array<[string, (s: RetainedSnapshot) => void]> = [
  ['owner', s => { s.bookings[0].userId = f.users[1].id; }],
  ['amount', s => { s.bookings[0].totalPrice = 1; }],
  ['currency', s => { s.bookings[0].currency = 'USD'; }],
  ['closed booking', s => { s.bookings[0].status = 'COMPLETED'; }],
  ['actor role', s => { s.users[0].role = 'ADMIN'; }],
  ['actor identity', s => { s.users[0].id = 'another-user'; }],
  ['passenger linkage', s => { s.passengers[0].bookingId = f.bookings[1]; }],
  ['extra history', s => { s.history.push({ ...s.history[0] }); }],
  ['commercial/tag data', s => { s.bookings[0].bookingDetails = {}; }],
];
it.each(mutations)('rejects retained fixture mismatch: %s', (_label, mutate) => {
  const s = snapshot(); mutate(s); expect(() => assertRetainedPaymentFixture(s, now)).toThrow('PHASE3_RETAINED_PRESTATE_MISMATCH');
});
