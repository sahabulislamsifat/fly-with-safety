import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as authService from '../services/auth.service.js';
import { success } from '../utils/response.js';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { ProtectedAuthServices } from '../services/protected-auth.service.js';

function issuanceRequestId(req:Request):string {
  const value=req.headers['idempotency-key'];
  if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value))throw AppError.badRequest('A UUIDv4 Idempotency-Key is required.');
  return value.toLowerCase();
}

/** Explicit future controller composition; existing named handlers/routes below remain unchanged. */
export function createProtectedAuthController(service:ProtectedAuthServices) {
  return {
    async register(req:Request,res:Response,next:NextFunction):Promise<void>{
      try{
        const result=await service.registerRequest(req.body,issuanceRequestId(req));
        res.set('Cache-Control','no-store');
        if(result.status==='replayed') {res.status(200).json(success({registration:'replayed',requiresSignIn:true}));return;}
        setAuthCookies(res,result.session);
        res.status(201).json(success({registration:'created',user:result.session.user}));
      }catch(error){next(error);}
    },
    async resendVerification(req:Request,res:Response,next:NextFunction):Promise<void>{
      try{await service.resendVerificationOnce(req.body.email,issuanceRequestId(req));res.set('Cache-Control','no-store');res.json(success({message:'If the account needs verification, a verification request has been recorded.'}));}catch(error){next(error);}
    },
    async forgotPassword(req:Request,res:Response,next:NextFunction):Promise<void>{
      try{await service.requestPasswordResetOnce(req.body.email,issuanceRequestId(req));res.set('Cache-Control','no-store');res.json(success({message:'If an account exists, a password reset request has been recorded.'}));}catch(error){next(error);}
    },
    async verifyEmail(req:Request,res:Response,next:NextFunction):Promise<void>{
      try{await service.verifyEmail(req.body.token);res.set('Cache-Control','no-store');res.json(success({message:'Email verified successfully'}));}catch(error){next(error);}
    },
    async resetPassword(req:Request,res:Response,next:NextFunction):Promise<void>{
      try{await service.resetPassword(req.body);clearAuthCookies(res);res.set('Cache-Control','no-store');res.json(success({message:'Password reset successfully. Please sign in.'}));}catch(error){next(error);}
    },
  };
}

function getCookieOptions() {
  const isProd = env.nodeEnv === 'production';
  const sameSite: 'lax' | 'none' = isProd ? 'none' : 'lax';
  return {
    access: {
      httpOnly: true,
      secure: isProd,
      sameSite,
      maxAge: env.accessTokenCookieMaxAgeMs,
      path: '/',
    },
    refresh: {
      httpOnly: true,
      secure: isProd,
      sameSite,
      maxAge: env.refreshTokenExpiresDays * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    },
  };
}

function clearAuthCookies(res: Response): void {
  const isProd = env.nodeEnv === 'production';
  const sameSite: 'lax' | 'none' = isProd ? 'none' : 'lax';
  res.clearCookie('auth_token', { path: '/', httpOnly: true, secure: isProd, sameSite });
  res.clearCookie('refresh_token', { path: '/api/v1/auth', httpOnly: true, secure: isProd, sameSite });
}

function setAuthCookies(res: Response, session: authService.AuthSession): void {
  const { access, refresh } = getCookieOptions();
  res.cookie('auth_token', session.accessToken, access);
  res.cookie('refresh_token', session.refreshToken, refresh);
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
          emails?: Array<{ value?: string; verified?: boolean }>;
          _json?: { email_verified?: boolean };
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
      emailVerified: profile.emails?.[0]?.verified === true || profile._json?.email_verified === true,
      name: profile.displayName,
      avatar: profile.photos?.[0]?.value,
    });
    setAuthCookies(res, session);
    res.redirect(`${env.frontendUrl}?auth=success`);
  } catch (err) { next(err); }
}
