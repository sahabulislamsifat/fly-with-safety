import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { assertInquiryTransition } from '../utils/status-transitions.js';

type InquiryModel = 'flightInquiry' | 'hotelInquiry' | 'packageInquiry' | 'visaInquiry';

interface InquiryDelegate {
  findUnique(args: { where: { id: string }; select: { status: true } }): Promise<{ status: string } | null>;
  update(args: { where: { id: string }; data: { status: string } }): Promise<unknown>;
}

/**
 * Shared, validated lifecycle change for every inquiry type.
 * Throws 404 if missing, 422 on an illegal transition.
 */
export async function transitionInquiryStatus(model: InquiryModel, id: string, to: string) {
  const delegate = prisma[model] as unknown as InquiryDelegate;

  const current = await delegate.findUnique({ where: { id }, select: { status: true } });
  if (!current) throw AppError.notFound('Inquiry not found');

  assertInquiryTransition(current.status, to);

  return delegate.update({ where: { id }, data: { status: to } });
}
