import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import * as notification from '../src/services/notification.service.js';
import { processOutboxBatch, redriveFailedNotification, setOutboxTableAvailable } from '../src/services/outbox.service.js';

let row: any;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); setOutboxTableAvailable(true);
  row = { id: 'synthetic-lease', status: 'PENDING', updatedAt: new Date(Date.now() - 1), attempts: 0, maxAttempts: 5,
    nextAttemptAt: new Date(0), recipient: 'synthetic@example.test', subject: 'Synthetic',
    payload: { template: 'BOOKING_CONFIRMATION', params: {} } };
  // Atomic compare-and-set simulation, not evidence of PostgreSQL locking or precision.
  vi.spyOn(prisma.notificationOutbox, 'updateMany').mockImplementation(async ({ where, data }: any) => {
    const version = where.updatedAt;
    if ((where.id && where.id !== row.id) || row.status !== where.status) return { count: 0 };
    if (version instanceof Date && +version !== +row.updatedAt) return { count: 0 };
    if (version?.equals && +version.equals !== +row.updatedAt) return { count: 0 };
    if (version?.gt && +row.updatedAt <= +version.gt) return { count: 0 };
    if (version?.lte && +row.updatedAt > +version.lte) return { count: 0 };
    Object.assign(row, data); return { count: 1 };
  });
  vi.spyOn(prisma.notificationOutbox, 'findMany').mockImplementation(async () => row.status === 'PENDING' ? [{ ...row }] : []);
  vi.spyOn(prisma.notificationOutbox, 'findUnique').mockImplementation(async () => ({ ...row }));
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); setOutboxTableAvailable(null); });

it.each(['submitted', 'suppressed', 'retry', 'terminal'])('fences stale %s writes after ownership transfer', async outcome => {
  if (outcome === 'terminal') row.maxAttempts = 1;
  let finish!: (value: any) => void, fail!: (error: Error) => void, started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  vi.spyOn(notification, 'sendEmailRaw').mockImplementationOnce(() => {
    started(); return new Promise((resolve, reject) => { finish = resolve; fail = reject; });
  }).mockResolvedValue({ status: 'submitted' });
  const oldWorker = processOutboxBatch(1); await ready;
  vi.setSystemTime(Date.now() + 300001);
  const newWorker = await processOutboxBatch(1);
  expect(newWorker.recovered).toBe(1); expect(newWorker.delivered).toBe(1);
  const saved = JSON.stringify(row);
  if (outcome === 'retry' || outcome === 'terminal') fail(new Error('Synthetic old worker failure'));
  else finish(outcome === 'submitted' ? { status: 'submitted' } : { status: 'suppressed', reason: 'EMAIL_DELIVERY_DISABLED' });
  const old = await oldWorker;
  expect(old.delivered).toBe(0); expect(old.failed).toBe(0); expect(JSON.stringify(row)).toBe(saved);
});
it('rejects expired acknowledgment even before another worker recovers the lease', async () => {
  vi.spyOn(notification, 'sendEmailRaw').mockImplementation(async () => {
    vi.setSystemTime(Date.now() + 300001); return { status: 'submitted' };
  });
  expect((await processOutboxBatch()).delivered).toBe(0); expect(row.status).toBe('PROCESSING');
});
it('rejects a stale discovery snapshot before sending', async () => {
  vi.spyOn(prisma.notificationOutbox, 'findMany').mockImplementation(async () => {
    const snapshot = { ...row }; row.updatedAt = new Date(+row.updatedAt + 1); return [snapshot];
  });
  const send = vi.spyOn(notification, 'sendEmailRaw');
  expect((await processOutboxBatch()).delivered).toBe(0); expect(send).not.toHaveBeenCalled();
});
it('advances claim, terminal and redrive versions across identical or backward clock ticks', async () => {
  const versions: number[] = [];
  vi.spyOn(notification, 'sendEmailRaw').mockImplementation(async () => {
    versions.push(+row.updatedAt); return { status: 'suppressed', reason: 'EMAIL_DELIVERY_DISABLED' };
  });
  await processOutboxBatch(); versions.push(+row.updatedAt);
  vi.setSystemTime(Date.now() - 10000); expect(await redriveFailedNotification(row.id)).toBe(true);
  versions.push(+row.updatedAt); await processOutboxBatch(); versions.push(+row.updatedAt);
  expect(versions.every((v, i) => i === 0 || v > versions[i - 1])).toBe(true);
});
it('rejects redrive if another operator changed the record after its read', async () => {
  row.status = 'FAILED';
  vi.spyOn(prisma.notificationOutbox, 'findUnique').mockImplementation(async () => {
    const snapshot = { ...row }; row.updatedAt = new Date(+row.updatedAt + 1); return snapshot;
  });
  expect(await redriveFailedNotification(row.id)).toBe(false); expect(row.status).toBe('FAILED');
});
