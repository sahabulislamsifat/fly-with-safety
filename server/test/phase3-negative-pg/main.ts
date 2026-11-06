/** Real local PostgreSQL, real app code, mocked SSLCommerz transport only. */
import { createHash, randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../../src/generated/prisma/client.js';
import type { Attempt } from '../../src/payments/payment-domain.js';
import type { GatewayConfig } from '../../src/payments/sslcommerz.js';
import { assertLocalURL, preflight, preserve } from '../phase3-db-preflight-v02.js';
import { verifyRetained } from '../phase3-negative-v01/retained.js';
import type { Plan } from '../phase3-genuine/scope.js';
import { paymentProofFailure } from '../phase3-proof-diagnostics.js';
import { postForm } from './http.js';
import { Scope, type Fixture, type FixturePlan } from './scope.js';

const repo = resolve(__dirname, '../../..');
const base = resolve(repo, 'output/phase3/negative-postgres-20261105-01');
const config: GatewayConfig = {
  storeId: 'synthetic-negative-contract', password: 'synthetic-not-merchant', storageKey: randomBytes(32),
  callbackOrigin: 'https://negative-postgres.example.invalid', frontendOrigin: 'http://127.0.0.1:3000', refunds: false,
};
const journal = (record: object) => appendFileSync(resolve(base, 'journal.jsonl'), `${JSON.stringify(record)}\n`);

function sign(fields: Record<string, string>) {
  const values = { ...fields, store_passwd: createHash('md5').update(config.password).digest('hex') };
  return {
    ...fields, verify_key: Object.keys(fields).sort().join(','),
    verify_sign: createHash('md5').update(Object.keys(values).sort().map(k => `${k}=${(values as Record<string, string>)[k]}`).join('&')).digest('hex'),
  };
}

async function main() {
  if (process.argv[2] !== '--owner-approved-negative-postgres-v01' || process.env.PHASE3_NEGATIVE_POSTGRES_APPROVED !== 'true') throw Error('APPROVAL_REQUIRED');
  const dbUrl = process.env.DATABASE_URL ?? '';
  assertLocalURL(dbUrl);
  if (process.env.DIRECT_URL !== dbUrl) throw Error('URL_PARITY_REQUIRED');
  if (['attempt.json', 'result.json', 'journal.jsonl'].some(n => existsSync(resolve(base, n)))) throw Error('CONSUMED_NO_RETRY');
  const scope = new Scope(JSON.parse(readFileSync(resolve(base, 'fixture-plan.json'), 'utf8')) as FixturePlan);
  const [fail, cancel, paid] = scope.plan.fixtures;
  const { actors } = JSON.parse(readFileSync(resolve(repo, 'output/phase3/negative-continuation-20261104-01/fixture-plan.json'), 'utf8')) as Plan;
  const owner = actors.find(a => a.id === fail.customerId && a.role === 'CUSTOMER');
  const other = actors.find(a => a.id !== fail.customerId && a.role === 'CUSTOMER');
  const staff = actors.find(a => a.role === 'STAFF');
  const admin = actors.find(a => a.role === 'ADMIN');
  if (!owner || !other || !staff || !admin || scope.plan.fixtures.some(f => f.customerId !== owner.id)) throw Error('EXACT_ACTORS_REQUIRED');
  const plan: Plan = { actors, fixtures: scope.plan.fixtures.map(f => ({ ...f, passengerId: '', historyId: '' })), caps: scope.plan.caps };
  writeFileSync(resolve(base, 'attempt.json'), JSON.stringify({ at: new Date().toISOString(), provider: 'MOCK_ONLY', retainOwnedRows: true }), { flag: 'wx' });

  // The default application composition stays disabled. Only the injected SDK
  // instance below receives synthetic config and a callable transport.
  Object.assign(process.env, { NODE_ENV: 'test', SSLCOMMERZ_ENABLED: 'false', SSLCOMMERZ_SANDBOX: 'true',
    SSLCOMMERZ_REFUNDS_APPROVED: 'false', EMAIL_DELIVERY_ENABLED: 'false', JWT_SECRET: randomBytes(32).toString('hex'),
    SSLCOMMERZ_STORE_ID: config.storeId, SSLCOMMERZ_STORE_PASSWORD: config.password, SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '',
    GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', FRONTEND_URL: config.frontendOrigin, API_BASE_URL: 'http://127.0.0.1:5000' });
  globalThis.fetch = async () => { throw Error('EXTERNAL_HTTP_FORBIDDEN'); };
  const pool = new pg.Pool({ connectionString: dbUrl, max: 4, connectionTimeoutMillis: 8_000, statement_timeout: 8_000, query_timeout: 10_000, options: '-c lock_timeout=4000' });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  const deadline = setTimeout(() => { scope.closed = true; releaseQuery?.(); }, 60_000);
  const stop = () => { scope.closed = true; releaseQuery?.(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  let baseline: string | undefined;
  let preservation = false;
  let fixtureCommitted = false;
  let stage = 'readonly-preflight';
  let failure: object | null = null;
  let releaseQuery: (() => void) | undefined;
  const persisted: Array<{ case: string; status: string; captured: boolean; notices: number; events: string[]; eventIds: string[] }> = [];
  const checks: string[] = [];
  const requests: Promise<unknown>[] = [];
  const check = (id: string, ok: boolean) => {
    stage = id;
    journal({ kind: 'check', id, passed: ok });
    if (!ok || scope.closed) throw Error('CHECK_FAILED_OR_CLOSED');
    checks.push(id);
  };

  async function snapshot(before: boolean) {
    const rollback = Error('CONTROLLED_READONLY_ROLLBACK');
    let data: string | undefined;
    try {
      await db.$transaction(async tx => {
        await tx.$executeRawUnsafe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const mode = await tx.$queryRawUnsafe<Array<{ ro: string }>>("SELECT current_setting('transaction_read_only') AS ro");
        if (mode[0]?.ro !== 'on') throw Error('READONLY_NOT_ACTIVE');
        const client = tx as unknown as PrismaClient;
        if (before) {
          await preflight(client, plan, repo);
          const collisions = await tx.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
            SELECT EXISTS(SELECT 1 FROM public."GatewayPayment" WHERE id IN (${Prisma.join(scope.plan.fixtures.map(f => f.paymentId))})
              OR "tranId" IN (${Prisma.join(scope.plan.fixtures.map(f => f.tranId))})
              OR ("userId"=${fail.customerId} AND "requestId" IN (${Prisma.join(scope.plan.fixtures.map(f => f.requestId))}))
              OR "valId"=${paid.valId!} OR "bankId"=${paid.bankId!})
            OR EXISTS(SELECT 1 FROM public."GatewayPaymentEvent" WHERE id=${scope.plan.rollbackEventId}) AS "exists"`);
          if (collisions[0]?.exists !== false) throw Error('FIXTURE_PREEXISTS');
        }
        await verifyRetained(client, repo);
        data = JSON.stringify(await preserve(client, plan));
        throw rollback;
      }, { timeout: 25_000, maxWait: 5_000 });
    } catch (e) { if (e !== rollback) throw e; }
    if (!data) throw Error('SNAPSHOT_MISSING');
    return data;
  }

  try {
    baseline = await snapshot(true);
    check('local-identity-and-retained-preflight', true);
    const { SSLCommerzClient } = await import('../../src/payments/sslcommerz.js');
    const { PaymentService } = await import('../../src/payments/payment.service.js');
    const { PrismaPaymentStore } = await import('../../src/payments/payment-store.js');
    const { createPaymentCallbacks } = await import('../../src/payments/payment.routes.js');
    const { errorHandler } = await import('../../src/middleware/error-handler.js');
    if (process.env.DATABASE_URL !== dbUrl || process.env.DIRECT_URL !== dbUrl || process.env.SSLCOMMERZ_ENABLED !== 'false') throw Error('ENVIRONMENT_CHANGED');

    stage = 'fixture-create';
    await db.$transaction(async tx => {
      const rows = await tx.$queryRawUnsafe<Array<{ now: Date }>>("SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now");
      const now = +rows[0].now;
      for (const f of scope.plan.fixtures) {
        scope.take('bookingInserts');
        await tx.booking.create({ data: { id: f.bookingId, referenceNumber: f.reference, status: 'PENDING', userId: f.customerId, customerName: 'Synthetic Negative Contract', customerEmail: 'negative-pg@example.invalid', totalPrice: f.amount, currency: 'BDT', bookingDetails: { integrationFixture: 'negative-postgres-20261105-01' } } });
        const a: Attempt = { id: f.paymentId, bookingId: f.bookingId, userId: f.customerId, requestId: f.requestId,
          digest: 'synthetic-negative-pg', tranId: f.tranId, quoteId: f.quoteId, quoteRevision: 1, amountMinor: '1200000', currency: 'BDT',
          status: f.name === 'success' ? 'VERIFIED' : 'SESSION_READY', captured: f.name === 'success',
          ...(f.valId && f.bankId ? { valId: f.valId, bankId: f.bankId } : {}), checks: 0, due: 0, created: now, updated: now };
        scope.assertPayment(f, a);
        scope.take('paymentInserts');
        const inserted = await tx.$executeRaw(Prisma.sql`
          INSERT INTO public."GatewayPayment" (id,"bookingId","userId","requestId","tranId",status,"valId","bankId",state)
          VALUES (${a.id},${a.bookingId},${a.userId},${a.requestId},${a.tranId},${a.status},${a.valId ?? null},${a.bankId ?? null},${JSON.stringify(a)}::jsonb)`);
        if (inserted !== 1) throw Error('EXACT_PAYMENT_INSERT_REQUIRED');
      }
    }, { timeout: 10_000, maxWait: 5_000 });
    fixtureCommitted = true;

    type ExpectedQuery = { fixture: Fixture; statuses: string[]; beforeReply?: () => Promise<void> };
    let nextQuery: ExpectedQuery | undefined;
    let deniedProviderCalls = 0;
    const expectQuery = (fixture: Fixture, statuses: string[], beforeReply?: () => Promise<void>) => {
      if (nextQuery) throw Error('MOCK_QUERY_ALREADY_QUEUED');
      nextQuery = { fixture, statuses, beforeReply };
    };
    const gateway = new SSLCommerzClient(config, async (input, init) => {
      const url = new URL(String(input)), query = nextQuery;
      if (!query || url.origin !== 'https://sandbox.sslcommerz.com' || url.pathname !== '/validator/api/merchantTransIDvalidationAPI.php' ||
          init?.method !== 'GET' || init.redirect !== 'error' || url.searchParams.get('tran_id') !== query.fixture.tranId ||
          url.searchParams.get('store_id') !== config.storeId || url.searchParams.get('store_passwd') !== config.password) {
        deniedProviderCalls++;
        throw Error('UNAPPROVED_PROVIDER_DOUBLE');
      }
      scope.take('providerDoubles');
      nextQuery = undefined;
      await query.beforeReply?.();
      return Response.json({ APIConnect: 'DONE', no_of_trans_found: query.statuses.length, element: query.statuses.map(status => ({
        status, tran_id: query.fixture.tranId, amount: '12000.00', currency: 'BDT', currency_type: 'BDT', currency_amount: '12000.00', risk_level: '0', store_id: config.storeId,
      })) });
    });
    const store = scope.store(new PrismaPaymentStore(db));
    const service = new PaymentService(store, gateway, config);
    const app = express();
    app.use('/api/v1', createPaymentCallbacks(() => service, () => config));
    app.use(errorHandler);
    const notice = (f: Fixture, status: string, extra: Record<string, string> = {}) => sign({ tran_id: f.tranId, amount: '12000.00', currency: 'BDT', status, store_id: config.storeId, ...extra });
    const post = (source: string, form: Record<string, string>) => {
      scope.take('callbackRequests');
      const result = postForm(app, `/api/v1/payments/sslcommerz/${source}`, form);
      requests.push(result);
      return result;
    };
    const payment = async (f: Fixture) => {
      const rows = await db.$queryRaw<Array<{ status: string; valId: string | null; bankId: string | null; dueAt: string | null; state: Attempt }>>(Prisma.sql`
        SELECT status,"valId","bankId","dueAt"::text AS "dueAt",state FROM public."GatewayPayment"
        WHERE id=${f.paymentId} AND "bookingId"=${f.bookingId} AND "userId"=${f.customerId} AND "tranId"=${f.tranId}`);
      if (rows.length !== 1 || rows[0].status !== rows[0].state.status) throw Error('PERSISTED_PAYMENT_MISMATCH');
      scope.assertPayment(f, rows[0].state);
      return rows[0];
    };
    const events = (f: Fixture) => db.$queryRaw<Array<{ id: string; kind: string }>>(Prisma.sql`
      SELECT id,kind FROM public."GatewayPaymentEvent" WHERE "paymentId"=${f.paymentId} ORDER BY id`);

    stage = 'spoof-and-ownership';
    check('tampered-ipn-denied', (await post('ipn', { ...notice(fail, 'FAILED'), amount: '1.00' })).status === 400);
    check('foreign-store-denied', (await post('ipn', notice(fail, 'FAILED', { store_id: 'foreign-store' }))).status === 400);
    check('unowned-transaction-denied', (await post('fail', notice(fail, 'FAILED', { tran_id: 'unowned-synthetic' }))).status === 404);
    check('forgeries-no-notice-or-query', (await events(fail)).length === 0 && !scope.counts.providerDoubles);
    check('other-customer-denied', await service.list(fail.reference, other).then(() => false, e => paymentProofFailure(e).appCode === 'NOT_FOUND'));
    check('customer-reconcile-denied', await service.reconcile(fail.reference, owner).then(() => false, e => paymentProofFailure(e).appCode === 'FORBIDDEN'));

    expectQuery(fail, ['PROCESSING']);
    const browser = await post('fail', { tran_id: fail.tranId, status: 'FAILED' });
    check('safe-browser-return', browser.status === 303 && browser.location === `${config.frontendOrigin}/payments/return?booking=${fail.reference}`);
    check('processing-fail-closed', (await payment(fail)).status === 'SESSION_READY' && (await events(fail)).some(e => e.kind === 'RECONCILIATION_UNRESOLVED'));
    expectQuery(fail, ['PENDING']);
    await service.reconcile(fail.reference, staff);
    check('pending-persists-unknown', (await payment(fail)).status === 'UNKNOWN');
    expectQuery(fail, ['FAILED', 'CANCELLED']);
    await service.reconcile(fail.reference, staff);
    check('conflicting-query-stays-unknown', (await payment(fail)).status === 'UNKNOWN');

    stage = 'out-of-order';
    let started!: () => void;
    const inFlight = new Promise<void>(r => { started = r; });
    const blocked = new Promise<void>(r => { releaseQuery = r; });
    expectQuery(fail, ['FAILED'], async () => { started(); await blocked; });
    const first = post('ipn', notice(fail, 'FAILED'));
    try {
      await Promise.race([inFlight, first.then(() => { throw Error('QUERY_NOT_ENTERED'); })]);
      check('later-ipn-commits-during-query', (await post('ipn', notice(fail, 'CANCELLED'))).status === 200);
    } finally { releaseQuery?.(); }
    check('earlier-ipn-acknowledged', (await first).status === 200);
    check('stale-negative-deferred', (await payment(fail)).status === 'UNKNOWN' && !(await events(fail)).some(e => e.kind === 'FAILED'));
    expectQuery(fail, ['FAILED']);
    await service.reconcile(fail.reference, staff);
    check('confirmed-failed-persisted', (await payment(fail)).status === 'FAILED');

    stage = 'cancel-concurrency';
    expectQuery(cancel, ['CANCELLED']);
    const cancelReturn = await post('cancel', { tran_id: cancel.tranId, status: 'CANCELLED' });
    check('cancel-browser-return', cancelReturn.status === 303 && cancelReturn.location === `${config.frontendOrigin}/payments/return?booking=${cancel.reference}`);
    expectQuery(cancel, ['CANCELLED']);
    const cancelForm = notice(cancel, 'CANCELLED');
    const replies = await Promise.all(Array.from({ length: 4 }, () => post('ipn', cancelForm)));
    check('concurrent-cancel-ipns-acknowledged', replies.every(r => r.status === 200 && r.text === 'RECEIVED'));
    check('cancel-replay-acknowledged', (await post('ipn', cancelForm)).status === 200);
    const cancelEvents = await events(cancel);
    check('cancelled-persisted-once', (await payment(cancel)).status === 'CANCELLED' && cancelEvents.filter(e => e.kind === 'NOTICE').length === 2 && cancelEvents.filter(e => e.kind === 'CANCELLED').length === 1);

    expectQuery(paid, ['FAILED']);
    check('late-negative-return', (await post('fail', notice(paid, 'FAILED'))).status === 303);
    const protectedPaid = await payment(paid);
    check('seeded-capture-protected', protectedPaid.status === 'VERIFIED' && protectedPaid.valId === paid.valId && protectedPaid.bankId === paid.bankId && (protectedPaid.state as Attempt).captured && !(await events(paid)).some(e => e.kind === 'FAILED'));

    stage = 'rollback-probe';
    const beforeRollback = await payment(fail);
    let rollbackEventWritten = false;
    const rolledBack = await store.transaction(fail.reference, async l => {
      const a = l.attempts[0];
      await l.save({ ...a, status: 'UNKNOWN' });
      if (!await l.event(a.id, scope.plan.rollbackEventId, 'ROLLBACK_PROBE', staff.id)) throw Error('ROLLBACK_EVENT_NOT_INSERTED');
      rollbackEventWritten = true;
      // The production PostgreSQL trigger rejects the changed immutable digest.
      await l.save({ ...a, digest: 'synthetic-immutable-fault' });
      throw Error('EXPECTED_TRIGGER_DID_NOT_FIRE');
    }).then(() => null, paymentProofFailure);
    journal({ kind: 'rollback-diagnostic', sqlState: rolledBack?.sqlState ?? null });
    check('postgres-constraint-triggered', rollbackEventWritten && rolledBack?.sqlState === '23514');
    check('status-and-event-rolled-back', JSON.stringify(await payment(fail)) === JSON.stringify(beforeRollback) && !(await events(fail)).some(e => e.id === scope.plan.rollbackEventId));

    for (const f of scope.plan.fixtures) {
      const customer = await service.list(f.reference, owner), employee = await service.list(f.reference, staff), administrator = await service.list(f.reference, admin);
      const { refundsEnabled: ignoredCustomer, ...customerState } = customer;
      const { refundsEnabled: ignoredEmployee, ...employeeState } = employee;
      const { refundsEnabled: ignoredAdministrator, ...administratorState } = administrator;
      void ignoredCustomer; void ignoredEmployee; void ignoredAdministrator;
      check(`role-consistency-${f.name}`, JSON.stringify(customerState) === JSON.stringify(employeeState) && JSON.stringify(customerState) === JSON.stringify(administratorState));
      const p = await payment(f), history = await events(f);
      check(`no-fulfillment-${f.name}`, (await db.booking.findUniqueOrThrow({ where: { id: f.bookingId } })).status === 'PENDING' && customer.payments[0]?.fulfillment === (f.name === 'success' ? 'AWAITING_OPERATIONS' : 'NOT_PAID'));
      persisted.push({ case: f.name, status: p.status, captured: p.state.captured, notices: history.filter(e => e.kind === 'NOTICE').length,
        events: history.map(e => e.kind).sort(), eventIds: history.map(e => e.id) });
    }
    check('exact-mock-query-count', scope.counts.providerDoubles === scope.plan.caps.providerDoubles && !nextQuery && deniedProviderCalls === 0);
    check('exact-persisted-event-counts', persisted.map(p => p.events.length).join(',') === '7,3,1');
    const refunds = await db.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
      SELECT EXISTS(SELECT 1 FROM public."GatewayRefund" WHERE "paymentId" IN (${Prisma.join(scope.plan.fixtures.map(f => f.paymentId))})) AS "exists"`);
    check('no-new-refunds', refunds[0]?.exists === false);
  } catch (e) { failure = { stage, ...paymentProofFailure(e) }; }
  finally {
    stop();
    clearTimeout(deadline);
    await Promise.allSettled(requests);
    if (baseline !== undefined) {
      try { preservation = baseline === await snapshot(false); }
      catch (e) { failure = { stage: 'protected-postcheck', ...paymentProofFailure(e) }; }
    }
    await db.$disconnect().catch(() => { failure = { stage: 'disconnect' }; });
    await pool.end().catch(() => { failure = { stage: 'pool-close' }; });
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
  const result = { passed: !failure && preservation && fixtureCommitted && persisted.length === 3, failure, fixtureCommitted, preservation, checks,
    persisted, counts: scope.counts, provider: 'MOCK_ONLY', realPostgres: true, providerNetworkCalls: 0, publicConnections: 0, phase3Accepted: false };
  writeFileSync(resolve(base, 'result.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
  process.exitCode = result.passed ? 0 : 1;
}

if (require.main === module) main().catch(() => { console.error('NEGATIVE_POSTGRES_STOPPED'); process.exitCode = 1; });
