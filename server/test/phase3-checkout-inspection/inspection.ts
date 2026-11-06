import { createRequire } from 'node:module';
import { SSLCommerzClient, type GatewayConfig } from '../../src/payments/sslcommerz.js';

export const inspectionCallbackOrigin = 'https://checkout-inspection.invalid';
const sandbox = 'https://sandbox.sslcommerz.com';
const amountMinor = '1000';
const candidateLabels = ['cancel', 'cancel payment', 'cancel transaction', 'decline', 'simulate decline', 'test decline'];

interface HtmlNode {
  text: string;
  tagName: string;
  parentNode?: HtmlNode;
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | undefined;
  querySelectorAll(selector: string): HtmlNode[];
}
const { parse } = createRequire(__filename)('../../../client/node_modules/next/dist/compiled/node-html-parser') as { parse(html: string): HtmlNode };

export function inspectLabels(html: string): string[] {
  const root = parse(html);
  const labels = new Set<string>();
  for (const control of root.querySelectorAll('button, a, input[type=button], input[type=submit], [role=button]')) {
    let excluded = false;
    for (let node: HtmlNode | undefined = control; node; node = node.parentNode) {
      if (['TEMPLATE', 'SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.tagName) || node.hasAttribute('hidden') || node.hasAttribute('disabled') || node.getAttribute('aria-hidden') === 'true' || node.getAttribute('aria-disabled') === 'true') excluded = true;
    }
    const label = (control.getAttribute('aria-label') ?? (control.tagName === 'INPUT' ? control.getAttribute('value') : control.text) ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
    if (!excluded && candidateLabels.includes(label)) labels.add(label);
  }
  return [...labels].sort();
}

/** Capability limited to one initiation and its documented, bound checkout document. */
export function createInspection(config: GatewayConfig, tranId: string, transport: typeof fetch, signal: AbortSignal) {
  if (!/^FWSI[a-f0-9]{26}$/.test(tranId) || config.callbackOrigin !== inspectionCallbackOrigin || config.refunds) throw Error('INSPECTION_CONFIG_DENIED');
  let started = false;
  let requests = 0;
  const client = new SSLCommerzClient(config, async (input, init) => {
    const body = init?.body;
    if (requests !== 0 || String(input) !== `${sandbox}/gwprocess/v4/api.php` || init?.method !== 'POST' || init.redirect !== 'error' || !(body instanceof URLSearchParams) || body.get('tran_id') !== tranId || body.get('total_amount') !== '10.00' || body.get('currency') !== 'BDT') throw Error('INITIATION_BOUNDARY_DENIED');
    for (const [key, suffix] of [['success_url', 'success'], ['fail_url', 'fail'], ['cancel_url', 'cancel'], ['ipn_url', 'ipn']]) {
      if (body.getAll(key).length !== 1 || body.get(key) !== `${inspectionCallbackOrigin}/api/v1/payments/sslcommerz/${suffix}`) throw Error('CALLBACK_BOUNDARY_DENIED');
    }
    signal.throwIfAborted();
    requests++;
    return transport(input, { ...init, signal: AbortSignal.any([signal, init.signal ?? AbortSignal.timeout(10_000)]) });
  });
  return {
    requests: () => requests,
    async run() {
      if (started) throw Error('INSPECTION_CONSUMED');
      started = true;
      const session = await client.initiate(tranId, amountMinor, {
        name: 'Synthetic Checkout Inspection', email: 'inspection@example.invalid', phone: '01000000000',
        address: 'Synthetic address', city: 'Dhaka', country: 'Bangladesh', product: 'Synthetic UI inspection',
      });
      const checkout = new URL(session.url);
      if (checkout.origin !== sandbox || checkout.pathname !== '/gwprocess/v4/gw.php' || checkout.searchParams.size !== 2 || checkout.searchParams.get('Q') !== 'PAY' || checkout.searchParams.get('SESSIONKEY') !== session.sessionKey || !/^[a-zA-Z0-9]{16,100}$/.test(session.sessionKey)) throw Error('CHECKOUT_DOCUMENT_BOUNDARY_DENIED');
      signal.throwIfAborted();
      requests++;
      const response = await transport(checkout, { method: 'GET', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) });
      if (response.status !== 200 || !/^text\/html(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') || !response.body) {
        await response.body?.cancel();
        throw Error('CHECKOUT_DOCUMENT_UNAVAILABLE');
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          if (bytes > 512 * 1024) throw Error('CHECKOUT_DOCUMENT_TOO_LARGE');
          chunks.push(value);
        }
      } finally { await reader.cancel(); }
      const labels = inspectLabels(Buffer.concat(chunks).toString('utf8'));
      return { labels, classification: labels.length ? 'STATIC_CANDIDATE_ONLY' : 'NO_STATIC_CANDIDATE', phase3Accepted: false };
    },
  };
}
