import { beforeEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { listInquiries } from '../src/services/account.service.js';
import { inquiryPageQuery } from '../src/services/inquiry-page-query.js';
import { inquiryListQuerySchema } from '../src/validators/account.schemas.js';
import { adminInquiryListQuerySchema } from '../src/validators/inquiry-query.schemas.js';
import { getFlightInquiries } from '../src/services/flight.service.js';
import { getHotelInquiries } from '../src/services/hotel.service.js';
import { getPackageInquiries } from '../src/services/package.service.js';
import { getVisaInquiries } from '../src/services/visa.service.js';

beforeEach(() => vi.restoreAllMocks());
const pageRow = (extra = {}) => ({ id: 'synthetic-1', referenceNumber: 'INQ-1', status: 'PENDING',
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), type: 'flight',
  summary: 'DAC → KUL', travelDate: '2027-01-01', total: 1n, ...extra });

it('binds customer and status in every branch, with deterministic global SQL ordering', () => {
  const query = inquiryPageQuery('owner-secret-value', { page: 3, limit: 5, status: 'PENDING' });
  expect(query.values.filter(value => value === 'owner-secret-value')).toHaveLength(4);
  expect(query.values.filter(value => value === 'PENDING')).toHaveLength(4);
  expect(query.text).not.toContain('owner-secret-value');
  expect(query.text.match(/WHERE "userId" = /g)).toHaveLength(4);
  expect(query.text.match(/UNION ALL/g)).toHaveLength(3);
  expect(query.text).toContain('ORDER BY "createdAt" DESC, "typeRank" ASC, id DESC');
  expect(query.text).toContain('LEFT JOIN page ON TRUE');
  expect(query.values.slice(-2)).toEqual([5, 10]);
  expect(query.text).not.toMatch(/customerEmail|passport|notes|SELECT \* FROM public/);
});
it('keeps SQL injection strings in parameters, never SQL identifiers or text', () => {
  const malicious = "x' OR TRUE; DROP TABLE public.\"User\"; --";
  const query = inquiryPageQuery(malicious, { page: 1, limit: 10, status: malicious });
  expect(query.text).not.toContain(malicious);
  expect(query.values.filter(value => value === malicious)).toHaveLength(8);
});
it.each(['flight', 'hotel', 'package', 'visa'] as const)('uses only the selected %s table and retains owner/status predicates', type => {
  const query = inquiryPageQuery('owner', { page: 1, limit: 10, type, status: 'CANCELLED' });
  expect(query.text).not.toContain('UNION ALL');
  expect(query.text.match(/WHERE "userId" = /g)).toHaveLength(1);
  expect(query.values).toEqual(['owner', 'CANCELLED', 10, 0]);
  expect(query.text).toContain(`public."${type[0].toUpperCase() + type.slice(1)}Inquiry"`);
});
it.each([0n, 1_000_000n])('retains total %s for an empty out-of-range page', async total => {
  const read = vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ total, id: null }]);
  expect(await listInquiries('owner', { page: 10_000, limit: 50 })).toEqual({
    inquiries: [], pagination: { page: 10_000, limit: 50, total: Number(total), totalPages: Math.ceil(Number(total) / 50) },
  });
  expect(read).toHaveBeenCalledOnce();
});
it('uses one statement and returns only summary fields for large histories', async () => {
  const read = vi.spyOn(prisma, '$queryRaw').mockResolvedValue([pageRow({ total: 1_000_000n, typeRank: 0, passportNumber: 'never-return' })]);
  const forbidden = vi.spyOn(prisma.flightInquiry, 'findMany').mockImplementation(() => { throw new Error('Unbounded model fetch forbidden'); });
  const result = await listInquiries('owner-A', { page: 2, limit: 1 });
  expect(result.pagination).toEqual({ page: 2, limit: 1, total: 1_000_000, totalPages: 1_000_000 });
  expect(result.inquiries).toHaveLength(1);
  expect(result.inquiries[0]).not.toHaveProperty('total');
  expect(result.inquiries[0]).not.toHaveProperty('typeRank');
  expect(result.inquiries[0]).not.toHaveProperty('passportNumber');
  expect(read).toHaveBeenCalledOnce(); expect(forbidden).not.toHaveBeenCalled();
});
it('does not conflate customers in query parameters', async () => {
  const read = vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ total: 0n, id: null }]);
  await listInquiries('owner-A', { page: 1, limit: 10 });
  await listInquiries('owner-B', { page: 1, limit: 10 });
  expect((read.mock.calls[0][0] as any).values).not.toContain('owner-B');
  expect((read.mock.calls[1][0] as any).values).not.toContain('owner-A');
});
it.each([{ page: 0 }, { page: 10001 }, { page: '2junk' }, { page: true }, { page: ['2'] },
  { limit: 0 }, { limit: 51 }, { limit: 1.5 }, { limit: '' }, { status: 'UNKNOWN' }])('rejects invalid inquiry query %j', input => {
  expect(inquiryListQuerySchema.safeParse(input).success).toBe(false);
  expect(adminInquiryListQuerySchema.safeParse(input).success).toBe(false);
});
it('preserves customer/admin defaults and upper page-size boundary', () => {
  expect(inquiryListQuerySchema.parse({})).toEqual({ page: 1, limit: 10 });
  expect(adminInquiryListQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  expect(inquiryListQuerySchema.parse({ page: '10000', limit: '50' })).toEqual({ page: 10000, limit: 50 });
});
it('rejects invalid direct service calls before accessing the database', async () => {
  const read = vi.spyOn(prisma, '$queryRaw');
  await expect(listInquiries('owner', { page: -1, limit: 10 })).rejects.toMatchObject({ statusCode: 400 });
  expect(read).not.toHaveBeenCalled();
});
it.each(['flights', 'hotels', 'packages', 'visa'])('rejects malformed admin %s query before model access', async type => {
  vi.spyOn(prisma.session, 'findFirst').mockResolvedValue({ id: 'synthetic-session' } as any);
  const token = jwt.sign({ sub: 'staff', email: 'staff@example.test', role: 'STAFF', sid: 'synthetic-session' }, env.jwtSecret);
  const res = await request(app).get(`/api/v1/admin/inquiries/${type}?page=2junk`).set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(422);
});
it.each([
  ['flightInquiry', getFlightInquiries], ['hotelInquiry', getHotelInquiries],
  ['packageInquiry', getPackageInquiries], ['visaInquiry', getVisaInquiries],
] as const)('keeps bounded, filtered admin %s pages with stable ties', async (model, list) => {
  vi.spyOn(prisma[model], 'count').mockResolvedValue(7);
  const read = vi.spyOn(prisma[model], 'findMany').mockResolvedValue([]);
  const result = await list({ page: 2, limit: 5, status: 'PENDING' });
  expect(read).toHaveBeenCalledWith({ where: { status: 'PENDING' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: 5, take: 5 });
  expect(result.pagination.total).toBe(7);
});
it('uses authenticated ownership rather than a supplied query userId', async () => {
  vi.spyOn(prisma.session, 'findFirst').mockResolvedValue({ id: 'session' } as any);
  const read = vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ total: 0n, id: null }]);
  const token = jwt.sign({ sub: 'owner-A', email: 'owner@example.test', role: 'CUSTOMER', sid: 'session' }, env.jwtSecret);
  const res = await request(app).get('/api/v1/account/inquiries?userId=owner-B').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  const values = (read.mock.calls[0][0] as any).values;
  expect(values.filter((value: unknown) => value === 'owner-A')).toHaveLength(4);
  expect(values).not.toContain('owner-B');
});
it('requires authentication before any inquiry query', async () => {
  const read = vi.spyOn(prisma, '$queryRaw');
  expect((await request(app).get('/api/v1/account/inquiries')).status).toBe(401);
  expect(read).not.toHaveBeenCalled();
});
