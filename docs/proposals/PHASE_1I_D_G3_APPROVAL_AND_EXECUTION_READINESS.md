# Phase 1I-D — G3 Approval and Execution Readiness

2026-10-25, Asia/Dhaka. **DOCUMENTATION READY; TARGET EXISTENCE, G3-P AND G3-X BLOCKED/PENDING AUTHORIZATION.** AUTH-02 is implemented and owner-accepted OFFLINE ONLY. All 14 legal decisions remain BLOCKED. No DB connection or test implementation/execution occurred in this session.

## 1. Evidence and scope

Reviewed [G3-D plan](PHASE_1I_D_G3_AUTH_02_DATABASE_VERIFICATION_PLAN.md), [G1 approval](PHASE_1I_D_G1_AUTH_02_DESIGN_AND_APPROVAL.md), adopted G0 roadmap/master plan and accepted D-1/D-2/D-3B records. Their results remain scoped historical evidence; no tests were rerun. This is an execution-readiness addendum, not approval of the G3-D output or a database verification report.

Current development HEAD 7f8e569; preexisting untracked G3-D plan preserved. The inspected service still uses static-table SELECT FOR UPDATE followed by a separate fresh UTC conditional UPDATE, exact returned identity/cardinality, atomic effects, ReadCommitted/maxWait=2000/timeout=5000 ms, cost-12 bcrypt outside reset transaction and sanitized errors. Source references: server/src/services/auth.service.ts:152–288. Schema still uses unmapped public token tables with TIMESTAMP(3) without timezone. No live UTC storage/adapter/lock guarantee is inferred.

Verified matrix inventory: LOCK-01–06 (6), TX-01–10 (10), UTC-01–08 (8), COMMIT-01–06 (6): **30 groups**. All remain NOT RUN. Preserve G3-D distinctions: unwrapped real service, real DB with harness injection, SQL-only evidence, blocked/unexecuted. TX-08 genuine owned-connection interruption, COMMIT-04 true wire ambiguity, and UTC-04 exact service-time equality lack an approved demonstrated method. A SQL comparison or post-commit synthetic throw cannot silently close those gaps. A final G3 verdict must remain partial/blocked if mandatory evidence is missing, unless reviewers explicitly approve a narrower evidence requirement; that is not granted here.

## 2. Target reconciliation — owner follow-up incorporated

The owner confirmed these **planning identifiers only**, explicitly not existence or provisioning:

| Field | Confirmed planning value | Actual environment evidence |
|---|---|---|
| Host/port | 127.0.0.1:5432 | No socket/DB identity verification authorized |
| Database | flywithsafe_g3_auth02_disposable | Existence, owner, contents and schema UNVERIFIED |
| Restricted role | flywithsafe_g3_auth02_test | Existence, authentication, effective privileges UNVERIFIED |
| Intended use | Disposable G3 synthetic target, exclusive operation required | Actual absence of real data and other clients UNVERIFIED |

The master's reference to a different/partially masked identifier is superseded for planning by that explicit follow-up. No second actual name was supplied, so no claim that two real databases were compared. Protected flywithsafe_integration and flywithsafe_phase1h_integration remain excluded. No default/remote database substitution.

Read-only configuration inspection parsed URL values locally and returned classifications only, never values or credentials. Inspected existing server/.env and server/.env.example plus known optional root/server local/test files where present; no environment loader ran and no setting changed:

- server/.env DATABASE_URL and DIRECT_URL: **OTHER TARGET OR NONCANONICAL — REDACTED**, neither matched the confirmed host/port/database/role tuple. It does not establish whether either is local or remote; no further endpoint metadata is exposed.
- server/.env INTEGRATION_TEST_DATABASE_URL and G3_AUTH02_DATABASE_URL: not defined.
- server/.env.example DATABASE_URL: nonmatching example; the other three keys not defined.
- Agent process DATABASE_URL, DIRECT_URL, INTEGRATION_TEST_DATABASE_URL, G3_AUTH02_DATABASE_URL: not defined.
- Runtime source server/src/lib/prisma.ts consumes DATABASE_URL; CLI server/prisma.config.ts consumes DIRECT_URL and imports dotenv/config. These were inspected as text only.

Conclusion: **G3 target is not configured in the inspected locations/process.** This does not prove database/role absence on PostgreSQL. Do not repurpose server/.env or execute Prisma CLI with its current fallback. Owner-private authentication must be configured separately for the future approved child process, with exact runtime/direct/test matching and no persistent credentials in reports.

## 3. Manual preparation requirements — conditional, NOT AUTHORIZED

First obtain a sanitized private operator inventory confirming whether the exact DB and role exist. A maintenance-catalog connection as an admin to database postgres would be a different connection scope; it is not covered by the target-only G3-P draft and needs explicit separate authorization if the agent is to perform it. The owner can separately authorize a private operator catalog inventory; do not try random role/default-database connections to discover the answer.

If both already exist: do not recreate or alter them. Obtain owner-confirmed disposability, schema/history, ownership and role-safety evidence, then seek G3-P. Any existing data or incompatible privilege is a review issue, not permission to clean/fix.

If either is absent, request a separate operator bootstrap approval specifying all these operations:

1. Exact local server identity and creation preconditions; refuse to overwrite an existing object. New database owned by an approved admin/schema owner, not the restricted test role. No change to historical databases.
2. Create only flywithsafe_g3_auth02_test with LOGIN, NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS, no elevated memberships, connection limit 20; set authentication privately using psql password prompt or approved secret management. No password in SQL supplied to this chat.
3. Create only flywithsafe_g3_auth02_disposable from template0 if absent, with approved owner. Review locale/encoding/extensions against Prisma requirements. Do not use reset/drop or change shared template databases.
4. Initialize only that new DB with exactly the seven existing migrations listed in G3-D §3. Pin SQL hashes/line-ending rules, target guards and private matching DATABASE_URL/DIRECT_URL before separately approved migrate deploy. Existing phase1h-b2-local-prisma.ps1 is pinned to a different DB: **do not use or modify it as a shortcut**. A new/adapted guarded migration command requires its own exact file/operation review; none is created here.
5. On the new target only, effective privileges must permit schema USAGE and auth fixture DML, read-only history/catalog/outbox counts; deny CREATE/TEMP/TRUNCATE/DDL/history writes. Grant SELECT/INSERT/UPDATE/DELETE only User, EmailVerificationToken, PasswordResetToken, Session; SELECT only _prisma_migrations/NotificationOutbox. No owner/superuser/migration rights for test role. Explicit IDs avoid sequences.
6. Review inherited PUBLIC and membership privileges. Shared cluster PUBLIC CONNECT may allow the role into historical DBs despite narrow grants. Do not revoke historical ACLs. If necessary, separately approve operator-managed authentication restrictions limited to this role, or choose an isolated cluster with revised endpoint approval. pg_hba edits/reload are infrastructure changes, not an implicit DB grant.
7. Verify empty auth/outbox fixture tables and operator-confirmed exclusive synthetic environment, exact migration history and catalogs. Preserve sanitized inventory and bootstrap results; if migration fails, stop without retry/resolve/recovery writes.

These are exact required resources/privileges/schema steps, not a runnable or approved provisioning script. Actual object absence has not been established; do not provision speculatively. Role/database creation, grants/authentication configuration, migration execution and any recovery each require explicit approval. No need to purchase a service or obtain cloud credentials for this local candidate.

## 4. G3-P — copy-ready request after existence/readiness confirmation

> I confirm that 127.0.0.1:5432/flywithsafe_g3_auth02_disposable exists, is exclusively designated disposable and contains no real customer data; restricted role flywithsafe_g3_auth02_test is privately configured. I authorize G3-P READ-ONLY preflight on this target and role only, following the reviewed G3-D catalog/identity procedure. Inspect identity and database owner, role/effective privileges, auth/schema objects/indexes/FKs/defaults/timestamp precision/triggers/RLS, exact seven-migration names/checksums/completion, session/resource settings, scoped activity and non-sensitive aggregate counts. Enforce 2-second connection and 5-second read-statement bounds, a read-only transaction, private authentication and consistent intended runtime/direct/test targets. Stop on any mismatch, denial, unexpected data or missing prerequisite. No fixtures, record writes, DDL, migrations, database/role creation, cleanup, server changes, tests or historical/remote connections. This approval grants no G3-X permission.

**NOT SUBMITTED AS AN EXISTENCE CLAIM:** the owner confirmed identifiers, not the confirmation at the start of this text. Obtain the inventory/preparation evidence before issuing an unconditional target-ready approval. If the role cannot authenticate or DB is missing, stop; do not fall back to postgres. An optional private operator admin-catalog inventory is separately scoped, not hidden inside G3-P.

The existing G3-D read-only procedure must be tightened during authorized preflight preparation: initial identity gate should require non-null TRUE and distinct nonzero failure status, not rely on psql quit's success code. Check database owner explicitly (pg_database/pg_roles metadata) and compare against named admin/schema owner; do not infer owner from current_user. No G3-P execution or original plan edit was performed here.

## 5. Harness implementation approval — separate from G3-P and G3-X

> Authorize code-only creation of server/test/auth-consumption.pg.test.ts and server/test/auth-consumption.pg.vitest.config.ts, under the reviewed G3-D design and this addendum. Use existing dependencies; isolated real-service composition with synthetic env/notification boundaries, strict target and destination guards, read-only catalog gate, independent bounded pools, exact run ledger, barriers and evidence classifications. Permit offline syntax/config/import analysis and standalone strict no-emit TypeScript checks only. Do not connect to a DB or run a runner that imports/initializes a live client. Preserve accepted auth.service.ts, offline tests, shared Phase 1H harness, Prisma/migrations, packages and env. Stop for revised scope if another file/helper/production correction is needed.

Feasibility is static, not loader/runtime proof. Reuse reviewed patterns, not old target-specific runner execution. A self-contained two-file harness remains the proposed minimum. Initial suite must use real Prisma/pg/SQL for primary tests; module injection replaces unsafe singleton construction only. Selected delegating fault wrappers are labeled as injections, never fake DB guarantees. Do not create another synthetic crypto prototype.

## 6. G3-X execution — copy-ready conditional request, later only

> After G3-P passes and the exact two-file harness is reviewed, authorize G3-X against 127.0.0.1:5432/flywithsafe_g3_auth02_disposable as flywithsafe_g3_auth02_test only. Permit synthetic INSERT/UPDATE/DELETE on User, EmailVerificationToken, PasswordResetToken and Session; exact-fixture row locks; read-only history/catalog/outbox checks; approved session-only timezone/timeout settings; and exact-ledger cleanup. Execute the 30-group G3-D matrix with stated blocked cases and evidence classifications, 2/8/16 concurrency at three repetitions per purpose where approved capacity permits, no more than 19 total connections and the reviewed 2s admission/5s service-transaction bounds. Include only reviewed pre-commit exception/post-commit acknowledgment-loss simulations; genuine connection interruption, true wire ambiguity or new helpers require separate approval. Require zero duplicate committed consume, atomic effects, fresh post-lock expiry and no unrelated data changes. Run the two loaders sequentially, second only after first success and verified cleanup. Stop on safety/invariant/cleanup failure; do not retry, reset, repair history or delete unknown records. Permit a sanitized report at docs/proposals/PHASE_1I_D_G3_AUTH_02_VERIFICATION_REPORT.md. No other DB/table, migration, real mail/provider/KMS, deployment or phase transition. Formal G3 acceptance remains separate; required blocked evidence prevents an unconditional PASS.

Private environment for later review: RUN_AUTH02_POSTGRES=true, APPROVED_DISPOSABLE_DATABASE=flywithsafe_g3_auth02_disposable, G3_AUTH02_MODE=execute, NODE_ENV=test, EMAIL_DELIVERY_ENABLED=false, OUTBOX_WORKER_ENABLED=false; DATABASE_URL=DIRECT_URL=INTEGRATION_TEST_DATABASE_URL (private exact URL). Optional G3_AUTH02_DATABASE_URL must match, never become a remote fallback. Remove PGSERVICE/PGSERVICEFILE; reject conflicting ambient PG routing/session overrides. No actual environment variable was set in this session.

Future commands from server, NOT RUN and paths NOT CREATED:

```powershell
& .\node_modules\.bin\vitest.cmd run --config test/auth-consumption.pg.vitest.config.ts --bail=1
& .\node_modules\.bin\vitest.cmd run --config test/auth-consumption.pg.vitest.config.ts --configLoader native --bail=1
```

Two service pools max8 each plus up to three fixture/blocker/observer connections; normal server lock_timeout3500ms/statement_timeout4500ms, existing Prisma tx timeout5000ms, idle-in-tx6000ms. The TX-07 special profile permits server lock/statement timeout above5000ms only to measure the unchanged Prisma transaction deadline; exact bounded values must be reviewed before X, not chosen at runtime to force success. Source/DDL hooks and server termination remain excluded. Exact fixture IDs are generated and ledgered per run before writes; never claimed known in advance or printed with credentials. Cleanup awaits setup and in-flight tasks, checks ownership/counts/foreign references and deletes children then exact user IDs. Unknown records stop execution.

## 7. Evidence required to close G3 and next decisions

Real DB identity/version, approved role/settings, matching URLs, seven checksums and catalog fingerprint; discovered case count; per-loader pass/fail/skip/blocked counts; independent connection/client evidence; lock and timeout timings; committed/rolled-back state from fresh observers; UTC precision/timezone outcomes; explicit injected-versus-real classifications; safe output scan; exact cleanup/postcheck; source preservation. Existing 90-case offline results remain historical until safely rerun in the later package. Do not represent the old 16 Phase 1H tests as new AUTH-02 coverage.

Next manual dependency is target/role existence and provisioning evidence, not more production code. In parallel, owner can approve the two-file implementation scope; that does not require a database connection. G3-P still requires a separate explicit grant. G3-X follows both preflight and implementation review. [Legal evidence](PHASE_1I_D_LEGAL_EVIDENCE_REVIEW.md) and [Phase 1 exit plan](PHASE_1_INTERIM_STATUS_AND_EXIT_CHECKLIST.md) remain separate blockers for actual activation/G7, not a claim that local synthetic testing is production processing.

Documentation verification: PASS for all 30 original G3 group IDs retained in the unchanged G3-D plan, separate preflight/coding/execution requests, consistent confirmed planning identifiers and absence of both proposed implementation files. No live preflight/test result is claimed.
