# FlyWithSafe database environments — reconciled 2026-11-02

## Approved topology

One owner-approved main Prisma Postgres resource for normal application/eventual production; one reusable isolated local integration database. Same application source, Prisma schema and approved migration history. Synthetic bookings are never copied into main. Do not create a database per phase.

| Environment | Current verified evidence | Use |
|---|---|---|
| Main cloud: flywithsafety (owner confirmed; originally fly-with-safety) | `server/.env` application/direct targets observed PostgreSQL17.2, database postgres, role prisma_migration; restored actual server runtime confirms that identity. Console designation/branch supplied by owner; Console resource IDs not independently reverified after display rename | Existing normal accounts/bookings and future production candidate; never synthetic fixture copying or unapproved migration. |
| Local flywithsafety_local_integration (same existing database) | FORMALLY VERIFIED2026-11-02:OID34701,oldnameabsent,admin and restricted-role read-only postchecks PASS;7 migrations/data/owner/privileges preserved. Current6 users/1 session/0 bookings. | Permanent reusable LOCAL integration target through future phases. Reviewed guards/config references applied;normal Cloud defaults unchanged. No new database per phase. |
| Older G3/Phase1 local test databases | Historical accepted evidence only in this reconciliation | Preserve as archives; no automatic deletion, copying or new active phase-specific databases. Fresh local database-name list pending read-only inventory. |
| Cloud staging: flywithsafety_integration (current owner-confirmed display name; previously referred to as flywithsafe_integration) | Separate preserved Prisma Console resource; private connection unavailable for live SQL inventory in this run | Reusable staging/pre-production; preserve data/resource identity. Not the local integration DB and not selected for destructive/concurrency tests. |

Owner-confirmed main Console page: https://console.prisma.io/cmr4h7y84092u2gf6aqtu32qw/ebvsrvtie5e0vv31n4f6am2t/jgvevze54bpesx0ke84grxds/dashboard?branch=br_jbi4xfn1mfzcbop1z6v3rwvy . No connection token or password is recorded here. Current local physical name stays unchanged until the separately approved in-place rename to flywithsafety_local_integration. No phase3/phase4/phase5 database creation is planned.

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

## Phase2 accepted; next local rename gate

Phase2 FORMALLY ACCEPTED14/14 on2026-11-02. See PHASE_2_ACCEPTANCE_REPORT.md and output/phase2/phase2-formal-acceptance-20261102.json. Existing39 commercial invariants,real customer/staff/admin browser evidence,creation/race/retry and164 PASS per loader were reused without historical live reruns. Corrected exact33-row cleanup COMMIT and final catalog/access/clean-state checks passed(exit0). Five originally unattributed users plus sixth unlisted user and one session remain preserved. Phase1 G7 remains accepted.

Owner-requested next LOCAL physical rename:flywithsafe_phase2_booking_integration → flywithsafety_local_integration. Preparation review:output/database/local-rename-preparation-20261102-01/REVIEW.md. Destination availability,active connections and private recoverable backup require the prepared owner-console read-only/backup step;no rename performed. Eight pins,read-onlySQL/PS5.1 offline parsing checked. Actual rename requires a later separate explicit approval after prerequisites verified. Main/staging databases,normal env/Google OAuth and historical evidence remain unchanged. No new database per phase. Phase3 sandbox work remains pending verified owner-required rename.


## Controlled local physical rename — prepared, not executed

Read-only/private-backup preparation accepted:old local databaseOID34701,ownerpostgres,seven migrations passed,destination name free/zero other connections at observed preparation;protected63,951-byte logical archive verified by fullread/checksum,not restore rehearsal. Actual rename package:output/database/local-rename-20261102-01/REVIEW.md. Separate explicit approval required for oldphysicalname→flywithsafety_local_integration;live guards recheckcurrentstate and preserveOID/counts/IDs/catalog/rolepermissions. No source/env/runtime change yet. Five local test/helper identity files have a reviewed literal-only patch and archived before copies;applyonlyafteractualrename/roleverificationPASS. Do not replace historical evidence names. Mainflywithsafety/stagingflywithsafety_integration and normalenv/OAuth untouched.


Latest2026-11-02:actual rename v01 stopped BEFORE mutation at maintenance reconnect(authentication rejected for postgres). Saved adminExit3/noCOMMITmarker;owner directcatalogquery confirms oldname/OID34701,newnameabsent. All early prompts werepostgres;prior second-password instruction was incorrect. Minimal v02 explicit-role/prompt-only recovery prepared at output/database/local-rename-20261102-02;separate new approval pending. No original rerun/queryrepeat/referencepatch;Phase2 remains14/14 accepted,Phase3 gated.


Latest v02 renameattempt2026-11-02:adminExit2,initialpostgresauthenticationfailedbeforeSQL;no rename or sourcepatch. Subsequent owner native login to maintenancepostgres exit0;failed target wasdifferent existing local integrationDB. Exact causeofprivateinput/pathdifferenceunproven,nopasswordreset/configdefectassumed. One standalone readonly source-target authentication+catalogcheck remains;no v03package or historical rerun. Phase2 stays14/14 accepted,Phase3 waitsverifiedrename.


Latest source-authentication2026-11-02:owner standalone native login to EXACT oldlocaldatabase exit0;OID34701oldname,newnameabsent,READONLYROLLBACK. No proven parameter/transport/configuration defect versusv02;privateinputcauseunknown. Fresh v03 guarded recovery prepared with unchanged SQL/backup/preservation scope,48pins/newone-timeapproval pending. Original failures preserved;no new DBquery/test rerun/sourcepatch. Phase2 remains14/14accepted,Phase3 waitsverifiedrename.


## ACTUAL current local physical name — 2026-11-02

flywithsafety_local_integration,originalOID34701. v03renameCOMMIT/adminpostcheckPASS;oldnameflywithsafe_phase2_booking_integrationisnowHISTORICALONLYandabsentperexecutedpinnedcatalogguard. Restrictedrole stillflywithsafe_phase2_booking_test;nativeauthenticationrejectedbeforeSQL,reasonnotestablished. Fullrenameacceptancependingoneexisting-SQLreadonlyrolefollowupandreviewedlocalreferencepatch. No source/envpatchyet,normalmain3000/5000andbothcloudconfigurationsuntouchedbyworkflow. Earlierpending/notrenamedsectionsabovearechronologicalhistorysupersededbythisactualresult;neverreplayoldrenamecaller.


## FINAL verified local target and Prisma mapping — 2026-11-02

LOCAL DATABASE RENAME FORMALLY VERIFIED;actual restricted follow-up exit0 plus reviewed reference patch and actual54PASS/loader,strictTS/Prismaconfig/normal3000+5000health checks passed. Permanent physicalnameflywithsafety_local_integration,OID34701,existingroleflywithsafe_phase2_booking_test. See LOCAL_DATABASE_RENAME_ACCEPTANCE.md. Historical old names remain immutable evidence;earlierpending sectionsabovearesuperseded.

Only explicitly selected local integration PROCESSES use private URLs withhost127.0.0.1,port5432,newdatabasepath,andexistingrestrictedrole. Map DATABASE_URL(runtime),DIRECT_URL(PrismaCLI),PHASE2_BOOKING_DATABASE_URL(guardedtests) to that local target. Normalserver/.env mainCloud and separate stagingconfig stay untouched;no existingenvfilehadoldlocaltarget. Defaultprisma.config.tsandexplicitprisma7.config.tsalreadyuseDIRECT_URL,andbothvalidateofflinewithnewtargetsyntheticURLs. Do NOT set global/defaultmainURLs tolocal or run unreviewedmigrations. No actual private URLs recorded here. Phase3code-onlysandboxplanready;provideraccount/HTTPScallback/live sandboxapprovalremain distinct.
