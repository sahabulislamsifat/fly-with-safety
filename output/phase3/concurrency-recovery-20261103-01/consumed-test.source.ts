/** Real PostgreSQL proof; provider is an injected test double. NOT genuine SSLCommerz evidence. */
import { it, vi } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import bcrypt from 'bcryptjs';
import type { Evidence, Gateway } from '../src/payments/sslcommerz.js';
import type { PaymentStore } from '../src/payments/payment-store.js';
import { paymentProofChecks, paymentProofFailure } from './phase3-proof-diagnostics.js';

// Never discover normal development/cloud .env or permit provider/SMTP HTTP in this test process.
vi.mock('dotenv', () => ({ default: { config: () => ({ parsed: {} }) }, config: () => ({ parsed: {} }) }));

it('restricted PostgreSQL payment admission, validation, replay, fencing, refund and preservation', async () => {
  if (process.env.PHASE3_LEDGER_OWNER_APPROVED !== 'true' || process.env.PHASE3_SCHEMA_APPROVED !== 'true') throw Error('PHASE3_LIVE_EXECUTION_NOT_APPROVED');
  const { gatewayConfig } = await import('../src/payments/sslcommerz.js');
  const config = gatewayConfig({ DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, SSLCOMMERZ_ENABLED: 'true', SSLCOMMERZ_SANDBOX: 'true', SSLCOMMERZ_SCHEMA_VERIFIED: 'true', EMAIL_DELIVERY_ENABLED: 'false', SSLCOMMERZ_STORE_ID: 'synthetic-ledger-only', SSLCOMMERZ_STORE_PASSWORD: 'synthetic-no-provider-calls', SSLCOMMERZ_STORAGE_KEY: randomBytes(32).toString('base64'), SSLCOMMERZ_CALLBACK_BASE_URL: 'https://not-exposed.example.invalid', FRONTEND_URL: 'http://localhost:3000', SSLCOMMERZ_REFUNDS_APPROVED: 'true' });
  const base = resolve(process.env.PHASE3_LEDGER_EVIDENCE_DIR || '');
  if (!process.env.PHASE3_LEDGER_EVIDENCE_DIR || !base.startsWith(resolve(__dirname, '../../output/phase3') + sep)) throw Error('PHASE3_EVIDENCE_DIRECTORY_REQUIRED');
  if (!process.env.PHASE3_SYNTHETIC_PASSWORD || process.env.PHASE3_SYNTHETIC_PASSWORD.length < 16 || Buffer.byteLength(process.env.PHASE3_SYNTHETIC_PASSWORD, 'utf8') > 72) throw Error('PHASE3_PRIVATE_SYNTHETIC_PASSWORD_REQUIRED');
  mkdirSync(base, { recursive: true });
  const contract = JSON.parse(readFileSync(resolve(base, 'test-contract.json'), 'utf8')) as { checks: string[] };
  if (!Array.isArray(contract.checks) || contract.checks.some(id => typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) || new Set(contract.checks).size !== contract.checks.length) throw Error('PHASE3_PROOF_CONTRACT_INVALID');
  if (existsSync(resolve(base, 'proof-attempt.json')) || existsSync(resolve(base, 'proof-result.json')) || existsSync(resolve(base, 'ledger.jsonl'))) throw Error('PHASE3_EXISTING_PROOF_NO_RETRY');
  const users = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const roles = ['CUSTOMER', 'CUSTOMER', 'STAFF', 'ADMIN'] as const;
  const bookings = [randomUUID(), randomUUID()], passengers = [randomUUID(), randomUUID()], initialHistory = [randomUUID(), randomUUID()];
  const references = bookings.map(id => 'FWS-P3-' + id.slice(0, 8).toUpperCase());
  const fixture = { users: users.map((id, i) => ({ id, role: roles[i], email: `${id}@example.invalid` })), bookings, passengers, initialHistory, references };
  writeFileSync(resolve(base, 'proof-attempt.json'), JSON.stringify({ startedUTC: new Date().toISOString(), provider: 'MOCK_ONLY', fixtures: fixture, noCleanup: true }), { flag: 'wx' });
  const journal = (record: object) => appendFileSync(resolve(base, 'ledger.jsonl'), JSON.stringify(record) + '\n');
  const checker = paymentProofChecks(journal), check = checker.check;
  const started = performance.now(); let stage = 'identity';
  const step = (value: string) => { if (performance.now() - started > 45_000) throw Error('PHASE3_PRE_DISPATCH_BUDGET_EXHAUSTED'); stage = value; journal({ kind: 'stage', stage }); };
  const completeGroup = async <T,>(promises: Promise<T>[]) => { const settled = await Promise.allSettled(promises); const failure = settled.find(r => r.status === 'rejected'); if (failure?.status === 'rejected') { journal({ kind: 'group-failure', ...paymentProofFailure(failure.reason) }); throw failure.reason; } return settled.map(r => (r as PromiseFulfilledResult<T>).value); };
  vi.stubGlobal('fetch', async () => { throw Error('PHASE3_EXTERNAL_HTTP_FORBIDDEN'); });
  const { prisma } = await import('../src/lib/prisma.js');
  const { Prisma } = await import('../src/generated/prisma/client.js');
  const { PaymentService } = await import('../src/payments/payment.service.js');
  const { PrismaPaymentStore } = await import('../src/payments/payment-store.js');
  let proofPassed = false, failure: object | null = null, releaseFence: (() => void) | undefined;
  const admission = new AbortController();
  const deadline = setTimeout(() => { admission.abort(); releaseFence?.(); }, 45_000);
  const admit = () => { if (admission.signal.aborted) throw Error('PHASE3_CANCELLED_NO_LATE_DISPATCH'); };
  const pending: Promise<unknown>[] = [];
  const owner = { id: users[0], role: 'CUSTOMER' as const }, other = { id: users[1], role: 'CUSTOMER' as const }, staff = { id: users[2], role: 'STAFF' as const }, admin = { id: users[3], role: 'ADMIN' as const };
  const billing = { requestId: randomUUID(), address: 'Synthetic test address', city: 'Synthetic test city', country: 'BD' };
  const signalRollback = () => Object.assign(Error('Synthetic rollback'), { code: 'SYNTHETIC_ROLLBACK' });
  const fault = async (operation: () => Promise<unknown>) => { admit(); try { await operation(); return null; } catch (e) { return paymentProofFailure(e); } };
  const baseline = async () => ({
    users: await prisma.user.findMany({ where: { id: { notIn: users } }, select: { id: true, role: true, updatedAt: true }, orderBy: { id: 'asc' } }),
    bookings: await prisma.booking.findMany({ where: { id: { notIn: bookings } }, select: { id: true, status: true, updatedAt: true }, orderBy: { id: 'asc' } }),
    sessions: await prisma.session.findMany({ select: { id: true, userId: true, revokedAt: true, expiresAt: true }, orderBy: { id: 'asc' } }),
    outbox: await prisma.notificationOutbox.findMany({ select: { id: true, status: true, updatedAt: true }, orderBy: { id: 'asc' } }),
    migrations: await prisma.$queryRaw<Array<{ migration_name: string; checksum: string }>>(Prisma.sql`SELECT migration_name,checksum FROM public._prisma_migrations ORDER BY migration_name`),
  });
  const ownedOutbox = async () => prisma.$queryRaw<Array<{ id: string; status: string; linked: boolean }>>(Prisma.sql`
    SELECT o.id,o.status,EXISTS(SELECT FROM public."Booking" b WHERE b.id IN (${bookings[0]},${bookings[1]}) AND o.payload->'params'->>'referenceNumber'=b."referenceNumber") AS linked
    FROM public."NotificationOutbox" o WHERE EXISTS(
      SELECT FROM public."GatewayPayment" p WHERE p."bookingId" IN (${bookings[0]},${bookings[1]}) AND
      (o."idempotencyKey" LIKE 'gateway:%'||p.id||'%' OR EXISTS(SELECT FROM public."GatewayRefund" r WHERE r."paymentId"=p.id AND o."idempotencyKey" LIKE 'gateway:%'||r.id||'%')))
    ORDER BY o.id`);
  try {
    const identity = await prisma.$queryRaw<Array<{ db: string; role: string; oid: number; host: string; port: number }>>(Prisma.sql`SELECT current_database() AS db,current_user AS role,(SELECT oid::int FROM pg_database WHERE datname=current_database()) AS oid,host(inet_server_addr()) AS host,inet_server_port() AS port`);
    check('exact-local-identity', identity.length === 1 && identity[0].db === 'flywithsafety_local_integration' && identity[0].role === 'flywithsafe_phase2_booking_test' && identity[0].oid === 34701 && identity[0].host === '127.0.0.1' && identity[0].port === 5432, true);
    const catalog = await prisma.$queryRaw<Array<{ tables: number; indexes: number; triggers: number; foreignkeys: number }>>(Prisma.sql`SELECT
      (SELECT count(*)::int FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('GatewayPayment','GatewayPaymentEvent','GatewayRefund') AND relkind='r') AS tables,
      (SELECT count(*)::int FROM pg_index WHERE indrelid IN ('public."GatewayPayment"'::regclass,'public."GatewayPaymentEvent"'::regclass,'public."GatewayRefund"'::regclass) AND indisvalid AND indisready) AS indexes,
      (SELECT count(*)::int FROM pg_trigger WHERE tgrelid IN ('public."GatewayPayment"'::regclass,'public."GatewayRefund"'::regclass) AND NOT tgisinternal AND tgenabled='O') AS triggers,
      (SELECT count(*)::int FROM pg_constraint WHERE conrelid IN ('public."GatewayPayment"'::regclass,'public."GatewayPaymentEvent"'::regclass,'public."GatewayRefund"'::regclass) AND contype='f' AND convalidated AND confdeltype='r') AS foreignkeys`);
    check('catalog-three-tables', catalog[0].tables, 3); check('catalog-fourteen-indexes', catalog[0].indexes, 14); check('catalog-two-triggers', catalog[0].triggers, 2); check('catalog-four-restrict-fks', catalog[0].foreignkeys, 4);
    const before = await baseline(); check('eight-migrations', before.migrations.length, 8);
    const empty = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`SELECT ((SELECT count(*) FROM public."GatewayPayment")+(SELECT count(*) FROM public."GatewayRefund")+(SELECT count(*) FROM public."GatewayPaymentEvent"))::int AS count`);
    check('fresh-payment-ledgers-empty', empty[0].count, 0);
    journal({ kind: 'planned-fixtures', ...fixture, existingUserCount: before.users.length, existingSessionCount: before.sessions.length, syntheticOnly: true });
    step('fixture-creation');
    const passwordHash = await bcrypt.hash(process.env.PHASE3_SYNTHETIC_PASSWORD, 12); delete process.env.PHASE3_SYNTHETIC_PASSWORD;
    admit();
    await prisma.$transaction(async tx => {
      for (let i = 0; i < users.length; i++) { admit(); await tx.user.create({ data: { id: users[i], email: `${users[i]}@example.invalid`, name: 'Synthetic Phase3 ' + roles[i], role: roles[i], password: passwordHash, emailVerified: true } }); }
      for (let i = 0; i < bookings.length; i++) { admit(); await tx.booking.create({ data: { id: bookings[i], referenceNumber: references[i], userId: owner.id, customerName: 'Synthetic Phase3 Owner', customerEmail: `${owner.id}@example.invalid`, customerPhone: '01000000000', totalPrice: 12000, currency: 'BDT', bookingDetails: { integrationFixture: { phase: 3, provider: "MOCK_ONLY" }, commercial: { version: 1, revision: 2, quotes: [{ id: randomUUID(), amount: 12000, currency: 'BDT', description: 'Synthetic assisted service; no supplier operation', validUntil: new Date(Date.now() + 3600000).toISOString(), createdAt: new Date().toISOString(), acceptedAt: new Date().toISOString() }], payments: [], receipts: [] } }, passengers: { create: { id: passengers[i], firstName: 'Synthetic', lastName: 'Traveller', passengerType: 'adult' } }, statusHistory: { create: { id: initialHistory[i], fromStatus: 'PENDING', toStatus: 'PENDING', changedBy: owner.id, reason: 'Synthetic Phase3 accepted-quote fixture prestate; no provider action' } } } }); }
      admit();
    });
    journal({ kind: 'fixtures-committed', ...fixture });
    const calls = { initiate: 0, validate: 0, query: 0, refund: 0 };
    let mode: 'good' | 'unavailable' | 'amount' | 'currency' | 'transaction' | 'risk' | 'failed' | 'validated' = 'good';
    const riskTransactions = new Set<string>();
    const evidence = (tranId: string): Evidence => ({ status: mode === 'failed' ? 'FAILED' : mode === 'validated' ? 'VALIDATED' : 'VALID', tranId, amountMinor: '1200000', currency: 'BDT', valId: 'V' + tranId, bankId: 'B' + tranId, risk: riskTransactions.has(tranId) || mode === 'risk' });
    let queryGate: (() => Promise<void>) | undefined, refundOutcome: 'processing' | 'refunded' = 'processing';
    const gateway: Gateway = {
      async initiate(tranId, _amount, customer) { calls.initiate++; if (customer.product.endsWith(references[1])) riskTransactions.add(tranId); return { sessionKey: 'synthetic-session', url: 'https://sandbox.sslcommerz.com/checkout', channels: [] }; },
      async query(tranId) { calls.query++; if (queryGate) { const gate = queryGate; queryGate = undefined; await gate(); } return [evidence(tranId)]; },
      async validate(valId) { calls.validate++; if (mode === 'unavailable') throw Error('SYNTHETIC_PROVIDER_UNAVAILABLE'); const e = evidence(valId.slice(1)); return { ...e, ...(mode === 'amount' ? { amountMinor: '1' } : mode === 'currency' ? { currency: 'USD' } : mode === 'transaction' ? { tranId: 'other-synthetic-transaction' } : {}) }; },
      async refund(bankId) { calls.refund++; return { reference: 'R' + bankId, tranId: bankId.slice(1) }; },
      async refundStatus(reference) { return { status: refundOutcome, bankId: reference.slice(1), tranId: reference.slice(2), amountMinor: '700000' }; },
    };
    const underlying = new PrismaPaymentStore();
    const store: PaymentStore = { locate: t => underlying.locate(t), due: n => underlying.due(n), operations: () => underlying.operations(),
      async transaction<T>(ref: string, action: (ledger: import('../src/payments/payment-store.js').Ledger) => Promise<T>) {
        admit(); return underlying.transaction(ref, async ledger => { admit(); const value = await action(ledger); admit(); return value; });
      },
    }; let ackLost = false;
    const ackStore: PaymentStore = { locate: t => store.locate(t), due: n => store.due(n), operations: () => store.operations(),
      async transaction<T>(ref: string, action: Parameters<PaymentStore['transaction']>[1]): Promise<T> {
        let sessionCommit = false;
        const result = await store.transaction(ref, async l => { const save = l.save; l.save = async a => { sessionCommit ||= a.status === 'SESSION_READY'; await save(a); }; return action(l); });
        if (sessionCommit && !ackLost) { ackLost = true; throw Error('SIMULATED_APPLICATION_COMMIT_ACK_LOSS'); } return result as T;
      },
    };
    const service = new PaymentService(ackStore, gateway, config), restarted = new PaymentService(store, gateway, config);
    step('ownership-and-idempotency');
    check('other-customer-initiation-denied', (await fault(() => service.initiate(references[0], other, billing)))?.appCode === 'NOT_FOUND', true);
    check('staff-initiation-denied', (await fault(() => service.initiate(references[0], staff, billing)))?.appCode === 'NOT_FOUND', true);
    check('client-price-tampering-denied', (await fault(() => service.initiate(references[0], owner, { ...billing, amountMinor: '1' } as typeof billing))) !== null, true);
    step('eight-contender-initiation');
    const initiated = await completeGroup(Array.from({ length: 8 }, () => service.initiate(references[0], owner, billing)));
    check('one-intent-eight-contenders', new Set(initiated.map(r => r.payment.id)).size, 1); check('one-initiation-dispatch', calls.initiate, 1); check('application-ack-loss-injected-after-commit', ackLost, true);
    const replay = await restarted.initiate(references[0], owner, billing); check('durable-session-replay', replay.payment.status === 'SESSION_READY' && !!replay.checkoutUrl, true); check('no-reinit-on-replay', calls.initiate, 1);
    check('changed-request-payload-denied', (await fault(() => service.initiate(references[0], owner, { ...billing, city: 'Changed synthetic city' })))?.appCode === 'CONFLICT', true);
    const saved = await prisma.$queryRaw<Array<{ tranId: string }>>(Prisma.sql`SELECT "tranId" FROM public."GatewayPayment" WHERE "bookingId"=${bookings[0]}`), tranId = saved[0].tranId;
    journal({ kind: 'owned-payment', id: replay.payment.id, bookingId: bookings[0], tranId });
    const activeConstraint = await fault(() => store.transaction(references[0], async l => { const id = randomUUID(); journal({ kind: 'rollback-only-payment-id', id }); await l.save({ ...l.attempts[0], id, requestId: randomUUID(), tranId: 'FWS' + randomBytes(13).toString('hex') }); throw signalRollback(); }));
    check('database-one-active-booking-index', activeConstraint?.sqlState === '23505', true);
    const missingParent = await fault(() => store.transaction(references[0], async l => { await l.event(randomUUID(), 'rollback-only-' + randomUUID(), 'FK_PROBE', admin.id); throw signalRollback(); }));
    check('database-payment-event-foreign-key', missingParent?.sqlState === '23503', true);
    step('duplicate-notices-and-authority');
    await completeGroup(Array.from({ length: 8 }, (_, i) => restarted.notify(tranId, 'V' + tranId, i % 2 ? 'ipn' : 'success')));
    const notices = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`SELECT count(*)::int AS count FROM public."GatewayPaymentEvent" WHERE "paymentId"=${replay.payment.id} AND kind='NOTICE'`);
    check('eight-notices-two-durable-identities', notices[0].count, 2); check('fake-success-not-paid', (await restarted.list(references[0], owner)).payments[0].captured, false);
    for (const failureMode of ['unavailable', 'amount', 'currency', 'transaction'] as const) { step('validation-' + failureMode); mode = failureMode; await restarted.reconcile(references[0], admin); check(failureMode + '-cannot-authorize-capture', (await restarted.list(references[0], owner)).payments[0].captured, false); }
    mode = 'good'; step('validation-race');
    await completeGroup(Array.from({ length: 8 }, () => restarted.reconcile(references[0], admin)));
    let view = await restarted.list(references[0], owner); check('validated-capture-persisted', view.payments[0].captured, true); check('validated-state', view.payments[0].status === 'VERIFIED', true);
    const captures = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`SELECT count(*)::int AS count FROM public."GatewayPaymentEvent" WHERE "paymentId"=${replay.payment.id} AND kind='VERIFIED'`); check('one-capture-audit', captures[0].count, 1);
    mode = 'validated'; await restarted.reconcile(references[0], admin); mode = 'good';
    const replayedCapture = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`SELECT count(*)::int AS count FROM public."GatewayPaymentEvent" WHERE "paymentId"=${replay.payment.id} AND kind='VERIFIED'`);
    check('validated-replay-one-financial-effect', replayedCapture[0].count, 1);
    check('other-customer-read-denied', (await fault(() => restarted.list(references[0], other)))?.appCode === 'NOT_FOUND', true); check('customer-recheck-denied', (await fault(() => restarted.reconcile(references[0], owner)))?.appCode === 'FORBIDDEN', true);
    mode = 'failed'; await restarted.reconcile(references[0], admin); check('stale-failure-does-not-downgrade', (await restarted.list(references[0], owner)).payments[0].status === 'VERIFIED', true); mode = 'good';
    step('expired-worker-fence');
    let startedQuery!: () => void; const entered = new Promise<void>(r => { startedQuery = r; }); const blocked = new Promise<void>(r => { releaseFence = r; }); queryGate = async () => { startedQuery(); await blocked; };
    const stale = restarted.reconcile(references[0], admin); pending.push(stale); void stale.catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([entered, new Promise<never>((_r, reject) => { timer = setTimeout(() => reject(Error('FENCE_RENDEZVOUS_INCONCLUSIVE')), 5000); })]); } finally { clearTimeout(timer); }
    await store.transaction(references[0], async l => { await l.save({ ...l.attempts[0], lease: { owner: l.attempts[0].lease!.owner, until: l.now - 1 } }); });
    check('booking-lock-released-during-provider-wait', true, true);
    await restarted.reconcile(references[0], admin); mode = 'risk'; releaseFence?.(); await completeGroup([stale]); mode = 'good'; releaseFence = undefined;
    check('expired-owner-cannot-publish-risk-result', (await restarted.list(references[0], owner)).payments[0].status === 'VERIFIED', true);
    step('atomic-outbox-rollback');
    const histories = await prisma.bookingStatusHistory.count({ where: { bookingId: bookings[0] } });
    const duplicateOutbox = await fault(() => store.transaction(references[0], async l => { const changed = { ...l.attempts[0], status: 'EXCEPTION_REVIEW' as const }; await l.save(changed); await l.publish(changed, `capture:${changed.id}:VERIFIED`); }));
    check('duplicate-outbox-exact-constraint-rejection', duplicateOutbox?.prismaCode === 'P2002' || duplicateOutbox?.sqlState === '23505', true);
    check('capture-state-rolled-back', (await restarted.list(references[0], owner)).payments[0].status === 'VERIFIED', true); check('history-rolled-back-with-outbox', await prisma.bookingStatusHistory.count({ where: { bookingId: bookings[0] } }), histories);
    const immutable = await fault(() => prisma.$transaction(async tx => { await tx.$executeRaw(Prisma.sql`UPDATE public."GatewayPayment" SET state=jsonb_set(state,'{amountMinor}','"1"'::jsonb) WHERE id=${replay.payment.id}`); throw signalRollback(); }));
    check('database-immutable-money-trigger', immutable?.sqlState === '23514', true);
    step('risk-payment');
    const riskRace = await Promise.allSettled(Array.from({ length: 8 }, () => restarted.initiate(references[1], owner, { ...billing, requestId: randomUUID() })));
    check('one-distinct-key-risk-intent-wins', riskRace.filter(r => r.status === 'fulfilled').length, 1);
    check('competing-distinct-key-intents-denied', riskRace.filter(r => r.status === 'rejected').every(r => r.status === 'rejected' && paymentProofFailure(r.reason).appCode === 'CONFLICT'), true);
    await restarted.reconcile(references[1], admin);
    const riskView = await restarted.list(references[1], owner); check('authoritative-high-risk-hold', riskView.payments[0].status === 'RISK_REVIEW' && riskView.payments[0].captured, true); check('two-fixtures-two-provider-initiation-doubles', calls.initiate, 2);
    check('staff-risk-queue-authorized', (await restarted.operations(staff)).entries.some(e => e.reference === references[1]), true);
    check('customer-operations-queue-denied', (await fault(() => restarted.operations(owner)))?.appCode === 'FORBIDDEN', true);
    step('refund-reservation-race');
    const refundKeys = [randomUUID(), randomUUID()], refundInput = { paymentId: replay.payment.id, amountMinor: '700000', reason: 'Synthetic partial refund reservation proof' };
    check('staff-refund-denied', (await fault(() => restarted.refund(references[0], staff, { ...refundInput, requestId: randomUUID() })))?.appCode === 'FORBIDDEN', true);
    const refundResults = await Promise.allSettled(refundKeys.map(requestId => restarted.refund(references[0], admin, { ...refundInput, requestId })));
    check('one-refund-reservation-wins', refundResults.filter(r => r.status === 'fulfilled').length, 1); check('one-refund-provider-dispatch-double', calls.refund, 1);
    const loser = refundResults.find(r => r.status === 'rejected'); check('over-refund-application-guard', loser?.status === 'rejected' && paymentProofFailure(loser.reason).appCode === 'CONFLICT', true);
    const winner = refundResults.findIndex(r => r.status === 'fulfilled'); await restarted.refund(references[0], admin, { ...refundInput, requestId: refundKeys[winner] }); check('refund-replay-no-second-dispatch', calls.refund, 1);
    view = await restarted.list(references[0], owner); check('refund-initiation-is-not-completion', view.refunds[0].status === 'PROCESSING', true);
    const reserved = await fault(() => store.transaction(references[0], async l => { const r = l.refunds[0], id = 'R' + randomBytes(14).toString('hex'); journal({ kind: 'rollback-only-refund-id', id }); await l.saveRefund({ ...r, id, requestId: randomUUID(), digest: 'synthetic-rollback-only', amountMinor: '600000', status: 'INITIATING', reference: undefined }); throw signalRollback(); }));
    check('database-refund-balance-trigger', reserved?.sqlState === '23514', true);
    const reusedReference = await fault(() => store.transaction(references[0], async l => { const r = l.refunds[0], id = 'R' + randomBytes(14).toString('hex'); journal({ kind: 'rollback-only-refund-reference-id', id }); await l.saveRefund({ ...r, id, requestId: randomUUID(), digest: 'synthetic-reference-reuse', amountMinor: '100' }); throw signalRollback(); }));
    check('database-provider-refund-reference-unique', reusedReference?.sqlState === '23505', true);
    await restarted.reconcile(references[0], admin); check('processing-status-not-refunded', (await restarted.list(references[0], owner)).refunds[0].status === 'PROCESSING', true);
    refundOutcome = 'refunded'; await restarted.reconcile(references[0], admin); view = await restarted.list(references[0], owner);
    check('refund-status-confirmed-through-double', view.refunds[0].status === 'REFUNDED', true); check('partial-refund-operations-hold', view.payments[0].financialState === 'PARTIALLY_REFUNDED' && view.payments[0].fulfillment === 'REFUND_REVIEW', true);
    const historyAfterRefund = await prisma.bookingStatusHistory.count({ where: { bookingId: bookings[0] } }); await restarted.reconcile(references[0], admin); check('refund-acknowledgement-dedupes-history', await prisma.bookingStatusHistory.count({ where: { bookingId: bookings[0] } }), historyAfterRefund);
    step('final-invariants');
    const books = await prisma.booking.findMany({ where: { id: { in: bookings } }, select: { status: true } }); check('no-supplier-fulfillment', books.length === 2 && books.every(b => b.status === 'PENDING'), true);
    const notifications = await ownedOutbox(), staffCount = Math.min(20, await prisma.user.count({ where: { role: { in: ['STAFF', 'ADMIN'] } } }));
    check('five-atomic-outbox-effect-groups', notifications.length, 5 * (staffCount + 1)); check('outbox-includes-payment-and-refund-links', notifications.every(n => n.linked), true); check('no-smtp-delivery-inferred', notifications.every(n => n.status === 'PENDING'), true);
    const after = await baseline(), ownedIds = new Set(notifications.map(n => n.id));
    check('all-unlisted-users-preserved', JSON.stringify(after.users) === JSON.stringify(before.users), true); check('all-unlisted-bookings-preserved', JSON.stringify(after.bookings) === JSON.stringify(before.bookings), true); check('all-existing-sessions-preserved', JSON.stringify(after.sessions) === JSON.stringify(before.sessions), true);
    check('unlisted-outbox-preserved', JSON.stringify(after.outbox.filter(n => !ownedIds.has(n.id))) === JSON.stringify(before.outbox), true); check('all-eight-migration-rows-preserved', JSON.stringify(after.migrations) === JSON.stringify(before.migrations), true);
    journal({ kind: 'provider-doubles-only', calls, physicalProcessRestartTested: false, physicalWireAckLossTested: false, smtpCalled: false });
    if (checker.results.length !== contract.checks.length || contract.checks.some(id => !checker.results.some(r => r.id === id && r.passed))) throw Error('PHASE3_PROOF_CONTRACT_INCOMPLETE');
    proofPassed = true;
  } catch (e) { failure = { stage, checkId: [...checker.results].reverse().find(c => !c.passed)?.id ?? null, ...paymentProofFailure(e) }; }
  finally {
    clearTimeout(deadline); admission.abort();
    releaseFence?.(); await Promise.allSettled(pending);
    let snapshotPassed = false, disconnected = false;
    try {
      const rows = await prisma.$queryRaw<Array<{ kind: string; id: string }>>(Prisma.sql`
        SELECT 'User' AS kind,id FROM public."User" WHERE id IN (${users[0]},${users[1]},${users[2]},${users[3]})
        UNION ALL SELECT 'Booking',id FROM public."Booking" WHERE id IN (${bookings[0]},${bookings[1]})
        UNION ALL SELECT 'BookingPassenger',id FROM public."BookingPassenger" WHERE "bookingId" IN (${bookings[0]},${bookings[1]})
        UNION ALL SELECT 'BookingStatusHistory',id FROM public."BookingStatusHistory" WHERE "bookingId" IN (${bookings[0]},${bookings[1]})
        UNION ALL SELECT 'GatewayPayment',id FROM public."GatewayPayment" WHERE "bookingId" IN (${bookings[0]},${bookings[1]})
        UNION ALL SELECT 'GatewayRefund',r.id FROM public."GatewayRefund" r JOIN public."GatewayPayment" p ON p.id=r."paymentId" WHERE p."bookingId" IN (${bookings[0]},${bookings[1]})
        UNION ALL SELECT 'GatewayPaymentEvent',e.id FROM public."GatewayPaymentEvent" e JOIN public."GatewayPayment" p ON p.id=e."paymentId" WHERE p."bookingId" IN (${bookings[0]},${bookings[1]})`);
      journal({ kind: 'final-owned-row-ids', rows: rows.concat((await ownedOutbox()).map(n => ({ kind: 'NotificationOutbox', id: n.id }))) }); snapshotPassed = true;
    } catch (e) { journal({ kind: 'final-owned-row-read-incomplete', ...paymentProofFailure(e) }); }
    try { await prisma.$disconnect(); disconnected = true; } catch (e) { journal({ kind: 'disconnect-incomplete', ...paymentProofFailure(e) }); }
    delete process.env.PHASE3_SYNTHETIC_PASSWORD; vi.unstubAllGlobals();
    const unexecutedCheckIds = contract.checks.filter(id => !checker.results.some(r => r.id === id));
    const result = { passed: proofPassed && snapshotPassed && disconnected, proofPassed, snapshotPassed, disconnected, failure, plannedChecks: contract.checks.length, checked: checker.results.length, checksPassed: checker.results.filter(c => c.passed).length, checksFailed: checker.results.filter(c => !c.passed).length, unexecutedChecks: unexecutedCheckIds.length, unexecutedCheckIds, checks: checker.results, provider: 'MOCK_ONLY', realPostgres: true, fixturesRetained: true, fixture, noRetry: true, elapsedMs: Math.round(performance.now() - started) };
    writeFileSync(resolve(base, 'proof-result.json'), JSON.stringify(result), { flag: 'wx' });
    if (!result.passed) throw Error('PHASE3_LEDGER_STOP ' + JSON.stringify({ stage, failure, checksPassed: result.checksPassed, checksFailed: result.checksFailed, snapshotPassed, disconnected }));
  }
}, 60000);
