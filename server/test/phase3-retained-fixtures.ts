import { payable, type Booking } from '../src/payments/payment-domain.js';
import { readCommercial } from '../src/services/booking-commercial.service.js';
export const retainedPaymentFixture = {
  users: [
    { id: 'd8505f78-a138-405e-a750-b23d82af87ad', role: 'CUSTOMER', email: 'd8505f78-a138-405e-a750-b23d82af87ad@example.invalid' },
    { id: '701fb225-e21e-4901-8663-81590207a66f', role: 'CUSTOMER', email: '701fb225-e21e-4901-8663-81590207a66f@example.invalid' },
    { id: '7ca1205c-0844-40d7-abff-74da4974a8de', role: 'STAFF', email: '7ca1205c-0844-40d7-abff-74da4974a8de@example.invalid' },
    { id: '8948d02b-8f17-4e2c-aa35-3875420da1cb', role: 'ADMIN', email: '8948d02b-8f17-4e2c-aa35-3875420da1cb@example.invalid' },
  ],
  bookings: ['df9912fd-492c-4d38-a5a8-fa26e6d947ac', 'b79d19e7-8539-4037-9892-47ebed0f1f5e'],
  passengers: ['620888a7-4eac-4b43-9175-e8ffdcf0b614', '5d6183db-5ea5-49ed-9b3c-605ae8d467ad'],
  initialHistory: ['60d43611-9967-47e9-8ceb-1d5fedb2ad3c', '68584d87-fe22-4c35-85b0-fab2517b45bc'],
  references: ['FWS-P3-DF9912FD', 'FWS-P3-B79D19E7'],
} as const;
export type RetainedSnapshot = {
  users: Array<{ id: string; role: string; email: string; emailVerified: boolean }>;
  bookings: Booking[];
  passengers: Array<{ id: string; bookingId: string; firstName: string; lastName: string; passengerType: string }>;
  history: Array<{ id: string; bookingId: string; fromStatus: string; toStatus: string; changedBy: string | null; reason: string | null }>;
};
export function assertRetainedPaymentFixture(snapshot: RetainedSnapshot, now: number) {
  const guard = (id: string, ok: boolean) => { if (!ok) throw Object.assign(Error('PHASE3_RETAINED_PRESTATE_MISMATCH'), { code: 'PROOF_CHECK', checkId: id }); };
  const f = retainedPaymentFixture;
  guard('retained-exact-row-counts', snapshot.users.length === 4 && snapshot.bookings.length === 2 && snapshot.passengers.length === 2 && snapshot.history.length === 2);
  guard('retained-exact-actors', f.users.every(u => snapshot.users.some(s => s.id === u.id && s.role === u.role && s.email === u.email && s.emailVerified)));
  for (let i = 0; i < 2; i++) {
    const b = snapshot.bookings.find(b => b.id === f.bookings[i]);
    guard('retained-booking-ownership', !!b && b.referenceNumber === f.references[i] && b.userId === f.users[0].id && b.status === 'PENDING' && b.totalPrice === 12000 && b.currency === 'BDT' && b.customerEmail === f.users[0].email && b.customerPhone === '01000000000');
    if (!b) throw Error('UNREACHABLE_RETAINED_BOOKING');
    const details = b.bookingDetails as Record<string, unknown>, tag = details.integrationFixture as Record<string, unknown> | undefined;
    guard('retained-synthetic-tag', !!tag && tag.phase === 3 && tag.provider === 'MOCK_ONLY' && Object.keys(tag).length === 2 && details.gatewayPayment === undefined);
    const commercial = readCommercial(details);
    guard('retained-commercial-prestate', commercial.revision === 2 && commercial.quotes.length === 1 && commercial.payments.length === 0 && commercial.receipts.length === 0);
    const q = commercial.quotes[0];
    guard('retained-quote-window', Number.isFinite(now) && +new Date(q.validUntil) - now > 90000);
    payable(b, { id: f.users[0].id, role: 'CUSTOMER' }, now);
    guard('retained-exact-passenger', snapshot.passengers.some(p => p.id === f.passengers[i] && p.bookingId === b.id && p.firstName === 'Synthetic' && p.lastName === 'Traveller' && p.passengerType === 'adult'));
    guard('retained-exact-history', snapshot.history.some(h => h.id === f.initialHistory[i] && h.bookingId === b.id && h.fromStatus === 'PENDING' && h.toStatus === 'PENDING' && h.changedBy === f.users[0].id && h.reason === 'Synthetic Phase3 accepted-quote fixture prestate; no provider action'));
  }
}
