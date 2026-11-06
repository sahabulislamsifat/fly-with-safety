import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { expect, it, vi } from 'vitest';
import { settle, type Attempt, type Booking } from '../src/payments/payment-domain.js';
import { SSLCommerzClient, type GatewayConfig } from '../src/payments/sslcommerz.js';
import { postForm } from './phase3-negative-pg/http.js';
import { createIsolatedCallbackLimiter } from './phase3-negative-v01/callback-limit.js';
import { Scope, type Plan } from './phase3-cancelled-uat/scope.js';
import { callbackRoute, isCancelledCaseRoute, cancelledCallbacks, FirstStop, WireBudget } from './phase3-cancelled-uat/callbacks.js';
import { CancelledGateway, queryDiagnostics } from './phase3-cancelled-uat/query-diagnostics.js';
import { cancelledOwnerPage, cancelledOwnerReady, checkoutStopReason } from './phase3-cancelled-uat/owner-action.js';

const repo = resolve(__dirname, '../..');
const read = (file: string) => JSON.parse(readFileSync(resolve(repo, 'output/phase3', file), 'utf8'));
const plan: Plan = read('cancelled-uat-cloudflare-20261106-01/fixture-plan.json');
const tranId = 'FWS' + 'a'.repeat(26);
const config: GatewayConfig = { storeId: 'mock-store', password: 'mock-secret-only', callbackOrigin: 'https://test.invalid', frontendOrigin: 'http://127.0.0.1:9999', storageKey: Buffer.alloc(32), refunds: false };
const path = '/api/v1/payments/sslcommerz/';
it('arms only the loopback CANCELLED acknowledgement and stops on the out-of-case browser return', () => {
  const origin = 'http://127.0.0.1:8099', nonce = 'a'.repeat(64);
  const state = { origin, nonce, activeCase: 'cancel', stopped: false };
  const request = { origin, nonce, peer: '127.0.0.1', host: '127.0.0.1:8099', case: 'cancel', action: 'CANCELLED_ONLY_CONFIRM' };
  expect(cancelledOwnerPage(nonce)).toContain('YES, CANCEL');
  expect(cancelledOwnerReady(request, state, 'initial')).toBe(true);
  expect(cancelledOwnerReady({ ...request, action: 'FAILED_ONLY_DUMMY_OTP' }, state, 'initial')).toBe(false);
  expect(cancelledOwnerReady(request, state, 'initiating')).toBe(false);
  expect(checkoutStopReason(config.callbackOrigin + path + 'fail', config.callbackOrigin, 'POST', 404)).toBe('OWNER_BROWSER_OUT_OF_CASE_FAIL');
  expect(checkoutStopReason(config.callbackOrigin + path + 'cancel', config.callbackOrigin, 'POST', 303)).toBeUndefined();
});
function sign(overrides: Record<string, string> = {}) {
  const fields = { tran_id: tranId, amount: '12000.00', currency: 'BDT', status: 'CANCELLED', ...overrides };
  const values: Record<string, string> = { ...fields, store_passwd: createHash('md5').update(config.password).digest('hex') };
  return { ...fields, verify_key: Object.keys(fields).join(','), verify_sign: createHash('md5').update(Object.keys(values).sort().map(k => `${k}=${values[k]}`).join('&')).digest('hex') };
}
function callbacks() {
  const app = express(), admitted = new WeakSet<object>(), stop = new FirstStop(), wire = new WireBudget(20);
  const notify = vi.fn().mockResolvedValue(plan.fixtures[0].reference), reconcile = vi.fn().mockResolvedValue({ checked: 1 });
  const options = { lookup: (id: string) => id === tranId ? { fixture: plan.fixtures[0] } : undefined, reserve: vi.fn(), rejected: vi.fn(), record: vi.fn(), track: vi.fn(), terminal: vi.fn(), acknowledged: vi.fn(), stop: (code: string) => { stop.set(code); } };
  app.use((req, res, next) => {
    if (stop.code) { res.status(404).end(); return; }
    if (!wire.admit()) { stop.set('CALLBACK_WIRE_CAP'); res.status(429).end(); return; }
    admitted.add(req); next();
  });
  app.use('/api/v1', cancelledCallbacks({ notify, reconcile }, config, createIsolatedCallbackLimiter(admitted), options));
  app.use((_req, res) => { res.status(404).end(); });
  return { post: (route: string, body = sign()) => postForm(app, path + route, body), options, notify, reconcile, stop, wire };
}

it('rejects bad source and signatures, separates browser return and authenticated IPN', async () => {
  const h = callbacks();
  expect(callbackRoute(path + 'ipn?x=1')).toBe('OTHER');
  expect(callbackRoute(path + 'success')).toBe('success');
  expect((await h.post('ipn', { ...sign(), verify_sign: '0'.repeat(32) })).status).toBe(400);
  expect((await h.post('ipn', sign({ tran_id: 'OLD' }))).status).toBe(404);
  expect(h.options.reserve).not.toHaveBeenCalled();
  expect(h.options.record).toHaveBeenCalledWith({ kind: 'callback-rejected', route: 'ipn', reason: 'SIGNATURE_INVALID' });
  expect((await h.post('cancel')).status).toBe(303);
  expect((await h.post('ipn')).status).toBe(200);
  expect(h.notify.mock.calls.map(call => call.slice(2))).toEqual([['cancel', undefined], ['ipn', 'CANCELLED']]);
  expect(h.options.terminal).toHaveBeenCalledTimes(2);
  expect(h.options.reserve).toHaveBeenCalledTimes(2);
});

it('joins concurrent duplicates, leaves work quota alone, keeps the hard wire cap and first stop', async () => {
  const h = callbacks();
  const responses = await Promise.all(Array.from({ length: 10 }, () => h.post('cancel')));
  expect(responses.every(response => response.status === 303)).toBe(true);
  expect(h.notify).toHaveBeenCalledTimes(1);
  expect(h.reconcile).toHaveBeenCalledTimes(1);
  expect(h.options.reserve).toHaveBeenCalledTimes(1);
  for (let i = 10; i < 20; i++) expect(h.wire.admit()).toBe(true);
  expect((await h.post('ipn')).status).toBe(429);
  expect(h.stop.set('SIGTERM')).toBe(false);
  expect(h.stop.code).toBe('CALLBACK_WIRE_CAP');
});

it('stops on a second distinct signed attempt, including mismatches across routes', async () => {
  const h = callbacks();
  expect((await h.post('cancel', sign({ bank_tran_id: 'first' }))).status).toBe(303);
  expect((await h.post('ipn', sign({ bank_tran_id: 'second' }))).status).toBe(409);
  expect(h.stop.code).toBe('SECOND_DISTINCT_CALLBACK_ATTEMPT');
  expect(h.notify).toHaveBeenCalledTimes(1);
});

const cancelled = { status: 'CANCELLED', tran_id: tranId, amount: '12000.00', currency: 'BDT', val_id: '', bank_tran_id: '' };
const envelope = (element: unknown[]) => Response.json({ APIConnect: 'DONE', no_of_trans_found: element.length, element });
function gateway(response: Response) {
  const stop = vi.fn(), record = vi.fn(), scope = new Scope(plan, record), f = plan.fixtures[0];
  const payment = { id: 'test-id', bookingId: f.bookingId, userId: f.customerId, quoteId: f.quoteId, tranId, amountMinor: '1200000', currency: 'BDT', captured: false, status: 'SESSION_READY' };
  scope.protectRetainedTransaction('OLD');
  scope.bind([payment.id, f.bookingId, f.customerId, f.requestId, tranId, null, null, null, null, JSON.stringify(payment)]);
  const transport = vi.fn<typeof fetch>().mockResolvedValue(response);
  const sdk = new SSLCommerzClient(config, queryDiagnostics(config, scope, record, transport));
  return { bounded: new CancelledGateway(sdk, scope, stop), record, stop, transport };
}

it('accepts matching CANCELLED in the SDK query envelope without success IDs through the actual SDK', async () => {
  const h = gateway(envelope([cancelled]));
  await expect(h.bounded.query('OLD')).rejects.toThrow('PROVIDER_SCOPE');
  expect(h.transport).not.toHaveBeenCalled();
  await expect(h.bounded.query(tranId)).resolves.toEqual([{ status: 'CANCELLED', tranId, amountMinor: '1200000', currency: 'BDT', risk: false }]);
  expect(h.bounded.cancelledEvidenceSeen).toBe(true);
  const logs = JSON.stringify(h.record.mock.calls);
  expect(logs).not.toContain(tranId);
  expect(logs).not.toContain(config.password);
});

it.each([
  ['http', () => new Response('error', { status: 502 }), 'HTTP_STATUS'],
  ['shape', () => Response.json({ APIConnect: 'DONE', element: {} }), 'ELEMENT_NOT_ARRAY'],
  ['status', () => envelope([{ ...cancelled, status: 'PROCESSING' }]), 'STATUS_ENUM'],
  ['identity', () => envelope([{ ...cancelled, store_id: 'untrusted' }]), 'storeEchoMatches":false'],
  ['matching', () => envelope([{ ...cancelled, amount: '10.00' }]), 'amountMatchesIntent":false'],
  ['mixed outcomes', () => envelope([cancelled, { ...cancelled, status: 'VALID', risk_level: '0' }]), 'MISMATCH_OR_UNEXPECTED'],
] as const)('keeps %s unresolved with a sanitized diagnostic', async (_case, response, detail) => {
  const h = gateway(response());
  await expect(h.bounded.query(tranId)).rejects.toThrow();
  expect(h.bounded.cancelledEvidenceSeen).toBe(false);
  const log = JSON.stringify(h.record.mock.calls);
  expect(log).toContain(detail);
  expect(log).not.toContain(tranId);
});

it('keeps a captured payment and reopens contradictory terminal negatives', () => {
  const a = { tranId, amountMinor: '1200000', currency: 'BDT', status: 'VERIFIED', captured: true } as Attempt;
  const evidence = { tranId, amountMinor: '1200000', currency: 'BDT', status: 'CANCELLED', risk: false };
  expect(settle(a, {} as Booking, evidence, 10)).toBe(a);
  expect(settle({ ...a, status: 'FAILED', captured: false }, {} as Booking, evidence, 10).status).toBe('UNKNOWN');
});

it('stops when a later provider response contradicts the earlier CANCELLED authority', async () => {
  const h = gateway(envelope([cancelled]));
  await h.bounded.query(tranId);
  h.transport.mockResolvedValueOnce(envelope([{ ...cancelled, status: 'PENDING' }]));
  await expect(h.bounded.query(tranId)).rejects.toThrow('CANCELLED_QUERY_REGRESSION');
  expect(h.stop).toHaveBeenCalledWith('CANCELLED_AUTHORITY_NO_LONGER_CONFIRMED');
});

it('keeps the public route allowlist limited to the actual cancel return and IPN', () => {
  expect(['cancel', 'ipn', 'success', 'fail', 'cancel?x=1'].map(route =>
    isCancelledCaseRoute(callbackRoute(path + route)))).toEqual([true, true, false, false, false]);
});

it('does not adjudicate a CANCELLED case from PENDING, UNATTEMPTED or a conflicting FAILED query', async () => {
  for (const status of ['PENDING', 'UNATTEMPTED', 'FAILED']) {
    const h = gateway(envelope([{ ...cancelled, status }]));
    if (status === 'FAILED') await expect(h.bounded.query(tranId)).rejects.toThrow('CANCELLED_UAT_PROVIDER_MISMATCH');
    else await h.bounded.query(tranId);
    expect(h.bounded.cancelledEvidenceSeen).toBe(false);
  }
});

it('rejects a contradictory signed IPN and a browser request on the FAILED route', async () => {
  const h = callbacks();
  expect((await h.post('fail')).status).toBe(404);
  expect((await h.post('ipn', sign({ status: 'FAILED' }))).status).toBe(400);
  expect(h.stop.code).toBe('UNEXPECTED_SIGNED_CALLBACK_OUTCOME');
  expect(h.options.acknowledged).not.toHaveBeenCalled();
  expect(h.notify).not.toHaveBeenCalled();
});
