import { MockHotelProvider } from './providers/mock-hotel.provider.js';
import type { HotelProvider } from './providers/hotel.provider.js';
import { prisma } from '../lib/prisma.js';
import { generateReferenceNumber, normalizeEmail, normalizePhone } from '../utils/helpers.js';
import { sendInquiryConfirmation } from './notification.service.js';
import type { HotelSearchInput, HotelInquiryInput } from '../validators/hotel.schemas.js';
import { transitionInquiryStatus } from './inquiry-status.service.js';
import { createIdempotentInquiry } from './idempotency.service.js';

const hotelProvider: HotelProvider = new MockHotelProvider();

export async function searchHotels(input: HotelSearchInput) {
  const results = await hotelProvider.searchHotels({
    destination: input.destination,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guests: input.guests,
    rooms: input.rooms,
  });

  return {
    results,
    provider: hotelProvider.name,
    isLiveData: false,
    searchParams: input,
  };
}

export async function submitHotelInquiry(input: HotelInquiryInput, userId: string | undefined, idempotencyKey: string) {
  const referenceNumber = generateReferenceNumber();
  const result = await createIdempotentInquiry({
    operation: 'hotel-inquiry', key: idempotencyKey, userId, email: input.email, payload: input,
    create: (tx) => tx.hotelInquiry.create({ data: {
      referenceNumber,
      userId: userId || null,
      destination: input.destination.trim(),
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests: input.guests,
      rooms: input.rooms,
      name: input.name.trim(),
      email: normalizeEmail(input.email),
      phone: input.phone ? normalizePhone(input.phone) : null,
      notes: input.notes || null,
      status: 'PENDING',
    }, select: {
      id: true,
      referenceNumber: true,
      destination: true,
      checkIn: true,
      checkOut: true,
      status: true,
      createdAt: true,
    } }),
    findByReference: (reference) => prisma.hotelInquiry.findUnique({ where: { referenceNumber: reference } }),
  });
  if (!result.replayed) sendInquiryConfirmation({
    to: normalizeEmail(input.email),
    name: input.name.trim(),
    referenceNumber,
    type: 'hotel',
  }).catch((err) => console.error('[Hotel] Email send failed:', err));
  return result;
}

export async function getHotelInquiries(params: { page?: number; limit?: number; status?: string }) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;
  const where = params.status ? { status: params.status as any } : {};

  const [total, inquiries] = await Promise.all([
    prisma.hotelInquiry.count({ where }),
    prisma.hotelInquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return { inquiries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function updateHotelInquiryStatus(id: string, status: string) {
  return transitionInquiryStatus('hotelInquiry', id, status);
}
