import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';

describe('Phase 6: Booking Lifecycle & Processing Tests', () => {
  const createToken = (role: 'CUSTOMER' | 'STAFF' | 'ADMIN', userId = 'test-user-id') => {
    return jwt.sign(
      { sub: userId, email: `${role.toLowerCase()}@flywithsafe.test`, role, sid: 'mock-session-id' },
      env.jwtSecret,
      { expiresIn: '1h' }
    );
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prisma.session, 'findFirst').mockResolvedValue({ id: 'mock-session-id' } as any);
  });

  // ─── 1. Authorization Controls for Inquiry-to-Booking Conversion ────────────
  describe('Inquiry-to-Booking Authorization Enforcement', () => {
    it('rejects unauthenticated requests with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/v1/admin/bookings/from-inquiry')
        .send({
          inquiryType: 'flights',
          inquiryId: 'flight-inq-1',
          totalPrice: 45000,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('blocks CUSTOMER user from generating a booking with HTTP 403', async () => {
      const token = createToken('CUSTOMER');
      const res = await request(app)
        .post('/api/v1/admin/bookings/from-inquiry')
        .set('Authorization', `Bearer ${token}`)
        .send({
          inquiryType: 'flights',
          inquiryId: 'flight-inq-1',
          totalPrice: 45000,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  // ─── 2. Validation & Semantic Boundaries ────────────────────────────────────
  describe('Input & Eligibility Validation for Booking Conversion', () => {
    it('rejects unsupported inquiry types such as visa with HTTP 422', async () => {
      const token = createToken('STAFF');
      const res = await request(app)
        .post('/api/v1/admin/bookings/from-inquiry')
        .set('Authorization', `Bearer ${token}`)
        .send({
          inquiryType: 'visa',
          inquiryId: 'visa-inq-1',
          totalPrice: 15000,
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects negative price values with HTTP 422', async () => {
      const token = createToken('STAFF');
      const res = await request(app)
        .post('/api/v1/admin/bookings/from-inquiry')
        .set('Authorization', `Bearer ${token}`)
        .send({
          inquiryType: 'flights',
          inquiryId: 'flight-inq-1',
          totalPrice: -100,
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when the source inquiry does not exist', async () => {
      vi.spyOn(prisma.flightInquiry, 'findUnique').mockResolvedValue(null);

      const token = createToken('STAFF');
      const res = await request(app)
        .post('/api/v1/admin/bookings/from-inquiry')
        .set('Authorization', `Bearer ${token}`)
        .send({
          inquiryType: 'flights',
          inquiryId: 'non-existent-flight-inq',
          totalPrice: 50000,
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });

    it('rejects conversion from a CANCELLED inquiry with HTTP 422', async () => {
      vi.spyOn(prisma.flightInquiry, 'findUnique').mockResolvedValue({
        id: 'cancelled-inq-id',
        referenceNumber: 'FWS-FLT-CANCELLED',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+8801700000000',
        notes: null,
        status: 'CANCELLED',
        fromAirport: 'DAC',
        toAirport: 'BKK',
        departureDate: '2026-12-01',
        createdAt: new Date(),
      } as any);

      const token = createToken('STAFF');
      const res = await request(app)
        .post('/api/v1/admin/bookings/from-inquiry')
        .set('Authorization', `Bearer ${token}`)
        .send({
          inquiryType: 'flights',
          inquiryId: 'cancelled-inq-id',
          totalPrice: 50000,
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INQUIRY_CANCELLED');
    });
  });

  // ─── 3. Truthful Booking Generation & Duplicate Prevention ─────────────────
  describe('Successful Conversion & Duplicate Prevention', () => {
    const mockFlightInquiry = {
      id: 'flight-inq-123',
      referenceNumber: 'FWS-FLT-123',
      userId: 'customer-usr-1',
      name: 'Rahim Ahmed',
      email: 'rahim@example.com',
      phone: '+8801711111111',
      notes: 'Need window seat',
      status: 'PENDING',
      fromAirport: 'DAC',
      toAirport: 'DXB',
      departureDate: '2026-11-20',
      createdAt: new Date('2026-10-01'),
    };

    it('creates an official booking from eligible flight inquiry', async () => {
      vi.spyOn(prisma.flightInquiry, 'findUnique').mockResolvedValue(mockFlightInquiry as any);
      vi.spyOn(prisma.booking, 'findMany').mockResolvedValue([]); // No existing booking

      const createdBookingRecord = {
        id: 'new-booking-id',
        referenceNumber: 'FWS-2026-BK1234',
        userId: 'customer-usr-1',
        bookingType: 'FLIGHT',
        bookingModel: 'AGENCY_INQUIRY',
        status: 'PENDING',
        customerName: 'Rahim Ahmed',
        customerEmail: 'rahim@example.com',
        customerPhone: '+8801711111111',
        totalPrice: 62000,
        currency: 'BDT',
        bookingDetails: {
          sourceInquiryId: 'flight-inq-123',
          sourceInquiryReference: 'FWS-FLT-123',
          sourceInquiryType: 'FLIGHTS',
          paymentStatus: 'AWAITING_PAYMENT_INSTRUCTIONS',
        },
        passengers: [
          {
            id: 'pass-1',
            firstName: 'Rahim',
            lastName: 'Ahmed',
            passengerType: 'adult',
          },
        ],
        statusHistory: [
          {
            id: 'sh-1',
            fromStatus: 'PENDING',
            toStatus: 'PENDING',
            reason: 'Generated from flights inquiry FWS-FLT-123',
            changedBy: 'staff@flywithsafe.test',
          },
        ],
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        const tx = {
          booking: {
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn().mockResolvedValue(createdBookingRecord),
          },
          flightInquiry: {
            update: vi.fn().mockResolvedValue({ ...mockFlightInquiry, status: 'CONFIRMED' }),
          },
        };
        return cb(tx);
      });

      const token = createToken('STAFF');
      const res = await request(app)
        .post('/api/v1/admin/bookings/from-inquiry')
        .set('Authorization', `Bearer ${token}`)
        .send({
          inquiryType: 'flights',
          inquiryId: 'flight-inq-123',
          totalPrice: 62000,
          currency: 'BDT',
          notes: 'Agent confirmed seat quote',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.booking.referenceNumber).toBe('FWS-2026-BK1234');
      expect(res.body.data.booking.status).toBe('PENDING');
      expect(res.body.data.booking.bookingDetails.paymentStatus).toBe('AWAITING_PAYMENT_INSTRUCTIONS');
    });

    it('rejects duplicate booking creation for the same inquiry with HTTP 409', async () => {
      vi.spyOn(prisma.flightInquiry, 'findUnique').mockResolvedValue(mockFlightInquiry as any);
      vi.spyOn(prisma.booking, 'findMany').mockResolvedValue([
        {
          id: 'existing-booking-id',
          referenceNumber: 'FWS-2026-EXISTING',
          bookingDetails: {
            sourceInquiryId: 'flight-inq-123',
          },
        } as any,
      ]);

      const token = createToken('STAFF');
      const res = await request(app)
        .post('/api/v1/admin/bookings/from-inquiry')
        .set('Authorization', `Bearer ${token}`)
        .send({
          inquiryType: 'flights',
          inquiryId: 'flight-inq-123',
          totalPrice: 62000,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('BOOKING_ALREADY_EXISTS');
    });
  });

  // ─── 4. Concurrency Safety & Lifecycle Status Transitions ─────────────────
  describe('Booking Lifecycle Processing & Concurrency Safety', () => {
    it('allows valid staff transition from PENDING to CONFIRMED', async () => {
      const pendingBooking = {
        id: 'booking-1',
        referenceNumber: 'FWS-2026-B1',
        status: 'PENDING',
        customerEmail: 'customer@test.com',
        customerName: 'Customer Test',
        bookingDetails: { paymentStatus: 'AWAITING_PAYMENT_INSTRUCTIONS' },
        passengers: [],
        statusHistory: [],
      };

      const updatedBooking = {
        ...pendingBooking,
        status: 'CONFIRMED',
        bookingDetails: { paymentStatus: 'AWAITING_PAYMENT_CONFIRMATION' },
        statusHistory: [
          {
            id: 'sh-2',
            fromStatus: 'PENDING',
            toStatus: 'CONFIRMED',
            reason: 'Payment wire verified',
            changedBy: 'staff@flywithsafe.test',
          },
        ],
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        const tx = {
          booking: {
            findUnique: vi.fn().mockResolvedValue(pendingBooking),
            update: vi.fn().mockResolvedValue(updatedBooking),
          },
          bookingStatusHistory: {
            create: vi.fn().mockResolvedValue({ id: 'sh-2' }),
          },
        };
        return cb(tx);
      });
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(updatedBooking as any);

      const token = createToken('STAFF');
      const res = await request(app)
        .patch('/api/v1/admin/bookings/booking-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'CONFIRMED',
          reason: 'Payment wire verified',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.booking.status).toBe('CONFIRMED');
    });

    it('rejects illegal status transition from CANCELLED to CONFIRMED with HTTP 400', async () => {
      const cancelledBooking = {
        id: 'booking-cancelled',
        referenceNumber: 'FWS-2026-BCAN',
        status: 'CANCELLED',
        customerEmail: 'customer@test.com',
        customerName: 'Customer Test',
        passengers: [],
        statusHistory: [],
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        const tx = {
          booking: {
            findUnique: vi.fn().mockResolvedValue(cancelledBooking),
          },
        };
        return cb(tx);
      });

      const token = createToken('STAFF');
      const res = await request(app)
        .patch('/api/v1/admin/bookings/booking-cancelled/status')
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'CONFIRMED',
          reason: 'Attempted reactivation',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  // ─── 5. Customer Booking Lookup Privacy & Payment Readiness ───────────────
  describe('Customer Booking Lookup & Privacy Protection', () => {
    const publicBooking = {
      id: 'booking-pub-1',
      referenceNumber: 'FWS-2026-LOOKUP1',
      bookingType: 'FLIGHT',
      bookingModel: 'AGENCY_INQUIRY',
      status: 'PENDING',
      customerName: 'Fatima Begum',
      customerEmail: 'fatima@example.com',
      customerPhone: '+8801811111111',
      totalPrice: 48000,
      currency: 'BDT',
      bookingDetails: {
        paymentStatus: 'AWAITING_PAYMENT_INSTRUCTIONS',
        paymentPolicy:
          'Manual agency booking. No immediate card charge. Payment instructions (Bank Wire / bKash / Nagad) are provided by the operations team.',
      },
      notes: null,
      createdAt: new Date('2026-10-05'),
      updatedAt: new Date('2026-10-05'),
      passengers: [
        {
          id: 'p-1',
          firstName: 'Fatima',
          lastName: 'Begum',
          passengerType: 'adult',
          gender: 'female',
          nationality: 'Bangladeshi',
        },
      ],
      statusHistory: [
        {
          id: 'sh-1',
          fromStatus: 'PENDING',
          toStatus: 'PENDING',
          reason: 'Initial booking submission',
          createdAt: new Date('2026-10-05'),
        },
      ],
    };

    it('returns truthful booking details when reference and email match', async () => {
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(publicBooking as any);

      const res = await request(app)
        .post('/api/v1/bookings/lookup')
        .send({
          referenceNumber: 'FWS-2026-LOOKUP1',
          email: 'fatima@example.com',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.booking.referenceNumber).toBe('FWS-2026-LOOKUP1');
      expect(res.body.data.booking.bookingDetails.paymentStatus).toBe('AWAITING_PAYMENT_INSTRUCTIONS');
      expect(res.body.data.booking.bookingDetails.paymentPolicy).toContain('No immediate card charge');
    });

    it('returns 404 when email does not match to prevent reference enumeration', async () => {
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(publicBooking as any);

      const res = await request(app)
        .post('/api/v1/bookings/lookup')
        .send({
          referenceNumber: 'FWS-2026-LOOKUP1',
          email: 'wrong-attacker@example.com',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('BOOKING_NOT_FOUND');
    });
  });

  // ─── 6. Semantic Independence of Inquiries and Bookings ───────────────────
  describe('Separation of Inquiry and Booking Creation', () => {
    it('confirms that normal customer inquiry submissions do not create bookings', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          flightInquiry: {
            create: vi.fn().mockResolvedValue({
              id: 'new-inq-1',
              referenceNumber: 'FWS-FLT-NEW',
              status: 'PENDING',
            }),
          },
          idempotencyRecord: {
            create: vi.fn().mockResolvedValue({ id: 'rec-1' }),
          },
        });
      });

      const bookingCreateSpy = vi.spyOn(prisma.booking, 'create');

      const res = await request(app)
        .post('/api/v1/flights/inquiries')
        .set('Idempotency-Key', `test-key-separate-inquiry-${Date.now()}`)
        .send({
          tripType: 'oneWay',
          from: 'DAC',
          to: 'KUL',
          departureDate: '2026-12-15',
          adults: 1,
          name: 'Independent Traveler',
          email: 'traveler@example.com',
          phone: '+8801700000000',
        });

      expect(res.status).toBe(201);
      expect(bookingCreateSpy).not.toHaveBeenCalled();
    });
  });
});
