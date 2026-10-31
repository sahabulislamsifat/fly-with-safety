import { apiRequest } from './client';
export interface BookingCommercial {
  version: 1; revision: number;
  quotes: Array<{ id: string; amount: number; currency: string; validUntil: string; createdAt: string; acceptedAt: string | null }>;
  payments: Array<{ id: string; amount: number; currency: string; method: string; recordedAt: string; status: 'RECORDED_UNVERIFIED' }>;
}
export type CommercialInput = { requestId: string; expectedRevision: number } & (
  { action: 'OFFER_QUOTE'; amount: number; currency: string; validUntil: string } |
  { action: 'ACCEPT_QUOTE'; quoteId: string } |
  { action: 'RECORD_PAYMENT'; amount: number; currency: string; method: 'BANK_TRANSFER' | 'CASH' | 'MOBILE_BANKING' });
export async function changeBookingCommercial(reference: string, audience: 'admin' | 'account', input: CommercialInput) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    return await apiRequest<{ booking: { commercial: BookingCommercial } }>(`/${audience}/bookings/${encodeURIComponent(reference)}/commercial`, {
      method: 'POST', body: JSON.stringify(input), signal: controller.signal,
    });
  } finally { clearTimeout(timer); }
}
