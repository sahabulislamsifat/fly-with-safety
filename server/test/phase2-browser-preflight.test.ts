import { expect, it, vi } from 'vitest';
import { browserFailure, browserPreflight } from './phase2-browser-preflight.js';
import { EXPECTED_IDENTITY } from './phase2-identity-diagnostic.js';
vi.mock('pg', () => { throw new Error('OFFLINE_CONNECTION_FORBIDDEN'); });
const actor = { userId: 'synthetic-id', email: 'synthetic@example.invalid', role: 'CUSTOMER' };
const actual = { id: actor.userId, email: actor.email, role: actor.role };
it('forwards each read-only operation once and records bounded comparisons in order', async () => {
  const identity = vi.fn().mockResolvedValue([EXPECTED_IDENTITY]), actors = vi.fn().mockResolvedValue([actual]), stages: string[] = [], observations: object[] = [];
  expect(await browserPreflight(identity, actors, [actor], stage => stages.push(stage), value => observations.push(value))).toEqual([actual]);
  expect(identity).toHaveBeenCalledTimes(1); expect(actors).toHaveBeenCalledTimes(1);
  expect(stages).toEqual(['identity-query', 'identity-assertion', 'actor-query', 'actor-assertion']);
  expect(JSON.stringify(observations)).not.toContain(actor.email);
});
it.each(['db', 'role', 'host', 'port'] as const)('retains exact %s identity guard and stops before actor query', async field => {
  const actors = vi.fn(), stages: string[] = [];
  await expect(browserPreflight(async () => [{ ...EXPECTED_IDENTITY, [field]: 'wrong' }], actors, [actor], value => stages.push(value), () => {})).rejects.toThrow('IDENTITY_MISMATCH');
  expect(stages.at(-1)).toBe('identity-assertion'); expect(actors).not.toHaveBeenCalled();
});
it.each(['id', 'email', 'role'] as const)('retains exact actor %s comparison', async field => {
  const stages: string[] = [];
  await expect(browserPreflight(async () => [EXPECTED_IDENTITY], async () => [{ ...actual, [field]: 'wrong' }], [actor], value => stages.push(value), () => {})).rejects.toThrow('ACTOR_MISMATCH');
  expect(stages.at(-1)).toBe('actor-assertion');
});
it.each(['identity-query', 'actor-query'] as const)('preserves %s original cause for allowlisted classification without retry', async failingStage => {
  const error = Object.assign(new Error('synthetic-private-url-and-password'), { code: 'P2010', meta: { code: '28P01' } });
  const stages: string[] = [], identity = vi.fn(async () => { if (failingStage === 'identity-query') throw error; return [EXPECTED_IDENTITY]; }), actors = vi.fn(async () => { throw error; });
  let caught: unknown;
  try { await browserPreflight(identity, actors, [actor], value => stages.push(value), () => {}); } catch (value) { caught = value; }
  expect(caught).toBe(error); expect(stages.at(-1)).toBe(failingStage); expect(identity).toHaveBeenCalledTimes(1);
  const diagnostic = browserFailure(caught, stages.at(-1)!);
  expect(diagnostic).toMatchObject({ classification: 'DATABASE_AUTHENTICATION', prismaCode: 'P2010', sqlState: '28P01' });
  expect(JSON.stringify(diagnostic)).not.toMatch(/private|password|stack|message/);
});
it('distinguishes identity/actor mismatches from unknown query exceptions without emitting identifiers', () => {
  expect(browserFailure(new Error('secret'), 'identity-assertion').classification).toBe('ASSERTION_MISMATCH');
  expect(browserFailure(new Error('secret'), 'actor-assertion').classification).toBe('ASSERTION_MISMATCH');
  expect(browserFailure(new Error('secret'), 'identity-query').classification).toBe('UNCLASSIFIED');
});
