import { it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Express } from 'express';
import type { Server } from 'node:http';
import { browserFailure, browserPreflight, waitForBrowserStop, requireBrowserAuthReadiness } from './phase2-browser-preflight.js';

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
    FRONTEND_URL: 'http://localhost:3000', CORS_ORIGINS: 'http://localhost:3000', API_BASE_URL: 'http://localhost:5000',
    GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '', JWT_SECRET: randomBytes(32).toString('hex') });
  let prisma: typeof import('../src/lib/prisma.js').prisma | undefined;
  let server: Server | undefined;
  let stage = 'client-import';
  let identityVerified = false;
  const started = performance.now();
  const save = (name: string, data: object) => writeFileSync(resolve(base, name), JSON.stringify(data, null, 2), { flag: 'wx' });
  const journal = (data: object) => appendFileSync(resolve(base, 'host-journal.jsonl'), JSON.stringify({ ...data, elapsedMs: Math.round(performance.now() - started) }) + '\n');
  try {
    journal({ kind: 'stage', stage });
    prisma = (await import('../src/lib/prisma.js')).prisma;
    const client = prisma;
    const actualActors = await browserPreflight(
      () => client.$queryRaw`SELECT current_database() AS db,current_user AS role,host(inet_server_addr()) AS host,inet_server_port() AS port`,
      () => client.user.findMany({ where: { id: { in: actors.map(row => row.userId) } }, select: { id: true, email: true, role: true } }),
      actors, value => { stage = value; journal({ kind: 'stage', stage }); }, journal,
    );
    identityVerified = true;
    stage = 'auth-readiness-query'; journal({ kind: 'stage', stage });
    const readiness = await client.$queryRaw`
      SELECT count(*)=4 AND count(*) FILTER (WHERE "emailVerified" AND length(password)=60
        AND left(password,7) IN ('$2a$12$','$2b$12$','$2y$12$'))=4
        AND has_table_privilege(current_user,'public."Session"','INSERT')
        AND has_column_privilege(current_user,'public."Session"','revokedAt','UPDATE')
        AND has_column_privilege(current_user,'public."Session"','lastUsedAt','UPDATE')
        AND NOT has_table_privilege(current_user,'public."User"','DELETE')
        AND NOT has_schema_privilege(current_user,'public','CREATE') AS ready
      FROM public."User" WHERE id IN (${actors[0].userId},${actors[1].userId},${actors[2].userId},${actors[3].userId})`;
    stage = 'auth-readiness-assertion'; journal({ kind: 'stage', stage });
    requireBrowserAuthReadiness(readiness);
    stage = 'app-import'; journal({ kind: 'stage', stage });
    const imported = await import('../src/app.js'); const candidate: unknown = imported.default;
    const app = (typeof candidate === 'function' ? candidate : (candidate as { default: Express }).default) as Express;
    stage = 'loopback-listen'; journal({ kind: 'stage', stage });
    server = await new Promise<Server>((accept, reject) => { const local = app.listen(5000, 'localhost', () => accept(local)); local.once('error', reject); });
    save('ready.json', { state: 'HOST_READY_NOT_BUSINESS_ACCEPTANCE', api: 'http://localhost:5000/api/v1', frontend: 'http://localhost:3000', actors: actualActors, readyUTC: new Date().toISOString() });
    console.log('PHASE2_BROWSER_API_READY_NOT_ACCEPTANCE');
    stage = 'browser-handoff';
    // The operator/agent closes only this owned host after actual browser work.
    // A stop signal is not a PASS receipt for the business journey.
    await waitForBrowserStop(() => existsSync(resolve(base, 'stop-request.json')));
    save('host-result.json', { hostClosedNormally: true, businessAcceptance: false, finishedUTC: new Date().toISOString() });
  } catch (error) {
    const failure = browserFailure(error, stage);
    if (!existsSync(resolve(base, 'host-result.json'))) save('host-result.json', { hostClosedNormally: false, stage, failure, identityVerified,
      elapsedMs: Math.round(performance.now() - started), businessAcceptance: false, finishedUTC: new Date().toISOString() });
    console.log('PHASE2_BROWSER_HOST_DIAGNOSTIC ' + JSON.stringify({ stage, failure, identityVerified }));
    throw new Error('PHASE2_BROWSER_HOST_STOP_' + stage);
  } finally {
    let closeFailure: ReturnType<typeof browserFailure> | null = null;
    let snapshotFailure: ReturnType<typeof browserFailure> | null = null;
    let disconnectFailure: ReturnType<typeof browserFailure> | null = null;
    try { if (server) await new Promise<void>((accept, reject) => server!.close(error => error ? reject(error) : accept())); }
    catch (error) { closeFailure = browserFailure(error, 'host-close'); }
    try {
      // A failed identity guard never triggers more database queries or writes.
      if (prisma && identityVerified) {
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
      }
    } catch (error) { snapshotFailure = browserFailure(error, 'snapshot'); save('retained-records-unavailable.json', { reviewRequired: true, failure: snapshotFailure }); }
    try { await prisma?.$disconnect(); } catch (error) { disconnectFailure = browserFailure(error, 'disconnect'); }
    save('finalization.json', { closeFailure, snapshotFailure, disconnectFailure, snapshotSkipped: !identityVerified, finishedUTC: new Date().toISOString() });
    if (closeFailure || snapshotFailure || disconnectFailure) throw new Error('PHASE2_BROWSER_FINALIZATION_INCOMPLETE');
  }
}, 0);
