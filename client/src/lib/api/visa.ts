import { get, post } from './client';

export interface VisaInfoItem {
  id: string;
  country: string;
  countryCode: string;
  visaType: string;
  processingTime: string;
  price: number;
  currency: string;
  popular?: boolean;
}

export interface VisaInquiryPayload {
  country: string;
  visaType?: string;
  name: string;
  email: string;
  phone?: string;
  travelDate?: string;
  notes?: string;
}

export async function getVisaList(): Promise<{ visaList: VisaInfoItem[] }> {
  return get('/visa');
}

export async function getVisaByCountry(country: string): Promise<{ visa: Record<string, unknown> }> {
  return get(`/visa/${country}`);
}

export async function submitVisaInquiry(payload: VisaInquiryPayload): Promise<{
  referenceNumber: string;
  inquiry: Record<string, unknown>;
  message: string;
}> {
  return post('/visa/inquiries', payload);
}
