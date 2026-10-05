import { getRequestId } from '../lib/request-context.js';

export interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  message: string;
  code: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export function success<T>(data: T, message?: string): SuccessResponse<T> {
  return message ? { success: true, data, message } : { success: true, data };
}

export function error(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ErrorResponse {
  return {
    success: false,
    message,
    code,
    requestId: getRequestId(),
    ...(details ? { details } : {}),
  };
}