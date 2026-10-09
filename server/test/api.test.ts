import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('FlyWithsafety Server API Tests', () => {
  describe('Authentication route guards and validation', () => {
    it('rejects protected current-user requests without a session', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('validates email login and reset input before database access', async () => {
      const login = await request(app).post('/api/v1/auth/login').send({ email: 'not-an-email' });
      expect(login.status).toBe(422);
      expect(login.body.code).toBe('VALIDATION_ERROR');

      const reset = await request(app).post('/api/v1/auth/reset-password').send({ token: 'short', password: 'weak' });
      expect(reset.status).toBe(422);
      expect(reset.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── Health check ──────────────────────────────────────────────────────────
  describe('GET /api/v1/health', () => {
    it('returns healthy status with system diagnostics and requestId', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.environment).toBeDefined();
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  // ─── Airports API ──────────────────────────────────────────────────────────
  describe('GET /api/v1/airports/search', () => {
    it('returns popular airports when query is empty', async () => {
      const res = await request(app).get('/api/v1/airports/search');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.airports)).toBe(true);
      expect(res.body.data.airports.length).toBeGreaterThan(0);
      const dac = res.body.data.airports.find((a: any) => a.code === 'DAC');
      expect(dac).toBeDefined();
    });

    it('searches airports by code and city name', async () => {
      const res = await request(app).get('/api/v1/airports/search?q=Dhaka');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.airports[0].code).toBe('DAC');

      const resCode = await request(app).get('/api/v1/airports/search?q=KUL');
      expect(resCode.status).toBe(200);
      expect(resCode.body.data.airports[0].code).toBe('KUL');
    });
  });

  // ─── Flight Search & Aggregator ────────────────────────────────────────────
  describe('POST /api/v1/flights/search', () => {
    it('rejects invalid flight search parameters (invalid dates / airports)', async () => {
      const res = await request(app)
        .post('/api/v1/flights/search')
        .send({ from: 'INVALID_LONG_CODE', to: 'DAC', departureDate: 'not-a-date' });
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects same origin and destination airport', async () => {
      const res = await request(app)
        .post('/api/v1/flights/search')
        .send({
          tripType: 'oneWay',
          from: 'DAC',
          to: 'DAC',
          departureDate: '2026-11-10',
          adults: 1,
        });
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('returns ranked normalized flight offers with demo data indicator', async () => {
      const res = await request(app)
        .post('/api/v1/flights/search')
        .send({
          tripType: 'oneWay',
          from: 'DAC',
          to: 'KUL',
          departureDate: '2026-11-10',
          adults: 1,
          cabinClass: 'economy',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.offers).toBeDefined();
      expect(res.body.data.isDemoData).toBe(true);
      expect(res.body.data.stats).toBeDefined();
      expect(res.body.data.stats.cheapestPrice).toBeGreaterThan(0);

      // Verify normalized offer shape
      const first = res.body.data.offers[0];
      expect(first.airline).toBeDefined();
      expect(first.price || first.pricing?.totalPrice).toBeGreaterThan(0);
      expect(first.outbound.origin.code).toBe('DAC');
      expect(first.outbound.destination.code).toBe('KUL');
    });
  });

  // ─── Contact Form Validation ───────────────────────────────────────────────
  describe('POST /api/v1/contact', () => {
    it('validates required fields', async () => {
      const res = await request(app)
        .post('/api/v1/contact')
        .send({ firstName: 'John' });
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects messages shorter than 10 characters', async () => {
      const res = await request(app)
        .post('/api/v1/contact')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          subject: 'Help',
          message: 'Hi',
        });
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── Booking Validation ────────────────────────────────────────────────────
  describe('POST /api/v1/bookings', () => {
    it('rejects booking with missing passenger details', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .send({
          bookingType: 'FLIGHT',
          customerName: 'Rahim Khan',
          customerEmail: 'rahim@example.com',
          totalPrice: 25000,
          passengers: [],
        });
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects booking lookup without email or reference', async () => {
      const res = await request(app)
        .post('/api/v1/bookings/lookup')
        .send({ referenceNumber: 'FWS-123' });
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── Plural Inquiry Routes ─────────────────────────────────────────────────
  describe('Inquiry endpoints', () => {
    it('validates flight inquiry input', async () => {
      const res = await request(app)
        .post('/api/v1/flights/inquiries')
        .send({ from: 'DAC' });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('validates hotel inquiry input', async () => {
      const res = await request(app)
        .post('/api/v1/hotels/inquiries')
        .send({ destination: 'Bangkok' });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('validates package inquiry input', async () => {
      const res = await request(app)
        .post('/api/v1/packages/inquiries')
        .send({ name: 'Test' });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('validates visa inquiry input', async () => {
      const res = await request(app)
        .post('/api/v1/visa/inquiries')
        .send({ country: 'Malaysia' });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── Additional Flight Validation Tests ────────────────────────────────────
  describe('Flight Search Extended Validation', () => {
    it('rejects flight search when infant count exceeds adult count', async () => {
      const res = await request(app)
        .post('/api/v1/flights/search')
        .send({
          tripType: 'oneWay',
          from: 'DAC',
          to: 'BKK',
          departureDate: '2026-11-20',
          adults: 1,
          infants: 2,
        });
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects round trip flight search when returnDate is missing or before departure', async () => {
      const res = await request(app)
        .post('/api/v1/flights/search')
        .send({
          tripType: 'roundTrip',
          from: 'DAC',
          to: 'BKK',
          departureDate: '2026-11-20',
          returnDate: '2026-11-15',
          adults: 1,
        });
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── Hotel Search Tests ───────────────────────────────────────────────────
  describe('POST /api/v1/hotels/search', () => {
    it('returns deterministic hotel offers with demo data indicator', async () => {
      const res = await request(app)
        .post('/api/v1/hotels/search')
        .send({
          destination: 'Bangkok',
          checkIn: '2026-11-15',
          checkOut: '2026-11-20',
          guests: 2,
          rooms: 1,
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.results)).toBe(true);
      expect(res.body.data.results.length).toBeGreaterThan(0);
      expect(res.body.data.results[0].isDemoData).toBe(true);
      expect(res.body.data.results[0].id).toContain('fws-hotel-bangkok');
    });
  });

  // ─── Future Feature Stubs (Phases 6–10) ────────────────────────────────────
  describe('Phases 6–10 Feature Stubs', () => {
    it('returns 501 NOT_IMPLEMENTED for price alerts', async () => {
      const res = await request(app).post('/api/v1/price-alerts').send({ route: 'DAC-KUL' });
      expect(res.status).toBe(501);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('NOT_IMPLEMENTED');
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('returns 501 NOT_IMPLEMENTED for flight tracker', async () => {
      const res = await request(app).get('/api/v1/flight-tracker/BG301');
      expect(res.status).toBe(501);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('NOT_IMPLEMENTED');
    });

    it('returns 501 NOT_IMPLEMENTED for AI assistant', async () => {
      const res = await request(app).post('/api/v1/ai-assistant').send({ prompt: 'plan a trip' });
      expect(res.status).toBe(501);
      expect(res.body.code).toBe('NOT_IMPLEMENTED');
    });
  });
});
