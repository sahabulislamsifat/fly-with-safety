import { expect, it } from 'vitest';
import { deepStrictEqual } from 'node:assert';
import { readFileSync } from 'node:fs';
import { compareIdentity, COUNT_SQL, EXPECTED_IDENTITY, ORIGINAL_IDENTITY_SQL, probeIdentity, readOnlyTarget, safeCounts, safeFailure, safeHttpOutcome, type ProbeStage } from './phase2-identity-diagnostic.js';

it.each([
  [{ code: 'P1000' }, 'DATABASE_AUTHENTICATION'],
  [{ code: 'P2010', meta: { code: '28P01' } }, 'DATABASE_AUTHENTICATION'],
  [{ code: 'P2010', meta: { code: '42501' } }, 'DATABASE_PERMISSION'],
  [{ meta: { driverAdapterError: { cause: { originalCode: '28P01' } } } }, 'DATABASE_AUTHENTICATION'],
  [{ code: 'ECONNREFUSED' }, 'CONNECTION_FAILURE'],
  [{ code: 'EACCES' }, 'CONNECTION_FAILURE'],
  [{ code: 'P2024' }, 'CONNECTION_FAILURE'],
  [{ code: 'P2010', meta: { code: '25006' } }, 'READONLY_VIOLATION'],
  [{ name: 'AssertionError', actual: 'secret' }, 'ASSERTION_MISMATCH'],
  [{ code: 'P2010', meta: { code: '42601' } }, 'DATABASE_ERROR'],
  [new Error('password=secret SQL token'), 'UNCLASSIFIED'],
] as const)('classifies only allowlisted fields %#', (error, classification) => {
  const result = safeFailure(error);
  expect(result.classification).toBe(classification);
  expect(Object.keys(result)).toEqual(['classification', 'prismaCode', 'sqlState', 'networkCode']);
  expect(JSON.stringify(result)).not.toContain('secret');
});
it('does not evaluate getters or forward arbitrary fields, causes, stack, message or unknown codes', () => {
  const error = { message: 'synthetic-secret', stack: 'synthetic-secret', code: 'synthetic-secret', cause: { message: 'synthetic-secret' }, toJSON: () => { throw new Error('unsafe'); } };
  Object.defineProperty(error, 'meta', { get: () => { throw new Error('unsafe'); } });
  expect(safeFailure(error)).toEqual({ classification: 'UNCLASSIFIED', prismaCode: null, sqlState: null, networkCode: null });
});
it('captures only bounded HTTP status and allowlisted public code, never response data/message', () => {
  expect(safeHttpOutcome(400, { code: 'BAD_REQUEST', message: 'synthetic-secret', data: { password: 'synthetic-secret' } })).toEqual({ status: 400, code: 'BAD_REQUEST' });
  expect(safeHttpOutcome('synthetic-secret', { code: 'synthetic-secret' })).toEqual({ status: null, code: null });
});
it('does not evaluate a response-code getter or accept invalid status numbers', () => {
  const body = Object.defineProperty({}, 'code', { get: () => { throw new Error('unsafe'); } });
  expect(safeHttpOutcome(600, body)).toEqual({ status: null, code: null });
  expect(safeHttpOutcome(200.5, null)).toEqual({ status: null, code: null });
});
it('classifies the actual Vitest assertion error without forwarding expected/actual values', () => {
  let result;
  try { expect('synthetic-secret').toEqual('different-secret'); } catch (error) { result = safeFailure(error); }
  expect(result?.classification).toBe('ASSERTION_MISMATCH');
  expect(JSON.stringify(result)).not.toContain('secret');
});
const target = 'postgresql://flywithsafe_phase2_booking_test:synthetic-only@127.0.0.1:5432/flywithsafe_phase2_booking_integration';
it('adds server read-only and bounded query settings to the exact restricted target', () => {
  const url = new URL(readOnlyTarget(target));
  expect(url.searchParams.get('options')).toBe('-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=2000');
});
it('redacts malformed URL input before Vitest can format an error', () => {
  let message = '';
  try { readOnlyTarget('synthetic-secret invalid URL'); } catch (error) { message = (error as Error).message; }
  expect(message).toBe('PHASE2_READONLY_WRONG_TARGET');
});
it('exposes identity mismatch booleans without forwarding unknown returned strings', () => {
  expect(compareIdentity([{ ...EXPECTED_IDENTITY, role: 'synthetic-secret' }])).toEqual({ singleRow: true, databaseMatches: true, roleMatches: false, hostMatches: true, portMatches: true });
  expect(JSON.stringify(compareIdentity([{ db: 'synthetic-secret' }]))).not.toContain('secret');
});
it('exposes only bounded nonnegative integer table counts, including nonempty state', () => {
  expect(safeCounts([{ users: 2, sessions: -1, bookings: 'synthetic-secret', passengers: Infinity, history: 0, idempotency: 1.5, notifications: 0, migrations: 7, password: 'synthetic-secret' }]))
    .toEqual({ users: 2, sessions: null, bookings: null, passengers: null, history: 0, idempotency: null, notifications: 0, migrations: 7 });
});
it('forwards server read-only startup options through the installed pg parser without connecting', async () => {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: readOnlyTarget(target) });
  const parameters: unknown = Object.getOwnPropertyDescriptor(client, 'connectionParameters')?.value;
  expect(parameters).toMatchObject({ options: '-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=2000' });
});
it.each([target.replace('127.0.0.1', 'localhost'), target.replace('booking_test:', 'admin:'), target.replace('5432', '5433'), target + '?options=unsafe', target + '#unsafe', target.replace('postgresql:', 'postgres:'), target.replace(':synthetic-only', '')])('rejects any target variation %#', value => {
  expect(() => readOnlyTarget(value)).toThrow();
});
function fixture(failAt = '') {
  const stages: ProbeStage[] = [], queries: string[] = [];
  const replies = [[{ read_only: 'on' }], [EXPECTED_IDENTITY], [{ session_user: EXPECTED_IDENTITY.role }],
    [{ users: 0, sessions: 0, bookings: 0, passengers: 0, history: 0, idempotency: 0, notifications: 0, migrations: 7 }]];
  return { stages, queries, client: { query: async <T>(sql: string): Promise<T> => {
    queries.push(sql);
    if (stages.at(-1) === failAt) throw { code: 'P2010', meta: { code: '42501' }, message: 'secret' };
    return replies[queries.length - 1] as T;
  } } };
}
it('forwards the byte-identical original identity query and only SELECT capabilities', async () => {
  const f = fixture();
  expect(await probeIdentity(f.client, stage => f.stages.push(stage), deepStrictEqual)).toEqual({ identityMatched: true, readOnly: true, applicationRows: 0, migrations: 7 });
  expect(f.queries[1]).toBe(ORIGINAL_IDENTITY_SQL);
  expect(f.queries.every(sql => /^SELECT\b/.test(sql) && !/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|GRANT|TRUNCATE)\b/.test(sql))).toBe(true);
  expect(f.queries.at(-1)).toBe(COUNT_SQL);
  const original = readFileSync(__dirname + '/phase2-booking.pg.test.ts', 'utf8');
  expect(original).toContain('`' + ORIGINAL_IDENTITY_SQL + '`');
});
it.each(['read-only-guard', 'identity-query', 'session-identity', 'catalog-counts'])('stops immediately and preserves exact failure stage %s', async failed => {
  const f = fixture(failed);
  await expect(probeIdentity(f.client, stage => f.stages.push(stage), deepStrictEqual)).rejects.toMatchObject({ code: 'P2010' });
  expect(f.stages.at(-1)).toBe(failed);
  expect(f.stages).not.toContain('complete');
});
it('distinguishes identity assertion mismatch and never reads subsequent state', async () => {
  const f = fixture();
  await expect(probeIdentity(f.client, stage => f.stages.push(stage), (actual, expected) => {
    if (f.stages.at(-1) === 'identity-assertion') deepStrictEqual([], expected);
    deepStrictEqual(actual, expected);
  })).rejects.toMatchObject({ name: 'AssertionError' });
  expect(f.queries).toHaveLength(2);
  expect(f.stages.at(-1)).toBe('identity-assertion');
});
