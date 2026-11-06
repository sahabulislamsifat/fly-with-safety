import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Prisma } from '../../src/generated/prisma/client.js';
import { verifyPriorFailed as verifyV01 } from '../phase3-failed-uat-v02/retained.js';

export async function verifyPriorFailed(db: Prisma.TransactionClient, repo: string) {
  await verifyV01(db, repo);
  const base = resolve(repo, 'output/phase3/failed-uat-20261105-02');
  const saved = JSON.parse(readFileSync(resolve(base, 'owned-final.json'), 'utf8'));
  const [booking] = saved.bookings, [payment] = saved.payments;
  if (saved.bookings.length !== 1 || saved.payments.length !== 1 || booking.status !== 'PENDING' || payment.status !== 'SESSION_READY' || payment.captured !== false || payment.bookingId !== booking.id) throw Error('V02_RETAINED_EVIDENCE_MISMATCH');
  const row = await db.booking.findUnique({ where: { id: booking.id }, select: { referenceNumber: true, status: true } });
  const payments = await db.$queryRawUnsafe<Array<{ id: string; status: string; captured: boolean }>>('SELECT id,status,(state->>\'captured\')::boolean AS captured FROM public."GatewayPayment" WHERE "bookingId"=$1', booking.id);
  if (!row || row.referenceNumber !== booking.referenceNumber || row.status !== 'PENDING' || payments.length !== 1 || payments[0].id !== payment.id || payments[0].status !== 'SESSION_READY' || payments[0].captured !== false) throw Error('V02_RETAINED_STATE_CHANGED');
}
