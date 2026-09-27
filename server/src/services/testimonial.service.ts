import { prisma } from '../lib/prisma.js';

export async function getApprovedTestimonials() {
  return prisma.testimonial.findMany({
    where: { status: 'APPROVED' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      quote: true,
      author: true,
      role: true,
      rating: true,
    },
  });
}

export async function adminGetAllTestimonials(params: { page?: number; limit?: number; status?: string }) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;
  const where = params.status ? { status: params.status as any } : {};

  const [total, testimonials] = await Promise.all([
    prisma.testimonial.count({ where }),
    prisma.testimonial.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return { testimonials, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function createTestimonial(data: {
  quote: string;
  author: string;
  role?: string;
  rating?: number;
}) {
  return prisma.testimonial.create({ data: { ...data, status: 'PENDING' } });
}

export async function updateTestimonialStatus(id: string, status: 'APPROVED' | 'REJECTED' | 'PENDING') {
  return prisma.testimonial.update({ where: { id }, data: { status } });
}

export async function deleteTestimonial(id: string) {
  return prisma.testimonial.delete({ where: { id } });
}
