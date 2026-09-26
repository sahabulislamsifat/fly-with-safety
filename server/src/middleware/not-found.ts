import { Request, Response, NextFunction } from 'express';
import { error as errorResponse } from '../utils/response';

export function notFoundHandler(_req: Request, _res: Response, _next: NextFunction): void {
  _res.status(404).json(
    errorResponse('NOT_FOUND', 'API route not found')
  );
}