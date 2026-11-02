import { expect, it, vi } from 'vitest';
import { Client } from 'pg';
it('forwards the shared private-connection environment through the real Vitest worker without connecting', () => {
  const forbid = vi.spyOn(Client.prototype, 'connect').mockImplementation(() => { throw new Error('OFFLINE_CONNECTION_FORBIDDEN'); });
  try {
    expect(process.env.PHASE2_PRIVATE_OFFLINE_TEST).toBe('synthetic-only');
    const reference = process.env.PGPASSWORD;
    expect(typeof reference).toBe('string');
    // Compare only booleans: a failed assertion never embeds either private string.
    const raw = process.env.PHASE2_BOOKING_DATABASE_URL!;
    const parsed = new URL(raw);
    const client = new Client({ connectionString: parsed.href });
    const config = (client as unknown as { connectionParameters: { password: string; user: string; database: string; host: string; port: number; ssl: unknown } }).connectionParameters;
    expect(config.password === reference).toBe(true);
    expect(config.user).toBe('flywithsafe_phase2_booking_test');
    expect(config.database).toBe('flywithsafe_phase2_booking_integration');
    expect(config.host).toBe('127.0.0.1'); expect(config.port).toBe(5432); expect(config.ssl).toBe(false);
    expect(process.env.DATABASE_URL === undefined).toBe(true); expect(process.env.DIRECT_URL === undefined).toBe(true);
    expect(forbid).not.toHaveBeenCalled();
  } finally { forbid.mockRestore(); }
});
it('proves the failed caller unset SSL mode and the reference disable mode have the same installed-driver policy', () => {
  expect(process.env.PHASE2_PRIVATE_OFFLINE_TEST).toBe('synthetic-only');
  const previous = process.env.PGSSLMODE;
  const reference = process.env.PGPASSWORD;
  try {
    delete process.env.PGSSLMODE;
    const original = new Client({ connectionString: process.env.PHASE2_BOOKING_DATABASE_URL! });
    const config = (original as unknown as { connectionParameters: { ssl: unknown } }).connectionParameters;
    expect(config.ssl).toBe(false);
    delete process.env.PGPASSWORD;
    const urlOnly = new Client({ connectionString: process.env.PHASE2_BOOKING_DATABASE_URL! });
    expect((urlOnly as unknown as { connectionParameters: { password: string } }).connectionParameters.password ===
      (original as unknown as { connectionParameters: { password: string } }).connectionParameters.password).toBe(true);
  } finally {
    if (previous === undefined) delete process.env.PGSSLMODE; else process.env.PGSSLMODE = previous;
    if (reference === undefined) delete process.env.PGPASSWORD; else process.env.PGPASSWORD = reference;
  }
});
