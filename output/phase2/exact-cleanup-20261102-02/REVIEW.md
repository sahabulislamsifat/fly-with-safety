# Corrected outbox cleanup tooling: read-only approval pending

Only target: 127.0.0.1:5432/flywithsafe_phase2_booking_integration; private existing postgres authentication. No cloud connection or application change.

Confirmed defect: old cleanup.review.sql line105 and reconcile.readonly.sql line150 refer to nonexistent NotificationOutbox.template and .params columns. Saved actual local catalog (local-database-inventory-output.txt) lists14 columns including nonnull payload:jsonb, and neither template nor params. Prisma schema and outbox.service.ts store {template,params} in payload; notification.service.ts supplies params.referenceNumber for BOOKING_CONFIRMATION/BOOKING_STATUS. The retained snapshot contains notification IDs only, so no claim of freshly observed payload values is made.

Historical v02 reconciliation saved exit3, readOnlyFinished=false. Its query results show all33 exact rows present: User4,Session14,Booking2,BookingPassenger2,BookingStatusHistory5,IdempotencyRecord2,NotificationOutbox4; unlisted User6 and Session1; five original unattributed user metadata flags true, each with0 bookings/sessions. Full guard failed before success; this is NOT completed reconciliation or cleanup acceptance. No destructive caller ran here. First authentication failure and second SQL failure files remain unchanged, with all17 original file hashes recorded in review-source.json.

Candidate correction in BOTH SQL files:

```sql
coalesce(payload->>'template','') NOT IN('BOOKING_CONFIRMATION','BOOKING_STATUS')
NOT(coalesce(payload->'params'->>'referenceNumber','')=ANY(booking_refs))
```

coalesce denies absent/null template instead of permitting SQL UNKNOWN. Before the original guards, catalog metadata must exactly match all14 saved real columns/types/nullability. Read-only output contains catalog names/types and four exact notification IDs with only payload/object/string/template-allowlist/reference-ownership boolean flags, never payload contents. A separate JSON-type guard rejects malformed objects/fields. All existing scope,linkage,extra-child,count,transaction,rollback,preservation guards survive unchanged. Offline reverse patch reproduces originals exactly after removing the added validation SQL. Destructive DELETE statements are byte-identical to the original seven exact-ID statements; original files are NOT modified.

Only ONE NEW READ-ONLY execution is proposed: RECONCILE-READONLY-ONCE.txt in THIS new folder. It uses unchanged original cleanup caller/pin hashes for integrity only and never invokes that caller. Corrected read-only SQL hash8CF7DD95F5DAC4C8F215DA0CD5896DB4139DFAA85215C487A607D8B276A38D2A. Command hashD6D21B78F13E8FD1B5054C9C847868B4CDB42209F00A0EC84381F65E54E51BB6. Distinct folder ensures new attempt/output/result without altering historical evidence. Explicit owner approval required before manual execution; failure STOP, no automatic retry.

Offline:277 checks PASS;37 statements/15 PLpgSQL blocks parser PASS across both SQL files; original invalid columns rejected by AST-to-saved-actual-catalog checks, corrected references accepted; exact delta, seven unchanged DELETE statements, read-only allowlists PASS;19 original pins and225 regression source pins match; nativePS5.1 parse PASS. No live database execution. Existing164-PASS-per-loader evidence reused, not rerun. Offline verifier initially had a JavaScript parenthesis syntax error, corrected before the successful run; no SQL or database execution occurred in that failed verifier invocation.

cleanup.review.sql here is a corrected CANDIDATE ONLY. NO corrected destructive caller prepared or execution authorized. After successful read-only result, review real state, then obtain SEPARATE explicit approval for any corrected destructive caller/hash. Original v01 destructive caller is unsafe due confirmed invalid columns and must not run. Canonical12/14; IDs13–14 BLOCKED. Rename/Phase3 remain gated.


## Case A accepted; corrected destructive caller awaiting separate approval

Actual corrected read-only result finished2026-11-02T13:37:54.0352930Z(exit0): all33PresentAndPreconditionsPass=true,all33Absent=false,readOnlyFinished=true,cleanupExecutedByThisReview=false. Output confirms all33 exact IDs,full original preconditions,14 live outbox catalog columns,and4 rows with all6 JSON shape/allowlist/reference flags true;five original unattributed metadata comparisons true;unlisted User6/Session1. Read-only transaction ended ROLLBACK. Output file is nativePS5.1 UTF16LE; first offline extraction mistakenly decoded UTF8 and stopped at MISSING_MARKERS before writing files; corrected offline decoding recovered actual markers. No live test was repeated.

Prepared corrected Invoke-ExactCleanup.ps1 in THIS folder. Explicit switch OwnerApprovedCorrectedExactCleanup,26 pins include corrected cleanup SQL plus accepted read-only source/attempt/output/result and original SQL/caller/manifest. Original folder17 files unchanged. Both old/new cleanup attempt filenames must be absent;hashes,pins,accepted Case A and completed browser finalization checked before new durable cleanup marker. Live SQL rechecks exact target/admin/seven migrations/access,column/JSON shape,all ownership/count/extra-child/preservation guards before deletion. SQL correction changes only two JSON paths with null denial plus catalog/shape validation;all7 DELETE statements identical. No DELETE executed.

Caller SHA256 EABE530F57D1384337F7FB38FE53BEB7954A4EC5FE753DCC1054170E380CBF85. SQL SHA256 0DF77B208206905D198410D931DC9E6C95A26E7F7C3539E545C7210C77F0A2EB. Manifest SHA256 4D3E0971806D221FB9A78F4523D4FDBE263CA11B2AD3ABE2E67A319A3E76B001. Foreground command in FOREGROUND-AFTER-CORRECTED-APPROVAL.txt;do NOT run until fresh explicit corrected destructive approval. Prior approval for defective original caller is not reused.

Expected deletions remain User4,Session14,Booking2,BookingPassenger2,BookingStatusHistory5,IdempotencyRecord2,NotificationOutbox4=33. All unlisted records(including five originals plus sixth user and unlisted session) excluded;transaction metadata fingerprints and per-table deltas enforce preservation. Per-delete counts raise native notices;internal count assertions and final commit marker fail closed on mismatch. One transaction COMMIT followed by separate read-only postcheck:postcommit failure must preserve state,no retry/repair. Existing local postgres password privately;no Windows Administrator required. No GRANT/DDL/migration/cloud operations.

Offline cleanup-offline-result.json:276 checks PASS,19 SQL statements/9 PLpgSQL blocks,7 unchanged exact deletes,26 pins,225 source pins;nativePS5.1 parsing2 files PASS. Existing164 PASS/loader reused,not rerun. Canonical12/14 remains pending actual deletion and final evidence acceptance. Rename and Phase3 gated.
