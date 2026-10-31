import { expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ $transaction: vi.fn(), booking: { findUnique: vi.fn() } }));
vi.mock('../src/lib/prisma.js', () => ({ prisma: db }));
vi.mock('../src/services/notification.service.js', () => ({ sendBookingConfirmation: vi.fn(), sendBookingStatusNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../src/config/env.js', () => ({ env: { nodeEnv: 'test' } }));
vi.mock('pg', () => { throw new Error('OFFLINE_DB_FORBIDDEN'); });
vi.mock('dotenv', () => { throw new Error('OFFLINE_ENV_FORBIDDEN'); });
import { updateBookingStatus } from '../src/services/booking.service.js';
import { sendBookingStatusNotification } from '../src/services/notification.service.js';
const booking = { id: 'synthetic', status: 'CONFIRMED', customerEmail: 'synthetic@example.invalid', customerName: 'Synthetic', referenceNumber: 'FWS-SYNTHETIC',
  bookingDetails: { paymentStatus: 'AWAITING_PAYMENT_CONFIRMATION', commercial: { retained: true } } };
it('serializes status transitions before reading and never infers verified payment from completion', async () => {
  const order: string[] = [];
  const tx = { $queryRaw: vi.fn(async () => { order.push('lock'); }), booking: {
    findUnique: vi.fn(async () => { order.push('read'); return booking; }), update: vi.fn(async args => ({ ...booking, ...args.data })),
  }, bookingStatusHistory: { create: vi.fn().mockResolvedValue({}) } };
  db.$transaction.mockImplementation(cb => cb(tx)); db.booking.findUnique.mockResolvedValue({ ...booking, status: 'COMPLETED' });
  await updateBookingStatus('synthetic', 'COMPLETED', 'Synthetic completion', 'synthetic-staff');
  expect(order).toEqual(['lock', 'read']); expect(tx.booking.update.mock.calls[0][0].data.bookingDetails).toEqual(booking.bookingDetails);
  expect(tx.bookingStatusHistory.create).toHaveBeenCalledWith({ data: { bookingId: 'synthetic', fromStatus: 'CONFIRMED', toStatus: 'COMPLETED', reason: 'Synthetic completion', changedBy: 'synthetic-staff' } });
});
it('propagates failed history insertion and suppresses post-commit notification', async () => {
  vi.mocked(sendBookingStatusNotification).mockClear();
  const failure = new Error('synthetic-history-failure');
  db.$transaction.mockImplementation(cb => cb({ $queryRaw: vi.fn().mockResolvedValue([]), booking: {
    findUnique: vi.fn().mockResolvedValue(booking), update: vi.fn().mockResolvedValue(booking),
  }, bookingStatusHistory: { create: vi.fn().mockRejectedValue(failure) } }));
  await expect(updateBookingStatus('synthetic', 'COMPLETED')).rejects.toBe(failure);
  expect(sendBookingStatusNotification).not.toHaveBeenCalled();
});
