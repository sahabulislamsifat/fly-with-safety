const getApiBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_BASE_API_URL;
  if (envUrl) {
    return envUrl;
  }
  return process.env.NODE_ENV === 'production'
    ? ''
    : 'http://127.0.0.1:5000/api/v1';
};

const API_BASE_URL = getApiBaseUrl();


export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Record<string, string[]>;

  constructor(code: string, message: string, status: number, details?: Record<string, string[]>) {
    super(message);
    this.code = code;
    this.status = status;
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
    throw new ApiError(
      data.error.code,
      data.error.message,
      response.status,
      data.error.details
    );
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
