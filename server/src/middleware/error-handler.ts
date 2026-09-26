import { Request, Response, NextFunction } from 'express';
import { AppError, isAppError } from '../utils/errors';
import { error as errorResponse } from '../utils/response';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', err);

  if (isAppError(err)) {
    res.status(err.statusCode).json(
      errorResponse(err.code, err.message, err.details)
    );
    return;
  }

  if (err.name === 'ValidationError') {
    res.status(400).json(
      errorResponse('VALIDATION_ERROR', err.message)
    );
    return;
  }

  if (err.name === 'SyntaxError' && 'status' in err && (err as any).status === 400) {
    res.status(400).json(
      errorResponse('INVALID_JSON', 'Invalid JSON payload')
    );
    return;
  }

  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(500).json(
    errorResponse('INTERNAL_ERROR', message)
  );
}