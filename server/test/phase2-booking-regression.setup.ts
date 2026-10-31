import { vi } from 'vitest';
vi.mock('pg', () => { throw new Error('PHASE2_OFFLINE_DATABASE_FORBIDDEN'); });
vi.mock('dotenv', () => { throw new Error('PHASE2_OFFLINE_ENV_FORBIDDEN'); });
vi.mock('../src/config/env.js', () => ({ env: {
  nodeEnv: 'test', jwtSecret: 'synthetic-phase2-offline-only', corsOrigins: ['http://localhost:3000'],
  frontendUrl: 'http://localhost:3000', emailDeliveryEnabled: false, googleClientId: '', googleClientSecret: '',
  rateLimitWindowMs: 900000, rateLimitMax: 10000, authRateLimitWindowMs: 900000, authRateLimitMax: 10000,
} }));
vi.mock('../src/lib/prisma.js', () => {
  const models = ['user', 'session', 'account', 'booking', 'bookingPassenger', 'bookingStatusHistory', 'flightInquiry', 'hotelInquiry', 'packageInquiry', 'visaInquiry', 'idempotencyRecord', 'notificationOutbox'];
  const methods = ['findFirst', 'findUnique', 'findMany', 'create', 'update', 'updateMany', 'count'];
  const prisma = Object.fromEntries(models.map(model => [model, Object.fromEntries(methods.map(method => [method, vi.fn()]))]));
  return { prisma: { ...prisma, $transaction: vi.fn(), $queryRaw: vi.fn(), $queryRawUnsafe: vi.fn() } };
});
