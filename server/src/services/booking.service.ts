import { prisma } from '../lib/prisma.js';
import { generateReferenceNumber, normalizeEmail, normalizePhone } from '../utils/helpers.js';
import { sendBookingConfirmation, sendBookingStatusNotification } from './notification.service.js';
import { canTransitionStatus } from '../utils/status-transitions.js';
import { AppError } from '../utils/errors.js';
import type { CreateBookingInput, LookupBookingInput } from '../validators/booking.schemas.js';

export async function createBooking(input: CreateBookingInput, userId?: string) {
  const referenceNumber = generateReferenceNumber();
  const normalizedEmail = normalizeEmail(input.customerEmail);

  const booking = await prisma.booking.create({
    data: {
      referenceNumber,
      userId: userId || null,
      bookingType: input.bookingType,
      bookingModel: input.bookingModel,
      status: 'PENDING',
      customerName: input.customerName.trim(),
      customerEmail: normalizedEmail,
      customerPhone: input.customerPhone ? normalizePhone(input.customerPhone) : null,
      totalPrice: input.totalPrice,
      currency: input.currency || 'BDT',
      bookingDetails: input.bookingDetails || {},
      notes: input.notes || null,
      passengers: {
        create: input.passengers.map((p) => ({
          firstName: p.firstName.trim(),
          lastName: p.lastName.trim(),
          passengerType: p.passengerType,
          gender: p.gender || null,
          dateOfBirth: p.dateOfBirth || null,
          passportNumber: p.passportNumber || null,
          passportExpiry: p.passportExpiry || null,
          nationality: p.nationality || null,
        })),
      },
      statusHistory: {
        create: {
          fromStatus: 'PENDING',
          toStatus: 'PENDING',
          reason: 'Initial booking submission',
          changedBy: 'CUSTOMER',
        },
      },
    },
    include: {
      passengers: true,
      statusHistory: true,
    },
  });

  // Asynchronous confirmation email
  sendBookingConfirmation({
    to: normalizedEmail,
    name: input.customerName.trim(),
    referenceNumber,
    bookingType: input.bookingType,
    totalPrice: input.totalPrice,
    currency: input.currency || 'BDT',
  }).catch((err) => console.error('[Booking] Email error:', err));

  return booking;
}

export async function lookupBooking(input: LookupBookingInput) {
  const normalizedEmail = normalizeEmail(input.email);
  const ref = input.referenceNumber.trim().toUpperCase();

  const booking = await prisma.booking.findUnique({
    where: { referenceNumber: ref },
    include: {
      passengers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          passengerType: true,
          gender: true,
          nationality: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          reason: true,
          createdAt: true,
        },
      },
    },
  });

  if (!booking || normalizeEmail(booking.customerEmail) !== normalizedEmail) {
    throw new AppError('No booking found matching the provided reference and email', 404, 'BOOKING_NOT_FOUND');
  }

  return booking;
}

export async function updateBookingStatus(
  id: string,
  newStatus: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED',
  reason?: string,
  changedBy?: string
) {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    throw AppError.notFound('Booking not found');
  }

  if (booking.status === newStatus) {
    return booking;
  }

  if (!canTransitionStatus('inquiry', booking.status, newStatus)) {
    throw new AppError(
      `Cannot transition booking from ${booking.status} to ${newStatus}`,
      400,
      'INVALID_STATUS_TRANSITION'
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.update({
      where: { id },
      data: { status: newStatus },
      include: {
        passengers: true,
        statusHistory: true,
      },
    });

    await tx.bookingStatusHistory.create({
      data: {
        bookingId: id,
        fromStatus: booking.status,
        toStatus: newStatus,
        reason: reason || `Status updated to ${newStatus}`,
        changedBy: changedBy || 'STAFF',
      },
    });

    return b;
  });

  sendBookingStatusNotification({
    to: booking.customerEmail,
    name: booking.customerName,
    referenceNumber: booking.referenceNumber,
    status: newStatus,
    reason,
  }).catch((err) => console.error('[Booking] Status notification error:', err));

  return updated;
}

export async function adminGetBookings(params: {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, any> = {};
  if (params.status) where.status = params.status;
  if (params.type) where.bookingType = params.type;

  const [total, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        passengers: true,
        statusHistory: true,
      },
    }),
  ]);

  return { bookings, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
