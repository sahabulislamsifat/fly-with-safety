import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { gatewayConfig } from '../../src/payments/sslcommerz.js';
import { assertLocalURL, preflight, preserve } from '../phase3-db-preflight-v02.js';
import type { Plan } from '../phase3-genuine/scope.js';
import { verifyRetained } from '../phase3-negative-v01/retained.js';
import { createInspection, inspectionCallbackOrigin } from './inspection.js';

const repo = resolve(__dirname, '../../..');
const base = resolve(repo, 'output/phase3/checkout-inspection-20261105-01');

async function main() {
  if (process.argv[2] !== '--owner-approved-checkout-inspection-v01' || process.env.PHASE3_CHECKOUT_INSPECTION_APPROVED !== 'true') throw Error('APPROVAL_REQUIRED');
  const dbUrl = process.env.DATABASE_URL ?? '';
  assertLocalURL(dbUrl);
  if (dbUrl !== process.env.DIRECT_URL || process.env.NODE_TLS_REJECT_UNAUTHORIZED !== undefined || process.env.NODE_EXTRA_CA_CERTS !== undefined) throw Error('ENVIRONMENT_DENIED');
  if (['attempt.json', 'result.json'].some(name => existsSync(resolve(base, name)))) throw Error('INSPECTION_CONSUMED');
  writeFileSync(resolve(base, 'attempt.json'), JSON.stringify({ purpose: 'static checkout inspection', at: new Date().toISOString() }), { flag: 'wx' });

  const plan = JSON.parse(readFileSync(resolve(repo, 'output/phase3/negative-continuation-20261104-01/fixture-plan.json'), 'utf8')) as Plan;
  const tranId = `FWSI${randomBytes(13).toString('hex')}`;
  const pool = new pg.Pool({ connectionString: dbUrl, max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 10_000, query_timeout: 15_000, options: '-c default_transaction_read_only=on' });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  let stage = 'readonly-preflight';
  let baseline: string | undefined;
  let inspection: ReturnType<typeof createInspection> | undefined;
  let observation: Awaited<ReturnType<ReturnType<typeof createInspection>['run']>> | undefined;
  let preservation = false;
  let failure: string | null = null;
  const deadline = AbortSignal.timeout(90_000);

  async function snapshot(first: boolean) {
    const rollback = Error('INSPECTION_CONTROLLED_ROLLBACK');
    let snapshot: string | undefined;
    try {
      await db.$transaction(async tx => {
        await tx.$executeRawUnsafe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const mode = await tx.$queryRawUnsafe<Array<{ mode: string }>>("SELECT current_setting('transaction_read_only') AS mode");
        if (mode[0]?.mode !== 'on') throw Error('READONLY_REQUIRED');
        const readOnly = tx as unknown as PrismaClient;
        await preflight(readOnly, plan, repo);
        await verifyRetained(readOnly, repo);
        const collision = await tx.$queryRawUnsafe<Array<{ exists: boolean }>>('SELECT EXISTS(SELECT 1 FROM public."GatewayPayment" WHERE "tranId" = $1) AS "exists"', tranId);
        if (collision[0]?.exists !== false) throw Error('INSPECTION_ID_COLLISION');
        snapshot = JSON.stringify(await preserve(readOnly, plan));
        throw rollback;
      }, { timeout: 25_000, maxWait: 5_000 });
    } catch (error) { if (error !== rollback) throw error; }
    if (!snapshot || (!first && snapshot !== baseline)) throw Error('PRESERVATION_MISMATCH');
    return snapshot;
  }

  try {
    baseline = await snapshot(true);
    stage = 'sandbox-config';
    const sandboxEnv = parse(readFileSync(resolve(repo, 'server/.env')));
    const config = gatewayConfig({
      DATABASE_URL: dbUrl, SSLCOMMERZ_ENABLED: 'true', SSLCOMMERZ_SCHEMA_VERIFIED: 'true', EMAIL_DELIVERY_ENABLED: 'false',
      SSLCOMMERZ_SANDBOX: sandboxEnv.SSLCOMMERZ_SANDBOX, SSLCOMMERZ_STORE_ID: sandboxEnv.SSLCOMMERZ_STORE_ID,
      SSLCOMMERZ_STORE_PASSWORD: sandboxEnv.SSLCOMMERZ_STORE_PASSWORD, SSLCOMMERZ_API_BASE_URL: sandboxEnv.SSLCOMMERZ_API_BASE_URL,
      SSLCOMMERZ_CALLBACK_BASE_URL: inspectionCallbackOrigin, FRONTEND_URL: 'http://127.0.0.1',
      SSLCOMMERZ_STORAGE_KEY: randomBytes(32).toString('base64'),
    });
    stage = 'checkout-inspection';
    inspection = createInspection(config, tranId, fetch, deadline);
    observation = await inspection.run();
  } catch { failure = stage; }
  finally {
    if (baseline) {
      try { await snapshot(false); preservation = true; }
      catch { failure = 'readonly-postcheck'; }
    }
    await db.$disconnect().catch(() => { failure = 'db-cleanup'; });
    await pool.end().catch(() => { failure = 'db-cleanup'; });
  }
  const result = { passed: !failure && preservation && !!observation, failure, observation, preservation,
    providerRequests: inspection?.requests() ?? 0, oldIntentProviderRequests: 0, databaseWrites: 0, publicExposure: 0, phase3Accepted: false };
  writeFileSync(resolve(base, 'result.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(result));
  process.exitCode = result.passed ? 0 : 1;
}

if (require.main === module) main().catch(() => { console.error('CHECKOUT_INSPECTION_STOPPED'); process.exitCode = 1; });
