# Phase 1H-B3 integration runner preparation

Planning: compact; context: dependencies; verification: impact; delegation: none.
Scope: offline runner preparation. PostgreSQL execution and cleanup require separate approval.

## Changes

- server/test/integration-target.mjs: adds assertPhase1hTarget, layered over the existing
  generic guard. Requires both opt-ins, disabled email, exact approved name, explicit
  127.0.0.1:5432, matching runtime/CLI/integration URLs, and no URL overrides. Raw host spelling
  rejects alternate numeric/normalized loopback spellings as well as remote hosts.
- server/test/run-postgres-integration.mjs: uses that guard before connecting; verifies live
  host, port and database. Preserves history/checksum/schema/uniqueness/foreign-key/index/
  precision/empty-outbox checks. Pins all three child URLs to the validated target and clears
  Google credentials. No dotenv fallback precedes validation.
- server/test/integration-target.test.ts: adds 17 offline cases for this exact endpoint.
- server/test/idempotency.integration.test.ts, server/test/reliability.integration.test.ts,
  server/test/fixtures/replay-booking.ts: apply the same exact guard, including child processes.
  Inquiry tests additionally block fetch and SMTP transport construction, matching reliability
  suite protection. No test count or business assertion is removed.

The previously reviewed database-name patch was deliberately narrowed: it would have accepted
any approved database name, including the preserved database. The active patch permits only
flywithsafe_phase1h_integration. The older proposal remains a historical artifact.

## Evidence and limits

Owner reports seven completed migrations, 20 tables, 82 indexes and empty business tables in
127.0.0.1:5432/flywithsafe_phase1h_integration. This phase did not connect to any database.
Read-only runner preflight will refresh those requirements before a later authorized run.

Offline results: Node syntax checks passed; backend tsc --noEmit passed; guard/history tests
36 passed. Vitest collected 6 inquiry and 10 reliability cases with both opt-ins false:
16 skipped, no database hooks executed. This confirms discovery, not PostgreSQL correctness.
The sandbox initially produced a temporary-file ENOENT; the same scoped offline checks passed
outside that restriction. A Vitest list --json optional argument accidentally consumed the
inquiry test path as an output file. The inspected pre-existing contents were restored,
including all prior cleanup/security changes, before final passing collection.

Coverage groups: inquiry creation/replay, conflict, concurrency, invalid request, guest/customer
isolation, rollback (6); booking isolation/replay/conflict, concurrent creation, rollback,
independent-process persistence, OAuth atomic consumption/replay, notification concurrent claim,
OAuth expiration, interrupted claim recovery, stale-worker fencing, retry/failure/redrive/
suppression (10).

Both suites generate unique synthetic identities. Cleanup uses exact emails/keys/IDs, not
prefix deletion or truncation. Booking deletion cascades only its passenger/history fixtures;
synthetic user deletion cascades auth children. Cleanup runs after failures where possible,
is not one atomic transaction, and may need separately reviewed exact-ID recovery if interrupted.
Global outbox discovery requires an empty queue and exclusive database use throughout the run.

No test calls supplier/payment routes or the real Google callback exchange. Google credentials
are empty in the child; OAuth tests use local middleware and synthetic tokens. fetch and SMTP
construction are blocked in both suites; worker delivery is mocked. The restarted child only
replays an existing booking or claims an exact synthetic notification. These are scoped stubs,
not an operating-system network sandbox or proof of real provider interoperability.

## Later execution — separate approval required

Use a private, dedicated PowerShell terminal, with APIs/workers stopped. Do not paste credentials
into chat. Initialization is complete; no migration/reset/seed command is part of this run.
The following constructs only the approved URL, disables service overrides, and removes the
process secrets when finished. All environment changes stay within this dedicated terminal.

```powershell
Set-Location 'E:\Programming\Project\fly-with-safety\server'
$privatePassword = Read-Host 'Local postgres password' -AsSecureString
$privatePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($privatePassword)
try {
  $privateLocalUrl = 'postgresql://postgres:' + [Uri]::EscapeDataString(
    [Runtime.InteropServices.Marshal]::PtrToStringBSTR($privatePointer)) +
    '@127.0.0.1:5432/flywithsafe_phase1h_integration'
  $env:DATABASE_URL = $privateLocalUrl
  $env:DIRECT_URL = $privateLocalUrl
  $env:INTEGRATION_TEST_DATABASE_URL = $privateLocalUrl
  $env:APPROVED_DISPOSABLE_DATABASE = 'flywithsafe_phase1h_integration'
  $env:RUN_IDEMPOTENCY_INTEGRATION = 'true'
  $env:RUN_RELIABILITY_INTEGRATION = 'true'
  $env:EMAIL_DELIVERY_ENABLED = 'false'
  $env:OUTBOX_WORKER_ENABLED = 'false'
  Remove-Item Env:PGSERVICE,Env:PGSERVICEFILE,Env:PGOPTIONS -ErrorAction SilentlyContinue
  node test/run-postgres-integration.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Integration run failed; stop and review. Do not reset or retry automatically.' }
} finally {
  Remove-Item Env:DATABASE_URL,Env:DIRECT_URL,Env:INTEGRATION_TEST_DATABASE_URL -ErrorAction SilentlyContinue
  $env:RUN_IDEMPOTENCY_INTEGRATION = 'false'
  $env:RUN_RELIABILITY_INTEGRATION = 'false'
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($privatePointer)
  $privatePassword.Dispose()
  $privateLocalUrl = $null
}
```

Close this dedicated terminal afterward. Approval must include all 16 tests and their exact
synthetic cleanup writes. No such approval is inferred from schema initialization or this
preparation. Private agent authentication, real PostgreSQL results, and multi-process behavior
remain unverified until that authorized run. No SMTP/provider/deployment claims are made.
