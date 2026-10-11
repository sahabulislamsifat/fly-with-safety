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

async function findInquiries(type: InquiryType, userId: string, status?: string) {
  const where = { userId, ...(status ? { status: status as never } : {}) };
  switch (type) {
    case 'flight': return prisma.flightInquiry.findMany({ where, orderBy: { createdAt: 'desc' } });
    case 'hotel': return prisma.hotelInquiry.findMany({ where, orderBy: { createdAt: 'desc' } });
    case 'package': return prisma.packageInquiry.findMany({ where, orderBy: { createdAt: 'desc' } });
    case 'visa': return prisma.visaInquiry.findMany({ where, orderBy: { createdAt: 'desc' } });
  }
}

async function findInquiryPage(type: InquiryType, userId: string, page: number, limit: number, status?: string) {
  const where = { userId, ...(status ? { status: status as never } : {}) };
  const args = { where, orderBy: { createdAt: 'desc' as const }, skip: (page - 1) * limit, take: limit };
  switch (type) {
    case 'flight': return Promise.all([prisma.flightInquiry.count({ where }), prisma.flightInquiry.findMany(args)]);
    case 'hotel': return Promise.all([prisma.hotelInquiry.count({ where }), prisma.hotelInquiry.findMany(args)]);
    case 'package': return Promise.all([prisma.packageInquiry.count({ where }), prisma.packageInquiry.findMany(args)]);
    case 'visa': return Promise.all([prisma.visaInquiry.count({ where }), prisma.visaInquiry.findMany(args)]);
  }
}

function inquiryDetail(type: InquiryType, inquiry: Record<string, unknown> & { id: string; referenceNumber: string; status: string; createdAt: Date; updatedAt: Date }) {
  const summary = inquirySummary(type, inquiry);
  return { ...inquiry, type, summary: summary.summary, travelDate: summary.travelDate };
}

export async function getDashboard(userId: string) {
  const [flightCount, hotelCount, packageCount, visaCount, pendingFlights, pendingHotels, pendingPackages, pendingVisas, bookingCount, confirmedBookingCount, recentFlights, recentHotels, recentPackages, recentVisas] = await Promise.all([
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
    recent,
  };
}

export async function listInquiries(userId: string, input: { page: number; limit: number; type?: InquiryType; status?: string }) {
  const types: InquiryType[] = input.type ? [input.type] : ['flight', 'hotel', 'package', 'visa'];
  if (!input.type) {
    const records = await Promise.all(types.map(async (type) => {
      const items = await findInquiries(type, userId, input.status);
      return items.map((item) => inquirySummary(type, item));
    }));
    const all = records.flat().sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime());
    const start = (input.page - 1) * input.limit;
    return { inquiries: all.slice(start, start + input.limit), pagination: pageMeta(input.page, input.limit, all.length) };
  }

  const [total, records] = await findInquiryPage(input.type, userId, input.page, input.limit, input.status);
  return { inquiries: records.map((item) => inquirySummary(input.type!, item)), pagination: pageMeta(input.page, input.limit, total) };
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

export async function listBookings(userId: string, input: { page: number; limit: number }) {
  const where = { userId };
  const [total, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (input.page - 1) * input.limit, take: input.limit, select: { referenceNumber: true, bookingType: true, bookingModel: true, status: true, totalPrice: true, currency: true, bookingDetails: true, createdAt: true, updatedAt: true } }),
  ]);
  return { bookings, pagination: pageMeta(input.page, input.limit, total) };
}

export async function getBooking(userId: string, reference: string) {
  const booking = await prisma.booking.findFirst({
    where: { userId, referenceNumber: reference.toUpperCase() },
    include: { passengers: { select: { firstName: true, lastName: true, passengerType: true, nationality: true } }, statusHistory: { orderBy: { createdAt: 'asc' }, select: { fromStatus: true, toStatus: true, reason: true, createdAt: true } } },
  });
  if (!booking) throw AppError.notFound('Booking not found');
  return booking;
}

export async function updateProfile(userId: string, input: { name: string }) {
  return prisma.user.update({ where: { id: userId }, data: { name: input.name }, select: { id: true, email: true, name: true, role: true, emailVerified: true } });
}
