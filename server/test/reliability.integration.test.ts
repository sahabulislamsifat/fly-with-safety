import { setupStep } from './setup-timing.js';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertPhase1hTarget as assertDisposableTarget } from './integration-target.mjs';

const enabled = process.env.RUN_RELIABILITY_INTEGRATION === 'true';
if (enabled) assertDisposableTarget(process.env);
const runId = `reliability-${randomUUID()}`;
const emails = [`${runId}-a@example.test`, `${runId}-b@example.test`];
const keys: string[] = [];
const outboxIds: string[] = [];
const userIds = [`${runId}-a`, `${runId}-b`];
let prisma: any, bookings: any, outbox: any, notification: any;
let bookingPayload: any;
let verified = false;

// Defense in depth: no real SMTP/provider client exists in this test process.
vi.mock('nodemailer', () => ({ default: { createTransport: () => { throw new Error('External SMTP forbidden'); } } }));

describe.runIf(enabled)('real PostgreSQL reliability', () => {
  let setup: Promise<void> | undefined;
  beforeAll(() => {
    setup = (async () => {
    assertDisposableTarget(process.env);
    if (process.env.NODE_ENV !== 'test') throw new Error('Test process required');
    vi.stubGlobal('fetch', () => { throw new Error('External requests forbidden'); });
    prisma = (await setupStep('reliability.integration.test.ts: prisma import', () => import('../src/lib/prisma.js'))).prisma;
    const identity = await prisma.$queryRaw`SELECT current_database() AS name, inet_server_addr()::text AS host`;
    expect(identity[0].name).toBe(process.env.APPROVED_DISPOSABLE_DATABASE);
    expect(['127.0.0.1/32', '127.0.0.1', '::1/128', '::1']).toContain(identity[0].host);
    // Global worker discovery must never consume unrelated fixtures or customer records.
    expect(await setupStep('reliability: empty outbox', () => prisma.notificationOutbox.count())).toBe(0);
    const precision = await prisma.$queryRaw`SELECT datetime_precision FROM information_schema.columns WHERE table_schema='public' AND table_name='NotificationOutbox' AND column_name='updatedAt'`;
    expect(precision[0]?.datetime_precision).toBe(3);
    const indexes = await prisma.$queryRaw`SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='IdempotencyRecord'`;
    expect(indexes.some((i: any) => /UNIQUE/.test(i.indexdef) && /operation, principal, key/.test(i.indexdef))).toBe(true);
    verified = true;
    bookings = await import('../src/services/booking.service.js');
    outbox = await import('../src/services/outbox.service.js');
    notification = await import('../src/services/notification.service.js');
    const schema = (await import('../src/validators/booking.schemas.js')).createBookingSchema;
    bookingPayload = schema.parse({ customerName: 'Synthetic Integration', customerEmail: emails[0], totalPrice: 100,
      passengers: [{ firstName: 'Synthetic', lastName: 'Passenger' }] });
    for (let i = 0; i < userIds.length; i++) await prisma.user.create({ data: { id: userIds[i], email: emails[i], name: 'Synthetic Integration' } });
    outbox.setOutboxTableAvailable(true);
    })();
    return setup;
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    if (verified && outboxIds.length) await prisma.notificationOutbox.deleteMany({ where: { id: { in: outboxIds } } });
  });
  afterAll(async () => {
    // A hook timeout does not cancel asynchronous setup. Never race its writes with cleanup.
    await setup?.catch(() => undefined);
    if (!prisma) return;
    if (!verified) { await prisma.$disconnect(); vi.unstubAllGlobals(); return; }
    assertDisposableTarget(process.env);
    // Select only this run's exact synthetic identities; delete by returned IDs, never prefixes.
    const owned = await prisma.booking.findMany({ where: { customerEmail: { in: emails } }, select: { id: true } });
    await prisma.booking.deleteMany({ where: { id: { in: owned.map((b: any) => b.id) } } });
    await prisma.idempotencyRecord.deleteMany({ where: { key: { in: keys } } });
    await prisma.notificationOutbox.deleteMany({ where: { id: { in: outboxIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect(); vi.unstubAllGlobals();
  });
  function key() { const value = `${runId}-${randomUUID()}`; keys.push(value); return value; }
  function noBookingEmail() { vi.spyOn(notification, 'sendBookingConfirmation').mockResolvedValue(undefined); }
  async function pending(extra = {}) {
    const id = `${runId}-${randomUUID()}`; outboxIds.push(id);
    return prisma.notificationOutbox.create({ data: { id, recipient: emails[0], subject: 'Synthetic',
      payload: { template: 'BOOKING_CONFIRMATION', params: {} }, ...extra } });
  }
  it('isolates customers and replays only identical payloads', async () => {
    noBookingEmail(); const k = key();
    const a = await bookings.createBooking(bookingPayload, userIds[0], k);
    const b = await bookings.createBooking(bookingPayload, userIds[1], k);
    expect(a.id).not.toBe(b.id);
    expect((await bookings.createBooking(bookingPayload, userIds[0], k)).id).toBe(a.id);
    await expect(bookings.createBooking({ ...bookingPayload, totalPrice: 200 }, userIds[0], k)).rejects.toMatchObject({ statusCode: 409 });
  });
  it('commits one booking under concurrent creation', async () => {
    noBookingEmail(); const k = key();
    const results = await Promise.all(Array.from({ length: 4 }, () => bookings.createBooking(bookingPayload, userIds[0], k)));
    expect(new Set(results.map((b: any) => b.id)).size).toBe(1);
    expect(await prisma.idempotencyRecord.count({ where: { operation: 'booking:create', key: k } })).toBe(1);
    expect(await prisma.bookingPassenger.count({ where: { bookingId: results[0].id } })).toBe(1);
  });
  it('rolls back booking and child rows when the transaction aborts', async () => {
    const k = key(); const referenceNumber = `${runId}-rollback`;
    const { createIdempotentInquiry } = await import('../src/services/idempotency.service.js');
    await expect(createIdempotentInquiry({ operation: 'booking:create', key: k, userId: userIds[0], email: emails[0], payload: {},
      create: async tx => {
        await tx.booking.create({ data: { referenceNumber, customerName: 'Synthetic', customerEmail: emails[0],
          passengers: { create: { firstName: 'Synthetic', lastName: 'Passenger' } } } });
        throw new Error('Synthetic rollback');
      }, findByReference: async () => null,
    })).rejects.toThrow('Synthetic rollback');
    expect(await prisma.booking.count({ where: { referenceNumber } })).toBe(0);
    expect(await prisma.idempotencyRecord.count({ where: { key: k } })).toBe(0);
  });
  it('persists replay across independent restarted processes', async () => {
    noBookingEmail(); const k = key(); const original = await bookings.createBooking(bookingPayload, userIds[0], k);
    const child = () => promisify(execFile)(process.execPath, ['--import', 'tsx', 'test/fixtures/replay-booking.ts',
      JSON.stringify({ key: k, userId: userIds[0], payload: bookingPayload })], { timeout: 20000, env: process.env });
    const [a, b] = await Promise.all([child(), child()]);
    expect(a.stdout.trim()).toBe(original.id); expect(b.stdout.trim()).toBe(original.id);
  });
  it('atomically consumes OAuth state and rejects persisted replay', async () => {
    const express = (await import('express')).default, cookieParser = (await import('cookie-parser')).default;
    const request = (await import('supertest')).default;
    const { beginGoogleState, verifyGoogleState } = await import('../src/middleware/oauth-state.js');
    const app = express(); app.use(cookieParser());
    app.get('/begin', beginGoogleState, (_req, res) => res.json({ state: res.locals.googleOAuthState }));
    app.get('/callback', verifyGoogleState, (_req, res) => res.status(204).end());
    const start = await request(app).get('/begin'); const state = start.body.state; keys.push(state);
    const cookie = start.headers['set-cookie'][0].split(';')[0];
    const callback = () => request(app).get('/callback').query({ code: 'synthetic', state }).set('Cookie', cookie);
    const results = await Promise.all([callback(), callback()]);
    expect(results.map(r => r.status).sort()).toEqual([204, 302]);
    expect((await callback()).status).toBe(302);
    expect(await prisma.idempotencyRecord.count({ where: { operation: 'oauth:google:consume', key: state } })).toBe(1);
  });
  it('claims one notification under concurrent workers', async () => {
    const row = await pending();
    const send = vi.spyOn(notification, 'sendEmailRaw').mockResolvedValue({ status: 'submitted' });
    await Promise.all([outbox.processOutboxBatch(1, { throwOnError: true }), outbox.processOutboxBatch(1, { throwOnError: true })]);
    expect(send).toHaveBeenCalledOnce();
    expect((await prisma.notificationOutbox.findUnique({ where: { id: row.id } })).status).toBe('DELIVERED');
  });
  it('rejects expired OAuth state without a consumption record', async () => {
    const express = (await import('express')).default, cookieParser = (await import('cookie-parser')).default;
    const request = (await import('supertest')).default, jwt = (await import('jsonwebtoken')).default;
    const { verifyGoogleState } = await import('../src/middleware/oauth-state.js');
    const { env } = await import('../src/config/env.js');
    const state = randomUUID().replaceAll('-', '') + 'abcdefghijk'; keys.push(state);
    const cookie = jwt.sign({ state }, env.jwtSecret, { audience: 'flywithsafe:google-oauth-state', issuer: 'flywithsafe', expiresIn: -1 });
    const app = express(); app.use(cookieParser()); app.get('/callback', verifyGoogleState, (_req, res) => res.status(204).end());
    const res = await request(app).get('/callback').query({ state, code: 'synthetic' }).set('Cookie', `google_oauth_state=${cookie}`);
    expect(res.status).toBe(302); expect(await prisma.idempotencyRecord.count({ where: { key: state } })).toBe(0);
  });
  it('recovers a persisted claim after the owning child process exits', async () => {
    const row = await pending();
    const result = await promisify(execFile)(process.execPath, ['--import', 'tsx', 'test/fixtures/replay-booking.ts',
      JSON.stringify({ claimId: row.id })], { timeout: 20000, env: process.env });
    expect(result.stdout).toBe('claimed');
    expect((await prisma.notificationOutbox.findUnique({ where: { id: row.id } })).status).toBe('PROCESSING');
    await prisma.notificationOutbox.update({ where: { id: row.id }, data: { updatedAt: new Date(Date.now() - 300001) } });
    vi.spyOn(notification, 'sendEmailRaw').mockResolvedValue({ status: 'submitted' });
    const recovered = await outbox.processOutboxBatch(1, { throwOnError: true });
    expect(recovered.recovered).toBe(1); expect(recovered.delivered).toBe(1);
  });
  it('recovers an expired lease and fences the old worker acknowledgment', async () => {
    const row = await pending(); let release!: (value: any) => void, signal!: () => void;
    const ready = new Promise<void>(resolve => { signal = resolve; });
    vi.spyOn(notification, 'sendEmailRaw').mockImplementationOnce(() => {
      signal(); return new Promise(resolve => { release = resolve; });
    }).mockResolvedValue({ status: 'submitted' });
    const old = outbox.processOutboxBatch(1, { throwOnError: true });
    await ready;
    try {
      await prisma.notificationOutbox.update({ where: { id: row.id }, data: { updatedAt: new Date(Date.now() - 300001) } });
      expect((await outbox.processOutboxBatch(1, { throwOnError: true })).delivered).toBe(1);
    } finally { release({ status: 'submitted' }); }
    expect((await old).delivered).toBe(0);
    expect((await prisma.notificationOutbox.findUnique({ where: { id: row.id } })).status).toBe('DELIVERED');
  });
  it('persists retry, terminal failure, redrive and suppression', async () => {
    const row = await pending({ maxAttempts: 2 });
    vi.spyOn(notification, 'sendEmailRaw').mockRejectedValue(new Error('Synthetic transport failure'));
    await outbox.processOutboxBatch(1, { throwOnError: true });
    let stored = await prisma.notificationOutbox.findUnique({ where: { id: row.id } });
    expect(stored.status).toBe('PENDING'); expect(stored.attempts).toBe(1); expect(+stored.nextAttemptAt).toBeGreaterThan(Date.now());
    await prisma.notificationOutbox.update({ where: { id: row.id }, data: { nextAttemptAt: new Date(0) } });
    await outbox.processOutboxBatch(1, { throwOnError: true });
    expect((await prisma.notificationOutbox.findUnique({ where: { id: row.id } })).status).toBe('FAILED');
    const failedVersion = (await prisma.notificationOutbox.findUnique({ where: { id: row.id } })).updatedAt;
    expect(await outbox.redriveFailedNotification(row.id)).toBe(true);
    expect(+(await prisma.notificationOutbox.findUnique({ where: { id: row.id } })).updatedAt).toBeGreaterThan(+failedVersion);
    vi.mocked(notification.sendEmailRaw).mockResolvedValue({ status: 'suppressed', reason: 'EMAIL_DELIVERY_DISABLED' });
    await outbox.processOutboxBatch(1, { throwOnError: true });
    stored = await prisma.notificationOutbox.findUnique({ where: { id: row.id } });
    expect(stored.status).toBe('FAILED'); expect(stored.attempts).toBe(0); expect(stored.error).toContain('EMAIL_DELIVERY_DISABLED');
  });
});
