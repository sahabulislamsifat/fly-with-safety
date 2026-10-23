import { beforeEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';
import * as bookings from '../src/services/booking.service.js';
import { bookingDTO } from '../src/utils/booking-dto.js';
import { createBookingSchema, passengerSchema } from '../src/validators/booking.schemas.js';
import { serializeError } from '../src/lib/logger.js';
import { AppError } from '../src/utils/errors.js';

const sensitive = { passportNumber: 'SYNTHETIC-DOC-9912', dateOfBirth: '1981-02-03', passportExpiry: '2032-04-05' };
const fixture = () => ({ id: 'booking-1', referenceNumber: 'FWS-TEST123', bookingType: 'FLIGHT',
  bookingModel: 'AGENCY_INQUIRY', status: 'PENDING', customerName: 'Synthetic Customer',
  customerEmail: 'synthetic@example.test', customerPhone: '123456789', userId: 'owner',
  notes: 'Internal operations note', totalPrice: 100, currency: 'BDT', createdAt: new Date(), updatedAt: new Date(),
  bookingDetails: { offerId: 'offer-1', flightNumber: 'AB12', ...sensitive,
    nested: { document: sensitive.passportNumber }, paymentPolicy: sensitive.passportNumber,
    paymentStatus: 'AWAITING_PAYMENT_CONFIRMATION', sourceInquiryId: 'inquiry-1' },
  passengers: [{ id: 'passenger-1', firstName: 'Synthetic', lastName: 'Traveler', passengerType: 'adult', nationality: 'BD', ...sensitive }],
  statusHistory: [{ id: 'history-1', fromStatus: 'PENDING', toStatus: 'CONFIRMED', reason: 'Internal reason', changedBy: 'staff@example.test', createdAt: new Date() }],
});
const token = (role: string) => jwt.sign({ sub: 'owner', email: 'owner@example.test', role, sid: 'session' }, env.jwtSecret);
const payload = () => ({ customerName: 'Synthetic Customer', customerEmail: 'synthetic@example.test',
  passengers: [{ firstName: 'Synthetic', lastName: 'Traveler' }] });
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(prisma.session, 'findFirst').mockResolvedValue({ id: 'session' } as any);
});

it.each(['admin', 'customer', 'guest'] as const)('allowlists %s DTO including legacy JSON', audience => {
  const result = bookingDTO(fixture(), audience);
  const serialized = JSON.stringify(result);
  for (const secret of Object.values(sensitive)) expect(serialized).not.toContain(secret);
  expect(result.bookingDetails.offerId).toBe('offer-1');
  expect(result.bookingDetails.paymentStatus).toBe('AWAITING_PAYMENT_CONFIRMATION');
  expect(result.passengers[0].firstName).toBe('Synthetic');
  if (audience === 'admin') {
    expect(result.passengers[0].passportNumberMasked).toBe('••••9912');
    expect(result.notes).toBe('Internal operations note');
  } else {
    expect(result.notes).toBeUndefined();
    expect(result.statusHistory[0].reason).toBeUndefined();
    expect(result.bookingDetails.sourceInquiryId).toBeUndefined();
  }
});
it('never reveals an entire short document through its mask', () => {
  const b = fixture(); b.passengers[0].passportNumber = '123';
  expect(bookingDTO(b, 'admin').passengers[0].passportNumberMasked).toBe('••••');
});
it.each(['STAFF', 'ADMIN'])('minimizes %s list and mutation responses', async role => {
  vi.spyOn(bookings, 'adminGetBookings').mockResolvedValue({ bookings: [fixture()], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } } as any);
  vi.spyOn(bookings, 'updateBookingStatus').mockResolvedValue(fixture() as any);
  vi.spyOn(bookings, 'createBookingFromInquiry').mockResolvedValue(fixture() as any);
  const responses = [
    await request(app).get('/api/v1/admin/bookings').set('Authorization', `Bearer ${token(role)}`),
    await request(app).patch('/api/v1/admin/bookings/booking-1/status').set('Authorization', `Bearer ${token(role)}`).send({ status: 'CONFIRMED' }),
    await request(app).post('/api/v1/admin/bookings/from-inquiry').set('Authorization', `Bearer ${token(role)}`).send({ inquiryType: 'flights', inquiryId: 'inquiry-1', totalPrice: 100 }),
  ];
  for (const res of responses) {
    expect([200, 201]).toContain(res.status);
    expect(res.headers['cache-control']).toBe('no-store');
    for (const secret of Object.values(sensitive)) expect(JSON.stringify(res.body)).not.toContain(secret);
  }
});
it('rejects customer and anonymous access to admin bookings', async () => {
  expect((await request(app).get('/api/v1/admin/bookings')).status).toBe(401);
  expect((await request(app).get('/api/v1/admin/bookings').set('Authorization', `Bearer ${token('CUSTOMER')}`)).status).toBe(403);
});
it('minimizes guest lookup while preserving itinerary and payment readiness', async () => {
  vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(fixture() as any);
  const res = await request(app).post('/api/v1/bookings/lookup').send({ referenceNumber: 'FWS-TEST123', email: 'synthetic@example.test' });
  expect(res.status).toBe(200);
  expect(res.headers['cache-control']).toBe('no-store');
  expect(res.body.data.booking.customerEmail).toBe('••••');
  expect(res.body.data.booking.customerPhone).toBeUndefined();
  expect(res.body.data.booking.notes).toBeUndefined();
  for (const secret of Object.values(sensitive)) expect(JSON.stringify(res.body)).not.toContain(secret);
});
it('preserves customer ownership and sanitizes account booking detail', async () => {
  const read = vi.spyOn(prisma.booking, 'findFirst').mockResolvedValue(fixture() as any);
  const res = await request(app).get('/api/v1/account/bookings/FWS-TEST123').set('Authorization', `Bearer ${token('CUSTOMER')}`);
  expect(res.status).toBe(200);
  expect(read.mock.calls[0][0]?.where).toMatchObject({ userId: 'owner', referenceNumber: 'FWS-TEST123' });
  expect(res.headers['cache-control']).toBe('no-store');
  for (const secret of Object.values(sensitive)) expect(JSON.stringify(res.body)).not.toContain(secret);
});
it.each(['2025-02-29', '2026-04-31', '2026-13-01', '2026-00-10'])('rejects invalid calendar date %s', date => {
  expect(passengerSchema.safeParse({ firstName: 'Test', lastName: 'Traveler', dateOfBirth: date }).success).toBe(false);
});
it('accepts real leap dates and historical expiry for staff workflows', () => {
  expect(passengerSchema.safeParse({ firstName: 'Test', lastName: 'Traveler', dateOfBirth: '2000-02-29', passportExpiry: '2020-01-01' }).success).toBe(true);
});
it('bounds passengers and rejects nested, unknown and server-owned JSON fields', () => {
  expect(createBookingSchema.safeParse({ ...payload(), passengers: Array(51).fill(payload().passengers[0]) }).success).toBe(false);
  for (const bookingDetails of [{ passportNumber: sensitive.passportNumber }, { nested: { passportNumber: sensitive.passportNumber } }, { paymentStatus: 'PAYMENT_VERIFIED' }, { offerId: 'x'.repeat(129) }]) {
    expect(createBookingSchema.safeParse({ ...payload(), bookingDetails }).success).toBe(false);
  }
  expect(createBookingSchema.safeParse({ ...payload(), bookingDetails: { hotelId: 'hotel-1', checkIn: '2027-01-01', checkOut: '2027-01-02', guests: 2, rooms: 1 } }).success).toBe(true);
});
it('never includes error message, stack, or unknown thrown content in serialized errors', () => {
  const err = Object.assign(new Error(sensitive.passportNumber), { code: 'P2000' });
  expect(serializeError(err)).toEqual({ name: 'OperationError', code: 'P2000' });
  expect(JSON.stringify(serializeError(sensitive))).not.toContain(sensitive.passportNumber);
});
it('returns only the creation summary even when a service result contains documents', async () => {
  vi.spyOn(bookings, 'createBooking').mockResolvedValue(fixture() as any);
  const res = await request(app).post('/api/v1/bookings').send(payload());
  expect(res.status).toBe(201);
  expect(res.body.data.booking.passengerCount).toBe(1);
  expect(res.body.data.booking.passengers).toBeUndefined();
  expect(res.body.data.booking.bookingDetails).toBeUndefined();
});
it('sanitizes owned account list metadata without changing pagination', async () => {
  vi.spyOn(prisma.booking, 'count').mockResolvedValue(1);
  const read = vi.spyOn(prisma.booking, 'findMany').mockResolvedValue([fixture()] as any);
  const res = await request(app).get('/api/v1/account/bookings').set('Authorization', `Bearer ${token('CUSTOMER')}`);
  expect(res.status).toBe(200);
  expect(read.mock.calls[0][0]?.where).toMatchObject({ userId: 'owner' });
  expect(res.body.data.pagination.total).toBe(1);
  for (const secret of Object.values(sensitive)) expect(JSON.stringify(res.body)).not.toContain(secret);
});
it('does not echo unsupported sensitive JSON keys in validation errors', async () => {
  const res = await request(app).post('/api/v1/bookings').send({ ...payload(), bookingDetails: { [sensitive.passportNumber]: 'value' } });
  expect(res.status).toBe(422);
  expect(JSON.stringify(res.body)).not.toContain(sensitive.passportNumber);
});
it('hides operational server failure content from both HTTP and logs', async () => {
  vi.spyOn(bookings, 'lookupBooking').mockRejectedValue(AppError.internal(sensitive.passportNumber));
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const res = await request(app).post('/api/v1/bookings/lookup').send({ referenceNumber: 'FWS-TEST123', email: 'synthetic@example.test' });
  expect(res.status).toBe(500);
  expect(JSON.stringify(res.body)).not.toContain(sensitive.passportNumber);
  expect(JSON.stringify(log.mock.calls)).not.toContain(sensitive.passportNumber);
});
it('omits unused document columns from the admin list database projection', async () => {
  vi.spyOn(prisma.booking, 'count').mockResolvedValue(1);
  const read = vi.spyOn(prisma.booking, 'findMany').mockResolvedValue([fixture()] as any);
  await bookings.adminGetBookings({});
  expect((read.mock.calls[0][0]?.include?.passengers as any).select).not.toHaveProperty('dateOfBirth');
  expect((read.mock.calls[0][0]?.include?.passengers as any).select).not.toHaveProperty('passportExpiry');
});
