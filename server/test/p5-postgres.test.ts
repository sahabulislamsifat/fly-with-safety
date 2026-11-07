/** PREPARED, NOT EXECUTED. Owner must separately authorize an already migrated disposable DB.
 * All fixture writes use a single rollback-only transaction. No migration, cleanup, mail or provider.
 */
import { randomUUID } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import { disposableTarget } from './p5-disposable-target.js';
import type { Prisma as PrismaTypes } from '../src/generated/prisma/client.js';

describe('P5 real PostgreSQL identity isolation (explicit disposable approval only)', () => {
  it.skipIf(process.env.P5_DISPOSABLE_EXECUTION_APPROVED !== 'true')('checks real scope, revocation, audit immutability and rollback', async () => {
    const target = disposableTarget(process.env); // before loading a driver, environment or app
    const { PrismaClient, Prisma } = await import('../src/generated/prisma/client.js');
    const { PrismaPg } = await import('@prisma/adapter-pg');
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.connectionString, connectionTimeoutMillis: 5000, statement_timeout: 5000, options: '-c search_path=pg_catalog,public' }) });
    const oldFlag = process.env.IDENTITY_SCOPE_ENABLED;
    const prefix = 'p5-' + randomUUID(), actor = prefix + '-staff', customer = prefix + '-customer', booking = prefix + '-booking', sessionId = prefix + '-session';
    const rollback = new Error('EXPECTED_P5_ROLLBACK');
    try {
      const rows = await db.$queryRaw<Array<{ database: string; role: string; oid: number; unsafe: boolean }>>(Prisma.sql`SELECT current_database() AS database,current_user::text AS role,
        (SELECT oid::int FROM pg_database WHERE datname=current_database()) AS oid,
        (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS unsafe`);
      expect(rows).toEqual([{ database: target.database, role: target.role, oid: target.oid, unsafe: false }]);
      const migrations = await db.$queryRaw<Array<{ migration_name: string }>>(Prisma.sql`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`);
      expect(migrations.map(row => row.migration_name)).toEqual(['20260926202822_init', '20260927082715_full_schema', '20261009000000_auth_sessions_and_password_resets', '20261011000000_inquiry_idempotency', '20261011120000_notification_outbox', '20261022000100_contact_status_new', '20261022000200_booking_contact_schema', '20261103000100_gateway_sandbox_ledgers', '20261107000100_identity_scope']);
      // A disposable target must have no application users; never adopt a financial fixture database.
      expect(await db.user.count()).toBe(0); expect(await db.booking.count()).toBe(0);
      process.env.IDENTITY_SCOPE_ENABLED = 'true';
      await expect(db.$transaction(async tx => {
        vi.doMock('../src/lib/prisma.js', () => ({ prisma: { $queryRaw: (sql: PrismaTypes.Sql) => tx.$queryRaw(sql) } }));
        const { bindSession, loadPrincipal } = await import('../src/identity/auth.js');
        const { identityContext } = await import('../src/identity/policy.js');
        const { assertRecordScope, audit, invalidate } = await import('../src/identity/store.js');
        for (const [id, role] of [[actor, 'STAFF'], [customer, 'CUSTOMER']]) await tx.$executeRaw(Prisma.sql`INSERT INTO "User" (id,email,role,"emailVerified","updatedAt") VALUES (${id},${id + '@example.invalid'},${role}::"UserRole",true,clock_timestamp())`);
        await tx.session.create({ data: { id: sessionId, userId: actor, refreshTokenHash: prefix, expiresAt: new Date(Date.now() + 60000) } });
        await bindSession(tx, actor, sessionId);
        await tx.$executeRaw(Prisma.sql`INSERT INTO "IdentityMembership" ("userId",department) VALUES (${actor},'FLIGHT')`);
        await tx.$executeRaw(Prisma.sql`UPDATE "IdentitySession" SET "mfaVerifiedAt"=clock_timestamp() WHERE "sessionId"=${sessionId}`);
        await tx.booking.create({ data: { id: booking, referenceNumber: prefix, userId: customer, customerName: 'Synthetic', customerEmail: 'customer@example.invalid', bookingType: 'FLIGHT' } });
        const p = await loadPrincipal(actor, sessionId, 0);
        await expect(identityContext.run(p, () => assertRecordScope(tx, 'booking', booking, true))).rejects.toMatchObject({ statusCode: 404 });
        await tx.$executeRaw(Prisma.sql`INSERT INTO "IdentityAssignment" (id,"userId",department,"bookingId") VALUES (${prefix},${actor},'FLIGHT',${booking})`);
        await identityContext.run(p, () => assertRecordScope(tx, 'booking', booking, true));
        await audit(tx, actor, 'DISPOSABLE_SCOPE_VERIFIED', booking, 'ISOLATED_INTEGRATION');
        await tx.$executeRawUnsafe('SAVEPOINT audit_immutability'); // fixed literal, no input
        await expect(tx.$executeRaw(Prisma.sql`UPDATE "IdentityAudit" SET reason='CHANGED' WHERE "targetId"=${booking}`)).rejects.toBeDefined();
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT audit_immutability');
        await invalidate(tx, actor);
        await expect(loadPrincipal(actor, sessionId, 0)).rejects.toMatchObject({ statusCode: 401 });
        expect(await tx.booking.findUnique({ where: { id: booking }, select: { status: true } })).toEqual({ status: 'PENDING' });
        throw rollback;
      }, { timeout: 20000, maxWait: 5000 })).rejects.toBe(rollback);
      expect(await db.user.count()).toBe(0); expect(await db.booking.count()).toBe(0);
    } finally {
      if (oldFlag === undefined) delete process.env.IDENTITY_SCOPE_ENABLED; else process.env.IDENTITY_SCOPE_ENABLED = oldFlag;
      vi.doUnmock('../src/lib/prisma.js'); await db.$disconnect();
    }
  }, 45000);
});
