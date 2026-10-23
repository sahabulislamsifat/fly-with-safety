import { assertPhase1hTarget as assertDisposableTarget } from '../integration-target.mjs';

// Launched only by the separately approved reliability suite, never a standalone test.
assertDisposableTarget(process.env);
if (process.env.RUN_RELIABILITY_INTEGRATION !== 'true' || process.env.NODE_ENV !== 'test') throw new Error('Integration opt-in required');
async function main() {
 const input = JSON.parse(process.argv[2]);
 const { prisma } = await import('../../src/lib/prisma.js');
 try {
  if (input.claimId) {
    const row = await prisma.notificationOutbox.findUnique({ where: { id: input.claimId } });
    if (!row || !row.id.startsWith('reliability-') || !row.recipient.endsWith('@example.test')) throw new Error('Synthetic row required');
    const claimed = await prisma.notificationOutbox.updateMany({
      where: { id: row.id, status: 'PENDING', updatedAt: row.updatedAt },
      data: { status: 'PROCESSING', updatedAt: new Date(Math.max(Date.now(), +row.updatedAt + 1)) },
    });
    if (claimed.count !== 1) throw new Error('Claim failed');
    // Abrupt process exit after committed claim: deliberately bypass normal disconnect/finalization.
    process.stdout.write('claimed', () => process.exit(0));
    await new Promise(() => {});
  }
  const existing = await prisma.idempotencyRecord.findUnique({ where: { operation_principal_key: {
    operation: 'booking:create', principal: `user:${input.userId}`, key: input.key,
  } } });
  if (!existing) throw new Error('Replay fixture must already exist');
  const { createBooking } = await import('../../src/services/booking.service.js');
  const result = await createBooking(input.payload, input.userId, input.key);
  process.stdout.write(result.id);
 } finally { await prisma.$disconnect(); }
}
main().catch(() => { process.stderr.write('Synthetic integration child failed'); process.exitCode = 1; });
