import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { audit, governanceTransaction, invalidate } from './store.js';

/** Inert component for an exact-identity private provisioning command. No HTTP route.
 * Run only under a separately approved database execution/provisioning scope.
 */
export async function provisionPrimaryOwner(db: Pick<PrismaClient, '$transaction'>, input: { userId: string; verifiedEmail: string; expectedDatabase: string; expectedOid: number; ownerApproved: boolean }) {
  if (input.ownerApproved !== true || !input.userId || !input.verifiedEmail || !Number.isSafeInteger(input.expectedOid)) throw Error('OWNER_PROVISIONING_APPROVAL_REQUIRED');
  return governanceTransaction(async tx => {
    const identity = await tx.$queryRaw<Array<{ database: string; oid: number }>>(Prisma.sql`/*p5:bootstrap-target*/ SELECT current_database() AS database,(SELECT oid::int FROM pg_database WHERE datname=current_database()) AS oid`);
    if (identity.length !== 1 || identity[0].database !== input.expectedDatabase || identity[0].oid !== input.expectedOid) throw Error('BOOTSTRAP_TARGET_MISMATCH');
    const owners = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`/*p5:bootstrap-existing*/ SELECT id FROM "User" WHERE role::text='SUPER_ADMIN'`);
    if (owners.length) throw Error('PRIMARY_OWNER_ALREADY_EXISTS');
    const targets = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`/*p5:bootstrap-user*/ SELECT u.id FROM "User" u
      JOIN "IdentityAccount" a ON a."userId"=u.id JOIN "IdentityMfa" m ON m."userId"=u.id
      WHERE u.id=${input.userId} AND u.email=${input.verifiedEmail} AND u."emailVerified" AND u.password IS NOT NULL
        AND NOT a.suspended AND u.role::text='ADMIN' AND m.secret IS NOT NULL FOR UPDATE OF u,a,m`);
    if (targets.length !== 1) throw Error('VERIFIED_MFA_OWNER_IDENTITY_REQUIRED');
    await tx.$executeRaw(Prisma.sql`/*p5:bootstrap-role*/ UPDATE "User" SET role='SUPER_ADMIN',"updatedAt"=clock_timestamp() WHERE id=${input.userId}`);
    await invalidate(tx, input.userId);
    await audit(tx, input.userId, 'PRIMARY_OWNER_PROVISIONED', input.userId, 'OWNER_APPROVED_BOOTSTRAP');
    return { provisioned: true, sessionsRevoked: true };
  }, db);
}
