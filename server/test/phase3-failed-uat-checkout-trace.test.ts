import type { BrowserContext } from 'C:/Users/sahab/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import { installCheckoutTrace, traceRoute } from './phase3-failed-uat-v03/checkout-trace.js';

const origin = 'https://owner-probe.trycloudflare.com';
const provider = 'https://sandbox.sslcommerz.com/gwprocess/example.php?session=SECRET';
const cancel = origin + '/api/v1/payments/sslcommerz/cancel';

it('classifies exact origins and routes without retaining full URLs', () => {
  expect(traceRoute(provider, origin)).toBe('SANDBOX');
  expect(traceRoute(cancel, origin)).toBe('CALLBACK_CANCEL');
  expect(traceRoute(cancel.replace('/cancel', '/fail'), origin)).toBe('CALLBACK_FAIL');
  expect(traceRoute(cancel.replace('owner-probe', 'other-probe'), origin)).toBe('OTHER');
  expect(traceRoute('https://sandbox.sslcommerz.com.invalid/failed', origin)).toBe('OTHER');
});

it('records scoped browser labels and redirect classes with a fixed evidence budget', async () => {
  const exposeBinding = vi.fn(), addInitScript = vi.fn(), on = vi.fn(), record = vi.fn();
  const context = { exposeBinding, addInitScript, on } as unknown as BrowserContext;
  await installCheckoutTrace(context, origin, record);
  const page = {}, frame = { url: () => provider, page: () => page };
  const emit = exposeBinding.mock.calls[0][1];
  emit({ page, frame: { ...frame, url: () => cancel } }, 'DUMMY_OTP_FAILED');
  emit({ page, frame }, 'private secret value');
  expect(record).not.toHaveBeenCalled();
  emit({ page, frame }, 'DUMMY_OTP_FAILED');
  const navigation = on.mock.calls[0][1];
  navigation({ isNavigationRequest: () => true, url: () => cancel + '?provider=SECRET', method: () => 'POST', frame: () => frame,
    redirectedFrom: () => ({ url: () => provider, redirectedFrom: () => null }) });
  expect(record.mock.calls.map(([event]) => event)).toEqual([
    { kind: 'checkout-control-observed', action: 'DUMMY_OTP_FAILED', browserPage: 1, evidenceOnly: true },
    { kind: 'checkout-callback-navigation', route: 'CALLBACK_CANCEL', method: 'POST', previous: ['SANDBOX'], browserPage: 1, evidenceOnly: true },
  ]);
  for (let i = 0; i < 50; i++) emit({ page, frame }, 'CANCEL_CONFIRMED');
  expect(record).toHaveBeenCalledTimes(24);
  expect(JSON.stringify(record.mock.calls)).not.toMatch(/SECRET|sslcommerz\.com|private secret value/);
});

it('the injected handler emits only approved control labels from trusted sandbox clicks', async () => {
  const exposeBinding = vi.fn(), addInitScript = vi.fn(), addEventListener = vi.fn(), emit = vi.fn().mockResolvedValue(undefined);
  const context = { exposeBinding, addInitScript, on: vi.fn() } as unknown as BrowserContext;
  await installCheckoutTrace(context, origin, vi.fn());
  const [script, args] = addInitScript.mock.calls[0];
  class Button {
    constructor(readonly innerText: string) {}
    matches() { return true; }
  }
  runInNewContext(`(${script.toString()})(args)`, { args, location: { origin: 'https://sandbox.sslcommerz.com' }, window: { addEventListener }, HTMLElement: Button, HTMLInputElement: class {}, [args.name]: emit });
  const [kind, click, options] = addEventListener.mock.calls[0];
  expect(kind).toBe('click');
  expect(options).toEqual({ capture: true });
  const event = (label: string, isTrusted = true) => ({ isTrusted, composedPath: () => [new Button(label)] });
  click(event('Failed', false));
  click(event('Unrelated'));
  click(event('Failed'));
  click(event('YES, CANCEL'));
  expect(emit.mock.calls).toEqual([['DUMMY_OTP_FAILED'], ['CANCEL_CONFIRMED']]);
});
