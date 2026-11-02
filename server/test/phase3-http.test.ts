import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
const mocks = vi.hoisted(() => ({ session: vi.fn(), list: vi.fn(), initiate: vi.fn(), notify: vi.fn(), reconcile: vi.fn(), refund: vi.fn() }));
vi.mock('../src/lib/prisma.js', () => ({ prisma: { session: { findFirst: mocks.session } } }));
vi.mock('../src/config/env.js', () => ({ env: { nodeEnv: 'test', jwtSecret: 'synthetic-component-only', corsOrigins: ['http://localhost:3000'] } }));
vi.mock('dotenv', () => { throw Error('OFFLINE_ENV_FORBIDDEN'); });
vi.mock('pg', () => { throw Error('OFFLINE_DATABASE_FORBIDDEN'); });
vi.mock('../src/payments/payment.service.js', () => ({ PaymentService: class { list = mocks.list; initiate = mocks.initiate; notify = mocks.notify; reconcile = mocks.reconcile; refund = mocks.refund; } }));
import { paymentCallbacks, paymentRoutes } from '../src/payments/payment.routes.js';
import { protectRequestOrigin } from '../src/middleware/request-origin.js';
import { errorHandler } from '../src/middleware/error-handler.js';
const app = express();
app.use('/api/v1', paymentCallbacks); app.use(protectRequestOrigin, express.json(), cookieParser()); app.use('/api/v1', paymentRoutes); app.use(errorHandler);
const input = { requestId: '00000000-0000-4000-8000-000000000002', address: 'Synthetic address', city: 'Test city', country: 'BD' };
const token = () => jwt.sign({ sub: 'synthetic-owner', email: 'synthetic@example.invalid', role: 'CUSTOMER', sid: 'synthetic-session' }, 'synthetic-component-only');
beforeEach(() => {
  vi.clearAllMocks(); mocks.session.mockResolvedValue({ id: 'synthetic-session' }); mocks.list.mockResolvedValue({ payments: [], refunds: [] }); mocks.initiate.mockResolvedValue({ payment: { status: 'UNKNOWN' } }); mocks.notify.mockResolvedValue('FWS-SYNTHETIC');
  for (const [key, value] of Object.entries({ SSLCOMMERZ_ENABLED: 'true', SSLCOMMERZ_SANDBOX: 'true', SSLCOMMERZ_SCHEMA_VERIFIED: 'true', EMAIL_DELIVERY_ENABLED: 'false', DATABASE_URL: 'postgresql://flywithsafe_phase2_booking_test:synthetic@127.0.0.1:5432/flywithsafety_local_integration', SSLCOMMERZ_CALLBACK_BASE_URL: 'https://callbacks.example.invalid', FRONTEND_URL: 'http://localhost:3000', SSLCOMMERZ_STORAGE_KEY: Buffer.alloc(32, 7).toString('base64'), SSLCOMMERZ_STORE_ID: 'synthetic', SSLCOMMERZ_STORE_PASSWORD: 'synthetic' })) vi.stubEnv(key, value);
});
it('rejects anonymous and revoked sessions before ledger access', async () => {
  expect((await request(app).get('/api/v1/payments/bookings/FWS-SYNTHETIC')).status).toBe(401);
  expect((await request(app).get('/api/v1/payments/operations').set('Authorization', `Bearer ${token()}`)).status).toBe(403);
  expect((await request(app).post('/api/v1/payments/reconciliation/run').set('Authorization', `Bearer ${token()}`).send({})).status).toBe(403);
  mocks.session.mockResolvedValue(null); expect((await request(app).get('/api/v1/payments/bookings/FWS-SYNTHETIC').set('Authorization', `Bearer ${token()}`)).status).toBe(401); expect(mocks.list).not.toHaveBeenCalled();
});
it('keeps the existing browser Origin boundary for initiation', async () => {
  expect((await request(app).post('/api/v1/payments/bookings/FWS-SYNTHETIC/initiate').set('Origin', 'https://foreign.invalid').set('Authorization', `Bearer ${token()}`).send(input)).status).toBe(403); expect(mocks.initiate).not.toHaveBeenCalled();
});
it('binds Idempotency-Key and denies client price/verification fields', async () => {
  const path = '/api/v1/payments/bookings/FWS-SYNTHETIC/initiate';
  expect((await request(app).post(path).set('Authorization', `Bearer ${token()}`).send(input)).status).toBe(400);
  expect((await request(app).post(path).set('Authorization', `Bearer ${token()}`).set('Idempotency-Key', input.requestId).send({ ...input, amount: 1, paid: true })).status).toBe(400); expect(mocks.initiate).not.toHaveBeenCalled();
});
it('forwards authenticated owner identity and returns no-store pending outcome', async () => {
  const result = await request(app).post('/api/v1/payments/bookings/FWS-SYNTHETIC/initiate').set('Origin', 'http://localhost:3000').set('Authorization', `Bearer ${token()}`).set('Idempotency-Key', input.requestId).send(input);
  expect(result.status).toBe(202); expect(result.headers['cache-control']).toBe('no-store'); expect(mocks.initiate.mock.calls[0][1].id).toBe('synthetic-owner');
});
it('accepts only provider form data on the four narrowly exempt callback paths', async () => {
  expect((await request(app).post('/api/v1/payments/sslcommerz/ipn').send({ tran_id: 'synthetic' })).status).toBe(400);
  const result = await request(app).post('/api/v1/payments/sslcommerz/ipn').type('form').send({ tran_id: 'synthetic', val_id: 'validation', amount: '1', status: 'VALID', card_no: 'DO-NOT-PERSIST' });
  expect(result.status).toBe(200); expect(mocks.notify).toHaveBeenCalledWith('synthetic', 'validation', 'ipn'); expect(mocks.reconcile).toHaveBeenCalledWith('FWS-SYNTHETIC');
  expect(mocks.notify.mock.invocationCallOrder[0]).toBeLessThan(mocks.reconcile.mock.invocationCallOrder[0]);
});
it('does not acknowledge a notice that could not be durably persisted', async () => {
  mocks.notify.mockRejectedValue(Error('synthetic failure')); expect((await request(app).post('/api/v1/payments/sslcommerz/ipn').type('form').send({ tran_id: 'synthetic' })).status).toBe(500);
});
it('redirects browser returns to a status review rather than declaring success', async () => {
  const result = await request(app).post('/api/v1/payments/sslcommerz/success').type('form').send({ tran_id: 'synthetic', val_id: 'validation' });
  expect(result.status).toBe(303); expect(result.headers.location).toBe('http://localhost:3000/payments/return?booking=FWS-SYNTHETIC'); expect(mocks.reconcile).toHaveBeenCalledWith('FWS-SYNTHETIC');
});
it('rejects oversized and repeated form identifiers', async () => {
  expect((await request(app).post('/api/v1/payments/sslcommerz/ipn').type('form').send({ tran_id: ['a', 'b'] })).status).toBe(400);
  expect((await request(app).post('/api/v1/payments/sslcommerz/ipn').type('form').send({ tran_id: 'x'.repeat(17000) })).status).toBe(413); expect(mocks.notify).not.toHaveBeenCalled();
});
it('does not add a catch-all Origin exemption', async () => {
  expect((await request(app).post('/api/v1/payments/sslcommerz/other').type('form').send({ tran_id: 'synthetic' })).status).toBe(403);
});
it('leaves capabilities off without needing the additive schema', async () => {
  vi.stubEnv('SSLCOMMERZ_ENABLED', 'false'); const result = await request(app).get('/api/v1/payments/capabilities').set('Authorization', `Bearer ${token()}`);
  expect(result.status).toBe(200); expect(result.body.data.enabled).toBe(false); expect(mocks.list).not.toHaveBeenCalled();
});
