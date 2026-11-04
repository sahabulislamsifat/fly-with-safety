import { expect, it } from 'vitest';
import { browserGatewayDouble, browserWriteGate } from './phase3-browser-double.js';
const customer = { name: 'Synthetic', email: 'owner@example.invalid', phone: '01000000000', address: 'Synthetic', city: 'Synthetic', country: 'BD', product: 'Assisted travel booking FWS-P3-BROWSER' };
it('returns explicitly injected checkout and pending evidence without payment authority', async () => {
  const f = browserGatewayDouble('FWS-P3-BROWSER', () => 'pending');
  expect((await f.gateway.initiate('synthetic-transaction', '1200000', customer)).url).toContain('phase3_injected_only=1');
  expect((await f.gateway.query('synthetic-transaction'))[0].status).toBe('PENDING');
  await expect(f.gateway.validate('BROWSER_V_synthetic-transaction')).rejects.toThrow('NOT_VALIDATED');
});
it('requires the explicit validation mode and exact transaction correlation', async () => {
  let mode: 'pending' | 'validated' = 'pending'; const f = browserGatewayDouble('FWS-P3-BROWSER', () => mode);
  await f.gateway.initiate('synthetic-transaction', '1200000', customer); mode = 'validated';
  expect((await f.gateway.validate('BROWSER_V_synthetic-transaction')).status).toBe('VALID');
  await expect(f.gateway.query('foreign-transaction')).rejects.toThrow('TRANSACTION_MISMATCH');
  await expect(f.gateway.validate('foreign-validation')).rejects.toThrow('NOT_VALIDATED');
});
it.each(['1', '1200001'])('denies unintended amount %s', async amount => {
  const f = browserGatewayDouble('FWS-P3-BROWSER', () => 'pending'); await expect(f.gateway.initiate('synthetic', amount, customer)).rejects.toThrow('SCOPE_MISMATCH'); expect(f.calls.initiate).toBe(0);
});
it('denies foreign booking and a second provider dispatch', async () => {
  const f = browserGatewayDouble('FWS-P3-BROWSER', () => 'pending');
  await expect(f.gateway.initiate('synthetic', '1200000', { ...customer, product: 'Foreign booking' })).rejects.toThrow('SCOPE_MISMATCH');
  await f.gateway.initiate('synthetic', '1200000', customer);
  await expect(f.gateway.initiate('another', '1200000', customer)).rejects.toThrow('SCOPE_MISMATCH'); expect(f.calls.initiate).toBe(1);
});
it('does not provide refund or fulfillment success', async () => {
  const f = browserGatewayDouble('FWS-P3-BROWSER', () => 'pending');
  await expect(f.gateway.refund('synthetic', 'synthetic', '1', 'Synthetic')).rejects.toThrow('NOT_APPROVED');
  await expect(f.gateway.refundStatus('synthetic')).rejects.toThrow('NOT_APPROVED');
});
it('bounds authentication requests to existing actors and at most16 session admissions', () => {
  const gate = browserWriteGate('FWS-P3-BROWSER', ['owner@example.invalid'], () => undefined);
  expect(gate.admit('POST', '/api/v1/auth/login', { email: 'foreign@example.invalid' })).toBe(false);
  for (let i = 0; i < 16; i++) expect(gate.admit('POST', '/api/v1/auth/login', { email: 'owner@example.invalid' })).toBe(true);
  expect(gate.admit('POST', '/api/v1/auth/refresh', {})).toBe(false);
});
it.each(['/api/v1/auth/register', '/api/v1/admin/bookings/FOREIGN', '/api/v1/payments/bookings/OLD/initiate', '/api/v1/payments/bookings/FWS-P3-BROWSER/refunds', '/api/v1/payments/reconciliation/run'])('denies writes outside the bounded browser path: %s', path => {
  expect(browserWriteGate('FWS-P3-BROWSER', [], () => 'synthetic').admit('POST', path, {})).toBe(false);
});
it('admits only the exact injected callback transaction and at most6 reconciliation admissions', () => {
  const gate = browserWriteGate('FWS-P3-BROWSER', [], () => 'synthetic');
  expect(gate.admit('POST', '/api/v1/payments/sslcommerz/ipn', { tran_id: 'foreign' })).toBe(false);
  for (let i = 0; i < 6; i++) expect(gate.admit('POST', '/api/v1/payments/sslcommerz/ipn', { tran_id: 'synthetic' })).toBe(true);
  expect(gate.admit('POST', '/api/v1/payments/bookings/FWS-P3-BROWSER/reconcile', {})).toBe(false);
});
it('caps initiation admissions at24 and leaves read authorization to the real app', () => {
  const gate = browserWriteGate('FWS-P3-BROWSER', [], () => undefined);
  for (let i = 0; i < 24; i++) expect(gate.admit('POST', '/api/v1/payments/bookings/FWS-P3-BROWSER/initiate', {})).toBe(true);
  expect(gate.admit('POST', '/api/v1/payments/bookings/FWS-P3-BROWSER/initiate', {})).toBe(false);
  expect(gate.admit('GET', '/api/v1/payments/bookings/FOREIGN', {})).toBe(true);
  expect(gate.admit('GET', '/api/v1/auth/google/callback', {})).toBe(false);
});
