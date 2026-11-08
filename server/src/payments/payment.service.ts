import { randomBytes, randomUUID } from 'node:crypto';
import { AppError } from '../utils/errors.js';
import type { BookingActor } from '../services/booking-commercial.service.js';
import { active, authorize, billingSchema, digest, payable, paymentView, reserveRefund, settle, type Attempt, type Billing, type Refund } from './payment-domain.js';
import { openSession, sealSession, type Evidence, type Gateway, type GatewayConfig } from './sslcommerz.js';
import type { PaymentStore } from './payment-store.js';
import { errorDataField } from '../utils/error-fields.js';
import { GatewayError } from './sslcommerz.js';

function failureCategory(e: unknown): Record<string, string> {
  if (e instanceof GatewayError) return { category: `GATEWAY_${e.kind}` };
  const code = errorDataField(e, 'code');
  return typeof code === 'string' && /^(P\d{4}|[0-9A-Z]{5})$/.test(code) ? { category: 'DATABASE_OR_VALIDATION', code } : { category: 'UNRESOLVED' };
}

export class PaymentService {
  constructor(private readonly store: PaymentStore, private readonly gateway: Gateway, private readonly config: GatewayConfig) {}
  async operations(actor: BookingActor) {
    if (!['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(actor.role)) throw AppError.forbidden();
    return { entries: await this.store.operations() };
  }
  async list(reference: string, actor: BookingActor) {
    return this.store.transaction(reference, async l => {
      authorize(l.booking, actor);
      return { payments: l.attempts.map(a => paymentView(a, l.refunds)), refunds: l.refunds.map(r => ({ id: r.id, paymentId: r.paymentId, amountMinor: r.amountMinor, status: r.status })), history: l.history, refundsEnabled: ['ADMIN', 'SUPER_ADMIN'].includes(actor.role) && this.config.refunds };
    });
  }
  private session(a: Attempt) { return { payment: paymentView(a), ...(a.status === 'SESSION_READY' && a.session ? { checkoutUrl: openSession(a.session, a.id, this.config.storageKey).url } : {}) }; }
  async initiate(reference: string, actor: BookingActor, raw: Billing) {
    const input = billingSchema.parse(raw), hash = digest(input), owner = randomUUID();
    const prepared = await this.store.transaction(reference, async l => {
      authorize(l.booking, actor, true);
      const replay = l.attempts.find(a => a.userId === actor.id && a.requestId === input.requestId);
      if (replay) { if (replay.digest !== hash) throw AppError.conflict('Payment request identity reused'); return { a: replay, dispatch: false, customer: null }; }
      const { quote, revision, amountMinor } = payable(l.booking, actor, l.now);
      if (l.attempts.some(a => active(a) || a.captured)) throw AppError.conflict('Existing payment requires retrieval or reconciliation');
      const a: Attempt = { id: randomUUID(), bookingId: l.booking.id, userId: actor.id, requestId: input.requestId, digest: hash, tranId: 'FWS' + randomBytes(13).toString('hex'), quoteId: quote.id, quoteRevision: revision, amountMinor, currency: 'BDT', status: 'INITIATING', captured: false, checks: 0, due: l.now + 60_000, lease: { owner, until: l.now + 30_000 }, created: l.now, updated: l.now };
      await l.save(a); await l.event(a.id, `intent:${a.id}`, 'INTENT', actor.id);
      return { a, dispatch: true, customer: { name: l.booking.customerName, email: l.booking.customerEmail, phone: l.booking.customerPhone!, address: input.address, city: input.city, country: input.country, product: `Assisted travel booking ${l.booking.referenceNumber}` } };
    });
    if (!prepared.dispatch || !prepared.customer) return this.session(prepared.a);
    // Intent committed before genuine network request. Ambiguous errors never cause an automatic re-initiation.
    try {
      const session = await this.gateway.initiate(prepared.a.tranId, prepared.a.amountMinor, prepared.customer);
      return await this.store.transaction(reference, async l => {
        const current = l.attempts.find(a => a.id === prepared.a.id)!;
        if (current.lease?.owner !== owner || current.lease.until <= l.now || current.status !== 'INITIATING') return this.session(current);
        const next = { ...current, status: 'SESSION_READY' as const, session: sealSession(session, current.id, this.config.storageKey), lease: undefined, updated: l.now };
        await l.save(next); await l.event(next.id, `session:${next.id}`, 'SESSION_READY', actor.id); return this.session(next);
      });
    } catch (e) {
      // Includes commit acknowledgement loss: inspect durable state, never overwrite an already committed session/capture.
      return this.store.transaction(reference, async l => {
        const a = l.attempts.find(p => p.id === prepared.a.id)!;
        if (a.status === 'INITIATING' && a.lease?.owner === owner) { a.status = 'UNKNOWN'; a.lease = undefined; a.updated = l.now; await l.save(a); await l.event(a.id, `init-unknown:${a.id}`, 'INITIATION_UNRESOLVED', actor.id, failureCategory(e)); }
        return this.session(a);
      });
    }
  }
  async notify(tranId: string, valId: string | undefined, source: string, signedNegative?: 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'UNATTEMPTED') {
    const reference = await this.store.locate(tranId);
    if (!reference) throw AppError.notFound('Unknown payment');
    await this.store.transaction(reference, async l => {
      const a = l.attempts.find(p => p.tranId === tranId);
      if (!a || a.bookingId !== l.booking.id || a.userId !== l.booking.userId) throw AppError.notFound('Unknown payment');
      // Persist bounded identifiers only, before acknowledging the provider. Callback status/amount are not authority.
      const identity = [a.id, valId || '', source];
      if (signedNegative) identity.push(signedNegative);
      if (await l.event(a.id, `notice:${digest(identity)}`, 'NOTICE', 'PROVIDER', { source, ...(valId ? { valId } : {}), ...(signedNegative ? { signedNegative } : {}) })) {
        // A live lease owns scheduling. Advance its due value even when two
        // distinct notices land in the same millisecond, so the owner sees new work.
        const due = a.lease && a.lease.until > l.now ? Math.max(l.now, a.due + 1) : l.now;
        await l.save({ ...a, due });
      }
    });
    return reference;
  }
  async reconcile(reference: string, actor?: BookingActor, noticeTranId?: string) {
    const owner = randomUUID();
    const claimed = await this.store.transaction(reference, async l => {
      if (actor && !['ADMIN', 'STAFF', 'SUPER_ADMIN'].includes(actor.role)) throw AppError.forbidden();
      const claimed: Attempt[] = [];
      const priority = (a: Attempt) => active(a) || l.refunds.some(r => r.paymentId === a.id && ['INITIATING', 'UNKNOWN', 'PROCESSING'].includes(r.status)) ? 0 : a.captured ? 1 : 2;
      for (const a of [...l.attempts].sort((x, y) => priority(x) - priority(y) || x.updated - y.updated)) {
        if (claimed.length >= 1) break; // bounded work per admission; remaining rows retain their due time
        if (noticeTranId !== undefined && a.tranId !== noticeTranId) continue;
        if (a.bookingId !== l.booking.id || a.userId !== l.booking.userId) throw AppError.conflict('Payment ownership mismatch');
        if (a.lease && a.lease.until > l.now || !actor && (a.due === 0 || a.due > l.now || a.checks >= 10)) continue;
        const next = { ...a, checks: a.checks + 1, lease: { owner, until: l.now + 30_000 } }; await l.save(next); claimed.push(next);
      }
      return claimed;
    });
    for (const a of claimed) {
      try {
        const records = await this.gateway.query(a.tranId);
        if (!records.length) throw AppError.conflict('Provider outcome remains unresolved');
        const matching = records.filter(r => r.tranId === a.tranId && r.amountMinor === a.amountMinor && r.currency === a.currency);
        if (matching.length !== records.length) throw AppError.conflict('Mismatched gateway query');
        const successes = matching.filter(r => ['VALID', 'VALIDATED'].includes(r.status));
        if (successes.length > 1 || !successes.length && matching.length !== 1) throw AppError.conflict('Ambiguous gateway query');
        let evidence: Evidence = successes[0] || matching[0];
        if (successes.length) {
          if (!evidence.valId) throw AppError.conflict('Validation identity missing');
          const validated = await this.gateway.validate(evidence.valId);
          if (!['VALID', 'VALIDATED'].includes(validated.status) || validated.valId !== evidence.valId || evidence.bankId && validated.bankId !== evidence.bankId) throw AppError.conflict('Gateway validation mismatch');
          evidence = validated;
        }
        await this.store.transaction(reference, async l => {
          const current = l.attempts.find(p => p.id === a.id)!;
          if (!this.fenced(current, owner, l.now)) return;
          // A distinct notice arrived while this query was in flight. Keep the
          // intent unresolved until the queued check can review newer evidence.
          if (!successes.length && current.due !== a.due) return;
          let next = settle(current, l.booking, evidence, l.now);
          if (next === current) return;
          if (next.captured && l.attempts.some(p => p.id !== a.id && p.captured)) next = { ...next, status: 'EXCEPTION_REVIEW' };
          // Keep the scheduling marker until this lease's finalization.
          await l.save({ ...next, due: current.due, lease: current.lease });
          if (await l.event(a.id, `outcome:${digest([a.id, next.status, next.valId || ''])}`, next.status, 'PROVIDER', { captured: next.captured })) {
            if (next.captured) await l.publish(next);
          }
        });
        // Refund status is authoritative only through the refund API. Never infer completion from initiation.
        const refunds = await this.store.transaction(reference, async l => l.refunds.filter(r => r.paymentId === a.id && r.reference && ['PROCESSING', 'UNKNOWN'].includes(r.status)).sort((x, y) => x.updated - y.updated).slice(0, 1));
        for (const r of refunds) {
          const result = await this.gateway.refundStatus(r.reference!);
          await this.store.transaction(reference, async l => {
            const current = l.attempts.find(p => p.id === a.id)!;
            if (!this.fenced(current, owner, l.now) || result.bankId !== current.bankId || result.tranId !== current.tranId || result.amountMinor !== undefined && result.amountMinor !== r.amountMinor) return;
            const prior = l.refunds.find(p => p.id === r.id)!;
            if (prior.status === 'REFUNDED') return;
            const status = result.status === 'refunded' ? 'REFUNDED' : result.status === 'cancelled' ? 'CANCELLED' : 'PROCESSING';
            await l.saveRefund({ ...prior, status, updated: l.now });
            const key = `refund:${r.id}:${status}`;
            if (await l.event(a.id, key, `REFUND_${status}`, 'PROVIDER')) await l.publish(current, key);
          });
        }
      } catch (e) {
        await this.store.transaction(reference, async l => {
          const current = l.attempts.find(p => p.id === a.id)!;
          if (this.fenced(current, owner, l.now)) await l.event(a.id, `unresolved:${a.id}:${current.checks}`, 'RECONCILIATION_UNRESOLVED', 'WORKER', failureCategory(e));
        });
      } finally {
        await this.store.transaction(reference, async l => {
          const current = l.attempts.find(p => p.id === a.id)!;
          if (!this.fenced(current, owner, l.now)) return;
          const pendingRefund = l.refunds.some(r => r.paymentId === a.id && ['INITIATING', 'UNKNOWN', 'PROCESSING'].includes(r.status));
          const newerNotice = current.due !== a.due;
          const due = current.checks >= 10 ? 0 : newerNotice ? l.now : active(current) || pendingRefund ? l.now + Math.min(3600000, 30_000 * 2 ** current.checks) : 0;
          if (current.checks >= 10 && (active(current) || pendingRefund)) {
            const key = `review-required:${a.id}`;
            if (await l.event(a.id, key, 'REVIEW_REQUIRED', 'WORKER')) await l.publish(current, key);
          }
          await l.save({ ...current, due, lease: undefined });
        });
      }
    }
    return { checked: claimed.length };
  }
  private fenced(a: Attempt, owner: string, now: number) { return a.lease?.owner === owner && a.lease.until > now; }
  async tick() { const refs = await this.store.due(1); for (const ref of refs) await this.reconcile(ref); return { bookings: refs.length }; }
  async refund(reference: string, actor: BookingActor, input: { requestId: string; paymentId: string; amountMinor: string; reason: string }) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role) || !this.config.refunds) throw AppError.forbidden('Sandbox refunds require separate approval');
    const hash = digest(input);
    const prepared = await this.store.transaction(reference, async l => {
      const replay = l.refunds.find(r => r.actorId === actor.id && r.requestId === input.requestId);
      if (replay) { if (replay.digest !== hash) throw AppError.conflict('Refund request identity reused'); return { r: replay, dispatch: false, bankId: '' }; }
      const payment = l.attempts.find(a => a.id === input.paymentId); if (!payment) throw AppError.notFound('Payment not found');
      reserveRefund(payment, l.refunds, input.amountMinor);
      const r: Refund = { id: 'R' + randomBytes(14).toString('hex'), paymentId: payment.id, actorId: actor.id, requestId: input.requestId, digest: hash, amountMinor: input.amountMinor, status: 'INITIATING', created: l.now, updated: l.now };
      await l.saveRefund(r); await l.save({ ...payment, due: l.now + 60_000, checks: 0 }); await l.event(payment.id, `refund-intent:${r.id}`, 'REFUND_INTENT', actor.id); await l.publish(payment, `refund-intent:${r.id}`);
      return { r, bankId: payment.bankId!, tranId: payment.tranId, dispatch: true };
    });
    if (prepared.dispatch) {
      let referenceId: string | undefined;
      try { const result = await this.gateway.refund(prepared.bankId, prepared.r.id, prepared.r.amountMinor, input.reason); if (result.tranId !== prepared.tranId) throw Error('Refund transaction mismatch'); referenceId = result.reference; } catch { /* ambiguous: do not resubmit */ }
      await this.store.transaction(reference, async l => {
        const r = l.refunds.find(r => r.id === prepared.r.id)!;
        if (r.status !== 'INITIATING') return;
        await l.saveRefund({ ...r, status: referenceId ? 'PROCESSING' : 'UNKNOWN', reference: referenceId, updated: l.now });
        await l.event(r.paymentId, `refund-submitted:${r.id}`, referenceId ? 'REFUND_PROCESSING' : 'REFUND_UNRESOLVED', actor.id);
      });
    }
    return this.list(reference, actor);
  }
}
