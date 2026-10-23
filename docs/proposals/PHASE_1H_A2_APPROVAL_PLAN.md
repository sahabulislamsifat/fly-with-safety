# Phase 1H-A2 — live evidence and approval plan

## Evidence boundary

The owner supplied psql catalog output from 127.0.0.1:5432/flywithsafe_integration as
postgres. A BEGIN READ ONLY session reported transaction_read_only=on. This is owner-supplied
live evidence, not an independently authenticated agent connection. No passwords were requested.

The public inventory contains 16 application tables plus _prisma_migrations. Booking,
BookingPassenger and BookingStatusHistory are absent. The public enum inventory contains
no BookingType, BookingStatus or BookingModel. ContactMessage lacks serviceType, its status
default is OPEN, and ContactStatus contains OPEN, IN_PROGRESS, RESOLVED and CLOSED (no NEW).
NotificationOutbox.updatedAt has datetime precision 3. These findings confirm repository
migration gaps identified in commit 803fcea; no table mapping explains the missing objects.

Five migrations are completed and not rolled back. All five supplied SHA-256 checksums match
repository migration.sql contents after LF normalization. Raw checkout hashes differ solely
because checkout files use CRLF. This is not evidence of edited migration SQL. Keep the five
completed migrations immutable; do not change their checksum records or mark new work applied.

The supplied output stops inside the constraint section. It shows existing auth/inquiry FKs,
ContactMessage and IdempotencyRecord primary keys, the idempotency user FK and the outbox PK,
but does not include the final index section. Existing index definitions remain unverified.
All booking constraints/indexes are absent because their tables are absent.

Statistics do not prove emptiness: n_live_tup=0 includes _prisma_migrations even though the
same session selected five rows. reltuples=-1 means statistics are unavailable. Preserve all
data until exact aggregate counts, ownership/disposability confirmation and a preservation
decision are obtained. No cleanup, reset, seed or truncation is approved.

## Inspection-script review

schema-readiness.readonly.sql contains BEGIN READ ONLY, SET LOCAL statement_timeout,
catalog SELECTs and COMMIT. It has no DDL, DML, DO/CALL/EXECUTE, COPY, file export, shell,
psql metacommand or customer-record selection. Functions used are PostgreSQL metadata/identity
functions. It does not itself enforce connection hostname; the caller must bind loopback and
the exact database. schema-readiness-hardening.review.patch additionally pins search_path
to pg_catalog and qualifies public._prisma_migrations. This patch is not applied.

## Migration review and order

Both review SQL files match the reported missing objects; no conflicting booking enum/table
was present in the supplied public catalog. Existing indexes still require final confirmation.
The proposals create three enums, three tables/PKs, seven explicit indexes and three FKs,
add nullable serviceType, add NEW and change the contact default. Existing rows/labels remain.
No drops or existing-row rewrites are proposed. Future child deletion cascades are intentional.
The redundant non-unique referenceNumber index is retained to match the current Prisma schema.
NEW is appended without reordering existing enum labels; code must not assume declaration-order
sorting matches PostgreSQL enum ordering. Labels/default behavior are the relevant contract here.

Proposed NEW migration directories, not created:

1. 20261022000100_contact_status_new — reviewed enum addition only.
2. 20261022000200_booking_contact_schema — reviewed booking/contact schema SQL.

migration-safety.review.patch proposes explicit BEGIN/COMMIT boundaries, public-qualified
objects and local 5-second lock / 30-second statement limits. Commit migration 1 before
migration 2 uses NEW. Do not wrap both in one transaction. The second file is atomic;
if it fails, the additive enum label may remain and recovery requires review, not resetting
the database or blindly marking a migration applied. A large/busy ContactMessage table may
cause lock timeout; schedule appropriate downtime instead of silently increasing limits.

PostgreSQL documentation: https://www.postgresql.org/docs/18/sql-altertype.html
Prisma migration history: https://docs.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/migration-histories

## Preflight proposal

integration-preflight.review.patch adds a single catalog-only validation query from
integration-schema-preflight.review.sql before tests. It checks booking/contact columns
and nullability/types, enum label membership, primary keys, valid ready non-partial B-tree
index definitions/uniqueness, validated FK targets/actions, contact default and timestamp
precision. It also compares applied migration checksums with raw/LF/CRLF file variants and
rejects unresolved failed migrations. It does not modify the active runner until approved.

Patch applicability and proposed runner JavaScript syntax were checked locally. Catalog SQL
has not been executed or validated by PostgreSQL. Live post-migration checks remain necessary.

## Approval-ready local workflow — NOT executed

1. Owner explicitly confirms database identity, disposability, acceptable exact-record test
   cleanup and data-preservation/backup decision. Supply the remaining index output with
   psql pager disabled; obtain exact aggregate counts without exporting customer rows.
2. Approve proposal patches and creation of the two NEW migration directories. Re-review
   exact bytes/checksums and confirm there are no other pending migrations.
3. Set DATABASE_URL, DIRECT_URL and INTEGRATION_TEST_DATABASE_URL privately to the identical
   loopback target, not normal remote .env values. Verify guard and identity independently.
   Set APPROVED_DISPOSABLE_DATABASE=flywithsafe_integration, EMAIL_DELIVERY_ENABLED=false.
   An approval/configuration flag is not itself human permission. Never print credentials.
4. Obtain separate approval to apply these two migrations to this local database. Only then,
   from server/, the proposed command is:

   node node_modules/prisma/build/index.js migrate deploy --config prisma.config.ts

   This applies pending migrations, so verify the pending set first. Do not use db push,
   migrate dev/reset, shadow databases or direct psql execution of review SQL. Prisma should
   record the two new migrations itself. Do not edit completed records or run resolve unless
   an independently reviewed recovery case genuinely requires it.
5. Re-run read-only catalog inspection and the proposed schema query. Require all three
   tables, types, columns, defaults, validated relationships and indexes; zero schema issues;
   successful new migration records/checksums; preserved pre-existing counts/values. Recheck
   outbox emptiness using COUNT(*) rather than estimates before global worker tests.
6. Separately approve 16 integration cases plus fixture cleanup. Only after that enable both
   integration flags and run from server/: node test/run-postgres-integration.mjs
   Keep SMTP disabled and provider behavior mocked. No scheduler/production activation.

## Status

NOT READY for 16 write-capable tests. Actual missing objects are confirmed from supplied
catalog evidence. Disposability, trustworthy data counts, complete index evidence, approved
migration artifacts/application and post-migration verification remain gates.

No production connection, database write, migration, active runner/source edit, deployment,
Git commit or push was performed during this review. Existing security/reliability work remains.
