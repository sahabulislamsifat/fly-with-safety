import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertDispatchBudget, retainedContract, traceActualService, trackActualTask } from './phase2-continuation-contract.js';
import { safeHttpOutcome } from './phase2-identity-diagnostic.js';
vi.mock('../src/lib/prisma.js', () => ({ prisma: { $transaction: vi.fn() } }));
import { applyCommercial, type CommercialCommand } from '../src/services/booking-commercial.service.js';
const input = () => JSON.parse(readFileSync(resolve(__dirname, '../../output/phase2/commercial-continuation-20261101-01/retained-contract.json'), 'utf8'));
it('accepts only the exact four retained identities and their original one-booking linkage', () => {
  const c = retainedContract(input());
  expect(c.actors.map(a => a.role)).toEqual(['CUSTOMER', 'CUSTOMER', 'STAFF', 'ADMIN']);
  expect(c.booking.userId).toBe(c.actors[0].id);
});
it.each(['duplicate-actor', 'wrong-role', 'wrong-email', 'session-owner', 'booking-owner', 'passenger-booking', 'history-booking', 'idempotency-reference', 'unknown-field', 'missing-session'])('fails closed before database work for %s', kind => {
  const c = input();
  if (kind === 'duplicate-actor') c.actors[1] = c.actors[0];
  if (kind === 'wrong-role') c.actors[0].role = 'ADMIN';
  if (kind === 'wrong-email') c.actors[0].email = 'synthetic-secret@example.invalid';
  if (kind === 'session-owner') c.sessions[0].userId = c.actors[1].id;
  if (kind === 'booking-owner') c.booking.userId = c.actors[1].id;
  if (kind === 'passenger-booking') c.passenger.bookingId = c.notification.id;
  if (kind === 'history-booking') c.history.bookingId = c.notification.id;
  if (kind === 'idempotency-reference') c.idempotency.referenceNumber = 'synthetic-secret';
  if (kind === 'unknown-field') c.password = 'synthetic-secret';
  if (kind === 'missing-session') c.sessions.pop();
  let message = '';
  try { retainedContract(c); } catch (error) { message = (error as Error).message; }
  expect(message).toMatch(/^PHASE2_RETAINED_(?:CONTRACT|LINKAGE)_INVALID$/);
  expect(message).not.toContain('synthetic-secret');
});
it('forwards an actual operation exactly once, with unchanged arguments and result identity', async () => {
  const result = { synthetic: true }, input = { id: 'synthetic' }, emit = vi.fn();
  const operation = vi.fn(async (value: object) => { expect(value).toBe(input); return result; });
  const wrapped = traceActualService(operation, emit);
  expect(await wrapped(input)).toBe(result); expect(operation).toHaveBeenCalledExactlyOnceWith(input); expect(emit).not.toHaveBeenCalled();
});
it('rethrows the identical service error while recording only safe classification', async () => {
  const error = Object.assign(new Error('synthetic-secret SQL password'), { code: 'P2010', meta: { code: '42501' } });
  const emit = vi.fn(), operation = vi.fn(async () => { throw error; });
  await expect(traceActualService(operation, emit)()).rejects.toBe(error);
  expect(operation).toHaveBeenCalledTimes(1); expect(emit).toHaveBeenCalledWith({ classification: 'DATABASE_PERMISSION', prismaCode: 'P2010', sqlState: '42501', networkCode: null });
  expect(JSON.stringify(emit.mock.calls)).not.toContain('secret');
});
it('does not serialize a synchronous service exception', async () => {
  const error = new Error('synthetic-secret'); const emit = vi.fn();
  await expect(traceActualService(() => { throw error; }, emit)()).rejects.toBe(error);
  expect(JSON.stringify(emit.mock.calls)).not.toContain('secret');
});
it('joins the same admitted task without replacing its promise, duplicating delivery or starting new tasks', async () => {
  let finish!: (value: string) => void;
  const promise = new Promise<string>(resolve => { finish = resolve; });
  const operation = vi.fn(() => promise), pending = new Set<Promise<unknown>>(), failures: ReturnType<typeof import('./phase2-identity-diagnostic.js').safeFailure>[] = [];
  const returned = trackActualTask(operation, pending, failures)();
  expect(returned).toBe(promise); expect(operation).toHaveBeenCalledTimes(1); expect(pending.size).toBe(1);
  finish('submitted'); await Promise.allSettled([...pending]);
  expect(pending.size).toBe(0); expect(failures).toEqual([]);
});
it('preserves an admitted task rejection while safely retaining its diagnostic for finalization', async () => {
  const error = Object.assign(new Error('synthetic-secret'), { code: 'P2010', meta: { code: '42501' } });
  const operation = vi.fn(async () => { throw error; }), pending = new Set<Promise<unknown>>(), failures: ReturnType<typeof import('./phase2-identity-diagnostic.js').safeFailure>[] = [];
  await expect(trackActualTask(operation, pending, failures)()).rejects.toBe(error);
  expect(pending.size).toBe(0); expect(failures[0].classification).toBe('DATABASE_PERMISSION'); expect(JSON.stringify(failures)).not.toContain('secret');
});
it('captures the original binding before installing an observer, preventing recursive spy dispatch', async () => {
  let calls = 0;
  const facade = { send: async () => { calls++; return 'synthetic'; } }, actual = facade.send;
  const pending = new Set<Promise<unknown>>(), failures: ReturnType<typeof import('./phase2-identity-diagnostic.js').safeFailure>[] = [];
  const spy = vi.spyOn(facade, 'send').mockImplementation(trackActualTask(actual, pending, failures));
  try { expect(await facade.send()).toBe('synthetic'); expect(calls).toBe(1); expect(failures).toEqual([]); }
  finally { spy.mockRestore(); }
});
it.each(['VALIDATION_ERROR', 'INVALID_STATUS_TRANSITION'])('retains the fixed application code %s without forwarding message/data', code => {
  expect(safeHttpOutcome(422, { code, message: 'synthetic-secret', data: { password: 'synthetic-secret' } })).toEqual({ status: 422, code });
});
it.each([45000, 60000, NaN, Infinity, -1])('denies dispatch at or outside the remaining case budget %s', elapsed => expect(() => assertDispatchBudget(elapsed)).toThrow('DISPATCH_BUDGET_STOP'));
it('allows bounded dispatch before the cutoff without extending the original case timeout', () => expect(() => assertDispatchBudget(44999)).not.toThrow());
it('contains only one explicit live case and never creates User/Booking/Passenger or invokes cleanup', () => {
  const source = readFileSync(resolve(__dirname, 'phase2-commercial-continuation.pg.test.ts'), 'utf8');
  expect(source.match(/it\.skipIf\(/g)).toHaveLength(1);
  expect(source).not.toMatch(/prisma\.(?:user|booking|bookingPassenger)\.(?:create|createMany|delete|deleteMany|upsert)\(/);
  expect(source).not.toMatch(/vi\.mock\(['"][^'"]*(?:prisma|auth|booking-commercial)/);
  expect(source).not.toMatch(/['"`]\s*(?:TRUNCATE\b|DELETE FROM\b|GRANT\s)|migrate deploy/);
  expect(source).toContain('Array.from({ length: 8 }, () => post(acceptance, 0, true))');
  expect(source).toContain('Array.from({ length: 8 }, () => status(\'CONFIRMED\', \'PENDING\'))');
  expect(source).toContain('}, 60000)');
  expect(source.indexOf("await check('quote-customer-issuance-denial'")).toBeLessThan(source.indexOf('const short = offer('));
});
it('checks exact revision/receipt arithmetic for the retained-booking continuation using the real pure transition', () => {
  const c = retainedContract(input()), staff = c.actors[2], owner = c.actors[0];
  const booking = { userId: owner.id, status: 'PENDING', currency: 'BDT', bookingDetails: {} };
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const early = new Date('2026-11-01T13:00:00Z'), late = new Date('2026-11-01T13:00:04Z');
  const offer = (n: number, revision: number, validUntil: string): CommercialCommand => ({ action: 'OFFER_QUOTE', requestId: id(n), expectedRevision: revision, amount: 12000, currency: 'BDT', validUntil });
  const write = (actor: typeof owner, command: CommercialCommand, now = late) => {
    const result = applyCommercial(booking, actor, command, now); booking.bookingDetails = { commercial: result.state }; return result;
  };
  write(staff, offer(1, 0, '2026-11-01T13:00:03Z'), early);
  expect(() => write(owner, { action: 'ACCEPT_QUOTE', requestId: id(4), expectedRevision: 1, quoteId: id(1) })).toThrow('expired');
  write(staff, offer(2, 1, '2026-11-01T13:10:00Z'));
  write(staff, offer(3, 2, '2026-11-01T13:10:00Z'));
  expect(() => write(owner, { action: 'ACCEPT_QUOTE', requestId: id(4), expectedRevision: 3, quoteId: id(2) })).toThrow('unavailable');
  const acceptance: CommercialCommand = { action: 'ACCEPT_QUOTE', requestId: id(4), expectedRevision: 3, quoteId: id(3) };
  write(owner, acceptance);
  const payment: CommercialCommand = { action: 'RECORD_PAYMENT', requestId: id(5), expectedRevision: 4, amount: 12000, currency: 'BDT', quoteId: id(3), method: 'BANK_TRANSFER', reference: 'SYN-CONT-PAY-001' };
  write(staff, payment);
  expect(write(owner, acceptance)).toMatchObject({ replayed: true, state: { revision: 5 } });
  const result = write(staff, payment);
  expect(result.replayed).toBe(true); expect(result.state.quotes).toHaveLength(3); expect(result.state.payments).toHaveLength(1); expect(result.state.receipts).toHaveLength(5);
});
