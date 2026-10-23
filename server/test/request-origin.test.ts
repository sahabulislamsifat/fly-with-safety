import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import * as authService from '../src/services/auth.service.js';
import * as accountService from '../src/services/account.service.js';

const frontend = 'https://fly-with-safety.netlify.app';
const originalOrigins = [...env.corsOrigins];
beforeEach(() => { env.corsOrigins = [frontend]; });
afterEach(() => { env.corsOrigins = [...originalOrigins]; vi.restoreAllMocks(); });

it.each(['https://evil.example', 'null', 'not-an-origin', `${frontend}.evil.example`,
  `${frontend}/path`, `${frontend}/`, `${frontend}?query=1`, 'https://user@fly-with-safety.netlify.app',
  `${frontend}, https://evil.example`, 'http://fly-with-safety.netlify.app'])('rejects mutation Origin %s before business logic', async origin => {
  const revoke = vi.spyOn(authService, 'revokeSessionById').mockResolvedValue(undefined);
  const res = await request(app).post('/api/v1/auth/logout').set('Origin', origin).set('Cookie', 'auth_token=synthetic');
  expect(res.status).toBe(403); expect(revoke).not.toHaveBeenCalled();
});

it.each(['auth_token=synthetic', 'refresh_token=synthetic', 'unrelated_cookie=synthetic'])('rejects missing Origin with %s', async cookie => {
  const revoke = vi.spyOn(authService, 'revokeSessionById').mockResolvedValue(undefined);
  const res = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
  expect(res.status).toBe(403); expect(revoke).not.toHaveBeenCalled();
});

it.each(['form', 'text/plain', 'multipart/form-data'])('rejects originless browser form content %s', async type => {
  const res = await request(app).post('/api/v1/auth/login').type(type).send('email=test@example.test&password=synthetic');
  expect(res.status).toBe(403);
});

it('rejects cross-site forms even without cookies', async () => {
  const res = await request(app).post('/api/v1/auth/login').set('Origin', 'https://evil.example')
    .type('form').send({ email: 'test@example.test', password: 'synthetic' });
  expect(res.status).toBe(403);
});

it('rejects missing Origin with browser fetch metadata', async () => {
  expect((await request(app).post('/api/v1/auth/logout').set('Sec-Fetch-Site', 'cross-site')).status).toBe(403);
});

it('allows trusted cross-site logout and credentialed CORS response', async () => {
  const revoke = vi.spyOn(authService, 'revokeSessionById').mockResolvedValue(undefined);
  const res = await request(app).post('/api/v1/auth/logout').set('Origin', frontend)
    .set('Sec-Fetch-Site', 'cross-site').set('Cookie', 'auth_token=synthetic');
  expect(res.status).toBe(200); expect(revoke).toHaveBeenCalledOnce();
  expect(res.headers['access-control-allow-origin']).toBe(frontend);
  expect(res.headers['access-control-allow-credentials']).toBe('true');
});

it('allows an authenticated cookie profile update from the frontend', async () => {
  vi.spyOn(prisma.session, 'findFirst').mockResolvedValue({ id: 'synthetic-session' } as never);
  const update = vi.spyOn(accountService, 'updateProfile').mockResolvedValue({ id: 'synthetic-user' } as never);
  const token = jwt.sign({ sub: 'synthetic-user', role: 'CUSTOMER', sid: 'synthetic-session' }, env.jwtSecret);
  const res = await request(app).patch('/api/v1/account/profile').set('Origin', frontend)
    .set('Cookie', `auth_token=${token}`).send({ name: 'Synthetic User' });
  expect(res.status).toBe(200); expect(update).toHaveBeenCalledWith('synthetic-user', { name: 'Synthetic User' });
});

it('does not replace authentication for trusted requests', async () => {
  expect((await request(app).patch('/api/v1/account/profile').set('Origin', frontend).send({ name: 'Test User' })).status).toBe(401);
});
it.each(['/account/profile', '/admin/contact/synthetic/status', '/admin/testimonials/synthetic/status',
  '/admin/inquiries/flights/synthetic/status', '/admin/inquiries/hotels/synthetic/status',
  '/admin/inquiries/packages/synthetic/status', '/admin/inquiries/visa/synthetic/status',
  '/admin/destinations/synthetic', '/admin/bookings/synthetic/status'])('guards PATCH %s', async path => {
  expect((await request(app).patch(`/api/v1${path}`).set('Origin', 'https://evil.example').send({})).status).toBe(403);
});
it('guards DELETE before authentication or business logic', async () => {
  expect((await request(app).delete('/api/v1/admin/testimonials/synthetic').set('Origin', 'https://evil.example')).status).toBe(403);
});

it('preserves originless bearer API requests', async () => {
  vi.spyOn(prisma.session, 'findFirst').mockResolvedValue({ id: 'synthetic-session' } as never);
  vi.spyOn(accountService, 'updateProfile').mockResolvedValue({ id: 'synthetic-user' } as never);
  const token = jwt.sign({ sub: 'synthetic-user', role: 'CUSTOMER', sid: 'synthetic-session' }, env.jwtSecret);
  expect((await request(app).patch('/api/v1/account/profile').set('Authorization', `Bearer ${token}`).send({ name: 'Synthetic User' })).status).toBe(200);
});

it.each(['/auth/register', '/auth/login', '/auth/verify-email', '/auth/resend-verification',
  '/auth/forgot-password', '/auth/reset-password', '/auth/refresh', '/bookings',
  '/flights/inquiries', '/hotels/inquiries', '/packages/inquiries', '/visa/inquiries', '/contact',
  '/admin/bookings/from-inquiry', '/admin/outbox/synthetic/redrive'])('guards POST %s before handlers', async path => {
  expect((await request(app).post(`/api/v1${path}`).set('Origin', 'https://evil.example').send({})).status).toBe(403);
});

it('allows preflight with the existing frontend headers', async () => {
  const res = await request(app).options('/api/v1/bookings').set('Origin', frontend)
    .set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type,authorization,idempotency-key');
  expect(res.status).toBe(204); expect(res.headers['access-control-allow-credentials']).toBe('true');
  expect(res.headers['access-control-allow-headers'].toLowerCase()).toContain('idempotency-key');
});

it('does not grant CORS access to an unauthorized preflight', async () => {
  const res = await request(app).options('/api/v1/bookings').set('Origin', 'https://evil.example')
    .set('Access-Control-Request-Method', 'POST');
  expect(res.headers['access-control-allow-origin']).toBeUndefined();
});

it('does not intercept OAuth GET callbacks or initiation', async () => {
  for (const path of ['/auth/google', '/auth/google/callback?error=access_denied']) {
    const res = await request(app).get(`/api/v1${path}`).set('Origin', 'https://accounts.google.com');
    expect([302, 503]).toContain(res.status);
  }
});
