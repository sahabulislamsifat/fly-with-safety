# ONE in-place LOCAL database rename — awaiting separate owner approval

Phase2 is FORMALLY ACCEPTED14/14;Phase1 G7 and39 commercial invariants stay accepted. This package is only the separately requested post-Phase2 local rename. It has NOT executed. No Phase3 implementation.

## Verified preparation and backup

Saved preparation result:passed=true,preflight/dump/archive-list/full-archive-read exits0,renameExecuted=false,restoreRehearsalExecuted=false;finished2026-11-02T14:09:42.7440562Z. Saved source database OID34701,PostgreSQL18.6,127.0.0.1:5432,owner postgres,restricted role flywithsafe_phase2_booking_test,seven source migration names/checksums passed,users6/sessions1/bookings0. Source other connections0 and destination absent AT THAT PREPARATION;live guards recheck both,not assume unchanged.

Existing private custom archive:63,951 bytes;current archive checksum equals saved E4F1A6129710141BE78A9A4EF8BD0CC8FE565C55AF32979454EF49961A99BFDE. Directory inheritance disabled;file/directory allow only current Windows owner and SYSTEM. No archive contents printed. Prior pg_restore list/full decompression-to-NUL passed;no restore rehearsal is claimed. Agreed protected/readable logical-backup criteria satisfied;no new backup or new database needed. Caller rechecks ACL/size/checksum and holds a read-sharing-only handle through execution to prevent archive replacement/writing.

## Exact operation and high-stakes review

This is a high-stakes privileged metadata transition:the name can be reversed,but a partial connection/configuration transition can interrupt isolated tests. Main development3000/5000 is not interrupted. No automatic application shutdown,session termination or reverse rename.

1. Verify33 dependency pins,private archive,formal acceptance,no existing rename attempt,existing visiblePS5.1/RemoteSigned. Require explicit OwnerApprovedInPlaceLocalRename;use native psql private prompts,never PowerShell password conversion/URL/environment forwarding.
2. Connect as existing postgres to old LOCAL name;READ ONLY verify exact source OID34701,owner,address,port,seven migrations,role/column privilege matrix,destination absence,no other source connections. Print only safe PID/user/state/backend-type metadata if a connection exists and STOP. Snapshot every public table's count+ID-set fingerprint and schema/index/constraint/enum/function identity/role/ACL/migration metadata. No password,token,notification payload or actual data-row fields selected or hashed. Client psql variables retain only this non-secret metadata across connections;custom local session setting carries snapshot within each READ ONLY transaction and is rolled back.
3. Disconnect old database via native psql connect to maintenance database postgres. In one BEGIN/COMMIT transaction recheck local superuser identity,source OID/owner,destination absence and zero source connections;perform ONLY:

```sql
ALTER DATABASE flywithsafe_phase2_booking_integration
  RENAME TO flywithsafety_local_integration;
```

   Check same OID/new name/old-name absence before commit. No CREATE/DROP database,DML,migration,owner/role/GRANT/ALLOW_CONNECTIONS change or backend termination. PostgreSQL requires connection to a different database for rename:[official PostgreSQL18 documentation](https://www.postgresql.org/docs/18/sql-alterdatabase.html).
4. Connect as postgres to new name;READ ONLY recheck original OID,old-name absence,seven migration checksums and exact restricted-role matrix. Recompute count/ID/catalog/access/migration metadata;compare before versus after with only the source database NAME normalized in pg_database metadata. Any mismatch fails closed. Same physical OID and the single catalog-name mutation preserve existing data;we do not fingerprint secret row contents or claim bytewise third-party activity audit.
5. Native prompt clearly asks for existing flywithsafe_phase2_booking_test password(NOT postgres). Authenticate that role directly to new LOCAL name;READ ONLY identity/session-user/OID/seven migrations/positive-negative privilege checks and counts. No fixture writes. Preserve separate admin/restricted stdout,attempt/result and actual exit statuses.
6. Only AFTER actual rename and both postchecks PASS,agent applies reviewed five-file/six-literal local identity patch with original hashes rechecked. Preserve unrelated edits;source drift means STOP and report. Run only relevant post-transition offline/health checks. Do not repeat historical destructive/commercial/browser suites.

### Adversarial failure review and revised guards

- Stale prestate/destination collision/source connection:live checks plus PostgreSQL rename locking/refusal;STOP without killing anything. No promise based only on old0-connection observation.
- Backup/source tampering:manifest,archived checksum,size,protected ACL and read lock;five active source-file before hashes pinned. Failure before dispatch does not proceed.
- Commit succeeds then admin/restricted verification or result saving fails:preserve actual committed state and markers;no automatic retry/repair/inverse rename. Do not interpret missing final PASS as rollback. Record commit marker separately from postchecks.
- Lost/unknown native acknowledgement:one-attempt guard remains;only later read-only evidence recovery allowed under appropriate authorization.
- Source update conflicts:archive exact five original source bytes,verify prepared literal-only patch with git apply --check,and recheck current hashes before applying AFTER live PASS. Historical accepted files/pins/packages remain unchanged;archived bytes preserve historical pre-rename source integrity.

## Local configuration transition

Exact active files are in source-transition.review.json;five test/helper files,six old-name literals only. No runtime production source,Prisma schema/config/migration,client UI/routes,Google OAuth or normal server/client env changes. Actual source remains old-name-compatible until verified rename. Runtime local DATABASE_URL and CLI DIRECT_URL must use new database path only in explicitly selected local PROCESS;owner credentials remain private. No env file contains old local target,so no credential-bearing env rewrite is necessary. Normal main cloud flywithsafety and cloud staging flywithsafety_integration are not connected or changed. All consumed Phase1/Phase2 output launchers/ledgers retain historical old names and must never be replayed or mass-replaced.

Candidate new-target checks:56 PASS/0 FAIL/0 SKIP per bundle/native loader,including acceptance of exact new local target and rejection of old name. Strict TypeScript7 candidate files PASS;two PG harness files transpile/syntax PASS. Active source files unchanged. Review patch applies cleanly. Initial offline attempts had Windows python alias unavailable,then candidate config path/CJS Vitest import errors;fixed using installed git and correct ESM/module paths. Those logs remain;no database connection or business test occurred. Existing164-PASS Phase2 evidence is not rerun or relabeled.

## Recovery and authorization boundary

Caller hash8A77A31735AAE9EBFF14AFB49B5F1C00B2A7837FC19DC4730F56A2DF1BE10A97;manifest hashAB122A39C4A2193037F5C817AD5703FBD4E8287F2FB8510814FDC144CD7CE55F;33 pins. Actual foreground command is FOREGROUND-AFTER-RENAME-APPROVAL.txt;DO NOT RUN before separate owner approval. Existing postgres password may be requested by native reconnections;then the separately labelled restricted-role password. No credential in command arguments,tracked file or logs. Windows Administrator not required.

Expected actual markers:LOCAL_DATABASE_RENAME_COMMITTED_OID_34701;LOCAL_DATABASE_RENAME_ADMIN_PRESERVATION_PASS;LOCAL_DATABASE_RENAME_RESTRICTED_ROLE_READONLY_PASS;LOCAL_DATABASE_RENAME_AND_RESTRICTED_POSTCHECK_PASS;final admin/restricted exits0 and passedTrue. Actual execution/postconditions remain UNVERIFIED until saved results exist. Metadata rename COMMIT and read-only/restricted/source-reference checks are separate stages;the whole workflow is not atomic.

If a postcommit failure requires rollback,first inspect actual OID/name/active connections and source/reference state read-only. A separately approved inverse rename from maintenance database may be considered only if OID34701 matches new name,old name absent and no target connections. No automatic reverse rename or archive restore. Private backup remains recovery material;no database creation/reset/data replacement approved.

Phase3 SSLCommerz sandbox handoff only after actual successful rename,restricted-role proof,local reference application and normal3000/5000 health verification. Live payment activation remains unauthorized.


## Final preparation verification

final-offline-review.json:270 checks PASS;36 statements/11 PLpgSQL blocks parsed across3 SQL files;exactly1 rename mutation;33 pins match;225 accepted Phase2 source pins unchanged;5 original source archives match. NativePS5.1 parser2 files PASS,git apply --check PASS. Candidate bundle/native56 PASS/0 FAIL/0 SKIP each;strictTS PASS. One static checker initially misclassified the string literal TRUNCATE in has_table_privilege metadata checks as a mutation;corrected checker distinguishes quoted privilege labels from statements and separately parses the exact authorized ALTER DATABASE. No SQL/role guard weakened. No live database connection,rename,reference patch,application shutdown or cloud operation by preparation.
