# Local rename recovery: explicit administrator reconnect prompts

Phase2 remains FORMALLY ACCEPTED14/14. Required future local name:flywithsafety_local_integration. No new database,role,privilege,migration,cleanup or cloud operation.

## Actual failure and state

Historical local-rename-20261102-01 started2026-11-02T14:39:39.9869693Z,finished14:39:58.3863483Z. Saved result adminExit3,renameCommitted=false,adminPostcheckPassed=false,restrictedExit=null,referencePatchApplied=false. Saved stdout proves initial old-database admin authentication,target/seven migrations/privilege/source-OID/zero-other-connections guards and snapshot completed;transaction ended ROLLBACK. It contains no rename COMMIT marker. Owner supplies native stderr:line56 connect-to-postgres authentication rejected for userpostgres. Rename DO startsline61,ALTER at67,COMMIT70:they were NOT reached.

Owner ALREADY performed the requested standalone read-only catalog query against maintenancepostgres on127.0.0.1:5432 aspostgres. Actual supplied rows show only OID34701 namedflywithsafe_phase2_booking_integration;newnameabsent. Reused this evidence,not rerun. Catalog query was supplied by owner;no agent-native exit/marker is invented. Recovery-review.json explicitly labels this provenance.

Conclusion:rename has NOT occurred. No inverse rename or post-rename-only query is appropriate now. Original attempt consumed and retained with six artifact hashes. Both cloud databases,accepted33-row cleanup,remaining local records and active local references are unchanged by the failed operation;no source patch applied.

## Confirmed prompt discrepancy

Initial native psql process runs-U postgres. Its line56 reconnect omits user,therefore still authenticates aspostgres. The later reconnect to the renamed database is ALSO postgres. Only AFTER that psql process and admin postchecks succeed does the PowerShell caller start a SEPARATE-U flywithsafe_phase2_booking_test process. The previous assistant instruction incorrectly described the second password asrestricted-role. This was a real instruction/UI defect. The rejected private value was not captured;we do not assert which password the owner actually typed or blame encoding/Prisma/configuration. Subsequent direct postgres login succeeded;no password reset or role change is justified.

## Minimal prepared correction

SQL exact delta ONLY:

1. Before maintenance reconnect,print ADMIN RECONNECT:enter SAME existing postgres administrator password;NOT restricted-role password. Use explicit connect postgres postgres127.0.0.1 5432.
2. Before post-rename admin reconnect,print ADMIN POSTCHECK RECONNECT with same rule. Use explicit connect flywithsafety_local_integration postgres127.0.0.1 5432.

PowerShell initial banner states EVERY password prompt in that native process,including BOTH reconnects,ispostgres. Restricted password is requested ONLY after the separately labelled RESTRICTED ROLE PHASE banner. Native-W entry retained;no SecureString/helper/URL/env password forwarding,no credential capture.

All SQL statements,sourceOID34701,destinationabsence,activeconnectionchecks,one exact ALTER DATABASE,transaction/commit/postcheck ordering,metadata+tablecounts+ID comparisons,role/ACL/seven migrations checks remain byte-identical after reversing the reconnect-only patch. Snapshot and restricted verify SQL byte-identical. Caller adds pinned historical failure-stage check before dispatch and fresh42-pin manifest/new attempt filenames in THIS new directory. Original caller/SQL/attempt/stdout/result unchanged. No historical rerun.

## ONE proposed recovery execution — separate approval pending

Same reviewed scope as original:verify protected/readable private backup and allpins;live read-only old-source/OID34701/migration/access/connection/destination checks;maintenancepostgres transaction with ONE in-place rename;admin read-only originalOID/oldabsence/metadata/data-ID/count preservation;separate restricted-role native read-only authentication. No backend termination or application shutdown. Main localhost3000/5000 environments remain untouched.

All first-process prompts,even the second/third prompts,require existingpostgres password. ONLY the explicit RESTRICTED ROLE PHASE banner requests existingflywithsafe_phase2_booking_test password. Passwords remain private,never chat/log/argument/env. FailureSTOP;no retry,reset,repair,reverse rename or restore. Commit and postchecks are separate stages;preserve actual committed state on a later failure.

Caller SHA2569EDA61F9E74D8E05DC428272A002A5686466AD9B54B2D97E89452E330BC32456. ManifestEC8B833F371FEE8745417DDED2E60B5849A4BE37FD72AE57DD3AB523B2B50AD9.42 pins. Actual command:FOREGROUND-AFTER-RECOVERY-APPROVAL.txt;DO NOT run without fresh explicit recovery approval. No recovery attempt exists.

Offline279 checks PASS;36 SQL statements/11PLpgSQL blocks and two nativePS5.1 files parse PASS;exact-delta and original artifact/pin checks PASS;225 source pins unchanged. Existing candidate56PASS/loader/strictTS results reused,not rerun;historical164-PASS Phase2 regression not repeated. No new database query or mutation performed by preparation. Actual privileged recovery remains UNEXECUTED.

After actual successful rename+admin/restricted postchecks,apply ONLY the previously reviewed five-file/six-literal local-reference patch from v01 with fresh before-hash verification;archived original source/evidence preserved. Then targeted offline and normal3000/5000 health checks. No Prisma/env/cloud credential/schema edits. Phase3 sandbox handoff remains gated on verified rename/reference transition.
