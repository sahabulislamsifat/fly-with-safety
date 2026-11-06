/** Real app/auth/PG, injected payment provider. Owner-controlled foreground browser host. */
import { it, vi } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import type { Server } from 'node:http';
import type { Express } from 'express';
import type { Gateway } from '../src/payments/sslcommerz.js';
import { browserGatewayDouble, browserWriteGate } from './phase3-browser-double.js';
import { retainedPaymentFixture as retained } from './phase3-retained-fixtures.js';
import { paymentProofFailure } from './phase3-proof-diagnostics.js';
import { waitForBrowserStop } from './phase2-browser-preflight.js';
const injected = vi.hoisted(() => ({ gateway: null as Gateway | null }));
vi.mock('dotenv', () => ({ default: { config: () => ({ parsed: {} }) }, config: () => ({ parsed: {} }) }));
vi.mock('../src/payments/sslcommerz.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/payments/sslcommerz.js')>();
  const gateway = () => { if (!injected.gateway) throw Error('BROWSER_PROVIDER_NOT_INITIALIZED'); return injected.gateway; };
  return { ...actual, SSLCommerzClient: class implements Gateway {
    initiate(...args: Parameters<Gateway['initiate']>) { return gateway().initiate(...args); }
    query(...args: Parameters<Gateway['query']>) { return gateway().query(...args); }
    validate(...args: Parameters<Gateway['validate']>) { return gateway().validate(...args); }
    refund(...args: Parameters<Gateway['refund']>) { return gateway().refund(...args); }
    refundStatus(...args: Parameters<Gateway['refundStatus']>) { return gateway().refundStatus(...args); }
  } };
});

it('same-port payment browser host — readiness is NOT browser/provider acceptance', async () => {
  if (process.env.PHASE3_BROWSER_OWNER_APPROVED !== 'true') throw Error('PHASE3_BROWSER_EXECUTION_NOT_APPROVED');
  const base = resolve(process.env.PHASE3_BROWSER_ARTIFACT_DIR || '');
  if (!process.env.PHASE3_BROWSER_ARTIFACT_DIR || !base.startsWith(resolve(__dirname, '../../output/phase3') + sep)) throw Error('PHASE3_BROWSER_EVIDENCE_REQUIRED');
  const save = (name: string, data: object) => writeFileSync(resolve(base, name), JSON.stringify(data, null, 2), { flag: 'wx' });
  const journal = (data: object) => appendFileSync(resolve(base, 'host-journal.jsonl'), JSON.stringify(data) + '\n');
  if (['ready.json', 'host-result.json', 'host-journal.jsonl'].some(n => existsSync(resolve(base, n)))) throw Error('PHASE3_EXISTING_BROWSER_HOST_NO_RETRY');
  const accepted = JSON.parse(readFileSync(resolve(base, 'accepted-postgres.json'), 'utf8'));
  if (!accepted.accepted || accepted.checks.passed !== 64 || accepted.provider !== 'MOCK_ONLY') throw Error('PHASE3_ACCEPTED_PG_PROOF_REQUIRED');
  const plan = JSON.parse(readFileSync(resolve(base, 'fixture-plan.json'), 'utf8')) as { bookingId: string; passengerId: string; historyId: string; quoteId: string; reference: string };
  let target: URL;
  try { target = new URL(process.env.DATABASE_URL || ''); } catch { throw Error('PHASE3_BROWSER_TARGET_INVALID'); }
  if (target.hostname !== '127.0.0.1' || target.port !== '5432' || target.pathname !== '/flywithsafety_local_integration' || target.username !== 'flywithsafe_phase2_booking_test' || !target.password || target.search) throw Error('PHASE3_BROWSER_TARGET_INVALID');
  Object.assign(process.env, { NODE_ENV: 'development', EMAIL_DELIVERY_ENABLED: 'false', FRONTEND_URL: 'http://localhost:3000', CORS_ORIGINS: 'http://localhost:3000', API_BASE_URL: 'http://localhost:5000',
    GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '', JWT_SECRET: randomBytes(32).toString('hex'),
    SSLCOMMERZ_ENABLED: 'true', SSLCOMMERZ_SANDBOX: 'true', SSLCOMMERZ_SCHEMA_VERIFIED: 'true', SSLCOMMERZ_STORE_ID: 'browser-injected-only', SSLCOMMERZ_STORE_PASSWORD: 'synthetic-not-merchant', SSLCOMMERZ_STORAGE_KEY: randomBytes(32).toString('base64'), SSLCOMMERZ_CALLBACK_BASE_URL: 'https://not-exposed.example.invalid', SSLCOMMERZ_REFUNDS_APPROVED: 'true' });
  vi.stubGlobal('fetch', async () => { throw Error('PHASE3_BROWSER_EXTERNAL_FETCH_FORBIDDEN'); });
  const mode = () => {
    const value = JSON.parse(readFileSync(resolve(base, 'provider-mode.json'), 'utf8')).mode;
    if (value !== 'pending' && value !== 'validated') throw Error('BROWSER_INJECTED_MODE_INVALID');
    return value as 'pending' | 'validated';
  };
  const provider = browserGatewayDouble(plan.reference, mode); injected.gateway = provider.gateway;
  let stage = 'prisma-import', server: Server | undefined, identityVerified = false, fixtureCommitted = false;
  let client: typeof import('../src/lib/prisma.js').prisma | undefined;
  let baseline: object | undefined;
  const gate = browserWriteGate(plan.reference, retained.users.map(u => u.email), provider.transaction);
  try {
    const { prisma } = await import('../src/lib/prisma.js'); client = prisma;
    const { Prisma } = await import('../src/generated/prisma/client.js');
    stage = 'identity-query'; journal({ kind: 'stage', stage });
    const identity = await prisma.$queryRaw<Array<{ db: string; role: string; oid: number; host: string; port: number }>>(Prisma.sql`SELECT current_database() AS db,current_user AS role,(SELECT oid::int FROM pg_database WHERE datname=current_database()) AS oid,host(inet_server_addr()) AS host,inet_server_port() AS port`);
    if (identity.length !== 1 || identity[0].db !== 'flywithsafety_local_integration' || identity[0].role !== 'flywithsafe_phase2_booking_test' || identity[0].oid !== 34701 || identity[0].host !== '127.0.0.1' || identity[0].port !== 5432) throw Error('PHASE3_BROWSER_IDENTITY_MISMATCH');
    identityVerified = true;
    const actors = retained.users.map(u => u.id);
    const preserve = async () => ({
      unlistedUsers: await prisma.user.findMany({ where: { id: { notIn: actors } }, select: { id: true, role: true, updatedAt: true }, orderBy: { id: 'asc' } }),
      originalSessions: await prisma.session.findMany({ where: { userId: { notIn: actors } }, select: { id: true, userId: true, revokedAt: true, expiresAt: true }, orderBy: { id: 'asc' } }),
      oldBookings: await prisma.booking.findMany({ where: { id: { not: plan.bookingId } }, select: { id: true, status: true, updatedAt: true, bookingDetails: true }, orderBy: { id: 'asc' } }),
      oldPayments: await prisma.$queryRaw(Prisma.sql`SELECT to_jsonb(p) AS data FROM public."GatewayPayment" p WHERE p."bookingId"<>${plan.bookingId} ORDER BY p.id`),
      oldRefunds: await prisma.$queryRaw(Prisma.sql`SELECT to_jsonb(r) AS data FROM public."GatewayRefund" r JOIN public."GatewayPayment" p ON p.id=r."paymentId" WHERE p."bookingId"<>${plan.bookingId} ORDER BY r.id`),
      oldEvents: await prisma.$queryRaw(Prisma.sql`SELECT to_jsonb(e) AS data FROM public."GatewayPaymentEvent" e JOIN public."GatewayPayment" p ON p.id=e."paymentId" WHERE p."bookingId"<>${plan.bookingId} ORDER BY e.id`),
      oldHistory: await prisma.bookingStatusHistory.findMany({ where: { bookingId: { not: plan.bookingId } }, orderBy: { id: 'asc' } }),
      oldPassengers: await prisma.bookingPassenger.findMany({ where: { bookingId: { not: plan.bookingId } }, select: { id: true, bookingId: true, firstName: true, lastName: true }, orderBy: { id: 'asc' } }),
      oldNotifications: await prisma.$queryRaw(Prisma.sql`SELECT id,status,"updatedAt" FROM public."NotificationOutbox" WHERE payload->'params'->>'referenceNumber' IS DISTINCT FROM ${plan.reference} ORDER BY id`),
      actors: await prisma.user.findMany({ where: { id: { in: actors } }, select: { id: true, email: true, role: true, emailVerified: true, updatedAt: true }, orderBy: { id: 'asc' } }),
      migrations: await prisma.$queryRaw(Prisma.sql`SELECT migration_name,checksum FROM public._prisma_migrations ORDER BY migration_name`),
    });
    baseline = await preserve();
    stage = 'actor-and-auth-readiness'; journal({ kind: 'stage', stage });
    const actual = await prisma.user.findMany({ where: { id: { in: actors } }, select: { id: true, email: true, role: true, emailVerified: true } });
    if (actual.length !== 4 || !retained.users.every(u => actual.some(a => a.id === u.id && a.role === u.role && a.email === u.email && a.emailVerified))) throw Error('PHASE3_BROWSER_ACTOR_MISMATCH');
    const auth = await prisma.$queryRaw<Array<{ ready: boolean }>>(Prisma.sql`SELECT count(*)=4 AND bool_and(length(password)=60 AND left(password,7) IN ('$2a$12$','$2b$12$','$2y$12$')) AND has_table_privilege(current_user,'public."Session"','INSERT') AND has_column_privilege(current_user,'public."Session"','revokedAt','UPDATE') AS ready FROM public."User" WHERE id IN (${actors[0]},${actors[1]},${actors[2]},${actors[3]})`);
    if (auth[0]?.ready !== true || await prisma.session.count({ where: { userId: { in: actors } } }) !== 0 || await prisma.booking.findUnique({ where: { id: plan.bookingId } })) throw Error('PHASE3_BROWSER_AUTH_OR_FIXTURE_PRESTATE_MISMATCH');
    stage = 'one-browser-fixture'; journal({ kind: 'planned-browser-fixture', ...plan });
    await prisma.$transaction(async tx => {
      const clock = await tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`), now = +clock[0].now;
      await tx.booking.create({ data: { id: plan.bookingId, referenceNumber: plan.reference, userId: actors[0], customerName: 'Synthetic Phase3 Owner', customerEmail: retained.users[0].email, customerPhone: '01000000000', totalPrice: 12000, currency: 'BDT', bookingDetails: { integrationFixture: { phase: 3, provider: 'MOCK_ONLY', browser: true }, commercial: { version: 1, revision: 2, quotes: [{ id: plan.quoteId, amount: 12000, currency: 'BDT', description: 'Synthetic browser payment fixture; no supplier operation', validUntil: new Date(now + 7200000).toISOString(), createdAt: new Date(now).toISOString(), acceptedAt: new Date(now).toISOString() }], payments: [], receipts: [] } }, passengers: { create: { id: plan.passengerId, firstName: 'Synthetic', lastName: 'BrowserTraveller', passengerType: 'adult' } }, statusHistory: { create: { id: plan.historyId, fromStatus: 'PENDING', toStatus: 'PENDING', changedBy: actors[0], reason: 'Synthetic browser accepted-quote fixture; not provider or supplier evidence' } } } });
    });
    fixtureCommitted = true; journal({ kind: 'browser-fixture-committed', ...plan });
    stage = 'app-import'; journal({ kind: 'stage', stage });
    const express = (await import('express')).default;
    const imported = await import('../src/app.js'), candidate: unknown = imported.default;
    const app = (typeof candidate === 'function' ? candidate : (candidate as { default: Express }).default) as Express;
    const outer = express(), cookieParser = (await import('cookie-parser')).default;
    outer.use(express.json({ limit: '100kb' }), express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 40 }), cookieParser());
    outer.get('/__phase3_identity', (_req, res) => res.json({ isolated: true, ...identity[0], provider: 'MOCK_ONLY', frontend: 'http://localhost:3000', hostId: plan.bookingId }));
    outer.use((req, res, next) => {
      if (!gate.admit(req.method, req.path, req.body || {})) return res.status(403).json({ success: false, code: 'BROWSER_WRITE_SCOPE' });
      if (req.path === '/api/v1/auth/refresh' && req.method === 'POST') {
        // Extra fixture-scope check only. The unchanged auth handler still verifies
        // expiry/revocation and rotates the token. Never touch an unlisted session.
        const token: unknown = req.cookies?.refresh_token;
        if (typeof token !== 'string' || token.length > 256) return res.status(403).json({ success: false, code: 'BROWSER_REFRESH_SCOPE' });
        void prisma.session.findFirst({ where: { refreshTokenHash: createHash('sha256').update(token).digest('hex'), userId: { in: actors } }, select: { id: true } })
          .then(row => { if (row) next(); else res.status(403).json({ success: false, code: 'BROWSER_REFRESH_SCOPE' }); })
          .catch(e => { journal({ kind: 'refresh-scope-query-failed', ...paymentProofFailure(e) }); res.status(503).json({ success: false, code: 'BROWSER_SCOPE_CHECK_FAILED' }); });
        return;
      }
      return next();
    });
    outer.use((req, res, next) => { res.once('finish', () => journal({ kind: 'http-status', method: req.method, category: req.path.startsWith('/api/v1/payments') ? 'payments' : req.path.startsWith('/api/v1/auth') ? 'auth' : 'read-only', status: res.statusCode })); next(); });
    outer.use(app);
    stage = 'localhost5000-bind'; journal({ kind: 'stage', stage });
    server = await new Promise<Server>((accept, reject) => { const s = outer.listen(5000, 'localhost', () => accept(s)); s.once('error', reject); });
    save('ready.json', { ready: true, acceptance: false, identity: identity[0], frontend: 'http://localhost:3000', api: 'http://localhost:5000', provider: 'MOCK_ONLY', actors: retained.users, plan, privatePasswordsNotStored: true });
    console.log('PHASE3_BROWSER_API_READY_NOT_ACCEPTANCE'); stage = 'browser-handoff';
    await waitForBrowserStop(() => existsSync(resolve(base, 'stop-request.json')));
    if (JSON.stringify(await preserve()) !== JSON.stringify(baseline)) throw Error('PHASE3_ORIGINAL_PROOF_OR_UNLISTED_STATE_CHANGED');
    journal({ kind: 'original-proof-and-unlisted-preserved', passed: true });
    save('host-result.json', { hostClosedNormally: true, browserAcceptance: false, provider: 'MOCK_ONLY', originalPreservation: true, providerCalls: provider.calls, ...gate.counts });
  } catch (e) {
    const failure = { stage, ...paymentProofFailure(e) }; journal({ kind: 'host-stopped', ...failure });
    if (!existsSync(resolve(base, 'host-result.json'))) save('host-result.json', { hostClosedNormally: false, identityVerified, fixtureCommitted, failure });
    throw Error('PHASE3_BROWSER_HOST_STOP ' + JSON.stringify(failure));
  } finally {
    const final = { closeFailure: null as object | null, snapshotFailure: null as object | null, disconnectFailure: null as object | null, disconnected: false, noCleanup: true, supplierCalled: false, genuineProviderCalled: false, fixtureCommitted };
    try { if (server) await new Promise<void>((accept, reject) => server!.close(e => e ? reject(e) : accept())); }
    catch (e) { final.closeFailure = paymentProofFailure(e); }
    try { if (client && identityVerified) {
      const { Prisma } = await import('../src/generated/prisma/client.js');
      const counts = await client.$queryRaw<Array<{ payments: number; events: number }>>(Prisma.sql`SELECT (SELECT count(*)::int FROM public."GatewayPayment" WHERE "bookingId"=${plan.bookingId}) AS payments,(SELECT count(*)::int FROM public."GatewayPaymentEvent" e JOIN public."GatewayPayment" p ON p.id=e."paymentId" WHERE p."bookingId"=${plan.bookingId}) AS events`);
      if (await client.session.count({ where: { userId: { in: retained.users.map(u => u.id) } } }) > 16 || counts[0].payments > 1 || counts[0].events > 32 || await client.bookingStatusHistory.count({ where: { bookingId: plan.bookingId } }) > 2 || await client.notificationOutbox.count({ where: { payload: { path: ['params', 'referenceNumber'], equals: plan.reference } } }) > 21) throw Error('PHASE3_BROWSER_WRITE_BOUND_EXCEEDED');
      save('retained-browser-records.json', {
        sessions: await client.session.findMany({ where: { userId: { in: retained.users.map(u => u.id) } }, select: { id: true, userId: true } }),
        booking: await client.booking.findUnique({ where: { id: plan.bookingId }, select: { id: true, status: true, bookingDetails: true } }),
        passengers: await client.bookingPassenger.findMany({ where: { bookingId: plan.bookingId }, select: { id: true } }),
        history: await client.bookingStatusHistory.findMany({ where: { bookingId: plan.bookingId }, select: { id: true } }),
        payments: await client.$queryRaw(Prisma.sql`SELECT id FROM public."GatewayPayment" WHERE "bookingId"=${plan.bookingId}`),
        events: await client.$queryRaw(Prisma.sql`SELECT e.id FROM public."GatewayPaymentEvent" e JOIN public."GatewayPayment" p ON p.id=e."paymentId" WHERE p."bookingId"=${plan.bookingId}`),
        notifications: await client.notificationOutbox.findMany({ where: { payload: { path: ['params', 'referenceNumber'], equals: plan.reference } }, select: { id: true } }),
      });
    } } catch (e) { final.snapshotFailure = paymentProofFailure(e); }
    try { await client?.$disconnect(); final.disconnected = true; } catch (e) { final.disconnectFailure = paymentProofFailure(e); }
    injected.gateway = null; vi.unstubAllGlobals(); save('finalization.json', final);
    if (final.closeFailure || final.snapshotFailure || final.disconnectFailure) throw Error('PHASE3_BROWSER_FINALIZATION_INCOMPLETE ' + JSON.stringify(final));
  }
}, 0);
