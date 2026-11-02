# Phase 2 exact-owned cleanup — awaiting explicit deletion approval

Target only:127.0.0.1:5432/flywithsafe_phase2_booking_integration. PostgreSQL administrator postgres required; Windows Administrator elevation is NOT required. Native psql -W handles the private existing admin password. Main backend5000 continues using its existing cloud connection; this caller does not stop/reconfigure it.

Actual source ledger:completed v02 host exit0; close/snapshot/disconnect successful. Exactly33 observed owned rows:
- User4 (original UUID synthetic actors only)
- Session14 (all exact IDs linked to those actors)
- Booking2 (original COMPLETED BDT12000 and new PENDING BDT38940)
- BookingPassenger2
- BookingStatusHistory5
- IdempotencyRecord2
- NotificationOutbox4

Original booking JSON contains3 quotations/1 manual payment/5 receipts; these are removed with that owned booking, not separate tables. Historical evidence files and accepted results remain preserved. All unlisted users, including the five initial unattributed rows and any later non-ledger account/session, are EXCLUDED. Clean means the exact approved owned graph is absent, not an empty database. No new fixture generation.

One BEGIN/COMMIT transaction:exact target/admin/seven migration checksums + unchanged original restricted-role positive/negative privilege matrix; bounded table/parent-row locks; exact IDs/counts/relationships, actor emails/roles/password-format, passenger synthetic names/no documents, original/new booking status/amount/currency/full synthetic JSON, session ownership; no extra linked children; no active PROCESSING outbox; no unknown trigger/inheritance/FK (including cross-schema) before any DELETE. Deletes only seven id=ANY(fixed ledger array) statements, count-checked individually. Unknown metadata/IDs, every public-table count delta, public schema/index/constraint/enum, DB ACL, role attributes/memberships preserved inside transaction. Passwords, refresh hashes and tokens are never printed or preservation-hashed. Original role matrix rechecked before COMMIT. Any mismatch rolls back/STOP; no retry or repair.

Then a separate read-only target/access/owned-absence postcheck rolls back and reports retained unlisted aggregate counts. If a postcommit step fails, preserve the committed marker/state; sequence is not fully atomic across this final read-only verification. No SQL migrations, DDL, grant, role/password changes, reset, broad deletion or provider operation.

Offline verification:PostgreSQL18 WASM parser15 statements/7 PLpgSQL blocks PASS;7 bounded DELETE statements;33 exact IDs match actual snapshot; mutation allowlist PASS. NativePS5.1 caller parsing PASS,19 pins, no attempt. No live cleanup or PostgreSQL dry-run was executed. Final offline regression164 PASS/0 FAIL/0 SKIP per loader, all225 source pins unchanged; strict/server/client TS, scoped lint, Prisma validation and diff checks passed. Live cleanup/postchecks and unchanged-source verification remain before formal14/14 acceptance.

SQL SHA256:DBB52D74330DBEBEB0F870D929B1FAFD349FE53EB5EF611E173F47C4AF5E92CD
Caller SHA256:44663BFA874B07837CC60D9BCC9CE4A4762A6355A724E2BC8B11E7580872DD32
Manifest SHA256:25460883F5488E657A9F90E4B9AB6347B2AA344CF1D6AB4AE909CE810049F042

Requires one separate explicit owner approval for these33 deletions. No execution until approval. Output markers:PHASE2_EXACT_OWNED_CLEANUP_COMMITTED_33_ROWS,PHASE2_CLEANUP_CATALOG_ACCESS_AND_FINAL_READONLY_PASS,Phase2 exact-owned cleanup exit:0. Preserve any failure output and never rerun.
