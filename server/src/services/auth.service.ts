import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';
import { normalizeEmail } from '../utils/helpers.js';
import { sendEmailVerification } from './notification.service.js';
import type { UserRole } from '../generated/prisma/client.js';

const SALT_ROUNDS = 12;
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  emailVerified: boolean;
}

function generateToken(user: { id: string; email: string; role: UserRole }): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
  );
}

export async function register(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<{ user: AuthUser; token: string }> {
  const email = normalizeEmail(input.email);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw AppError.conflict('An account with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: input.name?.trim() || null,
      role: 'CUSTOMER',
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
    },
  });

  // Send verification email (non-blocking)
  const verificationToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: {
      token: verificationToken,
      userId: user.id,
      expiresAt,
    },
  });

  const verificationUrl = `${env.frontendUrl}/verify-email?token=${verificationToken}`;
  sendEmailVerification({
    to: user.email,
    name: user.name || '',
    verificationUrl,
  }).catch((err) => console.error('[Auth] Email verification send failed:', err));

  const token = generateToken(user);
  return { user, token };
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<{ user: AuthUser; token: string }> {
  const email = normalizeEmail(input.email);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      password: true,
    },
  });

  // Use same error for missing user and wrong password to prevent enumeration
  const genericError = AppError.unauthorized('Invalid email or password');

  if (!user || !user.password) {
    throw genericError;
  }

  const passwordMatch = await bcrypt.compare(input.password, user.password);
  if (!passwordMatch) {
    throw genericError;
  }

  const token = generateToken(user);
  const { password: _pw, ...safeUser } = user;
  return { user: safeUser, token };
}

export async function getMe(userId: string): Promise<AuthUser | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
    },
  });
}

export async function findOrCreateGoogleUser(profile: {
  googleId: string;
  email: string;
  name?: string;
  avatar?: string;
}): Promise<{ user: AuthUser; token: string }> {
  const email = normalizeEmail(profile.email);

  // Check for existing OAuth account
  const existingAccount = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: 'google',
        providerAccountId: profile.googleId,
      },
    },
    include: { user: { select: { id: true, email: true, name: true, role: true, emailVerified: true } } },
  });

  if (existingAccount) {
    const token = generateToken(existingAccount.user);
    return { user: existingAccount.user, token };
  }

  // Find existing user by email or create new
  let user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, emailVerified: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: profile.name || null,
        avatar: profile.avatar || null,
        role: 'CUSTOMER', // Never ADMIN from OAuth
        emailVerified: true, // Google has already verified
      },
      select: { id: true, email: true, name: true, role: true, emailVerified: true },
    });
  }

  // Link OAuth account
  await prisma.account.create({
    data: {
      userId: user.id,
      provider: 'google',
      providerAccountId: profile.googleId,
    },
  });

  const token = generateToken(user);
  return { user, token };
}
