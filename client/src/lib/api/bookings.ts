import { post } from './client';

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

export async function createBooking(payload: CreateBookingPayload): Promise<{
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
}> {
  return post('/bookings', payload);
}

export async function lookupBooking(referenceNumber: string, email: string): Promise<{
  booking: BookingRecord;
}> {
  return post('/bookings/lookup', { referenceNumber, email });
}
