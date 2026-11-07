/** Real Express routers + real transaction-bound Prisma. Seeded MFA proof is test-only.
 * Nested service transactions use PostgreSQL SAVEPOINTs inside the outer rollback fixture.
 */
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { Prisma, PrismaClient } from '../../src/generated/prisma/client.js';
type Tx = Prisma.TransactionClient;
export const apiSecret = randomBytes(32).toString('hex');
export function transactionClient(tx: Tx): PrismaClient {
  const nested = async (work: (client: Tx) => Promise<unknown>) => {
    await tx.$executeRawUnsafe('SAVEPOINT p5_api_action');
    try { const value = await work(tx); await tx.$executeRawUnsafe('RELEASE SAVEPOINT p5_api_action'); return value; }
    catch (error) { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT p5_api_action'); await tx.$executeRawUnsafe('RELEASE SAVEPOINT p5_api_action'); throw error; }
  };
  return new Proxy(tx as object, { get(target, key) {
    if (key === '$transaction') return nested;
    const value = Reflect.get(target, key);
    return typeof value === 'function' ? value.bind(target) : value;
  } }) as PrismaClient;
}
export async function createApiApplication(recordError: (error: unknown) => void = () => {}) {
  const unwrap = (value: unknown): express.Router => {
    for (let i = 0; i < 3; i++) {
      if (typeof value === 'function') return value as express.Router;
      if (value && typeof value === 'object' && 'default' in value) value = value.default;
      else break;
    }
    throw Error('ACTUAL_ROUTER_EXPORT_REQUIRED');
  };
  const identity = unwrap(await import('../../src/identity/routes.js'));
  const admin = unwrap(await import('../../src/routes/admin.routes.js'));
  const account = unwrap(await import('../../src/routes/account.routes.js'));
  const { isAppError } = await import('../../src/utils/errors.js');
  const app = express(); app.use(express.json()); app.use('/api/v1', identity, admin, account);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next; // Express requires four arguments to recognize an error handler.
    if (!isAppError(error)) recordError(error);
    res.status(isAppError(error) ? error.statusCode : 500).json({ code: isAppError(error) ? error.code : 'INTERNAL_ERROR' });
  });
  return app;
}
export async function runApiChecks(tx: Tx, input: {
  prefix: string; staff: string; customer: string; booking: string;
  record: (check: string, status: number) => void;
  recordError: (error: unknown) => void;
}) {
  const { Prisma: P } = await import('../../src/generated/prisma/client.js');
  const { bindSession } = await import('../../src/identity/auth.js');
  const ids = { STAFF: input.staff, CUSTOMER: input.customer, ADMIN: input.prefix + '-admin', SUPER_ADMIN: input.prefix + '-owner' };
  const foreign = input.prefix + '-foreign', foreignBooking = input.prefix + '-foreign-booking';
  for (const [id, role] of [[ids.ADMIN, 'ADMIN'], [ids.SUPER_ADMIN, 'SUPER_ADMIN'], [foreign, 'CUSTOMER']]) {
    await tx.$executeRaw(P.sql`INSERT INTO "User" (id,email,role,"emailVerified","updatedAt") VALUES (${id},${id + '@example.invalid'},${role}::"UserRole",true,clock_timestamp())`);
  }
  await tx.booking.create({ data: { id: foreignBooking, referenceNumber: (input.prefix + '-foreign').toUpperCase(), userId: foreign, customerName: 'Synthetic foreign owner', customerEmail: 'foreign@example.invalid', bookingType: 'FLIGHT' } });
  const tokens = {} as Record<keyof typeof ids, string>;
  for (const role of ['STAFF', 'CUSTOMER', 'ADMIN', 'SUPER_ADMIN'] as const) {
    const id = ids[role], sid = input.prefix + '-api-' + role;
    await tx.session.create({ data: { id: sid, userId: id, refreshTokenHash: sid, expiresAt: new Date(Date.now() + 60000) } });
    const bound = await bindSession(tx, id, sid);
    if (role !== 'CUSTOMER') await tx.$executeRaw(P.sql`UPDATE "IdentitySession" SET "mfaVerifiedAt"=clock_timestamp() WHERE "sessionId"=${sid}`);
    // Deliberately stale elevated claim: the backend must still resolve CUSTOMER from the database.
    tokens[role] = jwt.sign({ sub: id, email: id + '@example.invalid', role: role === 'CUSTOMER' ? 'SUPER_ADMIN' : role, sid, ver: bound.version }, apiSecret, { expiresIn: '5m' });
  }
  const app = await createApiApplication(input.recordError);
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  let count = 0;
  async function call(role: keyof typeof ids, method: 'get' | 'patch', endpoint: string, status: number, label: string, data?: object, token = tokens[role]) {
    assert(++count <= 30, 'HTTP_REQUEST_CAP');
    let req = request(server)[method]('/api/v1' + endpoint).set('Authorization', 'Bearer ' + token).timeout({ response: 3000, deadline: 5000 });
    if (data) req = req.send(data);
    const response = await req;
    input.record(label, response.status);
    assert.equal(response.status, status, label);
    return response;
  }
  try {
    for (const role of ['STAFF', 'CUSTOMER', 'ADMIN', 'SUPER_ADMIN'] as const) {
      const r = await call(role, 'get', '/identity/me', 200, role + '_ME'); assert.equal(r.body.data.role, role);
    }
    for (const role of ['STAFF', 'CUSTOMER', 'ADMIN', 'SUPER_ADMIN'] as const) await call(role, 'get', '/identity/audit', role === 'SUPER_ADMIN' ? 200 : 403, role + '_AUDIT');
    await call('ADMIN', 'get', '/identity/customers', 200, 'ADMIN_CUSTOMERS');
    await call('STAFF', 'get', '/identity/customers', 403, 'STAFF_CUSTOMERS_DENIED');
    await call('CUSTOMER', 'get', '/identity/customers', 403, 'CUSTOMER_CUSTOMERS_DENIED');
    await call('SUPER_ADMIN', 'patch', '/identity/users/' + ids.SUPER_ADMIN, 403, 'OWNER_SELF_DEMOTION_DENIED', { role: 'CUSTOMER', reason: 'ROLE_POLICY' });
    await call('ADMIN', 'patch', '/identity/users/' + ids.STAFF, 403, 'ADMIN_PROMOTION_DENIED', { role: 'ADMIN', reason: 'ROLE_POLICY' });
    await call('CUSTOMER', 'patch', '/identity/users/' + ids.CUSTOMER, 400, 'SUPER_PROMOTION_SCHEMA_DENIED', { role: 'SUPER_ADMIN', reason: 'ROLE_POLICY' });
    await call('STAFF', 'get', '/admin/inquiries/hotels', 403, 'STAFF_FOREIGN_DEPARTMENT_DENIED');
    const ownBooking = await call('CUSTOMER', 'get', '/account/bookings/' + input.prefix.toUpperCase(), 200, 'CUSTOMER_OWN_BOOKING');
    assert.equal(ownBooking.body.data.booking.referenceNumber, input.prefix.toUpperCase());
    await call('CUSTOMER', 'get', '/account/bookings/' + (input.prefix + '-foreign').toUpperCase(), 404, 'CUSTOMER_FOREIGN_BOOKING_DENIED');
    await call('STAFF', 'patch', '/admin/bookings/' + input.booking + '/status', 200, 'STAFF_ASSIGNED_BOOKING', { status: 'PENDING' });
    await call('STAFF', 'patch', '/admin/bookings/' + foreignBooking + '/status', 404, 'STAFF_UNASSIGNED_BOOKING_DENIED', { status: 'PENDING' });
    const sid = input.prefix + '-no-mfa';
    await tx.session.create({ data: { id: sid, userId: ids.ADMIN, refreshTokenHash: sid, expiresAt: new Date(Date.now() + 60000) } });
    const bound = await bindSession(tx, ids.ADMIN, sid);
    const noMfa = jwt.sign({ sub: ids.ADMIN, role: 'ADMIN', sid, ver: bound.version }, apiSecret, { expiresIn: '5m' });
    await call('ADMIN', 'get', '/identity/customers', 403, 'ADMIN_MFA_REQUIRED', undefined, noMfa);
    await call('ADMIN', 'patch', '/identity/users/' + ids.CUSTOMER, 200, 'ADMIN_SUSPEND_CUSTOMER', { suspended: true, reason: 'ACCOUNT_SUPPORT' });
    await call('CUSTOMER', 'get', '/identity/me', 401, 'SUSPENDED_SESSION_DENIED');
    await call('SUPER_ADMIN', 'patch', '/identity/users/' + ids.ADMIN, 200, 'OWNER_DEMOTE_ADMIN', { role: 'CUSTOMER', reason: 'ROLE_POLICY' });
    await call('ADMIN', 'get', '/identity/me', 401, 'DEMOTED_SESSION_DENIED');
    const versions = await tx.$queryRaw<Array<{ userId: string; version: number; suspended: boolean }>>(P.sql`SELECT "userId",version,suspended FROM "IdentityAccount" WHERE "userId" IN (${ids.ADMIN},${ids.CUSTOMER})`);
    assert.equal(versions.length, 2); assert(versions.every(r => r.version === 1)); assert(versions.find(r => r.userId === ids.CUSTOMER)?.suspended);
    const roles = await tx.$queryRaw<Array<{ id: string; role: string }>>(P.sql`SELECT id,role::text AS role FROM "User" WHERE id IN (${ids.ADMIN},${ids.CUSTOMER},${ids.STAFF},${ids.SUPER_ADMIN})`);
    assert.equal(roles.length, 4);
    for (const [id, role] of [[ids.ADMIN, 'CUSTOMER'], [ids.CUSTOMER, 'CUSTOMER'], [ids.STAFF, 'STAFF'], [ids.SUPER_ADMIN, 'SUPER_ADMIN']]) assert.equal(roles.find(r => r.id === id)?.role, role);
    assert.equal(await tx.session.count({ where: { userId: { in: [ids.ADMIN, ids.CUSTOMER] }, revokedAt: null } }), 0);
    const finance = await tx.$queryRaw<Array<{ payments: number; refunds: number }>>(P.sql`SELECT (SELECT count(*)::int FROM "GatewayPayment") AS payments,(SELECT count(*)::int FROM "GatewayRefund") AS refunds`);
    assert.deepEqual(finance, [{ payments: 0, refunds: 0 }]);
    assert.equal(await tx.booking.count({ where: { status: { not: 'PENDING' } } }), 0);
    assert.equal(await tx.bookingStatusHistory.count(), 0);
    assert.equal(await tx.notificationOutbox.count(), 0);
    return count;
  } finally { await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); }); }
}
