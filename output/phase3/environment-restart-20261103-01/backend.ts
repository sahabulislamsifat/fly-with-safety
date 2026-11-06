// Development restart only. Real existing application; no migrations/worker/provider admission.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const base = path.resolve(process.cwd(), '../output/phase3/environment-restart-20261103-01');
let stage = 'load-environment';
async function main() {
  process.env.NODE_ENV = 'development';
  process.env.PORT = '5000';
  process.env.SSLCOMMERZ_ENABLED = 'false';
  process.env.EMAIL_DELIVERY_ENABLED = 'false';
  process.argv.push('--no-outbox-worker');
  await import('../../../server/src/config/env.js');
  const local = createRequire(path.resolve('package.json'));
  const selected = local('dotenv').parse(fs.readFileSync(path.resolve('.env')));
  const u = new URL(process.env.DATABASE_URL || '');
  if (!['postgres:', 'postgresql:'].includes(u.protocol) || !u.hostname.endsWith('.prisma.io') || u.pathname !== '/postgres' || ['127.0.0.1','localhost'].includes(u.hostname)) throw Error('NORMAL_REMOTE_PRISMA_TARGET_REQUIRED');
  if (process.env.DATABASE_URL !== selected.DATABASE_URL) throw Error('NORMAL_DATABASE_ENV_PRECEDENCE_MISMATCH');
  if (process.env.SSLCOMMERZ_SANDBOX !== 'true') throw Error('SANDBOX_FLAG_REQUIRED');
  const secretLoadedFromUpdatedFile = Boolean(selected.SSLCOMMERZ_STORE_PASSWORD && process.env.SSLCOMMERZ_STORE_PASSWORD === selected.SSLCOMMERZ_STORE_PASSWORD);
  if (!secretLoadedFromUpdatedFile) throw Error('PRIVATE_SANDBOX_CONFIGURATION_UNAVAILABLE');
  stage = 'readonly-main-identity';
  const { prisma } = await import('../../../server/src/lib/prisma.js');
  const identity = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return tx.$queryRawUnsafe<Array<{ db: string; role: string; oid: number }>>('SELECT current_database() AS db,current_user AS role,(SELECT oid::int FROM pg_database WHERE datname=current_database()) AS oid');
  }, { maxWait: 5000, timeout: 10000 });
  if (identity[0]?.db !== 'postgres' || identity[0]?.role === 'flywithsafe_phase2_booking_test' || identity[0]?.oid === 34701) throw Error('NORMAL_RUNTIME_IDENTITY_MISMATCH');
  fs.writeFileSync(path.join(base, 'backend-config.json'), JSON.stringify({ pid: process.pid, remotePrisma: true, designatedMainFromServerEnv: true, consoleResourceIndependentlyVerified: false, localIntegrationSelected: false, database: 'postgres', sqlRoleMatchesHistoricalMain: identity[0].role === 'prisma_migration', runtimeDatabaseMatchesFile: true, sandboxTrue: true, storePasswordLoadedFromUpdatedFile: secretLoadedFromUpdatedFile, storeIdLoadedFromUpdatedFile: Boolean(selected.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_ID === selected.SSLCOMMERZ_STORE_ID), paymentsEnabled: false, notificationDeliveryEnabled: false, backgroundOutboxWorkerEnabled: false, googleConfigurationPreserved: true, readOnlyIdentityQuery: true, envFilesModified: false }, null, 2), { flag: 'wx' });
  stage = 'start-original-server';
  await import('../../../server/src/server.js');
  process.on('message', m => { if ((m as { action?: string })?.action === 'stop-owned-development-server') process.emit('SIGTERM', 'SIGTERM'); });
}
main().catch((error: unknown) => {
  const e = error as { code?: string; meta?: { code?: string }; message?: string };
  const known = ['NORMAL_REMOTE_PRISMA_TARGET_REQUIRED','NORMAL_DATABASE_ENV_PRECEDENCE_MISMATCH','SANDBOX_FLAG_REQUIRED','PRIVATE_SANDBOX_CONFIGURATION_UNAVAILABLE','NORMAL_RUNTIME_IDENTITY_MISMATCH'];
  const code = typeof e.code === 'string' && /^(?:P\d{4}|ERR_[A-Z_]+|MODULE_NOT_FOUND|ENOTFOUND|ECONNREFUSED|ETIMEDOUT)$/.test(e.code) ? e.code : null;
  fs.writeFileSync(path.join(base,'backend-error.json'),JSON.stringify({ stage, code, sqlState: typeof e.meta?.code === 'string' && /^[A-Z0-9]{5}$/.test(e.meta.code) ? e.meta.code : null, guard: known.includes(e.message || '') ? e.message : null }),{flag:'wx'});
  console.error('DEVELOPMENT_BACKEND_START_STOP: sanitized configuration/connectivity failure'); process.exit(1);
});
