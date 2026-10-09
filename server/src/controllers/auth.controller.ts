import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import { success } from '../utils/response.js';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, token } = await authService.register(req.body);
    res.cookie('auth_token', token, COOKIE_OPTIONS);
    res.status(201).json(success({ user }));
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, token } = await authService.login(req.body);
    res.cookie('auth_token', token, COOKIE_OPTIONS);
    res.json(success({ user }));
  } catch (err) {
    next(err);
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie('auth_token', { path: '/' });
  res.json(success({ message: 'Logged out successfully' }));
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await authService.getMe(authReq.user!.id);
    if (!user) {
      next(AppError.notFound('User not found'));
      return;
    }
    res.json(success({ user }));
  } catch (err) {
    next(err);
  }
}

export async function googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = req.user as any;
    const { token } = await authService.findOrCreateGoogleUser({
      googleId: profile.id,
      email: profile.emails?.[0]?.value || '',
      name: profile.displayName,
      avatar: profile.photos?.[0]?.value,
    });
    res.cookie('auth_token', token, COOKIE_OPTIONS);
    res.redirect(`${env.frontendUrl}?auth=success`);
  } catch (err) {
    next(err);
  }
}
