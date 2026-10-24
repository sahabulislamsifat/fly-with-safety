import { del, get, patch, post } from './client';

export type InquiryStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type ContactStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED';
export type TestimonialStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminFlightInquiry {
  id: string;
  referenceNumber: string;
  userId: string | null;
  fromAirport: string;
  toAirport: string;
  departureDate: string;
  returnDate: string | null;
  passengers: number;
  cabinClass: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  status: InquiryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminHotelInquiry {
  id: string;
  referenceNumber: string;
  userId: string | null;
  destination: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  status: InquiryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPackageInquiry {
  id: string;
  referenceNumber: string;
  userId: string | null;
  packageId: string | null;
  packageTitle: string | null;
  travellers: number;
  travelDate: string | null;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  status: InquiryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminVisaInquiry {
  id: string;
  referenceNumber: string;
  userId: string | null;
  destination: string;
  nationality: string;
  travelPurpose: string | null;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  status: InquiryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminBookingPassenger {
  id: string;
  firstName: string;
  lastName: string;
  passengerType: string;
  passportNumberMasked?: string;
  nationality: string | null;
}

export interface AdminBookingStatusHistory {
  id: string;
  bookingId: string;
  fromStatus: BookingStatus;
  toStatus: BookingStatus;
  reason: string | null;
  changedBy: string | null;
  createdAt: string;
}

export interface AdminBooking {
  id: string;
  referenceNumber: string;
  bookingType: 'FLIGHT' | 'HOTEL' | 'PACKAGE';
  bookingModel: 'AGENCY_INQUIRY' | 'PROVIDER_REDIRECT' | 'DIRECT_API';
  status: BookingStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  totalPrice: number;
  currency: string;
  bookingDetails: Record<string, unknown> | null;
  notes: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  passengers: AdminBookingPassenger[];
  statusHistory: AdminBookingStatusHistory[];
}

export interface AdminContactSummary {
  id: string;
  referenceNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  status: ContactStatus;
  createdAt: string;
}

export interface AdminContactDetail {
  id: string;
  referenceNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  subject: string;
  serviceType: string | null;
  message: string;
  status: ContactStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTestimonial {
  id: string;
  quote: string;
  author: string;
  role: string | null;
  rating: number;
  status: TestimonialStatus;
  createdAt: string;
  updatedAt: string;
}

function queryString(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== '') q.set(key, String(val));
  });
  const str = q.toString();
  return str ? `?${str}` : '';
}

// ─── Inquiries ───────────────────────────────────────────────────────────────

export function getAdminFlightInquiries(params?: {
  page?: number;
  limit?: number;
  status?: InquiryStatus;
}): Promise<{ inquiries: AdminFlightInquiry[]; pagination: Pagination }> {
  return get(`/admin/inquiries/flights${queryString(params || {})}`);
}

export function updateFlightInquiryStatus(
  id: string,
  status: InquiryStatus,
  note?: string
): Promise<{ inquiry: AdminFlightInquiry }> {
  return patch(`/admin/inquiries/flights/${encodeURIComponent(id)}/status`, { status, note });
}

export function getAdminHotelInquiries(params?: {
  page?: number;
  limit?: number;
  status?: InquiryStatus;
}): Promise<{ inquiries: AdminHotelInquiry[]; pagination: Pagination }> {
  return get(`/admin/inquiries/hotels${queryString(params || {})}`);
}

export function updateHotelInquiryStatus(
  id: string,
  status: InquiryStatus,
  note?: string
): Promise<{ inquiry: AdminHotelInquiry }> {
  return patch(`/admin/inquiries/hotels/${encodeURIComponent(id)}/status`, { status, note });
}

export function getAdminPackageInquiries(params?: {
  page?: number;
  limit?: number;
  status?: InquiryStatus;
}): Promise<{ inquiries: AdminPackageInquiry[]; pagination: Pagination }> {
  return get(`/admin/inquiries/packages${queryString(params || {})}`);
}

export function updatePackageInquiryStatus(
  id: string,
  status: InquiryStatus,
  note?: string
): Promise<{ inquiry: AdminPackageInquiry }> {
  return patch(`/admin/inquiries/packages/${encodeURIComponent(id)}/status`, { status, note });
}

export function getAdminVisaInquiries(params?: {
  page?: number;
  limit?: number;
  status?: InquiryStatus;
}): Promise<{ inquiries: AdminVisaInquiry[]; pagination: Pagination }> {
  return get(`/admin/inquiries/visa${queryString(params || {})}`);
}

export function updateVisaInquiryStatus(
  id: string,
  status: InquiryStatus,
  note?: string
): Promise<{ inquiry: AdminVisaInquiry }> {
  return patch(`/admin/inquiries/visa/${encodeURIComponent(id)}/status`, { status, note });
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export function getAdminBookings(params?: {
  page?: number;
  limit?: number;
  status?: BookingStatus;
  type?: string;
}): Promise<{ bookings: AdminBooking[]; pagination: Pagination }> {
  return get(`/admin/bookings${queryString(params || {})}`);
}

export interface CreateBookingFromInquiryPayload {
  inquiryType: 'flights' | 'hotels' | 'packages';
  inquiryId: string;
  totalPrice: number;
  currency?: string;
  notes?: string;
  passengers?: Array<{
    firstName: string;
    lastName: string;
    passengerType?: 'adult' | 'child' | 'infant';
    gender?: 'male' | 'female' | 'other';
    dateOfBirth?: string;
    passportNumberMasked?: string;
    passportExpiry?: string;
    nationality?: string;
  }>;
  paymentStatus?: 'AWAITING_PAYMENT_INSTRUCTIONS' | 'AWAITING_PAYMENT_CONFIRMATION' | 'PAYMENT_VERIFIED';
}

export function createBookingFromInquiry(
  payload: CreateBookingFromInquiryPayload
): Promise<{ booking: AdminBooking }> {
  return post('/admin/bookings/from-inquiry', payload);
}

export function updateAdminBookingStatus(
  id: string,
  status: BookingStatus,
  reason?: string
): Promise<{ booking: AdminBooking }> {
  return patch(`/admin/bookings/${encodeURIComponent(id)}/status`, { status, reason });
}

// ─── Contact Messages ────────────────────────────────────────────────────────

export function getAdminContactMessages(params?: {
  page?: number;
  limit?: number;
  status?: ContactStatus;
}): Promise<{ messages: AdminContactSummary[]; pagination: Pagination }> {
  return get(`/admin/contact${queryString(params || {})}`);
}

export function getAdminContactMessage(id: string): Promise<{ message: AdminContactDetail }> {
  return get(`/admin/contact/${encodeURIComponent(id)}`);
}

export function updateAdminContactStatus(
  id: string,
  status: ContactStatus
): Promise<{ message: AdminContactDetail }> {
  return patch(`/admin/contact/${encodeURIComponent(id)}/status`, { status });
}

// ─── Testimonials ────────────────────────────────────────────────────────────

export function getAdminTestimonials(params?: {
  page?: number;
  limit?: number;
  status?: TestimonialStatus;
}): Promise<{ testimonials: AdminTestimonial[]; pagination: Pagination }> {
  return get(`/admin/testimonials${queryString(params || {})}`);
}

export function createAdminTestimonial(data: {
  quote: string;
  author: string;
  role?: string;
  rating?: number;
}): Promise<{ testimonial: AdminTestimonial }> {
  return post('/admin/testimonials', data);
}

export function updateAdminTestimonialStatus(
  id: string,
  status: TestimonialStatus
): Promise<{ testimonial: AdminTestimonial }> {
  return patch(`/admin/testimonials/${encodeURIComponent(id)}/status`, { status });
}

export function deleteAdminTestimonial(id: string): Promise<{ message: string }> {
  return del(`/admin/testimonials/${encodeURIComponent(id)}`);
}
