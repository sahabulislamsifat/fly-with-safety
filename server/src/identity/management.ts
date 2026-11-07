import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { sendEmailRaw } from '../services/notification.service.js';
import { audit, governanceTransaction, invalidate, lockPrincipal } from './store.js';
import { requirePermission, type Department, type Principal, type Resource, type Role } from './policy.js';
import { hash } from './crypto.js';

const fields: Record<Resource, string> = { booking: 'bookingId', flightInquiry: 'flightInquiryId', hotelInquiry: 'hotelInquiryId',
  packageInquiry: 'packageInquiryId', visaInquiry: 'visaInquiryId', contactMessage: 'contactMessageId' };

export async function invite(p: Principal, input: { email: string; role: 'ADMIN' | 'STAFF'; departments: Department[] }) {
  requirePermission(p, 'assign');
  if (p.role !== 'SUPER_ADMIN' && (input.role !== 'STAFF' || input.departments.some(d => !p.departments.includes(d)))) throw AppError.forbidden();
  const token = randomBytes(32).toString('base64url'), id = randomUUID();
  await governanceTransaction(async db => {
    await lockPrincipal(db, p);
    const existing = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`/*p5:invite-existing*/ SELECT id FROM "User" WHERE email=${input.email}`);
    if (existing.length) throw AppError.conflict('Use the controlled existing-account governance workflow');
    await db.$executeRaw(Prisma.sql`/*p5:invite-create*/ INSERT INTO "IdentityInvitation"
      (id,email,role,departments,"tokenHash","issuerId","issuerVersion","expiresAt")
      VALUES (${id},${input.email},${input.role}::"UserRole",ARRAY[${Prisma.join(input.departments)}]::"IdentityDepartment"[],${hash(token)},${p.id},${p.version},clock_timestamp()+interval '24 hours')`);
    await audit(db, p.id, 'INVITE_CREATED', id, 'EMPLOYEE_PROVISIONING');
  });
  // Invitation bearer material is delivered only to the bound email. Never return it to the issuer.
  if (process.env.IDENTITY_INVITATION_DELIVERY_APPROVED !== 'true') return { id, delivery: 'UNAVAILABLE' };
  const origin = new URL(process.env.FRONTEND_URL || '');
  if (origin.username || origin.password || !(origin.protocol === 'https:' ||
    (origin.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)))) throw Error('INVITATION_ORIGIN_UNAVAILABLE');
  const link = new URL('/invite', origin); link.hash = token;
  const result = await sendEmailRaw({ to: input.email, subject: 'Fly With Safety employee invitation',
    text: `Set up your individual account within 24 hours: ${link.href}`, html: `<p>Set up your individual account within 24 hours.</p><a href="${link.href}">Accept invitation</a>` });
  if (result.status !== 'submitted') return { id, delivery: 'UNAVAILABLE' };
  await governanceTransaction(async db => {
    await db.$executeRaw(Prisma.sql`/*p5:invite-delivered*/ UPDATE "IdentityInvitation" SET "deliveredAt"=clock_timestamp() WHERE id=${id} AND "usedAt" IS NULL`);
    await audit(db, p.id, 'INVITE_SUBMITTED', id, 'EMPLOYEE_PROVISIONING');
  });
  return { id, delivery: 'SUBMITTED' };
}

export async function acceptInvitation(token: string, password: string, name: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  return governanceTransaction(async db => {
    const rows = await db.$queryRaw<Array<{ id: string; email: string; role: Role; departments: Department[]; issuerId: string; issuerVersion: number }>>(Prisma.sql`/*p5:invite-consume*/
      SELECT id,email,role::text AS role,departments::text[],"issuerId","issuerVersion" FROM "IdentityInvitation"
      WHERE "tokenHash"=${hash(token)} AND "usedAt" IS NULL AND "deliveredAt" IS NOT NULL AND "expiresAt">clock_timestamp() FOR UPDATE`);
    const invitation = rows[0];
    if (rows.length !== 1 || !['ADMIN', 'STAFF'].includes(invitation.role)) throw AppError.badRequest('Invitation unavailable');
    const issuers = await db.$queryRaw<Array<{ role: string; version: number; suspended: boolean }>>(Prisma.sql`/*p5:invite-issuer*/
      SELECT u.role::text AS role,a.version,a.suspended FROM "User" u JOIN "IdentityAccount" a ON a."userId"=u.id
      WHERE u.id=${invitation.issuerId} FOR SHARE OF u,a`);
    const issuer = issuers[0];
    if (!issuer || issuer.suspended || issuer.version !== invitation.issuerVersion ||
      !(issuer.role === 'SUPER_ADMIN' || (issuer.role === 'ADMIN' && invitation.role === 'STAFF'))) throw AppError.badRequest('Invitation unavailable');
    if (issuer.role === 'ADMIN') {
      const memberships = await db.$queryRaw<Array<{ department: Department }>>(Prisma.sql`/*p5:issuer-departments*/ SELECT department::text FROM "IdentityMembership" WHERE "userId"=${invitation.issuerId}`);
      if (invitation.departments.some(d => !memberships.some(m => m.department === d))) throw AppError.badRequest('Invitation unavailable');
    }
    const id = randomUUID();
    await db.$executeRaw(Prisma.sql`/*p5:invite-user*/ INSERT INTO "User" (id,email,password,name,role,"emailVerified","updatedAt")
      VALUES (${id},${invitation.email},${passwordHash},${name},${invitation.role}::"UserRole",true,clock_timestamp())`);
    await db.$executeRaw(Prisma.sql`/*p5:ensure-account*/ INSERT INTO "IdentityAccount" ("userId") VALUES (${id})`);
    for (const department of invitation.departments) await db.$executeRaw(Prisma.sql`/*p5:membership-add*/ INSERT INTO "IdentityMembership" ("userId",department) VALUES (${id},${department}::"IdentityDepartment")`);
    await db.$executeRaw(Prisma.sql`/*p5:invite-used*/ UPDATE "IdentityInvitation" SET "usedAt"=clock_timestamp() WHERE id=${invitation.id}`);
    await audit(db, id, 'INVITE_ACCEPTED', invitation.id, 'EMPLOYEE_PROVISIONING');
    return { activated: true, requiresSignIn: true, requiresMfa: true };
  });
}

export async function changeAccount(p: Principal, targetId: string, command: { suspended?: boolean; role?: 'CUSTOMER' | 'STAFF' | 'ADMIN'; reason: string }) {
  requirePermission(p, command.role === undefined ? 'customers' : 'governance');
  if (targetId === p.id) throw AppError.forbidden('Self-governance is prohibited');
  return governanceTransaction(async db => {
    await lockPrincipal(db, p);
    const rows = await db.$queryRaw<Array<{ role: Role }>>(Prisma.sql`/*p5:target-account*/ SELECT role::text FROM "User" WHERE id=${targetId} FOR UPDATE`);
    const target = rows[0];
    if (!target || target.role === 'SUPER_ADMIN' || (p.role !== 'SUPER_ADMIN' && target.role !== 'CUSTOMER')) throw AppError.forbidden();
    await db.$executeRaw(Prisma.sql`/*p5:ensure-account*/ INSERT INTO "IdentityAccount" ("userId") VALUES (${targetId}) ON CONFLICT DO NOTHING`);
    if (command.role !== undefined) await db.$executeRaw(Prisma.sql`/*p5:role-change*/ UPDATE "User" SET role=${command.role}::"UserRole","updatedAt"=clock_timestamp() WHERE id=${targetId}`);
    if (command.suspended !== undefined) await db.$executeRaw(Prisma.sql`/*p5:suspend*/ UPDATE "IdentityAccount" SET suspended=${command.suspended} WHERE "userId"=${targetId}`);
    await invalidate(db, targetId);
    await audit(db, p.id, command.role === undefined ? 'ACCOUNT_STATUS_CHANGED' : 'ROLE_CHANGED', targetId, command.reason);
    return { changed: true, sessionsRevoked: true };
  });
}

export async function assign(p: Principal, input: { userId: string; resource: Resource; resourceId: string; department: Department; active: boolean }) {
  requirePermission(p, 'assign');
  if (p.role !== 'SUPER_ADMIN' && !p.departments.includes(input.department)) throw AppError.forbidden();
  return governanceTransaction(async db => {
    await lockPrincipal(db, p);
    const staff = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`/*p5:assignment-staff*/ SELECT u.id FROM "User" u
      JOIN "IdentityAccount" a ON a."userId"=u.id JOIN "IdentityMembership" m ON m."userId"=u.id
      WHERE u.id=${input.userId} AND u.role='STAFF' AND NOT a.suspended AND m.department::text=${input.department} FOR SHARE OF u,a,m`);
    if (staff.length !== 1) throw AppError.badRequest('Active department membership required');
    const table = { booking: 'Booking', flightInquiry: 'FlightInquiry', hotelInquiry: 'HotelInquiry', packageInquiry: 'PackageInquiry', visaInquiry: 'VisaInquiry', contactMessage: 'ContactMessage' }[input.resource];
    const records = await db.$queryRaw<Array<{ type: string }>>(Prisma.sql`/*p5:assignment-resource*/ SELECT ${input.resource === 'booking' ? Prisma.raw('"bookingType"::text') : Prisma.sql`${input.resource}`} AS type FROM ${Prisma.raw(`"${table}"`)} WHERE id=${input.resourceId} FOR SHARE`);
    if (records.length !== 1) throw AppError.notFound();
    const department = { FLIGHT: 'FLIGHT', HOTEL: 'HOTEL', PACKAGE: 'PACKAGES', flightInquiry: 'FLIGHT', hotelInquiry: 'HOTEL', packageInquiry: 'PACKAGES', visaInquiry: 'VISA', contactMessage: 'SUPPORT' }[records[0].type];
    if (input.department !== department && !(input.resource === 'booking' && ['FINANCE', 'SUPPORT'].includes(input.department))) throw AppError.badRequest('Resource department mismatch');
    const column = Prisma.raw(`"${fields[input.resource]}"`);
    await db.$executeRaw(Prisma.sql`/*p5:assignment-upsert*/ INSERT INTO "IdentityAssignment" (id,"userId",department,active,${column})
      VALUES (${randomUUID()},${input.userId},${input.department}::"IdentityDepartment",${input.active},${input.resourceId})
      ON CONFLICT ("userId",${column},department) DO UPDATE SET active=EXCLUDED.active`);
    await invalidate(db, input.userId);
    await audit(db, p.id, 'ASSIGNMENT_CHANGED', input.resourceId, 'STAFF_ASSIGNMENT');
    return { changed: true, sessionsRevoked: true };
  });
}

export async function customerDirectory(p: Principal) {
  requirePermission(p, 'customers');
  return prisma.$queryRaw<Array<{ id: string; name: string | null; email: string; suspended: boolean }>>(Prisma.sql`/*p5:customers*/ SELECT u.id,u.name,u.email,COALESCE(a.suspended,false) AS suspended
    FROM "User" u LEFT JOIN "IdentityAccount" a ON a."userId"=u.id WHERE u.role='CUSTOMER' ORDER BY u.id LIMIT 50`);
}

export async function setDepartments(p: Principal, userId: string, values: Department[]) {
  requirePermission(p, 'governance');
  if (p.id === userId) throw AppError.forbidden('Self-governance is prohibited');
  return governanceTransaction(async db => {
    await lockPrincipal(db, p);
    const target = await db.$queryRaw<Array<{ role: Role }>>(Prisma.sql`/*p5:target-account*/ SELECT role::text FROM "User" WHERE id=${userId} FOR UPDATE`);
    if (target.length !== 1 || !['ADMIN', 'STAFF'].includes(target[0].role)) throw AppError.forbidden();
    await db.$executeRaw(Prisma.sql`/*p5:ensure-account*/ INSERT INTO "IdentityAccount" ("userId") VALUES (${userId}) ON CONFLICT DO NOTHING`);
    await db.$executeRaw(Prisma.sql`/*p5:membership-clear*/ DELETE FROM "IdentityMembership" WHERE "userId"=${userId}`);
    for (const department of values) await db.$executeRaw(Prisma.sql`/*p5:membership-add*/ INSERT INTO "IdentityMembership" ("userId",department) VALUES (${userId},${department}::"IdentityDepartment")`);
    await invalidate(db, userId);
    await audit(db, p.id, 'DEPARTMENTS_CHANGED', userId, 'ROLE_POLICY');
    return { changed: true, sessionsRevoked: true };
  });
}
