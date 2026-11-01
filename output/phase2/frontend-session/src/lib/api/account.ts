import { get, patch } from './client';

export type InquiryType = 'flight' | 'hotel' | 'package' | 'visa';
export type InquiryStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface Pagination { page: number; limit: number; total: number; totalPages: number; }
export interface AccountInquiry {
  id: string;
  type: InquiryType;
  referenceNumber: string;
  status: InquiryStatus;
  summary: string;
  travelDate: string | null;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}
export interface AccountBooking {
  commercial?: import('./booking-commercial').BookingCommercial;
  referenceNumber: string;
  bookingType: 'FLIGHT' | 'HOTEL' | 'PACKAGE';
  bookingModel: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  totalPrice: number;
  currency: string;
  bookingDetails: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}
export type BookingStatus = AccountBooking['status'];
export interface DashboardData {
  counts: { inquiries: number; pendingInquiries: number; bookings: number; confirmedBookings: number };
  memberSince: string | null;
  recent: AccountInquiry[];
}

function query(params: Record<string, string | number | undefined>): string {
  const values = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') values.set(key, String(value)); });
  const text = values.toString();
  return text ? `?${text}` : '';
}

export function getDashboard(): Promise<DashboardData> { return get('/account/dashboard'); }
export function getInquiries(params: { page?: number; limit?: number; type?: InquiryType; status?: InquiryStatus } = {}): Promise<{ inquiries: AccountInquiry[]; pagination: Pagination }> { return get(`/account/inquiries${query(params)}`); }
export function getInquiry(type: InquiryType, reference: string): Promise<AccountInquiry> { return get(`/account/inquiries/${type}/${encodeURIComponent(reference)}`); }
export function getBookings(params: { page?: number; limit?: number; status?: BookingStatus } = {}): Promise<{ bookings: AccountBooking[]; pagination: Pagination }> { return get(`/account/bookings${query(params)}`); }
export function getBooking(reference: string): Promise<{ booking: AccountBooking & { passengers: Array<Record<string, unknown>>; statusHistory: Array<Record<string, unknown>> } }> { return get(`/account/bookings/${encodeURIComponent(reference)}`); }
export function updateProfile(input: { name: string }): Promise<{ user: { id: string; email: string; name: string | null; role: string; emailVerified: boolean } }> { return patch('/account/profile', input); }
