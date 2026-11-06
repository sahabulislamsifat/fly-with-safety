import type { Attempt } from '../../src/payments/payment-domain.js';
import type { Ledger, PaymentStore } from '../../src/payments/payment-store.js';

export type Fixture = {
  name: 'fail' | 'cancel' | 'success'; bookingId: string; reference: string; paymentId: string; tranId: string;
  requestId: string; quoteId: string; customerId: string; amount: number; valId?: string; bankId?: string;
};
const limits = { bookingInserts: 3, paymentInserts: 3, paymentSaveAttempts: 32, eventInsertAttempts: 18, storeTransactions: 64, callbackRequests: 16, providerDoubles: 8 } as const;
type Budget = keyof typeof limits;
export type FixturePlan = { fixtures: Fixture[]; rollbackEventId: string; caps: Record<Budget, number> };

export function validatePlan(plan: FixturePlan) {
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
  if (plan.fixtures.map(f => f.name).join(',') !== 'fail,cancel,success' ||
      Object.keys(plan.caps).length !== Object.keys(limits).length ||
      Object.entries(limits).some(([k, v]) => plan.caps[k as Budget] !== v) ||
      !plan.rollbackEventId.startsWith('npg-rollback-') || !uuid.test(plan.rollbackEventId.slice(13))) throw Error('EXACT_PLAN_REQUIRED');
  const ids = new Set<string>();
  for (const f of plan.fixtures) {
    if (![f.bookingId, f.paymentId, f.requestId, f.quoteId, f.customerId].every(id => uuid.test(id)) ||
        !/^FWS-NPG-[A-F0-9]{10}$/.test(f.reference) || !/^FWSN[a-f0-9]{26}$/.test(f.tranId) || f.amount !== 12000 ||
        (f.name === 'success' ? !/^NPGV[a-f0-9]{24}$/.test(f.valId ?? '') || !/^NPGB[a-f0-9]{24}$/.test(f.bankId ?? '') : f.valId !== undefined || f.bankId !== undefined)) throw Error('FIXTURE_SHAPE_DENIED');
    for (const id of [f.bookingId, f.paymentId, f.requestId, f.quoteId, f.reference, f.tranId, ...(f.valId ? [f.valId] : []), ...(f.bankId ? [f.bankId] : [])]) {
      if (ids.has(id)) throw Error('FIXTURE_COLLISION');
      ids.add(id);
    }
  }
}

export class Scope {
  readonly counts: Partial<Record<Budget, number>> = {};
  closed = false;
  constructor(readonly plan: FixturePlan) { validatePlan(plan); }
  take(kind: Budget) {
    const next = (this.counts[kind] ?? 0) + 1;
    if (this.closed || next > limits[kind]) throw Error('RUN_SCOPE_EXCEEDED');
    this.counts[kind] = next;
  }
  assertPayment(f: Fixture, a: Attempt) {
    if (a.id !== f.paymentId || a.bookingId !== f.bookingId || a.userId !== f.customerId || a.requestId !== f.requestId ||
        a.tranId !== f.tranId || a.quoteId !== f.quoteId || a.currency !== 'BDT' || a.amountMinor !== '1200000' ||
        a.captured !== (f.name === 'success') || a.valId !== f.valId || a.bankId !== f.bankId ||
        (f.name === 'success' ? a.status !== 'VERIFIED' : !['SESSION_READY', 'UNKNOWN', 'FAILED', 'CANCELLED'].includes(a.status))) throw Error('PAYMENT_WRITE_DENIED');
  }
  store(inner: PaymentStore): PaymentStore {
    return {
      transaction: <T>(reference: string, action: (ledger: Ledger) => Promise<T>) => {
        const f = this.plan.fixtures.find(f => f.reference === reference);
        if (!f) throw Error('BOOKING_SCOPE_DENIED');
        this.take('storeTransactions');
        return inner.transaction(reference, l => {
          if (l.booking.id !== f.bookingId || l.booking.userId !== f.customerId || l.booking.status !== 'PENDING' || l.attempts.length !== 1 || l.refunds.length) throw Error('LOCKED_FIXTURE_MISMATCH');
          this.assertPayment(f, l.attempts[0]);
          // Keep the real ledger object: save replaces its attempts array, and
          // consumers must observe the updated reference after a real write.
          const save = l.save, event = l.event;
          l.save = async a => { this.assertPayment(f, a); this.take('paymentSaveAttempts'); await save(a); };
          l.event = async (paymentId, key, kind, actor, data) => {
            const normal = /^(notice|outcome):[a-f0-9]{64}$/.test(key) || key.startsWith(`unresolved:${f.paymentId}:`);
            if (paymentId !== f.paymentId || (!normal && !(key === this.plan.rollbackEventId && f.name === 'fail' && kind === 'ROLLBACK_PROBE'))) throw Error('EVENT_SCOPE_DENIED');
            this.take('eventInsertAttempts');
            return event(paymentId, key, kind, actor, data);
          };
          l.publish = async () => { throw Error('BOOKING_PUBLICATION_FORBIDDEN'); };
          l.saveRefund = async () => { throw Error('REFUND_FORBIDDEN'); };
          return action(l);
        });
      },
      locate: async id => {
        const f = this.plan.fixtures.find(f => f.tranId === id);
        if (!f) return null;
        const found = await inner.locate(id);
        if (found !== f.reference) throw Error('CALLBACK_OWNER_MISMATCH');
        return found;
      },
      due: async () => { throw Error('GLOBAL_RECONCILIATION_FORBIDDEN'); },
      operations: async () => { throw Error('GLOBAL_OPERATIONS_FORBIDDEN'); },
    };
  }
}
