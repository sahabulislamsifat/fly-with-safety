import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { error as errorResponse } from '../utils/response.js';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = formatZodErrors(result.error);
      res.status(422).json(
        errorResponse('VALIDATION_ERROR', 'Validation failed', details)
      );
      return;
    }
    req.body = result.data;
    next();
  };
}

function formatZodErrors(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    const key = path || '_root';
    if (!details[key]) {
      details[key] = [];
    }
    details[key].push(issue.message);
  }
  return details;
}
