import { z } from 'zod';

export const accountQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const inquiryListQuerySchema = accountQuerySchema.extend({
  type: z.enum(['flight', 'hotel', 'package', 'visa']).optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']).optional(),
});

export const bookingListQuerySchema = accountQuerySchema.extend({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']).optional(),
});

export const inquiryParamsSchema = z.object({
  type: z.enum(['flight', 'hotel', 'package', 'visa']),
  reference: z.string().min(3).max(100),
});

export const bookingParamsSchema = z.object({
  reference: z.string().min(3).max(100),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
});

export type InquiryType = z.infer<typeof inquiryParamsSchema>['type'];
