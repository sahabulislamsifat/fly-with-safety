import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { roles, departments, type Principal, type Role } from './policy.js';
import type { Database } from './store.js';

export async function loadPrincipal(userId: string, sessionId: string, version: unknown): Promise<Principal> {
  if (!Number.isSafeInteger(version)) throw AppError.unauthorized('Sign in after identity activation');
  const rows = await prisma.$queryRaw<Array<Omit<Principal, 'departments'> & { suspended: boolean; valid: boolean; verified: boolean }>>(Prisma.sql`/*p5:session*/
    SELECT u.id,u.email,u.name,u.role::text AS role,a.suspended,a.version,a."mfaVersion",u."emailVerified" AS verified,
      s.id AS "sessionId",(a.version=i.version AND a.version=${version} AND i."mfaVersion"=a."mfaVersion") AS valid,
      (i."mfaVerifiedAt">clock_timestamp()-interval '15 minutes') IS TRUE AS "mfaVerified"
    FROM "Session" s JOIN "User" u ON u.id=s."userId" JOIN "IdentityAccount" a ON a."userId"=u.id
    JOIN "IdentitySession" i ON i."sessionId"=s.id
    WHERE s.id=${sessionId} AND u.id=${userId} AND s."revokedAt" IS NULL AND s."expiresAt">(clock_timestamp() AT TIME ZONE 'UTC')`);
  const row = rows[0];
  if (rows.length !== 1 || !row.valid || row.suspended || !roles.includes(row.role) || (row.role !== 'CUSTOMER' && !row.verified)) throw AppError.unauthorized('Identity unavailable');
  const memberships = await prisma.$queryRaw<Array<{ department: string }>>(Prisma.sql`/*p5:memberships*/ SELECT department::text FROM "IdentityMembership" WHERE "userId"=${row.id}`);
  return { id: row.id, email: row.email, name: row.name, role: row.role, version: row.version, sessionId,
    mfaVersion: row.mfaVersion, mfaVerified: row.mfaVerified,
    departments: memberships.map(m => m.department).filter((d): d is Principal['departments'][number] => departments.includes(d as Principal['departments'][number])) };
}

/** Runs in the same transaction as the existing refresh-session insert. */
export async function bindSession(db: Database, userId: string, sessionId: string) {
  await db.$executeRaw(Prisma.sql`/*p5:ensure-account*/ INSERT INTO "IdentityAccount" ("userId") VALUES (${userId}) ON CONFLICT DO NOTHING`);
  const rows = await db.$queryRaw<Array<{ role: Role; version: number; mfaVersion: number; suspended: boolean; verified: boolean }>>(Prisma.sql`/*p5:bind-account*/
    SELECT u.role::text AS role,a.version,a."mfaVersion",a.suspended,u."emailVerified" AS verified
    FROM "IdentityAccount" a JOIN "User" u ON u.id=a."userId" WHERE u.id=${userId} FOR SHARE OF a,u`);
  const row = rows[0];
  if (rows.length !== 1 || row.suspended || !roles.includes(row.role) || (row.role !== 'CUSTOMER' && !row.verified)) throw AppError.unauthorized('Identity unavailable');
  await db.$executeRaw(Prisma.sql`/*p5:bind-session*/ INSERT INTO "IdentitySession" ("sessionId",version,"mfaVersion") VALUES (${sessionId},${row.version},${row.mfaVersion})`);
  return row;
}
