/** PREPARED / NOT EXECUTED. Real PostgreSQL, mocked provider. Not genuine sandbox payment evidence. */
import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { errorDataField } from '../src/utils/error-fields.js';
import { prisma } from '../src/lib/prisma.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { gatewayConfig, type Gateway } from '../src/payments/sslcommerz.js';
import { PaymentService } from '../src/payments/payment.service.js';
import { PrismaPaymentStore } from '../src/payments/payment-store.js';

it('restricted PostgreSQL intent/capture/refund races and rollback preserve owned fixture ledger', async () => {
  if (process.env.PHASE3_LEDGER_OWNER_APPROVED !== 'true' || process.env.PHASE3_SCHEMA_APPROVED !== 'true') throw Error('PHASE3_LIVE_EXECUTION_NOT_APPROVED');
  const config = gatewayConfig({ ...process.env, SSLCOMMERZ_ENABLED: 'true', SSLCOMMERZ_SANDBOX: 'true', SSLCOMMERZ_SCHEMA_VERIFIED: 'true', EMAIL_DELIVERY_ENABLED: 'false', SSLCOMMERZ_STORE_ID: 'synthetic-ledger-only', SSLCOMMERZ_STORE_PASSWORD: 'synthetic-no-provider-calls', SSLCOMMERZ_STORAGE_KEY: Buffer.alloc(32, 23).toString('base64'), SSLCOMMERZ_CALLBACK_BASE_URL: 'https://not-exposed.example.invalid', FRONTEND_URL: 'http://localhost:3000', SSLCOMMERZ_REFUNDS_APPROVED: 'true' });
  const base = resolve(process.env.PHASE3_LEDGER_EVIDENCE_DIR || '');
  if (!process.env.PHASE3_LEDGER_EVIDENCE_DIR || !base.startsWith(resolve('output/phase3') + sep)) throw Error('PHASE3_EVIDENCE_DIRECTORY_REQUIRED');
  mkdirSync(base, { recursive: true });
  if (existsSync(resolve(base, 'attempt.json'))) throw Error('PHASE3_EXISTING_ATTEMPT_NO_RETRY');
  const userId = randomUUID(), adminId = randomUUID(), bookingId = randomUUID(), quoteId = randomUUID(), requestId = randomUUID(), reference = 'FWS-P3-' + randomUUID().slice(0, 8).toUpperCase();
  writeFileSync(resolve(base, 'attempt.json'), JSON.stringify({ started: new Date().toISOString(), database: 'flywithsafety_local_integration', restrictedRole: 'flywithsafe_phase2_booking_test', userId, adminId, bookingId, reference, noCleanup: true }), { flag: 'wx' });
  const journal = (event: object) => appendFileSync(resolve(base, 'ledger.jsonl'), JSON.stringify(event) + '\n');
  let stage = 'identity';
  let proofPassed = false;
  let failure: object | null = null;
  try {
    const identity = await prisma.$queryRaw<Array<{ db: string; role: string; oid: number }>>(Prisma.sql`SELECT current_database() AS db,current_user AS role,(SELECT oid::int FROM pg_database WHERE datname=current_database()) AS oid`);
    expect(identity).toEqual([{ db: 'flywithsafety_local_integration', role: 'flywithsafe_phase2_booking_test', oid: 34701 }]);
    const unsafe = await prisma.$queryRaw<Array<{ unsafe: boolean }>>(Prisma.sql`SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR has_table_privilege(current_user,'public."GatewayPayment"','DELETE') OR has_table_privilege(current_user,'public."GatewayPaymentEvent"','UPDATE') OR has_schema_privilege(current_user,'public','CREATE') AS unsafe FROM pg_roles WHERE rolname=current_user`);
    expect(unsafe[0].unsafe).toBe(false);
    stage = 'migration-preflight';
    const migrations = await prisma.$queryRaw<Array<{ name: string }>>(Prisma.sql`SELECT migration_name AS name FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`);
    expect(migrations).toHaveLength(8); expect(migrations.some(r => r.name === '20261103000100_gateway_sandbox_ledgers')).toBe(true);
    stage = 'fixture'; journal({ kind: 'ownership-intent', userId, adminId, bookingId, reference });
    await prisma.$transaction(async tx => {
      await tx.user.create({ data: { id: userId, email: `${userId}@example.invalid`, name: 'Synthetic Phase3 Owner', role: 'CUSTOMER' } });
      await tx.user.create({ data: { id: adminId, email: `${adminId}@example.invalid`, name: 'Synthetic Phase3 Admin', role: 'ADMIN' } });
      await tx.booking.create({ data: { id: bookingId, referenceNumber: reference, userId, customerName: 'Synthetic Phase3 Owner', customerEmail: `${userId}@example.invalid`, customerPhone: '01000000000', totalPrice: 12000, currency: 'BDT', bookingDetails: { commercial: { version: 1, revision: 2, quotes: [{ id: quoteId, amount: 12000, currency: 'BDT', description: 'Synthetic assisted service', validUntil: new Date(Date.now() + 3600000).toISOString(), createdAt: new Date().toISOString(), acceptedAt: new Date().toISOString() }], payments: [], receipts: [] } } } });
    });
    journal({ kind: 'booking-committed', userId, adminId, bookingId, reference });
    let calls = 0, transaction = '';
    const validation = () => ({ status: 'VALID', tranId: transaction, amountMinor: '1200000', currency: 'BDT', valId: 'V-' + bookingId, bankId: 'B-' + bookingId, risk: false });
    const gateway: Gateway = {
      async initiate(tranId) { calls++; transaction = tranId; return { sessionKey: 'synthetic-session', url: 'https://sandbox.sslcommerz.com/checkout', channels: [] }; },
      async query() { return [validation()]; }, async validate() { return validation(); },
      async refund() { return { reference: 'R-' + bookingId, tranId: transaction }; }, async refundStatus() { return { status: 'processing', bankId: 'B-' + bookingId, tranId: transaction, amountMinor: '700000' }; },
    };
    const service = new PaymentService(new PrismaPaymentStore(), gateway, config), actor = { id: userId, role: 'CUSTOMER' as const };
    stage = 'initiation-race';
    const results = await Promise.all(Array.from({ length: 8 }, () => service.initiate(reference, actor, { requestId, address: 'Synthetic address', city: 'Synthetic city', country: 'BD' })));
    expect(new Set(results.map(r => r.payment.id)).size).toBe(1); expect(calls).toBe(1);
    journal({ kind: 'payment-owned', paymentId: results[0].payment.id, bookingId, transaction });
    stage = 'validation-race';
    await Promise.all(Array.from({ length: 8 }, () => service.reconcile(reference, { id: adminId, role: 'ADMIN' })));
    const snapshots = await service.list(reference, actor); expect(snapshots.payments[0].captured).toBe(true);
    const effects = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT count(*) AS count FROM public."GatewayPaymentEvent" WHERE "paymentId"=${results[0].payment.id} AND kind='VERIFIED'`);
    expect(Number(effects[0].count)).toBe(1);
    stage = 'capture-outbox-rollback';
    const beforeHistory = await prisma.bookingStatusHistory.count({ where: { bookingId } });
    const store = new PrismaPaymentStore();
    await expect(store.transaction(reference, async l => {
      const changed = { ...l.attempts[0], status: 'EXCEPTION_REVIEW' as const };
      await l.save(changed);
      // Existing outbox dedupe key intentionally rejects the duplicate effect; preceding state/history must roll back.
      await l.publish(changed, `capture:${changed.id}:VERIFIED`);
    })).rejects.toThrow();
    expect((await service.list(reference, actor)).payments[0].status).toBe('VERIFIED');
    expect(await prisma.bookingStatusHistory.count({ where: { bookingId } })).toBe(beforeHistory);
    stage = 'refund-race';
    const refunded = await Promise.allSettled([randomUUID(), randomUUID()].map(key => service.refund(reference, { id: adminId, role: 'ADMIN' }, { requestId: key, paymentId: results[0].payment.id, amountMinor: '700000', reason: 'Synthetic reservation race' })));
    expect(refunded.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    stage = 'rollback'; const rollbackKey = 'rollback-' + randomUUID();
    await expect(prisma.$transaction(async tx => { await tx.$executeRaw(Prisma.sql`INSERT INTO public."GatewayPaymentEvent" (id,"paymentId",kind,actor,data) VALUES (${rollbackKey},${results[0].payment.id},'ROLLBACK_PROBE','TEST','{}'::jsonb)`); throw Error('SYNTHETIC_EXPECTED_ROLLBACK'); })).rejects.toThrow('SYNTHETIC_EXPECTED_ROLLBACK');
    const rollbackRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM public."GatewayPaymentEvent" WHERE id=${rollbackKey}`); expect(rollbackRows).toHaveLength(0);
    const ledger = await prisma.$queryRaw<Array<{ id: string; kind: string }>>(Prisma.sql`SELECT e.id,e.kind FROM public."GatewayPaymentEvent" e JOIN public."GatewayPayment" p ON p.id=e."paymentId" WHERE p."bookingId"=${bookingId} ORDER BY e.id`);
    journal({ kind: 'final-events', events: ledger });
    proofPassed = true;
  } catch (e) {
    const rawCode = errorDataField(e, 'code'), code = typeof rawCode === 'string' && /^(P\d{4}|[0-9A-Z]{5})$/.test(rawCode) ? rawCode : null;
    const primitive = (v: unknown) => typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v) || v === null ? v : undefined;
    failure = { stage, code, expected: primitive(errorDataField(e, 'expected')), observed: primitive(errorDataField(e, 'actual')) };
  } finally {
    let snapshotPassed = false, disconnected = false;
    try {
      const owned = await prisma.$queryRaw<Array<{ kind: string; id: string }>>(Prisma.sql`
        SELECT 'User' AS kind,id FROM public."User" WHERE id IN (${userId},${adminId})
        UNION ALL SELECT 'Booking',id FROM public."Booking" WHERE id=${bookingId}
        UNION ALL SELECT 'GatewayPayment',id FROM public."GatewayPayment" WHERE "bookingId"=${bookingId}
        UNION ALL SELECT 'GatewayRefund',r.id FROM public."GatewayRefund" r JOIN public."GatewayPayment" p ON p.id=r."paymentId" WHERE p."bookingId"=${bookingId}
        UNION ALL SELECT 'GatewayPaymentEvent',e.id FROM public."GatewayPaymentEvent" e JOIN public."GatewayPayment" p ON p.id=e."paymentId" WHERE p."bookingId"=${bookingId}
        UNION ALL SELECT 'BookingStatusHistory',id FROM public."BookingStatusHistory" WHERE "bookingId"=${bookingId}
        UNION ALL SELECT 'NotificationOutbox',o.id FROM public."NotificationOutbox" o JOIN public."GatewayPayment" p ON o."idempotencyKey" LIKE 'gateway:%'||p.id||'%' WHERE p."bookingId"=${bookingId}`);
      journal({ kind: 'final-owned-row-ids', rows: owned });
      snapshotPassed = true;
    } catch { journal({ kind: 'final-owned-row-read-incomplete' }); }
    try { await prisma.$disconnect(); disconnected = true; } catch { journal({ kind: 'disconnect-incomplete' }); }
    const passed = proofPassed && snapshotPassed && disconnected;
    writeFileSync(resolve(base, 'result.json'), JSON.stringify({ passed, proofPassed, snapshotPassed, disconnected, failure, provider: 'MOCK_ONLY', realPostgres: true, fixturesRetained: true, userId, adminId, bookingId, reference, noRetry: true }), { flag: 'wx' });
    if (!passed) throw Error('PHASE3_LEDGER_STOP_PRESERVE_EVIDENCE_NO_RETRY');
  }
}, 60000);
