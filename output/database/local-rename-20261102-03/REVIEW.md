# Source authentication confirmed: fresh one-time rename approval pending

Phase2 remains FORMALLY ACCEPTED14/14. This is NOT a password/configuration fix claim. No new database,role,grant,migration,backup export or authentication framework.

## New actual evidence and comparison

Owner's standalone native source connection succeeded:postgres@127.0.0.1:5432/flywithsafe_phase2_booking_integration;sourceOID34701,old name present,new name absent,READ ONLY transaction ROLLBACK,exit0. Reused this actual evidence without repeating the query. Provenance explicitly recorded in recovery-review.json;no synthetic execution marker was fabricated.

v02 failure was first connection authentication rejection(adminExit2) BEFORE any SQL;renameCommitted=false,restrictedExitnull. Its original attempt/result/caller/SQL/manifest hashes are preserved and pinned. v01 failure and all original Phase1/Phase2 files also remain untouched.

Successful direct and failed v02 initial connections use the SAME absolute psql.exe,-X,-W,host127.0.0.1,port5432,userpostgres,and source database name. Differences are post-authentication SQL mode(-c read-only statement versus-f reviewed script) and stdout capture with Tee-Object. Caller checks unwanted PG overrides before admission,does not construct a URL,does not convert SecureString or assign/forward a password. Native-W reads privately. v01 had already demonstrated that the same pipeline could authenticate initially. No deterministic helper/encoding/configuration defect is established. Private input values were never recorded,hashed or compared;do not assert owner input error. Exact underlying reason for v02 rejection remains undetermined.

Material new context:independent authentication to the EXACT failed source now passed and confirmed OID/name. Owner requested a separately approved controlled recovery. This is not an automatic replay or reuse of consumed v01/v02 approval.

## Minimal prepared recovery

- Three SQL files are BYTE-IDENTICAL to reviewed v02,including explicit postgres user/host/port and role banners before both admin reconnects. No SQL,guards,budgets,pool or mutation scope changed.
- New directory provides fresh attempt/admin-stdout/restricted-stdout/result files. Existing48 pins bind original evidence,unchanged source/candidate evidence,and current reviewed SQL.
- Caller changes only manifest binding,attempt identity,and an additional admission check that v02 actually ended first-auth failure without commit/restricted dispatch. All backup/OID/identity/active-connection/ACL/migration/metadata/count/ID preservation checks survive unchanged.
- Existing63,951-byte protected custom archive checksum/size still match. Previous TOC/full-read/decompression evidence reused;no new dump/restore or restore rehearsal. Runtime archive checksum/ACL/read-lock guards retained.

## ONE proposed authorized scope

Private existing admin native authentication,source read-only guards,maintenancepostgres single guarded in-place rename OID34701 from flywithsafe_phase2_booking_integration to flywithsafety_local_integration,admin read-only originalOID/oldabsence/records+metadata/migrations/access preservation,then separate restricted-role native read-only authentication and privilege checks. No session termination or application shutdown;active connection meansSTOP. No cloud connection or data/role/schema mutation beyond the single local database-name change.

EVERY password prompt in the FIRST native psql process—including maintenance and post-rename reconnects—is the existingpostgres administrator password. ONLY after the explicit RESTRICTED ROLE PHASE banner should the owner enter existingflywithsafe_phase2_booking_test password. No private input in chat/log/URL/argument/environment. FailureSTOP;no retry/reset/repair/reverse/restore. COMMIT and subsequent checks are separate stages;preserve any committed state on later failure.

Only after actual rename and both postchecks PASS,agent applies original reviewed five-file/six-literal local-reference patch with fresh source-before hashes;original source archives and historical pins preserved. No runtime/Prisma schema/config/.env/GoogleOAuth/cloud change. Targeted offline/local3000/5000 health checks only;no historical destructive/browser/commercial replay. Phase3 handoff remains gated until all actual rename/reference postconditions pass.

## Verification and command

48 pins match;225 accepted source pins unchanged;all three SQL files byte-identical to v02;unchanged36-statement/11-PL-block parser evidence reused. Unchanged candidate56PASS/0FAIL/0SKIP per loader and strictTS evidence reused,not rerun. NativePS5.1 parsing2 new files PASS;original review patch still applies cleanly;backup checksum/size PASS. No new rename attempt exists and no database query was performed by preparation.

Caller SHA256 EDB88D0D859FBBE6F72D96182E1F5CB1C27753A7BA948E357C4193FD9EA54570. Manifest909357427E7F14D689EBEB101EB14864D90FD95D282DA30801BAC76755378E9F. Foreground command:FOREGROUND-AFTER-RECOVERY-APPROVAL.txt. Requires fresh explicit owner approval before ONE manual private-console execution. Do NOT rerun v01/v02. Expected final markers and recovery/rollback boundaries remain those of the original guarded review;no automatic rollback or archive restore is included.
