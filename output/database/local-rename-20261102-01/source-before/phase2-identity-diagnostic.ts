// Test-only diagnostics: never serialize an exception, message, SQL or query result.
const prismaCodes = new Set(['P1000', 'P1001', 'P1002', 'P1003', 'P1008', 'P1010', 'P1011', 'P1017', 'P2002', 'P2003', 'P2010', 'P2024', 'P2028', 'P2034']);
const sqlStates = new Set(['28P01', '28000', '3D000', '42501', '25006', '57014', '55P03', '53300', '08001', '08003', '08006', '08P01', '0A000', '22P02', '42601', '42703', '42P01', '40001', '40P01']);
const networkCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EACCES', 'ENOTFOUND']);
function own(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch { return undefined; }
}
function assertion(error: unknown) {
  if (own(error, 'name') === 'AssertionError') return true;
  if (!error || typeof error !== 'object') return false;
  try {
    const prototype = Object.getPrototypeOf(error);
    const constructor = own(prototype, 'constructor');
    // Chai's name is a getter; inspect only its constructor's static data name.
    return own(prototype, 'name') === 'AssertionError' || (typeof constructor === 'function' &&
      Object.getOwnPropertyDescriptor(constructor, 'name')?.value === 'AssertionError');
  } catch { return false; }
}
export function safeFailure(error: unknown) {
  const meta = own(error, 'meta');
  const adapter = own(meta, 'driverAdapterError');
  const values = [own(error, 'code'), own(meta, 'code'), own(own(error, 'cause'), 'code'),
    own(own(adapter, 'cause'), 'originalCode'), own(own(error, 'cause'), 'originalCode')];
  const find = (allowed: Set<string>) => values.find((value): value is string => typeof value === 'string' && allowed.has(value)) ?? null;
  const prismaCode = find(prismaCodes), sqlState = find(sqlStates), networkCode = find(networkCodes);
  const classification = prismaCode === 'P1000' || sqlState === '28P01' || sqlState === '28000' ? 'DATABASE_AUTHENTICATION'
    : prismaCode === 'P1010' || sqlState === '42501' ? 'DATABASE_PERMISSION'
    : sqlState === '25006' ? 'READONLY_VIOLATION'
    : networkCode || prismaCode === 'P1001' || prismaCode === 'P1002' || prismaCode === 'P2024' ? 'CONNECTION_FAILURE'
    : assertion(error) ? 'ASSERTION_MISMATCH'
    : prismaCode || sqlState ? 'DATABASE_ERROR' : 'UNCLASSIFIED';
  return { classification, prismaCode, sqlState, networkCode };
}
export function safeHttpOutcome(status: unknown, body: unknown) {
  const codes = new Set(['BAD_REQUEST', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'UNPROCESSABLE_ENTITY', 'INTERNAL_ERROR', 'TOO_MANY_REQUESTS', 'VALIDATION_ERROR', 'INVALID_STATUS_TRANSITION']);
  const code = own(body, 'code');
  return { status: typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
    code: typeof code === 'string' && codes.has(code) ? code : null };
}

export const ORIGINAL_IDENTITY_SQL = 'SELECT current_database() AS db,current_user AS role,host(inet_server_addr()) AS host,inet_server_port() AS port';
export const EXPECTED_IDENTITY = { db: 'flywithsafe_phase2_booking_integration', role: 'flywithsafe_phase2_booking_test', host: '127.0.0.1', port: 5432 };
export function compareIdentity(value: unknown) {
  const row = Array.isArray(value) && value.length === 1 ? value[0] : undefined;
  return { singleRow: !!row, databaseMatches: own(row, 'db') === EXPECTED_IDENTITY.db,
    roleMatches: own(row, 'role') === EXPECTED_IDENTITY.role, hostMatches: own(row, 'host') === EXPECTED_IDENTITY.host,
    portMatches: own(row, 'port') === EXPECTED_IDENTITY.port };
}
export function safeCounts(value: unknown) {
  const row = Array.isArray(value) && value.length === 1 ? value[0] : undefined;
  return Object.fromEntries(['users', 'sessions', 'bookings', 'passengers', 'history', 'idempotency', 'notifications', 'migrations'].map(key => {
    const count = own(row, key);
    return [key, typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 && count <= 2147483647 ? count : null];
  }));
}
export const COUNT_SQL = `SELECT
 (SELECT count(*)::int FROM public."User") AS users,
 (SELECT count(*)::int FROM public."Session") AS sessions,
 (SELECT count(*)::int FROM public."Booking") AS bookings,
 (SELECT count(*)::int FROM public."BookingPassenger") AS passengers,
 (SELECT count(*)::int FROM public."BookingStatusHistory") AS history,
 (SELECT count(*)::int FROM public."IdempotencyRecord") AS idempotency,
 (SELECT count(*)::int FROM public."NotificationOutbox") AS notifications,
 (SELECT count(migration_name)::int FROM public._prisma_migrations) AS migrations`;
export type ProbeStage = 'client-import' | 'read-only-guard' | 'identity-query' | 'identity-assertion' | 'session-identity' | 'catalog-counts' | 'clean-state-assertion' | 'complete';
export function readOnlyTarget(raw: string) {
  let target: URL;
  try { target = new URL(raw); } catch { throw new Error('PHASE2_READONLY_WRONG_TARGET'); }
  if (target.protocol !== 'postgresql:' || target.hostname !== EXPECTED_IDENTITY.host || target.port !== '5432' ||
      target.pathname !== '/' + EXPECTED_IDENTITY.db || target.username !== EXPECTED_IDENTITY.role || !target.password || target.search || target.hash)
    throw new Error('PHASE2_READONLY_WRONG_TARGET');
  target.searchParams.set('options', '-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=2000');
  return target.href;
}

export interface ProbeClient { query<T>(sql: string): Promise<T> }
export async function probeIdentity(client: ProbeClient, stage: (value: ProbeStage) => void, assertEqual: (actual: unknown, expected: unknown) => void) {
  stage('read-only-guard');
  assertEqual(await client.query("SELECT current_setting('transaction_read_only') AS read_only"), [{ read_only: 'on' }]);
  stage('identity-query');
  const identity = await client.query(ORIGINAL_IDENTITY_SQL);
  stage('identity-assertion');
  assertEqual(identity, [EXPECTED_IDENTITY]);
  stage('session-identity');
  assertEqual(await client.query('SELECT session_user::text AS session_user'), [{ session_user: EXPECTED_IDENTITY.role }]);
  stage('catalog-counts');
  const counts = await client.query(COUNT_SQL);
  stage('clean-state-assertion');
  assertEqual(counts, [{ users: 0, sessions: 0, bookings: 0, passengers: 0, history: 0, idempotency: 0, notifications: 0, migrations: 7 }]);
  stage('complete');
  return { identityMatched: true, readOnly: true, applicationRows: 0, migrations: 7 };
}
