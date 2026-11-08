/** PREPARED, NOT EXECUTED. Owner must separately authorize an already migrated disposable DB.
 * All fixture writes use a single rollback-only transaction. No migration, cleanup, mail or provider.
 */
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { describe, it, expect, vi } from 'vitest';
import { disposableTarget } from '../p5-disposable-target.js';
const { record, recordPredicates, recordApi } = createRequire(__filename)('./journal.cjs') as { record: (stage: string, error?: unknown) => void; recordPredicates: (row: Record<string, unknown> | null) => void; recordApi: (check: string, status: number) => void };

describe('P5 real PostgreSQL identity isolation (explicit disposable approval only)', () => {
  it.skipIf(process.env.P5_DISPOSABLE_EXECUTION_APPROVED !== 'true')('checks real scope, revocation, audit immutability and rollback', async () => {
    const target = disposableTarget(process.env); // before loading a driver, environment or app
    record('TARGET_GUARD_PASS');
    const { PrismaClient, Prisma } = await import('../../src/generated/prisma/client.js');
    const { PrismaPg } = await import('@prisma/adapter-pg');
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.connectionString, connectionTimeoutMillis: 5000, statement_timeout: 5000, options: '-c search_path=pg_catalog,public' }) });
    record('PRISMA_CLIENT_CREATED');
    const oldFlag = process.env.IDENTITY_SCOPE_ENABLED;
    const prefix = 'p5-' + randomUUID(), actor = prefix + '-staff', customer = prefix + '-customer', booking = prefix + '-booking', sessionId = prefix + '-session';
    const rollback = new Error('EXPECTED_P5_ROLLBACK');
    try {
      const rows = await db.$queryRaw<Array<{ database: string; role: string; oid: number; unsafe: boolean }>>(Prisma.sql`SELECT current_database() AS database,current_user::text AS role,
        (SELECT oid::int FROM pg_database WHERE datname=current_database()) AS oid,
        (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS unsafe`);
      expect(rows).toEqual([{ database: target.database, role: target.role, oid: target.oid, unsafe: false }]);
      record('DATABASE_IDENTITY_VERIFIED');
      const migrations = await db.$queryRaw<Array<{ migration_name: string }>>(Prisma.sql`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`);
      expect(migrations.map(row => row.migration_name)).toEqual(['20260926202822_init', '20260927082715_full_schema', '20261009000000_auth_sessions_and_password_resets', '20261011000000_inquiry_idempotency', '20261011120000_notification_outbox', '20261022000100_contact_status_new', '20261022000200_booking_contact_schema', '20261103000100_gateway_sandbox_ledgers', '20261107000100_identity_scope']);
      record('MIGRATIONS_VERIFIED');
      // A disposable target must have no application users; never adopt a financial fixture database.
      expect(await db.user.count()).toBe(0); expect(await db.booking.count()).toBe(0);
      record('INITIAL_EMPTY_VERIFIED');
      process.env.IDENTITY_SCOPE_ENABLED = 'true';
      await expect(db.$transaction(async tx => {
        record('TRANSACTION_ENTERED');
        const api = await import('./api-checks.js');
        const shared = api.transactionClient(tx);
        vi.doMock('../../src/lib/prisma.js', () => ({ prisma: shared }));
        vi.doMock('../../src/config/env.js', () => ({ env: { nodeEnv: 'test', jwtSecret: api.apiSecret, emailDeliveryEnabled: false, smtpUser: '', smtpPassword: '' } }));
        vi.doMock('dotenv', () => { throw Error('PRIVATE_ENV_DISCOVERY_FORBIDDEN'); });
        vi.doMock('nodemailer', () => ({ default: { createTransport: () => { throw Error('EXTERNAL_MAIL_FORBIDDEN'); } } }));
        const { bindSession, loadPrincipal } = await import('../../src/identity/auth.js');
        const { identityContext } = await import('../../src/identity/policy.js');
        const { assertRecordScope, audit, invalidate } = await import('../../src/identity/store.js');
        for (const [id, role] of [[actor, 'STAFF'], [customer, 'CUSTOMER']]) await tx.$executeRaw(Prisma.sql`INSERT INTO "User" (id,email,role,"emailVerified","updatedAt") VALUES (${id},${id + '@example.invalid'},${role}::"UserRole",true,clock_timestamp())`);
        record('USERS_INSERTED');
        await tx.session.create({ data: { id: sessionId, userId: actor, refreshTokenHash: prefix, expiresAt: new Date(Date.now() + 60000) } });
        await bindSession(tx, actor, sessionId);
        record('SESSION_CREATED');
        await tx.$executeRaw(Prisma.sql`INSERT INTO "IdentityMembership" ("userId",department) VALUES (${actor},'FLIGHT')`);
        await tx.$executeRaw(Prisma.sql`UPDATE "IdentitySession" SET "mfaVerifiedAt"=clock_timestamp() WHERE "sessionId"=${sessionId}`);
        await tx.booking.create({ data: { id: booking, referenceNumber: prefix.toUpperCase(), userId: customer, customerName: 'Synthetic', customerEmail: 'customer@example.invalid', bookingType: 'FLIGHT' } });
        record('BOOKING_CREATED');
        const predicates = await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT (s."revokedAt" IS NULL) AS "notRevoked",(s."expiresAt">(clock_timestamp() AT TIME ZONE 'UTC')) AS unexpired,
            (s."expiresAt">clock_timestamp() AT TIME ZONE 'UTC') AS "unexpiredUsingUtc",
            (a.version=i.version AND a.version=0) AS "versionsMatch",
            (i."mfaVersion"=a."mfaVersion") AS "mfaVersionsMatch",(NOT a.suspended) AS "notSuspended",
            (u.role::text='STAFF') AS "staffRole",u."emailVerified",current_setting('TimeZone') AS "databaseTimeZone"
          FROM "Session" s JOIN "User" u ON u.id=s."userId" JOIN "IdentityAccount" a ON a."userId"=u.id
          JOIN "IdentitySession" i ON i."sessionId"=s.id WHERE s.id=${sessionId} AND u.id=${actor}`);
        recordPredicates(predicates[0] || null);
        // Both fixed literal SET LOCAL statements are transaction-scoped and roll back.
        for (const zone of ['UTC', 'Asia/Dhaka']) {
          if (zone === 'UTC') await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
          else await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'Asia/Dhaka'");
          const fresh = await loadPrincipal(actor, sessionId, 0);
          await expect(identityContext.run(fresh, () => assertRecordScope(tx, 'booking', booking, true))).rejects.toMatchObject({ statusCode: 404 });
          record(zone === 'UTC' ? 'UTC_SESSION_AND_SCOPE_PASS' : 'DHAKA_SESSION_AND_SCOPE_PASS');
          await tx.session.update({ where: { id: sessionId }, data: { expiresAt: new Date(Date.now() - 1000) } });
          await expect(loadPrincipal(actor, sessionId, 0)).rejects.toMatchObject({ statusCode: 401 });
          await expect(identityContext.run(fresh, () => assertRecordScope(tx, 'booking', booking, true))).rejects.toMatchObject({ statusCode: 401 });
          record(zone === 'UTC' ? 'UTC_EXPIRED_SESSION_DENIED' : 'DHAKA_EXPIRED_SESSION_DENIED');
          await tx.session.update({ where: { id: sessionId }, data: { expiresAt: new Date(Date.now() + 60000) } });
        }
        record('PRINCIPAL_LOAD_STARTED');
        const p = await loadPrincipal(actor, sessionId, 0);
        record('PRINCIPAL_LOADED');
        record('UNASSIGNED_CHECK_STARTED');
        await expect(identityContext.run(p, () => assertRecordScope(tx, 'booking', booking, true))).rejects.toMatchObject({ statusCode: 404 });
        record('UNASSIGNED_DENIED');
        await tx.$executeRaw(Prisma.sql`INSERT INTO "IdentityAssignment" (id,"userId",department,"bookingId") VALUES (${prefix},${actor},'FLIGHT',${booking})`);
        await identityContext.run(p, () => assertRecordScope(tx, 'booking', booking, true));
        record('ASSIGNED_ADMITTED');
        await audit(tx, actor, 'DISPOSABLE_SCOPE_VERIFIED', booking, 'ISOLATED_INTEGRATION');
        record('AUDIT_INSERTED');
        await tx.$executeRawUnsafe('SAVEPOINT audit_immutability'); // fixed literal, no input
        await expect(tx.$executeRaw(Prisma.sql`UPDATE "IdentityAudit" SET reason='CHANGED' WHERE "targetId"=${booking}`).catch(error => { record('AUDIT_UPDATE_REJECTED', error); throw error; })).rejects.toBeDefined();
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT audit_immutability');
        await invalidate(tx, actor);
        await expect(loadPrincipal(actor, sessionId, 0)).rejects.toMatchObject({ statusCode: 401 });
        record('SESSION_INVALIDATED');
        expect(await tx.booking.findUnique({ where: { id: booking }, select: { status: true } })).toEqual({ status: 'PENDING' });
        const count = await api.runApiChecks(tx, { prefix, staff: actor, customer, booking, record: recordApi, recordError: error => record('API_UNEXPECTED_ERROR', error) });
        expect(count).toBe(24);
        record('FOUR_ROLE_API_PASS');
        throw rollback;
      }, { timeout: 20000, maxWait: 5000 }).catch(error => { if (error !== rollback) record('TRANSACTION_ERROR', error); throw error; })).rejects.toBe(rollback);
      record('ROLLBACK_CONFIRMED');
      expect(await db.user.count()).toBe(0); expect(await db.booking.count()).toBe(0);
      record('FINAL_EMPTY_VERIFIED');
    } catch (error) {
      record('TEST_ERROR', error); throw error;
    } finally {
      if (oldFlag === undefined) delete process.env.IDENTITY_SCOPE_ENABLED; else process.env.IDENTITY_SCOPE_ENABLED = oldFlag;
      vi.doUnmock('../../src/lib/prisma.js'); await db.$disconnect();
      vi.doUnmock('../../src/config/env.js'); vi.doUnmock('dotenv'); vi.doUnmock('nodemailer');
      record('CLIENT_DISCONNECTED');
    }
  }, 45000);
});
