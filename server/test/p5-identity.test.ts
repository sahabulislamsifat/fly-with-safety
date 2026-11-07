/** OFFLINE: real Express routers/authentication/identity services; mocked SQL boundary, no database or mail. */
import express from 'express';
import jwt from 'jsonwebtoken';
import { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { Duplex } from 'node:stream';
import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../src/generated/prisma/client.js';

const fake = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), transaction: vi.fn(), findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), history: vi.fn(), account: vi.fn(), user: vi.fn() }));
vi.mock('../src/lib/prisma.js', () => ({ prisma: { $queryRaw: fake.query, $executeRaw: fake.execute, $transaction: fake.transaction,
  flightInquiry: { findMany: fake.findMany, count: fake.count }, account: { findUnique: fake.account }, booking: { findMany: fake.findMany, count: fake.count, findUnique: fake.findUnique, findFirst: fake.findFirst } } }));
vi.mock('../src/config/env.js', () => ({ env: { nodeEnv: 'test', jwtSecret: 'offline-test-secret-not-used-outside-test', smtp: {} } }));
vi.mock('../src/services/notification.service.js', () => ({ sendEmailRaw: vi.fn(() => { throw Error('MAIL_FORBIDDEN'); }), sendBookingStatusNotification: vi.fn(async () => undefined) }));
vi.mock('pg', () => { throw Error('DATABASE_FORBIDDEN'); });
vi.mock('dotenv', () => { throw Error('ENV_FILE_FORBIDDEN'); });
import identityRoutes from '../src/identity/routes.js';
import adminRoutes from '../src/routes/admin.routes.js';
import accountRoutes from '../src/routes/account.routes.js';
import { requireAuth, requireRole } from '../src/middleware/auth.middleware.js';
import { adminPolicy, paymentPolicy } from '../src/identity/middleware.js';
import { identityContext, type Principal } from '../src/identity/policy.js';
import { assertRecordScope } from '../src/identity/store.js';
import { base32, hash, matchStep, open, seal, totp } from '../src/identity/crypto.js';
import { isAppError } from '../src/utils/errors.js';
import { provisionPrimaryOwner } from '../src/identity/bootstrap.js';
import { findOrCreateGoogleUser } from '../src/services/auth.service.js';

const originalFlag = process.env.IDENTITY_SCOPE_ENABLED, originalKey = process.env.IDENTITY_MFA_KEY;
let principal: Principal, suspended: boolean, valid: boolean, assigned: boolean;
const tag = (sql: Prisma.Sql) => /\/\*p5:([^*]+)\*\//.exec(sql.sql)?.[1];
let writes: string[];
let mfaFailures: number, factor: { secret: string | null; pendingSecret: string | null; pendingValid: boolean; lastStep: bigint; recoveryHashes: string[] };
const clock = new Date(1234567890000), authenticator = base32(Buffer.from('12345678901234567890'));
let requestNumber = 0;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.IDENTITY_SCOPE_ENABLED = 'true';
  process.env.IDENTITY_MFA_KEY = Buffer.alloc(32, 17).toString('base64');
  principal = { id: 'synthetic-actor', sessionId: 'synthetic-session', email: 'employee@example.invalid', name: null, role: 'STAFF', version: 3, mfaVersion: 1, mfaVerified: true, departments: ['FLIGHT'] };
  suspended = false; valid = true; assigned = true; writes = [];
  mfaFailures = 0; factor = { secret: seal(authenticator, principal.id), pendingSecret: null, pendingValid: false, lastStep: -1n, recoveryHashes: [hash(principal.id + ':' + 'f'.repeat(32))] };
  fake.execute.mockImplementation(async (sql: Prisma.Sql) => {
    const operation = tag(sql); writes.push(operation!);
    if (operation === 'mfa-failed') mfaFailures = Number(sql.values[0]);
    if (operation === 'mfa-reset-failures') mfaFailures = 0;
    if (operation === 'mfa-step') factor.lastStep = BigInt(sql.values[0] as bigint);
    if (operation === 'recovery-consume') factor.recoveryHashes = [];
    return 1;
  });
  fake.query.mockImplementation(async (sql: Prisma.Sql) => {
    switch (tag(sql)) {
      case 'session': return [{ ...principal, suspended, valid: valid && sql.values.includes(principal.version), verified: true }];
      case 'memberships': return principal.departments.map(department => ({ department }));
      case 'policy-lock': return [{ lock: '' }];
      case 'lock-principal': return [{ ok: !suspended && valid }];
      case 'target-account': return [{ role: 'CUSTOMER' }];
      case 'customers': return [];
      case 'scope-lock': return assigned ? [{ id: 'synthetic-assignment' }] : [];
      case 'booking-type': return [{ bookingType: 'FLIGHT' }];
      case 'assigned': return assigned ? [{ id: 'synthetic-assigned' }] : [];
      case 'invite-consume': return []; // expired/used/unknown tokens are unavailable
      case 'invite-existing': return [];
      case 'bootstrap-target': return [{ database: 'flywithsafety_p5_disposable_example', oid: 99999 }];
      case 'bootstrap-existing': return [];
      case 'bootstrap-user': return [{ id: 'owner-exact-id' }];
      case 'audit-read': return [];
      case 'challenge': return [{ blocked: mfaFailures >= 5, failures: mfaFailures }];
      case 'factor': return [factor];
      case 'clock': return [{ now: clock }];
      default: if (/SELECT id FROM public\."Booking" WHERE id =/.test(sql.sql)) return [{ id: 'synthetic-assigned' }];
        throw Error('UNEXPECTED_OFFLINE_QUERY:' + tag(sql));
    }
  });
  fake.findMany.mockResolvedValue([]); fake.count.mockResolvedValue(0);
  fake.findUnique.mockResolvedValue({ id: 'synthetic-assigned', referenceNumber: 'SYNTHETIC', status: 'PENDING', bookingType: 'FLIGHT', totalPrice: 0, currency: 'BDT', passengers: [], statusHistory: [], bookingDetails: {}, createdAt: new Date(), updatedAt: new Date() });
  fake.findFirst.mockResolvedValue(null); fake.update.mockResolvedValue({ id: 'synthetic-assigned', status: 'CONFIRMED' }); fake.history.mockResolvedValue({});
  fake.account.mockResolvedValue(null); fake.user.mockResolvedValue({ id: 'privileged', role: 'ADMIN' });
  fake.transaction.mockImplementation(async (work: (db: unknown) => unknown) => work({ $queryRaw: fake.query, $executeRaw: fake.execute, booking: { findUnique: fake.findUnique, update: fake.update }, bookingStatusHistory: { create: fake.history }, user: { findUnique: fake.user } }));
});
afterAll(() => {
  if (originalFlag === undefined) delete process.env.IDENTITY_SCOPE_ENABLED; else process.env.IDENTITY_SCOPE_ENABLED = originalFlag;
  if (originalKey === undefined) delete process.env.IDENTITY_MFA_KEY; else process.env.IDENTITY_MFA_KEY = originalKey;
});
function app() {
  const app = express(); app.use(express.json()); app.use('/api/v1', identityRoutes); app.use('/api/v1', adminRoutes); app.use('/api/v1', accountRoutes);
  app.use('/api/v1/admin', requireAuth, requireRole('ADMIN', 'STAFF'), adminPolicy);
  app.get('/api/v1/admin/inquiries/flights', (_q, r) => r.json({ ok: true }));
  app.get('/api/v1/admin/inquiries/hotels', (_q, r) => r.json({ ok: true }));
  app.get('/api/v1/admin/testimonials', (_q, r) => r.json({ ok: true }));
  app.get('/api/v1/admin/unknown', (_q, r) => r.json({ ok: true }));
  app.post('/api/v1/admin/bookings/:id/status', async (q, r, next) => {
    try { await assertRecordScope({ $queryRaw: fake.query, $executeRaw: fake.execute }, 'booking', q.params.id, true); r.json({ ok: true }); } catch (e) { next(e); }
  });
  app.use('/api/v1/payments', requireAuth, paymentPolicy);
  app.get('/api/v1/payments/operations', (_q, r) => r.json({ ok: true }));
  app.use((error: unknown, _q: express.Request, r: express.Response, _next: express.NextFunction) => {
    r.status(isAppError(error) ? error.statusCode : 500).json({ code: isAppError(error) ? error.code : 'INTERNAL_ERROR' });
  });
  return app;
}
/** No listening socket: execute actual Express HTTP parsing and middleware in memory. */
function request(method: string, path: string, body: object = {}, version: number | null = principal.version, authenticated = true) {
  const text = JSON.stringify(body), server = app();
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = new Duplex({ read() {}, write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
    Object.defineProperty(stream, 'remoteAddress', { value: '127.0.0.' + (++requestNumber % 250 + 1) });
    const req = new IncomingMessage(stream as Socket); req.method = method; req.url = path;
    req.headers = { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(text)), ...(authenticated ? { authorization: 'Bearer ' + jwt.sign({ sub: principal.id, sid: principal.sessionId, role: 'SUPER_ADMIN', ...(version === null ? {} : { ver: version }) }, 'offline-test-secret-not-used-outside-test') } : {}) };
    const res = new ServerResponse(req); res.assignSocket(stream as Socket);
    res.once('finish', () => { resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }); stream.destroy(); });
    stream.once('error', reject); req.complete = true; server(req, res); req.push(text); req.push(null);
  });
}
describe('Identity actual HTTP routes, mocked database', () => {
  it('anonymous identity governance is denied', async () => { expect((await request('GET', '/api/v1/identity/audit', {}, 3, false)).status).toBe(401); expect(writes).toEqual([]); });
  it('pre-rollout tokens without a version require sign-in again', async () => { expect((await request('GET', '/api/v1/identity/me', {}, null)).status).toBe(401); });
  it('uses current database role instead of signed stale SUPER_ADMIN claim', async () => { expect((await request('GET', '/api/v1/identity/me')).text).toContain('STAFF'); });
  it.each(['CUSTOMER', 'STAFF', 'ADMIN'] as const)('%s cannot read governance audit', async role => { principal.role = role; expect((await request('GET', '/api/v1/identity/audit')).status).toBe(403); });
  it('owner with MFA can read audit', async () => { principal.role = 'SUPER_ADMIN'; expect((await request('GET', '/api/v1/identity/audit')).status).toBe(200); });
  it('suspension rejects active JWT', async () => { suspended = true; expect((await request('GET', '/api/v1/identity/me')).status).toBe(401); });
  it('changed authorization version rejects stale JWT', async () => { expect((await request('GET', '/api/v1/identity/me', {}, 2)).status).toBe(401); });
  it('revoked proof rejects session', async () => { valid = false; expect((await request('GET', '/api/v1/identity/me')).status).toBe(401); });
  it('unknown persisted role is denied', async () => { fake.query.mockResolvedValueOnce([{ ...principal, role: 'UNKNOWN', valid: true, verified: true }]); expect((await request('GET', '/api/v1/identity/me')).status).toBe(401); });
  it('staff cannot self-promote', async () => { expect((await request('PATCH', '/api/v1/identity/users/synthetic-actor', { role: 'ADMIN', reason: 'ROLE_POLICY' })).status).toBe(403); expect(writes).toEqual([]); });
  it('admin cannot assign owner role even with MFA', async () => { principal.role = 'ADMIN'; expect((await request('PATCH', '/api/v1/identity/users/target', { role: 'SUPER_ADMIN', reason: 'ROLE_POLICY' })).status).toBe(400); expect(writes).toEqual([]); });
  it('admin cannot change staff roles', async () => { principal.role = 'ADMIN'; expect((await request('PATCH', '/api/v1/identity/users/target', { role: 'ADMIN', reason: 'ROLE_POLICY' })).status).toBe(403); });
  it('privileged MFA is required for administration', async () => { principal.role = 'SUPER_ADMIN'; principal.mfaVerified = false; expect((await request('GET', '/api/v1/identity/audit')).status).toBe(403); });
  it('suspension atomically requests version invalidation, session revocation and audit', async () => { principal.role = 'ADMIN'; expect((await request('PATCH', '/api/v1/identity/users/target', { suspended: true, reason: 'ACCOUNT_SUPPORT' })).status).toBe(200); expect(writes).toEqual(['ensure-account', 'suspend', 'invalidate', 'revoke', 'audit']); });
  it('expired or already used invitations cannot activate', async () => { expect((await request('POST', '/api/v1/identity/invitations/accept', { token: 'a'.repeat(43), password: 'SyntheticOnly!Password349', name: 'Synthetic' })).status).toBe(400); expect(writes).toEqual([]); });
  it('staff cannot invite another privileged identity', async () => { expect((await request('POST', '/api/v1/identity/invitations', { email: 'new@example.invalid', role: 'STAFF', departments: ['FLIGHT'] })).status).toBe(403); });
  it('admin cannot invite an administrator', async () => { principal.role = 'ADMIN'; expect((await request('POST', '/api/v1/identity/invitations', { email: 'new@example.invalid', role: 'ADMIN', departments: ['FLIGHT'] })).status).toBe(403); });
  it('admin cannot delegate outside own departments', async () => { principal.role = 'ADMIN'; expect((await request('POST', '/api/v1/identity/invitations', { email: 'new@example.invalid', role: 'STAFF', departments: ['HOTEL'] })).status).toBe(403); });
  it('approved invitation stores only a token digest and never returns bearer to issuer', async () => {
    principal.role = 'ADMIN';
    const savedDelivery = process.env.IDENTITY_INVITATION_DELIVERY_APPROVED; delete process.env.IDENTITY_INVITATION_DELIVERY_APPROVED;
    try {
      const result = await request('POST', '/api/v1/identity/invitations', { email: 'new@example.invalid', role: 'STAFF', departments: ['FLIGHT'] });
      expect(result.status).toBe(201); expect(result.text).toContain('UNAVAILABLE');
      const entry = fake.execute.mock.calls.map(args => args[0] as Prisma.Sql).find(sql => tag(sql) === 'invite-create')!;
      expect(entry.values.some(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value))).toBe(true);
      expect(result.text).not.toMatch(/"token"|"password"|https?:/);
      expect(writes).toEqual(['invite-create', 'audit']);
    } finally { if (savedDelivery !== undefined) process.env.IDENTITY_INVITATION_DELIVERY_APPROVED = savedDelivery; }
  });
  it('invitation recipient cannot be replaced through public input', async () => { expect((await request('POST', '/api/v1/identity/invitations/accept', { token: 'a'.repeat(43), password: 'SyntheticOnly!Password349', name: 'Synthetic', email: 'other@example.invalid' })).status).toBe(400); expect(writes).toEqual([]); });
  it('owner cannot remove own last-owner protection via role endpoint', async () => { principal.role = 'SUPER_ADMIN'; expect((await request('PATCH', '/api/v1/identity/users/synthetic-actor', { role: 'CUSTOMER', reason: 'ROLE_POLICY' })).status).toBe(403); });
  it('staff cannot read global customer directory', async () => { expect((await request('GET', '/api/v1/identity/customers')).status).toBe(403); });
  it('staff cannot read content management', async () => { expect((await request('GET', '/api/v1/admin/testimonials')).status).toBe(403); });
  it('unmapped administration routes fail closed even for owner', async () => { principal.role = 'SUPER_ADMIN'; expect((await request('GET', '/api/v1/admin/unknown')).status).toBe(403); });
  it('department scope denies hotel to flight staff', async () => { expect((await request('GET', '/api/v1/admin/inquiries/hotels')).status).toBe(403); });
  it('permits own department route', async () => { expect((await request('GET', '/api/v1/admin/inquiries/flights')).status).toBe(200); });
  it('actual inquiry route constrains Prisma list and count to assigned IDs', async () => { await request('GET', '/api/v1/admin/inquiries/flights'); expect(fake.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['synthetic-assigned'] } } })); expect(fake.count).toHaveBeenCalledWith({ where: { id: { in: ['synthetic-assigned'] } } }); });
  it('actual bookings list uses an empty assignment filter rather than global access', async () => { assigned = false; expect((await request('GET', '/api/v1/admin/bookings')).status).toBe(200); expect(fake.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [] } } })); });
  it('actual booking PATCH denies unassigned staff even for no-op transition', async () => { assigned = false; expect((await request('PATCH', '/api/v1/admin/bookings/foreign/status', { status: 'PENDING' })).status).toBe(404); });
  it('actual scoped booking PATCH writes status/history/audit through one transaction', async () => { expect((await request('PATCH', '/api/v1/admin/bookings/synthetic-assigned/status', { status: 'CONFIRMED' })).status).toBe(200); expect(fake.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CONFIRMED' }) })); expect(fake.history).toHaveBeenCalled(); expect(writes).toContain('audit'); });
  it('actual customer booking detail cannot escape current user ownership', async () => { principal.role = 'CUSTOMER'; expect((await request('GET', '/api/v1/account/bookings/FOREIGN')).status).toBe(404); expect(fake.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: principal.id, referenceNumber: 'FOREIGN' } })); });
  it('customer list always includes current owner ID', async () => { principal.role = 'CUSTOMER'; expect((await request('GET', '/api/v1/account/bookings')).status).toBe(200); expect(fake.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: principal.id } })); });
  it('unassigned booking mutation is hidden and denied', async () => { assigned = false; expect((await request('POST', '/api/v1/admin/bookings/foreign/status')).status).toBe(404); });
  it('assigned product booking passes record scope', async () => { expect((await request('POST', '/api/v1/admin/bookings/assigned/status')).status).toBe(200); });
  it('finance staff cannot mutate flight booking', async () => { principal.departments = ['FINANCE']; expect((await request('POST', '/api/v1/admin/bookings/assigned/status')).status).toBe(404); });
  it('staff cannot access global payment operations', async () => { expect((await request('GET', '/api/v1/payments/operations')).status).toBe(403); });
  it('customers cannot enter staff administration', async () => { principal.role = 'CUSTOMER'; expect((await request('GET', '/api/v1/admin/inquiries/flights')).status).toBe(403); });
  it('missing request identity fails closed inside scoped service', async () => { await expect(assertRecordScope({ $queryRaw: fake.query, $executeRaw: fake.execute }, 'booking', 'id')).rejects.toMatchObject({ statusCode: 401 }); });
  it('direct service access requires privileged MFA too', async () => { principal.role = 'ADMIN'; principal.mfaVerified = false; await expect(identityContext.run(principal, () => assertRecordScope({ $queryRaw: fake.query, $executeRaw: fake.execute }, 'booking', 'id'))).rejects.toMatchObject({ code: 'MFA_REQUIRED' }); });
  it('actual MFA endpoint accepts once and audits, then rejects OTP replay', async () => {
    principal.mfaVerified = false;
    const code = totp(authenticator, BigInt(Math.floor(+clock / 30000)));
    expect((await request('POST', '/api/v1/identity/mfa/verify', { code })).status).toBe(200);
    expect(writes).toContain('mfa-proof'); expect(writes).toContain('audit');
    expect((await request('POST', '/api/v1/identity/mfa/verify', { code })).status).toBe(401);
  });
  it('recovery code is consumed once and revokes other sessions', async () => {
    expect((await request('POST', '/api/v1/identity/mfa/recover', { code: 'f'.repeat(32) })).status).toBe(200);
    expect(writes).toContain('mfa-revoke-other');
    expect((await request('POST', '/api/v1/identity/mfa/recover', { code: 'f'.repeat(32) })).status).toBe(401);
  });
  it('MFA account lockout survives a new session and different client IP', async () => {
    factor.secret = null;
    for (let i = 0; i < 5; i++) expect((await request('POST', '/api/v1/identity/mfa/verify', { code: '000000' })).status).toBe(401);
    principal.sessionId = 'another-synthetic-session';
    expect((await request('POST', '/api/v1/identity/mfa/verify', { code: '000000' })).status).toBe(429);
    expect(mfaFailures).toBe(5);
  });
  it('an expired pending factor cannot enroll', async () => {
    factor.pendingSecret = seal(authenticator, principal.id); factor.pendingValid = false;
    expect((await request('POST', '/api/v1/identity/mfa/confirm', { code: totp(authenticator, BigInt(Math.floor(+clock / 30000))) })).status).toBe(401);
    expect(writes).not.toContain('mfa-confirm');
  });
});
describe('Google privileged identity linking boundary (offline)', () => {
  it.each([undefined, false])('unverified Google evidence %s is rejected before DB lookup', async emailVerified => {
    await expect(findOrCreateGoogleUser({ googleId: 'synthetic-google', email: 'employee@example.invalid', emailVerified })).rejects.toMatchObject({ statusCode: 401 });
    expect(fake.account).not.toHaveBeenCalled();
  });
  it('verified Google email cannot implicitly link an existing privileged account', async () => {
    await expect(findOrCreateGoogleUser({ googleId: 'synthetic-google', email: 'employee@example.invalid', emailVerified: true })).rejects.toMatchObject({ statusCode: 403 });
    expect(writes).toEqual([]);
  });
});
describe('Primary owner provisioning component (mocked database only)', () => {
  const approved = { userId: 'owner-exact-id', verifiedEmail: 'owner@example.invalid', expectedDatabase: 'flywithsafety_p5_disposable_example', expectedOid: 99999, ownerApproved: true };
  const client = () => ({ $transaction: fake.transaction });
  it('has no automatic provisioning without exact owner approval', async () => { await expect(provisionPrimaryOwner(client(), { ...approved, ownerApproved: false })).rejects.toThrow('APPROVAL_REQUIRED'); expect(writes).toEqual([]); });
  it('rejects a different target database/OID', async () => { await expect(provisionPrimaryOwner(client(), { ...approved, expectedOid: 88888 })).rejects.toThrow('TARGET_MISMATCH'); expect(writes).toEqual([]); });
  it('only exact verified MFA identity is promoted, revoked and audited', async () => { expect(await provisionPrimaryOwner(client(), approved)).toMatchObject({ provisioned: true, sessionsRevoked: true }); expect(writes).toEqual(['bootstrap-role', 'invalidate', 'revoke', 'audit']); });
  it('will not provision a second primary owner', async () => { const base = fake.query.getMockImplementation()!; fake.query.mockImplementation((sql: Prisma.Sql) => tag(sql) === 'bootstrap-existing' ? [{ id: 'existing-owner' }] : base(sql)); await expect(provisionPrimaryOwner(client(), approved)).rejects.toThrow('ALREADY_EXISTS'); expect(writes).toEqual([]); });
});
describe('MFA cryptographic boundaries', () => {
  const secret = base32(Buffer.from('12345678901234567890'));
  it.each([[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']] as const)('RFC6238 SHA1 vector %s', (seconds, expected) => { expect(totp(secret, BigInt(Math.floor(seconds / 30)), 8)).toBe(expected); });
  it('used TOTP step cannot be replayed', () => { const now = new Date(1234567890000), step = BigInt(Math.floor(+now / 30000)); expect(matchStep(secret, totp(secret, step), now, step)).toBeUndefined(); });
  it('accepts a fresh current step', () => { const now = new Date(1234567890000), step = BigInt(Math.floor(+now / 30000)); expect(matchStep(secret, totp(secret, step), now, step - 1n)).toBe(step); });
  it('malformed code is denied', () => { expect(matchStep(secret, 'secret', new Date(), -1n)).toBeUndefined(); });
  it('ciphertext is randomized and bound to exact identity', () => { const one = seal(secret, 'one'), two = seal(secret, 'one'); expect(one).not.toBe(two); expect(open(one, 'one')).toBe(secret); expect(() => open(one, 'two')).toThrow(); });
  it('tampered ciphertext fails authentication', () => { const parts = seal(secret, 'one').split('.'); parts[2] = Buffer.alloc(20).toString('base64url'); expect(() => open(parts.join('.'), 'one')).toThrow(); });
  it('missing private key fails closed', () => { delete process.env.IDENTITY_MFA_KEY; expect(() => seal(secret, 'one')).toThrow('MFA key configuration unavailable'); });
});
