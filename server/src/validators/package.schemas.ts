import { z } from 'zod';

export const packageInquirySchema = z.object({
  packageId: z.string().optional().or(z.literal('')),
  packageTitle: z.string().max(200).optional().or(z.literal('')),
  travellers: z.number().int().min(1).max(20),
  travelDate: z.string().optional().or(z.literal('')),
  name: z.string().min(2, 'Name is required').max(100).trim(),
  email: z.string().email('Invalid email').max(255),
  phone: z.string().max(30).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

export type PackageInquiryInput = z.infer<typeof packageInquirySchema>;
