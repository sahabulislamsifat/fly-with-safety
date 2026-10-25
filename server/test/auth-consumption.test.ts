import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {} from 'passport'; // Express user augmentation only; no Passport runtime import.

// No application imports at module scope. Mocks exist before the guarded dynamic imports.
const mocks = vi.hoisted(() => ({
  boundary: false, serviceLoaded: false, events: [] as string[],
  forbidden: vi.fn(() => { throw new Error('AUTH02_FORBIDDEN_MODULE'); }),
  prisma: {
    emailVerificationToken: { findMany: vi.fn() },
    passwordResetToken: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  hash: vi.fn(), compare: vi.fn(), sign: vi.fn(), verify: vi.fn(),
  mail: vi.fn(() => { throw new Error('AUTH02_MAIL_FORBIDDEN'); }),
  log: vi.fn(),
}));
vi.mock('../src/lib/prisma.js', () => {
  if (!mocks.boundary) throw new Error('AUTH02_IMPORT_BEFORE_GUARDS');
  mocks.events.push('mock-prisma');
  return { prisma: mocks.prisma };
});
vi.mock('../src/config/env.js', () => {
  if (!mocks.boundary) throw new Error('AUTH02_IMPORT_BEFORE_GUARDS');
  mocks.events.push('mock-env');
  return { env: { nodeEnv: 'test', jwtSecret: 'synthetic-only', frontendUrl: 'https://example.invalid',
    refreshTokenExpiresDays: 7, accessTokenCookieMaxAgeMs: 1000, jwtExpiresIn: '15m' } };
});
vi.mock('../src/services/notification.service.js', () => {
  if (!mocks.boundary) throw new Error('AUTH02_IMPORT_BEFORE_GUARDS');
  mocks.events.push('mock-notification');
  return { sendEmailVerification: mocks.mail, sendPasswordReset: mocks.mail };
});
vi.mock('bcryptjs', () => ({ default: { hash: mocks.hash, compare: mocks.compare } }));
vi.mock('jsonwebtoken', () => ({ default: { sign: mocks.sign, verify: mocks.verify } }));
vi.mock('../src/lib/logger.js', () => ({
  logger: { error: mocks.log }, serializeError: () => ({ code: 'synthetic-error' }),
}));
vi.mock('pg', () => mocks.forbidden());
vi.mock('@prisma/adapter-pg', () => mocks.forbidden());
vi.mock('dotenv', () => mocks.forbidden());
vi.mock('nodemailer', () => mocks.forbidden());

const attempts: string[] = [];
const restore: Array<() => void> = [];
function installGuards(): void {
  const replace = (target: object, key: string, label: string) => {
    const original = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, writable: true, value: () => {
      attempts.push(label); throw new Error('AUTH02_OFFLINE_BOUNDARY');
    } });
    restore.push(() => {
      if (original) Object.defineProperty(target, key, original);
      else Reflect.deleteProperty(target, key);
    });
  };
  for (const key of ['connect', 'createConnection']) replace(net, key, `net.${key}`);
  replace(net.Socket.prototype, 'connect', 'socket.connect');
  replace(tls, 'connect', 'tls.connect');
  for (const [name, target] of [['http', http], ['https', https]] as const) {
    for (const key of ['get', 'request']) replace(target, key, `${name}.${key}`);
    replace(target.Agent.prototype, 'createConnection', `${name}.agent`);
  }
  for (const target of [dns, dns.promises, dns.Resolver.prototype, dns.promises.Resolver.prototype]) {
    for (const key of Object.getOwnPropertyNames(target)) {
      if ((key === 'lookup' || key === 'lookupService' || key === 'reverse' || key.startsWith('resolve')) &&
          typeof Reflect.get(target, key) === 'function') replace(target, key, `dns.${key}`);
    }
  }
  replace(dgram, 'createSocket', 'udp');
  for (const key of ['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork']) {
    replace(childProcess, key, `process.${key}`);
  }
  replace(globalThis, 'fetch', 'fetch');
  if ('WebSocket' in globalThis) replace(globalThis, 'WebSocket', 'websocket');
  syncBuiltinESMExports();
  mocks.boundary = true;
  mocks.events.push('guards');
}

let service: typeof import('../src/services/auth.service.js');
let controller: typeof import('../src/controllers/auth.controller.js');
let errors: typeof import('../src/utils/errors.js');
let errorHandler: typeof import('../src/middleware/error-handler.js');
let schemas: typeof import('../src/validators/auth.schemas.js');
const sourceFiles = ['src/controllers/auth.controller.ts', 'src/routes/auth.routes.ts',
  'src/middleware/oauth-state.ts', 'src/config/passport.ts'];
const sourceHashes = new Map<string, string>();
const source = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

beforeAll(async () => {
  installGuards();
  expect(() => net.connect(1, '127.0.0.1')).toThrow('AUTH02_OFFLINE_BOUNDARY');
  expect(attempts).toEqual(['net.connect']);
  mocks.events.push('before-service-import');
  service = await import('../src/services/auth.service.js');
  mocks.serviceLoaded = true;
  mocks.events.push('service-imported');
  controller = await import('../src/controllers/auth.controller.js');
  errors = await import('../src/utils/errors.js');
  errorHandler = await import('../src/middleware/error-handler.js');
  schemas = await import('../src/validators/auth.schemas.js');
  for (const path of sourceFiles) sourceHashes.set(path, digest(source(path)));
});
afterAll(() => {
  for (const undo of restore.reverse()) undo();
  syncBuiltinESMExports();
});

type Purpose = 'verification' | 'reset';
interface TokenRow { id: string; userId: string; purpose: Purpose; credential: string; expires: number; used: boolean }
interface UserRow { id: string; verified: boolean; password: string }
interface SessionRow { userId: string; revoked: boolean }
interface State { tokens: TokenRow[]; users: UserRow[]; sessions: SessionRow[] }
interface Identity { id: string; userId: string }
interface Query { text: string; values: unknown[] }
interface ModelTx {
  $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  user: { update: (input: { where: { id: string }; data: { emailVerified?: boolean; password?: string } }) => Promise<unknown> };
  session: { updateMany: (input: { where: { userId: string; revokedAt: null }; data: { revokedAt: Date } }) => Promise<{ count: number }> };
}
function deferred<T>() {
  let resolveValue!: (value: T) => void;
  let rejectValue!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolveValue = yes; rejectValue = no; });
  return { promise, resolve: resolveValue, reject: rejectValue };
}
const flush = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };
const settled = (promise: Promise<void>) => promise.then(() => 'ok', (error: unknown) => error);
const token = 'SYNTHETIC_AUTH02_' + 'x'.repeat(48);
const proposed = 'SyntheticOnlyPassword42';
const now = Date.UTC(2030, 0, 1);
let dbNow: number;
let state: State;
let queries: Query[];
let effects: string[];
let txOptions: unknown[];
let lockHook: (() => Promise<void>) | undefined;
let rawOverride: { phase: 'lock' | 'consume'; value: unknown } | undefined;
let failure: 'lookup' | 'lock' | 'consume' | 'user' | 'session' | 'commit' | undefined;
let failureBudget: number;
let transactionActive: boolean;
let tail: Promise<void>;
let hashesInsideTransaction: boolean[];
const fault = () => new Error(`synthetic-driver ${token} ${proposed} ${digest(token)}`);

function seed(purpose: Purpose, legacy = false, expires = now + 1000): void {
  state.tokens.push({ id: `token-${purpose}`, userId: 'synthetic-user', purpose,
    credential: legacy ? token : digest(token), expires, used: false });
}
function shouldFail(phase: typeof failure): boolean {
  if (failure === phase && failureBudget > 0) { failureBudget--; return true; }
  return false;
}
function sameState(before: State): void { expect(state).toEqual(before); }
function identity(row: TokenRow): Identity { return { id: row.id, userId: row.userId }; }

beforeEach(() => {
  vi.clearAllMocks();
  attempts.length = 0;
  state = { tokens: [], users: [{ id: 'synthetic-user', verified: false, password: 'previous-hash' }],
    sessions: [{ userId: 'synthetic-user', revoked: false }, { userId: 'synthetic-user', revoked: false },
      { userId: 'other-user', revoked: false }, { userId: 'synthetic-user', revoked: true }] };
  dbNow = now; queries = []; effects = []; txOptions = []; hashesInsideTransaction = [];
  failure = undefined; failureBudget = Infinity; rawOverride = undefined; lockHook = undefined;
  transactionActive = false; tail = Promise.resolve();
  mocks.hash.mockImplementation(async () => {
    hashesInsideTransaction.push(transactionActive);
    return 'synthetic-bcrypt-result';
  });
  mocks.prisma.emailVerificationToken.findMany.mockImplementation(async (input: {
    where: { token: { in: string[] }; usedAt: null }; take: number;
  }) => {
    if (shouldFail('lookup')) throw fault();
    expect(input.take).toBe(2);
    expect(input.where.usedAt).toBeNull();
    expect('expiresAt' in input.where).toBe(false);
    return state.tokens.filter(row => row.purpose === 'verification' && !row.used &&
      input.where.token.in.includes(row.credential)).slice(0, input.take).map(identity);
  });
  mocks.prisma.passwordResetToken.findFirst.mockImplementation(async (input: {
    where: { tokenHash: string; usedAt: null };
  }) => {
    if (shouldFail('lookup')) throw fault();
    expect(input.where.usedAt).toBeNull();
    expect('expiresAt' in input.where).toBe(false);
    const row = state.tokens.find(row => row.purpose === 'reset' && !row.used && row.credential === input.where.tokenHash);
    return row ? identity(row) : null;
  });
  // A deterministic transaction/row-lock MODEL, not a PostgreSQL implementation or proof.
  // Serialize the staged transaction after advisory lookups, allowing contenders to observe unused state.
  mocks.prisma.$transaction.mockImplementation(async (callback: (tx: ModelTx) => Promise<void>, options: unknown) => {
    txOptions.push(options);
    const preceding = tail;
    const release = deferred<void>();
    tail = release.promise;
    await preceding;
    transactionActive = true;
    const staged: State = structuredClone(state);
    let lockCompleted = false;
    try {
      const tx: ModelTx = {
        $queryRaw: async (strings, ...values) => {
          const text = strings.join('?'); queries.push({ text, values });
          const isLock = text.includes('FOR UPDATE');
          const phase = isLock ? 'lock' : 'consume';
          if (shouldFail(phase)) throw fault();
          const purpose: Purpose = text.includes('"EmailVerificationToken"') ? 'verification' : 'reset';
          expect(text.includes(purpose === 'verification' ? '"PasswordResetToken"' : '"EmailVerificationToken"')).toBe(false);
          expect(text.includes(token)).toBe(false);
          expect(values.every(value => !(value instanceof Date))).toBe(true);
          const row = staged.tokens.find(row => row.purpose === purpose && row.id === values[0] &&
            row.userId === values[1] && (row.credential === values[2] ||
              (purpose === 'verification' && row.credential === values[3])));
          if (isLock) {
            expect(text.includes('clock_timestamp')).toBe(false);
            await lockHook?.();
            lockCompleted = true;
          } else {
            expect(lockCompleted).toBe(true);
            expect(text).toContain("clock_timestamp() AT TIME ZONE 'UTC'");
            expect(text).toContain('AS MATERIALIZED');
            expect(text).toContain('t."usedAt" IS NULL');
            expect(text).toContain('t."expiresAt" > c.claimed_at');
            expect(text).toContain("date_trunc('milliseconds', c.claimed_at)");
            expect(text).toContain('RETURNING t.id, t."userId"');
          }
          if (rawOverride?.phase === phase) return rawOverride.value;
          if (!row || (!isLock && (row.used || row.expires <= dbNow))) return [];
          if (!isLock) row.used = true;
          return [identity(row)];
        },
        user: { update: async input => {
          effects.push('user-attempt');
          if (shouldFail('user')) throw fault();
          const user = staged.users.find(user => user.id === input.where.id);
          if (!user) throw fault();
          if (input.data.emailVerified !== undefined) user.verified = input.data.emailVerified;
          if (input.data.password !== undefined) user.password = input.data.password;
          return { id: user.id };
        } },
        session: { updateMany: async input => {
          effects.push('session-attempt');
          if (shouldFail('session')) throw fault();
          expect(input.where.revokedAt).toBeNull();
          expect(input.data.revokedAt).toBeInstanceOf(Date);
          const sessions = staged.sessions.filter(session => session.userId === input.where.userId && !session.revoked);
          for (const session of sessions) session.revoked = true;
          return { count: sessions.length };
        } },
      };
      await callback(tx);
      if (shouldFail('commit')) throw fault();
      state = staged;
    } finally { transactionActive = false; release.resolve(); }
  });
});

function redeem(purpose: Purpose, password = proposed): Promise<void> {
  return purpose === 'verification' ? service.verifyEmail(token) : service.resetPassword({ token, password });
}
function expectInvalid(error: unknown, purpose: Purpose): void {
  expect(error).toBeInstanceOf(errors.AppError);
  expect(error).toMatchObject({ statusCode: 400, code: 'BAD_REQUEST',
    message: purpose === 'verification' ? 'This verification link is invalid or expired.' :
      'This password reset link is invalid or expired.' });
}
function expectInternal(error: unknown): void {
  expect(error).toBeInstanceOf(errors.AppError);
  expect(error).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' });
  expect(error instanceof Error && error.message.includes(token)).toBe(false);
  expect(error instanceof Error && 'cause' in error).toBe(false);
}

describe('AUTH-02 offline real-service regression groups (no PostgreSQL proof)', () => {
  describe('A01 valid verification and legacy compatibility', () => {
    for (const legacy of [false, true]) it(legacy ? 'accepts one legacy candidate' : 'accepts a hashed candidate', async () => {
      seed('verification', legacy);
      await expect(redeem('verification')).resolves.toBeUndefined();
      expect(state.tokens[0].used).toBe(true);
      expect(state.users[0].verified).toBe(true);
      expect(effects).toEqual(['user-attempt']);
      expect(txOptions).toEqual([{ isolationLevel: 'ReadCommitted', maxWait: 2000, timeout: 5000 }]);
      expect(mocks.mail).not.toHaveBeenCalled();
    });
    it('consumes an unused credential for an already verified user', async () => {
      seed('verification'); state.users[0].verified = true;
      await redeem('verification'); expect(state.tokens[0].used).toBe(true);
    });
  });
  describe('A02 verification expiry uses the post-lock DB clock', () => {
    for (const offset of [-1, 0]) it(offset ? 'rejects expired' : 'rejects expiry equality', async () => {
      seed('verification', false, now + offset); const before = structuredClone(state);
      expectInvalid(await settled(redeem('verification')), 'verification'); sameState(before); expect(effects).toEqual([]);
    });
    it('rejects expiry reached during an unchanged-row lock wait', async () => {
      seed('verification'); lockHook = async () => { dbNow += 1000; };
      expectInvalid(await settled(redeem('verification')), 'verification'); expect(effects).toEqual([]);
    });
    it('does not use the application clock to reject a DB-valid token', async () => {
      seed('verification'); const spy = vi.spyOn(Date, 'now').mockReturnValue(now + 999999);
      try { await redeem('verification'); expect(state.users[0].verified).toBe(true); } finally { spy.mockRestore(); }
    });
  });
  it('A03 rejects verification reuse without another account effect', async () => {
    seed('verification'); await redeem('verification');
    expectInvalid(await settled(redeem('verification')), 'verification'); expect(effects).toEqual(['user-attempt']);
  });
  describe('A04 concurrent verification in the transaction model', () => {
    it('allows one committed winner', async () => {
      seed('verification'); const gate = deferred<void>(); lockHook = () => gate.promise;
      const first = settled(redeem('verification')); const second = settled(redeem('verification'));
      await flush(); expect(state.users[0].verified).toBe(false); gate.resolve();
      const results = await Promise.all([first, second]); expect(results.filter(x => x === 'ok')).toHaveLength(1);
      expectInvalid(results.find(x => x !== 'ok'), 'verification'); expect(effects).toEqual(['user-attempt']);
      expect(mocks.prisma.emailVerificationToken.findMany).toHaveBeenCalledTimes(2);
    });
    it('permits the waiter after the first effect rolls back', async () => {
      seed('verification'); failure = 'user'; failureBudget = 1;
      const [first, second] = await Promise.all([settled(redeem('verification')), settled(redeem('verification'))]);
      expectInternal(first); expect(second).toBe('ok'); expect(state.tokens[0].used).toBe(true);
    });
  });
  describe('A05 reset commits password and active sessions atomically', () => {
    for (const noSessions of [false, true]) it(noSessions ? 'allows zero active sessions' : 'revokes only active owned sessions', async () => {
      seed('reset'); if (noSessions) state.sessions = [];
      await expect(redeem('reset')).resolves.toBeUndefined();
      expect(state.tokens[0].used).toBe(true); expect(state.users[0].password).toBe('synthetic-bcrypt-result');
      expect(state.sessions.filter(s => s.userId === 'synthetic-user' && !s.revoked)).toHaveLength(0);
      expect(state.sessions.filter(s => s.userId === 'other-user' && !s.revoked)).toHaveLength(noSessions ? 0 : 1);
      expect(hashesInsideTransaction).toEqual([false]); expect(mocks.hash).toHaveBeenCalledWith(proposed, 12);
      expect(effects).toEqual(['user-attempt', 'session-attempt']); expect(mocks.mail).not.toHaveBeenCalled();
    });
    it('snapshots mutable request values before awaiting bcrypt', async () => {
      seed('reset'); const gate = deferred<string>(); mocks.hash.mockReturnValue(gate.promise);
      const input = { token, password: proposed }; const pending = service.resetPassword(input);
      await flush(); input.token = 'changed'; input.password = 'changed'; gate.resolve('captured-password-hash');
      await pending; expect(state.users[0].password).toBe('captured-password-hash');
      expect(mocks.hash).toHaveBeenCalledWith(proposed, 12);
      expect(queries.every(q => q.values.includes(digest(token)))).toBe(true);
    });
  });
  describe('A06 reset expiry', () => {
    for (const offset of [-1, 0]) it(offset ? 'rejects expired' : 'rejects equality', async () => {
      seed('reset', false, now + offset); const before = structuredClone(state);
      expectInvalid(await settled(redeem('reset')), 'reset'); sameState(before); expect(effects).toEqual([]);
    });
    it('rejects expiry during bcrypt', async () => {
      seed('reset'); mocks.hash.mockImplementation(async () => { dbNow += 1000; return 'synthetic-hash'; });
      expectInvalid(await settled(redeem('reset')), 'reset'); expect(effects).toEqual([]);
    });
    it('rejects expiry during the lock wait', async () => {
      seed('reset'); lockHook = async () => { dbNow += 1000; };
      expectInvalid(await settled(redeem('reset')), 'reset'); expect(effects).toEqual([]);
      expect(queries[1].text).toContain("AT TIME ZONE 'UTC'");
    });
  });
  it('A07 rejects reset reuse with a different proposed password', async () => {
    seed('reset'); await redeem('reset'); const before = structuredClone(state);
    expectInvalid(await settled(redeem('reset', 'DifferentSyntheticPassword42')), 'reset'); sameState(before);
    expect(effects).toEqual(['user-attempt', 'session-attempt']);
  });
  describe('A08 concurrent reset and hash completion order', () => {
    for (const reverse of [false, true]) it(reverse ? 'second hash completes first' : 'first hash completes first', async () => {
      seed('reset'); const one = deferred<string>(); const two = deferred<string>();
      mocks.hash.mockReturnValueOnce(one.promise).mockReturnValueOnce(two.promise);
      const first = settled(redeem('reset')); const second = settled(redeem('reset', 'OtherSyntheticPassword42'));
      await flush(); (reverse ? two : one).resolve(reverse ? 'second-hash' : 'first-hash'); await flush();
      (reverse ? one : two).resolve(reverse ? 'first-hash' : 'second-hash');
      const results = await Promise.all([first, second]); expect(results.filter(x => x === 'ok')).toHaveLength(1);
      expectInvalid(results.find(x => x !== 'ok'), 'reset');
      expect(state.users[0].password).toBe(reverse ? 'second-hash' : 'first-hash');
      expect(effects).toEqual(['user-attempt', 'session-attempt']);
    });
  });
  describe('A09 consumption must return exactly one bound identity', () => {
    for (const purpose of ['verification', 'reset'] as const) {
      for (const phase of ['lock', 'consume'] as const) {
        for (const variant of ['zero', 'many', 'malformed', 'wrong-user', 'wrong-id', 'not-array'] as const) {
          it(`${purpose} ${phase} ${variant} fails closed`, async () => {
            seed(purpose); const before = structuredClone(state); const row = identity(state.tokens[0]);
            const values = { zero: [], many: [row, row], malformed: [null],
              'wrong-user': [{ ...row, userId: 'other-user' }], 'wrong-id': [{ ...row, id: 'other-token' }],
              'not-array': { rows: [row] } };
            rawOverride = { phase, value: values[variant] };
            const result = await settled(redeem(purpose));
            if (variant === 'zero') expectInvalid(result, purpose); else expectInternal(result);
            sameState(before); expect(effects).toEqual([]);
          });
        }
      }
      for (const phase of ['lookup', 'lock', 'consume'] as const) it(`${purpose} ${phase} driver fault is sanitized without retry`, async () => {
        seed(purpose); const before = structuredClone(state); failure = phase;
        expectInternal(await settled(redeem(purpose))); sameState(before); expect(effects).toEqual([]);
        expect(mocks.prisma.$transaction.mock.calls.length).toBeLessThanOrEqual(1);
      });
      it(`${purpose} transaction admission timeout is sanitized without retry`, async () => {
        seed(purpose); const before = structuredClone(state);
        mocks.prisma.$transaction.mockRejectedValueOnce(fault());
        expectInternal(await settled(redeem(purpose))); sameState(before);
        expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1); expect(effects).toEqual([]);
      });
      it(`${purpose} deleted credential between lookup and transaction cannot change an account`, async () => {
        seed(purpose);
        const realModel = mocks.prisma.$transaction.getMockImplementation();
        if (!realModel) throw new Error('AUTH02_MISSING_MODEL');
        mocks.prisma.$transaction.mockImplementationOnce(async (...args: unknown[]) => {
          state.tokens = [];
          return Reflect.apply(realModel, undefined, args);
        });
        expectInvalid(await settled(redeem(purpose)), purpose); expect(effects).toEqual([]);
      });
      it(`${purpose} changed credential owner between lookup and transaction is rejected`, async () => {
        seed(purpose);
        const realModel = mocks.prisma.$transaction.getMockImplementation();
        if (!realModel) throw new Error('AUTH02_MISSING_MODEL');
        mocks.prisma.$transaction.mockImplementationOnce(async (...args: unknown[]) => {
          state.tokens[0].userId = 'other-user';
          return Reflect.apply(realModel, undefined, args);
        });
        expectInvalid(await settled(redeem(purpose)), purpose); expect(effects).toEqual([]);
      });
    }
  });
  describe('A10 dependent effects and commit failure roll back the model', () => {
    for (const purpose of ['verification', 'reset'] as const) {
      for (const phase of ['user', 'commit'] as const) it(`${purpose} ${phase} rollback`, async () => {
        seed(purpose); const before = structuredClone(state); failure = phase;
        expectInternal(await settled(redeem(purpose))); sameState(before);
      });
      it(`${purpose} missing user rolls back consumption`, async () => {
        seed(purpose); state.users = []; const before = structuredClone(state);
        expectInternal(await settled(redeem(purpose))); sameState(before);
      });
    }
    it('session failure rolls back the staged password and consumed token', async () => {
      seed('reset'); const before = structuredClone(state); failure = 'session';
      expectInternal(await settled(redeem('reset'))); sameState(before);
      expect(effects).toEqual(['user-attempt', 'session-attempt']);
    });
  });
  describe('A11 invalid, bound input and ambiguous legacy handling', () => {
    for (const purpose of ['verification', 'reset'] as const) it(`${purpose} unknown credential`, async () => {
      expectInvalid(await settled(redeem(purpose)), purpose); expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    });
    it('rejects both raw and hash matching different verification rows', async () => {
      seed('verification'); state.tokens.push({ ...state.tokens[0], id: 'legacy-other', userId: 'other-user', credential: token });
      expectInvalid(await settled(redeem('verification')), 'verification'); expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    });
    it('passes injection-shaped legacy input only as a parameter', async () => {
      const submitted = "SYNTHETIC_' OR 1=1; --"; seed('verification', true); state.tokens[0].credential = submitted;
      await service.verifyEmail(submitted);
      expect(queries.every(q => !q.text.includes(submitted) && q.values.includes(submitted))).toBe(true);
    });
  });
  describe('A12 purpose-specific tables', () => {
    it('does not accept reset-only credentials in verification', async () => {
      seed('reset'); expectInvalid(await settled(redeem('verification')), 'verification'); expect(effects).toEqual([]);
    });
    it('does not accept verification-only credentials in reset', async () => {
      seed('verification'); expectInvalid(await settled(redeem('reset')), 'reset'); expect(effects).toEqual([]);
    });
  });
  describe('A13 unchanged controllers and error responses without an HTTP server', () => {
    for (const purpose of ['verification', 'reset'] as const) {
      for (const valid of [true, false]) it(`${purpose} ${valid ? 'success' : 'invalid'} contract`, async () => {
        if (valid) seed(purpose);
        const response = { json: vi.fn(), clearCookie: vi.fn(), status: vi.fn() };
        response.status.mockReturnValue(response); const next = vi.fn();
        await Reflect.apply(purpose === 'verification' ? controller.verifyEmail : controller.resetPassword,
          undefined, [{ body: { token, password: proposed } }, response, next]);
        if (valid) {
          expect(next).not.toHaveBeenCalled();
          expect(response.json).toHaveBeenCalledWith({ success: true, data: {
            message: purpose === 'verification' ? 'Email verified successfully' : 'Password reset successfully. Please sign in.',
          } });
          expect(response.clearCookie).toHaveBeenCalledTimes(purpose === 'reset' ? 2 : 0);
          if (purpose === 'reset') {
            expect(response.clearCookie).toHaveBeenCalledWith('auth_token', { path: '/', httpOnly: true, secure: false, sameSite: 'lax' });
            expect(response.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/api/v1/auth', httpOnly: true, secure: false, sameSite: 'lax' });
          }
        } else {
          expect(response.json).not.toHaveBeenCalled(); expect(response.clearCookie).not.toHaveBeenCalled();
          expectInvalid(next.mock.calls[0][0], purpose);
          Reflect.apply(errorHandler.errorHandler, undefined, [next.mock.calls[0][0], {}, response, next]);
          expect(response.status).toHaveBeenCalledWith(400);
          expect(response.json).toHaveBeenCalledWith({ success: false, code: 'BAD_REQUEST', requestId: undefined,
            message: purpose === 'verification' ? 'This verification link is invalid or expired.' : 'This password reset link is invalid or expired.' });
        }
      });
    }
    it('renders generic operational failure without driver details', async () => {
      seed('reset'); failure = 'consume'; const result = await settled(redeem('reset'));
      const response = { json: vi.fn(), status: vi.fn() }; response.status.mockReturnValue(response);
      Reflect.apply(errorHandler.errorHandler, undefined, [result, {}, response, vi.fn()]);
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith({ success: false, code: 'INTERNAL_ERROR', requestId: undefined, message: 'Internal server error' });
    });
  });
  it('A14 OAuth, routes, cookie controller and state source remain unchanged during the suite', () => {
    for (const path of sourceFiles) expect(digest(source(path))).toBe(sourceHashes.get(path));
    expect(typeof service.findOrCreateGoogleUser).toBe('function');
    expect(mocks.sign).not.toHaveBeenCalled(); expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.events.some(event => /passport|google/i.test(event))).toBe(false);
  });
  describe('A15 no plaintext in logs or exposed errors', () => {
    for (const phase of ['lookup', 'lock', 'consume', 'user', 'session', 'commit', 'bcrypt'] as const) it(`${phase} secret-bearing fault is discarded`, async () => {
      seed('reset'); if (phase === 'bcrypt') mocks.hash.mockRejectedValue(fault()); else failure = phase;
      const logs = [vi.spyOn(console, 'log').mockImplementation(() => {}),
        vi.spyOn(console, 'error').mockImplementation(() => {}), vi.spyOn(console, 'warn').mockImplementation(() => {})];
      try {
        const result = await settled(redeem('reset')); expectInternal(result);
        const publicError = result instanceof Error ? `${result.name}:${result.message}:${JSON.stringify(result)}` : '';
        expect([token, proposed, digest(token)].some(value => publicError.includes(value))).toBe(false);
        expect(logs.every(log => log.mock.calls.length === 0)).toBe(true); expect(mocks.log).not.toHaveBeenCalled();
      } finally { for (const log of logs) log.mockRestore(); }
    });
    it('does not pass through an arbitrary driver AppError', async () => {
      seed('reset'); mocks.hash.mockRejectedValue(errors.AppError.badRequest(token));
      expectInternal(await settled(redeem('reset')));
    });
    it('passes only sanitized errors into the existing error-handler logger', async () => {
      seed('reset'); failure = 'consume'; const result = await settled(redeem('reset'));
      const response = { json: vi.fn(), status: vi.fn() }; response.status.mockReturnValue(response);
      Reflect.apply(errorHandler.errorHandler, undefined, [result, {}, response, vi.fn()]);
      expect(mocks.log).toHaveBeenCalledWith('app_error', { code: 'synthetic-error' });
      expectInternal(result);
    });
  });
  describe('A16 offline boundaries precede real service evaluation', () => {
    it('bootstraps guards, guarded mocks, then the real service', () => {
      expect(mocks.boundary && mocks.serviceLoaded).toBe(true);
      expect(mocks.events[0]).toBe('guards');
      expect(mocks.events.indexOf('before-service-import')).toBeLessThan(mocks.events.indexOf('mock-prisma'));
      expect(mocks.events.indexOf('mock-env')).toBeLessThan(mocks.events.indexOf('service-imported'));
      expect(mocks.events.indexOf('mock-notification')).toBeLessThan(mocks.events.indexOf('service-imported'));
      expect(mocks.forbidden).not.toHaveBeenCalled(); expect(mocks.mail).not.toHaveBeenCalled();
    });
    it('blocks all reviewed outbound mechanisms before dispatch', () => {
      const probes = [() => fetch('https://example.invalid'), () => net.connect(1, '127.0.0.1'),
        () => new net.Socket().connect(1, '127.0.0.1'), () => tls.connect(1),
        () => http.get('http://example.invalid'), () => https.request('https://example.invalid'),
        () => dns.lookup('example.invalid', () => {}), () => dns.promises.lookup('example.invalid'),
        () => new dns.Resolver().resolve('example.invalid', () => {}),
        () => new dns.promises.Resolver().resolve('example.invalid'), () => dgram.createSocket('udp4'),
        () => childProcess.spawn('not-executed'), () => childProcess.execSync('not-executed')];
      for (const probe of probes) expect(probe).toThrow('AUTH02_OFFLINE_BOUNDARY');
      expect(attempts).toHaveLength(probes.length);
    });
    it('uses only the standalone suite, no setup imports or environment loader', () => {
      const config = source('test/auth-consumption.vitest.config.ts');
      expect(config).toContain("include: ['auth-consumption.test.ts']"); expect(config).toContain('envDir: false');
      expect(config).toContain('globalSetup: [], setupFiles: []'); expect(config).not.toContain('dotenv');
      const authSource = source('src/services/auth.service.ts');
      expect(authSource).not.toContain('$queryRawUnsafe');
      expect(authSource).not.toMatch(/from ['"].*(?:passport|oauth|app)['"]/);
    });
  });
  describe('A17 existing validation and service exports stay compatible', () => {
    it('uses real token/password validators and their existing bounds', () => {
      expect(schemas.tokenSchema.safeParse({ token }).success).toBe(true);
      expect(schemas.tokenSchema.safeParse({ token: 'short' }).success).toBe(false);
      expect(schemas.tokenSchema.safeParse({ token: 'x'.repeat(513) }).success).toBe(false);
      expect(schemas.resetPasswordSchema.safeParse({ token, password: proposed }).success).toBe(true);
      expect(schemas.resetPasswordSchema.safeParse({ token, password: 'weak' }).success).toBe(false);
    });
    it('retains all public auth exports and original callers', () => {
      expect(Object.keys(service).filter(key => key !== 'default').sort()).toEqual([
        'findOrCreateGoogleUser', 'getMe', 'isSessionActive', 'login', 'refreshSession', 'register',
        'requestPasswordReset', 'resendVerification', 'resetPassword', 'revokeSessionById', 'revokeUserSessions', 'verifyEmail',
      ].sort());
      expect(source('test/oauth-state.test.ts')).toContain('findOrCreateGoogleUser');
      expect(source('src/controllers/auth.controller.ts')).toContain('await authService.resetPassword(req.body)');
    });
  });
  it('A18 strict-compatible config and typed real-service signatures', () => {
    const verify: (token: string) => Promise<void> = service.verifyEmail;
    const reset: (input: { token: string; password: string }) => Promise<void> = service.resetPassword;
    expect(typeof verify).toBe('function'); expect(typeof reset).toBe('function');
    expect(source('test/auth-consumption.vitest.config.ts')).toContain('module.exports = authConsumptionConfig');
    // Actual no-emit compilation and both loader invocations are separate mandatory command gates.
  });
});
