import { ownerReadyAllowed } from '../phase3-negative-v01/owner.js';

const failedAction = 'FAILED_ONLY_DUMMY_OTP';

export function failedOwnerPage(nonce: string) {
  if (!/^[a-f0-9]{64}$/.test(nonce)) throw Error('OWNER_NONCE_INVALID');
  return `<!doctype html><title>FAILED sandbox case only</title><h1>FAILED sandbox case only</h1>
<ol><li>Choose Mobile Banking.</li><li>Choose a sandbox channel.</li><li>On Dummy OTP, press Failed exactly once.</li></ol>
<p><strong>Do not press X or confirm YES, CANCEL.</strong> Cancellation belongs to a separate run. Stop if the Failed control is absent or warning.php appears.</p>
<form method="post" action="/owner/ready"><input type="hidden" name="nonce" value="${nonce}"><input type="hidden" name="case" value="fail">
<label><input type="checkbox" name="action" value="${failedAction}" required> I will press Failed once on Dummy OTP.</label>
<button>Open FAILED sandbox Checkout</button></form>`;
}

export function failedOwnerReady(input: Parameters<typeof ownerReadyAllowed>[0] & { action: unknown },
  scope: Parameters<typeof ownerReadyAllowed>[1], stage: string) {
  return stage === 'initial' && scope.activeCase === 'fail' && input.action === failedAction && ownerReadyAllowed(input, scope);
}

export function checkoutStopReason(responseURL: string, callbackOrigin: string, method: string, status: number) {
  const url = new URL(responseURL);
  if (url.origin === 'https://sandbox.sslcommerz.com' && url.pathname.endsWith('/warning.php')) return 'SSL_SANDBOX_WARNING_PAGE';
  if (url.origin === callbackOrigin && url.pathname === '/api/v1/payments/sslcommerz/cancel' && method === 'POST' && status === 404) {
    return 'OWNER_BROWSER_OUT_OF_CASE_CANCEL';
  }
  return undefined;
}
