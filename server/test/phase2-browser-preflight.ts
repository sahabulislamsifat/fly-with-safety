import { compareIdentity, safeFailure } from './phase2-identity-diagnostic.js';
export type BrowserPreflightStage = 'identity-query' | 'identity-assertion' | 'actor-query' | 'actor-assertion';
export type BrowserActor = { userId: string; email: string; role: string };
export async function browserPreflight(
  identityQuery: () => Promise<unknown>, actorQuery: () => Promise<{ id: string; email: string; role: string }[]>,
  expected: BrowserActor[], stage: (value: BrowserPreflightStage) => void, observe: (value: object) => void,
) {
  stage('identity-query');
  const identity = await identityQuery();
  stage('identity-assertion');
  const comparison = compareIdentity(identity); observe({ kind: 'identity-comparison', ...comparison });
  if (!Object.values(comparison).every(value => value === true)) throw new Error('PHASE2_BROWSER_IDENTITY_MISMATCH');
  stage('actor-query');
  const actual = await actorQuery();
  stage('actor-assertion');
  const matches = actual.length === expected.length && expected.every(actor => actual.some(row => row.id === actor.userId && row.email === actor.email && row.role === actor.role));
  observe({ kind: 'actor-comparison', expectedCount: expected.length, observedCount: actual.length, matches });
  if (!matches) throw new Error('PHASE2_BROWSER_ACTOR_MISMATCH');
  return actual;
}
export function browserFailure(error: unknown, stage: string) {
  const failure = safeFailure(error);
  return { ...failure, classification: stage === 'identity-assertion' || stage === 'actor-assertion' ? 'ASSERTION_MISMATCH' : failure.classification };
}
