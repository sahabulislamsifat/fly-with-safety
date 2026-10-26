/**
 * AUTH-02 G3-X ONLY. G3-H permits compiler/static/registration checks, not this suite's hooks.
 * No DB driver, env loader or application runtime is statically imported.
 * Missing execution approvals fail collection rather than producing a green skipped suite.
 * All legal decisions L-01--L-14 remain BLOCKED. This file grants no operational permission.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import dns from 'node:dns';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import workerThreads from 'node:worker_threads';
import { syncBuiltinESMExports } from 'node:module';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { Client, ClientBase, Pool, PoolConfig } from 'pg';
import type { PrismaClient, Prisma } from '../src/generated/prisma/client.js';

const DATABASE = 'flywithsafe_g3_auth02_disposable';
const ROLE = 'flywithsafe_g3_auth02_test';
type Environment = Readonly<Record<string, string | undefined>>;
type Purpose = 'verification' | 'reset';
type Outcome = 'success' | 'invalid' | 'internal';
type Evidence = 'REAL SERVICE' | 'REAL DB + HARNESS INJECTION' | 'SQL PREDICATE ONLY' | 'REAL SERVICE + SQL PREDICATE ONLY';
type Service = Pick<typeof import('../src/services/auth.service.js'), 'verifyEmail' | 'resetPassword'>;
type Profile = 'UTC' | 'Asia/Dhaka' | 'timeout';
interface Target { host: string; port: number; database: string; user: string; password: string }

function check(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`G3_${label}`);
}

/** Pure parser: errors never contain input/URL/credentials. No process env mutation or fallback. */
export function validateTarget(environment: Environment): Target {
  for (const flag of ['RUN_AUTH02_POSTGRES', 'G3_AUTH02_PREFLIGHT_APPROVED',
    'G3_AUTH02_WRITE_APPROVED', 'G3_AUTH02_CLEANUP_APPROVED',
    'G3_AUTH02_AUTHENTICATION_ISOLATION_APPROVED']) {
    check(environment[flag] === 'true', 'EXECUTION_NOT_APPROVED');
  }
  check(environment.NODE_ENV === 'test' && environment.G3_AUTH02_MODE === 'execute', 'MODE');
  check(environment.APPROVED_DISPOSABLE_DATABASE === DATABASE, 'DATABASE_DESIGNATION');
  check(environment.G3_AUTH02_APPROVED_PROFILES === 'normal,timeout,timezone', 'PROFILE_APPROVAL');
  check(environment.EMAIL_DELIVERY_ENABLED === 'false' && environment.OUTBOX_WORKER_ENABLED === 'false', 'DELIVERY_ENABLED');
  for (const key of Object.keys(environment)) {
    if (/^PG/.test(key) || /^(DEBUG|NODE_DEBUG|NODE_OPTIONS|PRISMA_LOG_QUERIES)$/.test(key)) {
      check(environment[key] === undefined || environment[key] === '', 'AMBIENT_OVERRIDE');
    }
  }
  const raw = environment.INTEGRATION_TEST_DATABASE_URL;
  check(typeof raw === 'string' && raw.length > 0, 'MISSING_TEST_TARGET');
  check(environment.DATABASE_URL === raw && environment.DIRECT_URL === raw, 'TARGET_MISMATCH');
  check(environment.G3_AUTH02_DATABASE_URL === raw, 'TARGET_MISMATCH');
  // Literal authority prevents URL normalization from admitting 127.1, encoded hosts or socket overrides.
  check(/^postgres(?:ql)?:\/\/flywithsafe_g3_auth02_test:[^@/?#]+@127\.0\.0\.1:5432\/flywithsafe_g3_auth02_disposable$/.test(raw), 'NONCANONICAL_TARGET');
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('G3_INVALID_TARGET'); }
  check(url.hostname === '127.0.0.1' && url.port === '5432' && url.pathname === `/${DATABASE}` &&
    !url.search && !url.hash && url.username === ROLE, 'WRONG_TARGET');
  let password: string;
  try { password = decodeURIComponent(url.password); } catch { throw new Error('G3_PRIVATE_AUTH_REQUIRED'); }
  check(password.length > 0 && !/[\r\n\0]/.test(password), 'PRIVATE_AUTH_REQUIRED');
  return { host: '127.0.0.1', port: 5432, database: DATABASE, user: ROLE, password };
}

/** Pure socket admission; unsupported overloads and normalized aliases fail closed. */
export function allowedEndpoint(args: readonly unknown[]): boolean {
  const first = args[0];
  if (typeof first === 'number') return first === 5432 && args[1] === '127.0.0.1';
  if (typeof first !== 'object' || first === null) return false;
  if (!('host' in first) || !('port' in first) || 'path' in first || 'socketPath' in first) return false;
  return first.host === '127.0.0.1' && first.port === 5432;
}

// Deliberately before hooks/driver imports/client constructors. G3-H must not execute hooks.
const offlineMode = process.env.G3_AUTH02_MODE === 'offline-check';
let target: Target | undefined;
if (!offlineMode) target = validateTarget(process.env);
const boundary = vi.hoisted(() => ({ installed: false, imported: false, forbidden: 0, output: 0 }));
vi.mock('../src/config/env.js', () => {
  check(boundary.installed, 'ENV_BEFORE_GUARDS');
  return { env: { nodeEnv: 'test', jwtSecret: 'synthetic-unused', frontendUrl: 'https://example.invalid',
    jwtExpiresIn: '15m', refreshTokenExpiresDays: 7, accessTokenCookieMaxAgeMs: 1000 } };
});
vi.mock('../src/services/notification.service.js', () => {
  check(boundary.installed, 'NOTIFICATION_BEFORE_GUARDS');
  const denied = () => { boundary.forbidden++; throw new Error('G3_NOTIFICATION_FORBIDDEN'); };
  return { sendEmailVerification: denied, sendPasswordReset: denied };
});
vi.mock('dotenv', () => { throw new Error('G3_DOTENV_FORBIDDEN'); });
vi.mock('nodemailer', () => { throw new Error('G3_SMTP_FORBIDDEN'); });
vi.mock('passport', () => { throw new Error('G3_OAUTH_RUNTIME_FORBIDDEN'); });

const undos: Array<() => void> = [];
let outboundDenied = 0;
function installGuards(): void {
  const replace = (object: object, key: string, value: unknown) => {
    const original = Object.getOwnPropertyDescriptor(object, key);
    Object.defineProperty(object, key, { configurable: true, writable: true, value });
    undos.push(() => original ? Object.defineProperty(object, key, original) : Reflect.deleteProperty(object, key));
  };
  const deny = () => { outboundDenied++; throw new Error('G3_OUTBOUND_FORBIDDEN'); };
  for (const [object, key] of [[net, 'connect'], [net, 'createConnection'], [net.Socket.prototype, 'connect']] as const) {
    const original: unknown = Reflect.get(object, key);
    check(typeof original === 'function', 'SOCKET_GUARD_UNAVAILABLE');
    replace(object, key, function (this: unknown, ...args: unknown[]) {
      if (!allowedEndpoint(args)) return deny();
      return Reflect.apply(original, this, args);
    });
  }
  replace(tls, 'connect', deny);
  replace(http2, 'connect', deny);
  for (const object of [http, https]) {
    replace(object, 'get', deny); replace(object, 'request', deny);
    replace(object.Agent.prototype, 'createConnection', deny);
  }
  for (const object of [dns, dns.promises, dns.Resolver.prototype, dns.promises.Resolver.prototype]) {
    for (const key of Object.getOwnPropertyNames(object)) {
      if (/^(lookup|lookupService|reverse|resolve)/.test(key) && typeof Reflect.get(object, key) === 'function') replace(object, key, deny);
    }
  }
  replace(dgram, 'createSocket', deny);
  replace(workerThreads, 'Worker', deny);
  for (const key of ['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork']) replace(childProcess, key, deny);
  replace(globalThis, 'fetch', deny);
  if ('WebSocket' in globalThis) replace(globalThis, 'WebSocket', deny);
  syncBuiltinESMExports(); boundary.installed = true;
  try { net.connect(1, '127.0.0.1'); } catch { /* Required denied probe; never dispatches. */ }
  check(outboundDenied === 1, 'GUARD_PROBE'); outboundDenied = 0;
  // Keep raw errors/parameters out of Vitest output. A suppressed console attempt fails the run.
  for (const key of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const spy = vi.spyOn(console, key).mockImplementation(() => { boundary.output++; });
    undos.push(() => spy.mockRestore());
  }
}

const migrations = [
  ['20260926202822_init', 'ad6f19d4e4562c0e2b9f616ba2f2470a28d3bfc2bdca20b611be938598de7e63'],
  ['20260927082715_full_schema', 'db3f1dd416c8f58f98ee0f3fa93dae8c5d699e93c3387f413ebd9d8ee52a04bb'],
  ['20261009000000_auth_sessions_and_password_resets', '4a2dbeb8ed993d62c542de82d3bbb3fe6f9dda12e44df86e2d13e6c36c231f11'],
  ['20261011000000_inquiry_idempotency', '409bb80db5028a3d12d291981120a8c5985c0991ff2741c41774c7b8b512014e'],
  ['20261011120000_notification_outbox', '4d25151678c8f11f7862159490aa53ff2bb248f21164c7f810ed2b320ef516a0'],
  ['20261022000100_contact_status_new', '4c9af2c97dd22a88cb3b7e5fe5422ac1023bcc86fcde999409033ac5180178a7'],
  ['20261022000200_booking_contact_schema', 'bc10e7343b3c40769c43deee8b3164245319a9f35d7a3b50d4e3ee721895f32b'],
] as const;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const text = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');
const lf = (value: string) => value.replace(/\r\n/g, '\n');
function sourcePreflight(): void {
  check(hash(lf(text('src/services/auth.service.ts'))) === 'f9ae219d767d8f47aafa5af34616f74232f1b45f60858020d867989fff715e32', 'ACCEPTED_SOURCE_CHANGED');
  const names = readdirSync(resolve(__dirname, '../prisma/migrations'), { withFileTypes: true })
    .filter(item => item.isDirectory()).map(item => item.name).sort();
  check(JSON.stringify(names) === JSON.stringify(migrations.map(([name]) => name)), 'MIGRATION_SET_CHANGED');
  for (const [name, expected] of migrations) check(hash(lf(text(`prisma/migrations/${name}/migration.sql`))) === expected, 'MIGRATION_CONTENT_CHANGED');
}

let Pg: typeof import('pg');
let PrismaConstructor: typeof import('../src/generated/prisma/client.js', { with: { 'resolution-mode': 'import' } }).PrismaClient;
let Adapter: typeof import('@prisma/adapter-pg', { with: { 'resolution-mode': 'import' } }).PrismaPg;
let bcrypt: { hash(value: string, rounds: number): Promise<string>; compare(value: string, digest: string): Promise<boolean> };
let fixtureDb: Client | undefined;
let blockerDb: Client | undefined;
let observerDb: Client | undefined;
let setup: Promise<void> | undefined;
let writable = false;
let aborted = false;
let runId = '';
let blockedTransaction = false;
let userSerial = 0;
const pools: Array<Pool | undefined> = [undefined, undefined];
const clients: Array<PrismaClient | undefined> = [undefined, undefined];
const services: Array<Service | undefined> = [undefined, undefined];
const ownPids = new Set<number>();
const servicePids = new Set<number>();
const active = new Set<Promise<Outcome>>();
interface Fixture { userId: string; tokenId: string; purpose: Purpose; token: string; email: string; password: string; sessions: string[] }
const ledger: Fixture[] = [];
let oldPasswordHash = '';

function db(which: 'fixture' | 'blocker' | 'observer'): Client {
  const client = which === 'fixture' ? fixtureDb : which === 'blocker' ? blockerDb : observerDb;
  check(client, 'CLIENT_NOT_READY'); return client;
}
function config(label: string, profile: Profile = 'UTC'): PoolConfig {
  validateTarget(process.env);
  const approved = target;
  check(approved, 'TARGET_NOT_APPROVED');
  return { ...approved, ssl: false, connectionTimeoutMillis: 2000, query_timeout: 8000,
    application_name: `g3-${runId}-${label}`, idleTimeoutMillis: 2000,
    options: `-c search_path=public -c lock_timeout=${profile === 'timeout' ? 5500 : 3500} -c statement_timeout=${profile === 'timeout' ? 5500 : 4500} -c idle_in_transaction_session_timeout=6000 -c timezone=${profile === 'Asia/Dhaka' ? 'Asia/Dhaka' : 'UTC'}` };
}
async function identity(client: ClientBase, serviceConnection = false): Promise<void> {
  const result = await client.query<{ database: string; username: string; session: string; host: string; port: number; pid: number }>(
    'SELECT current_database() AS database,current_user AS username,session_user AS session,host(inet_server_addr()) AS host,inet_server_port() AS port,pg_backend_pid() AS pid');
  const row = result.rows[0];
  check(row?.database === DATABASE && row.username === ROLE && row.session === ROLE && row.host === '127.0.0.1' && row.port === 5432, 'LIVE_IDENTITY');
  ownPids.add(row.pid); if (serviceConnection) servicePids.add(row.pid);
}
async function counts(): Promise<void> {
  const r = await db('fixture').query<{ clean: boolean }>(`SELECT
    NOT EXISTS(SELECT 1 FROM public."User") AND
    NOT EXISTS(SELECT 1 FROM public."EmailVerificationToken") AND
    NOT EXISTS(SELECT 1 FROM public."PasswordResetToken") AND
    NOT EXISTS(SELECT 1 FROM public."Session") AND
    NOT EXISTS(SELECT 1 FROM public."NotificationOutbox") AS clean`);
  check(r.rows[0]?.clean, 'NONEMPTY_TARGET_PRESERVE_RECORDS');
}

/** Catalog checks only; no fixture writes or service import until all checks pass. */
async function catalogPreflight(): Promise<void> {
  const c = db('fixture');
  await c.query('BEGIN READ ONLY');
  try {
    await identity(c);
    const role = await c.query<{ safe: boolean }>(`SELECT NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolreplication AND NOT rolbypassrls AND rolconnlimit BETWEEN 1 AND 20 AS safe
      FROM pg_roles WHERE rolname=current_user`);
    check(role.rows[0]?.safe, 'RESTRICTED_ROLE');
    const memberships = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_roles
      WHERE rolname<>current_user AND pg_has_role(current_user,oid,'MEMBER')`);
    check(memberships.rows[0]?.n === 0, 'ROLE_MEMBERSHIPS');
    const rights = await c.query<{ safe: boolean }>(`SELECT
      NOT has_database_privilege(current_user,current_database(),'CREATE') AND
      NOT has_database_privilege(current_user,current_database(),'TEMP') AND
      has_schema_privilege(current_user,'public','USAGE') AND
      NOT has_schema_privilege(current_user,'public','CREATE') AND
      (SELECT pg_get_userbyid(datdba)<>current_user FROM pg_database WHERE datname=current_database()) AS safe`);
    check(rights.rows[0]?.safe, 'ROLE_OWNERSHIP_OR_CREATE');
    const history = await c.query<{ migration_name: string; checksum: string; finished_at: unknown; rolled_back_at: unknown }>(
      'SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations" ORDER BY migration_name');
    check(history.rows.length === migrations.length, 'MIGRATION_HISTORY_COUNT');
    for (const [name] of migrations) {
      const rows = history.rows.filter(row => row.migration_name === name);
      const sql = text(`prisma/migrations/${name}/migration.sql`);
      check(rows.length === 1 && rows[0].finished_at && !rows[0].rolled_back_at &&
        [hash(sql), hash(lf(sql)), hash(lf(sql).replace(/\n/g, '\r\n'))].includes(rows[0].checksum), 'LIVE_MIGRATION_HISTORY');
    }
    const columns = await c.query<{ table_name: string; column_name: string; udt_name: string; is_nullable: string; datetime_precision: number | null; column_default: string | null }>(
      `SELECT table_name,column_name,udt_name,is_nullable,datetime_precision,column_default FROM information_schema.columns
       WHERE table_schema='public' AND table_name=ANY($1::text[])`, [['User','EmailVerificationToken','PasswordResetToken','Session']]);
    for (const table of ['User','EmailVerificationToken','PasswordResetToken','Session']) {
      for (const name of ['id', ...(table === 'User' ? ['email'] : ['userId'])]) {
        check(columns.rows.some(row => row.table_name === table && row.column_name === name && row.udt_name === 'text' && row.is_nullable === 'NO'), 'IDENTITY_COLUMN');
      }
      const times = table === 'User' ? ['createdAt','updatedAt'] : table === 'Session' ? ['expiresAt','revokedAt','createdAt','lastUsedAt'] : ['expiresAt','usedAt','createdAt'];
      for (const name of times) check(columns.rows.some(row => row.table_name === table && row.column_name === name && row.udt_name === 'timestamp' && row.datetime_precision === 3 && row.is_nullable === (['usedAt','revokedAt'].includes(name) ? 'YES' : 'NO')), 'TIMESTAMP_COLUMN');
    }
    check(columns.rows.some(row => row.table_name === 'User' && row.column_name === 'emailVerified' && row.udt_name === 'bool' && row.is_nullable === 'NO' && row.column_default === 'false'), 'VERIFIED_DEFAULT');
    check(columns.rows.some(row => row.table_name === 'User' && row.column_name === 'password' && row.udt_name === 'text' && row.is_nullable === 'YES'), 'PASSWORD_COLUMN');
    const hasCurrentTimestampDefault = (table: string, name: string) => columns.rows.some(row =>
      row.table_name === table && row.column_name === name && row.column_default?.toLowerCase().includes('current_timestamp'));
    check(hasCurrentTimestampDefault('User','createdAt') &&
      columns.rows.some(row => row.table_name === 'User' && row.column_name === 'role' && row.column_default?.includes('CUSTOMER')), 'USER_DEFAULTS');
    for (const table of ['EmailVerificationToken','PasswordResetToken']) check(hasCurrentTimestampDefault(table,'createdAt'), 'TOKEN_CREATED_DEFAULT');
    check(hasCurrentTimestampDefault('Session','createdAt') && hasCurrentTimestampDefault('Session','lastUsedAt'), 'SESSION_CREATED_DEFAULTS');
    for (const [table, name] of [['EmailVerificationToken','token'],['PasswordResetToken','tokenHash'],['Session','refreshTokenHash']]) {
      check(columns.rows.some(row => row.table_name === table && row.column_name === name && row.udt_name === 'text' && row.is_nullable === 'NO'), 'CREDENTIAL_COLUMN');
    }
    const indexes = await c.query<{ table_name: string; columns: string[]; indisunique: boolean; indisprimary: boolean; usable: boolean }>(`SELECT t.relname AS table_name,i.indisunique,i.indisprimary,
      i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL AND am.amname='btree' AS usable,
      ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY k(num,ord)
      JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.num ORDER BY k.ord) AS columns
      FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_class idx ON idx.oid=i.indexrelid JOIN pg_am am ON am.oid=idx.relam WHERE n.nspname='public'`);
    for (const table of ['User','EmailVerificationToken','PasswordResetToken','Session']) {
      check(indexes.rows.some(row => row.table_name === table && row.usable && row.indisprimary && row.indisunique && row.columns.join() === 'id'), 'PRIMARY_INDEX');
    }
    for (const [table, column, unique] of [['User','email',true],['User','email',false],['EmailVerificationToken','token',true],['EmailVerificationToken','token',false],
      ['PasswordResetToken','tokenHash',true],['Session','refreshTokenHash',true],
      ['EmailVerificationToken','userId',false],['PasswordResetToken','userId',false],['Session','userId',false],['Session','expiresAt',false]] as const) {
      check(indexes.rows.some(row => row.table_name === table && row.usable && row.indisunique === unique && row.columns.join() === column), 'REQUIRED_INDEX');
    }
    const fks = await c.query<{ name: string; safe: boolean }>(`SELECT t.relname AS name,
      k.convalidated AND k.confdeltype='c' AND k.confupdtype='c' AND k.confrelid='public."User"'::regclass
      AND ARRAY(SELECT a.attname::text FROM unnest(k.conkey) x(n) JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=x.n)=ARRAY['userId']::text[]
      AND ARRAY(SELECT a.attname::text FROM unnest(k.confkey) x(n) JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=x.n)=ARRAY['id']::text[] AS safe
      FROM pg_constraint k JOIN pg_class t ON t.oid=k.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE k.contype='f' AND n.nspname='public'`);
    for (const name of ['EmailVerificationToken','PasswordResetToken','Session']) {
      const matches = fks.rows.filter(row => row.name === name);
      check(matches.length === 1 && matches[0].safe, 'AUTH_FK');
    }
    const enumValues = await c.query<{ enumlabel: string }>(`SELECT e.enumlabel FROM pg_type t
      JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid
      WHERE n.nspname='public' AND t.typname='UserRole' ORDER BY e.enumsortorder`);
    check(enumValues.rows.map(row => row.enumlabel).join(',') === 'CUSTOMER,STAFF,ADMIN', 'USER_ROLE_ENUM');
    const hooks = await c.query<{ unsafe: boolean }>(`SELECT
      EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal) OR
      EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND (c.relrowsecurity OR c.relforcerowsecurity OR c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user))) OR
      EXISTS(SELECT 1 FROM pg_rules WHERE schemaname='public') OR
      EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public') OR
      EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef) OR
      EXISTS(SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE n.nspname='public') AS unsafe`);
    check(hooks.rows[0]?.unsafe === false, 'UNEXPECTED_HOOKS_OWNERSHIP');
    const tables = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')`);
    check(tables.rows[0]?.n === 20, 'TABLE_INVENTORY');
    const activity = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()`);
    check(activity.rows[0]?.n === 0, 'EXCLUSIVE_TARGET');
    const privileges = await c.query<{ table_name: string; can_insert: boolean; can_update: boolean; can_delete: boolean; can_truncate: boolean }>(`SELECT c.relname AS table_name,
      has_table_privilege(current_user,c.oid,'INSERT') AS can_insert,
      has_table_privilege(current_user,c.oid,'UPDATE') AS can_update,
      has_table_privilege(current_user,c.oid,'DELETE') AS can_delete,
      has_table_privilege(current_user,c.oid,'TRUNCATE') AS can_truncate
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p')`);
    const writableTables = new Set(['User','EmailVerificationToken','PasswordResetToken','Session']);
    check(privileges.rows.length === tables.rows[0]?.n, 'TABLE_PRIVILEGE_COVERAGE');
    for (const row of privileges.rows) {
      check(!row.can_truncate, 'NO_TRUNCATE_PRIVILEGE');
      if (writableTables.has(row.table_name)) check(row.can_insert && row.can_update && row.can_delete, 'AUTH_FIXTURE_DML');
      else check(!row.can_insert && !row.can_update && !row.can_delete, 'OUT_OF_SCOPE_DML');
    }
    await counts();
  } finally { await c.query('ROLLBACK'); }
}

async function bindService(client: object): Promise<Service> {
  check(boundary.installed && writable, 'IMPORT_GATE');
  vi.resetModules();
  vi.doMock('../src/lib/prisma.js', () => ({ prisma: client }));
  const module = await import('../src/services/auth.service.js');
  boundary.imported = true;
  return { verifyEmail: module.verifyEmail, resetPassword: module.resetPassword };
}
async function openPool(index: number, profile: Profile): Promise<void> {
  if (clients[index]) await clients[index].$disconnect();
  if (pools[index]) await pools[index].end();
  const pool = new Pg.Pool({ ...config(`svc${index}`, profile), max: 8,
    onConnect: async client => { await identity(client, true); } });
  pool.on('error', () => { aborted = true; }); pools[index] = pool;
  // Installed pg-pool awaits onConnect before delivering any client (offline source-checked).
  const prisma = new PrismaConstructor({ adapter: new Adapter(pool, { disposeExternalPool: false }) });
  clients[index] = prisma;
  services[index] = await bindService(prisma);
  const probe = await prisma.$queryRaw<Array<{ level: string; timezone: string; schemas: string }>>`SELECT current_setting('transaction_isolation') AS level,current_setting('TimeZone') AS timezone,current_schemas(false)::text AS schemas`;
  check(probe[0]?.level === 'read committed' && probe[0].timezone === (profile === 'Asia/Dhaka' ? 'Asia/Dhaka' : 'UTC') && probe[0].schemas === '{public}', 'POOL_PROFILE');
}

if (!offlineMode) {
beforeAll(() => {
  setup = (async () => {
    validateTarget(process.env); sourcePreflight(); installGuards();
    // First runtime driver imports and constructors: unreachable without all execution opt-ins.
    Pg = await import('pg');
    runId = randomUUID().slice(0, 12);
    fixtureDb = new Pg.Client(config('fixture'));
    await fixtureDb.connect(); await catalogPreflight();
    observerDb = new Pg.Client(config('observer')); blockerDb = new Pg.Client(config('blocker'));
    await observerDb.connect(); await identity(observerDb);
    await blockerDb.connect(); await identity(blockerDb);
    const generated = await import('../src/generated/prisma/client.js'); PrismaConstructor = generated.PrismaClient;
    Adapter = (await import('@prisma/adapter-pg')).PrismaPg;
    const bcryptModule = await import('bcryptjs');
    bcrypt = { hash: bcryptModule.hash, compare: bcryptModule.compare };
    oldPasswordHash = await bcrypt.hash('SyntheticPreviousPassword42', 12);
    writable = true;
    await openPool(0, 'UTC'); await openPool(1, 'Asia/Dhaka');
    check(boundary.installed && boundary.imported && ownPids.size >= 5, 'CLIENT_AFFINITY');
  })().catch(() => { aborted = true; throw new Error('G3_SETUP_FAILED_NO_TESTS_AUTHORIZED_TO_CONTINUE'); });
  return setup;
});
beforeEach(() => { check(!aborted && writable, 'ABORTED'); });
afterEach(context => {
  if (context.task.result?.state === 'fail' || boundary.forbidden || boundary.output || outboundDenied) aborted = true;
  check(!boundary.forbidden && !boundary.output && !outboundDenied, 'UNEXPECTED_EXTERNAL_OR_OUTPUT_ATTEMPT');
});
}

async function fixture(purpose: Purpose, seconds = 60, legacy = false, tokenOverride?: string): Promise<Fixture> {
  check(writable && !aborted, 'FIXTURE_GATE'); validateTarget(process.env);
  const id = `g3-${runId}-${++userSerial}`;
  const f: Fixture = { userId: `${id}-user`, tokenId: `${id}-token`, purpose,
    token: tokenOverride ?? randomBytes(48).toString('base64url'), email: `${id}@example.invalid`,
    password: `SyntheticNew${randomBytes(12).toString('hex')}A9`, sessions: [`${id}-s0`, `${id}-s1`, `${id}-old`] };
  ledger.push(f); // Before the first awaited INSERT; partial setup remains attributable.
  const c = db('fixture'); await c.query('BEGIN');
  try {
    await c.query(`INSERT INTO public."User" (id,email,password,name,role,"emailVerified","createdAt","updatedAt") VALUES ($1,$2,$3,'Synthetic G3','CUSTOMER',false,clock_timestamp() AT TIME ZONE 'UTC',clock_timestamp() AT TIME ZONE 'UTC')`, [f.userId,f.email,oldPasswordHash]);
    if (purpose === 'verification') await c.query(`INSERT INTO public."EmailVerificationToken" (id,token,"userId","expiresAt") VALUES ($1,$2,$3,(clock_timestamp() AT TIME ZONE 'UTC')+($4::int * interval '1 second'))`, [f.tokenId,legacy ? f.token : hash(f.token),f.userId,seconds]);
    else await c.query(`INSERT INTO public."PasswordResetToken" (id,"tokenHash","userId","expiresAt") VALUES ($1,$2,$3,(clock_timestamp() AT TIME ZONE 'UTC')+($4::int * interval '1 second'))`, [f.tokenId,hash(f.token),f.userId,seconds]);
    for (let i = 0; i < f.sessions.length; i++) await c.query(`INSERT INTO public."Session" (id,"userId","refreshTokenHash","expiresAt","revokedAt") VALUES ($1,$2,$3,(clock_timestamp() AT TIME ZONE 'UTC')+interval '1 day',CASE WHEN $4::bool THEN clock_timestamp() AT TIME ZONE 'UTC' ELSE NULL END)`, [f.sessions[i],f.userId,hash(`${f.userId}-${f.token}-session-${i}`),i === 2]);
    await c.query('COMMIT'); return f;
  } catch { await c.query('ROLLBACK'); throw new Error('G3_FIXTURE_FAILED'); }
}
function instance(index = 0): Service { const s = services[index]; check(s, 'SERVICE_NOT_READY'); return s; }
function redeem(f: Fixture, service = instance()): Promise<Outcome> {
  const operation = f.purpose === 'verification' ? service.verifyEmail(f.token) : service.resetPassword({ token: f.token, password: f.password });
  const observed = operation.then<Outcome, Outcome>(() => 'success', (error: unknown) => {
    if (typeof error !== 'object' || error === null || !('statusCode' in error) || !('message' in error)) return 'internal';
    const expected = f.purpose === 'verification' ? 'This verification link is invalid or expired.' : 'This password reset link is invalid or expired.';
    if (error.statusCode === 400 && error.message === expected) return 'invalid';
    check(error.statusCode === 500 && error.message === 'Internal server error' && !('cause' in error), 'UNSANITIZED_SERVICE_ERROR');
    return 'internal';
  });
  active.add(observed); void observed.finally(() => active.delete(observed)).catch(() => undefined);
  return observed;
}
async function stored(f: Fixture, consumed: boolean, serviceApplied = consumed): Promise<void> {
  const c = db('observer'); await identity(c);
  const users = await c.query<{ password: string; emailVerified: boolean }>('SELECT password,"emailVerified" FROM public."User" WHERE id=$1', [f.userId]);
  check(users.rows.length === 1, 'USER_DISAPPEARED');
  const tokens = f.purpose === 'verification'
    ? await c.query<{ used: boolean }>('SELECT "usedAt" IS NOT NULL AS used FROM public."EmailVerificationToken" WHERE id=$1 AND "userId"=$2', [f.tokenId,f.userId])
    : await c.query<{ used: boolean }>('SELECT "usedAt" IS NOT NULL AS used FROM public."PasswordResetToken" WHERE id=$1 AND "userId"=$2', [f.tokenId,f.userId]);
  check(tokens.rows.length === 1 && tokens.rows[0].used === consumed, 'CONSUMPTION_STATE');
  check(users.rows[0].emailVerified === (serviceApplied && f.purpose === 'verification'), 'VERIFICATION_STATE');
  check(await bcrypt.compare(serviceApplied && f.purpose === 'reset' ? f.password : 'SyntheticPreviousPassword42', users.rows[0].password), 'PASSWORD_STATE');
  const sessions = await c.query<{ id: string; revoked: boolean }>('SELECT id,"revokedAt" IS NOT NULL AS revoked FROM public."Session" WHERE "userId"=$1 ORDER BY id', [f.userId]);
  check(sessions.rows.length === f.sessions.length && sessions.rows.every(row => row.revoked === (row.id.endsWith('-old') || serviceApplied && f.purpose === 'reset')), 'SESSION_STATE');
}
async function lock(f: Fixture, table: 'token' | 'user' | 'session' = 'token'): Promise<void> {
  check(!blockedTransaction, 'BLOCKER_ALREADY_ACTIVE'); const c = db('blocker');
  await c.query('BEGIN'); blockedTransaction = true;
  if (table === 'user') await c.query('SELECT id FROM public."User" WHERE id=$1 FOR UPDATE', [f.userId]);
  else if (table === 'session') await c.query('SELECT id FROM public."Session" WHERE id=$1 FOR UPDATE', [f.sessions[0]]);
  else if (f.purpose === 'verification') await c.query('SELECT id FROM public."EmailVerificationToken" WHERE id=$1 FOR UPDATE', [f.tokenId]);
  else await c.query('SELECT id FROM public."PasswordResetToken" WHERE id=$1 FOR UPDATE', [f.tokenId]);
}
async function release(commit = false): Promise<void> {
  if (!blockedTransaction) return;
  try { await db('blocker').query(commit ? 'COMMIT' : 'ROLLBACK'); blockedTransaction = false; }
  catch { aborted = true; throw new Error('G3_BLOCKER_RELEASE_FAILED_PRESERVE_FIXTURES'); }
}
async function waiting(minimum = 1, deadlineMs = 1500): Promise<void> {
  const start = performance.now();
  while (performance.now() - start < deadlineMs) {
    const r = await db('observer').query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE datname=current_database() AND usename=current_user AND pid=ANY($1::int[]) AND wait_event_type='Lock' AND cardinality(pg_blocking_pids(pid))>0`, [[...servicePids]]);
    if (r.rows[0]?.n >= minimum) return;
    if (blockedTransaction) await db('blocker').query('SELECT 1');
    await delay(20); // Bounded polling of actual lock evidence, never a guessed synchronization sleep.
  }
  throw new Error('G3_LOCK_BARRIER_INCONCLUSIVE');
}
async function expiryPassed(f: Fixture): Promise<void> {
  const start = performance.now();
  while (performance.now() - start < 3000) {
    const r = f.purpose === 'verification'
      ? await db('observer').query<{ expired: boolean }>('SELECT "expiresAt" < clock_timestamp() AT TIME ZONE \'UTC\' AS expired FROM public."EmailVerificationToken" WHERE id=$1', [f.tokenId])
      : await db('observer').query<{ expired: boolean }>('SELECT "expiresAt" < clock_timestamp() AT TIME ZONE \'UTC\' AS expired FROM public."PasswordResetToken" WHERE id=$1', [f.tokenId]);
    if (r.rows[0]?.expired) return;
    await db('blocker').query('SELECT 1'); await delay(20);
  }
  throw new Error('G3_EXPIRY_BARRIER_INCONCLUSIVE');
}

/** Only injected cases use this facade. All queries/effects/commit/rollback remain real Prisma. */
async function injected(index: number, fault: 'before-commit' | 'after-commit'): Promise<Service> {
  const client = clients[index]; check(client, 'CLIENT_NOT_READY');
  const facade: object = {};
  for (const key of ['emailVerificationToken','passwordResetToken'] as const) Object.defineProperty(facade, key, { value: client[key] });
  Object.defineProperty(facade, '$transaction', { value: async (
    callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
    options: { isolationLevel: 'ReadCommitted'; maxWait: number; timeout: number },
  ) => {
    const result = await client.$transaction(async tx => {
      const value = await callback(tx);
      if (fault === 'before-commit') throw new Error('G3_CONTROLLED_PRECOMMIT');
      return value;
    }, options);
    if (fault === 'after-commit') throw new Error('G3_MODELED_ACK_LOSS');
    return result;
  } });
  return bindService(facade);
}
function scenario(id: string, evidence: Evidence, operation: () => Promise<void>): void {
  it(`${id} [${evidence}]`, async () => {
    try { await operation(); }
    catch { aborted = true; throw new Error(`G3_${id.replace(/[^A-Z0-9-]/g, '_')}_FAILED_REQUIRES_REVIEW`); }
    finally { await release(); }
  });
}
function blocked(id: string, reason: string): void { it.skip(`${id} [BLOCKED: ${reason}]`, () => {}); }

const databaseDescribe = offlineMode ? describe.skip : describe;
databaseDescribe('AUTH-02 PostgreSQL verification — separate G3-X authorization required', () => {
  for (const purpose of ['verification','reset'] as const) {
    describe(purpose, () => {
      scenario('LOCK-01', 'REAL SERVICE', async () => {
        const f = await fixture(purpose); check(await redeem(f) === 'success', 'FIRST_CONSUME');
        check(await redeem(f, instance(1)) === 'invalid', 'REUSE'); await stored(f, true);
      });
      if (purpose === 'verification') {
        scenario('LOCK-01-LEGACY-RAW', 'REAL SERVICE', async () => {
          const f = await fixture('verification',60,true); check(await redeem(f) === 'success', 'LEGACY_RAW_SINGLE_MATCH'); await stored(f,true);
        });
        scenario('LOCK-01-AMBIGUOUS-LEGACY', 'REAL SERVICE', async () => {
          const shared = randomBytes(48).toString('base64url');
          const hashed = await fixture('verification',60,false,shared);
          const legacy = await fixture('verification',60,true,shared);
          check(await redeem(hashed) === 'invalid', 'AMBIGUOUS_LEGACY_REJECTED');
          await stored(hashed,false); await stored(legacy,false);
        });
      }
      scenario('LOCK-02', 'REAL SERVICE', async () => {
        const f = await fixture(purpose); await lock(f);
        const a = redeem(f), b = redeem(f, instance(1));
        try { await waiting(2); } finally { await release(); }
        const results = await Promise.all([a,b]);
        check(results.filter(x => x === 'success').length === 1 && results.filter(x => x === 'invalid').length === 1, 'TWO_WINNERS');
        await stored(f, true);
      });
      for (const concurrency of [2,8,16]) for (let repeat = 1; repeat <= 3; repeat++) {
        scenario(`LOCK-03-C${concurrency}-R${repeat}`, 'REAL SERVICE', async () => {
          const f = await fixture(purpose); await lock(f);
          const jobs = Array.from({ length: concurrency }, (_, n) => redeem(f, instance(n % 2)));
          try { await waiting(concurrency); } finally { await release(); }
          const results = await Promise.all(jobs);
          check(results.filter(x => x === 'success').length === 1 && results.filter(x => x === 'invalid').length === concurrency - 1, 'CONTENTION_OUTCOMES');
          await stored(f, true);
        });
      }
      scenario('LOCK-04', 'REAL SERVICE', async () => {
        const f = await fixture(purpose); await lock(f); const job = redeem(f);
        try { await waiting(); } finally { await release(); }
        check(await job === 'success', 'UNCHANGED_LOCK_RELEASE'); await stored(f, true);
      });
      scenario('LOCK-04-CONSUMED', 'REAL SERVICE', async () => {
        const f = await fixture(purpose); await lock(f); const job = redeem(f); await waiting();
        if (purpose === 'verification') await db('blocker').query('UPDATE public."EmailVerificationToken" SET "usedAt"=clock_timestamp() AT TIME ZONE \'UTC\' WHERE id=$1', [f.tokenId]);
        else await db('blocker').query('UPDATE public."PasswordResetToken" SET "usedAt"=clock_timestamp() AT TIME ZONE \'UTC\' WHERE id=$1', [f.tokenId]);
        await release(true); check(await job === 'invalid', 'LOCKED_ROW_RECHECK'); await stored(f, true, false);
      });
      scenario('LOCK-05', 'REAL SERVICE', async () => {
        const f = await fixture(purpose); await lock(f); const start = performance.now(); const result = await redeem(f);
        check(result === 'internal' && performance.now() - start < 7500, 'LOCK_TIMEOUT');
        await release(); await stored(f, false);
      });
      scenario('LOCK-06', 'REAL SERVICE', async () => {
        const f = await fixture(purpose), other = await fixture(purpose); await lock(f); const pending = redeem(f);
        await waiting(); check(await redeem(other, instance(1)) === 'success', 'UNRELATED_SERIALIZED');
        await stored(other, true); await release(); check(await pending === 'success', 'FIRST_RELEASE');
      });
      scenario(purpose === 'verification' ? 'TX-01' : 'TX-02', 'REAL SERVICE', async () => {
        const f = await fixture(purpose), other = await fixture(purpose);
        const unrelated = purpose === 'reset' ? await fixture('reset') : undefined;
        check(await redeem(f) === 'success', 'ATOMIC_SUCCESS'); await stored(f, true); await stored(other, false);
        if (unrelated) await stored(unrelated, false);
      });
      scenario('TX-03', 'REAL SERVICE', async () => {
        const f = await fixture(purpose); await lock(f); const job = redeem(f); await waiting();
        if (purpose === 'verification') await db('blocker').query('UPDATE public."EmailVerificationToken" SET "usedAt"=clock_timestamp() AT TIME ZONE \'UTC\' WHERE id=$1', [f.tokenId]);
        else await db('blocker').query('UPDATE public."PasswordResetToken" SET "usedAt"=clock_timestamp() AT TIME ZONE \'UTC\' WHERE id=$1', [f.tokenId]);
        await release(true); check(await job === 'invalid', 'CONDITIONAL_LOSER');
        // Holder consumed it; the service must leave all account effects unchanged.
        const u = await db('observer').query<{ emailVerified: boolean; password: string }>('SELECT "emailVerified",password FROM public."User" WHERE id=$1', [f.userId]);
        check(!u.rows[0].emailVerified && await bcrypt.compare('SyntheticPreviousPassword42', u.rows[0].password), 'LOSER_EFFECT');
        await stored(f, true, false);
      });
      scenario('TX-04', 'REAL SERVICE', async () => {
        const f = await fixture(purpose), other = await fixture(purpose); await lock(f, 'user'); const job = redeem(f); await waiting();
        check(await job === 'internal', 'USER_LOCK_FAILURE'); await release(); await stored(f, false);
        check(await redeem(other, instance(1)) === 'success', 'POOL_RECOVERY_AFTER_TX04'); await stored(other, true);
      });
      scenario('TX-05', 'REAL DB + HARNESS INJECTION', async () => {
        const f = await fixture(purpose); check(await redeem(f, await injected(0, 'before-commit')) === 'internal', 'CALLBACK_EXCEPTION'); await stored(f, false);
      });
      scenario('TX-06-COMMIT', 'REAL SERVICE', async () => {
        const f = await fixture(purpose); await lock(f); const jobs = [redeem(f), redeem(f, instance(1))];
        await waiting(2);
        if (purpose === 'verification') await db('blocker').query('UPDATE public."EmailVerificationToken" SET "usedAt"=clock_timestamp() AT TIME ZONE \'UTC\' WHERE id=$1', [f.tokenId]);
        else await db('blocker').query('UPDATE public."PasswordResetToken" SET "usedAt"=clock_timestamp() AT TIME ZONE \'UTC\' WHERE id=$1', [f.tokenId]);
        await release(true); check((await Promise.all(jobs)).every(result => result === 'invalid'), 'COMMITTED_HOLDER_WINS');
        await stored(f, true, false);
      });
      scenario('TX-06-ROLLBACK', 'REAL SERVICE', async () => {
        const f = await fixture(purpose); await lock(f); const jobs = [redeem(f), redeem(f, instance(1))];
        try { await waiting(2); } finally { await release(); }
        const results = await Promise.all(jobs);
        check(results.filter(result => result === 'success').length === 1 && results.filter(result => result === 'invalid').length === 1, 'ROLLED_BACK_HOLDER_RETRY');
        await stored(f, true);
      });
      scenario('TX-09', 'REAL SERVICE', async () => {
        const f = await fixture(purpose); await lock(f, 'user'); const pending = redeem(f); await waiting();
        await db('blocker').query('UPDATE public."User" SET name=$2 WHERE id=$1', [f.userId,'Synthetic concurrent name']);
        await release(true); check(await pending === 'success', 'CONCURRENT_NONKEY'); await stored(f, true);
        const r = await db('observer').query<{ intact: boolean }>('SELECT name=$2 AS intact FROM public."User" WHERE id=$1', [f.userId,'Synthetic concurrent name']);
        check(r.rows[0]?.intact, 'UNRELATED_FIELD_OVERWRITTEN');
      });
      scenario('TX-09-DELETE', 'REAL SERVICE', async () => {
        const f = await fixture(purpose); const blocker = db('blocker'); await blocker.query('BEGIN'); blockedTransaction = true;
        await blocker.query('DELETE FROM public."User" WHERE id=$1', [f.userId]);
        const pending = redeem(f); await waiting(); await release(true);
        check(await pending === 'invalid', 'DELETED_CREDENTIAL_BOUND_USER');
        const rows = purpose === 'verification'
          ? await db('observer').query<{ userCount: number; tokenCount: number; sessionCount: number }>(`SELECT
              (SELECT count(*)::int FROM public."User" WHERE id=$1) AS "userCount",
              (SELECT count(*)::int FROM public."EmailVerificationToken" WHERE id=$2) AS "tokenCount",
              (SELECT count(*)::int FROM public."Session" WHERE "userId"=$1) AS "sessionCount"`, [f.userId,f.tokenId])
          : await db('observer').query<{ userCount: number; tokenCount: number; sessionCount: number }>(`SELECT
              (SELECT count(*)::int FROM public."User" WHERE id=$1) AS "userCount",
              (SELECT count(*)::int FROM public."PasswordResetToken" WHERE id=$2) AS "tokenCount",
              (SELECT count(*)::int FROM public."Session" WHERE "userId"=$1) AS "sessionCount"`, [f.userId,f.tokenId]);
        check(rows.rows[0]?.userCount === 0 && rows.rows[0].tokenCount === 0 && rows.rows[0].sessionCount === 0, 'DELETE_CASCADE_FIXTURE_ONLY');
      });
      scenario('TX-10', 'REAL DB + HARNESS INJECTION', async () => {
        const f = await fixture(purpose); check(await redeem(f, await injected(0, 'before-commit')) === 'internal', 'FAILED_ATTEMPT');
        check(await redeem(f, instance(1)) === 'success', 'ROLLBACK_RETRY');
        check(await redeem(f, instance()) === 'invalid', 'COMMIT_RETRY'); await stored(f, true);
      });
      scenario('UTC-01', 'REAL SERVICE', async () => { const f = await fixture(purpose); check(await redeem(f) === 'success', 'FUTURE_EXPIRY'); await stored(f, true); });
      scenario('UTC-02', 'REAL SERVICE', async () => { const f = await fixture(purpose,-60); check(await redeem(f) === 'invalid', 'PAST_EXPIRY'); await stored(f, false); });
      scenario('UTC-03', 'REAL SERVICE', async () => {
        const f = await fixture(purpose,3); await lock(f); const job = redeem(f);
        await waiting();
        const before = purpose === 'verification'
          ? await db('observer').query<{ future: boolean }>('SELECT "expiresAt">clock_timestamp() AT TIME ZONE \'UTC\' AS future FROM public."EmailVerificationToken" WHERE id=$1', [f.tokenId])
          : await db('observer').query<{ future: boolean }>('SELECT "expiresAt">clock_timestamp() AT TIME ZONE \'UTC\' AS future FROM public."PasswordResetToken" WHERE id=$1', [f.tokenId]);
        check(before.rows[0]?.future, 'WAIT_STARTED_TOO_LATE');
        await expiryPassed(f); await release(); check(await job === 'invalid', 'POSTLOCK_EXPIRY'); await stored(f, false);
      });
      scenario('UTC-05', 'REAL SERVICE', async () => {
        const f = await fixture(purpose,3); await lock(f); const job = redeem(f); await waiting();
        const table = purpose === 'verification' ? 'EmailVerificationToken' : 'PasswordResetToken';
        const timing = await db('observer').query<{ startedBeforeExpiry: boolean; stillFuture: boolean }>(`SELECT
          a.xact_start < (t."expiresAt" AT TIME ZONE 'UTC') AS "startedBeforeExpiry",
          t."expiresAt" > clock_timestamp() AT TIME ZONE 'UTC' AS "stillFuture"
          FROM pg_stat_activity a CROSS JOIN public."${table}" t
          WHERE a.datname=current_database() AND a.pid=ANY($1::int[]) AND a.wait_event_type='Lock'
            AND t.id=$2 AND cardinality(pg_blocking_pids(a.pid))>0`, [[...servicePids],f.tokenId]);
        check(timing.rows.length > 0 && timing.rows.every(row => row.startedBeforeExpiry && row.stillFuture), 'TX_START_BEFORE_EXPIRY');
        await expiryPassed(f); await release(); check(await job === 'invalid', 'TX_START_CANNOT_AUTHORIZE'); await stored(f, false);
      });
      scenario('UTC-06', 'REAL SERVICE', async () => {
        for (const index of [0,1]) for (const seconds of [60,-60]) {
          const f = await fixture(purpose,seconds); check(await redeem(f, instance(index)) === (seconds > 0 ? 'success' : 'invalid'), 'TIMEZONE_CHANGED_ELIGIBILITY'); await stored(f, seconds > 0);
        }
      });
      scenario('UTC-08', 'REAL SERVICE', async () => {
        const future = await fixture(purpose), past = await fixture(purpose,-60);
        const spy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 86400000);
        try { check(await redeem(future) === 'success' && await redeem(past) === 'invalid', 'APPLICATION_CLOCK_AUTHORITY'); }
        finally { spy.mockRestore(); }
        await stored(future, true); await stored(past, false);
      });
      scenario('UTC-07', 'REAL SERVICE + SQL PREDICATE ONLY', async () => {
        const r = await db('observer').query<{ precise: boolean }>(`WITH c AS MATERIALIZED (SELECT clock_timestamp() AT TIME ZONE 'UTC' AS t) SELECT
          date_trunc('milliseconds',t)<=t AND t-date_trunc('milliseconds',t)<interval '1 millisecond'
          AND timestamp '2030-01-01 00:00:00.000499'::timestamp(3)=timestamp '2030-01-01'
          AND timestamp '2030-01-01 00:00:00.000501'::timestamp(3)=timestamp '2030-01-01 00:00:00.001' AS precise FROM c`);
        check(r.rows[0]?.precise, 'TIMESTAMP_PRECISION');
        const f = await fixture(purpose); check(await redeem(f) === 'success', 'PRECISION_SERVICE');
        const used = purpose === 'verification'
          ? await db('observer').query<{ precise: boolean }>('SELECT "usedAt"=date_trunc(\'milliseconds\',"usedAt") AS precise FROM public."EmailVerificationToken" WHERE id=$1', [f.tokenId])
          : await db('observer').query<{ precise: boolean }>('SELECT "usedAt"=date_trunc(\'milliseconds\',"usedAt") AS precise FROM public."PasswordResetToken" WHERE id=$1', [f.tokenId]);
        check(used.rows[0]?.precise, 'PERSISTED_PRECISION');
      });
      scenario('COMMIT-01', 'REAL SERVICE', async () => { const f = await fixture(purpose); check(await redeem(f) === 'success', 'COMMIT'); await stored(f, true); });
      scenario('COMMIT-02', 'REAL SERVICE', async () => {
        const f = await fixture(purpose); await lock(f, 'user'); const pending = redeem(f);
        await waiting(); check(await pending === 'internal', 'COMMIT_DEPENDENT_EFFECT_FAILURE');
        await release(); await stored(f, false);
      });
      scenario('COMMIT-03', 'REAL DB + HARNESS INJECTION', async () => {
        const f = await fixture(purpose); check(await redeem(f, await injected(0,'before-commit')) === 'internal', 'PRECOMMIT_FAILURE'); await stored(f, false);
      });
      scenario('COMMIT-04', 'REAL DB + HARNESS INJECTION', async () => {
        const f = await fixture(purpose); check(await redeem(f, await injected(0,'after-commit')) === 'internal', 'MODELED_ACK_LOSS'); await stored(f, true);
      });
      scenario('COMMIT-05', 'REAL DB + HARNESS INJECTION', async () => {
        const f = await fixture(purpose); check(await redeem(f, await injected(0,'after-commit')) === 'internal', 'MODELED_ACK_LOSS');
        await stored(f, true); check(await redeem(f, instance(1)) === 'invalid', 'ACK_LOSS_REPLAY'); await stored(f, true);
      });
      scenario('COMMIT-06', 'REAL DB + HARNESS INJECTION', async () => {
        const rolled = await fixture(purpose), committed = await fixture(purpose);
        check(await redeem(rolled, await injected(0,'before-commit')) === 'internal', 'FAILURE_SIGNAL');
        check(await redeem(committed, await injected(0,'after-commit')) === 'internal', 'SAME_FAILURE_SIGNAL');
        await stored(rolled, false); await stored(committed, true);
        // Identical public errors can mean opposite persisted outcomes. Observation failure means UNKNOWN.
      });
    });
  }
  scenario('TX-07', 'REAL SERVICE', async () => {
    await openPool(1,'timeout');
    try {
      const f = await fixture('reset'); await lock(f,'session'); const start = performance.now(); const pending = redeem(f,instance(1)); await waiting();
      check(await pending === 'internal', 'PRISMA_TIMEOUT'); const elapsed = performance.now() - start;
      check(elapsed >= 4500 && elapsed < 8000, 'TIMEOUT_CLASSIFICATION_INCONCLUSIVE');
      await release(); await stored(f, false);
    } finally { await release(); await openPool(1,'Asia/Dhaka'); }
  });
  blocked('TX-08','actual owned-connection interruption needs a separately approved method');
  scenario('UTC-04', 'SQL PREDICATE ONLY', async () => {
    const r = await db('observer').query<{ strict: boolean }>(`WITH c AS MATERIALIZED (SELECT clock_timestamp() AT TIME ZONE 'UTC' AS t) SELECT NOT(t>t) AND t+interval '1 microsecond'>t AND NOT(t-interval '1 microsecond'>t) AS strict FROM c`);
    check(r.rows[0]?.strict, 'STRICT_COMPARISON');
  });
  blocked('UTC-04-FULL-SERVICE','exact wall-clock equality is not schedulable without a new clock hook');
  blocked('COMMIT-04-WIRE','post-commit throw is modeled acknowledgment loss, not genuine wire ambiguity');
});

async function cleanup(): Promise<void> {
  check(writable, 'CLEANUP_GATE'); validateTarget(process.env); sourcePreflight();
  const c = db('fixture'); await identity(c); await c.query('BEGIN'); let committed = false;
  try {
    for (const f of ledger) {
      const owner = await c.query<{ email: string }>('SELECT email FROM public."User" WHERE id=$1 FOR UPDATE', [f.userId]);
      if (!owner.rows.length) continue; // A rolled-back partial fixture has nothing to remove.
      check(owner.rows.length === 1 && owner.rows[0].email === f.email, 'CLEANUP_OWNER');
      // No parent cascade may touch an unledgered record, even inside the same synthetic run.
      const foreign = f.purpose === 'verification'
        ? await c.query<{ n: number }>(`SELECT
            (SELECT count(*) FROM public."Session" WHERE "userId"=$1 AND NOT(id=ANY($2::text[])))+
            (SELECT count(*) FROM public."EmailVerificationToken" WHERE "userId"=$1 AND id<>$3)+
            (SELECT count(*) FROM public."PasswordResetToken" WHERE "userId"=$1) AS n`, [f.userId,f.sessions,f.tokenId])
        : await c.query<{ n: number }>(`SELECT
            (SELECT count(*) FROM public."Session" WHERE "userId"=$1 AND NOT(id=ANY($2::text[])))+
            (SELECT count(*) FROM public."EmailVerificationToken" WHERE "userId"=$1)+
            (SELECT count(*) FROM public."PasswordResetToken" WHERE "userId"=$1 AND id<>$3) AS n`, [f.userId,f.sessions,f.tokenId]);
      check(Number(foreign.rows[0]?.n) === 0, 'CLEANUP_UNEXPECTED_CHILD');
      for (const [table, ids] of [['Session',f.sessions],['EmailVerificationToken',[f.tokenId]],['PasswordResetToken',[f.tokenId]]] as const) {
        // Identifiers are a closed internal allowlist; every value remains parameterized.
        const selected = table === 'Session'
          ? await c.query<{ id: string }>('SELECT id FROM public."Session" WHERE id=ANY($1::text[]) AND "userId"=$2 FOR UPDATE',[ids,f.userId])
          : table === 'EmailVerificationToken'
            ? await c.query<{ id: string }>('SELECT id FROM public."EmailVerificationToken" WHERE id=ANY($1::text[]) AND "userId"=$2 FOR UPDATE',[ids,f.userId])
            : await c.query<{ id: string }>('SELECT id FROM public."PasswordResetToken" WHERE id=ANY($1::text[]) AND "userId"=$2 FOR UPDATE',[ids,f.userId]);
        const removed = table === 'Session'
          ? await c.query('DELETE FROM public."Session" WHERE id=ANY($1::text[]) AND "userId"=$2',[selected.rows.map(row=>row.id),f.userId])
          : table === 'EmailVerificationToken'
            ? await c.query('DELETE FROM public."EmailVerificationToken" WHERE id=ANY($1::text[]) AND "userId"=$2',[selected.rows.map(row=>row.id),f.userId])
            : await c.query('DELETE FROM public."PasswordResetToken" WHERE id=ANY($1::text[]) AND "userId"=$2',[selected.rows.map(row=>row.id),f.userId]);
        check(removed.rowCount === selected.rows.length, 'CLEANUP_COUNT');
      }
      check((await c.query('DELETE FROM public."User" WHERE id=$1 AND email=$2',[f.userId,f.email])).rowCount === 1, 'CLEANUP_PARENT_COUNT');
    }
    await c.query('COMMIT'); committed = true; await counts();
  } catch {
    if (!committed) { try { await c.query('ROLLBACK'); } catch { aborted = true; } }
    throw new Error(committed ? 'G3_CLEANUP_POSTCHECK_FAILED_REVIEW_DATABASE' : 'G3_CLEANUP_FAILED_PRESERVE_LEDGER');
  }
}
if (!offlineMode) afterAll(async () => {
  try {
    // A Vitest hook timeout does not cancel setup. Never race late INSERTs with cleanup.
    await setup?.catch(() => undefined);
    await release(); await Promise.allSettled([...active]);
    if (writable) await cleanup();
    sourcePreflight();
  } finally {
    for (const client of clients) await client?.$disconnect().catch(() => { aborted = true; });
    for (const pool of pools) await pool?.end().catch(() => { aborted = true; });
    for (const client of [blockerDb,observerDb,fixtureDb]) await client?.end().catch(() => { aborted = true; });
    for (const undo of undos.reverse()) undo(); syncBuiltinESMExports();
  }
}, 20000);

if (offlineMode) {
  describe('G3-H offline guards', () => {
    function approvedEnvironment(raw = 'postgresql://flywithsafe_g3_auth02_test:offline-placeholder@127.0.0.1:5432/flywithsafe_g3_auth02_disposable'): Record<string, string> {
      return {
        RUN_AUTH02_POSTGRES: 'true', G3_AUTH02_PREFLIGHT_APPROVED: 'true',
        G3_AUTH02_WRITE_APPROVED: 'true', G3_AUTH02_CLEANUP_APPROVED: 'true',
        G3_AUTH02_AUTHENTICATION_ISOLATION_APPROVED: 'true', NODE_ENV: 'test',
        G3_AUTH02_MODE: 'execute', APPROVED_DISPOSABLE_DATABASE: DATABASE,
        G3_AUTH02_APPROVED_PROFILES: 'normal,timeout,timezone', EMAIL_DELIVERY_ENABLED: 'false',
        OUTBOX_WORKER_ENABLED: 'false', INTEGRATION_TEST_DATABASE_URL: raw,
        DATABASE_URL: raw, DIRECT_URL: raw, G3_AUTH02_DATABASE_URL: raw,
      };
    }

    it('accepts only the explicitly approved loopback target without mutating inputs', () => {
      const environment = Object.freeze(approvedEnvironment());
      const before = { ...environment };
      const parsed = validateTarget(environment);
      expect({ host: parsed.host, port: parsed.port, database: parsed.database, user: parsed.user }).toEqual({
        host: '127.0.0.1', port: 5432, database: DATABASE, user: ROLE,
      });
      expect(parsed.password.length > 0).toBe(true);
      expect(environment).toEqual(before);
    });

    it('rejects missing approval and ambient PostgreSQL overrides', () => {
      expect(() => validateTarget({})).toThrow('G3_EXECUTION_NOT_APPROVED');
      const environment = approvedEnvironment();
      environment.PGHOST = '127.0.0.1';
      expect(() => validateTarget(environment)).toThrow('G3_AMBIENT_OVERRIDE');
    });

    it('rejects remote, aliased, mismatched, or query-overridden targets', () => {
      const invalidTargets = [
        'postgresql://flywithsafe_g3_auth02_test:offline-placeholder@localhost:5432/flywithsafe_g3_auth02_disposable',
        'postgresql://flywithsafe_g3_auth02_test:offline-placeholder@127.0.0.1:5432/flywithsafe_integration',
        'postgresql://other:offline-placeholder@127.0.0.1:5432/flywithsafe_g3_auth02_disposable',
        'postgresql://flywithsafe_g3_auth02_test:offline-placeholder@127.0.0.1:5432/flywithsafe_g3_auth02_disposable?sslmode=require',
      ];
      for (const raw of invalidTargets) expect(() => validateTarget(approvedEnvironment(raw))).toThrow();
      const mismatched = approvedEnvironment(); mismatched.DIRECT_URL = 'postgresql://different';
      expect(() => validateTarget(mismatched)).toThrow('G3_TARGET_MISMATCH');
      const missingG3 = approvedEnvironment(); delete missingG3.G3_AUTH02_DATABASE_URL;
      expect(() => validateTarget(missingG3)).toThrow('G3_TARGET_MISMATCH');
    });

    it('admits only exact numeric loopback socket endpoints and rejects alternate transports', () => {
      expect(allowedEndpoint([5432, '127.0.0.1'])).toBe(true);
      expect(allowedEndpoint([{ host: '127.0.0.1', port: 5432 }])).toBe(true);
      expect(allowedEndpoint([5432, 'localhost'])).toBe(false);
      expect(allowedEndpoint([{ host: '127.0.0.1', port: 5433 }])).toBe(false);
      expect(allowedEndpoint([{ host: '127.0.0.1', port: 5432, path: 'socket' }])).toBe(false);
    });

    it('keeps runtime imports behind network guards and never imports auth during offline checks', () => {
      const source = readFileSync(resolve(__dirname, 'auth-consumption.pg.test.ts'), 'utf8');
      const staticImports = source.split(/\r?\n/).filter(line => /^\s*import\s/.test(line) && !/^\s*import\s+type\s/.test(line));
      expect(staticImports.some(line => /(?:pg|@prisma\/adapter-pg|generated\/prisma|services\/auth\.service|config\/env|dotenv|nodemailer|passport)/.test(line))).toBe(false);
      const beforeAllStart = source.indexOf('beforeAll(() => {');
      const guardInstall = source.indexOf('installGuards();', beforeAllStart);
      const driverImport = source.indexOf("Pg = await import('pg')", beforeAllStart);
      const serviceGate = source.indexOf("check(boundary.installed && writable, 'IMPORT_GATE')");
      const serviceImport = source.indexOf("const module = await import('../src/services/auth.service.js')");
      const config = readFileSync(resolve(__dirname, 'auth-consumption.pg.vitest.config.ts'), 'utf8');
      expect(beforeAllStart).toBeGreaterThanOrEqual(0);
      expect(guardInstall).toBeGreaterThan(beforeAllStart);
      expect(driverImport).toBeGreaterThan(guardInstall);
      expect(serviceGate).toBeGreaterThan(0);
      expect(serviceImport).toBeGreaterThan(serviceGate);
      expect(boundary.installed).toBe(false);
      expect(boundary.imported).toBe(false);
      expect(fixtureDb).toBeUndefined();
      expect(config).toContain("globalSetup: [], setupFiles: [], environment: 'node'");
      expect(config).toContain("include: ['auth-consumption.pg.test.ts']");
    });

    it('pins every reviewed matrix family and its approved bounded repetitions', () => {
      const source = readFileSync(resolve(__dirname, 'auth-consumption.pg.test.ts'), 'utf8');
      for (const id of ['LOCK-01','LOCK-02','LOCK-04','LOCK-05','LOCK-06','TX-03','TX-04','TX-05',
        'TX-06-COMMIT','TX-06-ROLLBACK','TX-07','TX-09','TX-09-DELETE','TX-10','UTC-01','UTC-02',
        'UTC-03','UTC-05','UTC-06','UTC-07','UTC-08','COMMIT-01','COMMIT-02','COMMIT-03',
        'COMMIT-04','COMMIT-05','COMMIT-06']) expect(source).toContain(`'${id}'`);
      expect(source).toContain("? 'TX-01' : 'TX-02'");
      expect(source).toContain('`LOCK-03-C${concurrency}-R${repeat}`');
      expect(source).toContain('for (const concurrency of [2,8,16]) for (let repeat = 1; repeat <= 3; repeat++)');
      expect(source).toContain("blocked('TX-08'");
      expect(source).toContain("blocked('UTC-04-FULL-SERVICE'");
      expect(source).toContain("blocked('COMMIT-04-WIRE'");
    });

    it('verifies pinned authentication source and all seven migration fingerprints offline', () => {
      sourcePreflight();
    });
  });
}
