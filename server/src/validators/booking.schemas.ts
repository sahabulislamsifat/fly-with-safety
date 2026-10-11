import { z } from 'zod';

export const passengerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50).trim(),
  lastName: z.string().min(1, 'Last name is required').max(50).trim(),
  passengerType: z.enum(['adult', 'child', 'infant']).default('adult'),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD').optional(),
  passportNumber: z.string().max(30).optional(),
  passportExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Passport expiry must be YYYY-MM-DD').optional(),
  nationality: z.string().max(50).optional(),
});

export const createBookingSchema = z.object({
  bookingType: z.enum(['FLIGHT', 'HOTEL', 'PACKAGE']).default('FLIGHT'),
  bookingModel: z.enum(['AGENCY_INQUIRY', 'PROVIDER_REDIRECT', 'DIRECT_API']).default('AGENCY_INQUIRY'),
  customerName: z.string().min(2, 'Name is required').max(100).trim(),
  customerEmail: z.string().email('Invalid email address').max(255),
  customerPhone: z.string().max(30).optional().or(z.literal('')),
  totalPrice: z.number().int().min(0).default(0),
  currency: z.string().max(10).default('BDT'),
  bookingDetails: z.record(z.string(), z.any()).optional(),
  passengers: z.array(passengerSchema).min(1, 'At least 1 passenger is required'),
  notes: z.string().max(1000).optional().or(z.literal('')),
  idempotencyKey: z.string().max(128).optional(),
});

export const lookupBookingSchema = z.object({
  referenceNumber: z.string().min(5, 'Reference number is required').trim().toUpperCase(),
  email: z.string().email('Email is required').max(255),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']),
  reason: z.string().max(500).optional(),
});

export const createBookingFromInquirySchema = z.object({
  inquiryType: z.enum(['flights', 'hotels', 'packages']),
  inquiryId: z.string().min(1, 'Inquiry ID is required'),
  totalPrice: z.number().int().min(0, 'Total price must be a non-negative integer'),
  currency: z.string().max(10).default('BDT'),
  notes: z.string().max(1000).optional().or(z.literal('')),
  passengers: z.array(passengerSchema).min(1, 'At least 1 passenger is required').optional(),
  paymentStatus: z
    .enum([
      'AWAITING_PAYMENT_INSTRUCTIONS',
      'AWAITING_PAYMENT_CONFIRMATION',
      'PAYMENT_VERIFIED',
    ])
    .default('AWAITING_PAYMENT_INSTRUCTIONS'),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type LookupBookingInput = z.infer<typeof lookupBookingSchema>;
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
export type CreateBookingFromInquiryInput = z.infer<typeof createBookingFromInquirySchema>;
