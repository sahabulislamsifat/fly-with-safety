import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';

declare global {
  namespace Express {
    interface Request {
      idempotencyKey?: string;
    }
  }
}

export function requireIdempotencyKey(req: Request, _res: Response, next: NextFunction): void {
  const key = req.header('idempotency-key') || req.header('x-idempotency-key');
  if (!key || key.length < 16 || key.length > 128) {
    next(AppError.badRequest('A valid Idempotency-Key header is required.'));
    return;
  }
  req.idempotencyKey = key;
  next();
}
