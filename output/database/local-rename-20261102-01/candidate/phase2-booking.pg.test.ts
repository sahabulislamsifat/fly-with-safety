import { expect, it, vi } from 'vitest';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { writeFileSync, appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import { safeFailure, safeHttpOutcome } from './phase2-identity-diagnostic.js';

// This dedicated integration file never discovers .env or a default database.
vi.mock('dotenv', () => ({ default: { config: () => ({ parsed: {} }) }, config: () => ({ parsed: {} }) }));
const enabled = process.env.PHASE2_BOOKING_MODE === 'owner-approved-synthetic';
it.skipIf(!enabled)('real isolated booking API → PostgreSQL → quotation/payment/status/dashboard', async () => {
  let target: URL;
  try { target = new URL(process.env.PHASE2_BOOKING_DATABASE_URL || ''); } catch { throw new Error('PHASE2_WRONG_TARGET'); }
  if (target.hostname !== '127.0.0.1' || target.port !== '5432' || target.pathname !== '/flywithsafety_local_integration' ||
      target.username !== 'flywithsafe_phase2_booking_test' || !target.password || target.search) throw new Error('PHASE2_WRONG_TARGET');
  const ledger = process.env.PHASE2_BOOKING_LEDGER;
  if (!ledger) throw new Error('PHASE2_LEDGER_REQUIRED');
  Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: target.href, EMAIL_DELIVERY_ENABLED: 'false',
    FRONTEND_URL: 'http://localhost:3000', CORS_ORIGINS: 'http://localhost:3000',
    GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '', JWT_SECRET: randomBytes(32).toString('hex') });
  const { prisma } = await import('../src/lib/prisma.js');
  let stage = 'identity';
  let journal: ((data: object) => void) | undefined;
  let fixtureUsers: string[] = [];
  const settledResponses = async <T,>(requests: PromiseLike<T>[]) => {
    const results = await Promise.allSettled(requests);
    return results.map(result => { if (result.status === 'rejected') throw new Error('PHASE2_HTTP_GROUP_FAILED'); return result.value; });
  };
  try {
    const identity = await prisma.$queryRaw<{ db: string; role: string; host: string; port: number }[]>`SELECT current_database() AS db,current_user AS role,host(inet_server_addr()) AS host,inet_server_port() AS port`;
    expect(identity).toEqual([{ db: 'flywithsafety_local_integration', role: 'flywithsafe_phase2_booking_test', host: '127.0.0.1', port: 5432 }]);
    stage = 'access-and-empty-state';
    const access = await prisma.$queryRaw<{ denied: boolean }[]>`SELECT NOT has_table_privilege(current_user,'public."Booking"','DELETE') AND NOT has_schema_privilege(current_user,'public','CREATE') AS denied`;
    expect(access[0].denied).toBe(true);
    // Reuse the already-reviewed exact permission matrix under the actual runtime
    // identity, in a READ ONLY transaction. Never replay the provisioning SQL.
    const reviewedAccess = readFileSync(resolve(__dirname, '../../output/phase2/setup-review/role.sql'), 'utf8');
    const postcheck = [...reviewedAccess.matchAll(/DO \$guard\$[\s\S]*?END \$guard\$;/g)].at(-1)?.[0];
    if (!postcheck || !postcheck.includes('EXACT_COLUMN_MATRIX_FAILED') || /\b(?:GRANT|REVOKE|ALTER|CREATE ROLE)\b/.test(postcheck)) throw new Error('PHASE2_PERMISSION_CHECK_INTEGRITY');
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe(postcheck);
    });
    const migrationDirectory = resolve(__dirname, '../prisma/migrations');
    const expectedMigrations = readdirSync(migrationDirectory, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    expect(expectedMigrations).toHaveLength(7);
    const migrationRows = await prisma.$queryRaw<{ migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }[]>`SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY migration_name`;
    expect(migrationRows.map(row => row.migration_name)).toEqual(expectedMigrations);
    for (const row of migrationRows) {
      expect(row.finished_at).not.toBeNull(); expect(row.rolled_back_at).toBeNull();
      expect(row.checksum).toBe(createHash('sha256').update(readFileSync(resolve(migrationDirectory, row.migration_name, 'migration.sql'))).digest('hex'));
    }
    for (const model of [prisma.user, prisma.booking, prisma.session, prisma.notificationOutbox, prisma.idempotencyRecord]) {
      if (await (model.count as () => Promise<number>)() !== 0) throw new Error('PHASE2_NONEMPTY_TARGET_STOP');
    }
    const users = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const roles = ['CUSTOMER', 'CUSTOMER', 'STAFF', 'ADMIN'] as const;
    writeFileSync(ledger, JSON.stringify({ kind: 'planned-fixtures', users, syntheticOnly: true }) + '\n', { flag: 'wx' });
    journal = (data: object) => appendFileSync(ledger, JSON.stringify(data) + '\n');
    fixtureUsers = users;
    stage = 'synthetic-actors';
    const emails = users.map(id => `${id}@example.invalid`);
    const syntheticPassword = process.env.PHASE2_SYNTHETIC_PASSWORD || randomBytes(32).toString('base64url');
    const passwordHash = await bcrypt.hash(syntheticPassword, 12);
    for (let index = 0; index < users.length; index++) {
      await prisma.user.create({ data: { id: users[index], email: emails[index], name: 'Synthetic Phase2', emailVerified: true,
        role: roles[index], password: passwordHash } });
      journal({ kind: 'created-user', userId: users[index], email: emails[index], role: roles[index] });
    }
    const imported = await import('../src/app.js');
    const candidate: unknown = imported.default;
    const app = (typeof candidate === 'function' ? candidate : (candidate as { default: Express }).default) as Express;
    if (typeof app !== 'function') throw new Error('PHASE2_APPLICATION_IMPORT_FAILED');
    stage = 'actual-sign-in';
    const agents = users.map(() => request.agent(app));
    for (let index = 0; index < users.length; index++) {
      const login = await agents[index].post('/api/v1/auth/login').set('Origin', 'http://localhost:3000').send({ email: emails[index], password: syntheticPassword }).timeout({ response: 5000, deadline: 10000 });
      expect(login.status).toBe(200); expect(login.body.data.user.id).toBe(users[index]);
    }
    journal({ kind: 'actual-login-sessions', sessions: await prisma.session.findMany({ where: { userId: { in: users } }, select: { id: true, userId: true } }) });
    const api = (path: string, index = 0) => agents[index].post('/api/v1' + path).set('Origin', 'http://localhost:3000').timeout({ response: 5000, deadline: 10000 });
    const get = (path: string, index = 0) => agents[index].get('/api/v1' + path).timeout({ response: 5000, deadline: 10000 });
    const key = randomUUID(), payload = { customerName: 'Synthetic Booking Customer', customerEmail: emails[0], totalPrice: 0, currency: 'BDT', passengers: [{ firstName: 'Synthetic', lastName: 'Traveller' }] };
    stage = 'booking-replay';
    const created = await api('/bookings').set('Idempotency-Key', key).send(payload); expect(created.status).toBe(201);
    const booking = created.body.data.booking, reference = booking.referenceNumber;
    journal({ kind: 'created-booking', id: booking.id, reference, userId: users[0], requestId: key });
    const replays = await settledResponses(Array.from({ length: 4 }, () => api('/bookings').set('Idempotency-Key', key).send(payload)));
    expect(replays.map(r => [r.status, r.body.data.booking.id])).toEqual(Array.from({ length: 4 }, () => [201, booking.id]));
    expect((await api('/bookings').set('Idempotency-Key', key).send({ ...payload, totalPrice: 20 })).status).toBe(409);
    journal({ kind: 'booking-replay-pass', replayCount: replays.length });
    stage = 'quotation';
    const offer = { action: 'OFFER_QUOTE', requestId: randomUUID(), expectedRevision: 0, amount: 12000, currency: 'BDT', description: 'Synthetic assisted itinerary; no supplier reservation', validUntil: new Date(Date.now() + 600000).toISOString() };
    stage = 'quotation-customer-denial';
    const deniedOffer = await api(`/admin/bookings/${reference}/commercial`).send(offer);
    journal({ kind: 'http-checkpoint', stage, expectedStatus: 403, ...safeHttpOutcome(deniedOffer.status, deniedOffer.body) });
    expect(deniedOffer.status).toBe(403);
    stage = 'quotation-staff-offer';
    const offered = await api(`/admin/bookings/${reference}/commercial`, 2).send(offer);
    journal({ kind: 'http-checkpoint', stage, expectedStatus: 200, ...safeHttpOutcome(offered.status, offered.body) });
    expect(offered.status).toBe(200);
    const accept = { action: 'ACCEPT_QUOTE', requestId: randomUUID(), expectedRevision: 1, quoteId: offer.requestId };
    stage = 'quotation-admin-denial';
    const deniedAdmin = await api(`/account/bookings/${reference}/commercial`, 3).send(accept);
    journal({ kind: 'http-checkpoint', stage, expectedStatus: 403, ...safeHttpOutcome(deniedAdmin.status, deniedAdmin.body) });
    expect(deniedAdmin.status).toBe(403);
    stage = 'quotation-ownership-denial';
    const deniedOwner = await api(`/account/bookings/${reference}/commercial`, 1).send(accept);
    journal({ kind: 'http-checkpoint', stage, expectedStatus: 404, ...safeHttpOutcome(deniedOwner.status, deniedOwner.body) });
    expect(deniedOwner.status).toBe(404);
    stage = 'quotation-concurrent-acceptance';
    const accepted = await settledResponses(Array.from({ length: 8 }, () => api(`/account/bookings/${reference}/commercial`).send(accept)));
    journal({ kind: 'http-checkpoint-group', stage, expectedStatus: 200, outcomes: accepted.map(response => safeHttpOutcome(response.status, response.body)) });
    expect(accepted.map(r => r.status)).toEqual(Array(8).fill(200));
    journal({ kind: 'quotation-concurrency-pass', acceptedResponses: accepted.length });
    stage = 'payment-record';
    const payment = { action: 'RECORD_PAYMENT', requestId: randomUUID(), expectedRevision: 2, quoteId: offer.requestId, reference: 'SYN-PAY-001', amount: 12000, currency: 'BDT', method: 'BANK_TRANSFER' };
    const recorded = await settledResponses(Array.from({ length: 4 }, () => api(`/admin/bookings/${reference}/commercial`, 2).send(payment)));
    expect(recorded.map(r => r.status)).toEqual(Array(4).fill(200));
    expect((await api(`/admin/bookings/${reference}/commercial`, 2).send({ ...payment, amount: 10 })).status).toBe(409);
    expect((await api(`/admin/bookings/${reference}/commercial`, 2).send({ ...payment, requestId: randomUUID(), expectedRevision: 3 })).status).toBe(409);
    journal({ kind: 'payment-replay-pass', replayCount: recorded.length });
    stage = 'status-history';
    for (const [expectedStatus, status] of [['PENDING', 'CONFIRMED'], ['CONFIRMED', 'COMPLETED']]) {
      const result = await agents[2].patch(`/api/v1/admin/bookings/${booking.id}/status`).set('Origin', 'http://localhost:3000').send({ status, expectedStatus, reason: 'Synthetic workflow verification' }).timeout({ response: 5000, deadline: 10000 });
      expect(result.status).toBe(200);
    }
    const customer = await get(`/account/bookings/${reference}`); expect(customer.status).toBe(200);
    expect(customer.body.data.booking.commercial).toMatchObject({ revision: 3, payments: [{ status: 'RECORDED_UNVERIFIED' }] });
    expect(customer.body.data.booking.commercial.receipts).toBeUndefined(); expect(customer.body.data.booking.statusHistory).toHaveLength(4);
    expect(customer.body.data.booking.statusHistory.filter((row: {reason?: string}) => row.reason === 'Quotation accepted; awaiting staff processing')).toHaveLength(1);
    expect(customer.body.data.booking.bookingDetails.paymentStatus).not.toBe('PAYMENT_VERIFIED');
    stage = 'dashboards-and-ownership';
    expect((await get(`/account/bookings/${reference}`, 1)).status).toBe(404);
    expect((await get('/account/dashboard')).status).toBe(200);
    expect((await get('/admin/bookings', 2)).status).toBe(200);
    expect((await get('/admin/bookings', 3)).status).toBe(200);
    expect((await get('/admin/bookings')).status).toBe(403);
    expect((await request(app).get('/api/v1/admin/bookings').timeout({ response: 5000, deadline: 10000 })).status).toBe(401);
    stage = 'persisted-state';
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { passengers: true, statusHistory: true } });
    expect(stored.totalPrice).toBe(12000); expect(stored.statusHistory).toHaveLength(4);
    const { readCommercial } = await import('../src/services/booking-commercial.service.js');
    const commercial = readCommercial(stored.bookingDetails); expect(commercial.payments).toHaveLength(1); expect(commercial.receipts).toHaveLength(3);
    journal({ kind: 'persisted-proof-pass', bookingId: booking.id, passengerIds: stored.passengers.map(p => p.id), historyIds: stored.statusHistory.map(h => h.id), revision: commercial.revision });
    stage = 'foreign-key-rollback';
    const rejectedHistoryId = randomUUID();
    journal({ kind: 'rollback-only-history', id: rejectedHistoryId });
    await expect(prisma.$transaction(async tx => {
      await tx.booking.update({ where: { id: booking.id }, data: { totalPrice: 12001 } });
      await tx.bookingStatusHistory.create({ data: { id: rejectedHistoryId, bookingId: randomUUID(), fromStatus: 'PENDING', toStatus: 'CONFIRMED' } });
    })).rejects.toMatchObject({ code: 'P2003' });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).totalPrice).toBe(12000);
    expect(await prisma.bookingStatusHistory.count({ where: { id: rejectedHistoryId } })).toBe(0);
    journal({ kind: 'actual-fk-rollback-pass', rejectedHistoryAbsent: true });
    stage = 'new-authorized-session';
    const renewed = request.agent(app);
    expect((await renewed.post('/api/v1/auth/login').set('Origin', 'http://localhost:3000').send({ email: emails[0], password: syntheticPassword }).timeout({ response: 5000, deadline: 10000 })).status).toBe(200);
    const refreshed = await renewed.get(`/api/v1/account/bookings/${reference}`).timeout({ response: 5000, deadline: 10000 });
    expect(refreshed.status).toBe(200); expect(refreshed.body.data.booking.commercial.revision).toBe(3);
    journal({ kind: 'new-authorized-session-pass', sessions: await prisma.session.findMany({ where: { userId: { in: users } }, select: { id: true, userId: true } }) });
    // No DELETE privilege or broad cleanup. Exact retained ledger needs a separate reviewed cleanup.
  } catch (error) {
    const diagnostic = safeFailure(error);
    journal?.({ kind: 'proof-stopped', stage, diagnostic });
    throw new Error('PHASE2_PG_PROOF_STOP_' + stage + ' ' + JSON.stringify(diagnostic));
  } finally {
    if (journal && fixtureUsers.length) {
      try {
        journal({ kind: 'actual-retained-record-ids',
          users: await prisma.user.findMany({ where: { id: { in: fixtureUsers } }, select: { id: true } }),
          sessions: await prisma.session.findMany({ where: { userId: { in: fixtureUsers } }, select: { id: true, userId: true } }),
          bookings: await prisma.booking.findMany({ where: { userId: { in: fixtureUsers } }, select: { id: true, referenceNumber: true } }),
          passengers: await prisma.bookingPassenger.findMany({ where: { booking: { userId: { in: fixtureUsers } } }, select: { id: true, bookingId: true } }),
          history: await prisma.bookingStatusHistory.findMany({ where: { booking: { userId: { in: fixtureUsers } } }, select: { id: true, bookingId: true } }),
          idempotency: await prisma.idempotencyRecord.findMany({ where: { userId: { in: fixtureUsers } }, select: { id: true, referenceNumber: true } }),
          notifications: await prisma.notificationOutbox.findMany({ where: { recipient: { in: fixtureUsers.map(id => `${id}@example.invalid`) } }, select: { id: true } }),
        });
      } catch { journal({ kind: 'retained-record-snapshot-unavailable', reviewRequired: true }); }
    }
    try { await prisma.$disconnect(); } catch { throw new Error('PHASE2_PG_POOL_CLOSE_FAILED'); }
  }
}, 60000);
