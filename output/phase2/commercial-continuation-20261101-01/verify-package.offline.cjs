const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const read = file => fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
const pinsPath = path.join(__dirname, 'pins.json');
const pins = JSON.parse(read(pinsPath));
let checks = 0;
function requireThat(value, label) { checks++; if (!value) throw new Error('OFFLINE_PACKAGE_' + label); }
for (const pin of pins) requireThat(hash(pin.path) === pin.sha256, 'PIN_MISMATCH');
const caller = read(path.join(__dirname, 'Invoke-CommercialContinuation.ps1'));
requireThat(caller.includes(hash(pinsPath)), 'MANIFEST_BINDING');
requireThat(!caller.includes('MANIFEST_HASH_PENDING'), 'UNFINISHED_CALLER');
for (const file of ['attempt-started.json', 'fixture-ledger.jsonl', 'vitest-result.json', 'diagnostic.json', 'result.json'])
  requireThat(!fs.existsSync(path.join(__dirname, file)), 'ATTEMPT_ALREADY_EXISTS');
for (const guard of ['if(-not $OwnerApprovedRetainedContinuation)', '[IO.FileMode]::CreateNew', 'Existing retained-fixture continuation attempt; no retry', '$summary.numPassedTests -eq 1', '$summary.numPendingTests -eq 0', "$detail.stage -eq 'complete'"])
  requireThat(caller.includes(guard), 'CALLER_GUARD_MISSING');
requireThat(!/Start-Process|Set-ExecutionPolicy|ExecutionPolicy\s+Bypass|Invoke-Phase2Recovery|Invoke-Phase2Integration|migrate deploy|\bDELETE\b|\bGRANT\b/.test(caller), 'CALLER_SCOPE');
const live = read(path.join(root, 'server/test/phase2-commercial-continuation.pg.test.ts'));
requireThat((live.match(/it\.skipIf\(/g) || []).length === 1, 'CASE_COUNT');
requireThat(!/vi\.mock\(['"][^'"]*(?:prisma|auth|booking-commercial)/.test(live), 'LIVE_DEPENDENCY_DOUBLED');
requireThat(!/prisma\.(?:user|booking|bookingPassenger)\.(?:create|upsert|delete)/.test(live), 'FIXTURE_SCOPE');
requireThat(live.includes('Array.from({ length: 8 }, () => post(acceptance, 0, true))') && live.includes("Array.from({ length: 8 }, () => status('CONFIRMED', 'PENDING'))"), 'CONCURRENCY');
requireThat(live.includes('}, 60000)') && live.includes('response: 5000, deadline: 10000'), 'TIMEOUT_PRESERVATION');
requireThat(live.includes('await Promise.allSettled([...pendingNotifications])'), 'ADMITTED_TASK_DRAIN');
requireThat(live.includes('const actualNotification = notifications.sendBookingStatusNotification;'), 'ORIGINAL_TASK_CAPTURE');
const inventory = JSON.parse(read(path.join(__dirname, 'inventory-acceptance.json')));
requireThat(inventory.accepted === true && inventory.actualQueryExit === 0 && inventory.commercialPresent === false, 'INVENTORY_ACCEPTANCE');
requireThat(hash(path.join(root, inventory.source)) === inventory.sourceSha256, 'INVENTORY_EVIDENCE');
const historic = JSON.parse(read(path.join(root, 'output/phase2/quotation-review-20261101-01/preservation.json')));
for (const entry of historic.oldAttemptEvidence) requireThat(hash(entry.path) === entry.sha256, 'HISTORICAL_EVIDENCE_CHANGED');
const result = { passed: true, checks, pins: pins.length, registeredLiveCases: 1, caseTimeoutMs: 60000, dispatchedLiveCases: 0, databaseConnections: 0,
  originalRecoveryEvidencePreserved: true, expectedInitialRows: 13, plannedMaximumNewRows: 10, expectedSuccessRows: 23, createsUserOrBooking: false };
fs.writeFileSync(path.join(__dirname, 'static-verification.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
