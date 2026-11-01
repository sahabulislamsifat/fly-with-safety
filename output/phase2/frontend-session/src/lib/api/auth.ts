import { get, post, resolveApiBaseUrl, ApiError } from './client';
import { newAuthRequestId } from './auth-attempt';
function issuanceHeaders(id:string):Record<string,string>{
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id))throw new ApiError('INVALID_REQUEST_ID','Invalid request identity.',400);
  return {'Idempotency-Key':id};
}

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

export async function register(input: { name: string; email: string; password: string },requestId=newAuthRequestId()): Promise<AuthenticatedUser> {
  const result = await post<{ user?: AuthenticatedUser;registration?:string;requiresSignIn?:boolean }>('/auth/register', input,issuanceHeaders(requestId));
  if(result.registration==='replayed'&&result.requiresSignIn===true)throw new ApiError('REGISTRATION_REPLAYED','Registration already completed. Please sign in to continue.',200);
  if(!result.user)throw new ApiError('PARSE_ERROR','Invalid registration response.',200);
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
export async function resendVerification(email: string,requestId=newAuthRequestId()): Promise<void> { await post('/auth/resend-verification', { email },issuanceHeaders(requestId)); }
export async function requestPasswordReset(email: string,requestId=newAuthRequestId()): Promise<void> { await post('/auth/forgot-password', { email },issuanceHeaders(requestId)); }
export async function resetPassword(token: string, password: string): Promise<void> { await post('/auth/reset-password', { token, password }); }

export async function startGoogleSignIn(): Promise<void> {
  // OAuth must leave the Next.js app for the configured API provider route.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `${await resolveApiBaseUrl()}/auth/google`;
}
