import { expect, it, vi } from 'vitest';
import type { GatewayConfig } from '../src/payments/sslcommerz.js';
import { createInspection, inspectLabels, inspectionCallbackOrigin } from './phase3-checkout-inspection/inspection.js';

const config: GatewayConfig = { storeId: 'synthetic', password: 'synthetic', callbackOrigin: inspectionCallbackOrigin, frontendOrigin: 'http://127.0.0.1', storageKey: Buffer.alloc(32), refunds: false };
const id = `FWSI${'a'.repeat(26)}`;
const sessionKey = 'SyntheticOnlySession1234';
const url = `https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=PAY&SESSIONKEY=${sessionKey}`;
const response = (checkout = url) => Response.json({ status: 'SUCCESS', sessionkey: sessionKey, GatewayPageURL: checkout });
const html = (body: string) => new Response(body, { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });

it('dispatches exactly one synthetic initiation and one session-bound document GET', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(response()).mockResolvedValueOnce(html('<button>Cancel payment</button><form method="post" action="/pay"><button>Pay</button></form>'));
  const run = createInspection(config, id, transport, new AbortController().signal);
  const result = await run.run();
  expect(result).toEqual({ labels: ['cancel payment'], classification: 'STATIC_CANDIDATE_ONLY', phase3Accepted: false });
  expect(transport.mock.calls.map(([input, init]) => [String(input), init?.method, init?.redirect])).toEqual([
    ['https://sandbox.sslcommerz.com/gwprocess/v4/api.php', 'POST', 'error'], [url, 'GET', 'error'],
  ]);
  const body = transport.mock.calls[0][1]?.body as URLSearchParams;
  expect(body.get('tran_id')).toBe(id);
  expect(body.get('total_amount')).toBe('10.00');
  for (const key of ['success_url', 'fail_url', 'cancel_url', 'ipn_url']) expect(new URL(body.get(key)!).origin).toBe(inspectionCallbackOrigin);
  expect(JSON.stringify(result)).not.toContain(sessionKey);
  await expect(run.run()).rejects.toThrow('INSPECTION_CONSUMED');
  expect(run.requests()).toBe(2);
});

it.each([
  url.replace('Q=PAY', 'Q=CANCEL'), url.replace('Q=PAY', 'Q=PAY&Q=PAY'), url.replace(sessionKey, 'OtherSession987654321'),
  url.replace('sandbox.sslcommerz.com', 'securepay.sslcommerz.com'), url.replace('gw.php', 'bankgw/indexhtml.php'),
  `${url}&tran_type=success`,
])('rejects an unexpected checkout URL before document dispatch %#', async checkout => {
  const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(response(checkout));
  await expect(createInspection(config, id, transport, new AbortController().signal).run()).rejects.toThrow();
  expect(transport).toHaveBeenCalledTimes(1);
});

it('rejects existing payment namespace, live callback targets and refunds', () => {
  const transport = vi.fn<typeof fetch>();
  const signal = new AbortController().signal;
  expect(() => createInspection(config, `FWS${'a'.repeat(27)}`, transport, signal)).toThrow('INSPECTION_CONFIG_DENIED');
  expect(() => createInspection({ ...config, callbackOrigin: 'https://normal.example' }, id, transport, signal)).toThrow('INSPECTION_CONFIG_DENIED');
  expect(() => createInspection({ ...config, refunds: true }, id, transport, signal)).toThrow('INSPECTION_CONFIG_DENIED');
  expect(transport).not.toHaveBeenCalled();
});

it('never retries a rejected provider initiation', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ status: 'PROCESSING' }));
  const run = createInspection(config, id, transport, new AbortController().signal);
  await expect(run.run()).rejects.toThrow();
  await expect(run.run()).rejects.toThrow('INSPECTION_CONSUMED');
  expect(transport).toHaveBeenCalledOnce();
});

it('does not dispatch after deadline', async () => {
  const transport = vi.fn<typeof fetch>();
  const signal = AbortSignal.abort();
  await expect(createInspection(config, id, transport, signal).run()).rejects.toThrow();
  expect(transport).not.toHaveBeenCalled();
});

it.each([new Response(null, { status: 302, headers: { Location: url } }), Response.json({ status: 'FAILED' }), html('x'.repeat(512 * 1024 + 1))])('stops on redirect, non-HTML or oversized document %#', async document => {
  const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(response()).mockResolvedValueOnce(document);
  await expect(createInspection(config, id, transport, new AbortController().signal).run()).rejects.toThrow();
  expect(transport).toHaveBeenCalledTimes(2);
});

it('reports only known control labels and excludes scripts, templates and hidden or disabled controls', () => {
  expect(inspectLabels('<script>"<button>Decline</button>"</script><template><button>Simulate decline</button></template><div hidden><button>Cancel transaction</button></div><button disabled>Test decline</button><button aria-label="Cancel">×</button><a href="/private-token">Customer details</a>')).toEqual(['cancel']);
});
