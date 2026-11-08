/** Real router composition smoke only; no listening socket and no database. */
import { it, expect, vi } from 'vitest';
import { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { Duplex } from 'node:stream';
import type { Prisma } from '../../src/generated/prisma/client.js';
vi.mock('../../src/lib/prisma.js', () => ({ prisma: { $queryRaw: () => { throw Error('DATABASE_FORBIDDEN'); } } }));
vi.mock('../../src/config/env.js', () => ({ env: { nodeEnv: 'test', jwtSecret: 'offline-test-only', emailDeliveryEnabled: false } }));
vi.mock('dotenv', () => { throw Error('PRIVATE_ENV_FORBIDDEN'); });
vi.mock('nodemailer', () => ({ default: { createTransport: () => { throw Error('MAIL_FORBIDDEN'); } } }));
it('transaction binding and actual router anonymous denial without SQL', async () => {
  process.env.IDENTITY_SCOPE_ENABLED = 'true';
  const { createApiApplication, transactionClient } = await import('./api-checks.js');
  const statements: string[] = [];
  const native = {
    $queryRaw() { expect(this).toBe(native); return Promise.resolve(1); },
    $executeRawUnsafe(statement: string) { statements.push(statement); return Promise.resolve(0); },
  };
  const bound = transactionClient(native as unknown as Prisma.TransactionClient);
  expect(await bound.$queryRaw`SELECT 1`).toBe(1);
  const expected = new Error('EXPECTED_OFFLINE_ROLLBACK');
  await expect(bound.$transaction(async tx => { expect(tx).toBe(native); throw expected; })).rejects.toBe(expected);
  expect(statements).toEqual(['SAVEPOINT p5_api_action', 'ROLLBACK TO SAVEPOINT p5_api_action', 'RELEASE SAVEPOINT p5_api_action']);
  const app = await createApiApplication();
  const stream = new Duplex({ read() {}, write(_chunk, _encoding, done) { done(); } });
  Object.defineProperty(stream, 'remoteAddress', { value: '127.0.0.1' });
  const req = new IncomingMessage(stream as Socket); req.method = 'GET'; req.url = '/api/v1/identity/me'; req.headers = {};
  const res = new ServerResponse(req); res.assignSocket(stream as Socket);
  const status = await new Promise<number>((resolve, reject) => {
    stream.once('error', reject); res.once('finish', () => { resolve(res.statusCode); stream.destroy(); });
    req.complete = true; app(req, res); req.push(null);
  });
  expect(status).toBe(401);
});
