// Offline only: construct clients, never call connect/query. Print booleans only.
const path = require('node:path');
const { createRequire } = require('node:module');
const local = createRequire(path.resolve(__dirname, '../../../server/package.json'));
const { Client } = local('pg');
const { PrismaPg } = local('@prisma/adapter-pg');
const raw = process.env.PHASE2_OFFLINE_ROUNDTRIP_SECRET;
const input = process.env.PHASE2_OFFLINE_ROUNDTRIP_URL;
let passed = false;
try {
  if (!raw || !input) throw new Error('OFFLINE_INPUT_MISSING');
  const url = new URL(input);
  const readonly = new URL(url.href);
  readonly.searchParams.set('options', '-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=2000');
  // Prove a different inherited value cannot override an explicit URI credential.
  process.env.PGPASSWORD = 'synthetic-wrong-environment-value';
  process.env.PGUSER = 'synthetic-wrong-environment-role';
  process.env.PGDATABASE = 'synthetic-wrong-environment-database';
  const configs = [input, url.href, readonly.href];
  const checks = configs.map(connectionString => {
    const adapter = new PrismaPg({ connectionString });
    const client = new Client(adapter.config);
    const p = client.connectionParameters;
    return p.password === raw && p.user === 'flywithsafe_phase2_booking_test' &&
      p.database === 'flywithsafe_phase2_booking_integration' && p.host === '127.0.0.1' && p.port === 5432;
  });
  passed = checks.every(Boolean);
  console.log(JSON.stringify({ passed, pathsChecked: checks.length, driverDecodedExactlyOnce: passed, explicitCredentialsOverrideEnvironment: passed }));
} catch {
  console.log(JSON.stringify({ passed: false, classification: 'OFFLINE_ROUNDTRIP_FAILED' }));
} finally {
  delete process.env.PHASE2_OFFLINE_ROUNDTRIP_SECRET;
  delete process.env.PHASE2_OFFLINE_ROUNDTRIP_URL;
}
if (!passed) process.exitCode = 1;
