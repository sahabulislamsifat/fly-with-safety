import { z } from 'zod';

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(+date) && date.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
const boundedText = z.string().trim().max(128);
// Flat, bounded itinerary metadata only. Payment/source fields are server-owned.
export const bookingDetailsInputSchema = z.object({
  offerId: boundedText.optional(), flightNumber: boundedText.optional(),
  departureDate: calendarDate.optional(), returnDate: calendarDate.nullable().optional(),
  cabinClass: boundedText.optional(), hotelId: boundedText.optional(),
  checkIn: calendarDate.optional(), checkOut: calendarDate.optional(),
  guests: z.number().int().min(1).max(50).optional(), rooms: z.number().int().min(1).max(50).optional(),
  packageId: boundedText.optional(), packageTitle: boundedText.optional(), travelDate: calendarDate.optional(),
}).strict().refine(value => Buffer.byteLength(JSON.stringify(value), 'utf8') <= 4096, 'Booking details exceed the size limit');

export const passengerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50).trim(),
  lastName: z.string().min(1, 'Last name is required').max(50).trim(),
  passengerType: z.enum(['adult', 'child', 'infant']).default('adult'),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dateOfBirth: calendarDate.refine(value => value <= new Date().toISOString().slice(0, 10), 'Birth date cannot be in the future').optional(),
  passportNumber: z.string().trim().max(30).optional(),
  passportExpiry: calendarDate.optional(),
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
  bookingDetails: bookingDetailsInputSchema.optional(),
  passengers: z.array(passengerSchema).min(1, 'At least 1 passenger is required').max(50),
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
  expectedStatus: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']).optional(),
  expectedUpdatedAt: z.iso.datetime().optional(),
});

export const createBookingFromInquirySchema = z.object({
  inquiryType: z.enum(['flights', 'hotels', 'packages']),
  inquiryId: z.string().min(1, 'Inquiry ID is required'),
  totalPrice: z.number().int().min(0, 'Total price must be a non-negative integer'),
  currency: z.string().max(10).default('BDT'),
  notes: z.string().max(1000).optional().or(z.literal('')),
  passengers: z.array(passengerSchema).min(1, 'At least 1 passenger is required').max(50).optional(),
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
