import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const integrationUrl = process.env.INTEGRATION_TEST_DATABASE_URL;

if (process.env.RUN_IDEMPOTENCY_INTEGRATION !== 'true') {
  throw new Error('Set RUN_IDEMPOTENCY_INTEGRATION=true before running integration tests.');
}
if (process.env.EMAIL_DELIVERY_ENABLED !== 'false') {
  throw new Error('Set EMAIL_DELIVERY_ENABLED=false before running integration tests.');
}

let databaseName;
try {
  const url = new URL(integrationUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('unsupported protocol');
  databaseName = url.pathname.replace(/^\//, '');
} catch {
  throw new Error('Set INTEGRATION_TEST_DATABASE_URL to a valid PostgreSQL integration database URL.');
}

if (!databaseName.endsWith('_integration')) {
  throw new Error('INTEGRATION_TEST_DATABASE_URL must target a database ending in _integration.');
}

const vitest = resolve('node_modules', 'vitest', 'vitest.mjs');
const result = spawnSync(process.execPath, [vitest, 'run', 'test/idempotency.integration.test.ts'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: integrationUrl,
    EMAIL_DELIVERY_ENABLED: 'false',
  },
});

process.exit(result.status ?? 1);
