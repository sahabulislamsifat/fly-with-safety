export const getApiBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_BASE_API_URL;
  if (envUrl) {
    return envUrl;
  }
  return process.env.NODE_ENV === 'production'
    ? ''
    : 'http://localhost:5000/api/v1';
};

const API_BASE_URL = getApiBaseUrl();


export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  code?: string;
  message?: string;
  requestId?: string;
  details?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly requestId?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status: number,
    requestId?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include',
  });

  let data: ApiResponse<T>;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      'PARSE_ERROR',
      'Invalid server response',
      response.status
    );
  }

  if (!data.success) {
    const code = data.code || data.error?.code || 'UNKNOWN_ERROR';
    const message = data.message || data.error?.message || 'An error occurred';
    const details = data.details || data.error?.details;
    throw new ApiError(code, message, response.status, data.requestId, details);
  }

  return data.data;
}

export function get<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' });
}

export function post<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function patch<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
