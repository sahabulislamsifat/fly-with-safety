import type { Evidence, Gateway } from '../src/payments/sslcommerz.js';
export function browserGatewayDouble(reference: string, mode: () => 'pending' | 'validated') {
  let transaction: string | undefined;
  const calls = { initiate: 0, query: 0, validate: 0, refund: 0 };
  const evidence = (): Evidence => ({ status: mode() === 'validated' ? 'VALID' : 'PENDING', tranId: transaction!, amountMinor: '1200000', currency: 'BDT', valId: 'BROWSER_V_' + transaction, bankId: 'BROWSER_B_' + transaction, risk: false });
  const gateway: Gateway = {
    async initiate(tranId, amount, customer) {
      if (transaction || amount !== '1200000' || customer.product !== `Assisted travel booking ${reference}`) throw Error('BROWSER_DOUBLE_SCOPE_MISMATCH');
      transaction = tranId; calls.initiate++;
      return { sessionKey: 'browser-injected-session-only', url: 'https://sandbox.sslcommerz.com/checkout?phase3_injected_only=1', channels: [] };
    },
    async query(tranId) { if (!transaction || tranId !== transaction) throw Error('BROWSER_DOUBLE_TRANSACTION_MISMATCH'); calls.query++; return [evidence()]; },
    async validate(valId) { if (!transaction || mode() !== 'validated' || valId !== 'BROWSER_V_' + transaction) throw Error('BROWSER_DOUBLE_NOT_VALIDATED'); calls.validate++; return evidence(); },
    async refund() { calls.refund++; throw Error('BROWSER_REFUND_WRITES_NOT_APPROVED'); },
    async refundStatus() { throw Error('BROWSER_REFUND_PROVIDER_NOT_APPROVED'); },
  };
  return { gateway, calls, transaction: () => transaction };
}

/** Adds test-scope restrictions ahead of the real app. It never replaces authentication. */
export function browserWriteGate(reference: string, actorEmails: readonly string[], transaction: () => string | undefined) {
  const counts = { sessionRequests: 0, paymentPosts: 0, reconcileRequests: 0 };
  return { counts, admit(method: string, path: string, body: Record<string, unknown>) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return !path.startsWith('/api/v1/auth/') || path === '/api/v1/auth/me';
    if (/^\/api\/v1\/auth\/(login|refresh|logout)$/.test(path)) {
      if (path.endsWith('/login') && !actorEmails.includes(String(body.email))) return false;
      return ++counts.sessionRequests <= 16;
    }
    const owned = path === `/api/v1/payments/bookings/${reference}/initiate` || path === `/api/v1/payments/bookings/${reference}/reconcile`;
    const callback = /^\/api\/v1\/payments\/sslcommerz\/(ipn|success|fail|cancel)$/.test(path) && !!transaction() && body.tran_id === transaction();
    if (!owned && !callback || ++counts.paymentPosts > 24) return false;
    if ((callback || path.endsWith('/reconcile')) && ++counts.reconcileRequests > 6) return false;
    return true;
  } };
}
