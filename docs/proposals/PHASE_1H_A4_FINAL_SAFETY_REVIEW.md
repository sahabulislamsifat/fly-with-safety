# Phase 1H-A4 — final migration and test approval plan

Review date: 22 October 2026, Asia/Dhaka. Planning: compact; context: dependencies;
verification: impact; delegation: none. This phase changes review documents only.
Nothing below authorizes or executes a database operation.

## Repository and evidence

Branch development; HEAD 42b4439; earlier uncommitted work remains intact. All five original
migration files match the byte hashes recorded before Phase 1H-A3. Both new migration files
also match their finalized manifest. Git diff validation passed. No application source,
runner, schema, migration SQL or client/app/layout.tsx was changed during this review.

The owner's correctly targeted evidence identifies 127.0.0.1:5432/flywithsafe_integration,
postgres, 17 public tables, 72 indexes and five completed/non-rolled-back migrations. Supplied
checksums match local files after LF normalization. Booking tables/enums and contact changes
are missing. Outbox timestamp precision is 3. Index definitions include the expected user,
idempotency and outbox keys. pg_indexes definitions alone do not establish indisvalid/indisready;
the proposed catalog preflight checks those flags after schema initialization.

Exact supplied counts: one user, zero contacts, five idempotency records, six notifications.
Other table counts are not established. Preserve all records, including the six notifications;
do not process, copy, delete or repurpose them for tests. The empty index output from the
different postgres database is excluded. This phase did not reconnect or refresh database state.

## Reviewed migration SQL

1. 20261022000100_contact_status_new/migration.sql
   BEGIN; 5s local lock timeout; 30s local statement timeout; add NEW to public.ContactStatus;
   COMMIT. No existing enum label or record is removed or rewritten.
2. 20261022000200_booking_contact_schema/migration.sql
   Separate BEGIN/COMMIT and the same limits. Creates BookingType, BookingStatus, BookingModel;
   adds nullable ContactMessage.serviceType and changes the future-insert status default to NEW;
   creates Booking, BookingPassenger, BookingStatusHistory and their primary keys; creates seven
   explicit indexes (one unique reference, six ordinary indexes); adds three validated FKs.

Booking.userId is optional, references User.id with SET NULL on deletion; passenger/history
bookingId references use CASCADE deletion. All update actions are CASCADE. These clauses do
not execute deletion/update of existing data. Objects are public-qualified. All timestamp
columns use precision 3. Prisma generates cuid IDs; SQL intentionally has no cuid default.
The ordinary referenceNumber index is redundant with its unique index but matches the schema.
There is no DML, DROP, reset, seed, backfill, COPY or destructive operation in the two new files.

Migration 1 must commit before migration 2 uses NEW as a default. Existing contact labels and
values remain valid; enum sorting order is not rearranged to match Prisma declaration order.
SQL has been reviewed and generated offline, not executed or proven against PostgreSQL here.

Relative to the supplied five applied names, the existing database has exactly those TWO
new migrations pending. This remains a supplied-history comparison, not a fresh CLI status.
A new empty database instead needs ALL SEVEN migrations, in directory order.

## Recommended isolation

Prefer a separately provisioned local database named flywithsafe_phase1h_integration for the
16 cases. Do not clone the existing database: initialize from template0 and migrations only,
without customer records, seed data or copied notifications. Leave flywithsafe_integration
unchanged during test preparation/execution. Creation and initialization require explicit
approval; the fresh database does not yet exist as a verified fact.

The generic integration-target guard already accepts this literal-loopback *_integration
name when APPROVED_DISPOSABLE_DATABASE matches. However, run-postgres-integration.mjs still
hard-codes flywithsafe_integration twice. disposable-runner-name.review.patch is prepared,
not applied: it replaces only those name checks with the exact approved name from the
already validated environment. Its JavaScript syntax and patch applicability passed.
Approve/application-test this patch before attempting tests on the fresh target. Never
weaken hostname, matching URL, explicit opt-in, disabled-email or empty-outbox gates.

## Target guards — proposed commands only

No password or full credential-bearing URL should be pasted, printed or committed. Supply
DATABASE_URL, DIRECT_URL and INTEGRATION_TEST_DATABASE_URL privately in a dedicated process
environment. They must be identical. Never rely on server/.env: its current runtime and CLI
defaults point to remote Prisma hosts; the integration URL is unset. INTEGRATION_TEST_DIRECT_URL
is not consumed by the application/runner and is not a safety control.

From server/, select EXACTLY ONE target and run this guard before any Prisma command:

```powershell
$reviewDatabase = 'flywithsafe_phase1h_integration' # fresh testing target
# For a separately approved migration of existing data, use 'flywithsafe_integration' instead.
if (-not $env:DIRECT_URL -or $env:DIRECT_URL -cne $env:DATABASE_URL -or
    $env:DIRECT_URL -cne $env:INTEGRATION_TEST_DATABASE_URL) {
  throw 'Explicit identical runtime, CLI and integration targets are required.'
}
try { $reviewTarget = [System.Uri]::new($env:DIRECT_URL) }
catch { throw 'Invalid target configuration.' }
if ($reviewTarget.Scheme -notin @('postgres', 'postgresql') -or
    $reviewTarget.Host -ne '127.0.0.1' -or $reviewTarget.Port -ne 5432 -or
    $reviewTarget.AbsolutePath -cne "/$reviewDatabase" -or
    $reviewTarget.Query -or $reviewTarget.Fragment) {
  throw 'Only the exact approved loopback database is permitted.'
}
```

Do not change these environment values between guard, identity inspection and approval.
Installed CLI/client 7.10.0 supports --config. Auto-discovery previously chose prisma7.config.ts;
always pass prisma.config.ts explicitly. Do not execute db push or migrate dev/reset.

### A. Read-only status of the existing database

After choosing the existing target in the guard and configuring its private local URLs:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -W -h 127.0.0.1 -p 5432 -U postgres -d flywithsafe_integration -v ON_ERROR_STOP=1 -c 'BEGIN READ ONLY; SELECT current_database(), inet_server_addr(), inet_server_port(); COMMIT;'
node node_modules/prisma/build/index.js migrate status --config prisma.config.ts
```

Expect exactly the two new migration names pending; inspect status/output rather than treating
the pending-migrations exit code as permission to deploy. Stop on unknown/failed/checksum-conflicting
history or any changed pending set. These commands were prepared, not executed in this phase.

### B. Fresh database creation — separate approval required

First use a read-only pg_database query against local postgres to establish the proposed
name does not exist. Do not reuse an existing database or grant disposability by its name.
After approval of the exact host, name and owner, the proposed creation command is:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\createdb.exe' -W -h 127.0.0.1 -p 5432 -U postgres --owner=postgres --template=template0 --encoding=UTF8 flywithsafe_phase1h_integration
```

If the name exists or creation fails, stop. No IF NOT EXISTS, deletion, recreation or reset.
Authenticate privately. Read back identity and public table inventory; require the new target
and no application tables before initialization. Creation approval grants no migration approval.

### C. Schema initialization or existing-database migration — separate approval

Configure and guard the appropriate target, inspect status, and approve the exact pending set.
Only then is this the proposed command:

```powershell
node node_modules/prisma/build/index.js migrate deploy --config prisma.config.ts
```

Existing database: two migrations. Fresh database: seven. The historical full_schema migration
drops Post and replaces User's primary key; on a verified empty fresh target Post is only the
empty scaffold created by migration 1. Never replay that historical migration on populated data.
No seed or reset is part of initialization. This command applies every pending migration.

## Failure/recovery decision tree

1. Stop immediately on error; do not start workers/tests, reset, delete objects, alter old
   migration bytes or modify _prisma_migrations manually. Preserve logs privately.
2. Read identity, migration records and actual objects using read-only inspection. Distinguish
   a rolled-back SQL transaction from an ambiguous connection loss after COMMIT. Prisma history
   metadata is not necessarily rolled back with migration SQL.
3. If enum migration 1 fails before commit, verify NEW is absent and inspect its failed record.
   If it committed, keep NEW. Do not rebuild the existing enum to remove it.
4. If migration 1 succeeded but migration 2 failed, migration 2's explicit transaction should
   roll back its SQL, while NEW remains. Verify tables/types/contact column/default explicitly.
   Do not infer rollback from the error text alone; existing data must remain unchanged.
5. A failed history entry can block later deploys. Only after review proves all SQL effects
   of that failed file rolled back may the owner separately approve the appropriate command:

   node node_modules/prisma/build/index.js migrate resolve --rolled-back 20261022000200_booking_contact_schema --config prisma.config.ts

   This writes migration history; it is NOT authorized now. If SQL actually committed but
   metadata did not, review an applied-resolution path separately; never mark unapplied SQL
   applied. Partial unexpected effects require a dedicated forward-repair proposal.
6. Reattempt deploy only after a newly approved recovery decision and target/status checks.
   On lock timeout, identify the blocking session/read workload; do not kill sessions or
   silently raise limits. On the fresh target, do not drop it as an automatic recovery action.

## Post-migration and test gates

- Guarded migrate status: seven completed records, no unresolved failures/pending migrations,
  matching immutable SQL checksums (account for LF/CRLF variants).
- Read-only schema inspection and integration-schema-preflight.sql: three booking tables/enums,
  correct columns/nullability/defaults/precision, valid/ready unique and ordinary indexes,
  primary keys and validated FK actions. Require zero preflight issues; SQL execution remains
  unverified until this step. No database-side tests or writes are implied by catalog checks.
- Existing database, if separately migrated: preserve the one user, five idempotency records
  and six notifications, and compare approved counts/integrity for every other populated table.
  Metadata/additive schema operations do not authorize inspection/export of personal values.
- Fresh test target: zero business rows and empty outbox before the approved fixture run.
  Never alter existing notifications just to pass preflight. Keep APIs/workers stopped.
- Approve the runner-name patch and its isolated regressions separately. Then approve the
  exact 16 tests AND their synthetic cleanup. Set both integration opt-ins, exact approved
  database name, disabled email and disabled worker only for that controlled process.
- Both suites use unique synthetic identities; cleanup selects those exact identities/keys
  then deletes matching IDs/keys. User deletion cascades only its synthetic auth children;
  booking deletion cascades its passenger/history fixtures. There is no blanket truncate.
  Cleanup runs even on failures and is not one atomic transaction; partial cleanup may need
  exact-ID review. If failure fixtures must be retained, approve a retention patch before tests.
- The 16 cases remain unexecuted. Mocks cover external providers/SMTP, not real receipt.
  Child-process and concurrency cases still require real execution to establish behavior.

## Explicit approval boundaries

Approve independently: (1) fresh target/owner/disposability and creation; (2) its seven-migration
initialization; (3) any two-migration change to the existing preserved database; (4) proposed
runner-name patch; (5) sixteen write-capable tests plus exact-record cleanup; (6) any failed
migration history resolution or forward repair; (7) any backup/export, fixture retention
change, or database deletion. None is performed or implied by this review. Local approval
never grants permission to migrate/connect to the remote production database.
