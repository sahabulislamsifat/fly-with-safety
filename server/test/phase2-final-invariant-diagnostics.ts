const ids = new Set(['historyCount', 'totalPrice', 'quoteCount', 'paymentCount', 'receiptCount', 'acceptanceActor', 'statusTransitionCount', 'statusActors',
  'users', 'sessions', 'bookings', 'passengers', 'history', 'idempotency', 'notifications']);
export type FinalInvariantId = 'historyCount' | 'totalPrice' | 'quoteCount' | 'paymentCount' | 'receiptCount' | 'acceptanceActor' | 'statusTransitionCount' | 'statusActors'
  | 'users' | 'sessions' | 'bookings' | 'passengers' | 'history' | 'idempotency' | 'notifications';
type Expected = number | boolean | 'STAFF_EMAIL' | 'STAFF_ID' | 'CUSTOMER_ID';
const labels = new Set(['STAFF_EMAIL', 'STAFF_ID', 'CUSTOMER_ID', 'OTHER', 'MISSING', 'UNAVAILABLE']);
function safeValue(value: unknown): number | boolean | string {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= 2_000_000_000) return value;
  return typeof value === 'string' ? labels.has(value) ? value : 'OTHER' : 'UNAVAILABLE';
}
export function finalInvariantRecord(id: FinalInvariantId, expected: Expected, observed: unknown) {
  if (!ids.has(id) || safeValue(expected) !== expected) throw new Error('PHASE2_FINAL_DIAGNOSTIC_CONTRACT_INVALID');
  const safe = safeValue(observed);
  return { kind: 'final-invariant', invariant: id, expected, observed: safe, matched: safe === expected };
}
export function statusActorTag(values: unknown[], staff: { id: string; email: string }) {
  if (!values.length) return 'MISSING';
  if (values.every(value => value === staff.email)) return 'STAFF_EMAIL';
  if (values.every(value => value === staff.id)) return 'STAFF_ID';
  return 'OTHER';
}
