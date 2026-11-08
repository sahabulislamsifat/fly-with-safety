import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { prisma } from '../lib/prisma.js';
import { identityContext, identityEnabled, privileged, type Principal, type Role } from '../identity/policy.js';
import { loadPrincipal } from '../identity/auth.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
    name: string | null;
    identity?: Principal;
  };
}

interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  sid?: string;
  ver?: number;
}

async function authenticatedUserFromToken(token: string) {
  const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
  if (!decoded.sid) throw AppError.unauthorized('Session expired. Please sign in again.');
  if (identityEnabled()) {
    const identity = await loadPrincipal(decoded.sub, decoded.sid, decoded.ver);
    return { id: identity.id, email: identity.email, role: identity.role, name: identity.name, identity };
  }
  const activeSession = await prisma.session.findFirst({
    where: { id: decoded.sid, userId: decoded.sub, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (!activeSession) throw AppError.unauthorized('Session expired. Please sign in again.');
  return { id: decoded.sub, email: decoded.email, role: decoded.role, name: null, identity: undefined };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  // Try Authorization header first, then cookie
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.cookies?.auth_token;

  if (!token) {
    return next(AppError.unauthorized('Authentication required'));
  }

  try {
    authReq.user = await authenticatedUserFromToken(token);
    if (authReq.user.identity) identityContext.run(authReq.user.identity, next);
    else next();
  } catch {
    next(AppError.unauthorized('Invalid or expired session'));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      return next(AppError.unauthorized('Authentication required'));
    }
    if (identityEnabled() && privileged(authReq.user.role) && !authReq.user.identity?.mfaVerified) {
      return next(new AppError('Complete privileged MFA first', 403, 'MFA_REQUIRED'));
    }
    if (!roles.includes(authReq.user.role) && !(authReq.user.role === 'SUPER_ADMIN' && roles.includes('ADMIN'))) {
      return next(AppError.forbidden('Insufficient permissions'));
    }
    next();
  };
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.cookies?.auth_token;

  if (!token) {
    return next();
  }

  try {
    authReq.user = await authenticatedUserFromToken(token);
  } catch {
    // Ignore invalid token in optional auth
  }
  if (authReq.user?.identity) identityContext.run(authReq.user.identity, next);
  else next();
}
