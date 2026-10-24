import { Request, Response, NextFunction } from 'express';
import { isAppError } from '../utils/errors.js';
import { error as errorResponse } from '../utils/response.js';
import { logger, serializeError } from '../lib/logger.js';

interface PrismaLikeError {
  code?: string;
  name?: string;
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (isAppError(err)) {
    if (err.statusCode >= 500) logger.error('app_error', serializeError(err));
    if (err.statusCode >= 500) {
      res.status(err.statusCode).json(errorResponse('INTERNAL_ERROR', 'Internal server error'));
      return;
    }
    res.status(err.statusCode).json(errorResponse(err.code, err.message, err.details));
    return;
  }

  // Malformed JSON body (body-parser)
  if (err.name === 'SyntaxError' && (err as { status?: number }).status === 400) {
    res.status(400).json(errorResponse('INVALID_JSON', 'Invalid JSON payload'));
    return;
  }

  // Body too large (body-parser)
  if ((err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json(errorResponse('PAYLOAD_TOO_LARGE', 'Request body too large'));
    return;
  }

  // Prisma known request errors — map without leaking internals
  const prismaErr = err as PrismaLikeError;
  if (prismaErr.code === 'P2025') {
    res.status(404).json(errorResponse('NOT_FOUND', 'Resource not found'));
    return;
  }
  if (prismaErr.code === 'P2002') {
    res.status(409).json(errorResponse('CONFLICT', 'Resource already exists'));
    return;
  }

  // Unknown: log full detail server-side, return a sanitised message always.
  logger.error('unhandled_error', serializeError(err));
  res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error'));
}
