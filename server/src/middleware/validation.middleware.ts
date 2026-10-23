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

function validateValue(schema: ZodSchema, value: unknown, assign: (data: unknown) => void, res: Response, next: NextFunction): void {
  const result = schema.safeParse(value);
  if (!result.success) {
    res.status(422).json(errorResponse('VALIDATION_ERROR', 'Validation failed', formatZodErrors(result.error)));
    return;
  }
  assign(result.data);
  next();
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    validateValue(schema, req.query, (data) => { req.query = data as typeof req.query; }, res, next);
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    validateValue(schema, req.params, (data) => { req.params = data as Record<string, string>; }, res, next);
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
    details[key].push(issue.code === 'unrecognized_keys' ? 'Unsupported fields' : issue.message);
  }
  return details;
}
