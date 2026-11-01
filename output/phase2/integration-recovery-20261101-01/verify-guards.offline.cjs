const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const raw = 'SYNTHETIC_ONLY @:%+#?/" space ';
const url = 'postgresql://flywithsafe_phase2_booking_test:' + encodeURIComponent(raw) + '@127.0.0.1:5432/flywithsafe_phase2_booking_integration';
const cases = [
  [url, raw, 0], [url, 'SYNTHETIC_WRONG', 1], [url.replace('127.0.0.1', 'localhost'), raw, 1],
  [url.replace('5432', '5433'), raw, 1], [url.replace('booking_test:', 'postgres:'), raw, 1],
  [url + '?password=SYNTHETIC_ONLY', raw, 1], [url + '#SYNTHETIC_ONLY', raw, 1],
  [url.replace(encodeURIComponent(raw), ''), raw, 1], [url.replace(encodeURIComponent(raw), encodeURIComponent(encodeURIComponent(raw))), raw, 1],
];
let passed = 0;
for (const [input, password, expected] of cases) {
  const child = spawnSync(process.execPath, [path.join(__dirname, 'verify-private-url.cjs')], {
    env: { ...process.env, PGPASSWORD: password, PHASE2_BOOKING_DATABASE_URL: input }, encoding: 'utf8', timeout: 10000, windowsHide: true,
  });
  if (child.status !== expected || child.stderr || child.stdout.trim() !== (expected ? 'PHASE2_PRIVATE_URL_EQUIVALENCE_STOP' : 'PHASE2_PRIVATE_URL_EQUIVALENCE_PASS'))
    throw new Error('OFFLINE_PRIVATE_URL_GUARD_FAILED_CASE_' + passed);
  passed++;
}
const caller = fs.readFileSync(path.join(__dirname, 'Invoke-Phase2Recovery.ps1'), 'utf8');
const required = ["$stage='private-url-equivalence'", "$stage='same-input-psql-readonly'", "$stage='same-input-prisma-readonly'", "$stage='restricted-business-integration'"];
let previous = -1;
for (const text of required) {
  const at = caller.indexOf(text);
  if (at <= previous) throw new Error('OFFLINE_GATE_ORDER_FAILED');
  previous = at;
}
for (const text of ['if($urlExit -ne 0)', 'if($psqlExit -ne 0)', 'if($identityExit -ne 0', '$identity.passed -ne $true', "[IO.FileMode]::CreateNew", 'Existing new recovery attempt; no retry', 'if(-not $OwnerApprovedNewAttempt)'])
  if (!caller.includes(text)) throw new Error('OFFLINE_REQUIRED_GUARD_MISSING');
if (/Set-ExecutionPolicy|ExecutionPolicy\s+Bypass|Start-Process|migrate\s+deploy|TRUNCATE|DELETE\s+FROM|\bGRANT\b/.test(caller)) throw new Error('OFFLINE_SCOPE_FAILED');
const original = path.resolve(__dirname, '../integration-review');
const pins = JSON.parse(fs.readFileSync(path.join(original, 'pins.json'), 'utf8'));
for (const pin of pins) {
  if (require('node:crypto').createHash('sha256').update(fs.readFileSync(pin.path)).digest('hex').toUpperCase() !== pin.sha256.toUpperCase())
    throw new Error('ORIGINAL_SOURCE_PIN_CHANGED');
}
const result = { passed: true, privateUrlCases: passed, originalPinsMatched: pins.length, stageOrderChecks: required.length, noDatabaseConnections: true, noCallerExecuted: true };
fs.writeFileSync(path.join(__dirname, 'offline-guard-result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
