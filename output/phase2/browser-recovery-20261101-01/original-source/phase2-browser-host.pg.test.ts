import { it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Express } from 'express';
import type { Server } from 'node:http';

// Only environment-file discovery is disabled. Authentication, API and PG are real.
vi.mock('dotenv', () => ({ default: { config: () => ({ parsed: {} }) }, config: () => ({ parsed: {} }) }));
it.skipIf(process.env.PHASE2_BROWSER_MODE !== 'owner-approved-synthetic')('loopback browser API host lifecycle — NOT business acceptance', async () => {
  const base = process.env.PHASE2_BROWSER_ARTIFACT_DIR;
  if (!base) throw new Error('PHASE2_BROWSER_ARTIFACT_REQUIRED');
  let target: URL;
  try { target = new URL(process.env.PHASE2_BOOKING_DATABASE_URL || ''); } catch { throw new Error('PHASE2_BROWSER_TARGET_INVALID'); }
  if (target.hostname !== '127.0.0.1' || target.port !== '5432' || target.pathname !== '/flywithsafe_phase2_booking_integration' ||
      target.username !== 'flywithsafe_phase2_booking_test' || !target.password || target.search) throw new Error('PHASE2_BROWSER_TARGET_INVALID');
  const proofDirectory = resolve(__dirname, '../../output/phase2/final-evidence-acceptance-20261101-01');
  const proof = JSON.parse(readFileSync(resolve(proofDirectory, 'accepted-evidence.json'), 'utf8'));
  if (proof.passed !== true || proof.readOnly !== true || proof.composedBusinessEvidence !== true || proof.checkedInvariants !== 39 || proof.acceptedFromSavedEvidence !== true) throw new Error('PHASE2_API_PROOF_NOT_ACCEPTED');
  const actors = readFileSync(resolve(__dirname, '../../output/phase2/integration-recovery-20261101-01/fixture-ledger.jsonl'), 'utf8').trim().split(/\r?\n/)
    .map(line => JSON.parse(line) as { kind: string; userId: string; email: string; role: string }).filter(row => row.kind === 'created-user');
  if (actors.length !== 4 || actors.some(row => row.email !== `${row.userId}@example.invalid` || !/^[a-f0-9-]{36}$/.test(row.userId))) throw new Error('PHASE2_BROWSER_ACTOR_LEDGER_INVALID');
  Object.assign(process.env, { NODE_ENV: 'development', DATABASE_URL: target.href, EMAIL_DELIVERY_ENABLED: 'false',
    FRONTEND_URL: 'http://phase2.localhost:3002', CORS_ORIGINS: 'http://phase2.localhost:3002', API_BASE_URL: 'http://phase2.localhost:5002',
    GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '', JWT_SECRET: randomBytes(32).toString('hex') });
  const { prisma } = await import('../src/lib/prisma.js');
  let server: Server | undefined;
  let stage = 'restricted-identity';
  const save = (name: string, data: object) => writeFileSync(resolve(base, name), JSON.stringify(data, null, 2), { flag: 'wx' });
  try {
    const [identity] = await prisma.$queryRaw<{ db: string; role: string }[]>`SELECT current_database() AS db,current_user AS role`;
    if (identity.db !== 'flywithsafe_phase2_booking_integration' || identity.role !== 'flywithsafe_phase2_booking_test') throw new Error('IDENTITY');
    const actualActors = await prisma.user.findMany({ where: { id: { in: actors.map(row => row.userId) } }, select: { id: true, email: true, role: true } });
    if (actualActors.length !== actors.length || actors.some(row => !actualActors.some(actual => actual.id === row.userId && actual.email === row.email && actual.role === row.role))) throw new Error('ACTOR_MISMATCH');
    stage = 'loopback-listen';
    const imported = await import('../src/app.js'); const candidate: unknown = imported.default;
    const app = (typeof candidate === 'function' ? candidate : (candidate as { default: Express }).default) as Express;
    server = await new Promise<Server>((accept, reject) => { const local = app.listen(5002, '127.0.0.1', () => accept(local)); local.once('error', reject); });
    save('ready.json', { state: 'HOST_READY_NOT_BUSINESS_ACCEPTANCE', api: 'http://phase2.localhost:5002/api/v1', frontend: 'http://phase2.localhost:3002', actors: actualActors, readyUTC: new Date().toISOString() });
    console.log('PHASE2_BROWSER_API_READY_NOT_ACCEPTANCE');
    stage = 'browser-handoff';
    // The operator/agent closes only this owned host after actual browser work.
    // A stop signal is not a PASS receipt for the business journey.
    const expires = Date.now() + 15 * 60 * 1000;
    await new Promise<void>((accept, reject) => {
      const timer = setInterval(() => {
        if (existsSync(resolve(base, 'stop-request.json'))) { clearInterval(timer); accept(); }
        else if (Date.now() >= expires) { clearInterval(timer); reject(new Error('BROWSER_HANDOFF_TIMEOUT')); }
      }, 500);
    });
    save('host-result.json', { hostClosedNormally: true, businessAcceptance: false, finishedUTC: new Date().toISOString() });
  } catch {
    if (!existsSync(resolve(base, 'host-result.json'))) save('host-result.json', { hostClosedNormally: false, stage, businessAcceptance: false });
    throw new Error('PHASE2_BROWSER_HOST_STOP_' + stage);
  } finally {
    if (server) await new Promise<void>((accept, reject) => server!.close(error => error ? reject(new Error('HOST_CLOSE_FAILED')) : accept()));
    try {
      const ids = actors.map(row => row.userId), emails = actors.map(row => row.email), owned = { OR: [{ userId: { in: ids } }, { customerEmail: { in: emails } }] };
      save('retained-records.json', {
        users: await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true } }),
        sessions: await prisma.session.findMany({ where: { userId: { in: ids } }, select: { id: true, userId: true } }),
        bookings: await prisma.booking.findMany({ where: owned, select: { id: true, referenceNumber: true, userId: true, status: true, totalPrice: true, currency: true, bookingDetails: true } }),
        passengers: await prisma.bookingPassenger.findMany({ where: { booking: owned }, select: { id: true, bookingId: true } }),
        history: await prisma.bookingStatusHistory.findMany({ where: { booking: owned }, select: { id: true, bookingId: true, fromStatus: true, toStatus: true } }),
        notifications: await prisma.notificationOutbox.findMany({ where: { recipient: { in: emails } }, select: { id: true } }),
        idempotency: await prisma.idempotencyRecord.findMany({ where: { OR: [{ userId: { in: ids } }, { referenceNumber: { in: (await prisma.booking.findMany({ where: owned, select: { referenceNumber: true } })).map(row => row.referenceNumber) } }] }, select: { id: true, referenceNumber: true } }),
      });
    } catch { save('retained-records-unavailable.json', { reviewRequired: true }); }
    try { await prisma.$disconnect(); } catch { throw new Error('PHASE2_BROWSER_POOL_CLOSE_FAILED'); }
  }
}, 920000);
