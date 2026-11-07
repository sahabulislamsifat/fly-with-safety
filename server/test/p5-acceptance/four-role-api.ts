/** PREPARED ONLY. Actual HTTP + PostgreSQL checks; no mock authorization boundary.
 * Requires an approved isolated fixture driver and local invitation mail sink.
 * Not invoked by the narrow PostgreSQL recovery caller.
 */
import assert from 'node:assert/strict';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { APIRequestContext } from 'C:/Users/sahab/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright';

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'STAFF' | 'CUSTOMER';
export type Actors = Record<Role, APIRequestContext>;
export type Check = { check: string; status: number | 'PASS' };
export function isolatedOrigin(value: string) {
  const url = new URL(value);
  assert.equal(url.protocol, 'http:'); assert.equal(url.hostname, '127.0.0.1');
  assert(!['', '3000', '5000', '5432'].includes(url.port));
  assert(!url.username && !url.password && !url.search && !url.hash);
  return url.origin;
}
export async function verifyAcceptanceDatabase(db: PrismaClient) {
  const rows = await db.$queryRaw<Array<{ database: string; role: string; oid: number; address: string; port: number; unsafe: boolean }>>`
    SELECT current_database() AS database,current_user::text AS role,
      (SELECT oid::int FROM pg_database WHERE datname=current_database()) AS oid,
      host(inet_server_addr()) AS address,inet_server_port() AS port,
      (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolreplication FROM pg_roles WHERE rolname=current_user) AS unsafe`;
  assert.deepEqual(rows, [{ database: 'flywithsafety_p5_identity_scope_test', role: 'fws_p5_identity_app', oid: 35402, address: '127.0.0.1', port: 5432, unsafe: false }]);
}
export async function runFourRoleApiChecks(input: {
  db: PrismaClient; apiBase: string; frontendOrigin: string; actors: Actors;
  ownerId: string; staffId: string; suspensionCustomerId: string; demotionAdminId: string;
  assignedBookingId: string; unassignedBookingId: string;
  ownReference: string; foreignReference: string;
  suspensionSubject: APIRequestContext; demotionSubject: APIRequestContext;
  invitationEmail: string; newInvitationPassword: string;
  invitationToken: (id: string) => Promise<string>;
  assertFixtureOwnership: () => Promise<void>;
  assertFinancePreserved: () => Promise<void>;
}) {
  const origin = isolatedOrigin(input.apiBase), frontend = isolatedOrigin(input.frontendOrigin);
  assert.equal(new URL(input.apiBase).pathname, '/api/v1'); assert.equal(input.frontendOrigin, frontend);
  assert(input.invitationEmail.endsWith('@example.invalid'));
  await verifyAcceptanceDatabase(input.db); await input.assertFixtureOwnership();
  const results: Check[] = []; let requests = 0;
  const call = async (role: Role, method: string, endpoint: string, expected: number, data?: unknown) => {
    assert(++requests <= 50, 'ACCEPTANCE_HTTP_CAP');
    const response = await input.actors[role].fetch(input.apiBase + endpoint, { method, maxRedirects: 0, headers: { Origin: frontend }, ...(data === undefined ? {} : { data }) });
    assert.equal(new URL(response.url()).origin, origin); assert.equal(response.status(), expected, `${role} ${method} ${endpoint.split('/').slice(0,3).join('/')}`);
    results.push({ check: `${role} ${method} ${endpoint.includes('/identity/users/') ? '/identity/users/[owned]' : endpoint.includes('/bookings/') ? '/bookings/[owned]' : endpoint}`, status: expected });
    return response;
  };
  for (const role of ['SUPER_ADMIN', 'ADMIN', 'STAFF', 'CUSTOMER'] as const) {
    const response = await call(role, 'GET', '/identity/me', 200);
    assert.equal((await response.json()).data.role, role);
  }
  await call('SUPER_ADMIN', 'GET', '/identity/audit', 200);
  await call('ADMIN', 'GET', '/identity/customers', 200);
  await call('STAFF', 'GET', '/identity/customers', 403);
  await call('CUSTOMER', 'GET', '/identity/audit', 403);
  await call('STAFF', 'GET', '/admin/inquiries/hotels', 403);
  await call('CUSTOMER', 'GET', `/account/bookings/${encodeURIComponent(input.ownReference)}`, 200);
  await call('CUSTOMER', 'GET', `/account/bookings/${encodeURIComponent(input.foreignReference)}`, 404);
  await call('STAFF', 'PATCH', `/admin/bookings/${encodeURIComponent(input.unassignedBookingId)}/status`, 404, { status: 'PENDING' });
  await call('STAFF', 'PATCH', `/admin/bookings/${encodeURIComponent(input.assignedBookingId)}/status`, 200, { status: 'PENDING' });
  await call('ADMIN', 'PATCH', `/identity/users/${encodeURIComponent(input.staffId)}`, 403, { role: 'ADMIN', reason: 'ROLE_POLICY' });
  await call('SUPER_ADMIN', 'PATCH', `/identity/users/${encodeURIComponent(input.staffId)}`, 400, { role: 'SUPER_ADMIN', reason: 'ROLE_POLICY' });
  await call('SUPER_ADMIN', 'PATCH', `/identity/users/${encodeURIComponent(input.ownerId)}`, 403, { role: 'CUSTOMER', reason: 'ROLE_POLICY' });
  const invitation = await call('SUPER_ADMIN', 'POST', '/identity/invitations', 201, { email: input.invitationEmail, role: 'STAFF', departments: ['FLIGHT'] });
  const invitationId = String((await invitation.json()).data.id);
  const token = await input.invitationToken(invitationId); // actual locally captured delivery; never fabricate a token
  assert(/^[A-Za-z0-9_-]{43}$/.test(token));
  await call('CUSTOMER', 'POST', '/identity/invitations/accept', 200, { token, password: input.newInvitationPassword, name: 'Synthetic invited staff' });
  await call('CUSTOMER', 'POST', '/identity/invitations/accept', 400, { token, password: input.newInvitationPassword, name: 'Synthetic invited staff' });
  const expired = await call('SUPER_ADMIN', 'POST', '/identity/invitations', 201, { email: 'expired-' + input.invitationEmail, role: 'STAFF', departments: ['FLIGHT'] });
  const expiredId = String((await expired.json()).data.id), expiredToken = await input.invitationToken(expiredId);
  // Only the exact freshly issued, owned synthetic invitation is expired.
  const changed = await input.db.$executeRaw`UPDATE "IdentityInvitation" SET "expiresAt"=clock_timestamp()-interval '1 second' WHERE id=${expiredId} AND email=${'expired-' + input.invitationEmail} AND "usedAt" IS NULL`;
  assert.equal(changed, 1);
  await call('CUSTOMER', 'POST', '/identity/invitations/accept', 400, { token: expiredToken, password: input.newInvitationPassword, name: 'Synthetic expired staff' });
  const beforeVersions = await input.db.$queryRaw<Array<{ userId: string; version: number }>>`
    SELECT "userId",version FROM "IdentityAccount" WHERE "userId" IN (${input.suspensionCustomerId},${input.demotionAdminId})`;
  assert.equal(beforeVersions.length, 2);
  assert.equal((await input.suspensionSubject.get(input.apiBase + '/identity/me', { maxRedirects: 0 })).status(), 200);
  await call('ADMIN', 'PATCH', `/identity/users/${encodeURIComponent(input.suspensionCustomerId)}`, 200, { suspended: true, reason: 'ACCOUNT_SUPPORT' });
  assert.equal((await input.suspensionSubject.get(input.apiBase + '/identity/me', { maxRedirects: 0 })).status(), 401);
  assert.equal((await input.demotionSubject.get(input.apiBase + '/identity/me', { maxRedirects: 0 })).status(), 200);
  await call('SUPER_ADMIN', 'PATCH', `/identity/users/${encodeURIComponent(input.demotionAdminId)}`, 200, { role: 'CUSTOMER', reason: 'ROLE_POLICY' });
  assert.equal((await input.demotionSubject.get(input.apiBase + '/identity/me', { maxRedirects: 0 })).status(), 401);
  const revoked = await input.db.session.count({ where: { userId: { in: [input.suspensionCustomerId, input.demotionAdminId] }, revokedAt: null } });
  assert.equal(revoked, 0);
  const afterVersions = await input.db.$queryRaw<Array<{ userId: string; version: number }>>`
    SELECT "userId",version FROM "IdentityAccount" WHERE "userId" IN (${input.suspensionCustomerId},${input.demotionAdminId})`;
  assert.equal(afterVersions.length, 2);
  for (const row of afterVersions) assert.equal(row.version, beforeVersions.find(old => old.userId === row.userId)!.version + 1);
  const audit = await input.db.$queryRaw<Array<{ action: string; targetId: string }>>`
    SELECT action,"targetId" FROM "IdentityAudit"
    WHERE "targetId" IN (${input.suspensionCustomerId},${input.demotionAdminId},${invitationId})`;
  for (const [action, targetId] of [['ROLE_CHANGED', input.demotionAdminId], ['ACCOUNT_STATUS_CHANGED', input.suspensionCustomerId], ['INVITE_ACCEPTED', invitationId]]) {
    assert(audit.some(row => row.action === action && row.targetId === targetId));
  }
  await input.assertFixtureOwnership(); await input.assertFinancePreserved();
  results.push({ check: 'immediate-revocation-audit-ownership-financial-preservation', status: 'PASS' });
  return results;
}
