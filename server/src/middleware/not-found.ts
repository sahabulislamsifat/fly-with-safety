import { Request, Response, NextFunction } from 'express';
import { error as errorResponse } from '../utils/response.js';

export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json(
    errorResponse('NOT_FOUND', `Route not found: ${req.method} ${req.path}`)
  );
}