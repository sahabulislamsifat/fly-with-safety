import { expect, it, vi } from 'vitest';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { writeFileSync, appendFileSync } from 'node:fs';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';

// This dedicated integration file never discovers .env or a default database.
vi.mock('dotenv', () => ({ default: { config: () => ({ parsed: {} }) }, config: () => ({ parsed: {} }) }));
const enabled = process.env.PHASE2_BOOKING_MODE === 'owner-approved-synthetic';
it.skipIf(!enabled)('real isolated booking API → PostgreSQL → quotation/payment/status/dashboard', async () => {
  const target = new URL(process.env.PHASE2_BOOKING_DATABASE_URL || '');
  if (target.hostname !== '127.0.0.1' || target.port !== '5432' || target.pathname !== '/flywithsafe_phase2_booking_integration' ||
      target.username !== 'flywithsafe_phase2_booking_test' || !target.password || target.search) throw new Error('PHASE2_WRONG_TARGET');
  const ledger = process.env.PHASE2_BOOKING_LEDGER;
  if (!ledger) throw new Error('PHASE2_LEDGER_REQUIRED');
  Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: target.href, EMAIL_DELIVERY_ENABLED: 'false',
    FRONTEND_URL: 'http://localhost:3000', CORS_ORIGINS: 'http://localhost:3000',
    GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '', JWT_SECRET: randomBytes(32).toString('hex') });
  const { prisma } = await import('../src/lib/prisma.js');
  let stage = 'identity';
  let journal: ((data: object) => void) | undefined;
  try {
    const identity = await prisma.$queryRaw<{ db: string; role: string; host: string; port: number }[]>`SELECT current_database() AS db,current_user AS role,host(inet_server_addr()) AS host,inet_server_port() AS port`;
    expect(identity).toEqual([{ db: 'flywithsafe_phase2_booking_integration', role: 'flywithsafe_phase2_booking_test', host: '127.0.0.1', port: 5432 }]);
    stage = 'access-and-empty-state';
    const access = await prisma.$queryRaw<{ denied: boolean }[]>`SELECT NOT has_table_privilege(current_user,'public."Booking"','DELETE') AND NOT has_schema_privilege(current_user,'public','CREATE') AS denied`;
    expect(access[0].denied).toBe(true);
    for (const model of [prisma.user, prisma.booking, prisma.session, prisma.notificationOutbox, prisma.idempotencyRecord]) {
      if (await (model.count as () => Promise<number>)() !== 0) throw new Error('PHASE2_NONEMPTY_TARGET_STOP');
    }
    const users = [randomUUID(), randomUUID(), randomUUID()], sessions = users.map(() => randomUUID());
    writeFileSync(ledger, JSON.stringify({ kind: 'planned-fixtures', users, sessions, syntheticOnly: true }) + '\n', { flag: 'wx' });
    journal = (data: object) => appendFileSync(ledger, JSON.stringify(data) + '\n');
    stage = 'synthetic-actors';
    const emails = users.map(id => `${id}@example.invalid`);
    for (let index = 0; index < users.length; index++) {
      await prisma.user.create({ data: { id: users[index], email: emails[index], name: 'Synthetic Phase2', emailVerified: true,
        role: index === 2 ? 'STAFF' : 'CUSTOMER', sessions: { create: { id: sessions[index], refreshTokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'), expiresAt: new Date(Date.now() + 600000) } } } });
      journal({ kind: 'created-user-session', userId: users[index], sessionId: sessions[index] });
    }
    const tokens = users.map((id, index) => jwt.sign({ sub: id, email: emails[index], role: index === 2 ? 'STAFF' : 'CUSTOMER', sid: sessions[index] }, process.env.JWT_SECRET!, { expiresIn: 600 }));
    const imported = await import('../src/app.js');
    const candidate: unknown = imported.default;
    const app = (typeof candidate === 'function' ? candidate : (candidate as { default: Express }).default) as Express;
    if (typeof app !== 'function') throw new Error('PHASE2_APPLICATION_IMPORT_FAILED');
    const api = (path: string, index = 0) => request(app).post('/api/v1' + path).set('Authorization', `Bearer ${tokens[index]}`).set('Origin', 'http://localhost:3000');
    const get = (path: string, index = 0) => request(app).get('/api/v1' + path).set('Authorization', `Bearer ${tokens[index]}`);
    const key = randomUUID(), payload = { customerName: 'Synthetic Booking Customer', customerEmail: emails[0], totalPrice: 0, currency: 'BDT', passengers: [{ firstName: 'Synthetic', lastName: 'Traveller' }] };
    stage = 'booking-replay';
    const created = await api('/bookings').set('Idempotency-Key', key).send(payload); expect(created.status).toBe(201);
    const booking = created.body.data.booking, reference = booking.referenceNumber;
    journal({ kind: 'created-booking', id: booking.id, reference, userId: users[0], requestId: key });
    const replays = await Promise.all(Array.from({ length: 4 }, () => api('/bookings').set('Idempotency-Key', key).send(payload)));
    expect(replays.map(r => [r.status, r.body.data.booking.id])).toEqual(Array.from({ length: 4 }, () => [201, booking.id]));
    expect((await api('/bookings').set('Idempotency-Key', key).send({ ...payload, totalPrice: 20 })).status).toBe(409);
    journal({ kind: 'booking-replay-pass', replayCount: replays.length });
    stage = 'quotation';
    const offer = { action: 'OFFER_QUOTE', requestId: randomUUID(), expectedRevision: 0, amount: 12000, currency: 'BDT', validUntil: new Date(Date.now() + 600000).toISOString() };
    expect((await api(`/admin/bookings/${reference}/commercial`).send(offer)).status).toBe(403);
    expect((await api(`/admin/bookings/${reference}/commercial`, 2).send(offer)).status).toBe(200);
    const accept = { action: 'ACCEPT_QUOTE', requestId: randomUUID(), expectedRevision: 1, quoteId: offer.requestId };
    expect((await api(`/account/bookings/${reference}/commercial`, 1).send(accept)).status).toBe(404);
    const accepted = await Promise.all(Array.from({ length: 8 }, () => api(`/account/bookings/${reference}/commercial`).send(accept)));
    expect(accepted.map(r => r.status)).toEqual(Array(8).fill(200));
    journal({ kind: 'quotation-concurrency-pass', acceptedResponses: accepted.length });
    stage = 'payment-record';
    const payment = { action: 'RECORD_PAYMENT', requestId: randomUUID(), expectedRevision: 2, amount: 12000, currency: 'BDT', method: 'BANK_TRANSFER' };
    const recorded = await Promise.all(Array.from({ length: 4 }, () => api(`/admin/bookings/${reference}/commercial`, 2).send(payment)));
    expect(recorded.map(r => r.status)).toEqual(Array(4).fill(200));
    expect((await api(`/admin/bookings/${reference}/commercial`, 2).send({ ...payment, amount: 10 })).status).toBe(409);
    journal({ kind: 'payment-replay-pass', replayCount: recorded.length });
    stage = 'status-history';
    for (const status of ['CONFIRMED', 'COMPLETED']) {
      const result = await request(app).patch(`/api/v1/admin/bookings/${booking.id}/status`).set('Authorization', `Bearer ${tokens[2]}`).set('Origin', 'http://localhost:3000').send({ status, reason: 'Synthetic workflow verification' });
      expect(result.status).toBe(200);
    }
    const customer = await get(`/account/bookings/${reference}`); expect(customer.status).toBe(200);
    expect(customer.body.data.booking.commercial).toMatchObject({ revision: 3, payments: [{ status: 'RECORDED_UNVERIFIED' }] });
    expect(customer.body.data.booking.commercial.receipts).toBeUndefined(); expect(customer.body.data.booking.statusHistory).toHaveLength(3);
    expect(customer.body.data.booking.bookingDetails.paymentStatus).not.toBe('PAYMENT_VERIFIED');
    stage = 'dashboards-and-ownership';
    expect((await get(`/account/bookings/${reference}`, 1)).status).toBe(404);
    expect((await get('/account/dashboard')).status).toBe(200);
    expect((await get('/admin/bookings', 2)).status).toBe(200);
    stage = 'persisted-state';
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { passengers: true, statusHistory: true } });
    expect(stored.totalPrice).toBe(12000); expect(stored.statusHistory).toHaveLength(3);
    const { readCommercial } = await import('../src/services/booking-commercial.service.js');
    const commercial = readCommercial(stored.bookingDetails); expect(commercial.payments).toHaveLength(1); expect(commercial.receipts).toHaveLength(3);
    journal({ kind: 'persisted-proof-pass', bookingId: booking.id, passengerIds: stored.passengers.map(p => p.id), historyIds: stored.statusHistory.map(h => h.id), revision: commercial.revision });
    // No DELETE privilege or broad cleanup. Exact retained ledger needs a separate reviewed cleanup.
  } catch {
    journal?.({ kind: 'proof-stopped', stage });
    throw new Error('PHASE2_PG_PROOF_STOP_' + stage);
  } finally {
    try { await prisma.$disconnect(); } catch { throw new Error('PHASE2_PG_POOL_CLOSE_FAILED'); }
  }
}, 60000);
