import { z } from 'zod';

export const contactSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100).trim(),
  lastName: z.string().min(1, 'Last name is required').max(100).trim(),
  email: z.string().email('Invalid email address').max(255),
  phone: z.string().max(30).optional().or(z.literal('')),
  subject: z.string().min(3, 'Subject must be at least 3 characters').max(200).trim(),
  serviceType: z.enum(['flights', 'hotels', 'packages', 'visa', 'other']).optional(),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000).trim(),
});

export type ContactInput = z.infer<typeof contactSchema>;
