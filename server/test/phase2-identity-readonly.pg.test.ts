import { expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { compareIdentity, COUNT_SQL, ORIGINAL_IDENTITY_SQL, probeIdentity, readOnlyTarget, safeCounts, safeFailure, type ProbeStage } from './phase2-identity-diagnostic.js';
vi.mock('dotenv', () => ({ default: { config: () => ({ parsed: {} }) }, config: () => ({ parsed: {} }) }));

it.skipIf(process.env.PHASE2_IDENTITY_MODE !== 'owner-readonly-investigation')('restricted-role read-only identity and aggregate state', async () => {
  const resultPath = process.env.PHASE2_IDENTITY_RESULT;
  if (!resultPath) throw new Error('PHASE2_READONLY_RESULT_REQUIRED');
  const url = readOnlyTarget(process.env.PHASE2_IDENTITY_DATABASE_URL || '');
  // Server-enforced read-only defaults apply to every pool connection, before the original query.
  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = 'test';
  let stage: ProbeStage = 'client-import';
  let client: typeof import('../src/lib/prisma.js').prisma | undefined;
  let failure: ReturnType<typeof safeFailure> | null = null;
  let disconnectFailure: ReturnType<typeof safeFailure> | null = null;
  let proof: Awaited<ReturnType<typeof probeIdentity>> | null = null;
  let counts: ReturnType<typeof safeCounts> | null = null;
  let identityComparison: ReturnType<typeof compareIdentity> | null = null;
  const started = performance.now();
  writeFileSync(resultPath, JSON.stringify({ status: 'RUNNING', readOnlyScope: true }), { flag: 'wx' });
  try {
    client = (await import('../src/lib/prisma.js')).prisma;
    const connected = client;
    proof = await probeIdentity({ query: async <T>(sql: string) => {
      const rows = await connected.$queryRawUnsafe<T>(sql);
      if (sql === COUNT_SQL) counts = safeCounts(rows);
      if (sql === ORIGINAL_IDENTITY_SQL) identityComparison = compareIdentity(rows);
      return rows;
    } }, value => { stage = value; },
      (actual, expected) => { expect(actual).toEqual(expected); });
  } catch (error) {
    failure = safeFailure(error);
  } finally {
    try { await client?.$disconnect(); } catch (error) { disconnectFailure = safeFailure(error); }
    const elapsedMs = Math.min(60000, Math.max(0, Math.round(performance.now() - started)));
    const result = { passed: !failure && !disconnectFailure, stage, elapsedMs, proof, identityComparison, counts, failure, disconnectFailure, readOnlyScope: true };
    writeFileSync(resultPath, JSON.stringify(result));
    if (!result.passed) throw new Error('PHASE2_READONLY_DIAGNOSTIC ' + JSON.stringify(result));
  }
}, 15000);
