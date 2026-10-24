import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import passport, { configureGoogleStrategy } from '../src/config/passport.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { Prisma } from '../src/generated/prisma/client.js';
import * as authService from '../src/services/auth.service.js';

const original = { clientId: env.googleClientId, clientSecret: env.googleClientSecret, callbackUrl: env.googleCallbackUrl };
const originalNodeEnv = env.nodeEnv;
let consumed: Set<string>;
let exchange: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consumed = new Set();
  configureGoogleStrategy({ clientId: 'synthetic-client', clientSecret: 'synthetic-secret', callbackUrl: 'http://localhost:5000/api/v1/auth/google/callback' });
  const strategy = (passport as any)._strategy('google');
  exchange = vi.spyOn(strategy._oauth2, 'getOAuthAccessToken').mockImplementation((...args: any[]) => args[2](null, 'synthetic-access', 'synthetic-refresh', {}));
  vi.spyOn(strategy, 'userProfile').mockImplementation((...args: any[]) => args[1](null, { id: 'synthetic-google', emails: [{ value: 'synthetic@example.test' }] }));
  vi.spyOn(authService, 'findOrCreateGoogleUser').mockResolvedValue({
    user: { id: 'synthetic-user', email: 'synthetic@example.test', name: null, role: 'CUSTOMER', emailVerified: true },
    accessToken: 'synthetic-session-access', refreshToken: 'synthetic-session-refresh',
  });
  // Simulates a shared unique index across strategy instances, not PostgreSQL locking.
  vi.spyOn(prisma.idempotencyRecord, 'create').mockImplementation(async ({ data }: any) => {
    if (consumed.has(data.key)) throw new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' });
    consumed.add(data.key); return data;
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); env.nodeEnv = originalNodeEnv; configureGoogleStrategy(original); });
async function begin() {
  const res = await request(app).get('/api/v1/auth/google');
  expect(res.status).toBe(302);
  return { state: new URL(res.headers.location).searchParams.get('state')!, cookie: res.headers['set-cookie'][0].split(';')[0], res };
}
function callback(state: string) { return request(app).get('/api/v1/auth/google/callback').query({ state, code: 'synthetic-code' }); }
it('binds a valid flow, sets session cookies, cleans state and keeps tokens out of redirects', async () => {
  const flow = await begin(); const res = await callback(flow.state).set('Cookie', flow.cookie);
  expect(res.status).toBe(302); expect(res.headers.location).toBe(`${env.frontendUrl}?auth=success`);
  expect(exchange).toHaveBeenCalledOnce();
  expect(res.headers['set-cookie'].some((c: string) => c.startsWith('auth_token='))).toBe(true);
  expect(res.headers['set-cookie'].some((c: string) => c.includes('google_oauth_state=;'))).toBe(true);
  expect(res.headers['cache-control']).toBe('no-store');
});
it('generates independent unpredictable states', async () => {
  const a = await begin(), b = await begin();
  expect(a.state).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(a.state).not.toBe(b.state);
});
it.each(['missing', 'mismatch', 'other-browser', 'no-cookie', 'tampered', 'duplicate'])('rejects %s binding before exchange', async kind => {
  const a = await begin(); let state: unknown = a.state, cookie = a.cookie;
  if (kind === 'missing') state = undefined;
  if (kind === 'mismatch') state = 'x'.repeat(43);
  if (kind === 'other-browser') cookie = (await begin()).cookie;
  if (kind === 'no-cookie') cookie = '';
  if (kind === 'tampered') cookie = cookie.slice(0, -1) + '!';
  if (kind === 'duplicate') state = [a.state, a.state];
  const res = await request(app).get('/api/v1/auth/google/callback').query({ state, code: 'synthetic-code' }).set('Cookie', cookie);
  expect(res.headers.location).toBe(`${env.frontendUrl}?auth=failed`); expect(exchange).not.toHaveBeenCalled();
});
it('rejects expired state even with the old cookie restored', async () => {
  const a = await begin(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(Date.now() + 301000);
  const res = await callback(a.state).set('Cookie', a.cookie);
  expect(res.headers.location).toBe(`${env.frontendUrl}?auth=failed`); expect(exchange).not.toHaveBeenCalled();
});
it('rejects replay with the original cookie restored', async () => {
  const a = await begin(); await callback(a.state).set('Cookie', a.cookie);
  const res = await callback(a.state).set('Cookie', a.cookie);
  expect(res.headers.location).toBe(`${env.frontendUrl}?auth=failed`); expect(exchange).toHaveBeenCalledOnce();
});
it('allows only one simultaneous callback in the shared-store model', async () => {
  const a = await begin(); const results = await Promise.all([callback(a.state).set('Cookie', a.cookie), callback(a.state).set('Cookie', a.cookie)]);
  expect(results.filter(r => r.headers.location.includes('auth=success'))).toHaveLength(1); expect(exchange).toHaveBeenCalledOnce();
});
it('accepts another strategy instance sharing the same key and persistence', async () => {
  const a = await begin(); configureGoogleStrategy({ clientId: 'synthetic-client', clientSecret: 'synthetic-secret', callbackUrl: original.callbackUrl });
  // Denied consent exercises state consumption on another instance without a provider request.
  const res = await request(app).get('/api/v1/auth/google/callback').query({ state: a.state, error: 'access_denied' }).set('Cookie', a.cookie);
  expect(res.headers.location).toBe(`${env.frontendUrl}?auth=failed`); expect(consumed.has(a.state)).toBe(true);
});
it.each(['access_denied', 'server_error'])('validates and consumes provider error %s', async error => {
  const a = await begin(); const res = await request(app).get('/api/v1/auth/google/callback').query({ state: a.state, error }).set('Cookie', a.cookie);
  expect(res.headers.location).toBe(`${env.frontendUrl}?auth=failed`); expect(consumed.has(a.state)).toBe(true); expect(exchange).not.toHaveBeenCalled();
});
it('does not restart OAuth on a callback without a code', async () => {
  const a = await begin(); const res = await request(app).get('/api/v1/auth/google/callback').query({ state: a.state }).set('Cookie', a.cookie);
  expect(res.headers.location).toBe(`${env.frontendUrl}?auth=failed`); expect(exchange).not.toHaveBeenCalled();
});
it('fails closed on unavailable replay storage', async () => {
  const a = await begin(); vi.mocked(prisma.idempotencyRecord.create).mockRejectedValueOnce(new Error('synthetic storage failure'));
  expect((await callback(a.state).set('Cookie', a.cookie)).status).toBe(500); expect(exchange).not.toHaveBeenCalled();
});
it('uses production host-only secure HttpOnly Lax cookies', async () => {
  env.nodeEnv = 'production'; const a = await begin(); const cookie = a.res.headers['set-cookie'][0];
  expect(cookie).toContain('__Host-google_oauth_state='); expect(cookie).toContain('Secure');
  expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('SameSite=Lax'); expect(cookie).toContain('Path=/'); expect(cookie).not.toContain('Domain=');
});
