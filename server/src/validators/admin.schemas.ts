import { z } from 'zod';
import { CONTACT_STATUSES, INQUIRY_STATUSES } from '../utils/status-transitions.js';

export const inquiryStatusSchema = z.object({
  status: z.enum(INQUIRY_STATUSES),
  note: z.string().max(500).optional(),
});

export const contactStatusSchema = z.object({
  status: z.enum(CONTACT_STATUSES),
});

export type InquiryStatusInput = z.infer<typeof inquiryStatusSchema>;
export type ContactStatusInput = z.infer<typeof contactStatusSchema>;
