import { prisma } from '../lib/prisma.js';
import { generateReferenceNumber, normalizeEmail, normalizePhone } from '../utils/helpers.js';
import { sendInquiryConfirmation } from './notification.service.js';
import type { PackageInquiryInput } from '../validators/package.schemas.js';
import { AppError } from '../utils/errors.js';
import { transitionInquiryStatus } from './inquiry-status.service.js';

export async function getPublicPackages(params: {
  page?: number;
  limit?: number;
  destinationSlug?: string;
  featured?: boolean;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 12));
  const skip = (page - 1) * limit;

  const where: any = { status: 'PUBLISHED' };
  if (params.featured) where.featured = true;
  if (params.destinationSlug) {
    where.destination = { slug: params.destinationSlug };
  }

  const [total, packages] = await Promise.all([
    prisma.package.count({ where }),
    prisma.package.findMany({
      where,
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
      include: {
        destination: {
          select: { id: true, name: true, country: true, slug: true },
        },
      },
    }),
  ]);

  return { packages, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getPackageBySlug(slug: string) {
  const pkg = await prisma.package.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: {
      destination: {
        select: { id: true, name: true, country: true, slug: true },
      },
    },
  });

  if (!pkg) throw AppError.notFound('Package not found');
  return pkg;
}

export async function submitPackageInquiry(
  slugOrId: string,
  input: PackageInquiryInput,
  userId?: string
) {
  // Resolve every supplied package identifier server-side. Browser titles never establish identity.
  let pkg = null;
  if (slugOrId !== 'general') {
    pkg = await prisma.package.findFirst({
      where: {
        OR: [{ slug: slugOrId }, { id: slugOrId }],
        status: 'PUBLISHED',
      },
      select: { id: true, title: true },
    });
    if (!pkg) throw AppError.notFound('Package not found');
  }

  const referenceNumber = generateReferenceNumber();

  const inquiry = await prisma.packageInquiry.create({
    data: {
      referenceNumber,
      userId: userId || null,
      packageId: pkg?.id || null,
      packageTitle: pkg?.title || (slugOrId === 'general' ? input.packageTitle || null : null),
      travellers: input.travellers,
      travelDate: input.travelDate || null,
      name: input.name.trim(),
      email: normalizeEmail(input.email),
      phone: input.phone ? normalizePhone(input.phone) : null,
      notes: input.notes || null,
      status: 'PENDING',
    },
    select: {
      id: true,
      referenceNumber: true,
      packageTitle: true,
      status: true,
      createdAt: true,
    },
  });

  sendInquiryConfirmation({
    to: normalizeEmail(input.email),
    name: input.name.trim(),
    referenceNumber,
    type: 'package',
  }).catch((err) => console.error('[Package] Email send failed:', err));

  return inquiry;
}

export async function getPackageInquiries(params: { page?: number; limit?: number; status?: string }) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;
  const where = params.status ? { status: params.status as any } : {};

  const [total, inquiries] = await Promise.all([
    prisma.packageInquiry.count({ where }),
    prisma.packageInquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return { inquiries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function updatePackageInquiryStatus(id: string, status: string) {
  return transitionInquiryStatus('packageInquiry', id, status);
}

// Admin CRUD
export async function adminGetAllPackages(params: { page?: number; limit?: number }) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const [total, packages] = await Promise.all([
    prisma.package.count(),
    prisma.package.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { destination: { select: { name: true, country: true } } },
    }),
  ]);

  return { packages, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
