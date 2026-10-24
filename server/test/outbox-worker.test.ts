import { readFileSync } from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import * as outbox from '../src/services/outbox.service.js';
import * as notification from '../src/services/notification.service.js';
import { logger } from '../src/lib/logger.js';

const secret = 'synthetic_worker_secret_0123456789abcdef';
const path = '/api/v1/internal/outbox/run';
const empty = { processed: 0, delivered: 0, failed: 0, recovered: 0 };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); outbox.setOutboxTableAvailable(null); });
describe('protected scheduled worker', () => {
  beforeEach(() => { vi.stubEnv('CRON_SECRET', secret); vi.stubEnv('OUTBOX_WORKER_ENABLED', 'true'); });
  it.each(['', 'weak'])('fails closed on absent or weak configured credentials', async value => {
    vi.stubEnv('CRON_SECRET', value); const process = vi.spyOn(outbox, 'processOutboxBatch');
    expect((await request(app).get(path)).status).toBe(503); expect(process).not.toHaveBeenCalled();
  });
  it.each(['', 'Bearer wrong', `Basic ${secret}`])('rejects missing or incorrect authorization', async header => {
    const process = vi.spyOn(outbox, 'processOutboxBatch');
    expect((await request(app).get(path).set('Authorization', header)).status).toBe(401); expect(process).not.toHaveBeenCalled();
  });
  it('requires explicit enablement', async () => {
    vi.stubEnv('OUTBOX_WORKER_ENABLED', 'false'); const process = vi.spyOn(outbox, 'processOutboxBatch');
    expect((await request(app).get(path).auth(secret, { type: 'bearer' })).status).toBe(503); expect(process).not.toHaveBeenCalled();
  });
  it('awaits a bounded batch and returns non-cacheable counters', async () => {
    const process = vi.spyOn(outbox, 'processOutboxBatch').mockResolvedValue(empty);
    const res = await request(app).get(`${path}?batchSize=999999`).auth(secret, { type: 'bearer' });
    expect(res.status).toBe(200); expect(res.body.data).toEqual(empty); expect(res.headers['cache-control']).toContain('no-store');
    expect(process).toHaveBeenCalledWith(3, { timeBudgetMs: 20000, throwOnError: true });
  });
  it.each(['Cookie', 'Origin', 'Sec-Fetch-Site'])('rejects browser header %s even with scheduler credentials', async header => {
    const process = vi.spyOn(outbox, 'processOutboxBatch');
    expect((await request(app).get(path).auth(secret, { type: 'bearer' }).set(header, 'synthetic')).status).toBe(403);
    expect(process).not.toHaveBeenCalled();
  });
  it('does not execute GET side effects for HEAD', async () => {
    const process = vi.spyOn(outbox, 'processOutboxBatch');
    expect((await request(app).head(path).auth(secret, { type: 'bearer' })).status).toBe(405); expect(process).not.toHaveBeenCalled();
  });
  it('reports infrastructure failure without exposing its details or secret', async () => {
    vi.spyOn(outbox, 'processOutboxBatch').mockRejectedValue(new Error(`${secret} synthetic@example.test`));
    const log = vi.spyOn(logger, 'warn');
    const res = await request(app).get(path).auth(secret, { type: 'bearer' });
    expect(res.status).toBe(503); expect(JSON.stringify(res.body)).not.toContain(secret);
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret); expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic@example.test');
  });
});
describe('bounded shared-store processing', () => {
  beforeEach(() => { outbox.setOutboxTableAvailable(true); });
  const candidate = () => ({ id: 'synthetic-outbox', status: 'PENDING', updatedAt: new Date(0), attempts: 0, maxAttempts: 5,
    recipient: 'synthetic@example.test', subject: 'Synthetic', payload: { template: 'BOOKING_CONFIRMATION', params: {} } });
  it('caps discovery size and processes multiple pending records', async () => {
    vi.spyOn(prisma.notificationOutbox, 'updateMany').mockResolvedValue({ count: 1 });
    const find = vi.spyOn(prisma.notificationOutbox, 'findMany').mockResolvedValue([candidate(), { ...candidate(), id: 'second' }] as never);
    vi.spyOn(prisma.notificationOutbox, 'update').mockResolvedValue({} as never);
    const send = vi.spyOn(notification, 'sendEmailRaw').mockResolvedValue({ status: 'submitted' });
    expect((await outbox.processOutboxBatch(99999)).delivered).toBe(2); expect(send).toHaveBeenCalledTimes(2);
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }));
  });
  it('stops claiming new work when the admission budget expires', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.spyOn(prisma.notificationOutbox, 'updateMany').mockResolvedValue({ count: 1 });
    vi.spyOn(prisma.notificationOutbox, 'findMany').mockResolvedValue([candidate(), candidate()] as never);
    vi.spyOn(prisma.notificationOutbox, 'update').mockResolvedValue({} as never);
    const send = vi.spyOn(notification, 'sendEmailRaw').mockImplementation(async () => {
      vi.setSystemTime(Date.now() + 100); return { status: 'submitted' };
    });
    expect((await outbox.processOutboxBatch(3, { timeBudgetMs: 50 })).delivered).toBe(1); expect(send).toHaveBeenCalledOnce();
  });
  it('lets only one concurrent worker claim a row in the atomic-store mock', async () => {
    const row = candidate();
    vi.spyOn(prisma.notificationOutbox, 'findMany').mockImplementation(async () => [{ ...row }] as never);
    vi.spyOn(prisma.notificationOutbox, 'updateMany').mockImplementation(async ({ where, data }: any) => {
      if (!where.id) return { count: 0 };
      if (row.status !== where.status) return { count: 0 };
      Object.assign(row, data); return { count: 1 };
    });
    vi.spyOn(prisma.notificationOutbox, 'update').mockImplementation(async ({ data }: any) => { Object.assign(row, data); return row as never; });
    const send = vi.spyOn(notification, 'sendEmailRaw').mockResolvedValue({ status: 'submitted' });
    const result = await Promise.all([outbox.processOutboxBatch(), outbox.processOutboxBatch()]);
    expect(send).toHaveBeenCalledOnce(); expect(result.reduce((n, r) => n + r.delivered, 0)).toBe(1);
  });
  it('propagates interruption so a scheduler sees failure rather than an empty success', async () => {
    vi.spyOn(prisma.notificationOutbox, 'updateMany').mockRejectedValue(new Error('Synthetic database interruption'));
    await expect(outbox.processOutboxBatch(3, { throwOnError: true })).rejects.toThrow('Synthetic database interruption');
  });
  it('fails closed when the outbox table is unavailable', async () => {
    outbox.setOutboxTableAvailable(false);
    await expect(outbox.processOutboxBatch(3, { throwOnError: true })).rejects.toThrow('Outbox storage unavailable');
  });
  it('keeps app import timer-free and restricts server polling to local development', () => {
    const appSource = readFileSync('src/app.ts', 'utf8');
    const serverSource = readFileSync('src/server.ts', 'utf8');
    expect(appSource).not.toContain('startOutboxWorker(');
    expect(serverSource).toContain("env.nodeEnv === 'development' && !process.env.VERCEL");
  });
});
