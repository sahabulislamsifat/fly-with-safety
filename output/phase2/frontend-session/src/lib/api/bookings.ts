import { ApiError, apiRequest, post } from './client';

export interface BookingPassenger {
  firstName: string;
  lastName: string;
  passengerType: 'adult' | 'child' | 'infant';
  gender?: 'male' | 'female' | 'other';
  dateOfBirth?: string;
  passportNumber?: string;
  passportExpiry?: string;
  nationality?: string;
}

export interface CreateBookingPayload {
  bookingType: 'FLIGHT' | 'HOTEL' | 'PACKAGE';
  bookingModel?: 'AGENCY_INQUIRY' | 'PROVIDER_REDIRECT' | 'DIRECT_API';
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  totalPrice: number;
  currency?: string;
  bookingDetails?: Record<string, unknown>;
  passengers: BookingPassenger[];
  notes?: string;
}

export interface BookingRecord {
  id: string;
  referenceNumber: string;
  bookingType: 'FLIGHT' | 'HOTEL' | 'PACKAGE';
  bookingModel: 'AGENCY_INQUIRY' | 'PROVIDER_REDIRECT' | 'DIRECT_API';
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  totalPrice: number;
  currency: string;
  bookingDetails?: Record<string, unknown> | null;
  notes?: string | null;
  createdAt: string;
  passengers: {
    id: string;
    firstName: string;
    lastName: string;
    passengerType: string;
    nationality?: string | null;
  }[];
  statusHistory: {
    id: string;
    fromStatus: string;
    toStatus: string;
    reason?: string | null;
    createdAt: string;
  }[];
}

export interface CreateBookingResponse {
  booking: {
    id: string;
    referenceNumber: string;
    status: string;
    customerName: string;
    customerEmail: string;
    totalPrice: number;
    currency: string;
    passengerCount: number;
    createdAt: string;
  };
}

export async function createBooking(payload: CreateBookingPayload, requestId: string): Promise<CreateBookingResponse> {
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId))throw new ApiError('INVALID_REQUEST_ID','Please start a new booking request.',400);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try {
    return await apiRequest<CreateBookingResponse>('/bookings',{method:'POST',body:JSON.stringify(payload),headers:{'Idempotency-Key':requestId.toLowerCase()},signal:controller.signal});
  } finally {clearTimeout(timer);}
}

export async function lookupBooking(referenceNumber: string, email: string): Promise<{
  booking: BookingRecord;
}> {
  return post('/bookings/lookup', { referenceNumber, email });
}
