import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as authService from '../services/auth.service.js';
import { success } from '../utils/response.js';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

const cookieSameSite: 'lax' | 'none' = env.nodeEnv === 'production' ? 'none' : 'lax';

const accessCookie = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: cookieSameSite,
  maxAge: env.accessTokenCookieMaxAgeMs,
  path: '/',
};
const refreshCookie = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: cookieSameSite,
  maxAge: env.refreshTokenExpiresDays * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
};

function clearAuthCookies(res: Response): void {
  res.clearCookie('auth_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/v1/auth' });
}

function setAuthCookies(res: Response, session: authService.AuthSession): void {
  res.cookie('auth_token', session.accessToken, accessCookie);
  res.cookie('refresh_token', session.refreshToken, refreshCookie);
}

function sessionIdFromRequest(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.cookies?.auth_token;
  if (!token) return undefined;
  try {
    return (jwt.verify(token, env.jwtSecret) as { sid?: string }).sid;
  } catch { return undefined; }
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await authService.register(req.body);
    setAuthCookies(res, session);
    res.status(201).json(success({ user: session.user }));
  } catch (err) { next(err); }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await authService.login(req.body);
    setAuthCookies(res, session);
    res.json(success({ user: session.user }));
  } catch (err) { next(err); }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) throw AppError.unauthorized('Session expired. Please sign in again.');
    const session = await authService.refreshSession(refreshToken);
    setAuthCookies(res, session);
    res.json(success({ user: session.user }));
  } catch (err) {
    clearAuthCookies(res);
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.revokeSessionById(sessionIdFromRequest(req));
    clearAuthCookies(res);
    res.json(success({ message: 'Logged out successfully' }));
  } catch (err) { next(err); }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await authService.getMe(authReq.user!.id);
    if (!user) throw AppError.notFound('User not found');
    res.json(success({ user }));
  } catch (err) { next(err); }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.verifyEmail(req.body.token);
    res.json(success({ message: 'Email verified successfully' }));
  } catch (err) { next(err); }
}

export async function resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.resendVerification(req.body.email);
    res.json(success({ message: 'If the account needs verification, an email has been sent.' }));
  } catch (err) { next(err); }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.requestPasswordReset(req.body.email);
    res.json(success({ message: 'If an account exists, a password reset email has been sent.' }));
  } catch (err) { next(err); }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.resetPassword(req.body);
    clearAuthCookies(res);
    res.json(success({ message: 'Password reset successfully. Please sign in.' }));
  } catch (err) { next(err); }
}

export async function googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = req.user as
      | {
          id: string;
          emails?: Array<{ value?: string }>;
          displayName?: string;
          photos?: Array<{ value?: string }>;
        }
      | undefined;

    if (!profile || !profile.id) {
      res.redirect(`${env.frontendUrl}?auth=failed&reason=invalid_profile`);
      return;
    }

    const session = await authService.findOrCreateGoogleUser({
      googleId: profile.id,
      email: profile.emails?.[0]?.value || '',
      name: profile.displayName,
      avatar: profile.photos?.[0]?.value,
    });
    setAuthCookies(res, session);
    res.redirect(`${env.frontendUrl}?auth=success`);
  } catch (err) { next(err); }
}
