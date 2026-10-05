import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { generateReferenceNumber, normalizeEmail, normalizePhone } from '../utils/helpers.js';
import { sendInquiryConfirmation } from './notification.service.js';
import type { VisaInquiryInput } from '../validators/visa.schemas.js';
import { transitionInquiryStatus } from './inquiry-status.service.js';

export async function getPublicVisaInfoList(params: { page?: number; limit?: number }) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 50));
  const skip = (page - 1) * limit;

  const [total, visaInfoList] = await Promise.all([
    prisma.visaInfo.count({ where: { status: 'PUBLISHED' } }),
    prisma.visaInfo.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { country: 'asc' },
      skip,
      take: limit,
      select: {
        id: true,
        country: true,
        slug: true,
        visaRequired: true,
        processingTime: true,
        fee: true,
        updatedAt: true,
      },
    }),
  ]);

  return { visaInfoList, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getVisaInfoByCountry(countryOrSlug: string) {
  const visa = await prisma.visaInfo.findFirst({
    where: {
      OR: [
        { slug: countryOrSlug.toLowerCase() },
        { country: { equals: countryOrSlug, mode: 'insensitive' } },
      ],
      status: 'PUBLISHED',
    },
  });

  if (!visa) throw AppError.notFound('Visa information not found for this country');
  return visa;
}

export async function submitVisaInquiry(input: VisaInquiryInput, userId?: string) {
  const referenceNumber = generateReferenceNumber();

  const inquiry = await prisma.visaInquiry.create({
    data: {
      referenceNumber,
      userId: userId || null,
      destination: input.destination.trim(),
      nationality: input.nationality.trim(),
      travelPurpose: input.travelPurpose || null,
      name: input.name.trim(),
      email: normalizeEmail(input.email),
      phone: input.phone ? normalizePhone(input.phone) : null,
      notes: input.notes || null,
      status: 'PENDING',
    },
    select: {
      id: true,
      referenceNumber: true,
      destination: true,
      nationality: true,
      status: true,
      createdAt: true,
    },
  });

  sendInquiryConfirmation({
    to: normalizeEmail(input.email),
    name: input.name.trim(),
    referenceNumber,
    type: 'visa',
  }).catch((err) => console.error('[Visa] Email send failed:', err));

  return inquiry;
}

export async function getVisaInquiries(params: { page?: number; limit?: number; status?: string }) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;
  const where = params.status ? { status: params.status as any } : {};

  const [total, inquiries] = await Promise.all([
    prisma.visaInquiry.count({ where }),
    prisma.visaInquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return { inquiries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function updateVisaInquiryStatus(id: string, status: string) {
  return transitionInquiryStatus('visaInquiry', id, status);
}

export async function adminGetAllVisaInfo(params: { page?: number; limit?: number }) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 50));
  const skip = (page - 1) * limit;

  const [total, visaInfoList] = await Promise.all([
    prisma.visaInfo.count(),
    prisma.visaInfo.findMany({
      orderBy: { country: 'asc' },
      skip,
      take: limit,
    }),
  ]);

  return { visaInfoList, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
