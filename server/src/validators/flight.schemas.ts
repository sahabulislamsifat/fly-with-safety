import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(val: string): boolean {
  const d = new Date(val);
  return !isNaN(d.getTime());
}

export const flightSearchSchema = z.object({
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
  passengers: z
    .number()
    .int()
    .min(1, 'At least 1 passenger required')
    .max(9, 'Maximum 9 passengers'),
  cabinClass: z.enum(['economy', 'business', 'first']).default('economy'),
});

export const flightInquirySchema = flightSearchSchema.extend({
  name: z.string().min(2, 'Name is required').max(100).trim(),
  email: z.string().email('Invalid email').max(255),
  phone: z.string().max(30).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

export type FlightSearchInput = z.infer<typeof flightSearchSchema>;
export type FlightInquiryInput = z.infer<typeof flightInquirySchema>;
