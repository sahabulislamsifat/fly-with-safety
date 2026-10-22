import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { addTravelDays, travelToday } from '../../client/src/lib/travel-dates';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Website API contract regressions', () => {
  it('formats ISO flight instants with an explicit time zone', async () => {
    const { formatFlightTime } = await import('../../client/src/lib/api/flights');
    expect(formatFlightTime('2027-06-20T16:20:00+06:00')).toBe('10:20 UTC');
    expect(formatFlightTime('invalid')).toBe('--:--');
    expect(formatFlightTime()).toBe('--:--');
  });
  it.each(['economy', 'premiumEconomy', 'business', 'first'] as const)('renders actual %s flight fares and itinerary fields', async cabinClass => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
      const response = await request(app).post('/api/v1/flights/search').send(JSON.parse(String(options.body)));
      return new Response(JSON.stringify(response.body), { status: response.status });
    }));
    const { searchFlights } = await import('../../client/src/lib/api/flights');
    const result = await searchFlights({ from: 'DAC', to: 'CXB', departureDate: '2027-06-20', tripType: 'oneWay', cabinClass });
    expect(result.offers.length).toBeGreaterThan(0);
    expect(result.offers[0].price.totalAmount).toBeGreaterThan(0);
    expect(result.offers[0].outboundLeg.origin.code).toBe('DAC');
    expect(result.offers[0].outboundLeg.destination.code).toBe('CXB');
    expect(result.offers[0].totalDurationMinutes).toBeGreaterThan(0);
    expect(result.offers[0].cabinClass).toBe(cabinClass);
    expect(result.offers.every(offer => offer.isDemoData)).toBe(true);
  });

  it('rejects HTTP failure even when the response body claims success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: {} }), { status: 503 })));
    const { get } = await import('../../client/src/lib/api/client');
    await expect(get('/test')).rejects.toMatchObject({ status: 503 });
  });

  it('preserves Headers-based idempotency keys', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: {} })));
    vi.stubGlobal('fetch', fetchMock);
    const { post } = await import('../../client/src/lib/api/client');
    await post('/test', {}, new Headers({ 'Idempotency-Key': 'audit-key' }));
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Idempotency-Key')).toBe('audit-key');
  });
});

describe('Travel calendar dates', () => {
  it('uses the Bangladesh day near UTC midnight', () => {
    expect(travelToday(new Date('2026-10-21T19:00:00Z'))).toBe('2026-10-22');
  });
  it('handles leap day and year boundaries', () => {
    expect(addTravelDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addTravelDays('2027-12-31', 1)).toBe('2028-01-01');
  });
});
