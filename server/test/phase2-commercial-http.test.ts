import { expect, it, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
const mocks = vi.hoisted(() => ({ session: vi.fn(), change: vi.fn() }));
vi.mock('../src/lib/prisma.js', () => ({ prisma: { session: { findFirst: mocks.session } } }));
vi.mock('../src/config/env.js', () => ({ env: { nodeEnv: 'test', jwtSecret: 'synthetic-component-only', corsOrigins: ['http://localhost:3000'] } }));
vi.mock('dotenv', () => { throw new Error('ENV_FORBIDDEN'); });
vi.mock('pg', () => { throw new Error('DB_FORBIDDEN'); });
// Only persistence service is doubled; real JWT/session/origin/validation/controller/DTO execute.
vi.mock('../src/services/booking-commercial.service.js', async original => {
  const actual = await original<typeof import('../src/services/booking-commercial.service.js')>();
  return { ...actual, changeBookingCommercial: mocks.change };
});
import { requireAuth, requireRole } from '../src/middleware/auth.middleware.js';
import { protectRequestOrigin } from '../src/middleware/request-origin.js';
import { validate } from '../src/middleware/validation.middleware.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { changeCommercial } from '../src/controllers/booking-commercial.controller.js';
import { commercialCommandSchema } from '../src/services/booking-commercial.service.js';
const app = express(); app.use(express.json(), cookieParser(), protectRequestOrigin);
app.post('/admin/bookings/:reference/commercial', requireAuth, requireRole('ADMIN', 'STAFF'), validate(commercialCommandSchema), changeCommercial);
app.post('/account/bookings/:reference/commercial', requireAuth, validate(commercialCommandSchema.refine(c => c.action === 'ACCEPT_QUOTE')), changeCommercial);
app.use(errorHandler);
const command = { action: 'OFFER_QUOTE', requestId: '00000000-0000-4000-8000-000000000001', expectedRevision: 0, amount: 100, currency: 'BDT', validUntil: '2026-11-01T00:00:00Z' };
function token(role = 'CUSTOMER') {
  mocks.session.mockResolvedValue({ id: 'synthetic-session' });
  return jwt.sign({ sub: 'synthetic-user', email: 'synthetic@example.invalid', role, sid: 'synthetic-session' }, 'synthetic-component-only');
}
it('requires authentication', async () => expect((await request(app).post('/admin/bookings/x/commercial').send(command)).status).toBe(401));
it('denies a customer the staff quotation endpoint', async () => expect((await request(app).post('/admin/bookings/x/commercial').set('Authorization', `Bearer ${token()}`).send(command)).status).toBe(403));
it('denies cross-origin mutation', async () => expect((await request(app).post('/admin/bookings/x/commercial').set('Origin', 'https://foreign.invalid').set('Authorization', `Bearer ${token('STAFF')}`).send(command)).status).toBe(403));
it('denies missing-origin ambient cookies', async () => expect((await request(app).post('/account/bookings/x/commercial').set('Cookie', 'auth_token=synthetic').send(command)).status).toBe(403));
it('rejects staff-only actions at account route', async () => expect((await request(app).post('/account/bookings/x/commercial').set('Authorization', `Bearer ${token()}`).send(command)).status).toBe(422));
it('rejects forged verification fields', async () => expect((await request(app).post('/admin/bookings/x/commercial').set('Authorization', `Bearer ${token('STAFF')}`).send({ ...command, verified: true })).status).toBe(422));
it('returns a no-store minimized staff result', async () => {
  mocks.change.mockResolvedValue({ referenceNumber: 'FWS-SYNTHETIC', bookingDetails: { commercial: { version: 1, revision: 0, quotes: [], payments: [], receipts: [] } } });
  const response = await request(app).post('/admin/bookings/FWS-SYNTHETIC/commercial').set('Authorization', `Bearer ${token('STAFF')}`).send(command);
  expect(response.status).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body.data.booking.commercial).toEqual({ version: 1, revision: 0, quotes: [], payments: [] });
});
it('admits the ADMIN role through the same mutation authorization boundary', async () => {
  mocks.change.mockResolvedValue({ referenceNumber: 'FWS-SYNTHETIC', bookingDetails: {} });
  expect((await request(app).post('/admin/bookings/FWS-SYNTHETIC/commercial').set('Authorization', `Bearer ${token('ADMIN')}`).send(command)).status).toBe(200);
});
it('rejects a revoked session', async () => {
  const value = token(); mocks.session.mockResolvedValueOnce(null);
  expect((await request(app).post('/account/bookings/x/commercial').set('Authorization', `Bearer ${value}`).send(command)).status).toBe(401);
});
