import { beforeEach, expect, it, vi } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import { prisma } from '../src/lib/prisma.js';
import { createBooking } from '../src/services/booking.service.js';
import { createBookingSchema } from '../src/validators/booking.schemas.js';
import { sendBookingConfirmation } from '../src/services/notification.service.js';

vi.mock('../src/services/notification.service.js', () => ({
  sendBookingConfirmation: vi.fn().mockResolvedValue(undefined), sendBookingStatusNotification: vi.fn(),
}));
let bookings: any[], records: Map<string, any>, serial: number;
const payload = (email = 'alice@example.test') => createBookingSchema.parse({
  customerName: 'Synthetic Customer', customerEmail: email, totalPrice: 100,
  passengers: [{ firstName: 'Test', lastName: 'Passenger' }],
});
let key: string;
let testNumber = 0;
beforeEach(() => {
  key = `synthetic-booking-key-${++testNumber}`;
  vi.restoreAllMocks(); vi.mocked(sendBookingConfirmation).mockClear();
  bookings = []; records = new Map(); serial = 0;
  vi.spyOn(prisma.booking, 'findFirst').mockImplementation(async ({ where }: any) =>
    bookings.find(b => Object.entries(where).every(([k, v]) => k === 'createdAt' || b[k] === v)) ?? null);
  const create = async ({ data }: any) => ({ ...data, id: String(++serial), passengers: [], statusHistory: [] });
  vi.spyOn(prisma.booking, 'create').mockImplementation(async (args: any) => {
    const b = await create(args); bookings.push(b); return b;
  });
  vi.spyOn(prisma.idempotencyRecord, 'findUnique').mockImplementation(async ({ where }: any) =>
    records.get(JSON.stringify(where.operation_principal_key)) ?? null);
  // Synthetic rollback/uniqueness model; this does not prove PostgreSQL concurrency behavior.
  vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
    const pending: any[] = [];
    const result = await callback({
      booking: { create: async (args: any) => { const b = await create(args); pending.push(b); return b; } },
      idempotencyRecord: { create: async ({ data }: any) => {
        const scope = JSON.stringify({ operation: data.operation, principal: data.principal, key: data.key });
        if (records.has(scope)) throw new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' });
        records.set(scope, data); return data;
      } },
    });
    bookings.push(...pending); return result;
  });
});
it('isolates authenticated customers with identical contact details', async () => {
  const a = await createBooking(payload(), 'alice', key);
  const b = await createBooking(payload(), 'bob', key);
  expect(b.id).not.toBe(a.id); expect(b.userId).toBe('bob');
});
it('isolates guest emails', async () => {
  const a = await createBooking(payload(), undefined, key);
  expect((await createBooking(payload('bob@example.test'), undefined, key)).id).not.toBe(a.id);
});
it('replays identical payload and sends one confirmation', async () => {
  const a = await createBooking(payload(), 'alice', key);
  expect((await createBooking(payload(), 'alice', key)).id).toBe(a.id);
  expect(bookings).toHaveLength(1); expect(sendBookingConfirmation).toHaveBeenCalledTimes(1);
});
it('rejects changed payload', async () => {
  await createBooking(payload(), 'alice', key);
  await expect(createBooking({ ...payload(), totalPrice: 200 }, 'alice', key)).rejects.toMatchObject({ statusCode: 409 });
});
it('uses transactional uniqueness for concurrent retries (mocked)', async () => {
  const results = await Promise.all([createBooking(payload(), 'alice', key), createBooking(payload(), 'alice', key)]);
  expect(results[0].id).toBe(results[1].id); expect(bookings).toHaveLength(1);
});
it('fails closed on persistence failure', async () => {
  vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(createBooking(payload(), 'alice', key)).rejects.toThrow('storage unavailable');
  expect(bookings).toHaveLength(0); expect(sendBookingConfirmation).not.toHaveBeenCalled();
});
it('never returns another caller record without a key', async () => {
  const a = await createBooking(payload(), 'alice');
  expect((await createBooking(payload(), 'bob')).id).not.toBe(a.id);
});
it('separates guest and authenticated principals sharing an email', async () => {
  const guest = await createBooking(payload(), undefined, key);
  expect((await createBooking(payload(), 'alice', key)).id).not.toBe(guest.id);
});
it('treats body and header keys as the same operation without hashing the key field', async () => {
  const first = await createBooking({ ...payload(), idempotencyKey: key }, 'alice');
  expect((await createBooking(payload(), 'alice', key)).id).toBe(first.id);
});
it('refuses replay recovery when booking ownership no longer matches', async () => {
  await createBooking(payload(), 'alice', key);
  bookings[0].userId = 'bob';
  await expect(createBooking(payload(), 'alice', key)).rejects.toMatchObject({ statusCode: 500 });
});
