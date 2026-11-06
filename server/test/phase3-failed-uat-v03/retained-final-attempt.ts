import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Prisma } from '../../src/generated/prisma/client.js';
import { verifyRetainedCloudflare } from './retained-cloudflare.js';

export async function verifyRetainedFinalAttempt(db: Prisma.TransactionClient, repo: string) {
  const earlier = await verifyRetainedCloudflare(db, repo);
  const evidence = resolve(repo, 'output/phase3/failed-uat-cloudflare-20261106-02/owned-final.json');
  const saved = JSON.parse(readFileSync(evidence, 'utf8'));
  const [booking] = saved.bookings, [payment] = saved.payments;
  if (saved.bookings.length !== 1 || saved.payments.length !== 1 || booking.status !== 'PENDING' || payment.status !== 'SESSION_READY' || payment.captured !== false || payment.bookingId !== booking.id || !/^FWS[a-f0-9]{26}$/.test(payment.tranId)) throw Error('PRIOR_TRACED_UAT_EVIDENCE_MISMATCH');
  const current = await db.booking.findUnique({ where: { id: booking.id }, select: { referenceNumber: true, status: true } });
  const rows = await db.$queryRawUnsafe<Array<{ id: string; tranId: string; status: string; captured: boolean }>>(
    'SELECT id,"tranId",status,(state->>\'captured\')::boolean AS captured FROM public."GatewayPayment" WHERE "bookingId"=$1', booking.id);
  if (!current || current.referenceNumber !== booking.referenceNumber || current.status !== 'PENDING' || rows.length !== 1 ||
      rows[0].id !== payment.id || rows[0].tranId !== payment.tranId || rows[0].status !== 'SESSION_READY' || rows[0].captured !== false) throw Error('PRIOR_TRACED_UAT_STATE_CHANGED');
  return { ...earlier, priorOwnerSeparatedFailedPreserved: true };
}
