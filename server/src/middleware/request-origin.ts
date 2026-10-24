import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

/** Accept a single HTTP(S) origin, never a URL with credentials, path, or query. */
export function isAllowedOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || value !== url.origin) return false;
    return env.corsOrigins.includes(url.origin);
  } catch {
    return false;
  }
}

/** Origin verification protects cross-site cookies without requiring a shared-domain CSRF cookie. */
export const protectRequestOrigin: RequestHandler = (req, _res, next) => {
  // OAuth uses GET redirects and its own protocol validation. Future webhooks need
  // explicit signature validation, not a blanket exemption from this middleware.
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('Origin');
  if (origin !== undefined) {
    if (isAllowedOrigin(origin)) return next();
    return next(AppError.forbidden('Request origin is not allowed.'));
  }

  // Missing Origin is never evidence of trust for ambient cookie credentials.
  // Preserve non-browser API clients using explicit credentials/JSON, not forms.
  const type = req.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if (req.get('Cookie') !== undefined || req.get('Sec-Fetch-Site') !== undefined ||
      (type !== undefined && type !== 'application/json')) {
    return next(AppError.forbidden('A trusted request origin is required.'));
  }
  next();
};
