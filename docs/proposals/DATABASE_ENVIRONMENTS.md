# FlyWithSafe database environments — reconciled 2026-11-02

## Approved topology

One owner-approved main Prisma Postgres resource for normal application/eventual production; one reusable isolated local integration database. Same application source, Prisma schema and approved migration history. Synthetic bookings are never copied into main. Do not create a database per phase.

| Environment | Current verified evidence | Use |
|---|---|---|
| Main cloud: flywithsafety (owner confirmed; originally fly-with-safety) | `server/.env` application/direct targets observed PostgreSQL17.2, database postgres, role prisma_migration; restored actual server runtime confirms that identity. Console designation/branch supplied by owner; Console resource IDs not independently reverified after display rename | Existing normal accounts/bookings and future production candidate; never synthetic fixture copying or unapproved migration. |
| Existing local flywithsafe_phase2_booking_integration | Last actual runtime identity127.0.0.1:5432, restricted flywithsafe_phase2_booking_test,7 approved migrations; last accepted23 core rows and39 commercial invariants | Reuse for future isolated integration phases without renaming/recreation. Fresh local catalog/count inventory pending private owner connection; historical data is not current-state proof. |
| Older G3/Phase1 local test databases | Historical accepted evidence only in this reconciliation | Preserve as archives; no automatic deletion, copying or new active phase-specific databases. Fresh local database-name list pending read-only inventory. |
| Cloud staging: flywithsafety_integration (current owner-confirmed display name; previously referred to as flywithsafe_integration) | Separate preserved Prisma Console resource; private connection unavailable for live SQL inventory in this run | Reusable staging/pre-production; preserve data/resource identity. Not the local integration DB and not selected for destructive/concurrency tests. |

Owner-confirmed main Console page: https://console.prisma.io/cmr4h7y84092u2gf6aqtu32qw/ebvsrvtie5e0vv31n4f6am2t/jgvevze54bpesx0ke84grxds/dashboard?branch=br_jbi4xfn1mfzcbop1z6v3rwvy . No connection token or password is recorded here. Local physical database name stays unchanged, including its phase2 suffix. No phase3/phase4/phase5 database creation is planned.

Display-name changes are metadata decisions, not instructions to replace URLs or credentials. Post-rename read-only verification of both currently configured main keys succeeded: same observed SQL identity, same9 users/9 bookings, same migration ledger as the prior inventory. This proves current credentials remain valid for that observed target; it does not prove byte-for-byte credential continuity, full row equality or independent Prisma Console resource-ID continuity. Staging's live credentials/resource mapping have not been tested. No connection string or secret hash was persisted for comparison.

## Prisma7 configuration key mapping

Installed Prisma CLI, Client and PrismaPg adapter are all7.10.0. `server/src/lib/prisma.ts` explicitly passes `process.env.DATABASE_URL` to PrismaPg; DIRECT_URL is not its runtime fallback. Default `server/prisma.config.ts` and explicitly selected `server/prisma7.config.ts` both use DIRECT_URL for CLI datasource and the same schema/migrations paths. prisma7.config.ts is not automatically selected just because the installed version is7; use an explicit --config when choosing it. No CLI schema command was run here.

| Context | Private source keys | Effective selection |
|---|---|---|
| Normal main development | DATABASE_URL / DIRECT_URL in unchanged server/.env | Application uses DATABASE_URL; CLI config uses DIRECT_URL. |
| Staging proposal, NOT ACTIVE | INTREGRATION_DATABASE_URL / INTREGRATION_DIRECT_URL in server/.env.staging.local | No current automatic consumer/fallback. Explicit owner-selected staging process would map these to its own DATABASE_URL / DIRECT_URL only. |
| Local reusable testing | Existing private local role/target and process-local test URL | Never load cloud staging keys as a local fallback; never copy local credentials into normal server/.env. |

The spelling **INTREGRATION** is the owner's requested key contract; do not silently change it to INTEGRATION. Proposed private file (not created/populated):

```dotenv
# server/.env.staging.local — Git-ignored, explicit staging selection only
INTREGRATION_DATABASE_URL=
INTREGRATION_DIRECT_URL=
```

Root/server ignore rules already cover this filename (verified with git check-ignore). Normal dotenv discovery does not select this staging file, and neither Prisma config automatically reads these aliases. Do not add alias fallback to the normal runtime/config. Activation and any migration remain separate approved operations. Existing placeholder-only server/.env.example and normal environment files were not overwritten.

## Current normal development restoration

Original Next app runs localhost3000 with process-local API localhost5000; original Express server runs localhost5000 from unchanged server/.env and original authentication code. Prior isolated bootstrap and phase2.localhost ports are not normal-development targets. No real data/account replacement or synthetic cloud writes performed by agent.

During this read-only review the original backend is started with `--no-outbox-worker`. This explicitly prevents periodic outbox admission before startup; default behavior without the flag is unchanged. Restore normal background delivery only under owner authorization for that cloud activity. No persistent environment change. An unsafe start-then-stop worker attempt was rejected automatically and never ran; its wrapper is retired.

## Actual cloud/schema findings

Read-only pooled/application and direct sessions completed ROLLBACK. Observed20 application/history tables,19 Prisma models and206 application columns. All model/column names match current source; public extension views add51 information-schema columns and are not extra application columns. Booking/Passenger/StatusHistory and Booking.bookingDetails JSONB already exist. ContactMessage.serviceType,9 enums including ContactStatus.NEW and default NEW exist.

Counts at inventory: User9,Booking9,Passenger10,Session127. These are aggregate observations only, not content copied or a guarantee against subsequent normal user activity. Current local inventory must be refreshed independently.

Cloud ledger has6 records:5 distinct completed migrations plus one rolled-back auth attempt followed by its completed attempt. No unresolved failed migration is established by that historical rollback row. Source/local-approved history has7 migrations. First four raw checksum differences exactly match LF-normalized current SQL; no SQL-content change is inferred, and no checksum/ledger edit is justified merely to force byte equality. The outbox migration raw checksum matches.

Missing cloud ledger entries:20261022000100_contact_status_new and20261022000200_booking_contact_schema. Their physical objects already exist, so absence from history does NOT mean those tables/features are absent. Do not blindly deploy their CREATE TYPE/CREATE TABLE statements against existing objects.

Phase2 quotations, manual payment records and receipts are versioned data in existing Booking.bookingDetails JSONB, not new quotation/payment tables. Shared schema support exists in cloud and the accepted local schema; the three synthetic quotes/one unverified payment/five receipts belong only to the local test booking. They are not synchronized to cloud. Protected Phase1 additive test storage/activation is a separate previously approved gate; do not silently apply its DDL to main or reopen accepted GateA work.

## Remaining non-destructive migration plan — not executable approval

1. Main designation is owner-confirmed. Complete fresh local catalog inventory and remote-integration inventory through an authorized private connection; do not infer its schema from main.
2. Compare enum/default/index/FK definitions against every statement of the two unrecorded migrations. Matching column names alone is insufficient; cloud has14 catalog FKs and historical local proof reported11, so exact live comparison is pending.
3. If every final-state predicate already matches, prepare an owner-approved adoption of the missing migration history using the supported migration tooling, preserving historical completed/rolled-back records. Do not replay existing-object DDL or rewrite checksums blindly.
4. If any actual schema predicate differs, prepare only the reviewed additive/compatible delta with transaction/lock limits, data-preservation snapshots and recovery procedure. Obtain explicit approval before main schema/history mutation.

No migrations, resolves, resets, grants, data copies or database deletions were run. A reusable test environment does not imply equal migration metadata or automatic synchronization.

## Shortest Phase2 path

Keep normal development restored. Complete fresh local read-only inventory using existing restricted role/private prompt; no cloud credentials. Then schedule a bounded isolated integration session using the SAME original app/source and the existing local target, without parallel backend implementation or synthetic writes to normal cloud. Owner supplies existing synthetic ACCOUNT password privately in browser; do not replace normal account credentials or recreate accepted fixtures. Reuse accepted39 commercial invariants. Remaining canonical requirements3–14 need their actual browser/creation-retry/cleanup/final evidence. Exact cleanup remains separately authorized. Phase1 G7 accepted; Phase2 blocked; Phase3 not ready.
