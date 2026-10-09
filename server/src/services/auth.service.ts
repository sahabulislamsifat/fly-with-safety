import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';
import { normalizeEmail } from '../utils/helpers.js';
import { sendEmailVerification, sendPasswordReset } from './notification.service.js';
import type { UserRole } from '../generated/prisma/client.js';

const SALT_ROUNDS = 12;
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
const RESET_TOKEN_EXPIRY_HOURS = 1;

export interface AuthUser { id: string; email: string; name: string | null; role: UserRole; emailVerified: boolean; }
export interface AuthSession { user: AuthUser; accessToken: string; refreshToken: string; }

function hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }
function newOpaqueToken(): string { return randomBytes(48).toString('base64url'); }
function accessTokenFor(user: AuthUser, sessionId: string): string {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role, sid: sessionId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
}

async function createSessionFor(user: AuthUser): Promise<AuthSession> {
  const refreshToken = newOpaqueToken();
  const session = await prisma.session.create({ data: { userId: user.id, refreshTokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + env.refreshTokenExpiresDays * 86400000) } });
  const accessToken = accessTokenFor(user, session.id);
  return { user, accessToken, refreshToken };
}

async function issueVerificationToken(user: Pick<AuthUser, 'id' | 'email' | 'name'>): Promise<void> {
  const token = newOpaqueToken();
  await prisma.emailVerificationToken.create({ data: { token: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 3600000) } });
  await sendEmailVerification({ to: user.email, name: user.name || '', verificationUrl: `${env.frontendUrl}/verify-email?token=${encodeURIComponent(token)}` });
}

export async function register(input: { email: string; password: string; name?: string }): Promise<AuthSession> {
  const email = normalizeEmail(input.email);
  if (await prisma.user.findUnique({ where: { email } })) throw AppError.conflict('An account with this email already exists');
  const user = await prisma.user.create({ data: { email, password: await bcrypt.hash(input.password, SALT_ROUNDS), name: input.name?.trim() || null, role: 'CUSTOMER' }, select: { id: true, email: true, name: true, role: true, emailVerified: true } });
  await issueVerificationToken(user);
  return createSessionFor(user);
}

export async function login(input: { email: string; password: string }): Promise<AuthSession> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, role: true, emailVerified: true, password: true } });
  const generic = AppError.unauthorized('Invalid email or password');
  if (!user?.password || !(await bcrypt.compare(input.password, user.password))) throw generic;
  const { password: _password, ...safeUser } = user;
  return createSessionFor(safeUser);
}

export async function refreshSession(refreshToken: string): Promise<AuthSession> {
  const session = await prisma.session.findUnique({ where: { refreshTokenHash: hashToken(refreshToken) }, include: { user: { select: { id: true, email: true, name: true, role: true, emailVerified: true } } } });
  if (!session || session.expiresAt <= new Date() || session.revokedAt) {
    throw AppError.unauthorized('Session expired. Please sign in again.');
  }
  const consumed = await prisma.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date(), lastUsedAt: new Date() } });
  if (consumed.count !== 1) throw AppError.unauthorized('Session expired. Please sign in again.');
  return createSessionFor(session.user);
}

export async function revokeSessionById(sessionId?: string): Promise<void> {
  if (sessionId) await prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}
export async function revokeUserSessions(userId: string): Promise<void> { await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }); }
export async function isSessionActive(sessionId: string): Promise<boolean> { return Boolean(await prisma.session.findFirst({ where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } })); }
export async function getMe(userId: string): Promise<AuthUser | null> { return prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true, emailVerified: true } }); }

export async function verifyEmail(token: string): Promise<void> {
  // Accept legacy plaintext rows created before token hashing was introduced.
  const record = await prisma.emailVerificationToken.findFirst({ where: { token: { in: [hashToken(token), token] }, usedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, userId: true } });
  if (!record) throw AppError.badRequest('This verification link is invalid or expired.');
  await prisma.$transaction([prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }), prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } })]);
}

export async function resendVerification(emailInput: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, emailVerified: true } });
  if (!user || user.emailVerified) return;
  await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await issueVerificationToken(user);
}

export async function requestPasswordReset(emailInput: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
  if (!user) return;
  const token = newOpaqueToken();
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await prisma.passwordResetToken.create({ data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 3600000) } });
  await sendPasswordReset({ to: user.email, name: user.name || '', resetUrl: `${env.frontendUrl}/reset-password?token=${encodeURIComponent(token)}` });
}

export async function resetPassword(input: { token: string; password: string }): Promise<void> {
  const record = await prisma.passwordResetToken.findFirst({ where: { tokenHash: hashToken(input.token), usedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, userId: true } });
  if (!record) throw AppError.badRequest('This password reset link is invalid or expired.');
  const password = await bcrypt.hash(input.password, SALT_ROUNDS);
  await prisma.$transaction([prisma.user.update({ where: { id: record.userId }, data: { password } }), prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }), prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } })]);
}

export async function findOrCreateGoogleUser(profile: { googleId: string; email: string; name?: string; avatar?: string }): Promise<AuthSession> {
  const email = normalizeEmail(profile.email);
  if (!email) throw AppError.unauthorized('Google did not provide a verified email address');
  const account = await prisma.account.findUnique({ where: { provider_providerAccountId: { provider: 'google', providerAccountId: profile.googleId } }, include: { user: { select: { id: true, email: true, name: true, role: true, emailVerified: true } } } });
  if (account) return createSessionFor(account.user);
  const user = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, role: true, emailVerified: true } });
    const linked = existing ?? await tx.user.create({ data: { email, name: profile.name || null, avatar: profile.avatar || null, role: 'CUSTOMER', emailVerified: true }, select: { id: true, email: true, name: true, role: true, emailVerified: true } });
    await tx.account.create({ data: { userId: linked.id, provider: 'google', providerAccountId: profile.googleId } });
    return linked;
  });
  return createSessionFor(user);
}
