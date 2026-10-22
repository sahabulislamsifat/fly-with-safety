const PRODUCTION_API_BASE_URL = 'https://fly-with-safety-server.vercel.app/api/v1';
const HEALTH_CHECK_TIMEOUT_MS = 1_500;
const LOCAL_API_CACHE_TTL_MS = 30_000;

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function isLocalBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function productionApiBaseUrl(): string {
  const configuredUrl = trimTrailingSlash(
    process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_BASE_API_URL || PRODUCTION_API_BASE_URL,
  );
  // A misconfigured deployed build must never send visitors to their own API.
  return /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(configuredUrl)
    ? PRODUCTION_API_BASE_URL
    : configuredUrl;
}

function localApiBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_LOCAL_API_BASE_URL;
  if (configuredUrl) return trimTrailingSlash(configuredUrl);
  return `http://${window.location.hostname}:5000/api/v1`;
}

let cachedApiBaseUrl: string | undefined;
let cacheExpiresAt = 0;
let pendingResolution: Promise<string> | undefined;

async function isHealthy(apiBaseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBaseUrl}/health`, { method: 'GET', credentials: 'omit', signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

/** Resolves before sending a request. Requests are never replayed against another API. */
export async function resolveApiBaseUrl(): Promise<string> {
  if (!isLocalBrowser()) return productionApiBaseUrl();
  if (cachedApiBaseUrl && Date.now() < cacheExpiresAt) return cachedApiBaseUrl;
  if (pendingResolution) return pendingResolution;

  pendingResolution = (async () => {
    const localUrl = localApiBaseUrl();
    cachedApiBaseUrl = (await isHealthy(localUrl)) ? localUrl : productionApiBaseUrl();
    cacheExpiresAt = Date.now() + LOCAL_API_CACHE_TTL_MS;
    return cachedApiBaseUrl;
  })();

  try {
    return await pendingResolution;
  } finally {
    pendingResolution = undefined;
  }
}

/** Returns the configured production base URL for server rendering and diagnostics. */
export function getApiBaseUrl(): string {
  return productionApiBaseUrl();
}

export interface ApiSuccessResponse<T> { success: true; data: T; message?: string; }
export interface ApiErrorResponse {
  success: false;
  code?: string;
  message?: string;
  requestId?: string;
  details?: Record<string, unknown>;
  error?: { code: string; message: string; details?: Record<string, string[]>; };
}
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly requestId?: string;
  public readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, status: number, requestId?: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const apiBaseUrl = await resolveApiBaseUrl();
  const url = `${apiBaseUrl}${path}`;
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Unable to reach the selected API. Check your connection and try again.', 0);
  }

  let data: ApiResponse<T>;
  try {
    data = await response.json();
  } catch {
    throw new ApiError('PARSE_ERROR', 'Invalid server response', response.status);
  }
  if (!response.ok && data.success) {
    throw new ApiError('HTTP_ERROR', 'The server could not complete the request. Please try again.', response.status);
  }
  if (!data.success) {
    throw new ApiError(
      data.code || data.error?.code || 'UNKNOWN_ERROR',
      data.message || data.error?.message || 'An error occurred',
      response.status,
      data.requestId,
      data.details || data.error?.details,
    );
  }
  return data.data;
}

export function get<T>(path: string): Promise<T> { return apiRequest<T>(path, { method: 'GET' }); }
export function post<T>(path: string, body: unknown, headers?: HeadersInit): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body), headers });
}
export function patch<T>(path: string, body: unknown): Promise<T> { return apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }); }
export function del<T>(path: string): Promise<T> { return apiRequest<T>(path, { method: 'DELETE' }); }
