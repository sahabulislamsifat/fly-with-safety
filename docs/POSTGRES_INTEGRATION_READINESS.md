# PostgreSQL integration readiness — Phase 1F

## Phase 1H preparation update

`test/reliability.integration.test.ts` now contains ten executable but unexecuted PostgreSQL
cases. It covers booking isolation/replay/conflict/concurrency/rollback, fresh-process retries,
OAuth atomic consumption/replay/expiry, concurrent outbox claims, stale acknowledgment,
child-process interruption, retry/failure/redrive and suppression. Provider/SMTP behavior is
synthetic; PostgreSQL persistence is real only when separately approved and enabled.

`test/run-postgres-integration.mjs` serializes the six existing inquiry cases and ten new
reliability cases. It requires the existing local-target guard, exact flywithsafe_integration
name, and RUN_RELIABILITY_INTEGRATION=true. Catalog-only preflight checks server identity,
migration history, uniqueness, millisecond precision and an empty outbox before fixture writes.
Both suites clean only their unique synthetic records; this cleanup is itself a write and
must be included in approval. New child processes require both integration flags and never
contact providers. Process interruption is tested after a committed claim, before sending.

Prepared command, from `server/`, ONLY after target authentication, disposability, schema
and write/cleanup scope are separately approved:

```powershell
node test/run-postgres-integration.mjs
```

Supply identical secure local DATABASE_URL, DIRECT_URL and INTEGRATION_TEST_DATABASE_URL,
APPROVED_DISPOSABLE_DATABASE=flywithsafe_integration, RUN_IDEMPOTENCY_INTEGRATION=true,
RUN_RELIABILITY_INTEGRATION=true and EMAIL_DELIVERY_ENABLED=false through the process
environment. INTEGRATION_TEST_DIRECT_URL is not consumed. Do not modify normal production
environment files. The runner uses a synthetic signing key and disables the worker flag.

Read-only local authentication remained blocked by `fe_sendauth: no password supplied`.
Local service/port readiness does not prove database existence, schema or disposability.
No migration, test write or cleanup has been executed. The matrix below remains the broader
verification plan; ten prepared cases do not claim full fault-injection coverage.

No database connections, migrations, persistent tests or fixture cleanup were executed.

## Current targets and safety gates

Sanitized inspection found runtime DATABASE_URL configured for pooled.db.prisma.io,
database postgres, and CLI DIRECT_URL configured for db.prisma.io, database postgres.
These are remote targets and are not approved test targets. INTEGRATION_TEST_DATABASE_URL
was absent. The candidate flywithsafe_integration database has not been inspected or
approved as disposable. Local PostgreSQL availability, credentials and schema are unknown.

Runtime PrismaPg reads DATABASE_URL; Prisma CLI reads DIRECT_URL. The dedicated runner
previously checked only opt-in, disabled email, protocol and a database suffix. It could
accept a remote host. Both runner and integration-suite discovery now share a configuration
guard: literal 127.0.0.1 or ::1, *_integration name, no URL query/fragment overrides,
APPROVED_DISPOSABLE_DATABASE matching that exact name, and identical explicit runtime,
CLI and integration URLs. localhost is intentionally rejected to avoid hostname resolution
ambiguity. Configuration flags are safeguards, not a substitute for human authorization.
The runner still executes only the existing six inquiry cases; it does not run the future
booking/OAuth/worker matrix below. It never migrates or deletes records automatically.

## Migration review

- 20260927082715_full_schema changes User's primary key, drops Post, and adds required
  updatedAt without a default. Never replay blindly against populated/shared databases.
- 20261011000000_inquiry_idempotency creates IdempotencyRecord, its user foreign key,
  and operation/principal/key uniqueness. Booking and OAuth consumption depend on it.
- 20261011120000_notification_outbox creates the enum/table/indexes. updatedAt is
  TIMESTAMP(3), matching JavaScript millisecond Date precision required for lease fencing.
- No new migration or generated client is needed for Phase 1F. Remote migration state
  remains unknown; repository files do not prove deployment.

## Lease ownership contract

updatedAt is an optimistic concurrency version as well as the lease timestamp. A claim
matches id, PENDING and the discovered updatedAt; it explicitly advances the version to
max(now, prior + 1ms). Delivery, suppression, retry and terminal failure updates require
PROCESSING, that exact claimed version, and an unexpired five-minute lease. Counters and
suppression logs reflect only successful acknowledgments. Lost leases log an ID-only event.

Each acknowledgment advances the version. Expired recovery writes now only to versions at
least five minutes old. Redrive reads FAILED, compares its version, and advances it. These
rules prevent same-millisecond ABA when FAILED is redriven and reclaimed. Future writers
must preserve this monotonic contract; no database trigger enforces it. Mixing old and new
worker deployments is unsafe: old workers still perform unconditional acknowledgments.
Drain/disable old workers before activating the new implementation.

Each compare-and-set is one conditional database update. No transaction spans SMTP.
Wall-clock skew can delay recovery or cause early expiry; synchronized clocks and bounded
execution remain operational requirements. State fencing cannot undo a provider submission.
Acceptance followed by crash or delayed delivery can still produce duplicate emails.

## Real-database verification matrix (prepared plan, not executed test suites)

All cases use unique synthetic run IDs, .test email addresses, a disposable local database,
mocked SMTP/provider clients, independent Prisma connections, and email delivery disabled.
Use explicit process barriers instead of sleeps for races. Assert persisted row counts and
values directly; HTTP status or in-memory results alone are insufficient.

### Booking F01

1. Create two synthetic users. Reuse a key with identical contact details; assert distinct
   owner-scoped bookings and idempotency records. Also separate guest/authenticated scopes.
2. Replay identical payload/key; assert one booking, original reference, one logical event.
3. Change price/passenger/itinerary with the same scope/key; assert 409 and unchanged data.
4. Release two independent connections/processes simultaneously with one scoped key;
   assert one committed booking and one idempotency record, including dependent rows.
5. Inject a failure after booking insertion but before idempotency insertion inside the
   transaction; assert neither booking nor passenger/status children persist.
6. Terminate the original application process after commit. Start another and replay;
   assert original reference and unchanged counts. Repeat with conflicting payload.

### OAuth F05

1. Initiate synthetic OAuth through the real middleware; intercept provider exchange so
   no Google request occurs. Race callbacks with identical signed cookie/state on separate
   processes; assert one durable consumption marker and at most one exchange callback.
2. Restart a process and restore the original cookie; replay must fail from stored marker.
3. Exercise expiration, missing/wrong-browser/tampered state and denied consent. Assert
   invalid binding never inserts consumption records or creates an authenticated session.
4. Verify cookie expiration and marker retention. Never delete unexpired consumption markers.

### Outbox F03/F04

1. Insert one synthetic pending row. Synchronize independent workers after discovery;
   assert one successful conditional claim. Repeat with multiple rows and fixed batch caps.
2. Hold worker A after claim. Explicitly age its updatedAt on this disposable fixture,
   recover and claim with B. Finish A with submitted, suppressed, retry and terminal outcomes;
   assert zero stale acknowledgments and unchanged B ownership/status/counters.
3. Acknowledge after expiry without takeover; assert no write. Recover on the next invocation.
4. Freeze equivalent application clock ticks and cycle suppression, redrive and claim;
   assert strictly increasing millisecond versions. Test backward clock movement separately.
5. Kill a child process after claim, preserving PostgreSQL state. Verify recovery after
   expiry and eventual progress. Kill after mocked acceptance before acknowledgment and
   document at-least-once behavior rather than asserting exactly-once delivery.
6. Persist a retry error, nextAttemptAt and attempt count; restart and verify eligibility,
   exponential backoff, maximum failure, suppression and authorized persistent redrive.
7. Race two operators redriving one failed version; exactly one conditional reset succeeds.
8. Exercise storage outages and restoration. Missing outbox storage must return worker 503,
   never durable success. Verify no PII/credential exposure in trigger logs.

### Existing inquiry suite

Execute all six existing cases: identical guest replay, payload conflict, concurrent same-key
creation, invalid input/no record, guest/authenticated scoping, and transaction rollback.
The authenticated request includes the allowed Origin required by F02.

## Approval and execution procedure

1. Obtain explicit owner confirmation of the literal loopback host, port and exact disposable
   database name. Confirm it contains no real/shared records. Database-name suffix alone is
   not proof. A local port/tunnel must not route to a shared remote database.
2. Review all migration SQL and current schema. Obtain separate approval before applying
   migrations to the approved target. No reset, seed, create/drop database or migration
   command is authorized by this preparation document.
3. Set DATABASE_URL, DIRECT_URL and INTEGRATION_TEST_DATABASE_URL to the same approved URL
   through a secure local process environment; never paste/log the credential-bearing URL.
   Set APPROVED_DISPOSABLE_DATABASE to the exact name, EMAIL_DELIVERY_ENABLED=false,
   NODE_ENV=test and RUN_IDEMPOTENCY_INTEGRATION=true only for the approved test process.
4. Confirm outbound Google, supplier, payment and SMTP traffic is stubbed/blocked. Do not
   start the general API server against its normal .env or enable the production scheduler.
5. Agree cleanup before writing: use a unique run ID; capture exact created record IDs,
   delete only that run's records in foreign-key order through a reviewed cleanup action.
   Never truncate tables or issue broad email-prefix deletion. Preserve failure fixtures
   until reviewed. Cleanup also requires authorization; the existing six-case runner has
   no automatic teardown and does not implement the future matrix above.
6. After approval and reviewed schema setup, run the existing supported command from
   repository root: `pnpm --dir server run test:idempotency:integration`. Capture real counts.
   Implement/review the remaining matrix as separately gated executable suites before
   claiming those cases passed. Never equate skipped cases with verification.
7. Keep scheduler disabled until PostgreSQL races/recovery, staging SMTP, host entry point,
   hosting limits, monitoring and notification latency gates pass. Payments remain blocked
   on booking integrity and separate payment design/verification.
