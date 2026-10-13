import { get, post, resolveApiBaseUrl } from './client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  emailVerified: boolean;
}

export async function signIn(input: { email: string; password: string }): Promise<AuthenticatedUser> {
  const result = await post<{ user: AuthenticatedUser }>('/auth/login', input);
  return result.user;
}

export async function register(input: { name: string; email: string; password: string }): Promise<AuthenticatedUser> {
  const result = await post<{ user: AuthenticatedUser }>('/auth/register', input);
  return result.user;
}

export async function getCurrentUser(): Promise<AuthenticatedUser> {
  return (await get<{ user: AuthenticatedUser }>('/auth/me')).user;
}

export async function refreshSession(): Promise<AuthenticatedUser> {
  return (await post<{ user: AuthenticatedUser }>('/auth/refresh', {})).user;
}

export async function signOut(): Promise<void> { await post('/auth/logout', {}); }
export async function verifyEmail(token: string): Promise<void> { await post('/auth/verify-email', { token }); }
export async function resendVerification(email: string): Promise<void> { await post('/auth/resend-verification', { email }); }
export async function requestPasswordReset(email: string): Promise<void> { await post('/auth/forgot-password', { email }); }
export async function resetPassword(token: string, password: string): Promise<void> { await post('/auth/reset-password', { token, password }); }

export async function startGoogleSignIn(): Promise<void> {
  // OAuth must leave the Next.js app for the configured API provider route.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `${await resolveApiBaseUrl()}/auth/google`;
}
