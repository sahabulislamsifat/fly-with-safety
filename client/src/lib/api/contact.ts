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

export async function submitContact(payload: ContactPayload): Promise<ContactResponse> {
  return post<ContactResponse>('/contact', payload);
}
