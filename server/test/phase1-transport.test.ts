import {describe, expect, it, vi} from 'vitest';
import {Client, type PoolClient} from 'pg';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {PostgresProtectedAuthStore} from '../src/security/protected-auth.pg.js';
vi.mock('dotenv', () => {throw new Error('OFFLINE_ENV_FORBIDDEN');});

/** Installed pg driver event path, with query I/O replaced. No Client.connect,
 * socket connection, PostgreSQL operation, credentials or external process.
 */
function fixture() {
  const client = new Client({host: '127.0.0.1', port: 1, user: 'synthetic', password: 'synthetic', database: 'synthetic', ssl: false});
  const forbiddenConnect = vi.spyOn(client, 'connect').mockImplementation(() => {throw new Error('OFFLINE_CONNECT_FORBIDDEN');});
  const sql: string[] = [], release = vi.fn(), query = vi.fn(async (text: string, args?: unknown[]) => {void args; sql.push(text); return {rows: [], rowCount: 0};});
  Object.defineProperty(client, 'query', {value: query, configurable: true});
  Object.assign(client, {release});
  const connect = vi.fn(async () => client as unknown as PoolClient);
  const store = new PostgresProtectedAuthStore({connect} as never);
  const driver = client as unknown as {_handleErrorEvent(error: Error): void; _queryable: boolean};
  return {client, driver, query, sql, release, connect, forbiddenConnect, store};
}
describe('leased pg Client transport errors — actual driver, OFFLINE I/O', () => {
  it('reproduces pg error emission throwing without a leased-client listener', () => {
    const f = fixture(), failure = new Error('SYNTHETIC_DISCONNECT');
    expect(() => f.driver._handleErrorEvent(failure)).toThrow(failure);
    expect(f.driver._queryable).toBe(false); expect(f.forbiddenConnect).not.toHaveBeenCalled();
  });
  it('COMMIT disconnect rejects safely instead of throwing an unhandled event; discards once', async () => {
    const f = fixture(), failure = new Error('SYNTHETIC_PRIVATE_PASSWORD_SQL'); let eventThrew = false;
    f.query.mockImplementation(async text => {
      f.sql.push(text);
      if (!f.driver._queryable) throw failure;
      if (text === 'COMMIT') {
        try {f.driver._handleErrorEvent(failure);} catch {eventThrew = true;}
        throw failure;
      }
      return {rows: [], rowCount: 0};
    });
    await expect(f.store.transaction(async () => 'not-returned')).rejects.toThrow('PROTECTED_STORAGE_FAILED');
    expect(eventThrew).toBe(false); expect(f.release).toHaveBeenCalledExactlyOnceWith(true);
    expect(f.sql.filter(text => text === 'BEGIN')).toHaveLength(1); expect(f.sql.filter(text => text === 'COMMIT')).toHaveLength(1);
    expect(f.client.listenerCount('error')).toBe(0); expect(f.forbiddenConnect).not.toHaveBeenCalled();
  });
  it('an asynchronous driver error also rejects without a process-fatal event', async () => {
    const f = fixture(); let eventThrew = false;
    f.query.mockImplementation(text => {
      f.sql.push(text);
      if (text === 'COMMIT') return new Promise((_resolve, reject) => queueMicrotask(() => {
        const failure = new Error('SYNTHETIC_ASYNC_DISCONNECT');
        try {f.driver._handleErrorEvent(failure);} catch {eventThrew = true;}
        reject(failure);
      }));
      return Promise.resolve({rows: [], rowCount: 0});
    });
    await expect(f.store.transaction(async () => true)).rejects.toThrow('PROTECTED_STORAGE_FAILED');
    expect(eventThrew).toBe(false); expect(f.release).toHaveBeenCalledExactlyOnceWith(true); expect(f.connect).toHaveBeenCalledTimes(1);
  });
  it('transport event during work cannot fall through to COMMIT or reuse a broken lease', async () => {
    const f = fixture();
    await expect(f.store.transaction(async () => {f.driver._handleErrorEvent(new Error('SYNTHETIC')); return true;})).rejects.toThrow('PROTECTED_STORAGE_FAILED');
    expect(f.sql).not.toContain('COMMIT'); expect(f.release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it('a transport event while COMMIT resolves cannot fabricate success', async () => {
    const f = fixture(); f.query.mockImplementation(async text => {
      f.sql.push(text); if (text === 'COMMIT') f.client.emit('error', new Error('SYNTHETIC')); return {rows: [], rowCount: 0};
    });
    await expect(f.store.transaction(async () => true)).rejects.toThrow('PROTECTED_STORAGE_FAILED');
    expect(f.release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it('normal release hands ownership back before removing only the adapter listener', async () => {
    const f = fixture(), external = vi.fn(); f.client.on('error', external);
    f.release.mockImplementation(() => expect(f.client.listenerCount('error')).toBe(2));
    expect(await f.store.transaction(async () => 42)).toBe(42);
    expect(f.release).toHaveBeenCalledExactlyOnceWith(false); expect(f.client.listeners('error')).toEqual([external]);
    expect(f.sql.slice(0, 4)).toEqual(['BEGIN', "SET LOCAL statement_timeout='5s'", "SET LOCAL lock_timeout='5s'", 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED']);
  });
  it('repeated successful transactions do not leak listeners or change transaction semantics', async () => {
    const f = fixture(); for (let i = 0; i < 20; i++) {expect(await f.store.transaction(async () => i)).toBe(i); expect(f.client.listenerCount('error')).toBe(0);}
    expect(f.release).toHaveBeenCalledTimes(20); expect(f.sql.filter(text => text === 'COMMIT')).toHaveLength(20);
  });
  it('ordinary callback error remains sanitized and rolls back without retry', async () => {
    const f = fixture(); await expect(f.store.transaction(async () => {throw new Error('SYNTHETIC_PRIVATE');})).rejects.toThrow('PROTECTED_STORAGE_FAILED');
    expect(f.sql.at(-1)).toBe('ROLLBACK'); expect(f.sql).not.toContain('COMMIT'); expect(f.release).toHaveBeenCalledExactlyOnceWith(false);
  });
  it('session timestamp binding is canonical UTC in both UTC and Asia/Dhaka hosts', async () => {
    const utils = createRequire(resolve(__dirname,'../package.json'))('pg/lib/utils') as {prepareValue(input: unknown): unknown};
    const previous = process.env.TZ, expiry = new Date('2026-10-30T12:00:00.000Z');
    try {
      for (const timezone of ['UTC','Asia/Dhaka']) {
        process.env.TZ = timezone;
        const f = fixture();
        await f.store.transaction(tx => tx.createSession({id:'synthetic-session',userId:'synthetic-user',digest:'a'.repeat(64),expiresAt:expiry}));
        const call = f.query.mock.calls.find(item => item[0].startsWith('INSERT INTO public."Session"'));
        expect(call?.[1]?.[3]).toBe('2026-10-30T12:00:00.000Z');
        expect(utils.prepareValue(call?.[1]?.[3])).toBe('2026-10-30T12:00:00.000Z');
        // Demonstrate why passing Date directly was unsafe for a no-zone column.
        if (timezone === 'Asia/Dhaka') expect(utils.prepareValue(expiry)).toBe('2026-10-30T18:00:00.000+06:00');
      }
      expect(expiry.toISOString()).toBe('2026-10-30T12:00:00.000Z');
    } finally {if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;}
  });
});
