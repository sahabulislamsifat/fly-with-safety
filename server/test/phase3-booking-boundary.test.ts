import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), enabled: false }));
vi.mock('../src/lib/prisma.js', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('../src/config/env.js', () => ({ env: { nodeEnv: 'test' } }));
vi.mock('../src/services/notification.service.js', () => ({ sendBookingConfirmation: vi.fn(), sendBookingStatusNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../src/payments/sslcommerz.js', () => ({ paymentEnabled: () => mocks.enabled, gatewayConfig: vi.fn() }));
vi.mock('pg', () => { throw Error('OFFLINE_DATABASE_FORBIDDEN'); });
vi.mock('dotenv', () => { throw Error('OFFLINE_ENV_FORBIDDEN'); });
import { changeBookingCommercial } from '../src/services/booking-commercial.service.js';
import { updateBookingStatus } from '../src/services/booking.service.js';
import { Prisma } from '../src/generated/prisma/client.js';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const booking = () => ({ id: 'booking', referenceNumber: 'FWS-SYNTHETIC', userId: 'owner', status: 'CONFIRMED', currency: 'BDT', totalPrice: 12000, customerEmail: 'owner@example.invalid', customerName: 'Synthetic', bookingDetails: { commercial: { version: 1, revision: 2, quotes: [{ id: id(1), amount: 12000, currency: 'BDT', acceptedAt: '2026-11-02T00:00:00Z', createdAt: '2026-11-01T00:00:00Z', validUntil: '2026-11-04T00:00:00Z' }], payments: [], receipts: [] } } });
beforeEach(() => { mocks.enabled = false; vi.clearAllMocks(); });
it('blocks manual funds against an unresolved gateway intent before any persistence', async () => {
  mocks.enabled = true;
  const update = vi.fn(), query = vi.fn((q: Prisma.Sql) => Promise.resolve(q.strings.join('').includes('clock_timestamp') ? [{ now: new Date('2026-11-03Z') }] : q.strings.join('').includes('GatewayPayment') ? [{ id: 'payment' }] : []));
  mocks.transaction.mockImplementation(cb => cb({ $queryRaw: query, booking: { findUnique: vi.fn().mockResolvedValue(booking()), update } }));
  await expect(changeBookingCommercial('FWS-SYNTHETIC', { id: 'staff', role: 'STAFF' }, { action: 'RECORD_PAYMENT', requestId: id(3), expectedRevision: 2, amount: 1, currency: 'BDT', method: 'CASH' })).rejects.toThrow('reconciliation');
  expect(update).not.toHaveBeenCalled();
});
it('keeps the ordinary disabled manual path free of new-table dependencies', async () => {
  const update = vi.fn().mockResolvedValue(booking()), query = vi.fn((q: Prisma.Sql) => Promise.resolve(q.strings.join('').includes('clock_timestamp') ? [{ now: new Date('2026-11-03Z') }] : []));
  mocks.transaction.mockImplementation(cb => cb({ $queryRaw: query, booking: { findUnique: vi.fn().mockResolvedValue(booking()), update } }));
  await changeBookingCommercial('FWS-SYNTHETIC', { id: 'staff', role: 'STAFF' }, { action: 'RECORD_PAYMENT', requestId: id(3), expectedRevision: 2, amount: 1, currency: 'BDT', method: 'CASH' });
  expect(update).toHaveBeenCalledTimes(1); expect(query.mock.calls.some(([q]) => q.strings.join('').includes('GatewayPayment'))).toBe(false);
});
it('prevents gateway capture from being marked fulfilled by the legacy status endpoint', async () => {
  const update = vi.fn(), history = vi.fn();
  mocks.transaction.mockImplementation(cb => cb({ $queryRaw: vi.fn().mockResolvedValue([]), booking: { findUnique: vi.fn().mockResolvedValue({ ...booking(), bookingDetails: { gatewayPayment: { status: 'VERIFIED', fulfillment: 'AWAITING_OPERATIONS' } } }), update }, bookingStatusHistory: { create: history } }));
  await expect(updateBookingStatus('booking', 'COMPLETED')).rejects.toThrow('supplier fulfillment'); expect(update).not.toHaveBeenCalled(); expect(history).not.toHaveBeenCalled();
});
