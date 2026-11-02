import { post } from './client';

export interface ContactPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  subject: string;
  serviceType?: 'flights' | 'hotels' | 'packages' | 'visa' | 'other';
  message: string;
}

export interface ContactResponse {
  referenceNumber: string;
  status: string;
  createdAt: string;
}

export async function submitContact(payload: ContactPayload, idempotencyKey: string): Promise<ContactResponse> {
  return post<ContactResponse>('/contact', payload, { 'Idempotency-Key': idempotencyKey });
}
