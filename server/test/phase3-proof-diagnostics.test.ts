import { expect, it } from 'vitest';
import { paymentProofChecks, paymentProofFailure } from './phase3-proof-diagnostics.js';
import { AppError } from '../src/utils/errors.js';
it('distinguishes fixed commercial, eligibility and request guards without exposing messages', () => {
  expect(paymentProofFailure(AppError.conflict('Booking commercial records require review')).appGuard).toBe('COMMERCIAL_SHAPE');
  expect(paymentProofFailure(AppError.conflict('Booking requires an eligible accepted BDT quotation, contact details and no unresolved manual payment')).appGuard).toBe('BOOKING_ELIGIBILITY');
  expect(paymentProofFailure(AppError.conflict('Payment request identity reused')).appGuard).toBe('REQUEST_PAYLOAD_CONFLICT');
  expect(paymentProofFailure(AppError.conflict('Existing payment requires retrieval or reconciliation')).appGuard).toBe('ACTIVE_PAYMENT');
});
it('does not retain unrecognized application messages', () => {
  expect(JSON.stringify(paymentProofFailure(AppError.conflict('synthetic-private-input')))).not.toContain('synthetic-private-input');
  expect(paymentProofFailure(AppError.conflict('synthetic-private-input'))).not.toHaveProperty('appGuard');
});
it('preserves database authentication codes without reading messages or getters', () => {
  const value = { code: 'P2010', meta: { driverAdapterError: { cause: { originalCode: '28P01' } } }, get message() { throw Error('MUST_NOT_READ'); } };
  expect(paymentProofFailure(value)).toEqual({ prismaCode: 'P2010', sqlState: '28P01', appCode: null, classification: 'DATABASE_AUTHENTICATION' });
});
it.each(['23505', '23514', '23503'])('retains exact constraint rejection %s', sqlState => expect(paymentProofFailure({ code: 'P2010', meta: { code: sqlState } }).sqlState).toBe(sqlState));
it('does not serialize private strings or unknown error metadata', () => {
  const value = paymentProofFailure({ code: 'private-example-password', message: 'private-example-password', meta: { query: 'private-example-password' } });
  expect(JSON.stringify(value)).not.toContain('private-example-password'); expect(value.classification).toBe('ASSERTION_OR_UNCLASSIFIED');
});
it('records exact sanitized expected/observed before failing an invariant', () => {
  const journal: object[] = [], checker = paymentProofChecks(r => journal.push(r));
  expect(() => checker.check('capture-count', 2, 1)).toThrow('PHASE3_CHECK_FAILED');
  expect(journal).toEqual([{ kind: 'check', id: 'capture-count', passed: false, observed: 2, expected: 1 }]);
});
it('rejects duplicate checkpoint IDs rather than inflate PASS counts', () => {
  const checker = paymentProofChecks(() => {}); checker.check('same', true, true); expect(() => checker.check('same', true, true)).toThrow('DUPLICATE'); expect(checker.results).toHaveLength(1);
});
