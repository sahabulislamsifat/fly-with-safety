import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';
import { normalizeEmail } from '../utils/helpers.js';
import { sendEmailVerification, sendPasswordReset } from './notification.service.js';
import type { Prisma, UserRole } from '../generated/prisma/client.js';

const SALT_ROUNDS = 12;
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
const RESET_TOKEN_EXPIRY_HOURS = 1;

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  emailVerified: boolean;
}
export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
function newOpaqueToken(): string {
  return randomBytes(48).toString('base64url');
}
function accessTokenFor(user: AuthUser, sessionId: string): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, sid: sessionId },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] },
  );
}

async function createSessionFor(user: AuthUser): Promise<AuthSession> {
  const refreshToken = newOpaqueToken();
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.refreshTokenExpiresDays * 86400000),
    },
  });
  const accessToken = accessTokenFor(user, session.id);
  return { user, accessToken, refreshToken };
}

async function issueVerificationToken(
  user: Pick<AuthUser, 'id' | 'email' | 'name'>,
): Promise<void> {
  const token = newOpaqueToken();
  await prisma.emailVerificationToken.create({
    data: {
      token: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 3600000),
    },
  });
  await sendEmailVerification({
    to: user.email,
    name: user.name || '',
    verificationUrl: `${env.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`,
  });
}

export async function register(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthSession> {
  const email = normalizeEmail(input.email);
  if (await prisma.user.findUnique({ where: { email } }))
    throw AppError.conflict('An account with this email already exists');
  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(input.password, SALT_ROUNDS),
      name: input.name?.trim() || null,
      role: 'CUSTOMER',
    },
    select: { id: true, email: true, name: true, role: true, emailVerified: true },
  });
  await issueVerificationToken(user);
  return createSessionFor(user);
}

export async function login(input: { email: string; password: string }): Promise<AuthSession> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, emailVerified: true, password: true },
  });
  const generic = AppError.unauthorized('Invalid email or password');
  if (!user?.password || !(await bcrypt.compare(input.password, user.password))) throw generic;
  const { password: _password, ...safeUser } = user;
  return createSessionFor(safeUser);
}

export async function refreshSession(refreshToken: string): Promise<AuthSession> {
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hashToken(refreshToken) },
    include: {
      user: { select: { id: true, email: true, name: true, role: true, emailVerified: true } },
    },
  });
  if (!session || session.expiresAt <= new Date() || session.revokedAt) {
    throw AppError.unauthorized('Session expired. Please sign in again.');
  }
  const consumed = await prisma.session.updateMany({
    where: { id: session.id, revokedAt: null },
    data: { revokedAt: new Date(), lastUsedAt: new Date() },
  });
  if (consumed.count !== 1) throw AppError.unauthorized('Session expired. Please sign in again.');
  return createSessionFor(session.user);
}

export async function revokeSessionById(sessionId?: string): Promise<void> {
  if (sessionId)
    await prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
}
export async function revokeUserSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
export async function isSessionActive(sessionId: string): Promise<boolean> {
  return Boolean(
    await prisma.session.findFirst({
      where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    }),
  );
}
export async function getMe(userId: string): Promise<AuthUser | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, emailVerified: true },
  });
}

interface CredentialIdentity { id: string; userId: string }

/** Raw-query results are untrusted; never continue after an unexpected cardinality/binding. */
function requireCredentialRow(
  rows: unknown, expected: CredentialIdentity, invalid: AppError,
): void {
  if (!Array.isArray(rows)) throw AppError.internal();
  if (rows.length === 0) throw invalid;
  const row: unknown = rows[0];
  if (rows.length !== 1 || typeof row !== 'object' || row === null ||
      !('id' in row) || !('userId' in row) ||
      row.id !== expected.id || row.userId !== expected.userId) throw AppError.internal();
}

async function consumeCredential(
  tx: Prisma.TransactionClient, purpose: 'verification' | 'reset',
  record: CredentialIdentity, digest: string, submitted: string, invalid: AppError,
): Promise<void> {
  // Static identifiers and tagged parameters only. Lock first; evaluate expiry in a later statement.
  const locked: unknown = purpose === 'verification'
    ? await tx.$queryRaw`
        SELECT id, "userId" FROM public."EmailVerificationToken"
        WHERE id = ${record.id} AND "userId" = ${record.userId}
          AND (token = ${digest} OR token = ${submitted}) FOR UPDATE`
    : await tx.$queryRaw`
        SELECT id, "userId" FROM public."PasswordResetToken"
        WHERE id = ${record.id} AND "userId" = ${record.userId}
          AND "tokenHash" = ${digest} FOR UPDATE`;
  requireCredentialRow(locked, record, invalid);

  // Use the intended UTC representation of TIMESTAMP(3). Compare full precision; store milliseconds.
  const consumed: unknown = purpose === 'verification'
    ? await tx.$queryRaw`
        WITH claim_clock AS MATERIALIZED (
          SELECT clock_timestamp() AT TIME ZONE 'UTC' AS claimed_at
        )
        UPDATE public."EmailVerificationToken" AS t
        SET "usedAt" = date_trunc('milliseconds', c.claimed_at)
        FROM claim_clock AS c
        WHERE t.id = ${record.id} AND t."userId" = ${record.userId}
          AND (t.token = ${digest} OR t.token = ${submitted})
          AND t."usedAt" IS NULL AND t."expiresAt" > c.claimed_at
        RETURNING t.id, t."userId"`
    : await tx.$queryRaw`
        WITH claim_clock AS MATERIALIZED (
          SELECT clock_timestamp() AT TIME ZONE 'UTC' AS claimed_at
        )
        UPDATE public."PasswordResetToken" AS t
        SET "usedAt" = date_trunc('milliseconds', c.claimed_at)
        FROM claim_clock AS c
        WHERE t.id = ${record.id} AND t."userId" = ${record.userId}
          AND t."tokenHash" = ${digest}
          AND t."usedAt" IS NULL AND t."expiresAt" > c.claimed_at
        RETURNING t.id, t."userId"`;
  requireCredentialRow(consumed, record, invalid);
}

export async function verifyEmail(token: string): Promise<void> {
  const submitted = token;
  const invalid = AppError.badRequest('This verification link is invalid or expired.');
  try {
    const digest = hashToken(submitted);
    // Accept legacy plaintext rows created before token hashing was introduced.
    const records = await prisma.emailVerificationToken.findMany({
      where: { token: { in: [digest, submitted] }, usedAt: null },
      select: { id: true, userId: true }, take: 2,
    });
    if (records.length !== 1) throw invalid;
    const record = records[0];
    await prisma.$transaction(async tx => {
      await consumeCredential(tx, 'verification', record, digest, submitted, invalid);
      await tx.user.update({ where: { id: record.userId }, data: { emailVerified: true } });
    }, { isolationLevel: 'ReadCommitted', maxWait: 2000, timeout: 5000 });
  } catch (error) {
    // Only this invocation's expected rejection is safe to expose; discard driver/query details.
    if (error === invalid) throw invalid;
    throw AppError.internal();
  }
}

export async function resendVerification(emailInput: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, emailVerified: true },
  });
  if (!user || user.emailVerified) return;
  await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await issueVerificationToken(user);
}

export async function requestPasswordReset(emailInput: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });
  if (!user) return;
  const token = newOpaqueToken();
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 3600000),
    },
  });
  await sendPasswordReset({
    to: user.email,
    name: user.name || '',
    resetUrl: `${env.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`,
  });
}

export async function resetPassword(input: { token: string; password: string }): Promise<void> {
  const submitted = input.token;
  const proposedPassword = input.password;
  const invalid = AppError.badRequest('This password reset link is invalid or expired.');
  try {
    const digest = hashToken(submitted);
    const record = await prisma.passwordResetToken.findFirst({
      where: { tokenHash: digest, usedAt: null }, select: { id: true, userId: true },
    });
    if (!record) throw invalid;
    const password = await bcrypt.hash(proposedPassword, SALT_ROUNDS);
    await prisma.$transaction(async tx => {
      await consumeCredential(tx, 'reset', record, digest, submitted, invalid);
      await tx.user.update({ where: { id: record.userId }, data: { password } });
      await tx.session.updateMany({
        where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() },
      });
    }, { isolationLevel: 'ReadCommitted', maxWait: 2000, timeout: 5000 });
  } catch (error) {
    if (error === invalid) throw invalid;
    throw AppError.internal();
  }
}

export async function findOrCreateGoogleUser(profile: {
  googleId: string;
  email: string;
  name?: string;
  avatar?: string;
}): Promise<AuthSession> {
  const email = normalizeEmail(profile.email);
  if (!email) throw AppError.unauthorized('Google did not provide a verified email address');
  const account = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: { provider: 'google', providerAccountId: profile.googleId },
    },
    include: {
      user: { select: { id: true, email: true, name: true, role: true, emailVerified: true } },
    },
  });
  if (account) return createSessionFor(account.user);
  const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, emailVerified: true },
    });
    const linked =
      existing ??
      (await tx.user.create({
        data: {
          email,
          name: profile.name || null,
          avatar: profile.avatar || null,
          role: 'CUSTOMER',
          emailVerified: true,
        },
        select: { id: true, email: true, name: true, role: true, emailVerified: true },
      }));
    await tx.account.create({
      data: { userId: linked.id, provider: 'google', providerAccountId: profile.googleId },
    });
    return linked;
  });
  return createSessionFor(user);
}
