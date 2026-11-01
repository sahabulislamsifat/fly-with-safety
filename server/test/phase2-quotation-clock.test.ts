import { expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
const db = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock('../src/lib/prisma.js', () => ({ prisma: db }));
import { changeBookingCommercial } from '../src/services/booking-commercial.service.js';

// Exercise the installed Prisma/pg date codec with synthetic wire rows only.
// No pool connection is acquired: every query is replaced before Prisma starts.
async function clockThroughAdapter(utc: boolean, wire: string) {
  const pool = new Pool();
  Object.defineProperty(pool, 'query', { value: async (query: {
    types: { getTypeParser(oid: number, format: string): (value: string) => unknown };
  }) => {
    const oid = utc ? 1114 : 1184;
    return { command: 'SELECT', rowCount: 1, oid: 0, fields: [{ name: 'now', dataTypeID: oid }],
      rows: [[query.types.getTypeParser(oid, 'text')(wire)]] };
  } });
  const client = new PrismaClient({ adapter: new PrismaPg(pool) });
  try { return (await client.$queryRawUnsafe<{ now: Date }[]>('SELECT synthetic_clock AS now'))[0].now; }
  finally { await client.$disconnect(); await pool.end(); }
}
it('reproduces the installed timestamptz codec shifting a non-UTC wall clock', async () => {
  const actual = await clockThroughAdapter(false, '2026-11-01 18:35:00+06');
  expect(actual).toBeInstanceOf(Date);
  expect(actual.toISOString()).toBe('2026-11-01T18:35:00.000Z');
  expect(+actual).not.toBe(+new Date('2026-11-01T18:35:00+06:00'));
});
it.each(['+06', '-05', '+05:30'])('explicit UTC timestamp output preserves the instant regardless of session offset %s', async offset => {
  const original = new Date('2026-11-01T18:35:00' + (offset.length === 3 ? offset + ':00' : offset));
  const utcWire = original.toISOString().replace('T', ' ').replace('Z', '');
  expect(await clockThroughAdapter(true, utcWire)).toEqual(original);
});
it('selects database UTC wall clock only after the booking row lock without changing expiry rules', async () => {
  const sql: string[] = [];
  const now = new Date('2026-11-01T12:35:00Z');
  const booking = { id: 'synthetic-booking', userId: 'synthetic-owner', status: 'PENDING', currency: 'BDT', bookingDetails: {} };
  const update = vi.fn().mockResolvedValue(booking);
  db.$transaction.mockImplementation(callback => callback({ $queryRaw: vi.fn().mockImplementation(query => {
    sql.push(query.sql); return Promise.resolve(sql.length === 1 ? [] : [{ now }]);
  }), booking: { findUnique: vi.fn().mockResolvedValue(booking), update } }));
  await changeBookingCommercial('FWS-SYNTHETIC', { id: 'synthetic-staff', role: 'STAFF' }, {
    action: 'OFFER_QUOTE', requestId: '00000000-0000-4000-8000-000000000001', expectedRevision: 0,
    amount: 100, currency: 'BDT', validUntil: '2026-11-01T12:45:00Z',
  });
  expect(sql[0]).toContain('FOR UPDATE');
  expect(sql[1]).toContain("clock_timestamp() AT TIME ZONE 'UTC'");
  expect(update).toHaveBeenCalledTimes(1);
});
