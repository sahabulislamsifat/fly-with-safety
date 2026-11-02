// Credential-equivalence guard only. No connection and no input/error serialization.
const path = require('node:path');
const local = require('node:module').createRequire(path.resolve(__dirname, '../../../server/package.json'));
const { Client } = local('pg');
let passed = false;
try {
  const input = process.env.PHASE2_BOOKING_DATABASE_URL;
  const password = process.env.PGPASSWORD;
  if (!input || !password) throw new Error('INPUT_MISSING');
  const parsed = new URL(input);
  if (parsed.protocol !== 'postgresql:' || parsed.username !== 'flywithsafe_phase2_booking_test' || !parsed.password ||
      parsed.hostname !== '127.0.0.1' || parsed.port !== '5432' || parsed.pathname !== '/flywithsafe_phase2_booking_integration' ||
      parsed.search || parsed.hash) throw new Error('TARGET_MISMATCH');
  const readonly = new URL(parsed.href);
  readonly.searchParams.set('options', '-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=2000');
  passed = [input, parsed.href, readonly.href].every(connectionString => {
    const client = new Client({ connectionString });
    const p = client.connectionParameters;
    return p.password === password && p.user === 'flywithsafe_phase2_booking_test' &&
      p.database === 'flywithsafe_phase2_booking_integration' && p.host === '127.0.0.1' && p.port === 5432;
  });
} catch { passed = false; }
console.log(passed ? 'PHASE2_PRIVATE_URL_EQUIVALENCE_PASS' : 'PHASE2_PRIVATE_URL_EQUIVALENCE_STOP');
if (!passed) process.exitCode = 1;
