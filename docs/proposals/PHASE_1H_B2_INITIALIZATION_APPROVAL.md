# Phase 1H-B2 — local Prisma initialization approval plan

## Preflight correction — 23 October 2026

The existing wrapper now removes both Env:PGSERVICE and Env:PGSERVICEFILE using Remove-Item
before child processes start. Its finally block removes originally absent environment entries
instead of restoring them as empty strings. It also accepts a privately supplied process
PGPASSWORD; otherwise it retains the hidden local password prompt. No credentials are logged
or written to files. The root-level flywithsafe_phase1h_b2_fixed.ps1 is separate owner work
and was not inspected or changed.

Observed verification: PowerShell AST parsing passed; actual cleanup removed both synthetic
service overrides and a native Node child inherited their absence; 8/8 synthetic target URL
checks passed; seven migration directory names and recorded hashes matched. These checks
did not invoke the wrapper's Initialize branch or access a database.

The read-only connection first encountered sandbox TCP permission denial. The authorized
outside-sandbox check reached local PostgreSQL but failed before SQL with
"fe_sendauth: no password supplied". No private PGPASSWORD or PGPASSFILE is available in the
agent process. The user's successful session does not establish agent authentication.
No Prisma status command ran; no live pending set was confirmed. The expected set remains
the seven names below, conditional on the owner's reported empty schema/absent history.
No migrations, integration tests, database writes, or recovery operations ran.

Next safe command in the owner's private local PowerShell session is the existing wrapper
with -Action Status (hidden password prompt). Share sanitized catalog/status output only.
Initialize still requires separate authorization under the latest instruction. No connection
to the original integration database or a remote database is part of either command.

Review date: 22 October 2026, Asia/Dhaka.

Planning policy: deep; context: dependencies; verification: impact; delegation: none.
Scope: prepare local commands and this report. No application, schema, migration, environment
file, or earlier security implementation is changed. Database execution is not authorized.

## Evidence and target

Repository: E:\Programming\Project\fly-with-safety; branch development; HEAD 42b4439.
All existing uncommitted work is retained. The five original migrations and both new
migrations match their recorded SHA-256 manifests byte for byte in this review.

The owner's supplied output confirms creation from template0, role postgres, server
127.0.0.1:5432, database flywithsafe_phase1h_integration, and zero public base tables.
The local PostgreSQL service was running in that output. The agent's independent read-only
connection failed with "no password supplied" before SQL executed. No default Windows
pgpass.conf was found. No password was requested in chat, printed, or stored.

Therefore identity and table emptiness have owner-supplied evidence, not an independent
agent query. Zero public base tables implies no public migration-history base table, but
to_regclass, standalone enums/sequences/routines, and live Prisma status are not yet observed.
The prepared wrapper checks these before initialization. Never equate authentication failure
or a missing migration table with successful migration-status verification.

The original flywithsafe_integration database remains outside every command in this plan.
Its previously reported one user, five idempotency records, and six notifications are not
copied, processed, exported, or deleted. This review did not connect to that database.

## Reviewed sequence — exactly seven files

1. 20260926202822_init: creates the initial User/Post scaffold and associated keys.
2. 20260927082715_full_schema: introduces application enums/tables, changes User.id to text,
   replaces its primary key, removes its sequence, and drops Post. Adds application indexes
   and foreign keys. User.updatedAt is required without a default. Safe initialization
   requires no application writes between migrations: User/Post must remain empty.
3. 20261009000000_auth_sessions_and_password_resets: creates Session and PasswordResetToken,
   unique token hashes, indexes, and cascading User foreign keys.
4. 20261011000000_inquiry_idempotency: creates IdempotencyRecord, operation/principal/key
   uniqueness, supporting indexes, and an optional User foreign key with DELETE SET NULL.
5. 20261011120000_notification_outbox: creates NotificationStatus, NotificationOutbox,
   unique nullable idempotency keys, queue/creation indexes, and millisecond timestamps.
6. 20261022000100_contact_status_new: BEGIN; local lock timeout 5 seconds; local statement
   timeout 30 seconds; adds NEW to public.ContactStatus; COMMIT.
7. 20261022000200_booking_contact_schema: separate transaction and the same SQL timeouts;
   creates BookingType/BookingStatus/BookingModel and Booking/BookingPassenger/
   BookingStatusHistory; adds nullable ContactMessage.serviceType and future default NEW;
   three primary keys, seven explicit indexes including unique Booking.referenceNumber,
   and three validated foreign keys. Booking.userId uses DELETE SET NULL; booking children
   use DELETE CASCADE; all three use UPDATE CASCADE. These clauses do not delete records now.

Migration 6 must commit before migration 7 uses NEW. PostgreSQL forbids using an enum value
added in a transaction until that transaction commits. Existing ContactStatus labels remain;
their sort order is retained, rather than reordered to Prisma declaration order.
See https://www.postgresql.org/docs/18/sql-altertype.html.

All referenced parent tables exist earlier in the sequence. Booking IDs intentionally lack
database defaults because Prisma supplies cuid values. The ordinary booking reference index
duplicates the unique index but matches the current schema and is left unchanged.
The first five files have no explicit transaction/SQL timeout wrappers. Do not assume whole-
chain atomicity. Only the final two files explicitly enforce their reviewed local timeouts.
The proposed process also requests PostgreSQL session timeouts; actual connector propagation
has not been verified and is not relied upon as proof that historical DDL is bounded.

No seeds, provider calls, SMTP, data backfills, or integration tests are part of initialization.
Migration 2 is destructive DDL against its empty scaffold. This plan does not authorize
replaying it against a populated database. Keep API, workers, and other writers stopped.

## Prisma and target isolation

Observed installed versions: prisma 7.10.0; @prisma/client 7.10.0; Node v26.9.0;
TypeScript 5.9.3. Installed CLI help confirms migrate status/deploy support --config.
No migrate deploy dry-run option is advertised by this installed CLI.

Automatic discovery chooses prisma7.config.ts. Both config files read DIRECT_URL; runtime
PrismaPg reads DATABASE_URL. Always pass --config prisma.config.ts explicitly. Normal
server/.env must remain unchanged and must not supply a migration target. The wrapper sets
all three runtime/CLI/test URLs to one privately constructed local URL before config loads.

Prepared command file: docs/proposals/phase1h-b2-local-prisma.ps1.
It defaults to Status. Initialize is the only branch invoking migrate deploy. It:

- Checks the seven directory names and every reviewed file hash before connecting.
- Obtains the password through private Read-Host -AsSecureString input, never a command-line
  argument or committed file. URL-encodes it and fixes protocol, role, host, port, and database.
- Forbids query strings, fragments, alternate hosts, alternate databases, and URL overrides.
- Sets DATABASE_URL, DIRECT_URL, and INTEGRATION_TEST_DATABASE_URL identically in this process.
- Fixes libpq host/hostaddr/port/database/user and removes a possible PGSERVICE override.
- Disables email, workers, and both integration-test opt-ins. No server or test runner starts.
- Runs explicit READ ONLY catalog SQL with timeout, using psql -X -w and literal target flags.
- Requires identity 127.0.0.1:5432 / flywithsafe_phase1h_integration / postgres. Initialize also
  requires zero public tables, absent history, zero relations, zero enum/domain/composite types,
  and zero public routines. Leftover schema objects cause refusal rather than cleanup.
- Uses the installed local CLI and explicit config. Restores previous process environment
  and location in finally; clears the BSTR/private input references. Managed strings may remain
  in process memory until collected; use a private terminal without transcription and close it.

The wrapper never reads a remote URL as its target and contains no database creation/reset/
drop, seed, history-resolution, or test command. This is bounded command preparation, not a
sandbox against malicious edits or concurrent environment/config tampering. Keep the session
exclusive and re-review if files or database contents change.

## Proposed commands — not executed

From repository root in a private local PowerShell terminal:

```powershell
# Read-only readiness/status. Password goes into the local hidden prompt only.
& .\docs\proposals\phase1h-b2-local-prisma.ps1 -Action Status
```

Require catalog result IDENTITY_OK|0|f|0|0|0 and output identifying the exact local database.
Expected pending set: the seven names listed above, because supplied inventory has no tables.
This is not a live CLI-confirmed pending set yet. Prisma status can exit 1 for pending files,
absent history, connection errors, failed history, or divergence. Inspect its output; an exit
code alone is not acceptance. See https://www.prisma.io/docs/cli/migrate/status.

Only after explicit approval for this exact database and seven-file initialization:

```powershell
& .\docs\proposals\phase1h-b2-local-prisma.ps1 -Action Initialize
```

Its write command is exactly:

```powershell
node node_modules/prisma/build/index.js migrate deploy --config prisma.config.ts
```

Do not run that bare command outside the wrapper. It applies every pending migration, not
an arbitrary subset. Initialization repeats identity, emptiness, and file-hash checks before
execution, then runs migrate status after a successful deploy. It refuses partial/previously
initialized databases; failure recovery is separately reviewed, never an automatic retry.

## Failure and recovery

Stop on the first error. Leave APIs/workers/tests stopped. Preserve sanitized logs and inspect
identity, actual objects, and migration records read-only. Never reset/drop a database, edit
old migration SQL, delete history, or manually mark unapplied SQL applied to unblock execution.

Historical migrations 1–5 lack explicit transaction wrappers; partial effects must be inspected
instead of assumed rolled back. If migration 6 commits and 7 fails, NEW should remain. The SQL
transaction in 7 should roll back its objects/default changes, but verify actual state and
distinguish connection loss after COMMIT from a confirmed rollback. Prisma history writes and
migration SQL are not assumed one atomic transaction.

For a confirmed fully rolled-back failed migration 7, a later separately approved history
repair could use the following, only inside newly reviewed exact-target configuration:

```powershell
node node_modules/prisma/build/index.js migrate resolve --rolled-back 20261022000200_booking_contact_schema --config prisma.config.ts
```

That command writes history and is not approved here. If SQL committed or has partial effects,
prepare a separate forward repair/history reconciliation. Do not remove NEW by rebuilding the
enum. Do not kill blocking sessions or increase timeouts automatically. See
https://www.prisma.io/docs/cli/migrate/resolve.

## Proposed post-migration read-only checks

Repeat exact-target Status wrapper; expect history present and migrate status exit 0. Status
does not require emptiness, so it also works after successful initialization. Then, privately:

```powershell
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
& $psql -X -W -v ON_ERROR_STOP=1 -P pager=off `
  -h 127.0.0.1 -p 5432 -U postgres -d flywithsafe_phase1h_integration `
  -f '.\docs\proposals\phase1h-b2-postcheck.readonly.sql'
if ($LASTEXITCODE -ne 0) { throw 'Read-only schema verification failed.' }
```

Require zero rows from integration-schema-preflight.sql, seven completed/non-rolled-back
history records with matching migration checksums, and no unresolved failed attempts.
Expect 19 application tables plus _prisma_migrations (20 public base tables total), nine
application enums, and no Post table. Verify all tables/indexes/FKs against migration SQL;
the existing preflight covers required booking/contact objects and critical durable keys,
not an exhaustive drift comparison of every historical object. Explicitly inspect outbox
updatedAt TIMESTAMP(3), its status/nextAttemptAt index, all enum labels, contact default NEW,
valid/ready indexes and FK actions. Count all business tables read-only; initialization
should create no business rows. Do not seed or erase records to satisfy an expected count.

The new postcheck file contains only a read-only transaction, catalog/count SELECTs, and psql
display/error settings plus a relative include of the existing catalog preflight. There is
no program execution, export, DML, or DDL. Query results remain metadata/counts, not customer data.
The original database needs no connection or comparison operation in this phase.

## Approval boundary and readiness verdict

Prepared seven-file initialization is ready for conditional approval; live independent
authentication/catalog/status verification remains open. SQL was reviewed, not executed.
PowerShell parsing and manifest/diff checks are local evidence, not database interoperability.
Observed checks: PowerShell AST parsing passed; the extracted raw-URL guard passed 10/10
synthetic acceptance/rejection checks without connections; all seven migration directory names
and hashes matched; tracked git diff --check and new-artifact whitespace checks passed.
The command wrapper itself was not invoked, so private authentication, native subprocess
behavior, PostgreSQL parsing, migration execution, and postcheck results remain unverified.
No TypeScript or server-suite rerun is warranted for documentation/command preparation;
previous test counts are historical, not new results in this phase.

The 16 write-capable PostgreSQL cases remain unexecuted and need separate approval. The
reliability runner still hard-codes the original database; the existing reviewed name patch
must be separately applied and verified before any tests on the fresh target. Initialization
approval never authorizes that runner, synthetic fixtures, fixture cleanup, SMTP, providers,
production access, database resets, or failed-history repair.

Approval requested: apply exactly these seven unchanged migrations only to
127.0.0.1:5432/flywithsafe_phase1h_integration as postgres, after fresh read-only identity,
empty-schema/no-history, manifest, and expected-pending-set checks pass. Stop on any failure.
Leave flywithsafe_integration and every remote database untouched. No integration tests.
