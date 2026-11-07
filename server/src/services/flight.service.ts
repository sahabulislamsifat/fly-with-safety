import { logger, serializeError } from '../lib/logger.js';
import { flightAggregator } from './flight-aggregator.service.js';
import { prisma } from '../lib/prisma.js';
import { generateReferenceNumber, normalizeEmail, normalizePhone } from '../utils/helpers.js';
import { sendInquiryConfirmation } from './notification.service.js';
import type { FlightSearchInput, FlightInquiryInput } from '../validators/flight.schemas.js';
import { transitionInquiryStatus } from './inquiry-status.service.js';
import { createIdempotentInquiry } from './idempotency.service.js';
import { assignedIds } from '../identity/store.js';

export async function searchFlights(input: FlightSearchInput) {
  const aggregated = await flightAggregator.aggregate({
    tripType: input.tripType,
    from: input.from,
    to: input.to,
    departureDate: input.departureDate,
    returnDate: input.returnDate || undefined,
    adults: input.adults,
    children: input.children,
    infants: input.infants,
    passengers: input.passengers,
    cabinClass: input.cabinClass,
  });

  return {
    results: aggregated.offers,
    offers: aggregated.offers,
    stats: aggregated.stats,
    totalCount: aggregated.totalCount,
    provider: aggregated.providers.join(', '),
    isLiveData: !aggregated.isDemoData,
    isDemoData: aggregated.isDemoData,
    searchParams: input,
  };
}

export async function submitFlightInquiry(input: FlightInquiryInput, userId: string | undefined, idempotencyKey: string) {
  const referenceNumber = generateReferenceNumber();
  const result = await createIdempotentInquiry({
    operation: 'flight-inquiry', key: idempotencyKey, userId, email: input.email, payload: input,
    create: (tx) => tx.flightInquiry.create({ data: {
      referenceNumber,
      userId: userId || null,
      fromAirport: input.from.toUpperCase(),
      toAirport: input.to.toUpperCase(),
      departureDate: input.departureDate,
      returnDate: input.returnDate || null,
      passengers: input.passengers || 1,
      cabinClass: input.cabinClass,
      name: input.name.trim(),
      email: normalizeEmail(input.email),
      phone: input.phone ? normalizePhone(input.phone) : null,
      notes: input.notes || null,
      status: 'PENDING',
    }, select: {
      id: true,
      referenceNumber: true,
      fromAirport: true,
      toAirport: true,
      departureDate: true,
      status: true,
      createdAt: true,
    } }),
    findByReference: (reference) => prisma.flightInquiry.findUnique({ where: { referenceNumber: reference } }),
  });
  if (!result.replayed) sendInquiryConfirmation({
    to: normalizeEmail(input.email),
    name: input.name.trim(),
    referenceNumber,
    type: 'flight',
  }).catch((err) => logger.warn('inquiry_email_failed', serializeError(err)));
  return result;
}

export async function getFlightInquiries(params: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;
  const ids = await assignedIds('flightInquiry');
  const where = { ...(params.status ? { status: params.status as any } : {}), ...(ids ? { id: { in: ids } } : {}) };

  const [total, inquiries] = await Promise.all([
    prisma.flightInquiry.count({ where }),
    prisma.flightInquiry.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    }),
  ]);

  return { inquiries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function updateFlightInquiryStatus(id: string, status: string) {
  return transitionInquiryStatus('flightInquiry', id, status);
}
