import { beforeAll, describe, expect, it } from 'vitest';

const integrationUrl = process.env.INTEGRATION_TEST_DATABASE_URL;
const enabled = process.env.RUN_IDEMPOTENCY_INTEGRATION === 'true';

function safeIntegrationTarget(): boolean {
  if (!integrationUrl || process.env.EMAIL_DELIVERY_ENABLED !== 'false') return false;
  try {
    return new URL(integrationUrl).pathname.replace(/^\//, '').endsWith('_integration');
  } catch {
    return false;
  }
}

if (enabled && !safeIntegrationTarget()) {
  throw new Error('Idempotency integration tests require an *_integration database URL and EMAIL_DELIVERY_ENABLED=false.');
}

const run = enabled && safeIntegrationTarget();
const runId = `idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe.runIf(run)('idempotency integration', () => {
  let request: typeof import('supertest').default;
  let app: typeof import('../src/app.js').default;
  let prisma: typeof import('../src/lib/prisma.js').prisma;
  let createIdempotentInquiry: typeof import('../src/services/idempotency.service.js').createIdempotentInquiry;
  let authCookie: string[];

  const key = (suffix: string) => `${runId}-${suffix}-idempotency-key`;
  const payload = (email: string, notes = 'Controlled idempotency integration request') => ({
    from: 'DAC', to: 'KUL', departureDate: '2027-06-10', tripType: 'oneWay',
    adults: 1, children: 0, infants: 0, passengers: 1, cabinClass: 'economy',
    name: 'Integration Test', email, notes,
  });

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || process.env.DATABASE_URL !== integrationUrl || process.env.EMAIL_DELIVERY_ENABLED !== 'false') {
      throw new Error('Idempotency integration test environment was not initialized safely.');
    }
    request = (await import('supertest')).default;
    app = (await import('../src/app.js')).default;
    prisma = (await import('../src/lib/prisma.js')).prisma;
    createIdempotentInquiry = (await import('../src/services/idempotency.service.js')).createIdempotentInquiry;

    const registration = await request(app).post('/api/v1/auth/register').send({
      name: 'Integration Test User',
      email: `${runId}-auth@integration.test`,
      password: 'Integration9Pass!',
    });
    expect(registration.status).toBe(201);
    authCookie = registration.headers['set-cookie'];
  });

  it('creates once and replays an identical guest request', async () => {
    const email = `${runId}-guest-one@integration.test`;
    const idempotencyKey = key('first');
    const first = await request(app).post('/api/v1/flights/inquiries').set('Idempotency-Key', idempotencyKey).send(payload(email));
    const replay = await request(app).post('/api/v1/flights/inquiries').set('Idempotency-Key', idempotencyKey).send(payload(email));

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.body.data.referenceNumber).toBe(first.body.data.referenceNumber);
    expect(await prisma.flightInquiry.count({ where: { email } })).toBe(1);
    expect(await prisma.idempotencyRecord.count({ where: { key: idempotencyKey } })).toBe(1);
  });

  it('rejects a conflicting key payload without another inquiry', async () => {
    const email = `${runId}-conflict@integration.test`;
    const idempotencyKey = key('conflict');
    const first = await request(app).post('/api/v1/flights/inquiries').set('Idempotency-Key', idempotencyKey).send(payload(email));
    const conflict = await request(app).post('/api/v1/flights/inquiries').set('Idempotency-Key', idempotencyKey).send({ ...payload(email), to: 'BKK' });

    expect(first.status).toBe(201);
    expect(conflict.status).toBe(409);
    expect(await prisma.flightInquiry.count({ where: { email } })).toBe(1);
  });

  it('handles concurrent same-key submissions once', async () => {
    const email = `${runId}-concurrent@integration.test`;
    const idempotencyKey = key('concurrent');
    const [left, right] = await Promise.all([
      request(app).post('/api/v1/flights/inquiries').set('Idempotency-Key', idempotencyKey).send(payload(email)),
      request(app).post('/api/v1/flights/inquiries').set('Idempotency-Key', idempotencyKey).send(payload(email)),
    ]);

    expect([left.status, right.status]).toEqual([201, 201]);
    expect(left.body.data.referenceNumber).toBe(right.body.data.referenceNumber);
    expect(await prisma.flightInquiry.count({ where: { email } })).toBe(1);
    expect(await prisma.idempotencyRecord.count({ where: { key: idempotencyKey } })).toBe(1);
  });

  it('does not persist a key for an invalid request', async () => {
    const idempotencyKey = key('invalid');
    const response = await request(app).post('/api/v1/flights/inquiries').set('Idempotency-Key', idempotencyKey).send({ from: 'DAC' });
    expect(response.status).toBe(422);
    expect(await prisma.idempotencyRecord.count({ where: { key: idempotencyKey } })).toBe(0);
  });

  it('scopes an identical key between guest and authenticated principals', async () => {
    const idempotencyKey = key('scope');
    const guestEmail = `${runId}-scope-guest@integration.test`;
    const authenticatedEmail = `${runId}-auth@integration.test`;
    const guest = await request(app).post('/api/v1/flights/inquiries').set('Idempotency-Key', idempotencyKey).send(payload(guestEmail));
    const authenticated = await request(app).post('/api/v1/flights/inquiries').set('Cookie', authCookie).set('Idempotency-Key', idempotencyKey).send(payload(authenticatedEmail));
    const hiddenGuest = await request(app).get(`/api/v1/account/inquiries/flight/${guest.body.data.referenceNumber}`).set('Cookie', authCookie);

    expect(guest.status).toBe(201);
    expect(authenticated.status).toBe(201);
    expect(guest.body.data.referenceNumber).not.toBe(authenticated.body.data.referenceNumber);
    expect(await prisma.idempotencyRecord.count({ where: { key: idempotencyKey } })).toBe(2);
    expect(hiddenGuest.status).toBe(404);
  });

  it('rolls back business and idempotency records when a transaction fails', async () => {
    const idempotencyKey = key('rollback');
    const email = `${runId}-rollback@integration.test`;
    const referenceNumber = `TEST-${runId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-12)}`;
    await expect(createIdempotentInquiry({
      operation: 'rollback-test', key: idempotencyKey, email, payload: payload(email),
      create: async (tx) => {
        await tx.flightInquiry.create({ data: {
          referenceNumber, fromAirport: 'DAC', toAirport: 'KUL', departureDate: '2027-06-10',
          passengers: 1, cabinClass: 'economy', name: 'Integration Test', email, status: 'PENDING',
        } });
        throw new Error('forced integration transaction failure');
      },
      findByReference: async () => null,
    })).rejects.toThrow('forced integration transaction failure');
    expect(await prisma.flightInquiry.count({ where: { referenceNumber } })).toBe(0);
    expect(await prisma.idempotencyRecord.count({ where: { key: idempotencyKey } })).toBe(0);
  });
});
