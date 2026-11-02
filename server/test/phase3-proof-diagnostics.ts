import { errorDataField } from '../src/utils/error-fields.js';
export function paymentProofFailure(error: unknown) {
  const meta = errorDataField(error, 'meta'), adapter = errorDataField(meta, 'driverAdapterError');
  const values = [errorDataField(error, 'code'), errorDataField(meta, 'code'), errorDataField(errorDataField(error, 'cause'), 'code'), errorDataField(errorDataField(adapter, 'cause'), 'originalCode'), errorDataField(errorDataField(error, 'cause'), 'originalCode')];
  const allowed = (pattern: RegExp) => values.find((v): v is string => typeof v === 'string' && pattern.test(v)) ?? null;
  const prismaCode = allowed(/^P\d{4}$/), sqlState = allowed(/^(28P01|28000|42501|23505|23514|23503|25006|40001|40P01|55P03|57014|42P01|42703|53300|08006)$/);
  const appCode = allowed(/^(NOT_FOUND|FORBIDDEN|UNAUTHORIZED|CONFLICT|BAD_REQUEST|SYNTHETIC_ROLLBACK)$/);
  // Fixed labels only: never persist an arbitrary error message or its contents.
  const guardMessages = [
    ['Booking commercial records require review', 'COMMERCIAL_SHAPE'],
    ['Booking requires an eligible accepted BDT quotation, contact details and no unresolved manual payment', 'BOOKING_ELIGIBILITY'],
    ['Payment request identity reused', 'REQUEST_PAYLOAD_CONFLICT'],
    ['Existing payment requires retrieval or reconciliation', 'ACTIVE_PAYMENT'],
    ['Immutable payment identity changed', 'IMMUTABLE_PAYMENT'],
  ] as const;
  const appGuard = appCode ? guardMessages.find(([message]) => message === errorDataField(error, 'message'))?.[1] : undefined;
  return { prismaCode, sqlState, appCode, ...(appGuard ? { appGuard } : {}), classification: sqlState === '28P01' || prismaCode === 'P1000' ? 'DATABASE_AUTHENTICATION' : sqlState === '42501' ? 'DATABASE_PERMISSION' : sqlState?.startsWith('23') ? 'DATABASE_CONSTRAINT' : prismaCode || sqlState ? 'DATABASE_ERROR' : appCode ? 'APPLICATION_GUARD' : 'ASSERTION_OR_UNCLASSIFIED' };
}
export type CheckValue = boolean | number | 'VERIFIED' | 'RISK_REVIEW' | 'SESSION_READY' | 'PROCESSING' | 'REFUNDED' | 'PENDING' | 'PARTIALLY_REFUNDED';
export type PaymentProofCheck = { id: string; passed: boolean; expected: CheckValue; observed: CheckValue };
export function paymentProofChecks(journal: (record: object) => void) {
  const results: PaymentProofCheck[] = [];
  return {
    results,
    check(id: string, observed: CheckValue, expected: CheckValue) {
      if (results.some(r => r.id === id)) throw Error('DUPLICATE_PROOF_CHECK');
      const result = { id, passed: observed === expected, observed, expected };
      results.push(result); journal({ kind: 'check', ...result });
      if (!result.passed) throw Object.assign(Error('PHASE3_CHECK_FAILED'), { code: 'PROOF_CHECK', checkId: id });
    },
  };
}
