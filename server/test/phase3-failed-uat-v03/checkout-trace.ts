import { randomBytes } from 'node:crypto';
import type { BrowserContext, Page, Request } from 'C:/Users/sahab/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright';

const sandboxOrigin = 'https://sandbox.sslcommerz.com';
const actions = ['DUMMY_OTP_FAILED', 'CANCEL_CONFIRMED'] as const;
type Action = typeof actions[number];

export function traceRoute(value: string, callbackOrigin: string) {
  let url: URL;
  try { url = new URL(value); } catch { return 'OTHER'; }
  if (url.origin === sandboxOrigin) return 'SANDBOX';
  if (url.origin === callbackOrigin) {
    if (url.pathname === '/api/v1/payments/sslcommerz/fail') return 'CALLBACK_FAIL';
    if (url.pathname === '/api/v1/payments/sslcommerz/cancel') return 'CALLBACK_CANCEL';
  }
  return 'OTHER';
}

/** Client-side evidence only. It cannot authorize a notice, query, or financial transition. */
export async function installCheckoutTrace(context: BrowserContext, callbackOrigin: string, record: (event: object) => void) {
  const binding = `__fwsTrace_${randomBytes(16).toString('hex')}`;
  const pages = new WeakMap<Page, number>();
  let sequence = 0, records = 0;
  const add = (page: Page, event: object) => {
    if (records >= 24) return;
    records++;
    if (!pages.has(page)) pages.set(page, ++sequence);
    record({ ...event, browserPage: pages.get(page), evidenceOnly: true });
  };
  await context.exposeBinding(binding, ({ frame, page }, action: unknown) => {
    if (traceRoute(frame.url(), callbackOrigin) !== 'SANDBOX' || !actions.includes(action as Action)) return;
    add(page, { kind: 'checkout-control-observed', action });
  });
  await context.addInitScript(({ name, sandbox }) => {
    if (location.origin !== sandbox) return;
    window.addEventListener('click', event => {
      if (!event.isTrusted) return;
      const emit = (globalThis as unknown as Record<string, (value: string) => Promise<void>>)[name];
      if (typeof emit !== 'function') return;
      const button = event.composedPath().find((part): part is HTMLElement => part instanceof HTMLElement &&
        part.matches('button, input[type=button], input[type=submit], a, [role=button]'));
      if (!button) return;
      const label = (button instanceof HTMLInputElement ? button.value : button.innerText || button.getAttribute('aria-label') || '')
        .trim().replace(/\s+/g, ' ').toUpperCase();
      const action = label === 'FAILED' ? 'DUMMY_OTP_FAILED' : /^YES,? CANCEL$/.test(label) ? 'CANCEL_CONFIRMED' : undefined;
      if (action) void emit(action).catch(() => {});
    }, { capture: true });
  }, { name: binding, sandbox: sandboxOrigin });
  context.on('request', request => {
    if (!request.isNavigationRequest()) return;
    const route = traceRoute(request.url(), callbackOrigin);
    if (route !== 'CALLBACK_FAIL' && route !== 'CALLBACK_CANCEL') return;
    const previous: string[] = [];
    let hop: Request | null = request.redirectedFrom();
    while (hop && previous.length < 4) {
      previous.push(traceRoute(hop.url(), callbackOrigin));
      hop = hop.redirectedFrom();
    }
    // Playwright can receive early navigation before a frame has been associated.
    let page: Page;
    try { page = request.frame().page(); } catch { return; }
    add(page, { kind: 'checkout-callback-navigation', route, method: request.method() === 'POST' ? 'POST' : 'OTHER', previous });
  });
}
