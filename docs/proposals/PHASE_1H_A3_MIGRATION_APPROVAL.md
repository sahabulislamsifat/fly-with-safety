# Phase 1H-A3 — local migration approval report

Status: migration files finalized, NOT applied. No database operations or integration tests
were executed by the agent. Earlier security/reliability changes and client/app/layout.tsx
were preserved. Do not commit/push/deploy these migrations without separate authorization.

## Verified evidence and preservation

Owner-supplied catalog output identifies 127.0.0.1:5432/flywithsafe_integration as postgres,
five completed/non-rolled-back migrations, and 17 public tables. The corrected index output
contains 72 indexes, including unique IdempotencyRecord(operation,principal,key), unique
NotificationOutbox(idempotencyKey), its status/nextAttemptAt index, and User primary/email keys.
The preceding empty-index output was from the different postgres database and is disregarded.

Booking/BookingPassenger/BookingStatusHistory, their three enums, ContactMessage.serviceType,
ContactStatus.NEW and the NEW contact default are missing. Existing outbox precision is 3.
All five recorded migration checksums match repository SQL after LF normalization; raw
CRLF byte differences do not imply edited SQL. Prior migration bytes were snapshotted and
confirmed unchanged after preparation (phase-1ha3-existing-migration-hashes.json).

Exact owner-supplied counts: User=1, ContactMessage=0, IdempotencyRecord=5,
NotificationOutbox=6. Other application row counts remain unknown. Preserve ALL existing
records. Do not clear or send the six outbox records. The name does not establish disposability;
owner confirmation, preservation/backup decision and explicit local migration approval remain.
The 16-case test runner must remain blocked by its empty-outbox check until a separately
approved preservation/isolation plan exists. No deletion, reset, seed or processing is implied.

## Exact new migrations

1. server/prisma/migrations/20261022000100_contact_status_new/migration.sql
   Adds NEW to public.ContactStatus. Explicit BEGIN/COMMIT, 5s lock timeout, 30s statement timeout.
   SHA-256: 4c9af2c97dd22a88cb3b7e5fe5422ac1023bcc86fcde999409033ac5180178a7
2. server/prisma/migrations/20261022000200_booking_contact_schema/migration.sql
   Creates three booking enums and three tables/primary keys; creates seven explicit indexes
   (one unique, six non-unique); adds three FKs; adds nullable ContactMessage.serviceType and
   changes only the default for future contact status inserts. Explicit transaction/timeouts.
   SHA-256: bc10e7343b3c40769c43deee8b3164245319a9f35d7a3b50d4e3ee721895f32b

All objects are public-qualified. Booking.userId is optional with ON DELETE SET NULL;
passenger/history booking references use ON DELETE CASCADE; all three use ON UPDATE CASCADE.
ON DELETE/UPDATE clauses define future FK behavior; no DELETE/UPDATE data statement exists.
No DROP, TRUNCATE, existing-row rewrite, schema push or data backfill is present. Prisma
generates cuid IDs; these IDs deliberately have no database-side defaults. Existing contact
labels/values remain valid. The redundant non-unique reference index matches schema.prisma.

Migration 1 commits before migration 2 references NEW. The enum addition is deliberately
separate. The additive label can remain if migration 2 fails. Do not remove it automatically.
Migration 2 is transactional: inspect a failure and its history record before approving
recovery. Do not reset, blindly rerun, edit completed migration SQL, manually edit history,
or use migrate resolve without a separately reviewed recovery procedure.

Relative to the owner's supplied five completed names, the seven local directories contain
EXACTLY these two pending migrations. This is an offline comparison against supplied live
evidence, not an agent-run prisma migrate status result. Reconfirm live status before approval.

## Applied code/file changes

- server/test/run-postgres-integration.mjs: reviewed preflight patch applied; it remains gated.
- server/test/integration-schema-preflight.sql: read-only checks for tables, columns/types,
  nullability, enum label sets, PK/index definitions and validity, FK targets/actions/validation,
  contact status default, and timestamp precision.
- server/test/migration-history.mjs: pure checksum/history verifier, including unknown applied
  records, unresolved failures, missing/duplicate completed migrations and LF/CRLF variants.
- server/test/migration-history.test.ts: seven isolated acceptance/rejection tests; no database.
- docs/proposals/phase-1ha3-existing-migration-hashes.json and
  phase-1ha3-new-migration-manifest.json: local integrity snapshots.

The preflight SQL was reviewed statically but has not been executed against PostgreSQL.
Do not equate mock history checks with live catalog verification or migration execution.

## Installed CLI and later commands

Installed Prisma CLI/client: 7.10.0. Its migrate deploy/status help confirms --config support.
Automatic CLI discovery selected prisma7.config.ts, so always select prisma.config.ts explicitly.
Both configs use DIRECT_URL; the normal .env points remotely and MUST NOT be used here.

After privately supplying identical local runtime/CLI/test URLs, this PowerShell guard must
pass from server/ before even the later read-only status command. It prints no credentials:

```powershell
if (-not $env:DIRECT_URL -or $env:DIRECT_URL -cne $env:DATABASE_URL -or
    $env:DIRECT_URL -cne $env:INTEGRATION_TEST_DATABASE_URL) {
  throw 'Explicit matching local targets are required.'
}
try { $migrationTarget = [System.Uri]::new($env:DIRECT_URL) }
catch { throw 'Invalid local migration target.' }
if ($migrationTarget.Scheme -notin @('postgres', 'postgresql') -or
    $migrationTarget.Host -ne '127.0.0.1' -or $migrationTarget.Port -ne 5432 -or
    $migrationTarget.AbsolutePath -ne '/flywithsafe_integration' -or
    $migrationTarget.Query -or $migrationTarget.Fragment) {
  throw 'Only the approved loopback integration target is permitted.'
}
node node_modules/prisma/build/index.js migrate status --config prisma.config.ts
```

Review that status with the owner. ONLY after separate explicit migration approval:

```powershell
node node_modules/prisma/build/index.js migrate deploy --config prisma.config.ts
```

Do not run the deployment command in a shell whose guarded target values have changed.
The command applies every pending migration, so the exact two-migration pending set is a gate.
Local approval grants no remote permission. Applying migrations does not authorize tests/cleanup.

## Post-migration requirements

1. Re-run local guarded migrate status; require seven completed migrations and matching
   checksums, with no unresolved failure. Do not treat history alone as schema verification.
2. Run schema-readiness.readonly.sql and the new integration-schema-preflight.sql within a
   read-only session. Require zero schema issues and the expected tables/types/defaults/FKs/
   indexes. Verify schema SQL execution itself before relying on it as a gate.
3. Compare preserved record counts and integrity. Do not alter the existing user, five
   idempotency records or six notifications. Review other table counts and retention needs.
4. Obtain separate approval for any test-data isolation/backup/cleanup action; keep the
   worker disabled and live SMTP/providers blocked. Current queue contents prevent tests.
5. Only after those gates separately approve the 16 cases and exact-record synthetic cleanup.
   PostgreSQL concurrency and provider receipt remain unverified until actually tested.

## Current verification

Backend TypeScript passed; runner syntax passed; isolated suite: 262 passed, 16 skipped.
All PostgreSQL integration flags were false. Seven new unit tests account for the increase.
Git diff validation passed. Original five migration files are byte-for-byte unchanged.
No migration SQL, database write, integration test, production connection, reset, push,
commit, deployment or live email occurred during this phase.
