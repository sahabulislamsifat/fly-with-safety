/** MOCKED CONTRACT TESTS. Real router, SDK, service and store over an in-memory Prisma boundary. */
import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { Duplex } from 'node:stream';
import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../src/generated/prisma/client.js';
import type { Attempt, Booking } from '../src/payments/payment-domain.js';

vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));
vi.mock('../src/config/env.js', () => ({ env: { nodeEnv: 'test' } }));
vi.mock('pg', () => { throw Error('MOCKED_CONTRACT_DATABASE_FORBIDDEN'); });
vi.mock('dotenv', () => { throw Error('MOCKED_CONTRACT_ENV_FORBIDDEN'); });

import { errorHandler } from '../src/middleware/error-handler.js';
import { createPaymentCallbacks } from '../src/payments/payment.routes.js';
import { PaymentService } from '../src/payments/payment.service.js';
import { PrismaPaymentStore } from '../src/payments/payment-store.js';
import { gatewayConfig, SSLCommerzClient } from '../src/payments/sslcommerz.js';

const now = Date.parse('2026-11-05T00:00:00Z');
const owner = { id: 'synthetic-owner', role: 'CUSTOMER' as const };
const staff = { id: 'synthetic-staff', role: 'STAFF' as const };
const admin = { id: 'synthetic-admin', role: 'ADMIN' as const };
const reference = 'FWS-SYNTHETIC';
const config = {
  storeId: 'synthetic-store', password: 'synthetic-password', callbackOrigin: 'https://callbacks.example.invalid',
  frontendOrigin: 'http://localhost:3000', storageKey: Buffer.alloc(32), refunds: false,
};
const immutableTrigger = readFileSync(resolve(__dirname, '../prisma/migrations/20261103000100_gateway_sandbox_ledgers/migration.sql'), 'utf8');
const mutableStateKeys = new Set([...immutableTrigger.match(/NEW\.state - ARRAY\[([^\]]+)\]/)![1].matchAll(/'([^']+)'/g)].map(m => m[1]));
const immutableState = (a: Attempt) => Object.entries(a).filter(([key]) => !mutableStateKeys.has(key)).sort(([a], [b]) => a.localeCompare(b));
const makeAttempt = (id = 'synthetic-attempt', overrides: Partial<Attempt> = {}): Attempt => ({
  id, bookingId: 'synthetic-booking', userId: owner.id, requestId: id, digest: 'synthetic', tranId: id,
  quoteId: '00000000-0000-4000-8000-000000000001', quoteRevision: 2, amountMinor: '1200000', currency: 'BDT',
  status: 'SESSION_READY', captured: false, checks: 0, due: now + 60_000, created: now, updated: now, ...overrides,
});
const makeBooking = (): Booking => ({
  id: 'synthetic-booking', referenceNumber: reference, userId: owner.id, status: 'PENDING', currency: 'BDT', totalPrice: 12000,
  customerName: 'Synthetic', customerEmail: 'owner@example.invalid', customerPhone: '01000000000',
  bookingDetails: { commercial: { version: 1, revision: 2, quotes: [{ id: makeAttempt().quoteId, amount: 12000, currency: 'BDT', description: 'Synthetic', validUntil: '2026-11-06T00:00:00Z', createdAt: '2026-11-04T00:00:00Z', acceptedAt: '2026-11-04T00:00:00Z' }], payments: [], receipts: [] } },
});

// Exercise the actual Express form parser and routes without a listening socket.
function postForm(app: express.Express, path: string, payload: Record<string, string>) {
  const body = new URLSearchParams(payload).toString();
  return new Promise<{ status: number; headers: ReturnType<ServerResponse['getHeaders']>; text: string }>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = new Duplex({ read() {}, write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
    Object.defineProperty(stream, 'remoteAddress', { value: '127.0.0.1' });
    const socket = stream as Socket;
    const req = new IncomingMessage(socket);
    req.method = 'POST';
    req.url = path;
    req.headers = { 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(body)) };
    const res = new ServerResponse(req);
    res.assignSocket(socket);
    stream.once('error', reject);
    res.once('error', reject);
    res.once('finish', () => {
      const message = Buffer.concat(chunks).toString('utf8');
      resolve({ status: res.statusCode, headers: res.getHeaders(), text: message.slice(message.indexOf('\r\n\r\n') + 4) });
      stream.destroy();
    });
    req.complete = true;
    app(req, res);
    req.push(body);
    req.push(null);
  });
}

function fixture(attempts = [makeAttempt()]) {
  let state = { booking: makeBooking(), attempts, events: [] as Array<{ id: string; paymentId: string; kind: string; createdAt: Date }>, published: 0 };
  let tail = Promise.resolve();
  const transactionContext = new AsyncLocalStorage<boolean>();
  let failOutcome: string | undefined;
  let failNotice = false;
  const database = {
    async $queryRaw(sql: Prisma.Sql) {
      if (!sql.sql.includes('p."tranId"')) throw Error('UNEXPECTED_ROOT_QUERY');
      return state.attempts.some(a => a.tranId === sql.values[0]) ? [{ referenceNumber: reference }] : [];
    },
    async $transaction<T>(action: (tx: object) => Promise<T>) {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>(resolve => { release = resolve; });
      await previous;
      const next = structuredClone(state);
      try {
        const result = await transactionContext.run(true, () => action({
          booking: { findUnique: async () => next.booking, update: async () => { next.published++; } },
          async $queryRaw(sql: Prisma.Sql) {
            if (sql.sql.includes('clock_timestamp')) return [{ now: new Date(now) }];
            if (sql.sql.includes('GatewayPaymentEvent')) return next.events;
            if (sql.sql.includes('GatewayRefund')) return [];
            if (sql.sql.includes('GatewayPayment')) return next.attempts.map(state => ({ state }));
            if (sql.sql.includes('FOR UPDATE')) return [{ id: next.booking.id }];
            throw Error('UNEXPECTED_TRANSACTION_QUERY');
          },
          async $executeRaw(sql: Prisma.Sql) {
            if (sql.sql.includes('INSERT INTO public."GatewayPaymentEvent"')) {
              const [id, paymentId, kind] = sql.values as string[];
              if (kind === failOutcome || kind === 'NOTICE' && failNotice) throw Error('SYNTHETIC_WRITE_FAILURE');
              if (next.events.some(e => e.id === id)) return 0;
              next.events.push({ id, paymentId, kind, createdAt: new Date(now) });
              return 1;
            }
            if (sql.sql.includes('INSERT INTO public."GatewayPayment"')) {
              const a = JSON.parse(String(sql.values[9])) as Attempt;
              const before = next.attempts.find(p => p.id === a.id);
              if (before && JSON.stringify(immutableState(a)) !== JSON.stringify(immutableState(before))) throw Error('GATEWAY_IMMUTABLE_IDENTITY_OR_CAPTURE');
              next.attempts = [...next.attempts.filter(p => p.id !== a.id), a];
              return 1;
            }
            throw Error('UNEXPECTED_WRITE');
          },
          bookingStatusHistory: { create: async () => undefined },
          notificationOutbox: { create: async () => undefined },
          user: { findMany: async () => [] },
        }));
        state = next;
        return result;
      } finally { release(); }
    },
  };
  const transport = vi.fn<typeof fetch>();
  const gateway = new SSLCommerzClient(config, async (input, init) => {
    expect(transactionContext.getStore()).toBeUndefined();
    const url = new URL(String(input));
    expect(url.origin).toBe('https://sandbox.sslcommerz.com');
    expect(url.searchParams.get('store_id')).toBe(config.storeId);
    expect(url.searchParams.get('store_passwd')).toBe(config.password);
    expect(init?.method).toBe('GET');
    expect(init?.redirect).toBe('error');
    return transport(input, init);
  });
  const store = new PrismaPaymentStore(database as unknown as ConstructorParameters<typeof PrismaPaymentStore>[0]);
  const service = new PaymentService(store, gateway, config);
  const app = express();
  app.use('/api/v1', createPaymentCallbacks(() => service, () => config));
  app.use(errorHandler);
  return {
    transport, service, state: () => state, attempt: (id = makeAttempt().id) => state.attempts.find(a => a.id === id)!,
    failOutcome(kind: string) { failOutcome = kind; }, failNotice() { failNotice = true; },
    post(source: string, payload: Record<string, string>) { return postForm(app, `/api/v1/payments/sslcommerz/${source}`, payload); },
  };
}

const row = (status: string, overrides: Record<string, string> = {}) => ({
  status, tran_id: makeAttempt().tranId, amount: '12000.00', currency: 'BDT', currency_type: 'BDT', currency_amount: '12000.00',
  risk_level: '0', ...overrides,
});
const queried = (...rows: ReturnType<typeof row>[]) => Response.json({ APIConnect: 'DONE', no_of_trans_found: rows.length, element: rows });
function signed(status: string, overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = { tran_id: makeAttempt().tranId, amount: '12000.00', currency: 'BDT', status, store_id: config.storeId, ...overrides };
  const keys = Object.keys(fields).sort();
  const signingFields = { ...fields, store_passwd: createHash('md5').update(config.password).digest('hex') };
  const verify_sign = createHash('md5').update(Object.entries(signingFields).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('&')).digest('hex');
  return { ...fields, verify_key: keys.join(','), verify_sign };
}

describe('MOCKED CONTRACT TESTS — SSLCommerz V4 negative outcomes', () => {
  it.each([['fail', 'FAILED'], ['cancel', 'CANCELLED']])('persists %s only after matching provider query with no validation ID', async (source, status) => {
    const f = fixture();
    f.transport.mockResolvedValueOnce(queried(row(status)));
    const result = await f.post(source, { tran_id: makeAttempt().tranId, status });
    expect(result.status).toBe(303);
    expect(result.headers.location).toBe(`${config.frontendOrigin}/payments/return?booking=${reference}`);
    expect(f.attempt()).toMatchObject({ status, captured: false, due: 0 });
    expect(f.state().events.map(e => e.kind)).toEqual(['NOTICE', status]);
    expect(f.state().booking.status).toBe('PENDING');
    expect(f.state().published).toBe(0);
    expect(f.transport).toHaveBeenCalledOnce();
    const statusView = await f.service.list(reference, owner);
    expect(statusView.payments[0]).toMatchObject({ financialState: status, fulfillment: 'NOT_PAID' });
    expect((await f.service.list(reference, staff)).payments).toEqual(statusView.payments);
    expect((await f.service.list(reference, admin)).history).toEqual(statusView.history);
    await expect(f.service.list(reference, { ...owner, id: 'foreign-customer' })).rejects.toThrow();
  });

  it.each(['FAILED', 'CANCELLED'])('acknowledges signed %s IPN and deduplicates simultaneous and replayed notices', async status => {
    const f = fixture();
    f.transport.mockResolvedValueOnce(queried(row(status, { val_id: '' })));
    const form = signed(status);
    const responses = await Promise.all(Array.from({ length: 4 }, () => f.post('ipn', form)));
    expect(responses.map(r => [r.status, r.text])).toEqual(Array.from({ length: 4 }, () => [200, 'RECEIVED']));
    expect((await f.post('ipn', form)).status).toBe(200);
    expect(f.transport).toHaveBeenCalledOnce();
    expect(f.state().events.map(e => e.kind)).toEqual(['NOTICE', status]);
  });

  it.each([['UNATTEMPTED', 'UNKNOWN'], ['EXPIRED', 'EXPIRED'], ['PENDING', 'UNKNOWN'], ['PROCESSING', 'SESSION_READY'], ['UNRECOGNIZED', 'SESSION_READY']])('keeps provider %s distinct from a claimed failure', async (status, expected) => {
    const f = fixture();
    f.transport.mockResolvedValueOnce(queried(row(status)));
    expect((await f.post('fail', signed('FAILED'))).status).toBe(303);
    expect(f.attempt()).toMatchObject({ status: expected, captured: false });
    expect(f.state().events.some(e => ['FAILED', 'CANCELLED'].includes(e.kind))).toBe(false);
  });

  it.each<Record<string, string>>([{ tran_id: 'foreign-transaction' }, { amount: '1.00', currency_amount: '1.00' }, { currency: 'USD' }, { currency_type: 'USD' }, { currency_amount: '1.00' }, { store_id: 'foreign-store' }])('rejects mismatched authoritative evidence %j', async mismatch => {
    const f = fixture();
    f.transport.mockResolvedValueOnce(queried(row('FAILED', mismatch)));
    expect((await f.post('ipn', signed('FAILED'))).status).toBe(200);
    expect(f.attempt()).toMatchObject({ status: 'SESSION_READY', captured: false });
    expect(f.state().events.map(e => e.kind)).toEqual(['NOTICE', 'RECONCILIATION_UNRESOLVED']);
  });

  it('rejects tampering, foreign store and unknown transaction before provider dispatch', async () => {
    const f = fixture();
    expect((await f.post('ipn', { ...signed('FAILED'), amount: '1' })).status).toBe(400);
    expect((await f.post('cancel', signed('CANCELLED', { store_id: 'other' }))).status).toBe(400);
    expect((await f.post('fail', signed('FAILED', { tran_id: 'foreign' }))).status).toBe(404);
    expect(f.transport).not.toHaveBeenCalled();
    expect(f.state().events).toEqual([]);
  });

  it('uses an unsigned browser return as a hint and preserves pending reconciliation on outage', async () => {
    const f = fixture();
    f.transport.mockRejectedValueOnce(Error('synthetic network failure'));
    expect((await f.post('cancel', { tran_id: makeAttempt().tranId, status: 'CANCELLED', amount: '1', currency: 'USD' })).status).toBe(303);
    expect(f.attempt()).toMatchObject({ status: 'SESSION_READY', captured: false });
    expect(f.attempt().due).toBeGreaterThan(now);
  });

  it('does not confuse Transaction Query authentication failure with payment failure', async () => {
    const f = fixture();
    f.transport.mockResolvedValueOnce(Response.json({ APIConnect: 'FAILED', element: [row('FAILED')] }));
    expect((await f.post('ipn', signed('FAILED'))).status).toBe(200);
    expect(f.attempt()).toMatchObject({ status: 'SESSION_READY', captured: false });
    expect(f.state().events.map(e => e.kind)).toEqual(['NOTICE', 'RECONCILIATION_UNRESOLVED']);
  });

  it('does not capture a success query without a validation ID', async () => {
    const f = fixture();
    f.transport.mockResolvedValueOnce(queried(row('VALID')));
    await f.post('fail', signed('FAILED'));
    expect(f.transport).toHaveBeenCalledOnce();
    expect(f.attempt()).toMatchObject({ status: 'SESSION_READY', captured: false });
  });

  it('keeps conflicting negative query records unresolved', async () => {
    const f = fixture();
    f.transport.mockResolvedValueOnce(queried(row('FAILED'), row('CANCELLED')));
    await f.post('ipn', signed('FAILED'));
    expect(f.attempt().status).toBe('SESSION_READY');
  });

  it('reopens reconciliation on conflicting successive terminal negatives', async () => {
    const f = fixture([makeAttempt(undefined, { status: 'FAILED', due: 0 })]);
    f.transport.mockResolvedValueOnce(queried(row('CANCELLED')));
    await f.post('cancel', signed('CANCELLED'));
    expect(f.attempt()).toMatchObject({ status: 'UNKNOWN', captured: false });
    expect(f.attempt().due).toBeGreaterThan(now);
  });

  it('preserves a verified capture on delayed negative evidence', async () => {
    const f = fixture([makeAttempt(undefined, { status: 'VERIFIED', captured: true, valId: 'verified-val', bankId: 'verified-bank', due: 0 })]);
    f.transport.mockResolvedValueOnce(queried(row('FAILED')));
    await f.post('fail', signed('FAILED'));
    expect(f.attempt()).toMatchObject({ status: 'VERIFIED', captured: true, valId: 'verified-val', bankId: 'verified-bank' });
    expect(f.state().events.map(e => e.kind)).toEqual(['NOTICE']);
    expect(f.state().published).toBe(0);
  });

  it('queries the callback transaction even when another attempt is active', async () => {
    const newer = makeAttempt('newer-attempt', { due: now });
    const f = fixture([makeAttempt(undefined, { status: 'FAILED', due: 0 }), newer]);
    f.transport.mockResolvedValueOnce(queried(row('FAILED')));
    await f.post('fail', signed('FAILED'));
    expect(new URL(String(f.transport.mock.calls[0][0])).searchParams.get('tran_id')).toBe(makeAttempt().tranId);
    expect(f.attempt(newer.id)).toEqual(newer);
  });

  it('defers a stale negative result when a distinct IPN arrives during its query', async () => {
    const f = fixture();
    let complete!: (response: Response) => void;
    let started!: () => void;
    const pending = new Promise<Response>(resolve => { complete = resolve; });
    const queried = new Promise<void>(resolve => { started = resolve; });
    f.transport.mockImplementationOnce(() => { started(); return pending; });
    const first = f.post('ipn', signed('FAILED'));
    try {
      await queried;
      expect((await f.post('ipn', signed('CANCELLED'))).status).toBe(200);
    } finally { complete(Response.json({ APIConnect: 'DONE', element: [row('FAILED')] })); }
    expect((await first).status).toBe(200);
    expect(f.transport).toHaveBeenCalledOnce();
    expect(f.attempt()).toMatchObject({ status: 'SESSION_READY', captured: false, due: now });
    expect(f.state().events.map(e => e.kind)).toEqual(['NOTICE', 'NOTICE']);
    f.transport.mockResolvedValueOnce(Response.json({ APIConnect: 'DONE', element: [row('CANCELLED')] }));
    await f.service.reconcile(reference);
    expect(f.attempt()).toMatchObject({ status: 'CANCELLED', captured: false, due: 0 });
    expect(f.state().events.map(e => e.kind)).toEqual(['NOTICE', 'NOTICE', 'CANCELLED']);
  });

  it('rolls back terminal status when its audit event fails in the same transaction', async () => {
    const f = fixture();
    f.failOutcome('FAILED');
    f.transport.mockResolvedValueOnce(queried(row('FAILED')));
    expect((await f.post('ipn', signed('FAILED'))).status).toBe(200);
    expect(f.attempt()).toMatchObject({ status: 'SESSION_READY', captured: false });
    expect(f.state().events.map(e => e.kind)).toEqual(['NOTICE', 'RECONCILIATION_UNRESOLVED']);
  });

  it('leaves the ledger untouched if the durable notice cannot be written', async () => {
    const f = fixture();
    const before = structuredClone(f.state());
    f.failNotice();
    expect((await f.post('ipn', signed('FAILED'))).status).toBe(500);
    expect(f.state()).toEqual(before);
    expect(f.transport).not.toHaveBeenCalled();
  });

  it('rejects an attempt owned by a different booking customer before querying', async () => {
    const f = fixture([makeAttempt(undefined, { userId: 'foreign-owner' })]);
    expect((await f.post('fail', signed('FAILED'))).status).toBe(404);
    expect(f.transport).not.toHaveBeenCalled();
    expect(f.state().events).toEqual([]);
  });

  it('keeps the default and production gateway fail-closed', () => {
    expect(() => gatewayConfig({})).toThrow();
    expect(() => gatewayConfig({ NODE_ENV: 'production', SSLCOMMERZ_ENABLED: 'true', SSLCOMMERZ_SANDBOX: 'true', SSLCOMMERZ_SCHEMA_VERIFIED: 'true', EMAIL_DELIVERY_ENABLED: 'false' })).toThrow('Sandbox payment activation is not approved');
  });
});
