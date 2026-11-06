import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { expect, it, vi } from 'vitest';
import type { PaymentService } from '../src/payments/payment.service.js';
import type { Evidence, Gateway, GatewayConfig } from '../src/payments/sslcommerz.js';
import { failedCallbacks } from './phase3-failed-uat/callbacks.js';
import { failedInstruction } from './phase3-failed-uat/procedure.js';
import { LimitedGateway, Scope, type Plan } from './phase3-failed-uat/scope.js';
import { createIsolatedCallbackLimiter } from './phase3-negative-v01/callback-limit.js';
import { postForm } from './phase3-negative-pg/http.js';

const read = (name: string) => JSON.parse(readFileSync(resolve(__dirname, '../../output/phase3', name), 'utf8'));
const plan: Plan = read('failed-uat-20261105-01/fixture-plan.json');
const f = plan.fixtures[0];
const old = 'FWS' + 'a'.repeat(26), fresh = 'FWS' + 'b'.repeat(26);
const paymentValues = (tranId: string, status = 'SESSION_READY', captured = false) => ['fresh-payment', f.bookingId, f.customerId, f.requestId, tranId, status, null, null, null, JSON.stringify({ id: 'fresh-payment', bookingId: f.bookingId, userId: f.customerId, quoteId: f.quoteId, amountMinor: '1200000', currency: 'BDT', status, captured, tranId })];

it('pins only one new FAILED fixture and the official sandbox UI action', () => {
  const previous = ['genuine-sandbox-e2e-20261104-02', 'negative-continuation-20261104-01', 'negative-postgres-20261105-01'];
  for (const run of previous) expect(JSON.stringify(read(run + '/fixture-plan.json'))).not.toContain(f.bookingId);
  const more = structuredClone(plan);
  more.caps.initiate = 2;
  expect(() => new Scope(more, () => {})).toThrow('EXACT_FAILED_PLAN_REQUIRED');
  expect(failedInstruction).toMatch(/Mobile Banking.*dummy OTP.*click Failed/);
});

it('requires retained isolation before write, rejects old transaction, capture and second initiation', () => {
  const scope = new Scope(plan, () => {});
  expect(() => scope.bind(paymentValues(fresh))).toThrow('PAYMENT_SCOPE');
  scope.protectRetainedTransaction(old);
  expect(() => scope.bind(paymentValues(old))).toThrow('PAYMENT_SCOPE');
  expect(() => scope.bind(paymentValues(fresh, 'VERIFIED', true))).toThrow('PAYMENT_SCOPE');
  expect(() => scope.bind(paymentValues(fresh, 'CANCELLED'))).toThrow('PAYMENT_SCOPE');
  scope.bind(paymentValues(fresh));
  scope.reserve('initiate');
  expect(() => scope.reserve('initiate')).toThrow('CAP');
  expect(() => scope.reserve('bookingUpdates')).toThrow('CAP');
});

function gateway() {
  const stop = vi.fn(), query = vi.fn<Gateway['query']>(), scope = new Scope(plan, () => {});
  scope.protectRetainedTransaction(old);
  scope.bind(paymentValues(fresh));
  return { query, stop, scope, bounded: new LimitedGateway({ query } as unknown as Gateway, scope, stop) };
}
const row: Evidence = { status: 'FAILED', tranId: fresh, amountMinor: '1200000', currency: 'BDT', risk: false };

it('queries the exact owned transaction, allows FAILED without val_id, forbids validation and refunds', async () => {
  const g = gateway();
  await expect(g.bounded.query(old)).rejects.toThrow('PROVIDER_SCOPE');
  expect(g.query).not.toHaveBeenCalled();
  g.query.mockResolvedValue([row]);
  await expect(g.bounded.query(fresh)).resolves.toEqual([row]);
  expect(g.bounded.failedEvidenceSeen).toBe(true);
  await expect(g.bounded.validate()).rejects.toThrow('NOT_APPROVED');
  await expect(g.bounded.refund()).rejects.toThrow('NOT_APPROVED');
  expect(g.stop).not.toHaveBeenCalled();
});

it.each([{ status: 'VALID' }, { status: 'CANCELLED' }, { tranId: old }, { amountMinor: '1' }, { currency: 'USD' }, { risk: true }])('stops on contradictory or mismatched authority %o', async patch => {
  const g = gateway();
  g.query.mockResolvedValue([{ ...row, ...patch }]);
  await expect(g.bounded.query(fresh)).rejects.toThrow('PROVIDER_MISMATCH');
  expect(g.bounded.failedEvidenceSeen).toBe(false);
  expect(g.stop).toHaveBeenCalledOnce();
});

it('does not count pending or missing query evidence as FAILED and caps query dispatch', async () => {
  const g = gateway();
  g.query.mockResolvedValueOnce([{ ...row, status: 'PENDING' }]).mockResolvedValue([]);
  await g.bounded.query(fresh);
  for (let i = 0; i < 3; i++) await expect(g.bounded.query(fresh)).rejects.toThrow('UNRESOLVED');
  await expect(g.bounded.query(fresh)).rejects.toThrow('CAP');
  expect(g.query).toHaveBeenCalledTimes(4);
  expect(g.bounded.failedEvidenceSeen).toBe(false);
});

function signed(status: string) {
  const body = { tran_id: fresh, amount: '12000.00', currency: 'BDT', status };
  const values: Record<string, string> = { ...body, store_passwd: createHash('md5').update('synthetic-test-only').digest('hex') };
  return { ...body, verify_key: Object.keys(body).join(','), verify_sign: createHash('md5').update(Object.keys(values).sort().map(k => `${k}=${values[k]}`).join('&')).digest('hex') };
}

it('requires signed FAILED IPN and scopes browser-return reconciliation to the transaction', async () => {
  const app = express(), admitted = new WeakSet<object>();
  const notify = vi.fn().mockResolvedValue(f.reference), reconcile = vi.fn().mockResolvedValue({ checked: 1 });
  const service = { notify, reconcile } as unknown as PaymentService;
  const config = { password: 'synthetic-test-only', storeId: 'test-store', frontendOrigin: 'http://127.0.0.1:9999' } as GatewayConfig;
  app.use((req, _res, next) => { admitted.add(req); next(); });
  app.use(failedCallbacks(service, config, createIsolatedCallbackLimiter(admitted)));
  app.use((_req, res) => { res.status(404).end(); });
  app.use((_err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => { void next; res.status(400).end(); });
  const path = '/payments/sslcommerz/';
  expect((await postForm(app, path + 'ipn', { tran_id: fresh, status: 'FAILED' })).status).toBe(400);
  expect((await postForm(app, path + 'ipn', signed('CANCELLED'))).status).toBe(400);
  expect((await postForm(app, path + 'ipn', { ...signed('FAILED'), store_id: 'wrong-store' })).status).toBe(400);
  expect((await postForm(app, path + 'ipn', { ...signed('FAILED'), amount: '1' })).status).toBe(400);
  expect((await postForm(app, path + 'cancel', signed('CANCELLED'))).status).toBe(404);
  expect(notify).not.toHaveBeenCalled();
  expect((await postForm(app, path + 'ipn', signed('FAILED'))).status).toBe(200);
  expect(notify).toHaveBeenCalledWith(fresh, undefined, 'ipn', 'FAILED');
  expect((await postForm(app, path + 'fail', { tran_id: fresh })).status).toBe(303);
  expect(reconcile).toHaveBeenCalledTimes(2);
  expect(reconcile).toHaveBeenLastCalledWith(f.reference, undefined, fresh);
});
