import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('FlyWithSafe Server API Tests', () => {
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
});
