import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { paymentView, type Attempt, type Booking, type Refund } from './payment-domain.js';
import { assertRecordScope } from '../identity/store.js';
import { identityContext, identityEnabled } from '../identity/policy.js';

export interface Ledger {
  booking: Booking; attempts: Attempt[]; refunds: Refund[]; now: number;
  history: Array<{ kind: string; createdAt: string }>;
  save(a: Attempt): Promise<void>; saveRefund(r: Refund): Promise<void>;
  event(paymentId: string, key: string, kind: string, actor: string, data?: Record<string, string | boolean>): Promise<boolean>;
  publish(a: Attempt, eventKey?: string): Promise<void>;
}
export interface PaymentStore {
  transaction<T>(reference: string, action: (l: Ledger) => Promise<T>): Promise<T>;
  locate(tranId: string): Promise<string | null>;
  due(limit: number): Promise<string[]>;
  operations(): Promise<Array<{ reference: string; paymentId: string; status: string; refundPending: boolean }>>;
}
/** Booking is always locked before its payment/refund rows. Provider I/O is forbidden in this callback. */
export class PrismaPaymentStore implements PaymentStore {
  constructor(private readonly database: typeof prisma = prisma) {}
  async transaction<T>(reference: string, action: (l: Ledger) => Promise<T>) {
    return this.database.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM public."Booking" WHERE "referenceNumber"=${reference} FOR UPDATE`);
      const booking = await tx.booking.findUnique({ where: { referenceNumber: reference } });
      if (!booking) throw AppError.notFound('Booking not found');
      if (identityEnabled() && identityContext.getStore()?.role === 'STAFF') await assertRecordScope(tx, 'booking', booking.id);
      const ar = await tx.$queryRaw<Array<{ state: Attempt }>>(Prisma.sql`SELECT state FROM public."GatewayPayment" WHERE "bookingId"=${booking.id} ORDER BY id FOR UPDATE`);
      const rr = await tx.$queryRaw<Array<{ state: Refund }>>(Prisma.sql`SELECT r.state FROM public."GatewayRefund" r JOIN public."GatewayPayment" p ON p.id=r."paymentId" WHERE p."bookingId"=${booking.id} ORDER BY r.id FOR UPDATE OF r`);
      // adapter-pg normalizes timestamptz offsets without adjusting wall time. Return
      // UTC timestamp-without-time-zone so admission/fencing uses the actual instant.
      const clock = await tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`);
      const history = await tx.$queryRaw<Array<{ kind: string; createdAt: Date }>>(Prisma.sql`SELECT e.kind,e."createdAt" AT TIME ZONE 'UTC' AS "createdAt" FROM public."GatewayPaymentEvent" e JOIN public."GatewayPayment" p ON p.id=e."paymentId" WHERE p."bookingId"=${booking.id} ORDER BY e."createdAt" DESC,e.id LIMIT 100`);
      const ledger: Ledger = {
        booking, attempts: ar.map(r => r.state), refunds: rr.map(r => r.state), now: +clock[0].now,
        history: history.map(e => ({ kind: e.kind, createdAt: e.createdAt.toISOString() })),
        async save(a) {
          const old = ledger.attempts.find(p => p.id === a.id);
          if (old && (old.tranId !== a.tranId || old.amountMinor !== a.amountMinor || old.userId !== a.userId || old.quoteId !== a.quoteId)) throw AppError.conflict('Immutable payment identity changed');
          await tx.$executeRaw(Prisma.sql`INSERT INTO public."GatewayPayment" (id,"bookingId","userId","requestId","tranId",status,"valId","bankId","dueAt",state) VALUES (${a.id},${a.bookingId},${a.userId},${a.requestId},${a.tranId},${a.status},${a.valId ?? null},${a.bankId ?? null},${a.due ? new Date(a.due) : null},${JSON.stringify(a)}::jsonb) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,"valId"=EXCLUDED."valId","bankId"=EXCLUDED."bankId","dueAt"=EXCLUDED."dueAt",state=EXCLUDED.state`);
          ledger.attempts = ledger.attempts.filter(p => p.id !== a.id).concat(a);
        },
        async saveRefund(r) {
          await tx.$executeRaw(Prisma.sql`INSERT INTO public."GatewayRefund" (id,"paymentId","requestId","actorId",state) VALUES (${r.id},${r.paymentId},${r.requestId},${r.actorId},${JSON.stringify(r)}::jsonb) ON CONFLICT (id) DO UPDATE SET state=EXCLUDED.state`);
          ledger.refunds = ledger.refunds.filter(p => p.id !== r.id).concat(r);
        },
        async event(paymentId, key, kind, actor, data = {}) {
          const count = await tx.$executeRaw(Prisma.sql`INSERT INTO public."GatewayPaymentEvent" (id,"paymentId",kind,actor,data) VALUES (${key},${paymentId},${kind},${actor},${JSON.stringify(data)}::jsonb) ON CONFLICT (id) DO NOTHING`);
          return count === 1;
        },
        async publish(a, eventKey = `capture:${a.id}:${a.status}`) {
          const summary = paymentView(a, ledger.refunds);
          const details = booking.bookingDetails && typeof booking.bookingDetails === 'object' && !Array.isArray(booking.bookingDetails) ? booking.bookingDetails as Record<string, Prisma.InputJsonValue> : {};
          await tx.booking.update({ where: { id: booking.id }, data: { bookingDetails: { ...details, gatewayPayment: { id: a.id, mode: 'sandbox', status: summary.financialState, fulfillment: summary.fulfillment } } } });
          await tx.bookingStatusHistory.create({ data: { bookingId: booking.id, fromStatus: booking.status, toStatus: booking.status, changedBy: 'SSLCOMMERZ_SANDBOX', reason: `Sandbox payment ${summary.financialState}; no supplier fulfillment` } });
          // Direct durable insert: missing outbox schema MUST roll back payment finalization, never send a fallback email.
          await tx.notificationOutbox.create({ data: { recipient: booking.customerEmail, subject: 'Sandbox payment update', payload: { template: 'BOOKING_STATUS', params: { to: booking.customerEmail, name: booking.customerName, referenceNumber: booking.referenceNumber, status: booking.status, reason: `Sandbox payment ${summary.financialState}; awaiting operations review` } }, idempotencyKey: `gateway:${eventKey}` } });
          const staff = await tx.user.findMany({ where: { role: { in: ['STAFF', 'ADMIN'] } }, select: { id: true, email: true, name: true }, take: 20, orderBy: { id: 'asc' } });
          for (const person of staff) await tx.notificationOutbox.create({ data: { recipient: person.email, subject: 'Sandbox payment operations review', payload: { template: 'BOOKING_STATUS', params: { to: person.email, name: person.name || 'Operations', referenceNumber: booking.referenceNumber, status: booking.status, reason: `Sandbox payment ${summary.financialState}; no supplier reservation or ticket has been issued` } }, idempotencyKey: `gateway:${eventKey}:staff:${person.id}` } });
        },
      };
      return action(ledger);
    }, { maxWait: 5000, timeout: 10_000 });
  }
  async locate(tranId: string) {
    const rows = await this.database.$queryRaw<Array<{ referenceNumber: string }>>(Prisma.sql`SELECT b."referenceNumber" FROM public."GatewayPayment" p JOIN public."Booking" b ON b.id=p."bookingId" WHERE p."tranId"=${tranId}`);
    return rows[0]?.referenceNumber ?? null;
  }
  async due(limit: number) {
    const rows = await this.database.$queryRaw<Array<{ referenceNumber: string }>>(Prisma.sql`SELECT DISTINCT b."referenceNumber" FROM public."GatewayPayment" p JOIN public."Booking" b ON b.id=p."bookingId" WHERE p."dueAt" <= clock_timestamp() ORDER BY b."referenceNumber" LIMIT ${Math.min(20, Math.max(1, limit))}`);
    return rows.map(r => r.referenceNumber);
  }
  async operations() {
    return this.database.$queryRaw<Array<{ reference: string; paymentId: string; status: string; refundPending: boolean }>>(Prisma.sql`
      SELECT b."referenceNumber" AS reference,p.id AS "paymentId",p.status,
      EXISTS(SELECT FROM public."GatewayRefund" r WHERE r."paymentId"=p.id AND r.state->>'status' IN ('INITIATING','UNKNOWN','PROCESSING')) AS "refundPending"
      FROM public."GatewayPayment" p JOIN public."Booking" b ON b.id=p."bookingId"
      WHERE p.status IN ('INITIATING','SESSION_READY','UNKNOWN','RISK_REVIEW','EXCEPTION_REVIEW')
      OR EXISTS(SELECT FROM public."GatewayRefund" r WHERE r."paymentId"=p.id AND r.state->>'status' IN ('INITIATING','UNKNOWN','PROCESSING'))
      ORDER BY p."dueAt" NULLS FIRST,p.id LIMIT 50`);
  }
}
