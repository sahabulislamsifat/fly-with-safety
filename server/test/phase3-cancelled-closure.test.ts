import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it, vi } from 'vitest';
import { digest, type Attempt } from '../src/payments/payment-domain.js';
import { PaymentService } from '../src/payments/payment.service.js';
import type { Ledger, PaymentStore } from '../src/payments/payment-store.js';
import type { Gateway } from '../src/payments/sslcommerz.js';
import type { Plan } from './phase3-cancelled-uat/scope.js';

// Saved evidence is read-only. Service calls below use an in-memory ledger and
// a gateway that throws on any I/O. Missing state fields are synthetic.
const base = resolve(__dirname, '../../output/phase3');
const cancelled = resolve(base, 'cancelled-uat-cloudflare-20261106-01');
const read = (dir: string, name: string) => readFileSync(resolve(dir, name));
const json = (name: string) => JSON.parse(read(cancelled, name).toString('utf8'));
const plan: Plan = json('fixture-plan.json');
const [fixture] = plan.fixtures;
const saved = json('owned-final.json');
const [payment] = saved.payments;
const [booking] = saved.bookings;
const now = Date.parse('2026-11-06T10:39:29Z');

function serviceOverSavedFixture() {
  const billing = { requestId: fixture.requestId, address: 'Synthetic sandbox address', city: 'Dhaka', country: 'BD' as const };
  const attempt: Attempt = {
    ...payment, userId: fixture.customerId, requestId: fixture.requestId, digest: digest(billing),
    quoteId: fixture.quoteId, quoteRevision: 2, amountMinor: String(fixture.amount * 100),
    currency: 'BDT', due: 0, checks: 1, created: now, updated: now,
  };
  const events = new Set<string>(saved.events.map((row: { id: string }) => row.id));
  const unexpectedIO = vi.fn(async () => { throw Error('CLOSURE_EXTERNAL_IO_FORBIDDEN'); });
  const ledger: Ledger = {
    booking: { ...booking, userId: fixture.customerId, currency: 'BDT', totalPrice: fixture.amount,
      bookingDetails: {}, customerName: 'Synthetic', customerEmail: 'owner@example.invalid', customerPhone: null },
    attempts: [attempt], refunds: [], now,
    history: saved.events.map((row: { kind: string }) => ({ kind: row.kind, createdAt: new Date(now).toISOString() })),
    save: unexpectedIO, saveRefund: unexpectedIO, publish: unexpectedIO,
    event: vi.fn(async (_id, key) => {
      if (events.has(key)) return false;
      throw Error('REPLAY_ATTEMPTED_NEW_EVENT');
    }),
  };
  const store: PaymentStore = {
    transaction: async (reference, action) => {
      expect(reference).toBe(fixture.reference);
      return action(ledger);
    },
    locate: async tranId => tranId === payment.tranId ? fixture.reference : null,
    due: unexpectedIO, operations: unexpectedIO,
  };
  const gateway: Gateway = {
    initiate: unexpectedIO, query: unexpectedIO, validate: unexpectedIO,
    refund: unexpectedIO, refundStatus: unexpectedIO,
  };
  const service = new PaymentService(store, gateway, {
    storeId: 'closure-test', password: 'closure-test', callbackOrigin: 'https://example.invalid',
    frontendOrigin: 'http://127.0.0.1', storageKey: Buffer.alloc(32), refunds: false,
  });
  return { service, ledger, billing, unexpectedIO };
}

it('correlates the exact persisted cancel notice and rejects duplicate event or provider work on replay', async () => {
  const { service, ledger, unexpectedIO } = serviceOverSavedFixture();
  const notice = `notice:${digest([payment.id, '', 'cancel'])}`;
  expect(saved.events).toContainEqual({ id: notice, paymentId: payment.id, kind: 'NOTICE' });
  await expect(Promise.all(Array.from({ length: 2 }, () =>
    service.notify(payment.tranId, undefined, 'cancel')))).resolves.toEqual([fixture.reference, fixture.reference]);
  expect(ledger.event).toHaveBeenCalledTimes(2);
  expect(ledger.event).toHaveBeenCalledWith(payment.id, notice, 'NOTICE', 'PROVIDER', { source: 'cancel' });
  await service.reconcile(fixture.reference, undefined, payment.tranId);
  expect(ledger.attempts[0]).toMatchObject({ status: 'CANCELLED', captured: false });
  expect(unexpectedIO).not.toHaveBeenCalled();
});

it('returns the existing attempt for the same initiation key and rejects changed billing under that key', async () => {
  const { service, billing, ledger, unexpectedIO } = serviceOverSavedFixture();
  const [owner] = plan.actors;
  const first = await service.initiate(fixture.reference, owner, billing);
  expect(first).toMatchObject({ payment: { id: payment.id, financialState: 'CANCELLED' } });
  expect(first).not.toHaveProperty('checkoutUrl');
  await expect(service.initiate(fixture.reference, owner, { ...billing, city: 'Different' }))
    .rejects.toMatchObject({ statusCode: 409 });
  expect(ledger.event).not.toHaveBeenCalled();
  expect(unexpectedIO).not.toHaveBeenCalled();
});

it('shows one identical CANCELLED view to the saved owner, staff and admin and denies the other owner', async () => {
  const { service, unexpectedIO } = serviceOverSavedFixture();
  const [owner, otherOwner, staff, admin] = plan.actors;
  expect(owner.id).toBe(fixture.customerId);
  expect(otherOwner.id).not.toBe(owner.id);
  expect([owner.role, otherOwner.role, staff.role, admin.role]).toEqual(['CUSTOMER', 'CUSTOMER', 'STAFF', 'ADMIN']);
  const [customer, staffView, adminView] = await Promise.all([owner, staff, admin].map(actor => service.list(fixture.reference, actor)));
  expect(customer.payments).toHaveLength(1);
  expect(customer.payments[0]).toMatchObject({ id: payment.id, financialState: 'CANCELLED' });
  expect(staffView).toEqual(customer);
  expect(adminView).toEqual(customer);
  await expect(service.list(fixture.reference, otherOwner)).rejects.toMatchObject({ statusCode: 404 });
  expect(unexpectedIO).not.toHaveBeenCalled();
});

it('reconciles the saved post-shutdown snapshot and verifies every historical FAILED artifact seal', () => {
  expect(saved.bookings).toEqual([{ id: fixture.bookingId, referenceNumber: fixture.reference, status: 'PENDING' }]);
  expect(saved.passengers).toEqual([{ id: fixture.passengerId, bookingId: fixture.bookingId }]);
  expect(saved.history).toEqual([{ id: fixture.historyId, bookingId: fixture.bookingId, fromStatus: 'PENDING', toStatus: 'PENDING' }]);
  expect(saved.payments).toHaveLength(1);
  expect(payment).toMatchObject({ bookingId: fixture.bookingId, status: 'CANCELLED', captured: false });
  expect(saved.events.map((row: { kind: string }) => row.kind).sort()).toEqual(['CANCELLED', 'INTENT', 'NOTICE', 'SESSION_READY']);
  expect(saved.events.every((row: { paymentId: string }) => row.paymentId === payment.id)).toBe(true);
  expect(saved.outbox).toEqual([]);
  expect(json('result.json')).toMatchObject({ connectorStopped: true, preservation: true, mainCloudAccess: false, refundsExecuted: false });
  const retained = json('retained-postcheck.json');
  expect(retained).toEqual(json('retained-preflight.json'));
  expect(retained).toMatchObject({ ownedRows: 23, successVerifiedAndUntouched: true, acceptedFailedV03Preserved: true, incompleteIntentPreserved: true, ownership: true });
  const seal = json('failed-v03-evidence-seal.json');
  expect(seal.files).toHaveLength(19);
  for (const { path, sha256 } of seal.files) {
    expect(createHash('sha256').update(read(resolve(base, seal.run), path)).digest('hex')).toBe(sha256.toLowerCase());
  }
});
