import { afterEach, expect, it, vi } from 'vitest';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Attempt, Booking } from '../src/payments/payment-domain.js';
import type { Gateway, GatewayConfig } from '../src/payments/sslcommerz.js';
const db = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock('../src/lib/prisma.js', () => ({ prisma: { $transaction: db.transaction } }));
import { PrismaPaymentStore } from '../src/payments/payment-store.js';
import { PaymentService } from '../src/payments/payment.service.js';
afterEach(() => vi.restoreAllMocks());

// Real installed adapter, synthetic wire values, no socket or database connection.
async function decode(oid: number, wire: string) {
  const pool = new pg.Pool();
  vi.spyOn(pool, 'connect').mockImplementation(() => { throw Error('OFFLINE_SOCKET_FORBIDDEN'); });
  vi.spyOn(pool, 'query').mockImplementation((async (query: { types: { getTypeParser(oid: number, format: string): (v: string) => string } }) => ({
    fields: [{ name: 'now', dataTypeID: oid }], rows: [[query.types.getTypeParser(oid, 'text')(wire)]], rowCount: 1,
  })) as never);
  const adapter = await new PrismaPg(pool).connect();
  try { const value = await adapter.queryRaw({ sql: 'SELECT synthetic', args: [], argTypes: [] }); return new Date(value.rows[0][0] as string).getTime(); }
  finally { await adapter.dispose(); await pool.end(); }
}
const instant = Date.parse('2026-11-03T00:00:00Z');
it.each([
  ['2026-11-03 06:00:00+06', 6], ['2026-11-02 19:00:00-05', -5],
  ['2026-11-03 05:45:00+05:45', 5.75], ['2026-11-03 00:00:00+00', 0],
])('reproduces installed timestamptz offset loss for %s', async (wire, hours) => {
  expect(await decode(1184, wire)).toBe(instant + hours * 3600000);
  // PostgreSQL AT TIME ZONE UTC emits this same timestamp for each input instant.
  expect(await decode(1114, '2026-11-03 00:00:00')).toBe(instant);
});

const owner = { id: 'synthetic-owner', role: 'CUSTOMER' as const };
const billing = { requestId: '00000000-0000-4000-8000-000000000002', address: 'Synthetic address', city: 'Synthetic city', country: 'BD' };
const config: GatewayConfig = { storeId: 'synthetic', password: 'synthetic', callbackOrigin: 'https://example.invalid', frontendOrigin: 'http://localhost:3000', storageKey: Buffer.alloc(32, 7), refunds: false };
async function fixture(expiryDelta = 3600000, legacyClock = false) {
  const correctedClock = await decode(1114, '2026-11-03 00:00:00');
  const brokenClock = await decode(1184, '2026-11-03 06:00:00+06');
  const booking: Booking = { id: 'synthetic-booking', referenceNumber: 'FWS-P3-SYNTHETIC', userId: owner.id, status: 'PENDING', totalPrice: 12000, currency: 'BDT', customerName: 'Synthetic', customerEmail: 'owner@example.invalid', customerPhone: '01000000000', bookingDetails: { commercial: { version: 1, revision: 2, quotes: [{ id: '00000000-0000-4000-8000-000000000001', amount: 12000, currency: 'BDT', createdAt: new Date(instant - 60000).toISOString(), acceptedAt: new Date(instant - 30000).toISOString(), validUntil: new Date(instant + expiryDelta).toISOString() }], payments: [], receipts: [] } } };
  let attempts: Attempt[] = [], events: string[] = [], queue = Promise.resolve();
  const queries: string[] = [];
  db.transaction.mockImplementation(async (action: (tx: unknown) => Promise<unknown>) => {
    const previous = queue; let release!: () => void;
    queue = new Promise<void>(r => { release = r; }); await previous;
    const oldAttempts = structuredClone(attempts), oldEvents = [...events];
    const tx = {
      booking: { findUnique: async () => structuredClone(booking) },
      async $queryRaw(sql: { strings: string[] }) {
        const text = sql.strings.join('?'); queries.push(text);
        if (text.includes('clock_timestamp')) return [{ now: new Date(!legacyClock && text.includes("AT TIME ZONE 'UTC'") ? correctedClock : brokenClock) }];
        if (text.includes('SELECT state')) return attempts.map(state => ({ state: structuredClone(state) }));
        if (text.includes('SELECT e.kind')) return [{ kind: 'SYNTHETIC', createdAt: new Date(text.includes("AT TIME ZONE 'UTC'") ? correctedClock : brokenClock) }];
        return [];
      },
      async $executeRaw(sql: { strings: string[]; values: unknown[] }) {
        const text = sql.strings.join('?');
        if (text.includes('INSERT INTO public."GatewayPayment"')) {
          const a = JSON.parse(sql.values.at(-1) as string) as Attempt;
          attempts = attempts.filter(p => p.id !== a.id).concat(a); return 1;
        }
        if (text.includes('GatewayPaymentEvent')) { const key = sql.values[0] as string; if (events.includes(key)) return 0; events.push(key); return 1; }
        throw Error('UNEXPECTED_OFFLINE_SQL');
      },
    };
    try { return await action(tx); }
    catch (e) { attempts = oldAttempts; events = oldEvents; throw e; }
    finally { release(); }
  });
  const gateway = { initiate: vi.fn(async () => ({ sessionKey: 'synthetic', url: 'https://sandbox.sslcommerz.com/checkout', channels: [] })) } as unknown as Gateway;
  const store = new PrismaPaymentStore();
  return { service: new PaymentService(store, gateway, config), gateway, store, queries, attempts: () => attempts, events: () => events };
}
it('admits eight identical contenders with one intent and one dispatch under Dhaka clock representation', async () => {
  const f = await fixture();
  const results = await Promise.all(Array.from({ length: 8 }, () => f.service.initiate('FWS-P3-SYNTHETIC', owner, billing)));
  expect(new Set(results.map(r => r.payment.id)).size).toBe(1);
  expect(f.attempts()).toHaveLength(1); expect(f.gateway.initiate).toHaveBeenCalledTimes(1);
  expect(f.events().filter(e => e.startsWith('intent:'))).toHaveLength(1);
  const replay = await f.service.initiate('FWS-P3-SYNTHETIC', owner, billing);
  expect(replay.payment.id).toBe(results[0].payment.id); expect(replay.checkoutUrl).toContain('sandbox.sslcommerz.com');
  expect(f.gateway.initiate).toHaveBeenCalledTimes(1);
  expect((await f.service.list('FWS-P3-SYNTHETIC', owner)).history[0].createdAt).toBe(new Date(instant).toISOString());
  expect(f.queries.some(q => q.includes("clock_timestamp() AT TIME ZONE 'UTC'"))).toBe(true);
});
it('reproduces eight pre-intent CONFLICT outcomes with the original Dhaka clock decoding', async () => {
  const f = await fixture(3600000, true);
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => f.service.initiate('FWS-P3-SYNTHETIC', owner, billing)));
  expect(results.every(r => r.status === 'rejected' && r.reason.code === 'CONFLICT' && r.reason.message.includes('eligible'))).toBe(true);
  expect(f.attempts()).toHaveLength(0); expect(f.events()).toHaveLength(0); expect(f.gateway.initiate).not.toHaveBeenCalled();
});
it.each([-1, 0, 1])('preserves strict expiry boundary delta=%d milliseconds', async delta => {
  const f = await fixture(delta);
  if (delta <= 0) { await expect(f.service.initiate('FWS-P3-SYNTHETIC', owner, billing)).rejects.toThrow('eligible'); expect(f.attempts()).toHaveLength(0); expect(f.gateway.initiate).not.toHaveBeenCalled(); }
  else { await f.service.initiate('FWS-P3-SYNTHETIC', owner, billing); expect(f.gateway.initiate).toHaveBeenCalledTimes(1); }
});
it('keeps conflicting payload, distinct request and foreign ownership denied', async () => {
  const f = await fixture(); await f.service.initiate('FWS-P3-SYNTHETIC', owner, billing);
  await expect(f.service.initiate('FWS-P3-SYNTHETIC', owner, { ...billing, city: 'Different' })).rejects.toThrow('reused');
  await expect(f.service.initiate('FWS-P3-SYNTHETIC', owner, { ...billing, requestId: '00000000-0000-4000-8000-000000000003' })).rejects.toThrow('Existing payment');
  await expect(f.service.initiate('FWS-P3-SYNTHETIC', { ...owner, id: 'other' }, billing)).rejects.toThrow('not found');
  expect(f.gateway.initiate).toHaveBeenCalledTimes(1); expect(f.attempts()).toHaveLength(1);
});
