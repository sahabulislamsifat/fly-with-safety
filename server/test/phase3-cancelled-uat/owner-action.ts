import { ownerReadyAllowed } from '../phase3-negative-v01/owner.js';

const cancelledAction = 'CANCELLED_ONLY_CONFIRM';

export function cancelledOwnerPage(nonce: string) {
  if (!/^[a-f0-9]{64}$/.test(nonce)) throw Error('OWNER_NONCE_INVALID');
  return `<!doctype html><title>CANCELLED sandbox case only</title><h1>CANCELLED sandbox case only</h1>
<ol><li>Open the top-right X in Easy Checkout.</li><li>Press YES, CANCEL exactly once.</li></ol>
<p><strong>Use only the Easy Checkout cancellation confirmation.</strong> Stop if it is absent or warning.php appears.</p>
<form method="post" action="/owner/ready"><input type="hidden" name="nonce" value="${nonce}"><input type="hidden" name="case" value="cancel">
<label><input type="checkbox" name="action" value="${cancelledAction}" required> I will press YES, CANCEL once in Easy Checkout.</label>
<button>Open CANCELLED sandbox Checkout</button></form>`;
}

export function cancelledOwnerReady(input: Parameters<typeof ownerReadyAllowed>[0] & { action: unknown },
  scope: Parameters<typeof ownerReadyAllowed>[1], stage: string) {
  return stage === 'initial' && scope.activeCase === 'cancel' && input.action === cancelledAction && ownerReadyAllowed(input, scope);
}

export function checkoutStopReason(responseURL: string, callbackOrigin: string, method: string, status: number) {
  const url = new URL(responseURL);
  if (url.origin === 'https://sandbox.sslcommerz.com' && url.pathname.endsWith('/warning.php')) return 'SSL_SANDBOX_WARNING_PAGE';
  if (url.origin === callbackOrigin && url.pathname === '/api/v1/payments/sslcommerz/fail' && method === 'POST' && status === 404) {
    return 'OWNER_BROWSER_OUT_OF_CASE_FAIL';
  }
  return undefined;
}
