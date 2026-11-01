import { expect, it, vi } from 'vitest';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as pause } from 'node:timers/promises';
import request from 'supertest';
import type { Express } from 'express';
import { EXPECTED_IDENTITY, readOnlyTarget, safeFailure, safeHttpOutcome } from './phase2-identity-diagnostic.js';
import { assertDispatchBudget, retainedContract, traceActualService, trackActualTask } from './phase2-continuation-contract.js';
vi.mock('dotenv', () => ({ default: { config: () => ({ parsed: {} }) }, config: () => ({ parsed: {} }) }));

it.skipIf(process.env.PHASE2_CONTINUATION_MODE !== 'owner-approved-retained-fixtures')('retained booking → quotation expiry/revision/acceptance → payment/status/history', async () => {
  const rawUrl = process.env.PHASE2_BOOKING_DATABASE_URL || '';
  readOnlyTarget(rawUrl); // Reuse strict target validation; no readonly option is added to the business connection.
  const base = process.env.PHASE2_CONTINUATION_ARTIFACT_DIR;
  const password = process.env.PHASE2_SYNTHETIC_PASSWORD;
  if (!base || !password || password.length < 16) throw new Error('PHASE2_CONTINUATION_PRIVATE_INPUT_REQUIRED');
  const c = retainedContract(JSON.parse(readFileSync(resolve(base, 'retained-contract.json'), 'utf8')));
  const ledgerPath = resolve(base, 'fixture-ledger.jsonl');
  writeFileSync(ledgerPath, JSON.stringify({ kind: 'planned-reuse', booking: c.booking, actors: c.actors, createsUsersOrBookings: false }) + '\n', { flag: 'wx' });
  const journal = (data: object) => appendFileSync(ledgerPath, JSON.stringify(data) + '\n');
  Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: rawUrl, EMAIL_DELIVERY_ENABLED: 'false',
    FRONTEND_URL: 'http://localhost:3000', CORS_ORIGINS: 'http://localhost:3000', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '',
    SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '', JWT_SECRET: randomBytes(32).toString('hex') });
  const { prisma } = await import('../src/lib/prisma.js');
  const commercial = await import('../src/services/booking-commercial.service.js');
  const started = performance.now();
  const dispatchBudget = () => assertDispatchBudget(performance.now() - started);
  let stage = 'retained-readonly-preflight';
  let serviceSpy: { mockRestore(): void } | undefined;
  let notificationSpy: { mockRestore(): void } | undefined;
  const pendingNotifications = new Set<Promise<unknown>>();
  const notificationFailures: ReturnType<typeof safeFailure>[] = [];
  let failed: ReturnType<typeof safeFailure> | null = null;
  let snapshotFailure: ReturnType<typeof safeFailure> | null = null;
  let disconnectFailure: ReturnType<typeof safeFailure> | null = null;
  const totals = async () => (await prisma.$queryRaw<{ users: number; sessions: number; bookings: number; passengers: number; history: number; idempotency: number; notifications: number }[]>`
    SELECT (SELECT count(*)::int FROM public."User") AS users,(SELECT count(*)::int FROM public."Session") AS sessions,
    (SELECT count(*)::int FROM public."Booking") AS bookings,(SELECT count(*)::int FROM public."BookingPassenger") AS passengers,
    (SELECT count(*)::int FROM public."BookingStatusHistory") AS history,(SELECT count(*)::int FROM public."IdempotencyRecord") AS idempotency,
    (SELECT count(*)::int FROM public."NotificationOutbox") AS notifications`)[0];
  const clock = async () => { dispatchBudget(); return (await prisma.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`)[0].now; };
  const stored = () => prisma.booking.findUniqueOrThrow({ where: { id: c.booking.id }, include: { passengers: true, statusHistory: true } });
  const sort = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      expect(await tx.$queryRaw`SELECT current_database() AS db,current_user AS role,host(inet_server_addr()) AS host,inet_server_port() AS port`).toEqual([EXPECTED_IDENTITY]);
      const access = readFileSync(resolve(__dirname, '../../output/phase2/setup-review/role.sql'), 'utf8');
      const postcheck = [...access.matchAll(/DO \$guard\$[\s\S]*?END \$guard\$;/g)].at(-1)?.[0];
      if (!postcheck || !postcheck.includes('EXACT_COLUMN_MATRIX_FAILED') || /\b(?:GRANT|REVOKE|ALTER|CREATE ROLE)\b/.test(postcheck)) throw new Error('PHASE2_PERMISSION_CHECK_INTEGRITY');
      await tx.$executeRawUnsafe(postcheck);
    });
    expect((await prisma.$queryRaw<{ timezone: string }[]>`SELECT current_setting('TimeZone') AS timezone`)[0].timezone).toBe('Asia/Dhaka');
    const migrationDir = resolve(__dirname, '../prisma/migrations');
    const migrationRows = await prisma.$queryRaw<{ migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }[]>`SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY migration_name`;
    expect(migrationRows.map(row => row.migration_name)).toEqual(readdirSync(migrationDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort());
    expect(migrationRows).toHaveLength(7);
    for (const row of migrationRows) {
      expect(row.finished_at).not.toBeNull(); expect(row.rolled_back_at).toBeNull();
      expect(row.checksum).toBe(createHash('sha256').update(readFileSync(resolve(migrationDir, row.migration_name, 'migration.sql'))).digest('hex'));
    }
    expect(await totals()).toEqual({ users: 4, sessions: 4, bookings: 1, passengers: 1, history: 1, idempotency: 1, notifications: 1 });
    expect(sort(await prisma.user.findMany({ select: { id: true, email: true, role: true, emailVerified: true } }))).toEqual(sort(c.actors.map(a => ({ ...a, emailVerified: true }))));
    expect(sort(await prisma.session.findMany({ select: { id: true, userId: true } }))).toEqual(sort(c.sessions));
    const initial = await stored();
    expect(initial).toMatchObject({ id: c.booking.id, referenceNumber: c.booking.reference, userId: c.booking.userId, status: 'PENDING', totalPrice: 0, currency: 'BDT' });
    expect(initial.passengers).toHaveLength(1); expect(initial.passengers[0]).toMatchObject({ ...c.passenger, firstName: 'Synthetic', lastName: 'Traveller', passengerType: 'adult' });
    expect(initial.statusHistory.map(row => ({ id: row.id, bookingId: row.bookingId }))).toEqual([c.history]);
    expect(initial.bookingDetails && typeof initial.bookingDetails === 'object' && !Array.isArray(initial.bookingDetails) ? initial.bookingDetails.commercial : undefined).toBeUndefined();
    expect(await prisma.idempotencyRecord.findMany({ select: { id: true, referenceNumber: true, userId: true } })).toEqual([{ ...c.idempotency, userId: c.booking.userId }]);
    expect(await prisma.notificationOutbox.findMany({ select: { id: true, recipient: true } })).toEqual([{ ...c.notification, recipient: c.actors[0].email }]);
    journal({ kind: 'retained-preflight-pass', counts: await totals(), bookingId: c.booking.id });

    const actualService = commercial.changeBookingCommercial;
    serviceSpy = vi.spyOn(commercial, 'changeBookingCommercial').mockImplementation(traceActualService(actualService,
      diagnostic => journal({ kind: 'actual-service-error', stage, diagnostic })));
    const notifications = await import('../src/services/notification.service.js');
    const actualNotification = notifications.sendBookingStatusNotification;
    notificationSpy = vi.spyOn(notifications, 'sendBookingStatusNotification').mockImplementation(
      trackActualTask(actualNotification, pendingNotifications, notificationFailures));
    const imported = await import('../src/app.js');
    const candidate: unknown = imported.default;
    const app = (typeof candidate === 'function' ? candidate : (candidate as { default: Express }).default) as Express;
    if (typeof app !== 'function') throw new Error('PHASE2_APPLICATION_IMPORT_FAILED');
    const agents = c.actors.map(() => request.agent(app));
    const check = async (id: string, operation: PromiseLike<request.Response>, status: number) => {
      stage = id;
      dispatchBudget();
      const requestStarted = performance.now();
      const response = await operation;
      journal({ kind: 'http-checkpoint', stage, elapsedMs: Math.round(performance.now() - requestStarted), expectedStatus: status, ...safeHttpOutcome(response.status, response.body) });
      expect(response.status).toBe(status); return response;
    };
    for (let i = 0; i < agents.length; i++) {
      const response = await check('existing-actor-sign-in-' + i, agents[i].post('/api/v1/auth/login').set('Origin', 'http://localhost:3000')
        .send({ email: c.actors[i].email, password }).timeout({ response: 5000, deadline: 10000 }), 200);
      expect(response.body.data.user.id).toBe(c.actors[i].id);
    }
    const post = (body: object, actor = 2, account = false) => agents[actor].post(`/api/v1/${account ? 'account' : 'admin'}/bookings/${c.booking.reference}/commercial`)
      .set('Origin', 'http://localhost:3000').send(body).timeout({ response: 5000, deadline: 10000 });
    const get = (path: string, actor = 0) => agents[actor].get('/api/v1' + path).timeout({ response: 5000, deadline: 10000 });
    const group = async (id: string, operations: PromiseLike<request.Response>[], expected: number) => {
      stage = id;
      dispatchBudget();
      const settled = await Promise.allSettled(operations);
      journal({ kind: 'http-group', stage, outcomes: settled.map(item => item.status === 'fulfilled' ? safeHttpOutcome(item.value.status, item.value.body) : { rejected: true, diagnostic: safeFailure(item.reason) }) });
      const responses = settled.map(item => { if (item.status === 'rejected') throw item.reason; return item.value; });
      expect(responses.map(r => r.status)).toEqual(Array(operations.length).fill(expected)); return responses;
    };
    const deadline = (now: Date, ms: number) => new Date(+now + ms).toISOString();
    const offer = (revision: number, validUntil: string, amount = 12000) => ({ action: 'OFFER_QUOTE', requestId: randomUUID(), expectedRevision: revision, amount, currency: 'BDT', validUntil, description: 'Synthetic assisted itinerary; no reservation' });
    const accept = (revision: number, quoteId: string) => ({ action: 'ACCEPT_QUOTE', requestId: randomUUID(), expectedRevision: revision, quoteId });
    const expired = offer(0, deadline(await clock(), -1000));
    await check('quote-past-expiry-denial', post(expired), 400);
    await check('quote-customer-issuance-denial', post(offer(0, deadline(await clock(), 600000)), 0), 403);
    // Start the short expiry only after unrelated authorization/preparation requests finish.
    const short = offer(0, deadline(await clock(), 3000), 11000);
    journal({ kind: 'planned-commercial-id', operation: 'expiring-quote', id: short.requestId, validUntil: short.validUntil });
    await check('quote-expiring-offer', post(short), 200);
    await check('quote-offer-replay', post(short), 200);
    await check('quote-conflicting-replay', post({ ...short, amount: 11001 }), 409);
    stage = 'quote-expiry-observation';
    const waitStart = performance.now(); let polls = 0; let observedExpired = false;
    do { polls++; observedExpired = +(await clock()) >= +new Date(short.validUntil); if (observedExpired) break; await pause(50); } while (performance.now() - waitStart < 4000);
    journal({ kind: 'expiry-observation', polls, elapsedMs: Math.round(performance.now() - waitStart), observedExpired });
    expect(observedExpired).toBe(true);
    await check('quote-expired-customer-acceptance', post(accept(1, short.requestId), 0, true), 409);
    const prior = offer(1, deadline(await clock(), 600000), 12500);
    await check('quote-valid-revision', post(prior), 200);
    const current = offer(2, deadline(await clock(), 600000));
    journal({ kind: 'planned-commercial-id', operation: 'revised-quote', id: current.requestId, supersededId: prior.requestId });
    await check('quote-stale-revision', post({ ...current, expectedRevision: 1 }), 409);
    await check('quote-currency-denial', post({ ...current, requestId: randomUUID(), currency: 'USD' }), 400);
    await check('quote-fractional-amount-denial', post({ ...current, requestId: randomUUID(), amount: 100.5 }), 422);
    await check('quote-zero-amount-denial', post({ ...current, requestId: randomUUID(), amount: 0 }), 422);
    await check('quote-current-revision', post(current), 200);
    await check('quote-superseded-acceptance', post(accept(3, prior.requestId), 0, true), 409);
    const acceptance = accept(3, current.requestId);
    journal({ kind: 'planned-commercial-id', operation: 'acceptance', id: acceptance.requestId });
    await check('quote-admin-acceptance-denial', post(acceptance, 3, true), 403);
    await check('quote-foreign-owner-denial', post(acceptance, 1, true), 404);
    await group('quote-eight-concurrent-acceptance', Array.from({ length: 8 }, () => post(acceptance, 0, true)), 200);
    stage = 'quote-atomic-persisted-acceptance';
    const accepted = await stored();
    expect(accepted.totalPrice).toBe(12000); expect(accepted.statusHistory).toHaveLength(2);
    expect(accepted.statusHistory.filter(h => h.reason === 'Quotation accepted; awaiting staff processing')).toHaveLength(1);
    expect(commercial.readCommercial(accepted.bookingDetails)).toMatchObject({ revision: 4, quotes: [{ acceptedAt: null }, { acceptedAt: null }, { id: current.requestId, acceptedAt: expect.any(String) }] });

    const payment = { action: 'RECORD_PAYMENT', requestId: randomUUID(), expectedRevision: 4, quoteId: current.requestId, reference: 'SYN-CONT-PAY-001', amount: 12000, currency: 'BDT', method: 'BANK_TRANSFER' };
    journal({ kind: 'planned-commercial-id', operation: 'unverified-payment', id: payment.requestId });
    await check('payment-customer-denial', post(payment, 0), 403);
    await check('payment-wrong-quote-denial', post({ ...payment, quoteId: prior.requestId }), 409);
    await check('payment-currency-denial', post({ ...payment, currency: 'USD' }), 400);
    await check('payment-overamount-denial', post({ ...payment, amount: 12001 }), 400);
    await check('payment-reference-required', post({ ...payment, reference: undefined }), 400);
    await check('payment-forged-verification-denial', post({ ...payment, verified: true }), 422);
    await group('payment-four-concurrent-replays', Array.from({ length: 4 }, () => post(payment)), 200);
    await check('payment-conflicting-payload-denial', post({ ...payment, amount: 1 }), 409);
    await check('payment-duplicate-reference-denial', post({ ...payment, requestId: randomUUID(), expectedRevision: 5 }), 409);
    await check('quote-acceptance-replay-after-payment', post(acceptance, 0, true), 200);
    const status = (value: string, expectedStatus: string, actor = 2) => agents[actor].patch(`/api/v1/admin/bookings/${c.booking.id}/status`).set('Origin', 'http://localhost:3000')
      .send({ status: value, expectedStatus, reason: 'Synthetic continuation verification' }).timeout({ response: 5000, deadline: 10000 });
    await check('status-customer-denial', status('CONFIRMED', 'PENDING', 0), 403);
    await check('status-invalid-pending-completion', status('COMPLETED', 'PENDING'), 400);
    await group('status-eight-concurrent-confirmation', Array.from({ length: 8 }, () => status('CONFIRMED', 'PENDING')), 200);
    await check('status-stale-version-denial', status('CANCELLED', 'PENDING'), 409);
    await check('status-completion', status('COMPLETED', 'CONFIRMED'), 200);
    await check('status-completion-replay', status('COMPLETED', 'CONFIRMED'), 200);
    await check('status-terminal-transition-denial', status('CONFIRMED', 'COMPLETED'), 400);

    stage = 'foreign-key-rollback';
    dispatchBudget();
    const rejectedId = randomUUID(), foreignId = randomUUID();
    journal({ kind: 'rollback-only-history', id: rejectedId, absentBookingId: foreignId });
    expect(await prisma.booking.count({ where: { id: foreignId } })).toBe(0);
    const beforeRollback = await stored();
    await expect(prisma.$transaction(async tx => {
      await tx.booking.update({ where: { id: c.booking.id }, data: { totalPrice: 12001 } });
      await tx.bookingStatusHistory.create({ data: { id: rejectedId, bookingId: foreignId, fromStatus: 'PENDING', toStatus: 'CONFIRMED' } });
    })).rejects.toMatchObject({ code: 'P2003' });
    const afterRollback = await stored();
    expect(afterRollback.totalPrice).toBe(12000); expect(afterRollback.updatedAt).toEqual(beforeRollback.updatedAt);
    expect(afterRollback.bookingDetails).toEqual(beforeRollback.bookingDetails);
    expect(await prisma.bookingStatusHistory.count({ where: { id: rejectedId } })).toBe(0);
    journal({ kind: 'rollback-proof-pass', rejectedIdAbsent: true });
    const customer = await check('customer-persisted-detail', get(`/account/bookings/${c.booking.reference}`), 200);
    expect(customer.body.data.booking.passengers).toHaveLength(1);
    expect(customer.body.data.booking.status).toBe('COMPLETED');
    expect(customer.body.data.booking.commercial).toMatchObject({ revision: 5, quotes: expect.any(Array), payments: [{ quoteId: current.requestId, status: 'RECORDED_UNVERIFIED' }] });
    expect(customer.body.data.booking.commercial.receipts).toBeUndefined(); expect(customer.body.data.booking.statusHistory).toHaveLength(4);
    expect(customer.body.data.booking.statusHistory.every((h: Record<string, unknown>) => h.changedBy === undefined && h.reason !== 'Synthetic continuation verification')).toBe(true);
    expect(customer.body.data.booking.bookingDetails.paymentStatus).not.toBe('PAYMENT_VERIFIED');
    await check('customer-foreign-booking-denial', get(`/account/bookings/${c.booking.reference}`, 1), 404);
    const foreignList = await check('customer-foreign-booking-list', get('/account/bookings', 1), 200);
    expect(foreignList.body.data.bookings).toHaveLength(0);
    const dashboard = await check('customer-dashboard', get('/account/dashboard'), 200);
    expect(dashboard.body.data.counts.bookings).toBe(1);
    const ownList = await check('customer-owned-booking-list', get('/account/bookings'), 200);
    expect(ownList.body.data.bookings).toHaveLength(1);
    expect(ownList.body.data.bookings[0]).toMatchObject({ referenceNumber: c.booking.reference, status: 'COMPLETED', totalPrice: 12000, commercial: { revision: 5 } });
    const staffList = await check('staff-booking-list', get('/admin/bookings', 2), 200);
    const adminList = await check('admin-booking-list', get('/admin/bookings', 3), 200);
    for (const list of [staffList, adminList]) {
      expect(list.body.data.bookings).toHaveLength(1);
      expect(list.body.data.bookings[0]).toMatchObject({ id: c.booking.id, referenceNumber: c.booking.reference, status: 'COMPLETED', totalPrice: 12000, commercial: { revision: 5 } });
    }
    await check('customer-admin-route-denial', get('/admin/bookings'), 403);
    await check('anonymous-admin-route-denial', request(app).get('/api/v1/admin/bookings').timeout({ response: 5000, deadline: 10000 }), 401);
    const renewed = request.agent(app);
    await check('fresh-customer-sign-in', renewed.post('/api/v1/auth/login').set('Origin', 'http://localhost:3000').send({ email: c.actors[0].email, password }).timeout({ response: 5000, deadline: 10000 }), 200);
    const fresh = await check('fresh-session-persisted-retrieval', renewed.get(`/api/v1/account/bookings/${c.booking.reference}`).timeout({ response: 5000, deadline: 10000 }), 200);
    expect(fresh.body.data.booking.commercial.revision).toBe(5);
    stage = 'persisted-final-invariants';
    const final = await stored(); const state = commercial.readCommercial(final.bookingDetails);
    expect(final.statusHistory).toHaveLength(4); expect(final.totalPrice).toBe(12000);
    expect(state.quotes).toHaveLength(3); expect(state.payments).toHaveLength(1); expect(state.receipts).toHaveLength(5);
    expect(final.statusHistory.filter(h => h.reason === 'Quotation accepted; awaiting staff processing')[0].changedBy).toBe(c.actors[0].id);
    expect(final.statusHistory.filter(h => h.fromStatus !== h.toStatus).every(h => h.changedBy === c.actors[2].id)).toBe(true);
    const outboxStart = performance.now();
    while ((await prisma.notificationOutbox.count()) < 3 && performance.now() - outboxStart < 5000) await pause(50);
    expect(await totals()).toEqual({ users: 4, sessions: 9, bookings: 1, passengers: 1, history: 4, idempotency: 1, notifications: 3 });
    journal({ kind: 'commercial-continuation-pass', bookingId: c.booking.id, revision: 5, quotes: 3, unverifiedPayments: 1, acceptanceConcurrency: 8, statusConcurrency: 8, finalCounts: await totals() });
    stage = 'complete';
  } catch (error) { failed = safeFailure(error); journal({ kind: 'continuation-stopped', stage, diagnostic: failed }); }
  finally {
    // Join only tasks already admitted by real status transitions; never dispatch new work on failure.
    await Promise.allSettled([...pendingNotifications]);
    if (notificationFailures.length) { journal({ kind: 'status-notification-errors', diagnostics: notificationFailures }); failed ??= notificationFailures[0]; }
    try {
      const ids = c.actors.map(a => a.id);
      const final = await stored();
      let commercialSnapshot: { commercialRevision: number; quoteIds: string[]; paymentIds: string[]; receiptIds: string[] } | undefined;
      try {
        const state = commercial.readCommercial(final.bookingDetails);
        commercialSnapshot = { commercialRevision: state.revision, quoteIds: state.quotes.map(q => q.id), paymentIds: state.payments.map(p => p.id), receiptIds: state.receipts.map(r => r.id) };
      } catch (error) { snapshotFailure = safeFailure(error); }
      journal({ kind: 'actual-retained-record-ids', counts: await totals(),
        users: await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true } }),
        sessions: await prisma.session.findMany({ where: { userId: { in: ids } }, select: { id: true, userId: true } }),
        bookings: [{ id: final.id, referenceNumber: final.referenceNumber, userId: final.userId, status: final.status, totalPrice: final.totalPrice, currency: final.currency,
          ...commercialSnapshot, commercialSnapshotUnavailable: !commercialSnapshot }],
        passengers: final.passengers.map(p => ({ id: p.id, bookingId: p.bookingId })), history: final.statusHistory.map(h => ({ id: h.id, bookingId: h.bookingId })),
        idempotency: await prisma.idempotencyRecord.findMany({ where: { userId: { in: ids } }, select: { id: true, referenceNumber: true } }),
        notifications: await prisma.notificationOutbox.findMany({ where: { recipient: { in: c.actors.map(a => a.email) } }, select: { id: true } }) });
    } catch (error) { snapshotFailure = safeFailure(error); journal({ kind: 'retained-snapshot-failed', diagnostic: snapshotFailure }); }
    serviceSpy?.mockRestore();
    notificationSpy?.mockRestore();
    try { await prisma.$disconnect(); } catch (error) { disconnectFailure = safeFailure(error); }
    const result = { passed: !failed && !snapshotFailure && !disconnectFailure && stage === 'complete', stage, failure: failed, snapshotFailure, disconnectFailure,
      elapsedMs: Math.round(performance.now() - started), fixturesRetained: true, createdUsersOrBookings: false };
    writeFileSync(resolve(base, 'diagnostic.json'), JSON.stringify(result), { flag: 'wx' });
    if (!result.passed) throw new Error('PHASE2_CONTINUATION_STOP ' + JSON.stringify(result));
  }
}, 60000);
