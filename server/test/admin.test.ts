import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';
import {
  assertInquiryTransition,
  assertBookingTransition,
  assertContactTransition,
  canTransitionStatus,
} from '../src/utils/status-transitions.js';

describe('Admin & Staff Operations API Tests', () => {
  const createTestToken = (role: 'CUSTOMER' | 'STAFF' | 'ADMIN', userId = 'test-user-id') => {
    return jwt.sign(
      { sub: userId, email: `${role.toLowerCase()}@flywithsafe.test`, role, sid: 'mock-session-id' },
      env.jwtSecret,
      { expiresIn: '1h' }
    );
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. Authentication & Route Guards ─────────────────────────────────────
  describe('Unauthenticated Admin Route Rejection (HTTP 401)', () => {
    it('rejects unauthenticated GET /admin/inquiries/flights', async () => {
      const res = await request(app).get('/api/v1/admin/inquiries/flights');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects unauthenticated GET /admin/bookings', async () => {
      const res = await request(app).get('/api/v1/admin/bookings');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects unauthenticated GET /admin/contact', async () => {
      const res = await request(app).get('/api/v1/admin/contact');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects unauthenticated GET /admin/testimonials', async () => {
      const res = await request(app).get('/api/v1/admin/testimonials');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects unauthenticated PATCH /admin/inquiries/flights/:id/status', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/inquiries/flights/test-id/status')
        .send({ status: 'CONFIRMED' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects unauthenticated GET /admin/outbox', async () => {
      const res = await request(app).get('/api/v1/admin/outbox');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects unauthenticated POST /admin/outbox/:id/redrive', async () => {
      const res = await request(app).post('/api/v1/admin/outbox/test-id/redrive');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  // ─── 2. Role-Based Authorization Enforcement ──────────────────────────────
  describe('Customer Role Authorization Rejection (HTTP 403)', () => {
    beforeEach(() => {
      vi.spyOn(prisma.session, 'findFirst').mockResolvedValue({ id: 'mock-session-id' } as any);
    });

    it('blocks CUSTOMER user from accessing admin flight inquiries', async () => {
      const token = createTestToken('CUSTOMER');
      const res = await request(app)
        .get('/api/v1/admin/inquiries/flights')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('blocks CUSTOMER user from accessing admin bookings', async () => {
      const token = createTestToken('CUSTOMER');
      const res = await request(app)
        .get('/api/v1/admin/bookings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('blocks CUSTOMER user from updating contact message status', async () => {
      const token = createTestToken('CUSTOMER');
      const res = await request(app)
        .patch('/api/v1/admin/contact/test-msg-id/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('blocks CUSTOMER user from accessing testimonials moderation', async () => {
      const token = createTestToken('CUSTOMER');
      const res = await request(app)
        .get('/api/v1/admin/testimonials')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('blocks CUSTOMER user from accessing notification outbox telemetry', async () => {
      const token = createTestToken('CUSTOMER');
      const res = await request(app)
        .get('/api/v1/admin/outbox')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('blocks CUSTOMER user from triggering outbox redrive', async () => {
      const token = createTestToken('CUSTOMER');
      const res = await request(app)
        .post('/api/v1/admin/outbox/test-id/redrive')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  // ─── 3. Authorized Staff & Admin Access ───────────────────────────────────
  describe('Authorized Staff & Admin Access (HTTP 200)', () => {
    beforeEach(() => {
      vi.spyOn(prisma.session, 'findFirst').mockResolvedValue({ id: 'mock-session-id' } as any);
    });

    it('permits STAFF user to list flight inquiries', async () => {
      vi.spyOn(prisma.flightInquiry, 'count').mockResolvedValue(0);
      vi.spyOn(prisma.flightInquiry, 'findMany').mockResolvedValue([]);

      const token = createTestToken('STAFF');
      const res = await request(app)
        .get('/api/v1/admin/inquiries/flights')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inquiries).toEqual([]);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('permits ADMIN user to list bookings', async () => {
      vi.spyOn(prisma.booking, 'count').mockResolvedValue(0);
      vi.spyOn(prisma.booking, 'findMany').mockResolvedValue([]);

      const token = createTestToken('ADMIN');
      const res = await request(app)
        .get('/api/v1/admin/bookings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bookings).toEqual([]);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('permits STAFF user to list contact messages', async () => {
      vi.spyOn(prisma.contactMessage, 'count').mockResolvedValue(0);
      vi.spyOn(prisma.contactMessage, 'findMany').mockResolvedValue([]);

      const token = createTestToken('STAFF');
      const res = await request(app)
        .get('/api/v1/admin/contact')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.messages).toEqual([]);
    });

    it('permits STAFF user to inspect outbox telemetry', async () => {
      vi.spyOn(prisma.notificationOutbox, 'count').mockResolvedValue(0);

      const token = createTestToken('STAFF');
      const res = await request(app)
        .get('/api/v1/admin/outbox')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outbox).toBeDefined();
      expect(res.body.data.outbox.pending).toBe(0);
    });
  });

  // ─── 4. Request Validation Rejection (HTTP 422) ───────────────────────────
  describe('Admin Input Validation Rejection', () => {
    beforeEach(() => {
      vi.spyOn(prisma.session, 'findFirst').mockResolvedValue({ id: 'mock-session-id' } as any);
    });

    it('rejects invalid inquiry status value with 422', async () => {
      const token = createTestToken('STAFF');
      const res = await request(app)
        .patch('/api/v1/admin/inquiries/flights/flight-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'INVALID_STATUS' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid booking status value with 422', async () => {
      const token = createTestToken('ADMIN');
      const res = await request(app)
        .patch('/api/v1/admin/bookings/booking-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'INVALID_STATUS' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid contact status value with 422', async () => {
      const token = createTestToken('STAFF');
      const res = await request(app)
        .patch('/api/v1/admin/contact/msg-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'COMPLETED' }); // Contact uses NEW, IN_PROGRESS, RESOLVED

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── 5. Lifecycle Transition Enforcement ──────────────────────────────────
  describe('Lifecycle Status Transition Logic', () => {
    describe('Inquiry transitions', () => {
      it('allows valid inquiry transitions from PENDING', () => {
        expect(() => assertInquiryTransition('PENDING', 'CONFIRMED')).not.toThrow();
        expect(() => assertInquiryTransition('PENDING', 'CANCELLED')).not.toThrow();
      });

      it('allows valid inquiry transitions from CONFIRMED', () => {
        expect(() => assertInquiryTransition('CONFIRMED', 'COMPLETED')).not.toThrow();
        expect(() => assertInquiryTransition('CONFIRMED', 'CANCELLED')).not.toThrow();
      });

      it('rejects illegal transitions from terminal COMPLETED or CANCELLED', () => {
        expect(() => assertInquiryTransition('COMPLETED', 'PENDING')).toThrow();
        expect(() => assertInquiryTransition('CANCELLED', 'CONFIRMED')).toThrow();
        expect(() => assertInquiryTransition('COMPLETED', 'CANCELLED')).toThrow();
      });

      it('rejects same-status inquiry transitions', () => {
        expect(() => assertInquiryTransition('PENDING', 'PENDING')).toThrow();
      });
    });

    describe('Booking transitions', () => {
      it('allows valid booking transitions', () => {
        expect(() => assertBookingTransition('PENDING', 'CONFIRMED')).not.toThrow();
        expect(() => assertBookingTransition('PENDING', 'CANCELLED')).not.toThrow();
        expect(() => assertBookingTransition('CONFIRMED', 'COMPLETED')).not.toThrow();
        expect(() => assertBookingTransition('CONFIRMED', 'CANCELLED')).not.toThrow();
      });

      it('rejects illegal booking transitions', () => {
        expect(() => assertBookingTransition('CANCELLED', 'CONFIRMED')).toThrow();
        expect(() => assertBookingTransition('COMPLETED', 'PENDING')).toThrow();
      });

      it('correctly reports canTransitionStatus for bookings', () => {
        expect(canTransitionStatus('booking', 'PENDING', 'CONFIRMED')).toBe(true);
        expect(canTransitionStatus('booking', 'COMPLETED', 'PENDING')).toBe(false);
      });
    });

    describe('Contact transitions', () => {
      it('allows valid contact support workflow', () => {
        expect(() => assertContactTransition('NEW', 'IN_PROGRESS')).not.toThrow();
        expect(() => assertContactTransition('IN_PROGRESS', 'RESOLVED')).not.toThrow();
        expect(() => assertContactTransition('RESOLVED', 'IN_PROGRESS')).not.toThrow();
      });

      it('rejects skipping from NEW directly to RESOLVED', () => {
        expect(() => assertContactTransition('NEW', 'RESOLVED')).toThrow();
      });
    });
  });
});
