import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import type { CookieOptions, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { Prisma } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

const TTL_SECONDS = 300;
const audience = 'flywithsafe:google-oauth-state';
const cookieName = () => env.nodeEnv === 'production' ? '__Host-google_oauth_state' : 'google_oauth_state';
const cookieOptions = (): CookieOptions => ({
  httpOnly: true, secure: env.nodeEnv === 'production', sameSite: 'lax', path: '/',
});

export const beginGoogleState: RequestHandler = (_req, res, next) => {
  const state = randomBytes(32).toString('base64url');
  const cookie = jwt.sign({ state }, env.jwtSecret, {
    algorithm: 'HS256', audience, issuer: 'flywithsafe', expiresIn: TTL_SECONDS,
  });
  // Host-only Lax cookie survives Google's top-level GET redirect. It is never sent to Google.
  res.cookie(cookieName(), cookie, { ...cookieOptions(), maxAge: TTL_SECONDS * 1000 });
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  res.locals.googleOAuthState = state;
  next();
};

export const verifyGoogleState: RequestHandler = async (req, res, next) => {
  res.clearCookie(cookieName(), cookieOptions());
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  const fail = () => res.redirect(`${env.frontendUrl}?auth=failed`);
  const state = req.query.state;
  const cookie: unknown = req.cookies?.[cookieName()];
  if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state) || typeof cookie !== 'string') {
    fail(); return;
  }
  try {
    const claims = jwt.verify(cookie, env.jwtSecret, {
      algorithms: ['HS256'], audience, issuer: 'flywithsafe', maxAge: TTL_SECONDS,
    });
    if (typeof claims === 'string' || typeof claims.state !== 'string' ||
        claims.state.length !== state.length ||
        !timingSafeEqual(Buffer.from(claims.state), Buffer.from(state))) {
      fail(); return;
    }
  } catch {
    fail(); return;
  }
  try {
    // Shared unique constraint rejects replay, including simultaneous callbacks on other instances.
    // Keep consumed markers at least until the signed cookie expires. Never use a memory fallback.
    await prisma.idempotencyRecord.create({ data: {
      operation: 'oauth:google:consume', principal: 'google-oauth', key: state,
      payloadHash: createHash('sha256').update(state).digest('hex'),
      referenceNumber: 'oauth-state',
    } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      fail(); return;
    }
    next(error); return;
  }
  // Validate and consume even provider errors. Never let a callback without a code restart OAuth.
  if (req.query.error !== undefined || typeof req.query.code !== 'string' || !req.query.code) {
    fail(); return;
  }
  next();
};
