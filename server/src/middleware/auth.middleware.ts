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
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
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
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    authReq.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      name: null,
    };
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired token'));
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

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authReq = req as AuthenticatedRequest;

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.cookies?.auth_token;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    authReq.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      name: null,
    };
  } catch {
    // Ignore invalid token in optional auth
  }
  next();
}
