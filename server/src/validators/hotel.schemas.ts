import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function isValidDate(val: string): boolean {
  return !isNaN(new Date(val).getTime());
}

export const hotelSearchSchema = z.object({
  destination: z.string().min(2, 'Destination is required').max(200).trim(),
  checkIn: z
    .string()
    .regex(ISO_DATE, 'Check-in must be YYYY-MM-DD')
    .refine(isValidDate, 'Invalid check-in date'),
  checkOut: z
    .string()
    .regex(ISO_DATE, 'Check-out must be YYYY-MM-DD')
    .refine(isValidDate, 'Invalid check-out date'),
  guests: z.number().int().min(1).max(20),
  rooms: z.number().int().min(1).max(10),
});

export const hotelInquirySchema = hotelSearchSchema.extend({
  name: z.string().min(2, 'Name is required').max(100).trim(),
  email: z.string().email('Invalid email').max(255),
  phone: z.string().max(30).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
}).refine((data) => data.checkOut > data.checkIn, {
  message: 'Check-out must be after check-in',
  path: ['checkOut'],
});

export type HotelSearchInput = z.infer<typeof hotelSearchSchema>;
export type HotelInquiryInput = z.infer<typeof hotelInquirySchema>;
