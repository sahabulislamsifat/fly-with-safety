import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { prisma } from '../lib/prisma.js';
import type { UserRole } from '../generated/prisma/client.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    name: string | null;
  };
}

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  sid?: string;
}

async function authenticatedUserFromToken(token: string) {
  const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
  if (!decoded.sid) throw AppError.unauthorized('Session expired. Please sign in again.');
  const activeSession = await prisma.session.findFirst({
    where: { id: decoded.sid, userId: decoded.sub, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (!activeSession) throw AppError.unauthorized('Session expired. Please sign in again.');
  return { id: decoded.sub, email: decoded.email, role: decoded.role, name: null };
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
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired session'));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      return next(AppError.unauthorized('Authentication required'));
    }
    if (!roles.includes(authReq.user.role)) {
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
  next();
}
