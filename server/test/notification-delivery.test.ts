import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { sendEmailRaw } from '../src/services/notification.service.js';
import { enqueueNotification, processOutboxBatch, redriveFailedNotification, setOutboxTableAvailable } from '../src/services/outbox.service.js';

// Never construct a real SMTP transport, including when exercising enabled-delivery code.
const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn(() => ({ sendMail })) } }));
const email = { to: 'synthetic@example.test', subject: 'Synthetic notification', html: '<p>Test</p>' };
beforeEach(() => {
  vi.clearAllMocks(); setOutboxTableAvailable(true);
  vi.spyOn(env, 'emailDeliveryEnabled', 'get').mockReturnValue(true);
  vi.spyOn(env, 'smtpUser', 'get').mockReturnValue('synthetic@example.test');
  vi.spyOn(env, 'smtpPassword', 'get').mockReturnValue('synthetic-password');
  vi.spyOn(env, 'smtpHost', 'get').mockReturnValue('smtp.example.test');
  vi.spyOn(env, 'smtpService', 'get').mockReturnValue('');
  sendMail.mockResolvedValue({ accepted: [email.to], rejected: [] });
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); setOutboxTableAvailable(null); });

function batch(attempts = 0) {
  const row = { id: 'synthetic-outbox', recipient: email.to, subject: email.subject,
    payload: { template: 'BOOKING_CONFIRMATION', params: {} }, status: 'PENDING', updatedAt: new Date(0), attempts, maxAttempts: 5 };
  const lease = vi.spyOn(prisma.notificationOutbox, 'updateMany').mockImplementation(async ({ where, data }: any) => {
    if (where.id) Object.assign(row, data); return { count: 1 };
  });
  vi.spyOn(prisma.notificationOutbox, 'findUnique').mockImplementation(async () => row as never);
  vi.spyOn(prisma.notificationOutbox, 'findMany').mockResolvedValue([row] as never);
  const update = lease;
  return { row, lease, update };
}
it('returns explicit suppression without constructing a transport', async () => {
  vi.spyOn(env, 'emailDeliveryEnabled', 'get').mockReturnValue(false);
  await expect(sendEmailRaw(email)).resolves.toEqual({ status: 'suppressed', reason: 'EMAIL_DELIVERY_DISABLED' });
  expect(nodemailer.createTransport).not.toHaveBeenCalled(); expect(sendMail).not.toHaveBeenCalled();
});
it('returns submitted only after mocked SMTP acceptance', async () => {
  await expect(sendEmailRaw(email)).resolves.toEqual({ status: 'submitted' }); expect(sendMail).toHaveBeenCalledOnce();
});
it.each(['user', 'password'])('rejects missing SMTP %s', async missing => {
  vi.spyOn(env, missing === 'user' ? 'smtpUser' : 'smtpPassword', 'get').mockReturnValue('');
  await expect(sendEmailRaw(email)).rejects.toThrow('SMTP transport not configured'); expect(sendMail).not.toHaveBeenCalled();
});
it('propagates transport failure', async () => {
  sendMail.mockRejectedValueOnce(new Error('Synthetic SMTP failure'));
  await expect(sendEmailRaw(email)).rejects.toThrow('Synthetic SMTP failure');
});
it('rejects missing SMTP host and service rather than defaulting to localhost', async () => {
  vi.spyOn(env, 'smtpHost', 'get').mockReturnValue('');
  await expect(sendEmailRaw(email)).rejects.toThrow('SMTP transport not configured');
  expect(nodemailer.createTransport).not.toHaveBeenCalled();
});
it('rejects a resolved transport response with no accepted recipients', async () => {
  sendMail.mockResolvedValueOnce({ accepted: [], rejected: [email.to] });
  await expect(sendEmailRaw(email)).rejects.toThrow('did not accept');
});
it('makes disabled outbox delivery terminal without consuming retry attempts', async () => {
  vi.spyOn(env, 'emailDeliveryEnabled', 'get').mockReturnValue(false);
  const { row, update } = batch(2); const stats = await processOutboxBatch();
  expect(stats.delivered).toBe(0); expect(stats.failed).toBe(1);
  expect(row.status).toBe('FAILED'); expect(row.attempts).toBe(2);
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
    status: 'FAILED', error: expect.stringContaining('EMAIL_DELIVERY_DISABLED'), processedAt: expect.any(Date),
  }) }));
  expect(sendMail).not.toHaveBeenCalled();
});
it('marks only accepted transport submissions DELIVERED', async () => {
  const { row } = batch(); const stats = await processOutboxBatch();
  expect(row.status).toBe('DELIVERED'); expect(stats.delivered).toBe(1);
});
it('keeps missing configuration in bounded retry handling', async () => {
  vi.spyOn(env, 'smtpPassword', 'get').mockReturnValue('');
  const { row } = batch(); const stats = await processOutboxBatch();
  expect(row.status).toBe('PENDING'); expect(row.attempts).toBe(1); expect(stats.delivered).toBe(0);
});
it('retries a temporary error then succeeds without a false initial delivery', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); const now = Date.now();
  sendMail.mockRejectedValueOnce(new Error('Synthetic temporary failure'));
  const { row, update } = batch(); const first = await processOutboxBatch();
  expect(first.delivered).toBe(0); expect(row.status).toBe('PENDING'); expect(row.attempts).toBe(1);
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ nextAttemptAt: new Date(now + 60000) }) }));
  vi.setSystemTime(now + 60001); expect((await processOutboxBatch()).delivered).toBe(1);
});
it('stops retrying at the maximum attempt', async () => {
  sendMail.mockRejectedValueOnce(new Error('Synthetic SMTP failure'));
  const { row } = batch(4); const stats = await processOutboxBatch();
  expect(row.status).toBe('FAILED'); expect(row.attempts).toBe(5); expect(stats.delivered).toBe(0);
});
it('supports operator redrive after suppression and restored delivery', async () => {
  vi.spyOn(env, 'emailDeliveryEnabled', 'get').mockReturnValue(false);
  const { row, lease } = batch(); await processOutboxBatch(); expect(row.status).toBe('FAILED');
  lease.mockImplementation(async ({ where, data }: any) => {
    if (where.id && row.status !== where.status) return { count: 0 };
    Object.assign(row, data); return { count: 1 };
  });
  expect(await redriveFailedNotification(row.id)).toBe(true);
  vi.spyOn(env, 'emailDeliveryEnabled', 'get').mockReturnValue(true);
  expect((await processOutboxBatch()).delivered).toBe(1);
});
it('recovers expired processing leases before terminal suppression', async () => {
  vi.spyOn(env, 'emailDeliveryEnabled', 'get').mockReturnValue(false);
  const { lease, row } = batch(); const stats = await processOutboxBatch();
  expect(lease).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'PROCESSING', updatedAt: { lte: expect.any(Date) } }, data: expect.objectContaining({ status: 'PENDING' }) }));
  expect(stats.recovered).toBe(1); expect(row.status).toBe('FAILED');
});
it('keeps missing-table fallback non-durable and suppressed', async () => {
  setOutboxTableAvailable(false); vi.spyOn(env, 'emailDeliveryEnabled', 'get').mockReturnValue(false);
  const create = vi.spyOn(prisma.notificationOutbox, 'create');
  expect(await enqueueNotification(undefined, { recipient: email.to, subject: email.subject, template: 'BOOKING_CONFIRMATION', params: {} })).toBeNull();
  expect(create).not.toHaveBeenCalled(); expect(sendMail).not.toHaveBeenCalled();
});
