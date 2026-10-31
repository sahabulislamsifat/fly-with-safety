import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import {createServer, type Server} from 'node:http';
import {randomUUID} from 'node:crypto';
import jwt from 'jsonwebtoken';
import type {ProtectedAuthServices} from '../src/services/protected-auth.service.js';
import type {createCompatibleOutboxWorker} from '../src/services/compatible-outbox.service.js';

const mocks = vi.hoisted(() => ({session: vi.fn(), register: vi.fn(), reset: vi.fn(), run: vi.fn(), redrive: vi.fn(), workerAllowed: true}));
// Only leaf services/persistence are doubled. Real Express, request parsing,
// controllers, origin/auth/role middleware, JWT, cookies and error logger execute.
// A loopback-only listener is used; this is HTTP component proof, NOT real DB proof.
vi.mock('../src/services/auth.service.js', () => ({}));
vi.mock('../src/lib/prisma.js', () => ({prisma: {session: {findFirst: mocks.session}}}));
vi.mock('../src/config/env.js', () => ({env: {nodeEnv: 'production', corsOrigins: ['https://synthetic.example.invalid'],
  refreshTokenExpiresDays: 1, accessTokenCookieMaxAgeMs: 900000, jwtSecret: 'HTTP-COMPONENT-SYNTHETIC-ONLY'}}));
vi.mock('pg', () => {throw new Error('HTTP_COMPONENT_DATABASE_FORBIDDEN');});
vi.mock('dotenv', () => {throw new Error('HTTP_COMPONENT_ENV_FORBIDDEN');});
vi.mock('nodemailer', () => {throw new Error('HTTP_COMPONENT_SMTP_FORBIDDEN');});
import {createProtectedAuthController} from '../src/controllers/auth.controller.js';
import {createCompatibleOutboxController} from '../src/controllers/compatible-outbox.controller.js';
import {protectRequestOrigin} from '../src/middleware/request-origin.js';
import {requireAuth, requireRole} from '../src/middleware/auth.middleware.js';
import {errorHandler} from '../src/middleware/error-handler.js';

const session = {user: {id: 'synthetic-user', email: 'synthetic@example.invalid', name: null, role: 'CUSTOMER' as const, emailVerified: false},
  accessToken: 'SYNTHETIC-ACCESS', refreshToken: 'SYNTHETIC-REFRESH'};
const service: ProtectedAuthServices = {registerRequest: mocks.register, resetPassword: mocks.reset,
  register: vi.fn(), resendVerification: vi.fn(), requestPasswordReset: vi.fn(), verifyEmail: vi.fn(), revokeUserSessions: vi.fn(),
  requestPasswordResetOnce: vi.fn(), resendVerificationOnce: vi.fn()};
const token = (role = 'CUSTOMER') => jwt.sign({sub: session.user.id, email: session.user.email, role, sid: 'synthetic-session'}, 'HTTP-COMPONENT-SYNTHETIC-ONLY', {expiresIn: 60});
let server: Server;
beforeAll(async () => {
  const app = express(), auth = createProtectedAuthController(service);
  app.use(express.json({limit: '2kb'}), cookieParser(), protectRequestOrigin);
  app.post('/register', auth.register); app.post('/reset', auth.resetPassword);
  app.get('/admin', requireAuth, requireRole('ADMIN'), (_req, res) => res.json({ok: true}));
  const worker = createCompatibleOutboxController({worker: {run: mocks.run, redrive: mocks.redrive} as unknown as ReturnType<typeof createCompatibleOutboxWorker>,
    admitWorker: async () => mocks.workerAllowed ? {workerId: 'synthetic-worker'} : null,
    admitOperator: async () => ({operatorId: 'synthetic-admin'})});
  app.all('/worker', worker.run);
  app.post('/redrive/:id', requireAuth, requireRole('ADMIN'), worker.redrive);
  app.use(errorHandler);
  server = createServer(app);
  await new Promise<void>((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
});
afterAll(async () => {if (server?.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));});
beforeEach(() => {
  vi.clearAllMocks(); mocks.workerAllowed = true;
  mocks.register.mockResolvedValue({status: 'created', session}); mocks.reset.mockResolvedValue(undefined);
  mocks.session.mockResolvedValue({id: 'synthetic-session'}); mocks.run.mockResolvedValue({processed: 0}); mocks.redrive.mockResolvedValue(true);
});
afterEach(() => vi.restoreAllMocks());

describe('actual loopback HTTP boundaries; service and storage doubled', () => {
  it('registration sets only HttpOnly secure session cookies, never bearer secrets in JSON', async () => {
    const response = await request(server).post('/register').set('Idempotency-Key', randomUUID()).send({email: session.user.email});
    expect(response.status).toBe(201); expect(response.headers['cache-control']).toBe('no-store');
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies).toHaveLength(2);
    for (const cookie of cookies) expect(cookie).toMatch(/HttpOnly; Secure; SameSite=None/);
    expect(cookies[1]).toContain('Path=/api/v1/auth'); expect(response.text).not.toMatch(/SYNTHETIC-ACCESS|SYNTHETIC-REFRESH/);
  });
  it('replay cannot create/clear cookies or claim an authenticated session', async () => {
    mocks.register.mockResolvedValue({status: 'replayed'});
    const response = await request(server).post('/register').set('Idempotency-Key', randomUUID()).send({});
    expect(response.status).toBe(200); expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.body).toEqual({success: true, data: {registration: 'replayed', requiresSignIn: true}});
  });
  it('rejects missing request identity before service dispatch', async () => {
    expect((await request(server).post('/register').send({})).status).toBe(400); expect(mocks.register).not.toHaveBeenCalled();
  });
  for (const origin of ['null', 'https://evil.example.invalid', 'https://synthetic.example.invalid/', 'https://synthetic.example.invalid.evil']) it('denies untrusted browser origin ' + origin, async () => {
    const response = await request(server).post('/register').set('Origin', origin).set('Idempotency-Key', randomUUID()).send({});
    expect(response.status).toBe(403); expect(mocks.register).not.toHaveBeenCalled(); expect(response.headers['set-cookie']).toBeUndefined();
  });
  it('originless cookie requests cannot reach protected issuance', async () => {
    const response = await request(server).post('/register').set('Cookie', 'auth_token=SYNTHETIC').set('Idempotency-Key', randomUUID()).send({});
    expect(response.status).toBe(403); expect(mocks.register).not.toHaveBeenCalled();
  });
  it('trusted browser origin reaches the same controller', async () => {
    expect((await request(server).post('/register').set('Origin', 'https://synthetic.example.invalid').set('Idempotency-Key', randomUUID()).send({})).status).toBe(201);
  });
  it('malformed JSON is sanitized before service dispatch', async () => {
    const response = await request(server).post('/register').set('Content-Type', 'application/json').send('{SYNTHETIC_PRIVATE');
    expect(response.status).toBe(400); expect(response.text).not.toContain('SYNTHETIC_PRIVATE'); expect(mocks.register).not.toHaveBeenCalled();
  });
  it('unrestricted thrown secrets do not enter HTTP output or actual logger sink', async () => {
    const logs = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.register.mockRejectedValue(new Error('SYNTHETIC_PRIVATE_TOKEN_PASSWORD_SQL'));
    const response = await request(server).post('/register').set('Idempotency-Key', randomUUID()).send({});
    expect(response.status).toBe(500); expect(response.body.code).toBe('INTERNAL_ERROR');
    expect(response.text + JSON.stringify(logs.mock.calls)).not.toContain('SYNTHETIC_PRIVATE_TOKEN_PASSWORD_SQL');
    expect(logs).toHaveBeenCalledTimes(1);
  });
  it('successful reset clears both cookies with their original scope', async () => {
    const response = await request(server).post('/reset').send({token: 'SYNTHETIC', password: 'SYNTHETIC'});
    expect(response.status).toBe(200); const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies).toHaveLength(2); expect(cookies[0]).toMatch(/^auth_token=;/); expect(cookies[1]).toContain('Path=/api/v1/auth');
  });
  it('missing or malformed authentication never reaches privileged paths', async () => {
    expect((await request(server).get('/admin')).status).toBe(401);
    expect((await request(server).get('/admin').set('Authorization', 'Bearer invalid')).status).toBe(401);
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it('signed token with revoked/missing durable session is denied', async () => {
    mocks.session.mockResolvedValue(null);
    expect((await request(server).get('/admin').set('Authorization', 'Bearer ' + token('ADMIN'))).status).toBe(401);
    expect(mocks.session).toHaveBeenCalledWith(expect.objectContaining({where: expect.objectContaining({revokedAt: null, expiresAt: {gt: expect.any(Date)}})}));
  });
  it('customer role cannot cross the admin boundary', async () => {
    expect((await request(server).get('/admin').set('Authorization', 'Bearer ' + token())).status).toBe(403);
  });
  it('valid admin with active durable session passes', async () => {
    expect((await request(server).get('/admin').set('Authorization', 'Bearer ' + token('ADMIN'))).body).toEqual({ok: true});
  });
  it('worker endpoint rejects browser origin even with trusted worker identity', async () => {
    expect((await request(server).get('/worker').set('Origin', 'https://synthetic.example.invalid')).status).toBe(403); expect(mocks.run).not.toHaveBeenCalled();
  });
  it('worker admission is required independently of browser/admin authentication', async () => {
    mocks.workerAllowed = false; expect((await request(server).get('/worker')).status).toBe(401); expect(mocks.run).not.toHaveBeenCalled();
  });
  it('worker method and dispatcher arguments cannot be overridden by request parameters', async () => {
    expect((await request(server).post('/worker').send({})).status).toBe(405);
    const response = await request(server).get('/worker?limit=999&worker=attacker');
    expect(response.status).toBe(200); expect(mocks.run).toHaveBeenCalledExactlyOnceWith('synthetic-worker');
  });
  it('ordinary redrive requires actual admin middleware and exact snapshot version', async () => {
    const body = {source: 'ordinary', version: '2026-10-30T00:00:00.000Z'};
    expect((await request(server).post('/redrive/synthetic-job').send(body)).status).toBe(401);
    expect((await request(server).post('/redrive/synthetic-job').set('Authorization', 'Bearer ' + token()).send(body)).status).toBe(403);
    expect(mocks.redrive).not.toHaveBeenCalled();
    expect((await request(server).post('/redrive/synthetic-job').set('Authorization', 'Bearer ' + token('ADMIN')).send(body)).status).toBe(200);
    expect(mocks.redrive).toHaveBeenCalledExactlyOnceWith('ordinary', 'synthetic-job', body.version, 'synthetic-admin');
  });
});
