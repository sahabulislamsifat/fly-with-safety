import { z } from 'zod';
import { INQUIRY_STATUSES } from '../utils/status-transitions.js';

const integer = (maximum: number) => z.preprocess(value =>
  typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : value,
z.number().int().min(1).max(maximum));

export const inquiryPage = integer(10_000).default(1);
export const inquiryLimit = integer(50);
export const inquiryStatus = z.enum(INQUIRY_STATUSES);
export const adminInquiryListQuerySchema = z.object({
  page: inquiryPage, limit: inquiryLimit.default(20), status: inquiryStatus.optional(),
});
