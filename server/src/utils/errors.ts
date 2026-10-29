export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

const applicationErrors = new WeakSet<object>();

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: Record<string, unknown>,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    Object.setPrototypeOf(this, AppError.prototype);
    applicationErrors.add(this);
  }

  static badRequest(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static conflict(message: string): AppError {
    return new AppError(message, 409, 'CONFLICT');
  }

  static unprocessable(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }

  static tooManyRequests(message = 'Too many requests'): AppError {
    return new AppError(message, 429, 'TOO_MANY_REQUESTS');
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(message, 500, 'INTERNAL_ERROR', undefined, false);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error !== null && typeof error === 'object' && applicationErrors.has(error);
}
