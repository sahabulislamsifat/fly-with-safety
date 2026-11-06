import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Prisma } from '../../src/generated/prisma/client.js';
import { verifyPriorFailed } from './retained.js';

const dashboardCandidate = 'FWS96701848208cfaad3846c7e850';

export async function verifyRetainedCloudflare(db: Prisma.TransactionClient, repo: string) {
  await verifyPriorFailed(db, repo);
  const evidence = resolve(repo, 'output/phase3/failed-uat-cloudflare-20261106-01/owned-final.json');
  const saved = JSON.parse(readFileSync(evidence, 'utf8'));
  const [booking] = saved.bookings, [payment] = saved.payments;
  if (saved.bookings.length !== 1 || saved.payments.length !== 1 || booking.status !== 'PENDING' || payment.status !== 'SESSION_READY' || payment.captured !== false || payment.bookingId !== booking.id) throw Error('PRIOR_CLOUDFLARE_EVIDENCE_MISMATCH');
  const row = await db.booking.findUnique({ where: { id: booking.id }, select: { referenceNumber: true, status: true } });
  const payments = await db.$queryRawUnsafe<Array<{ id: string; tranId: string; status: string; captured: boolean }>>(
    'SELECT id,"tranId",status,(state->>\'captured\')::boolean AS captured FROM public."GatewayPayment" WHERE "bookingId"=$1', booking.id);
  if (!row || row.referenceNumber !== booking.referenceNumber || row.status !== 'PENDING' || payments.length !== 1 || payments[0].id !== payment.id ||
      payments[0].status !== 'SESSION_READY' || payments[0].captured !== false) throw Error('PRIOR_CLOUDFLARE_STATE_CHANGED');
  return { priorCloudflarePreserved: true, dashboardMerchantIdMatched: payments[0].tranId === dashboardCandidate };
}
