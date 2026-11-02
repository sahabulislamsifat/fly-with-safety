# Local database in-place rename: preparation only

Prerequisite satisfied: Phase2 FORMALLY ACCEPTED14/14; actual corrected cleanup COMMIT/final preservation exit0 verified. Phase1 G7 and39 commercial invariants remain accepted. This is a post-Phase2 owner-requested operation, not a new Phase2 acceptance requirement.

Source:127.0.0.1:5432/flywithsafe_phase2_booking_integration. Required destination:flywithsafety_local_integration. Same existing database; do not create another database or copy data into a replacement. Restricted role flywithsafe_phase2_booking_test must remain unchanged. Main cloud flywithsafety and cloud staging flywithsafety_integration are excluded.

## Findings from repository preparation

- Five active local test/identity source files contain the old exact local name; paths/source hashes in reference-inventory.json. No source patches applied. Future approved transition changes only those exact local identity literals and their relevant offline expectations; do not loosen host/port/role checks.
- Normal server/client env files were inspected by variable-key/name matching only. None contains the old local database name. Keep main DATABASE_URL/DIRECT_URL and Google OAuth unchanged. Runtime Prisma uses DATABASE_URL; Prisma CLI uses DIRECT_URL. Only explicitly selected future local process URLs change the database path after the rename, entered/configured privately. Do not activate staging or copy cloud credentials.
- Historical consumed output packages,ledgers,pins,evidence and pre-rename SQL keep their old names forever; no mass search/replace. Historical accepted source pins describe the pre-rename source, and any approved later test-literal transition requires its own targeted offline checks without replaying consumed live suites.
- No .dump/.backup/.sql.gz was found in the inspected workspace/designated artifact roots; the proposed private LOCALAPPDATA/FlyWithSafe/Backups root does not exist. This does not prove the owner has no backup elsewhere. No recoverable archive has yet been verified.
- Current destination-name availability/source OID/active connections are NOT yet live-verified. Do not assume availability from old inventory.

## ONE proposed preparation run, not rename approval

Prepare-LocalRename.ps1 requires explicit OwnerApprovedReadOnlyBackupPreparation. Hash5F4B5D95137370294C5CC2A781A99EA4D640C3BFB92536BFA705233558FA48CD;8 pins. Private existing local postgres password only in two native prompts:psql then pg_dump. No PowerShell credential-construction helper,secret environment assignment,connection URL or password capture. Windows Administrator is not required.

1. Verify Phase2 acceptance,eight pins,PS5.1/RemoteSigned,no prior preparation artifacts and no PostgreSQL override. Create durable preparation attempt before any native connection. Stop/no automatic retry on failure.
2. Native psql READ ONLY checks exact local source/admin,seven source migration names/checksums,unchanged restricted-role column matrix,source owner/OID,absent destination and no OTHER source connections. It never stops any process or terminates a connection. Active connection means STOP; report it before any separately authorized action.
3. Only after preflight PASS, create a NEW private backup directory under LOCALAPPDATA/FlyWithSafe/Backups/local-rename-20261102-01;never overwrite an existing directory/archive. Disable inherited access and allow only current Windows user and SYSTEM. Backup may contain existing local account data/stored hashes;keep it private,outside repository and do not upload or paste contents.
4. pg_dump custom full database archive preserves data,ownership and database-object ACL definitions. No globals/role-password export;existing cluster roles remain untouched. pg_restore --list validates TOC privately;pg_restore --file NUL reads/decompresses the full archive without a database connection or restoring anything. Record exits,file size/archive checksum/path. This proves archive readability,not an actual restore rehearsal;no throwaway database is created. Preserve partial archive on failure,no automatic deletion or repair.
5. Save sanitized metadata/preflight output/result. No database name is changed. No migrations,grants,role changes,application writes or cloud connections.

Offline validation:12 read-only statements/3 PLpgSQL blocks parsed;read-only AST/token allowlists PASS;8 pins match;native Windows PowerShell5.1 parsing2 files PASS. This workflow has NOT executed;backup has NOT been created.

## Later actual rename: separate owner approval required

After actual preparation results and archive checks are accepted, prepare a narrowly pinned maintenance-database caller against postgres on127.0.0.1:5432. Recheck exact source OID/owner/ACL and seven migrations,backup integrity,destination absence,no active source connections and expected source-file hashes. Then,with separate explicit owner approval,perform ONLY:

```sql
ALTER DATABASE flywithsafe_phase2_booking_integration
  RENAME TO flywithsafety_local_integration;
```

The actual rename caller is NOT prepared or approved for execution by this preparation document. Do not run this SQL manually yet. No connection termination,ALLOW_CONNECTIONS change or privilege change is part of the proposed rename. PostgreSQL refusal on a concurrent connection must STOP;no retry.

Verify same database OID,owner/ACL,seventh migration history,all existing records/catalog and restricted-role connectivity under the new name. Apply only approved active local reference patch;normal cloud env remains unchanged. Verify relevant offline guard/config tests and a bounded reusable-test readiness query,not historical destructive suites. Retain all historical evidence unchanged.

Rollback proposal:if a post-rename check fails,STOP and preserve actual state. A separately approved inverse rename from the maintenance database may restore the old name only if new-name OID matches the captured source,old name is absent and no target connections exist. Do not restore/drop/create/reset automatically. The private archive is recovery material;no restore or data replacement is implicitly approved.

Phase3 SSLCommerz sandbox implementation/handoff remains pending the owner's required verified local rename gate. No live payment activation.
