import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { runWithRequestContext } from '../lib/request-context.js';
import { logger } from '../lib/logger.js';

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Assigns every request an ID (honours a well-formed inbound X-Request-Id),
 * echoes it in the response header, and logs one line per completed request.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.header('x-request-id');
  const id = inbound && SAFE_ID.test(inbound) ? inbound : randomUUID();

  res.setHeader('X-Request-Id', id);
  res.locals.requestId = id;

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.info('request', {
      requestId: id,
      method: /^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS|CONNECT|TRACE)$/.test(req.method) ? req.method : 'OTHER',
      // Route templates retain endpoint visibility without persisting arbitrary
      // URL segments (including secrets in unmatched paths or path parameters).
      path: typeof req.route?.path === 'string' ? req.route.path : '[unmatched]',
      status: res.statusCode,
      durationMs: Math.round(durationMs),
    });
  });

  runWithRequestContext(id, next);
}
