import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';

export async function getPublicDestinations(params: {
  featured?: boolean;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 12));
  const skip = (page - 1) * limit;

  const where: any = { status: 'PUBLISHED' };
  if (params.featured) where.featured = true;

  const [total, destinations] = await Promise.all([
    prisma.destination.count({ where }),
    prisma.destination.findMany({
      where,
      orderBy: [{ featured: 'desc' }, { name: 'asc' }],
      skip,
      take: limit,
      select: {
        id: true,
        slug: true,
        name: true,
        country: true,
        description: true,
        startingPrice: true,
        image: true,
        featured: true,
      },
    }),
  ]);

  return { destinations, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getDestinationBySlug(slug: string) {
  const destination = await prisma.destination.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: {
      packages: {
        where: { status: 'PUBLISHED' },
        orderBy: { featured: 'desc' },
        take: 6,
        select: {
          id: true,
          slug: true,
          title: true,
          price: true,
          durationDays: true,
          featuredImage: true,
        },
      },
    },
  });

  if (!destination) throw AppError.notFound('Destination not found');
  return destination;
}

export async function adminGetAllDestinations(params: { page?: number; limit?: number }) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const [total, destinations] = await Promise.all([
    prisma.destination.count(),
    prisma.destination.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return { destinations, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function createDestination(data: {
  slug: string;
  name: string;
  country: string;
  description?: string;
  startingPrice?: number;
  image?: string;
  featured?: boolean;
}) {
  return prisma.destination.create({ data: { ...data, status: 'PUBLISHED' } });
}

export async function updateDestination(id: string, data: Partial<{
  name: string;
  country: string;
  description: string;
  startingPrice: number;
  image: string;
  featured: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}>) {
  const existing = await prisma.destination.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Destination not found');
  return prisma.destination.update({ where: { id }, data });
}
