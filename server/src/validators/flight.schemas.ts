import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(val: string): boolean {
  const d = new Date(val);
  return !isNaN(d.getTime());
}

export const flightSearchSchema = z
  .object({
    tripType: z.enum(['roundTrip', 'oneWay', 'multiCity']).default('roundTrip'),
    from: z
      .string()
      .min(2, 'Origin is required')
      .max(10)
      .trim()
      .toUpperCase(),
    to: z
      .string()
      .min(2, 'Destination is required')
      .max(10)
      .trim()
      .toUpperCase(),
    departureDate: z
      .string()
      .regex(ISO_DATE, 'Departure date must be YYYY-MM-DD')
      .refine(isValidDate, 'Invalid departure date'),
    returnDate: z
      .string()
      .regex(ISO_DATE, 'Return date must be YYYY-MM-DD')
      .refine(isValidDate, 'Invalid return date')
      .optional()
      .or(z.literal('')),
    adults: z.number().int().min(1).max(9).default(1),
    children: z.number().int().min(0).max(8).default(0),
    infants: z.number().int().min(0).max(4).default(0),
    passengers: z.number().int().min(1).max(9).optional(),
    cabinClass: z.enum(['economy', 'premium_economy', 'business', 'first']).default('economy'),
  })
  .refine((data) => data.from !== data.to, {
    message: 'Origin and destination airports must be different',
    path: ['to'],
  })
  .transform((data) => {
    // Ensure passengers property reflects total traveler count
    const total = data.passengers || data.adults + data.children + data.infants;
    return {
      ...data,
      passengers: total,
    };
  });

export const flightInquirySchema = z.object({
  from: z
    .string()
    .min(2, 'Origin is required')
    .max(10)
    .trim()
    .toUpperCase(),
  to: z
    .string()
    .min(2, 'Destination is required')
    .max(10)
    .trim()
    .toUpperCase(),
  departureDate: z
    .string()
    .regex(ISO_DATE, 'Departure date must be YYYY-MM-DD')
    .refine(isValidDate, 'Invalid departure date'),
  returnDate: z
    .string()
    .regex(ISO_DATE, 'Return date must be YYYY-MM-DD')
    .refine(isValidDate, 'Invalid return date')
    .optional()
    .or(z.literal('')),
  tripType: z.enum(['roundTrip', 'oneWay', 'multiCity']).optional().default('roundTrip'),
  adults: z.number().int().min(1).max(9).optional().default(1),
  children: z.number().int().min(0).max(8).optional().default(0),
  infants: z.number().int().min(0).max(4).optional().default(0),
  passengers: z.number().int().min(1).max(9).optional().default(1),
  cabinClass: z.enum(['economy', 'premium_economy', 'business', 'first']).default('economy'),
  name: z.string().min(2, 'Name is required').max(100).trim(),
  email: z.string().email('Invalid email').max(255),
  phone: z.string().max(30).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

export type FlightSearchInput = z.infer<typeof flightSearchSchema>;
export type FlightInquiryInput = z.infer<typeof flightInquirySchema>;
