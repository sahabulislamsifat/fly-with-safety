# G3-X minimum role access — exact approval package

2026-10-28, Asia/Dhaka. PREPARED ONLY: no database connections, grants, LOGIN changes or fixtures. Scope is access preparation after the approved seven-migration initialization PASS. Canonical tracker remains the single progress tracker.

## 1. Exact access and source justification

Target: 127.0.0.1:5432/flywithsafe_g3_auth02_disposable, PostgreSQL18.6, owner postgres. Existing role flywithsafe_g3_auth02_test, currently NOLOGIN. Existing status reader must remain unchanged. No new role/password or membership is required.

| Table | SELECT | INSERT | UPDATE | DELETE | Actual justification |
|---|---|---|---|---|---|
| User | table | table | table | table | Synthetic parent creation; ownership/observer/lock queries; verification/password/name mutations; concurrent parent deletion and exact cleanup |
| EmailVerificationToken | table | table | table | table | Synthetic/legacy fixtures; lookup/FOR UPDATE; conditional usedAt/expiry/concurrent consumption; exact cleanup |
| PasswordResetToken | table | table | table | table | Reset fixtures; lookup/FOR UPDATE; conditional consume/expiry; exact cleanup |
| Session | table | table | table | table | Session fixture insertion; observation/locking; revocation via actual reset service; exact cleanup |
| NotificationOutbox | id column only | no | no | no | NOT EXISTS(SELECT 1...) empty-outbox assertion; no recipient/subject/payload/error access |
| _prisma_migrations | migration_name, checksum, finished_at, rolled_back_at only | no | no | no | Exact seven-row checksum/completion verification; no logs access |
| Other application tables | no | no | no | no | No test-path justification |

Source: server/test/auth-consumption.pg.test.ts validateTarget, counts, catalogPreflight, fixture creation/observation, LOCK/TX/UTC/COMMIT scenarios and cleanup; server/src/services/auth.service.ts lockCredential/consumeCredential/verifyEmail/resetPassword. In particular catalogPreflight explicitly requires table-level INSERT/UPDATE/DELETE on all four auth tables; Prisma selections/returning shapes and observation use their columns. This is the smallest table-operation set compatible with that existing test contract. Redesigning assertions for finer column-specific DML is not authorized here. SELECT FOR UPDATE needs appropriate UPDATE access; no separate lock role is needed.

No TRUNCATE, REFERENCES, TRIGGER, MAINTAIN, sequence rights, ownership, CREATE/TEMP, grant options, default privileges, broad read/admin roles or memberships. Existing CONNECT/public USAGE and database-specific statement_timeout=5s are preserved; no extra persisted settings. The test suite applies approved session profiles itself only during separately authorized execution. Domain IDs are text supplied by fixtures/Prisma; no sequence grant is justified.

Column SELECT permits constant/existence queries while restricting actual columns. PostgreSQL privilege functions can check column grants without reading records. No live assertion of that compatibility has been executed in this task; G3-P verifies it before G3-X.

## 2. Reviewed SQL files — never run without separate approval

- g3-x-access.activate.review.sql: one transaction, initial NOLOGIN/no-table-access guard, exactly three GRANT statements and one ALTER ROLE LOGIN, positive/negative postcondition guard, COMMIT. No schema/record changes.
- g3-x-access.postcheck.readonly.sql: administrator post-commit verification in BEGIN READ ONLY/ROLLBACK.
- g3-p-access.readonly.sql: later, actual restricted-test-role identity/permission/history/empty-auth-outbox checks and auth catalog output in BEGIN READ ONLY/ROLLBACK; no grants, fixtures or service imports.

Both admin guards require exact identity/version/owner/UTF8, no concurrent target sessions, 20 public tables, exact seven approved completed checksums and no rollback records, all19 application tables empty, existing role flags/limit20/settings and reader isolation, no memberships/ownership, public ACLs, unsafe triggers/rules/RLS/security-definer/extensions, unexpected sequence/default/parameter privileges or grant options. Existing private SCRAM verifier is checked by administrator only as a boolean; never displayed. No password reset if absent.

The postcondition iterates every public table and every column. It requires exactly four table-level CRUD sets; denies all other table privileges; permits only outbox id/history four-column SELECT outside those tables; rejects extra column INSERT/UPDATE/REFERENCES and grant options. Reader remains without application/history table/column read or mutation rights. These are fail-closed proposed assertions, not already-executed privilege proof. No trial writes or rollback fixtures are used for negative testing.

The activation transaction checks all expectations BEFORE COMMIT. A SQL error with psql ON_ERROR_STOP terminates the attempt; disconnected failed transaction rolls back its grants/LOGIN, subject to verifying actual commit outcome. Admin postcheck is separate and read-only after commit. Never assume loss of client output means rollback. No entire-project/schema operation is included.

## 3. Future private execution procedure

Use an accessible Windows PowerShell5.1 console, explicitly importing installed Microsoft.PowerShell.Utility before hash commands; no transcript. Verify these SQL hashes, original migration hashes and current actor/target before connection. Use process-local PG environment cleanup and native psql -X -W -v ON_ERROR_STOP=1 with explicit host127.0.0.1 port5432 dbnameflywithsafe_g3_auth02_disposable userpostgres connect_timeout2. Enter existing administrator password privately. Never use repository .env, service files or remote fallback.

Execute the activation file ONCE only after permission approval. Do not set read-only PGOPTIONS on the activation connection because approved GRANT/ALTER ROLE requires a write-capable transaction. The file bounds statements/locks to5s. Then execute admin postcheck with read-only PGOPTIONS and5s bounds, providing the existing administrator password again if required. A later launch wrapper may encapsulate only this exact procedure, source pins and single-attempt sanitized evidence; no automatic G3-P/X follow-on. Preserve prior migration/reader attempt artifacts. No current launcher or live command is executed by this preparation package.

Review exact stage exits and G3_X_ACCESS_ACTIVATION_COMMITTED/G3_X_ACCESS_ADMIN_POSTCHECK_PASS. Save sanitized counts/flags and hashes, not tokens/passwords/history logs. Pre/post role/ACL assertions verify expected current state; they cannot exclude concurrent malicious administrators. Keep other sessions/writers stopped.

## 4. Single bounded permission-change approval ticket

> Authorize ONE guarded access-activation attempt using the pinned g3-x-access.activate.review.sql and administrator read-only postcheck on PostgreSQL18.6 at127.0.0.1:5432/flywithsafe_g3_auth02_disposable as postgres. Preserve both existing roles' restrictions, ownership, connection limits, memberships, reader access and persisted timeouts. Grant only SELECT/INSERT/UPDATE/DELETE on User, EmailVerificationToken, PasswordResetToken and Session; SELECT(id) on NotificationOutbox; SELECT(migration_name,checksum,finished_at,rolled_back_at) on _prisma_migrations to flywithsafe_g3_auth02_test; enable that existing test role LOGIN. Existing passwords remain private and unchanged. Stop on first guard/error with no retry, repair, reset or broader grants. Exclude fixtures, cleanup, G3-P/test-role connections, G3-X, migrations, provider calls and deployment.

This permission change itself enables database mutation authority on the four synthetic auth tables, even though no fixture execution is approved yet. Approval must acknowledge that capability. It does not authorize processing real users. The disposable target must remain synthetic-only and isolated from application traffic.

## 5. Failure and preservation

- Precheck mismatch: no permission change. Do not issue broad REVOKE to fit the expected matrix or change existing roles/passwords.
- Failure before COMMIT: stop; inspect transaction/connection/result evidence read-only. Do not retry or delete resources automatically.
- Lost connection/output around COMMIT: outcome UNKNOWN; separate bounded read-only verification before any new mutation.
- Admin postcheck failure after commit: grants/LOGIN may already be committed. Stop and report exact state. Disabling LOGIN, revoking rights or terminating sessions needs distinct recovery approval; no automatic compensation.
- Role already LOGIN, unexpected grants/memberships/nonempty data, history mismatch or competing sessions: stop, never treat it as idempotent success.
- Preserve status-reader role/password and no-table privileges; do not grant it migration-history access. Preserve original migrations and schema. The former initialization role postcheck expects NOLOGIN/no table access and will deliberately fail after this authorized change: do not rerun it as a generic validator.
- Roles/PUBLIC permissions are cluster-wide; fixed connection guards constrain this tooling, not every possible use of credentials. This package does not change other databases/HBA or claim universal no-access on all hosts/databases. Built-in catalog visibility and trusted functions remain PostgreSQL's normal surface.

## 6. Separate G3-P and G3-X execution gates

After permission activation/postchecks PASS, request ONE actual test-role authentication and read-only G3-P attempt using g3-p-access.readonly.sql, exact target, private existing test-role password and read-only startup options. PostgreSQL catalog/history/ACL functions must work under the restricted identity. Exact migration-history checks, per-column negative checks, auth/outbox emptiness and G3_P_RESTRICTED_ACCESS_PASS/exit0 are required. Review emitted auth timestamp/nullability/default/index/FK definitions against accepted initialization evidence before full G3-P acceptance. No trial writes or fixture cleanup. Do not use the status reader or SET ROLE inside postgres as a substitute.

IMPORTANT: existing auth-consumption.pg.test.ts has no preflight-only execution mode: validateTarget requires execute/write/cleanup/isolation approvals, and beforeAll proceeds to fixtures. DO NOT run that suite for G3-P. Prepared SQL is independently read-only and includes no application import.

After actual G3-P PASS and separate G3-X approval, run the existing AUTH-02 suite under its exact four matching local URL variables, all explicit execution/disposable/write/cleanup/authentication-isolation/profile approvals, NODE_ENV=test, disabled email/worker, no ambient PG/DEBUG/NODE options, and existing network/service guards. Cover LOCK01–06, TX01–10, UTC01–08, COMMIT01–06 (30 logical groups); report actual case counts and evidence classifications. Fixture creation and exact-record cleanup need explicit G3-X permission; permission grants alone do not authorize them. Preserve no-blind-retry/failure settlement/recovery boundaries, import isolation and no real SMTP/provider calls. Do not claim mock or SQL-only scenarios prove real-service concurrency.

## 7. Offline verification evidence and technical references

57 in-memory static/positive-negative matrix checks PASS, zero failed; all seven migration raw hashes still match reviewed wrapper pins. SQL not parsed/executed by PostgreSQL; no live permission/catalog or compatibility claim. Exact file hashes recorded in canonical Evidence Log. Application source/test/harness and historical artifacts are preserved. git diff --check result is recorded after final documentation edits.

Official PostgreSQL18 GRANT reference: https://www.postgresql.org/docs/18/sql-grant.html (column/table grants, PUBLIC effective privileges and grant options). Final privilege validation remains G3-P, not a source-only certification. Phase1 engineering incomplete; G7 and Phase2 not authorized.

## 8. Authorized attempt01 failed before GRANT — bounded correction proposal

Actual administrator psql exit3; first DO failed at activation file line100, inline-code line79: record "a" has no field "attacl". Record variable a was populated by FOR a IN SELECT attname. The subsequent pg_attribute alias a in aclexplode(a.attacl) resolves to that PL/pgSQL record rather than the intended catalog row. This prepared-SQL defect is not a rejected access policy. All three SQL files contain the same single alias collision. The57 prior offline static checks did not execute PostgreSQL name resolution and did not catch it.

Failure occurred before first GRANT at line102, LOGIN at line107 and COMMIT at line193. ON_ERROR_STOP terminated psql; no authorized grant/login statement was reached. The open transaction aborts/disconnects; no independent follow-up catalog connection was made after the failure. Do not claim live preservation postcheck PASS. Admin postcheck/G3-P/X were not executed. Failed launcher/results and SQL bytes/hashes remain unchanged; no automatic repair/retry.

Exact proposed change in each of the three SQL files (NOT IMPLEMENTED):

```diff
- OR EXISTS(SELECT 1 FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x WHERE x.grantee IN(r,reader) AND x.is_grantable)
+ OR EXISTS(SELECT 1 FROM pg_attribute acl_attribute CROSS JOIN LATERAL aclexplode(acl_attribute.attacl) x WHERE x.grantee IN(r,reader) AND x.is_grantable)
```

Only rename the catalog alias and its reference; preserve record variable, grant-option predicate, every privilege/identity/history/isolation/emptiness condition and all three GRANTs/LOGIN transaction. Prospective in-memory replacement/reversal was exact for each file, one occurrence each. No actual SQL edits yet.

Bounded replacement approval request:

> Authorize only the alias correction above in g3-x-access.activate.review.sql, g3-x-access.postcheck.readonly.sql and g3-p-access.readonly.sql, plus offline exact-delta/hash/static verification and evidence updates. Preserve failed attempt01 and create one fresh private caller with reviewed updated SQL pins. If every offline check passes, authorize ONE guarded replacement activation/admin-postcheck attempt on the same exact local target using existing administrator credentials privately. Initial NOLOGIN/no-table-rights guards must re-establish current state before GRANT. Stop on any failure; no further repair/retry or privilege expansion. Exclude G3-P/test-role connections, G3-X, fixture/cleanup, migrations and deployment.

Updated SQL hashes must be explicitly recorded as authorized alias-only revisions, never silently replaced to force a PASS. PostgreSQL live guard execution remains necessary; static checks alone cannot establish name-resolution/ACL correctness. No database cleanup or role reset is justified by this failure.

## 9. Authorized alias-only recovery and access activation PASS

2026-10-28 owner explicitly approved the three catalog-alias substitutions and one guarded replacement. Exact forward/reverse source review confirms only pg_attribute a/aclexplode(a.attacl) became pg_attribute acl_attribute/aclexplode(acl_attribute.attacl), one occurrence per file. All predicates/grants/target checks unchanged; failed attempt01 artifacts preserved. Thirty current offline checks and PowerShell parser passed; git diff --check exit0. Superseding reviewed hashes:

| SQL | SHA-256 |
|---|---|
| g3-x-access.activate.review.sql | f624702ec24ae42b859c960e2c0efc41664e5ccea210c5721c05a5a782966b68 |
| g3-x-access.postcheck.readonly.sql | b364966a85d9c658cbe2fb1d9c2fab08296f0b0ad2d386f5d826f4f78eacea24 |
| g3-p-access.readonly.sql | c32f7eb2bc2bccaef294ab2678e039f7004b95800d11ae639e12aff3820b4025 |

Private replacement caller g3-x-access-activation-20261028-02/Invoke-Access.ps1 SHA256 9c51df296e412e5a0d1d41e6209247cb8c7ac738f65cee6f105930e4e9f660c7; fresh readonly preflight SHA256 501dd92764c00a1a509f47f9d366255f9afd5b197959c4ced1a40df23e4f10c0. That preflight is the corrected original initial guard extracted unchanged, enclosed BEGIN READ ONLY/ROLLBACK, with no GRANT/LOGIN. Native stage results and owner console confirm:

- G3_X_ACCESS_FRESH_READONLY_PREFLIGHT_PASS, ROLLBACK, exit0: expected NOLOGIN/no-table-grants state and exact history/isolation/role boundaries.
- Three GRANTs, ALTER ROLE, postcondition DO, COMMIT, G3_X_ACCESS_ACTIVATION_COMMITTED, exit0.
- G3_X_ACCESS_ADMIN_POSTCHECK_PASS, ROLLBACK, exit0; caller exit0.

The exact approved four-table CRUD plus narrow outbox/history column reads are committed; test-role LOGIN true with all other restrictions/limits/settings unchanged. Status reader remains independent and without table/column access. Admin guards verified all19 app tables empty and no unexpected schema/role rights. This is access PASS, not actual test-role authentication, G3-P or test execution. Do not rerun activation.

### Next smallest approval — actual restricted-role G3-P only

> Authorize ONE guarded G3-P read-only verification using corrected g3-p-access.readonly.sql, SHA256 c32f7eb2bc2bccaef294ab2678e039f7004b95800d11ae639e12aff3820b4025, on127.0.0.1:5432/flywithsafe_g3_auth02_disposable as flywithsafe_g3_auth02_test. Use existing test-role password privately and native psql -X -W/ON_ERROR_STOP with exact target, startup default_transaction_read_only=on and statement/lock/idle-transaction timeouts5s. Include Utility import/hash checks, no-env-fallback and one-attempt sanitized evidence, actual role/preflight/catalog review and exit verification. Stop on failure without retry, repair or privilege expansion. Exclude grants, password changes, fixtures/cleanup, Prisma, G3-X, migrations and deployment.

Use actual test-role authentication, never postgres/SET ROLE or the status reader. Review emitted auth column/index/FK metadata against accepted migration catalog; require G3_P_RESTRICTED_ACCESS_PASS and exit0. Do not invoke the integration suite as a preflight substitute. Existing native startup defaults remain defaults, not universal revocation of DML authority; fixed SQL explicitly uses READ ONLY/ROLLBACK. No G3-P wrapper/live connection was launched during access activation. Only after G3-P PASS may owner approve G3-X fixture/concurrency/cleanup execution separately.

## 10. Actual restricted-role G3-P PASS — 2026-10-28

Explicitly authorized one G3-P attempt executed pinned SQL unchanged at c32f7eb2bc2bccaef294ab2678e039f7004b95800d11ae639e12aff3820b4025. Actual identity current_user=session_user=flywithsafe_g3_auth02_test, exact127.0.0.1:5432/flywithsafe_g3_auth02_disposable, transaction read_only=on. Native psql exit0 and owner console G3_P_RESTRICTED_ACCESS_PASS/ROLLBACK/G3-P finished. Exit code: 0 corroborated by result file.

Successful DO checks exact role restrictions/settings/limit20, all four table CRUD sets and only specified extra column reads, no unrelated table/column/admin/grant-option/sequence access, preserved reader, exact seven completed migration checksums,20 tables, no other target sessions or auth/outbox fixtures. Source emits28 auth columns,14 indexes and29 constraints; reviewed against accepted catalog: text IDs, nullable usedAt/revokedAt, TIMESTAMP(3) without time zone, expected defaults/unique indexes and three validated User FKs with CASCADE update/delete match. Actual read succeeds under narrow outbox/history privileges. No trial write, fixture, schema/role/credential change or integration test. Source has read-only startup options/timeouts in private caller, SET LOCAL statement/lock5s, and final ROLLBACK; privileged DML capability itself is not revoked by session defaults.

## 11. Next bounded G3-X execution ticket — not yet authorized

Prerequisites: preserved actual G3-P PASS, exact current service/test/config/migration source fingerprints, same disposable target/role/grants, no other target sessions, five inspected auth/outbox tables empty, no ambient database/provider overrides. No application writers or real accounts. Stop if current catalog/emptiness/isolation/guard checks differ.

Proposed execution is ONE installed Vitest invocation from server/, with existing test/auth-consumption.pg.vitest.config.ts selecting only test/auth-consumption.pg.test.ts, bundled loader, one worker/file isolation, bail1 and existing timeouts. Fixed command: node node_modules/vitest/vitest.mjs run --config test/auth-consumption.pg.vitest.config.ts --configLoader bundle. No default server suite, second live loader invocation or automatic rerun.

Private caller must set only child-process variables, never repository .env or machine/user settings: NODE_ENV=test, G3_AUTH02_MODE=execute, RUN_AUTH02_POSTGRES=true, G3_AUTH02_PREFLIGHT_APPROVED=true, G3_AUTH02_WRITE_APPROVED=true, G3_AUTH02_CLEANUP_APPROVED=true, G3_AUTH02_AUTHENTICATION_ISOLATION_APPROVED=true, APPROVED_DISPOSABLE_DATABASE=flywithsafe_g3_auth02_disposable, G3_AUTH02_APPROVED_PROFILES=normal,timeout,timezone; EMAIL_DELIVERY_ENABLED=false and OUTBOX_WORKER_ENABLED=false. INTEGRATION_TEST_DATABASE_URL, DATABASE_URL, DIRECT_URL and G3_AUTH02_DATABASE_URL must be the same canonical credential-bearing URL for flywithsafe_g3_auth02_test@127.0.0.1:5432/flywithsafe_g3_auth02_disposable with no options/query/hash. Obtain existing password privately, encode it for transient child environment only, redact raw/encoded password and URLs from saved output, clear temporary values; do not promise managed-memory zeroization. Remove ambient PG*, DEBUG/NODE_DEBUG/NODE_OPTIONS/NODE_PATH and alternate database/Prisma/env-loader overrides in the child. Verify installed tools locally, no downloads/providers/application server.

Approved test scope must cover the actual suite's synthetic inserts/updates/row locks/transactions, UTC/Asia-Dhaka and timeout profiles, concurrent redemption, rollback and commit visibility, bounded repetitions and exact ledger cleanup. Normal scenarios run for verification/reset, with additional legacy cases. Thirty logical matrix groups are not thirty guaranteed executed tests; preserve actual expanded counts and REAL SERVICE / REAL DB + HARNESS INJECTION / SQL PREDICATE ONLY classifications.

Known pre-existing evidence gaps MUST be reported before execution: TX-08 is deliberately skipped because real owned-connection interruption needs a separately approved method; UTC-04-FULL-SERVICE is skipped because exact wall-clock equality needs a new clock hook; COMMIT-04-WIRE is skipped because a modeled post-commit throw is not actual wire acknowledgment loss. Existing SQL/model cases remain useful but do not close those stronger guarantees. This run cannot establish fully unqualified30-group completion or full G3 acceptance merely by passing available tests. Do not remove skips, weaken assertions or kill database backends under this ticket. Later disposition/additional evidence is a separate decision.

Cleanup permission is essential and explicit: only suite-generated run ledger IDs and matching synthetic owner email, related token/session IDs, with foreign-child checks/count assertions and its existing transaction. No TRUNCATE, arbitrary DELETE, resets, data backfill or unrelated record removal. On failure stop new scenarios, settle tracked operations/release owned row-lock transactions, then permit only the reviewed teardown ledger cleanup; if cleanup fails, preserve residual state/evidence and request separate recovery approval, never broad cleanup. Existing afterAll waits for setup settlement to avoid late-insert races. External SQL/user operations are not authorized by the suite's grants.

Smallest G3-X execution authorization:

> Authorize ONE guarded execution of the existing AUTH-02 PostgreSQL suite/config and fixed bundled-loader command on127.0.0.1:5432/flywithsafe_g3_auth02_disposable as flywithsafe_g3_auth02_test, using the private existing password and child-only exact environment/guards described above. Include only its synthetic fixture mutations/locks/transactions, normal/timeout/timezone profiles, bounded repetitions and exact-record ledger teardown cleanup after settlement, plus sanitized results and final read-only auth/outbox emptiness checks. Accept that the three documented skipped/stronger-evidence cases remain unverified and are not G3 acceptance. Stop on unexpected preconditions/failure; no rerun, repair, broad cleanup, extra grants, migrations, owned-connection termination, KMS/provider calls or deployment. Prepare report and residual-evidence dispositions; do not automatically start another package.

This is a proposed authorization request. No write opt-ins, fixtures, teardown or test execution were enabled during G3-P or this documentation update. A future private launcher must preserve every existing suite guard, pin source/config and record one-attempt evidence; do not silently add schema or application changes if execution exposes a defect.

## 12. One authorized G3-X execution failed; cleanup verified

2026-10-28 owner explicitly authorized one suite execution and reviewed ledger teardown. Actual Vitest5.0.3 bundled run:81 registered,44 passed,1 failed,3 skipped. The remaining33 registered tests lack executed results after fail-fast; do not relabel them PASS or merge them into the3 deliberate skips. Native suite exit1. Failure is reset / LOCK-03-C8-R1 [REAL SERVICE],2045ms, masked G3_LOCK-03-C8-R1_FAILED_REQUIRES_REVIEW. No automatic retry or repair.

Reviewed suite teardown completed without reported hook error. Independent authorized final read-only check exit0, G3_X_FINAL_READONLY_CLEAN_PASS/ROLLBACK; User, EmailVerificationToken, PasswordResetToken, Session and NotificationOutbox counts all0. No broader cleanup or data reset. Source/config and all preexisting repository file hashes unchanged during execution. Clean state is not concurrency acceptance.

Known gaps: TX-08 skipped/unverified (actual owned-connection interruption); UTC-04-FULL-SERVICE skipped/unverified (exact wall-clock equality), and its separate SQL-predicate case is not proved by this aborted run; COMMIT-04-WIRE skipped/unverified (true wire ambiguity), distinct from modeled after-commit exceptions. No completion claim for all30 logical groups or AUTH-02 production guarantees.

Read-only source diagnosis: LOCK-03 locks the credential, starts N redemption promises across two clients, waits for N actual blocked sessions, releases the blocker, asserts exactly1 success/N-1 invalid and checks persisted state. Reset also performs bcrypt before its transaction. waiting() deadline1500ms, driver connect timeout2000ms and transaction maxWait2000ms are relevant timing hypotheses only;2045ms duration is insufficient evidence to select a cause. scenario() discards the original internal check label and redeem() classifies service errors; current log cannot distinguish barrier, service/internal timeout, outcome or persistence assertion failure. No database defect or duplicate consumption proved by the generic error alone.

Next independently executable bounded CODE-ONLY proposal (not yet approved): modify only server/test/auth-consumption.pg.test.ts to retain finite allowlisted synthetic diagnostic labels, group/purpose/concurrency/repetition, monotonic phase durations and aggregate success/invalid/internal counts for failing contention; add corresponding assertions within its existing offline-check block. Preserve source/config target guards, scenario counts, bail/timeout/repetition values, actual service implementation, every meaningful assertion and ledger cleanup. Never output raw exception message/stack/cause/SQL, tokens, passwords, fixture IDs/emails, secret-bearing config or driver metadata; unknown errors get a fixed category. Do not use a loose regex as the only message-redaction policy. No production or configuration file change.

After separate code approval, use existing offline-check mode with approved isolated config and both loaders plus strict no-emit checks, exact file scope and git diff validation. Source changes to the test require explicitly recorded new caller pin, not silent acceptance of changed bytes. No live database connection or G3-X rerun belongs to that code-only scope. A diagnostic live rerun and its reviewed ledger cleanup would need a later new one-attempt authorization. Independently, remaining OUT-04 sink/monitoring and AUTH-01/03 design scopes can proceed under their own approvals; this failure does not reopen completed provisioning/migrations/G3-P or restart the roadmap.
