import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/errors.js';
import { audit, governanceTransaction, lockPrincipal, type Database } from './store.js';
import type { Principal } from './policy.js';
import { base32, hash, matchStep, open, seal } from './crypto.js';

type Factor = { secret: string | null; pendingSecret: string | null; pendingValid: boolean; lastStep: bigint; recoveryHashes: string[] };
async function factor(db: Database, userId: string) {
  const rows = await db.$queryRaw<Factor[]>(Prisma.sql`/*p5:factor*/ SELECT secret,"pendingSecret",("pendingUntil">clock_timestamp()) IS TRUE AS "pendingValid","lastStep","recoveryHashes" FROM "IdentityMfa" WHERE "userId"=${userId} FOR UPDATE`);
  return rows[0];
}
async function challenge(db: Database, p: Principal) {
  await lockPrincipal(db, p);
  const rows = await db.$queryRaw<Array<{ blocked: boolean; failures: number }>>(Prisma.sql`/*p5:challenge*/
    SELECT ("mfaBlockedUntil">clock_timestamp()) IS TRUE AS blocked,
      CASE WHEN "mfaBlockedUntil"<=clock_timestamp() THEN 0 ELSE "mfaFailures" END AS failures
    FROM "IdentityAccount" WHERE "userId"=${p.id} FOR UPDATE`);
  if (rows.length !== 1 || rows[0].blocked) throw new AppError('MFA challenge unavailable', 429, 'MFA_RATE_LIMIT');
  return rows[0].failures;
}
async function failed(db: Database, p: Principal, failures: number) {
  await db.$executeRaw(Prisma.sql`/*p5:mfa-failed*/ UPDATE "IdentityAccount" SET "mfaFailures"=${failures + 1},
    "mfaBlockedUntil"=CASE WHEN ${failures + 1}>=5 THEN clock_timestamp()+interval '10 minutes' ELSE NULL END WHERE "userId"=${p.id}`);
  await audit(db, p.id, 'MFA_REJECTED', p.id, 'SECOND_FACTOR');
  return { ok: false as const };
}
async function succeeded(db: Database, p: Principal, version: number) {
  await db.$executeRaw(Prisma.sql`/*p5:mfa-reset-failures*/ UPDATE "IdentityAccount" SET "mfaFailures"=0,"mfaBlockedUntil"=NULL WHERE "userId"=${p.id}`);
  await db.$executeRaw(Prisma.sql`/*p5:mfa-proof*/ UPDATE "IdentitySession" SET "mfaVerifiedAt"=clock_timestamp(),"mfaVersion"=${version},failures=0,"blockedUntil"=NULL WHERE "sessionId"=${p.sessionId}`);
}
function unwrap<T extends { ok: boolean }>(value: T) {
  if (!value.ok) throw AppError.unauthorized('MFA challenge rejected');
  return value;
}
export async function beginEnrollment(p: Principal, password: string) {
  const secret = base32(randomBytes(20));
  const result = await governanceTransaction(async db => {
    const failures = await challenge(db, p);
    const old = await factor(db, p.id);
    if (old?.secret && !p.mfaVerified) throw AppError.forbidden('Verify an existing factor or recovery code first');
    const users = await db.$queryRaw<Array<{ password: string | null }>>(Prisma.sql`/*p5:mfa-password*/ SELECT password FROM "User" WHERE id=${p.id}`);
    if (!users[0]?.password || !await bcrypt.compare(password, users[0].password)) return failed(db, p, failures);
    await db.$executeRaw(Prisma.sql`/*p5:mfa-enroll*/ INSERT INTO "IdentityMfa" ("userId","pendingSecret","pendingUntil","recoveryHashes")
      VALUES (${p.id},${seal(secret, p.id)},clock_timestamp()+interval '10 minutes',ARRAY[]::text[])
      ON CONFLICT ("userId") DO UPDATE SET "pendingSecret"=EXCLUDED."pendingSecret","pendingUntil"=EXCLUDED."pendingUntil"`);
    await audit(db, p.id, 'MFA_ENROLLMENT_STARTED', p.id, 'SECOND_FACTOR');
    return { ok: true as const };
  });
  unwrap(result);
  return { secret, uri: `otpauth://totp/${encodeURIComponent('FlyWithSafety:' + p.email)}?secret=${secret}&issuer=FlyWithSafety&algorithm=SHA1&digits=6&period=30` };
}
export async function confirmEnrollment(p: Principal, code: string) {
  const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(16).toString('hex'));
  const result = await governanceTransaction(async db => {
    const failures = await challenge(db, p), current = await factor(db, p.id);
    const clock = await db.$queryRaw<Array<{ now: Date }>>(Prisma.sql`/*p5:clock*/ SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`);
    const step = current?.pendingSecret && current.pendingValid ? matchStep(open(current.pendingSecret, p.id), code, clock[0].now, -1n) : undefined;
    if (step === undefined) return failed(db, p, failures);
    if (current.secret && !p.mfaVerified) throw AppError.forbidden('Verify an existing factor before replacement');
    await db.$executeRaw(Prisma.sql`/*p5:mfa-confirm*/ UPDATE "IdentityMfa" SET secret="pendingSecret","pendingSecret"=NULL,"pendingUntil"=NULL,"lastStep"=${step},"recoveryHashes"=ARRAY[${Prisma.join(recoveryCodes.map(c => hash(p.id + ':' + c)))}]::text[] WHERE "userId"=${p.id}`);
    await db.$executeRaw(Prisma.sql`/*p5:mfa-version*/ UPDATE "IdentityAccount" SET "mfaVersion"="mfaVersion"+1 WHERE "userId"=${p.id}`);
    await db.$executeRaw(Prisma.sql`/*p5:mfa-revoke-other*/ UPDATE "Session" SET "revokedAt"=clock_timestamp() WHERE "userId"=${p.id} AND id<>${p.sessionId} AND "revokedAt" IS NULL`);
    await succeeded(db, p, p.mfaVersion + 1);
    await audit(db, p.id, 'MFA_ENROLLED', p.id, 'SECOND_FACTOR');
    return { ok: true as const };
  });
  unwrap(result);
  return { enrolled: true, recoveryCodes };
}
export async function verifyFactor(p: Principal, code: string, recovery = false) {
  const result = await governanceTransaction(async db => {
    const failures = await challenge(db, p), current = await factor(db, p.id);
    if (!current?.secret) return failed(db, p, failures);
    if (recovery) {
      const value = hash(p.id + ':' + code);
      if (!current.recoveryHashes.includes(value)) return failed(db, p, failures);
      await db.$executeRaw(Prisma.sql`/*p5:recovery-consume*/ UPDATE "IdentityMfa" SET "recoveryHashes"=array_remove("recoveryHashes",${value}) WHERE "userId"=${p.id}`);
      await db.$executeRaw(Prisma.sql`/*p5:mfa-revoke-other*/ UPDATE "Session" SET "revokedAt"=clock_timestamp() WHERE "userId"=${p.id} AND id<>${p.sessionId} AND "revokedAt" IS NULL`);
    } else {
      const clock = await db.$queryRaw<Array<{ now: Date }>>(Prisma.sql`/*p5:clock*/ SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`);
      const step = matchStep(open(current.secret, p.id), code, clock[0].now, BigInt(current.lastStep));
      if (step === undefined) return failed(db, p, failures);
      await db.$executeRaw(Prisma.sql`/*p5:mfa-step*/ UPDATE "IdentityMfa" SET "lastStep"=${step} WHERE "userId"=${p.id}`);
    }
    await succeeded(db, p, p.mfaVersion);
    await audit(db, p.id, recovery ? 'MFA_RECOVERY_USED' : 'MFA_VERIFIED', p.id, 'SECOND_FACTOR');
    return { ok: true as const };
  });
  unwrap(result);
  return { verified: true };
}
