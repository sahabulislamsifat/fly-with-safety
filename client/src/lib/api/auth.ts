import { getApiBaseUrl, post } from './client';

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

export function startGoogleSignIn(): void {
  window.location.href = `${getApiBaseUrl()}/auth/google`;
}
