/** OFFLINE SQL-boundary contract model. NOT real PostgreSQL evidence. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../../src/generated/prisma/client.js';
const fake = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: { $queryRaw: fake.query } }));
import { loadPrincipal } from '../../src/identity/auth.js';
import { lockPrincipal, assertRecordScope, type Database } from '../../src/identity/store.js';
import { identityContext, type Principal } from '../../src/identity/policy.js';

const now = Date.UTC(2026, 10, 7, 18, 15, 48);
let offset: number, expires: number, revoked: boolean, suspended: boolean, versionValid: boolean, mfa: boolean;
const principal: Principal = { id: 'synthetic-staff', email: 'synthetic@example.invalid', name: null, role: 'STAFF', sessionId: 'synthetic-session', version: 0, mfaVersion: 0, mfaVerified: true, departments: ['FLIGHT'] };
const db = { $queryRaw: fake.query, $executeRaw: vi.fn() } as unknown as Database;
beforeEach(() => {
  offset = 360; expires = now + 60000; revoked = false; suspended = false; versionValid = true; mfa = true;
  process.env.IDENTITY_SCOPE_ENABLED = 'true';
  fake.query.mockImplementation(async (sql: Prisma.Sql) => {
    const text = sql.sql, tag = /p5:([a-z-]+)/.exec(text)?.[1];
    // timestamp-without-timezone UTC storage; legacy implicit conversion uses server wall clock.
    const utc = /s\."expiresAt">\(clock_timestamp\(\) AT TIME ZONE 'UTC'\)/.test(text);
    const unexpired = expires > now + (utc ? 0 : offset * 60000);
    if (tag === 'session') return revoked || !unexpired ? [] : [{ ...principal, verified: true, valid: versionValid, suspended, mfaVerified: mfa }];
    if (tag === 'memberships') return [{ department: 'FLIGHT' }];
    if (tag === 'lock-principal') return revoked || !unexpired ? [] : [{ ok: !suspended && versionValid }];
    if (tag === 'booking-type') return [{ bookingType: 'FLIGHT' }];
    if (tag === 'scope-lock') return [];
    throw Error('UNEXPECTED_CONTRACT_QUERY');
  });
});
describe('UTC legacy-session expiry independent of database timezone', () => {
  for (const [zone, minutes] of [['UTC', 0], ['Asia/Dhaka', 360], ['America/New_York', -300]] as const) {
    it(`${zone}: fresh session loads and locks`, async () => {
      offset = minutes; const p = await loadPrincipal(principal.id, principal.sessionId, 0);
      expect(p.role).toBe('STAFF'); await expect(lockPrincipal(db, p)).resolves.toBeUndefined();
    });
    it(`${zone}: expired session fails closed`, async () => {
      offset = minutes; expires = now - 1;
      await expect(loadPrincipal(principal.id, principal.sessionId, 0)).rejects.toMatchObject({ statusCode: 401 });
      await expect(lockPrincipal(db, principal)).rejects.toMatchObject({ statusCode: 401 });
    });
    it(`${zone}: expiry equality is denied`, async () => {
      offset = minutes; expires = now;
      await expect(loadPrincipal(principal.id, principal.sessionId, 0)).rejects.toMatchObject({ statusCode: 401 });
    });
  }
  it.each(['revoked', 'suspended', 'version'] as const)('%s remains denied', async condition => {
    if (condition === 'revoked') revoked = true;
    if (condition === 'suspended') suspended = true;
    if (condition === 'version') versionValid = false;
    await expect(loadPrincipal(principal.id, principal.sessionId, 0)).rejects.toMatchObject({ statusCode: 401 });
    await expect(lockPrincipal(db, principal)).rejects.toMatchObject({ statusCode: 401 });
  });
  it('missing MFA still denies record operations', async () => {
    mfa = false; const p = await loadPrincipal(principal.id, principal.sessionId, 0);
    await expect(identityContext.run(p, () => assertRecordScope(db, 'booking', 'synthetic', true))).rejects.toMatchObject({ statusCode: 403, code: 'MFA_REQUIRED' });
  });
  it('unassigned record still returns 404', async () => {
    const p = await loadPrincipal(principal.id, principal.sessionId, 0);
    await expect(identityContext.run(p, () => assertRecordScope(db, 'booking', 'synthetic', true))).rejects.toMatchObject({ statusCode: 404 });
  });
});
