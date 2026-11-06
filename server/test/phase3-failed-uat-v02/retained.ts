import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Prisma } from '../../src/generated/prisma/client.js';

/** The prior FAILED run is a retained, unresolved local fixture. No provider query. */
export async function verifyPriorFailed(db: Prisma.TransactionClient, repo: string) {
  const path = resolve(repo, 'output/phase3/failed-uat-20261105-01/owned-final.json');
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  const [booking] = saved.bookings, [payment] = saved.payments;
  if (saved.bookings.length !== 1 || saved.payments.length !== 1 || booking.status !== 'PENDING' || payment.status !== 'SESSION_READY' || payment.captured !== false || payment.bookingId !== booking.id) throw Error('PRIOR_FAILED_EVIDENCE_MISMATCH');
  const current = await db.booking.findUnique({ where: { id: booking.id }, select: { id: true, referenceNumber: true, status: true } });
  const rows = await db.$queryRawUnsafe<Array<{ id: string; status: string; captured: boolean }>>('SELECT id,status,(state->>\'captured\')::boolean AS captured FROM public."GatewayPayment" WHERE "bookingId"=$1', booking.id);
  if (!current || current.referenceNumber !== booking.referenceNumber || current.status !== 'PENDING' || rows.length !== 1 || rows[0].id !== payment.id || rows[0].status !== 'SESSION_READY' || rows[0].captured !== false) throw Error('PRIOR_FAILED_STATE_CHANGED');
}
