import { Prisma } from '../generated/prisma/client.js';
import { createIdempotentInquiry } from './idempotency.service.js';
import { prisma } from '../lib/prisma.js';
import { generateReferenceNumber, normalizeEmail, normalizePhone } from '../utils/helpers.js';
import { sendBookingConfirmation, sendBookingStatusNotification } from './notification.service.js';
import { canTransitionStatus } from '../utils/status-transitions.js';
import { AppError } from '../utils/errors.js';
import type {
  CreateBookingInput,
  LookupBookingInput,
  CreateBookingFromInquiryInput,
} from '../validators/booking.schemas.js';
import { logger, serializeError } from '../lib/logger.js';

export async function createBooking(input: CreateBookingInput, userId?: string, headerIdempotencyKey?: string) {
  const idempotencyKey = input.idempotencyKey || headerIdempotencyKey;
  const normalizedEmail = normalizeEmail(input.customerEmail);
  const { idempotencyKey: _key, ...payload } = input;

  const referenceNumber = generateReferenceNumber();

  const create = (db: Prisma.TransactionClient) => db.booking.create({
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

  // Commit booking and unique operation/principal/key record together. Fail closed on storage errors.
  const result = idempotencyKey
    ? await createIdempotentInquiry({
        operation: 'booking:create', key: idempotencyKey, userId,
        email: normalizedEmail, payload, create,
        findByReference: (referenceNumber) => prisma.booking.findFirst({
          where: { referenceNumber, userId: userId || null,
            ...(!userId ? { customerEmail: normalizedEmail } : {}) },
          include: { passengers: true, statusHistory: true },
        }),
      })
    : { inquiry: await create(prisma), replayed: false };
  const booking = result.inquiry;
  if (result.replayed) return booking;

  // Asynchronous confirmation email
  sendBookingConfirmation({
    to: normalizedEmail,
    name: input.customerName.trim(),
    referenceNumber,
    bookingType: input.bookingType,
    totalPrice: input.totalPrice,
    currency: input.currency || 'BDT',
  }).catch((err) => logger.warn('booking_email_failed', serializeError(err)));

  return booking;
}

export async function createBookingFromInquiry(
  input: CreateBookingFromInquiryInput,
  staffIdentifier: string
) {
  let inquiry: {
    id: string;
    referenceNumber: string;
    userId: string | null;
    name: string;
    email: string;
    phone: string | null;
    notes: string | null;
    status: string;
    [key: string]: any;
  } | null = null;

  if (input.inquiryType === 'flights') {
    inquiry = await prisma.flightInquiry.findUnique({ where: { id: input.inquiryId } });
  } else if (input.inquiryType === 'hotels') {
    inquiry = await prisma.hotelInquiry.findUnique({ where: { id: input.inquiryId } });
  } else if (input.inquiryType === 'packages') {
    inquiry = await prisma.packageInquiry.findUnique({ where: { id: input.inquiryId } });
  } else {
    throw AppError.badRequest(`Unsupported inquiry type for booking conversion: ${input.inquiryType}`);
  }

  if (!inquiry) {
    throw AppError.notFound(`Source ${input.inquiryType} inquiry not found`);
  }

  if (inquiry.status === 'CANCELLED') {
    throw new AppError(
      'Cannot create a booking from a cancelled inquiry',
      422,
      'INQUIRY_CANCELLED'
    );
  }

  const normalizedEmail = normalizeEmail(inquiry.email);

  // Check duplicate booking conversion for this inquiry
  const existingBookings = await prisma.booking.findMany({
    where: { customerEmail: normalizedEmail },
    select: { id: true, referenceNumber: true, bookingDetails: true },
  });

  const duplicate = existingBookings.find((b) => {
    const details = b.bookingDetails as Record<string, any> | null;
    return details?.sourceInquiryId === inquiry.id;
  });

  if (duplicate) {
    throw new AppError(
      `A booking (${duplicate.referenceNumber}) has already been generated for this inquiry`,
      409,
      'BOOKING_ALREADY_EXISTS'
    );
  }

  const bookingTypeMap: Record<string, 'FLIGHT' | 'HOTEL' | 'PACKAGE'> = {
    flights: 'FLIGHT',
    hotels: 'HOTEL',
    packages: 'PACKAGE',
  };
  const bookingType = bookingTypeMap[input.inquiryType] || 'FLIGHT';

  // Build passenger manifest
  let passengerData: Array<{
    firstName: string;
    lastName: string;
    passengerType: string;
    gender?: string | null;
    dateOfBirth?: string | null;
    passportNumber?: string | null;
    passportExpiry?: string | null;
    nationality?: string | null;
  }> = [];

  if (input.passengers && input.passengers.length > 0) {
    passengerData = input.passengers.map((p) => ({
      firstName: p.firstName.trim(),
      lastName: p.lastName.trim(),
      passengerType: p.passengerType,
      gender: p.gender || null,
      dateOfBirth: p.dateOfBirth || null,
      passportNumber: p.passportNumber || null,
      passportExpiry: p.passportExpiry || null,
      nationality: p.nationality || null,
    }));
  } else {
    const parts = inquiry.name.trim().split(/\s+/);
    const firstName = parts[0] || 'Guest';
    const lastName = parts.slice(1).join(' ') || 'Passenger';
    passengerData = [
      {
        firstName,
        lastName,
        passengerType: 'adult',
      },
    ];
  }

  const referenceNumber = generateReferenceNumber();

  const bookingDetails = {
    sourceInquiryId: inquiry.id,
    sourceInquiryReference: inquiry.referenceNumber,
    sourceInquiryType: input.inquiryType.toUpperCase(),
    paymentStatus: input.paymentStatus || 'AWAITING_PAYMENT_INSTRUCTIONS',
    paymentPolicy:
      'Manual agency booking. No immediate card charge. Payment instructions (Bank Wire / bKash / Nagad) are provided by the operations team.',
    paymentMethod: 'OFFLINE_AGENCY_SETTLEMENT',
    inquirySnapshot: {
      referenceNumber: inquiry.referenceNumber,
      createdAt: inquiry.createdAt,
      details: {
        fromAirport: inquiry.fromAirport,
        toAirport: inquiry.toAirport,
        destination: inquiry.destination,
        packageTitle: inquiry.packageTitle,
        departureDate: inquiry.departureDate,
        returnDate: inquiry.returnDate,
        checkIn: inquiry.checkIn,
        checkOut: inquiry.checkOut,
        travelDate: inquiry.travelDate,
      },
    },
  };

  const booking = await prisma.$transaction(async (tx) => {
    // Concurrency double-check inside tx
    const currentMatches = await tx.booking.findMany({
      where: { customerEmail: normalizedEmail },
      select: { id: true, referenceNumber: true, bookingDetails: true },
    });
    if (currentMatches.some((b) => (b.bookingDetails as any)?.sourceInquiryId === inquiry.id)) {
      throw new AppError(
        'A booking has already been generated for this inquiry',
        409,
        'BOOKING_ALREADY_EXISTS'
      );
    }

    const b = await tx.booking.create({
      data: {
        referenceNumber,
        userId: inquiry.userId || null,
        bookingType,
        bookingModel: 'AGENCY_INQUIRY',
        status: 'PENDING',
        customerName: inquiry.name.trim(),
        customerEmail: normalizedEmail,
        customerPhone: inquiry.phone ? normalizePhone(inquiry.phone) : null,
        totalPrice: input.totalPrice,
        currency: input.currency || 'BDT',
        bookingDetails,
        notes: input.notes?.trim() || inquiry.notes || null,
        passengers: {
          create: passengerData,
        },
        statusHistory: {
          create: {
            fromStatus: 'PENDING',
            toStatus: 'PENDING',
            reason: `Generated from ${input.inquiryType} inquiry ${inquiry.referenceNumber}`,
            changedBy: staffIdentifier,
          },
        },
      },
      include: {
        passengers: true,
        statusHistory: true,
      },
    });

    // Mark source inquiry as CONFIRMED if currently PENDING
    if (inquiry.status === 'PENDING') {
      if (input.inquiryType === 'flights') {
        await tx.flightInquiry.update({
          where: { id: inquiry.id },
          data: { status: 'CONFIRMED' },
        });
      } else if (input.inquiryType === 'hotels') {
        await tx.hotelInquiry.update({
          where: { id: inquiry.id },
          data: { status: 'CONFIRMED' },
        });
      } else if (input.inquiryType === 'packages') {
        await tx.packageInquiry.update({
          where: { id: inquiry.id },
          data: { status: 'CONFIRMED' },
        });
      }
    }

    return b;
  });

  sendBookingConfirmation({
    to: normalizedEmail,
    name: inquiry.name.trim(),
    referenceNumber,
    bookingType,
    totalPrice: input.totalPrice,
    currency: input.currency || 'BDT',
  }).catch((err) => logger.warn('booking_from_inquiry_email_failed', serializeError(err)));

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

  // Enrich truthful payment status info
  const details = (booking.bookingDetails as Record<string, any>) || {};
  const paymentStatus =
    details.paymentStatus ||
    (booking.status === 'CONFIRMED'
      ? 'AWAITING_PAYMENT_CONFIRMATION'
      : booking.status === 'CANCELLED'
      ? 'CANCELLED'
      : 'AWAITING_PAYMENT_INSTRUCTIONS');

  const enrichedDetails = {
    ...details,
    paymentStatus,
    paymentPolicy:
      details.paymentPolicy ||
      'Manual agency booking. No immediate card charge. Payment instructions (Bank Wire / bKash / Nagad) are provided by the operations team.',
    supportContact: 'support@flywithsafe.com',
  };

  return {
    id: booking.id,
    referenceNumber: booking.referenceNumber,
    bookingType: booking.bookingType,
    bookingModel: booking.bookingModel,
    status: booking.status,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    totalPrice: booking.totalPrice,
    currency: booking.currency,
    bookingDetails: enrichedDetails,
    notes: booking.notes,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    passengers: booking.passengers,
    statusHistory: booking.statusHistory,
  };
}

export async function updateBookingStatus(
  id: string,
  newStatus: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED',
  reason?: string,
  changedBy?: string,
  expected?: { status?: string; updatedAt?: string }
) {
  let customerToNotify: { email: string; name: string; ref: string } | null = null;

  const updatedBooking = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM public."Booking" WHERE id = ${id} FOR UPDATE`);
    const booking = await tx.booking.findUnique({
      where: { id },
      include: {
        passengers: true,
        statusHistory: true,
      },
    });

    if (!booking) {
      throw AppError.notFound('Booking not found');
    }

    if (booking.status === newStatus) {
      return booking;
    }

    if ((expected?.status && expected.status !== booking.status) ||
      (expected?.updatedAt && +new Date(expected.updatedAt) !== +booking.updatedAt)) {
      throw AppError.conflict('Booking changed; refresh before updating status');
    }

    if (!canTransitionStatus('booking', booking.status, newStatus)) {
      throw new AppError(
        `Cannot transition booking from ${booking.status} to ${newStatus}`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    let details = (booking.bookingDetails as Record<string, any>) || {};
    if (newStatus === 'CONFIRMED' && (!details.paymentStatus || details.paymentStatus === 'AWAITING_PAYMENT_INSTRUCTIONS')) {
      details = { ...details, paymentStatus: 'AWAITING_PAYMENT_CONFIRMATION' };
    } else if (newStatus === 'CANCELLED') {
      details = { ...details, paymentStatus: 'CANCELLED' };
    }

    const b = await tx.booking.update({
      where: { id },
      data: {
        status: newStatus,
        bookingDetails: details,
      },
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

    customerToNotify = {
      email: booking.customerEmail,
      name: booking.customerName,
      ref: booking.referenceNumber,
    };

    return b;
  });

  if (customerToNotify) {
    const { email, name, ref } = customerToNotify;
    sendBookingStatusNotification({
      to: email,
      name,
      referenceNumber: ref,
      status: newStatus,
      reason,
    }).catch((err) => logger.warn('booking_status_notification_failed', serializeError(err)));
  }

  return await prisma.booking.findUnique({
    where: { id },
    include: {
      passengers: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  });
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
        passengers: { select: { id: true, firstName: true, lastName: true, passengerType: true, nationality: true, passportNumber: true } },
        statusHistory: true,
      },
    }),
  ]);

  return { bookings, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
