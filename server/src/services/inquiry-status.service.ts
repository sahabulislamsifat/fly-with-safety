import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { assertInquiryTransition } from '../utils/status-transitions.js';
import { assertRecordScope, audit } from '../identity/store.js';
import { identityContext, identityEnabled } from '../identity/policy.js';
import { Prisma } from '../generated/prisma/client.js';

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
  if (identityEnabled()) return prisma.$transaction(async tx => {
    const table = { flightInquiry: 'FlightInquiry', hotelInquiry: 'HotelInquiry', packageInquiry: 'PackageInquiry', visaInquiry: 'VisaInquiry' }[model];
    await tx.$queryRaw(Prisma.sql`SELECT id FROM ${Prisma.raw(`"${table}"`)} WHERE id=${id} FOR UPDATE`);
    await assertRecordScope(tx, model, id, true);
    const delegate = tx[model] as unknown as InquiryDelegate;
    const current = await delegate.findUnique({ where: { id }, select: { status: true } });
    if (!current) throw AppError.notFound();
    assertInquiryTransition(current.status, to);
    const result = await delegate.update({ where: { id }, data: { status: to } });
    await audit(tx, identityContext.getStore()!.id, 'INQUIRY_STATUS_CHANGED', id, 'STAFF_ASSIGNMENT');
    return result;
  });
  const delegate = prisma[model] as unknown as InquiryDelegate;

  const current = await delegate.findUnique({ where: { id }, select: { status: true } });
  if (!current) throw AppError.notFound('Inquiry not found');

  assertInquiryTransition(current.status, to);

  return delegate.update({ where: { id }, data: { status: to } });
}
