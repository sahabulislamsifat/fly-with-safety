import { inquiryPageQuery } from './inquiry-page-query.js';
import { inquiryListQuerySchema } from '../validators/account.schemas.js';
import { bookingDTO } from '../utils/booking-dto.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import type { InquiryType } from '../validators/account.schemas.js';

type DashboardInquiry = {
  id: string;
  referenceNumber: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  type: InquiryType;
  summary: string;
  travelDate: string | null;
};

function pageMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

function inquirySummary(type: InquiryType, inquiry: Record<string, unknown> & { id: string; referenceNumber: string; status: string; createdAt: Date; updatedAt: Date }): DashboardInquiry {
  const summary = type === 'flight'
    ? `${inquiry.fromAirport} → ${inquiry.toAirport}`
    : type === 'hotel'
      ? inquiry.destination
      : type === 'package'
        ? inquiry.packageTitle || 'Holiday package'
        : inquiry.destination;
  const travelDate = type === 'flight' ? inquiry.departureDate : type === 'hotel' ? inquiry.checkIn : type === 'package' ? inquiry.travelDate : null;
  return { id: inquiry.id, referenceNumber: inquiry.referenceNumber, status: inquiry.status, createdAt: inquiry.createdAt, updatedAt: inquiry.updatedAt, type, summary: String(summary), travelDate: travelDate ? String(travelDate) : null };
}

function inquiryDetail(type: InquiryType, inquiry: Record<string, unknown> & { id: string; referenceNumber: string; status: string; createdAt: Date; updatedAt: Date }) {
  const summary = inquirySummary(type, inquiry);
  return { ...inquiry, type, summary: summary.summary, travelDate: summary.travelDate };
}

export async function getDashboard(userId: string) {
  const [flightCount, hotelCount, packageCount, visaCount, pendingFlights, pendingHotels, pendingPackages, pendingVisas, bookingCount, confirmedBookingCount, recentFlights, recentHotels, recentPackages, recentVisas, user] = await Promise.all([
    prisma.flightInquiry.count({ where: { userId } }),
    prisma.hotelInquiry.count({ where: { userId } }),
    prisma.packageInquiry.count({ where: { userId } }),
    prisma.visaInquiry.count({ where: { userId } }),
    prisma.flightInquiry.count({ where: { userId, status: 'PENDING' } }),
    prisma.hotelInquiry.count({ where: { userId, status: 'PENDING' } }),
    prisma.packageInquiry.count({ where: { userId, status: 'PENDING' } }),
    prisma.visaInquiry.count({ where: { userId, status: 'PENDING' } }),
    prisma.booking.count({ where: { userId } }),
    prisma.booking.count({ where: { userId, status: 'CONFIRMED' } }),
    prisma.flightInquiry.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 4 }),
    prisma.hotelInquiry.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 4 }),
    prisma.packageInquiry.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 4 }),
    prisma.visaInquiry.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 4 }),
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
  ]);

  const recent = [
    ...recentFlights.map((item) => inquirySummary('flight', item)),
    ...recentHotels.map((item) => inquirySummary('hotel', item)),
    ...recentPackages.map((item) => inquirySummary('package', item)),
    ...recentVisas.map((item) => inquirySummary('visa', item)),
  ].sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime()).slice(0, 5);

  return {
    counts: {
      inquiries: flightCount + hotelCount + packageCount + visaCount,
      pendingInquiries: pendingFlights + pendingHotels + pendingPackages + pendingVisas,
      bookings: bookingCount,
      confirmedBookings: confirmedBookingCount,
    },
    memberSince: user?.createdAt ?? null,
    recent,
  };
}

export async function listInquiries(userId: string, input: { page: number; limit: number; type?: InquiryType; status?: string }) {
  const validated = inquiryListQuerySchema.safeParse(input);
  if (!validated.success) throw AppError.badRequest('Invalid inquiry pagination or filter');
  const query = validated.data;
  // A single SQL statement gives page and count the same snapshot, including empty offset pages.
  const rows = await prisma.$queryRaw<(Omit<DashboardInquiry, 'id'> & { total: bigint; id: string | null })[]>(inquiryPageQuery(userId, query));
  const total = Number(rows[0]?.total ?? 0);
  if (!Number.isSafeInteger(total)) throw AppError.internal('Inquiry count exceeds supported range');
  const inquiries = rows.filter(row => row.id !== null).map(row => ({
    id: row.id, referenceNumber: row.referenceNumber, status: row.status,
    createdAt: row.createdAt, updatedAt: row.updatedAt, type: row.type,
    summary: row.summary, travelDate: row.travelDate,
  }));
  return { inquiries, pagination: pageMeta(query.page, query.limit, total) };
}

export async function getInquiry(userId: string, type: InquiryType, reference: string) {
  const where = { userId, referenceNumber: reference.toUpperCase() };
  const inquiry = type === 'flight'
    ? await prisma.flightInquiry.findFirst({ where })
    : type === 'hotel'
      ? await prisma.hotelInquiry.findFirst({ where })
      : type === 'package'
        ? await prisma.packageInquiry.findFirst({ where })
        : await prisma.visaInquiry.findFirst({ where });
  if (!inquiry) throw AppError.notFound('Inquiry not found');
  return inquiryDetail(type, inquiry);
}

export async function listBookings(userId: string, input: { page: number; limit: number; status?: string }) {
  const where = { userId, ...(input.status ? { status: input.status as never } : {}) };
  const [total, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (input.page - 1) * input.limit, take: input.limit, select: { referenceNumber: true, bookingType: true, bookingModel: true, status: true, totalPrice: true, currency: true, bookingDetails: true, createdAt: true, updatedAt: true } }),
  ]);
  return { bookings: bookings.map(b => bookingDTO(b, 'customer')), pagination: pageMeta(input.page, input.limit, total) };
}

export async function getBooking(userId: string, reference: string) {
  const booking = await prisma.booking.findFirst({
    where: { userId, referenceNumber: reference.toUpperCase() },
    include: { passengers: { select: { firstName: true, lastName: true, passengerType: true, nationality: true } }, statusHistory: { orderBy: { createdAt: 'asc' }, select: { fromStatus: true, toStatus: true, reason: true, createdAt: true } } },
  });
  if (!booking) throw AppError.notFound('Booking not found');
  return bookingDTO(booking, 'customer');
}

export async function updateProfile(userId: string, input: { name: string }) {
  return prisma.user.update({ where: { id: userId }, data: { name: input.name }, select: { id: true, email: true, name: true, role: true, emailVerified: true } });
}
