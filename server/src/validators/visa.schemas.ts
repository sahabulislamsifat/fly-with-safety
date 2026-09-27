import { z } from 'zod';

export const visaInquirySchema = z.object({
  destination: z.string().min(2, 'Destination is required').max(100).trim(),
  nationality: z.string().min(2, 'Nationality is required').max(100).trim(),
  travelPurpose: z.string().max(200).optional().or(z.literal('')),
  name: z.string().min(2, 'Name is required').max(100).trim(),
  email: z.string().email('Invalid email').max(255),
  phone: z.string().max(30).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

export type VisaInquiryInput = z.infer<typeof visaInquirySchema>;
