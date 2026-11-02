import { expect, it, vi } from 'vitest';
vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));
vi.mock('pg', () => { throw Error('OFFLINE_DATABASE_FORBIDDEN'); });
import { PaymentService } from '../src/payments/payment.service.js';
import { payable, reserveRefund, settle, type Attempt, type Booking, type Refund } from '../src/payments/payment-domain.js';
import type { Ledger, PaymentStore } from '../src/payments/payment-store.js';
import type { Evidence, Gateway, GatewayConfig } from '../src/payments/sslcommerz.js';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = { id: 'owner', role: 'CUSTOMER' as const }, admin = { id: 'admin', role: 'ADMIN' as const };
const now = +new Date('2026-11-03T12:00:00Z');
function booking(): Booking { return { id: 'booking', referenceNumber: 'FWS-SYNTHETIC', userId: owner.id, status: 'PENDING', currency: 'BDT', totalPrice: 12000, customerName: 'Synthetic', customerEmail: 'owner@example.invalid', customerPhone: '01000000000', bookingDetails: { commercial: { version: 1, revision: 2, quotes: [{ id: id(1), amount: 12000, currency: 'BDT', description: 'Synthetic service', validUntil: '2026-11-04T00:00:00Z', createdAt: '2026-11-01T00:00:00Z', acceptedAt: '2026-11-02T00:00:00Z' }], payments: [], receipts: [] } } }; }
const billing = { requestId: id(2), address: 'Test address', city: 'Test city', country: 'BD' };
const config: GatewayConfig = { storeId: 'synthetic', password: 'synthetic', callbackOrigin: 'https://callbacks.example.invalid', frontendOrigin: 'http://localhost:3000', storageKey: Buffer.alloc(32, 7), refunds: true };
// Serial in-memory transactions model rollback for unit tests ONLY. This is not PostgreSQL concurrency proof.
function fixture() {
  let state = { booking: booking(), attempts: [] as Attempt[], refunds: [] as Refund[], events: [] as string[], captures: 0 };
  let chain = Promise.resolve();
  let inside = false;
  const store: PaymentStore = {
    async transaction<T>(_reference: string, action: (l: Ledger) => Promise<T>) {
      const previous = chain; let unlock!: () => void; chain = new Promise<void>(r => { unlock = r; }); await previous;
      const copy = structuredClone(state); inside = true;
      const l: Ledger = { ...copy, now, history: [],
        async save(a) { l.attempts = l.attempts.filter(p => p.id !== a.id).concat(structuredClone(a)); },
        async saveRefund(r) { l.refunds = l.refunds.filter(p => p.id !== r.id).concat(structuredClone(r)); },
        async event(_id, key) { if (copy.events.includes(key)) return false; copy.events.push(key); return true; },
        async publish() { copy.captures++; },
      };
      try { const result = await action(l); state = { ...copy, booking: l.booking, attempts: l.attempts, refunds: l.refunds }; return structuredClone(result); }
      finally { inside = false; unlock(); }
    },
    async locate(t) { return state.attempts.some(a => a.tranId === t) ? state.booking.referenceNumber : null; },
    async due() { return [state.booking.referenceNumber]; },
    async operations() { return []; },
  };
  const evidence = (): Evidence => ({ status: 'VALID', tranId: state.attempts[0].tranId, amountMinor: '1200000', currency: 'BDT', valId: 'validation', bankId: 'bank', risk: false });
  const gateway: Gateway = {
    initiate: vi.fn(async () => { expect(inside).toBe(false); expect(state.attempts).toHaveLength(1); return { sessionKey: 'synthetic', url: 'https://sandbox.sslcommerz.com/checkout', channels: ['visa'] }; }),
    query: vi.fn(async () => { expect(inside).toBe(false); return [evidence()]; }),
    validate: vi.fn(async () => { expect(inside).toBe(false); return evidence(); }),
    refund: vi.fn(async () => { expect(inside).toBe(false); expect(state.refunds).toHaveLength(1); return { reference: 'refund-ref', tranId: state.attempts[0].tranId }; }),
    refundStatus: vi.fn(async () => ({ status: 'refunded' as const, bankId: 'bank', tranId: state.attempts[0].tranId, amountMinor: '100' })),
  };
  const service = new PaymentService(store, gateway, config);
  return { service, store, gateway, state: () => state, evidence };
}
async function ready() { const f = fixture(); await f.service.initiate('FWS-SYNTHETIC', owner, billing); return f; }
it('commits one durable intent before network I/O and replays the same session', async () => {
  const f = fixture(), first = await f.service.initiate('FWS-SYNTHETIC', owner, billing), second = await f.service.initiate('FWS-SYNTHETIC', owner, billing);
  expect(first).toEqual(second); expect(first.checkoutUrl).toContain('sandbox.sslcommerz.com'); expect(f.gateway.initiate).toHaveBeenCalledTimes(1); expect(f.state().attempts[0].session).not.toContain('synthetic');
});
it('serializes concurrent same-key initiation without duplicate dispatch', async () => {
  const f = fixture(); await Promise.all(Array.from({ length: 8 }, () => f.service.initiate('FWS-SYNTHETIC', owner, billing)));
  expect(f.gateway.initiate).toHaveBeenCalledTimes(1); expect(f.state().attempts).toHaveLength(1);
});
it('canonicalizes UUID case without creating a second request identity', async () => {
  const f = fixture(), requestId = 'abcdefab-abcd-4abc-8abc-abcdefabcdef';
  const a = await f.service.initiate('FWS-SYNTHETIC', owner, { ...billing, requestId });
  const b = await f.service.initiate('FWS-SYNTHETIC', owner, { ...billing, requestId: requestId.toUpperCase() });
  expect(a.payment.id).toBe(b.payment.id); expect(f.gateway.initiate).toHaveBeenCalledTimes(1);
});
it('rejects changed payload and second active charge', async () => {
  const f = await ready(); await expect(f.service.initiate('FWS-SYNTHETIC', owner, { ...billing, city: 'Changed' })).rejects.toThrow('reused');
  await expect(f.service.initiate('FWS-SYNTHETIC', owner, { ...billing, requestId: id(3) })).rejects.toThrow('Existing payment'); expect(f.gateway.initiate).toHaveBeenCalledTimes(1);
});
it.each([{ id: 'other', role: 'CUSTOMER' as const }, { id: 'staff', role: 'STAFF' as const }, admin])('denies non-owner initiation %j before any effect', async actor => {
  const f = fixture(); await expect(f.service.initiate('FWS-SYNTHETIC', actor, billing)).rejects.toThrow(); expect(f.state().attempts).toHaveLength(0); expect(f.gateway.initiate).not.toHaveBeenCalled();
});
it('does not blindly resubmit an initiation timeout on replay', async () => {
  const f = fixture(); vi.mocked(f.gateway.initiate).mockRejectedValue(Error('private provider error'));
  expect((await f.service.initiate('FWS-SYNTHETIC', owner, billing)).payment.status).toBe('UNKNOWN');
  await f.service.initiate('FWS-SYNTHETIC', owner, billing); expect(f.gateway.initiate).toHaveBeenCalledTimes(1);
});
it.each(['VALID', 'VALIDATED'])('validates %s authoritatively and commits audit once without fulfillment', async status => {
  const f = await ready(); vi.mocked(f.gateway.validate).mockImplementation(async () => ({ ...f.evidence(), status }));
  await f.service.reconcile('FWS-SYNTHETIC', admin); await f.service.reconcile('FWS-SYNTHETIC', admin);
  expect(f.state().attempts[0].status).toBe('VERIFIED'); expect(f.state().captures).toBe(1); expect(f.state().booking.status).toBe('PENDING');
});
it('records a callback durably but never trusts its name as payment evidence', async () => {
  const f = await ready(); await f.service.notify(f.state().attempts[0].tranId, 'validation', 'success');
  expect(f.state().events.some(e => e.startsWith('notice:'))).toBe(true); expect(f.state().attempts[0].captured).toBe(false); expect(f.gateway.validate).not.toHaveBeenCalled();
});
it('deduplicates callback deliveries and rejects unknown transaction', async () => {
  const f = await ready(); for (let i = 0; i < 2; i++) await f.service.notify(f.state().attempts[0].tranId, 'validation', 'ipn');
  expect(f.state().events.filter(e => e.startsWith('notice:'))).toHaveLength(1); await expect(f.service.notify('unknown', undefined, 'ipn')).rejects.toThrow();
});
it.each([{ amountMinor: '1' }, { currency: 'USD' }, { tranId: 'other' }, { valId: 'other' }, { bankId: 'other' }])('holds mismatched provider evidence unresolved %j', async mismatch => {
  const f = await ready(); vi.mocked(f.gateway.validate).mockImplementation(async () => ({ ...f.evidence(), ...mismatch }));
  await f.service.reconcile('FWS-SYNTHETIC', admin); expect(f.state().attempts[0].captured).toBe(false); expect(f.state().captures).toBe(0);
});
it('holds risky and late payments for operations review', async () => {
  const f = await ready(); const a = f.state().attempts[0];
  expect(settle(a, f.state().booking, { ...f.evidence(), risk: true }, now).status).toBe('RISK_REVIEW');
  expect(settle(a, { ...f.state().booking, status: 'CANCELLED' }, f.evidence(), now).status).toBe('EXCEPTION_REVIEW');
});
it('does not let delayed failure downgrade a verified payment', async () => {
  const f = await ready(); await f.service.reconcile('FWS-SYNTHETIC', admin);
  const a = f.state().attempts[0]; expect(settle(a, f.state().booking, { ...f.evidence(), status: 'FAILED' }, now)).toEqual(a);
});
it('enforces lease ownership to reject stale network results', async () => {
  const f = await ready(); vi.mocked(f.gateway.query).mockImplementation(async () => {
    await f.store.transaction('FWS-SYNTHETIC', async l => { await l.save({ ...l.attempts[0], lease: { owner: 'replacement', until: now + 100000 } }); }); return [f.evidence()];
  });
  await f.service.reconcile('FWS-SYNTHETIC', admin); expect(f.state().attempts[0].captured).toBe(false); expect(f.state().attempts[0].lease?.owner).toBe('replacement');
});
it('does not admit customer reconciliation or expose another customer records', async () => {
  const f = await ready(); await expect(f.service.reconcile('FWS-SYNTHETIC', owner)).rejects.toThrow(); await expect(f.service.list('FWS-SYNTHETIC', { ...owner, id: 'other' })).rejects.toThrow();
  await expect(f.service.operations(owner)).rejects.toThrow(); expect(await f.service.operations(admin)).toEqual({ entries: [] });
  const view = await f.service.list('FWS-SYNTHETIC', owner); expect(JSON.stringify(view)).not.toContain('sessionKey'); expect(JSON.stringify(view)).not.toContain('digest');
});
it('reserves refunds before provider I/O and prevents over-refund and replay', async () => {
  const f = await ready(); await f.service.reconcile('FWS-SYNTHETIC', admin); const paymentId = f.state().attempts[0].id;
  const input = { requestId: id(4), paymentId, amountMinor: '100', reason: 'Synthetic refund' };
  await f.service.refund('FWS-SYNTHETIC', admin, input); await f.service.refund('FWS-SYNTHETIC', admin, input);
  expect(f.gateway.refund).toHaveBeenCalledTimes(1); expect(f.state().refunds[0].status).toBe('PROCESSING');
  await expect(f.service.refund('FWS-SYNTHETIC', admin, { ...input, requestId: id(5), amountMinor: '1200000' })).rejects.toThrow('exceeds');
  await f.service.reconcile('FWS-SYNTHETIC', admin); expect(f.state().refunds[0].status).toBe('REFUNDED');
});
it('does not resubmit ambiguous refund or equate it with completed refund', async () => {
  const f = await ready(); await f.service.reconcile('FWS-SYNTHETIC', admin); vi.mocked(f.gateway.refund).mockRejectedValue(Error('timeout'));
  const input = { requestId: id(4), paymentId: f.state().attempts[0].id, amountMinor: '100', reason: 'Synthetic refund' };
  await f.service.refund('FWS-SYNTHETIC', admin, input); await f.service.refund('FWS-SYNTHETIC', admin, input);
  expect(f.state().refunds[0].status).toBe('UNKNOWN'); expect(f.gateway.refund).toHaveBeenCalledTimes(1);
});
it('rejects staff refund and refund without capture', async () => {
  const f = await ready(), input = { requestId: id(4), paymentId: f.state().attempts[0].id, amountMinor: '100', reason: 'Synthetic' };
  await expect(f.service.refund('FWS-SYNTHETIC', { id: 'staff', role: 'STAFF' }, input)).rejects.toThrow(); await expect(f.service.refund('FWS-SYNTHETIC', admin, input)).rejects.toThrow();
});
it('rejects expired/mismatched/manual-payment bookings without initiating', () => {
  const b = booking(); expect(() => payable({ ...b, currency: 'USD' }, owner, now)).toThrow(); expect(() => payable({ ...b, totalPrice: 1 }, owner, now)).toThrow(); expect(() => payable(b, owner, now + 86400000)).toThrow();
});
it('keeps optional legacy quotation descriptions optional without inventing supplier details', () => {
  const b = booking(); const details = b.bookingDetails as { commercial: { quotes: Array<{ description?: string }> } }; delete details.commercial.quotes[0].description;
  expect(payable(b, owner, now).amountMinor).toBe('1200000');
});
it('counts pending and completed refunds against captured funds', async () => {
  const f = await ready(); await f.service.reconcile('FWS-SYNTHETIC', admin);
  const a = f.state().attempts[0], r: Refund = { id: 'r', paymentId: a.id, actorId: 'admin', requestId: id(4), digest: 'synthetic', amountMinor: '1200000', status: 'UNKNOWN', created: now, updated: now };
  expect(() => reserveRefund(a, [r], '1')).toThrow(); expect(() => reserveRefund(a, [{ ...r, status: 'CANCELLED' }], '1')).not.toThrow();
});
it('recovers a session commit acknowledgement loss without a second provider request', async () => {
  const f = fixture(), original = f.store.transaction.bind(f.store); let commits = 0;
  f.store.transaction = async (ref, action) => { const result = await original(ref, action); if (++commits === 2) throw Error('synthetic lost commit acknowledgement'); return result; };
  const result = await f.service.initiate('FWS-SYNTHETIC', owner, billing);
  expect(result.payment.status).toBe('SESSION_READY'); expect(f.gateway.initiate).toHaveBeenCalledTimes(1);
});
it('resumes a durable missed notification after service recreation', async () => {
  const f = await ready(), restarted = new PaymentService(f.store, f.gateway, config);
  await restarted.notify(f.state().attempts[0].tranId, 'validation', 'ipn'); await restarted.reconcile('FWS-SYNTHETIC', admin);
  expect(f.state().attempts[0].captured).toBe(true); expect(f.state().captures).toBe(1);
});
it('does not duplicate finalization after a capture commit acknowledgement loss', async () => {
  const f = await ready(), original = f.store.transaction.bind(f.store); let lost = false;
  f.store.transaction = async (ref, action) => { const result = await original(ref, action); if (!lost && f.state().attempts[0].captured) { lost = true; throw Error('synthetic lost commit acknowledgement'); } return result; };
  await f.service.reconcile('FWS-SYNTHETIC', admin); await f.service.reconcile('FWS-SYNTHETIC', admin);
  expect(f.state().captures).toBe(1); expect(f.state().attempts[0].captured).toBe(true);
});
it('reserves concurrent partial refunds without over-refund', async () => {
  const f = await ready(); await f.service.reconcile('FWS-SYNTHETIC', admin);
  const results = await Promise.allSettled([4, 5].map(n => f.service.refund('FWS-SYNTHETIC', admin, { requestId: id(n), paymentId: f.state().attempts[0].id, amountMinor: '600001', reason: 'Synthetic partial refund' })));
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(f.gateway.refund).toHaveBeenCalledTimes(1);
});
it.each(['FAILED', 'CANCELLED', 'EXPIRED'])('records authoritative %s without changing the booking status', async status => {
  const f = await ready(); vi.mocked(f.gateway.query).mockImplementation(async () => [{ ...f.evidence(), status }]);
  await f.service.reconcile('FWS-SYNTHETIC', admin); expect(f.state().attempts[0].status).toBe(status); expect(f.state().booking.status).toBe('PENDING'); expect(f.state().captures).toBe(0);
});
it('does not fabricate failure when validation is unavailable', async () => {
  const f = await ready(); vi.mocked(f.gateway.validate).mockRejectedValue(Error('synthetic timeout'));
  await f.service.reconcile('FWS-SYNTHETIC', admin); expect(f.state().attempts[0].status).toBe('SESSION_READY'); expect(f.state().attempts[0].due).toBeGreaterThan(now);
});
it('bounds automatic reconciliation and preserves unresolved intent for manual review', async () => {
  const f = await ready(); await f.store.transaction('FWS-SYNTHETIC', async l => l.save({ ...l.attempts[0], checks: 10, due: 0 }));
  await f.service.reconcile('FWS-SYNTHETIC'); expect(f.gateway.query).not.toHaveBeenCalled(); expect(f.state().attempts[0].captured).toBe(false);
});
it('keeps a mismatched refund status unresolved', async () => {
  const f = await ready(); await f.service.reconcile('FWS-SYNTHETIC', admin);
  await f.service.refund('FWS-SYNTHETIC', admin, { requestId: id(4), paymentId: f.state().attempts[0].id, amountMinor: '100', reason: 'Synthetic refund' });
  vi.mocked(f.gateway.refundStatus).mockResolvedValue({ status: 'refunded', bankId: 'different', tranId: f.state().attempts[0].tranId, amountMinor: '100' });
  await f.service.reconcile('FWS-SYNTHETIC', admin); expect(f.state().refunds[0].status).toBe('PROCESSING');
});
