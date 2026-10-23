import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { assertPhase1hTarget, phase1hDatabase } from './integration-target.mjs';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { verifyMigrationHistory } from './migration-history.mjs';

// Preparation does not authorize execution. Run only after separate target/write approval.
const target = assertPhase1hTarget(process.env);
// Catalog-only preflight precedes the child process and every fixture write.
const db = new pg.Client({ connectionString: target, connectionTimeoutMillis: 5000,
  options: '-c default_transaction_read_only=on -c statement_timeout=5000' });
try {
  await db.connect();
  const identity = await db.query('SELECT current_database() AS name, host(inet_server_addr()) AS host, inet_server_port() AS port');
  if (identity.rows[0]?.name !== phase1hDatabase || identity.rows[0]?.host !== '127.0.0.1' || identity.rows[0]?.port !== 5432) throw new Error('Target identity mismatch');
  const migrations = await db.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM public."_prisma_migrations"');
  verifyMigrationHistory(migrations.rows);
  const schemaIssues = await db.query(readFileSync(resolve('test/integration-schema-preflight.sql'), 'utf8'));
  if (schemaIssues.rows.length) throw new Error('Required live schema objects missing or mismatched');
  const precision = await db.query("SELECT datetime_precision FROM information_schema.columns WHERE table_schema='public' AND table_name='NotificationOutbox' AND column_name='updatedAt'");
  if (precision.rows[0]?.datetime_precision !== 3) throw new Error('Expected millisecond lease precision');
  const indexes = await db.query("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='IdempotencyRecord'");
  if (!indexes.rows.some(row => /UNIQUE/.test(row.indexdef) && /operation, principal, key/.test(row.indexdef))) throw new Error('Required uniqueness missing');
  const queue = await db.query('SELECT count(*)::int AS count FROM "NotificationOutbox"');
  if (queue.rows[0].count !== 0) throw new Error('Outbox must be empty before exclusive integration execution');
} catch {
  process.stderr.write('Local database preflight failed; no tests started. Verify authentication, identity, migration history, constraints and an empty outbox.\n');
  process.exitCode = 1;
} finally { await db.end(); }
if (process.exitCode) process.exit(process.exitCode);
const result = spawnSync(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run',
  '--no-file-parallelism', '--bail=1', 'test/idempotency.integration.test.ts', 'test/reliability.integration.test.ts'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: target, DIRECT_URL: target, INTEGRATION_TEST_DATABASE_URL: target,
    NODE_ENV: 'test', EMAIL_DELIVERY_ENABLED: 'false', OUTBOX_WORKER_ENABLED: 'false',
    GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '',
    JWT_SECRET: 'synthetic-integration-signing-key-not-for-production-123456789' },
});
process.exit(result.status ?? 1);
