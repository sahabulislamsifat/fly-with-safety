# Phase 1I-D — AUTH-02 G3 Database Verification Plan

Prepared 2026-10-25, Asia/Dhaka. **G3-D DESIGN PREPARED — AWAITING OWNER REVIEW.** G3-D planning is explicitly authorized. G3-P connections, test implementation, provisioning and G3-X writes/execution are NOT authorized by this document. All legal decisions L-01–L-14 remain **BLOCKED**; the legal register is unchanged.

## 1. Owner acceptance and authority

**AUTH-02 G2: OWNER-ACCEPTED — OFFLINE SCOPE ONLY.** Recorded from the owner's supplied G3 handoff, reaffirmed by the instruction to record G2 acceptance in this session. Accepted reported evidence: 90 cases under each bundled/native loader; A01–A18; backend/standalone TypeScript; preservation of 651 unrelated files at G2. These are historical results, not tests rerun in G3-D. They establish no PostgreSQL, production, Google, email or infrastructure guarantee.

The [G1 packet](PHASE_1I_D_G1_AUTH_02_DESIGN_AND_APPROVAL.md) records the earlier design gate and retains historical G2-not-authorized statements. This later owner acceptance supersedes those status statements only; it does not rewrite earlier evidence or waive dependencies. G0 remains adopted; Phase 1I-D remains incomplete. Phase 1I-E, Phase 1J, Phase 2 and other change units remain unauthorized.

G3-D outputs this one planning/acceptance record. No verification report is created before an authorized execution. The later report path is docs/proposals/PHASE_1I_D_G3_AUTH_02_VERIFICATION_REPORT.md and requires approval as part of that future package.

## 2. Verified repository findings

Entry: development, HEAD 7f8e569, clean working tree. 654 tracked/nonignored-untracked files before this addition. Sorted JSON [path,SHA256(bytes)] aggregate SHA256: be6e2d4a5b2d822d72d21f288f3166a2ffea6daacca9e47e96a69cbbdf3b2eb7. Accepted auth.service.ts byte SHA256: 0bb7e8e72bd221d55d2fc78f660f9e89328e90f75f39c14ceef6b98841f2639e. Recheck before later work; hashes are evidence, not permission to overwrite newer changes.

| Existing source | Finding and implication |
|---|---|
| server/src/services/auth.service.ts:152–231 | requireCredentialRow rejects zero/multiple/malformed/wrong-bound results; consumeCredential locks exact id/user/credential then updates separately. verifyEmail advisory findMany uses take=2, hash OR legacy raw, unused; ambiguity rejects. |
| auth.service.ts:266–288 | resetPassword snapshots inputs, looks up unused SHA256 tokenHash, hashes password with real bcrypt cost 12 outside tx, then consumes and applies password/session changes. |
| Both consume functions | Interactive ReadCommitted, maxWait=2000 ms, timeout=5000 ms. No automatic retry. Callback errors roll back; only the per-call generic invalid error escapes; operational exceptions become generic 500. |
| consumeCredential | Static public table names, tagged $queryRaw parameters. SELECT FOR UPDATE completes before a materialized clock_timestamp() AT TIME ZONE 'UTC' conditional UPDATE. usedAt IS NULL, strict expiresAt > claimed_at; stored usedAt truncated to milliseconds; id/user returned and checked. |
| server/src/lib/prisma.ts | Imports generated PrismaClient/PrismaPg, constructs singleton from DATABASE_URL, can reuse global.prisma. Do not import this production composition module in G3. |
| server/prisma.config.ts | Imports dotenv/config; migration CLI uses DIRECT_URL. Do not execute/import this config for G3 tests/preflight. Matching URLs must still be checked without invoking Prisma CLI. |
| server/src/config/env.ts | Reads repository .env candidates on import. envDir=false alone cannot prevent it. Replace the module with fixed synthetic config before importing real service. |
| server/test/auth-consumption.test.ts and .vitest.config.ts | Accepted offline harness blocks all networking and mocks DB/crypto. Preserve it; its full network ban and fake transactions cannot establish G3 evidence. Do not run live G3 through that config. |
| Installed package.json files read as text | Prisma CLI/client/adapter-pg 7.10.0, pg 8.23.0, Vitest 5.0.3. PostgreSQL server version and actual adapter runtime remain UNVERIFIED. |
| adapter-pg/dist/index.d.ts | PrismaPg accepts pg.Pool, PoolConfig or string; externally owned pools need explicit disposal ownership. Real separate bounded pools are feasible without production edits. Runtime proof remains required. |

No application, driver, Prisma configuration or test module was executed during this design review. Package manifests, migrations and generated declarations were inspected as text; environment-file contents and credentials were not read.

## 3. Exact schema compatibility requirements

Schema: server/prisma/schema.prisma. These four models have no @@map or @map overrides, so physical public table/column names retain case and require SQL quoting.

| Object | Required catalog properties |
|---|---|
| User | id TEXT primary key; email TEXT unique; nullable password TEXT; emailVerified BOOLEAN NOT NULL default false; role UserRole; createdAt/updatedAt TIMESTAMP(3). Explicit fixture updatedAt when using direct SQL. |
| EmailVerificationToken | id/token/userId TEXT NOT NULL, token unique; expiresAt TIMESTAMP(3) NOT NULL without timezone; usedAt nullable TIMESTAMP(3); createdAt TIMESTAMP(3) default current timestamp. |
| PasswordResetToken | id/tokenHash/userId TEXT NOT NULL, tokenHash unique; same expiry/usedAt/createdAt types. |
| Session | id/userId/refreshTokenHash TEXT NOT NULL; unique refreshTokenHash; expiresAt NOT NULL, revokedAt nullable, createdAt/lastUsedAt NOT NULL, all TIMESTAMP(3). |
| Relationships | All three child userId FKs reference public.User(id), validated, ON DELETE CASCADE / ON UPDATE CASCADE. Check target/schema/ordered columns/actions, not constraint name alone. |
| Indexes | Each primary key; User_email_key; EmailVerificationToken_token_key/token_idx/userId_idx; PasswordResetToken_tokenHash_key/userId_idx; Session_refreshTokenHash_key/userId_idx/expiresAt_idx; User_email_idx. Verify ordinary usable btree, uniqueness/ordered columns and no partial/expression substitution. |
| Other safety objects | NotificationOutbox and _prisma_migrations present; no unexpected triggers, RLS, rules, schema shadowing, security-definer hooks or extensions affecting these tables/functions. Inventory applicable policies and role membership. Unexpected behavior blocks execution. |

The existing schema supports scoped usedAt/expiry atomicity. No revokedAt is present in the token models; durable revocation, account generations, issuer/supersession and token/outbox atomic issuance remain DB-02/AUTH-03 dependencies. Session.revokedAt is not token revocation.

Migration sequence required, exactly one completed/nonrolled-back record per directory and no failed/pending/unknown history:

1. 20260926202822_init
2. 20260927082715_full_schema
3. 20261009000000_auth_sessions_and_password_resets
4. 20261011000000_inquiry_idempotency
5. 20261011120000_notification_outbox
6. 20261022000100_contact_status_new
7. 20261022000200_booking_contact_schema

The init migration creates old User/Post structures; full_schema replaces that early schema. Do not apply an arbitrary subset or treat init alone as compatible. The last migrations commit enum addition before using NEW as a default. G3 does not execute any migration. Existing migration history verifier accepts only file-byte, LF or CRLF-equivalent hashes; pin the seven names/content to the reviewed snapshot before implementation, rather than accepting any newly discovered directory. Obtain live checksums under G3-P. No checksum repair or migration resolve is permitted.

Current raw-byte SHA256 manifest (line-ending variants must be derived from these reviewed contents, never silently updated after a mismatch):

| Migration prefix | SHA256 |
|---|---|
| 20260926202822 | efda6a0cd3d01b2503e4cc1557f8aba2807664db545a742e52eaca60a3b2e1cb |
| 20260927082715 | ae3bcd7668f026858ee7e43cbceb9955c451a1bf648520e6afb7814ce2cc7921 |
| 20261009000000 | e1eb929668d33cbe94f07e7512cb7174084150c50683a2e15f5709509b53e1b4 |
| 20261011000000 | 0316f0857663d04900e1ceae1e305490a9b97e49192f9aad2f74bb2f494c6706 |
| 20261011120000 | 1ecc18d0e4381cdf0489a9919f61b58c3f9f1a3bd102303ccf1fa5f81e14eca2 |
| 20261022000100 | 4c9af2c97dd22a88cb3b7e5fe5422ac1023bcc86fcde999409033ac5180178a7 |
| 20261022000200 | bc10e7343b3c40769c43deee8b3164245319a9f35d7a3b50d4e3ee721895f32b |

Expected initialized inventory is 20 public tables, based on repository migration history and prior owner evidence, NOT a new live finding. Catalog-match all seven migrations plus auth objects; table count alone is inadequate.

## 4. Phase 1H reuse assessment

server/test/run-postgres-integration.mjs performs read-only identity/history/catalog checks before invoking two historical suites; integration-target.mjs pins flywithsafe_phase1h_integration and earlier opt-ins. The generic helper also requires an _integration suffix, incompatible with the proposed G3 name. Do not change or call these guards with a new target.

integration-schema-preflight.sql mainly checks Booking/Contact/Outbox-related requirements, not the complete auth metadata above. reliability.integration.test.ts creates booking/outbox fixtures and uses live OAuth-state persistence; idempotency.integration.test.ts imports the application and registers a user, creating a verification notification. Neither belongs in initial AUTH-02 G3. The historical empty-outbox check is preserved; no historical queue is cleared for G3.

Reuse as reviewed patterns only: explicit matching URLs, catalog-first gate, exclusive empty queue, run-owned exact IDs, retained setup promise, await setup settlement before cleanup, fixed timing labels and bail after failure. setup-timing.ts and migration-history.mjs are read-only reference files, not initially imported dependencies in the G3 suite. Keep new checks self-contained in the two proposed files. No Phase 1H source edits, fixture helper imports, app registration or worker execution.

## 5. Proposed target, identity and privileges

Candidate only: **127.0.0.1:5432/flywithsafe_g3_auth02_disposable**, role **flywithsafe_g3_auth02_test**. Neither existence, ownership, credentials nor disposability is established. Owner must designate this exact target and restricted role before ANY connection. Reject localhost aliases, IPv6, encoded/alternate host forms, sockets, query-string host overrides, proxies and remote targets in initial scope. Reject flywithsafe_integration AND flywithsafe_phase1h_integration explicitly.

Require owner-confirmed exclusive synthetic use, no real data and no other active application/worker. Runtime, DIRECT_URL and integration target must byte-match one privately supplied canonical PostgreSQL URL with that username/host/port/database; decoded components must also match. Reject production NODE_ENV and production identities. Require nonempty private authentication; never print full URLs, passwords, hashes or tokens. Do not read .env, .pgpass files or original target settings in the AI session. Private process authentication supplied by owner may use a narrowly targeted passfile through the driver/libpq supported path only after implementation review; do not assume pg and psql share authentication behavior.

Proposed role: LOGIN only, NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS, no privileged role memberships or schema/table ownership; connection limit 20. CONNECT only to designated DB within the test deployment's effective ACLs; inspect PUBLIC privileges and memberships, not just explicit grants. No CREATE/TEMP/schema creation, DDL, TRUNCATE, server control, pg_signal_backend or migration-history writes. USAGE public; SELECT metadata/history plus the four fixture tables/NotificationOutbox counts; SELECT/INSERT/UPDATE/DELETE only User, EmailVerificationToken, PasswordResetToken, Session. Initial suite needs no Account, Booking, inquiry, idempotency or outbox writes. Restricting arbitrary functions is also an ACL review item; don't grant broad security-definer execution.

Role/database creation, ACL grants and schema initialization are prerequisites requiring separate bootstrap approval and operator execution. G3-P can inspect effective privileges but cannot establish grants. Do not use postgres/superuser merely to bypass failures. If target not ready, stop with a reviewed bootstrap proposal; no automatic creation/migration or reuse of historical targets.

Shared-cluster isolation caveat: PUBLIC may already grant CONNECT/TEMP on historical databases. A narrow explicit role grant does not override those inherited privileges. Do not revoke historical database ACLs to make this plan pass. If effective isolation cannot be established, require an operator-reviewed per-role authentication restriction or separately provisioned isolated cluster; a different port/endpoint requires revised target approval. No pg_hba, role or cluster configuration change is authorized here.

## 6. Connection guards and resource budget

Future harness requires explicit RUN_AUTH02_POSTGRES=true, APPROVED_DISPOSABLE_DATABASE=flywithsafe_g3_auth02_disposable and G3_AUTH02_MODE=execute. Private DATABASE_URL, DIRECT_URL and INTEGRATION_TEST_DATABASE_URL must match. Optional G3_AUTH02_DATABASE_URL, if present, must match too; no fallback from missing test configuration. Missing approvals fail before dynamic pg/Prisma imports or sockets, not a green skipped suite.

Remove PGSERVICE/PGSERVICEFILE from the private child environment, rather than assigning empty strings. Reject ambient PGHOST/PGHOSTADDR/PGPORT/PGDATABASE/PGUSER/PGOPTIONS or driver URL options that disagree or alter routing/session policy. Use explicit PoolConfig for endpoint, credentials, application_name and fixed approved options; don't pass through arbitrary PGOPTIONS. Do not mutate persisted environment files or echo child environment. Preconditions apply in every new client/pool, not just at process start.

Before fixture writes, a short-lived read-only client verifies current_database, current_user/session_user, host(inet_server_addr())='127.0.0.1', inet_server_port=5432, read-only setting, server version, effective privileges, migration checksums and §3 metadata. Identity must be repeated by every pool connection before admission to service/fixture use. Initial service pool initialization needs a verified connection path, not an unawaited asynchronous 'connect' listener. Pin application_name to a nonsecret per-run label; record own backend PIDs privately for barriers/cleanup only.

Network guard installed before driver or service imports: permit TCP only to literal 127.0.0.1 port 5432 after URL checks; reject every other destination and unsupported Socket.connect overload/redirect. Cover net.connect/createConnection/Socket.connect, disable outbound HTTP(S), fetch/WebSocket, DNS (including Resolver/promises), UDP and subprocess creation. No subprocess helper is needed for the initial two-file package. Validate guard probes before database imports. Do not include TLS/network fallback: initial approved loopback transport must be explicit; a different authentication/TLS requirement is a revised scope decision.

Proposed bounded budget, subject to G3-P capacity confirmation:

| Resource | Proposed bound |
|---|---|
| Service pools | Two independent pools, max 8 each; total 16 backend connections |
| Fixture/blocker/observer | At most 3 additional connections; total <=19; role limit 20 |
| Driver connect/admission | connectionTimeoutMillis 2000; reject capacity overload |
| PostgreSQL service sessions | lock_timeout 3500 ms; statement_timeout 4500 ms; idle_in_transaction_session_timeout 6000 ms; application_name fixed; UTC default |
| Existing service transaction | ReadCommitted, maxWait 2000 ms, timeout 5000 ms, unchanged |
| Test/barrier | 1500 ms ordinary lock-observation deadline; special expiry barrier <=3000 ms; test <=15000 ms; hook <=20000 ms; bounded cleanup <=10000 ms after all work settles |
| Runs | Concurrency 2, 8, 16; three repetitions per purpose at each level; no automatic scale-up or retry after failure |

Statement timeout is per statement, not a transaction wall-clock guarantee. Prisma's deadline and server idle timeout have different effects. Measure actual returned error timing and connection release; report overruns, don't relax bounds to pass. A normal batch expects exactly one winner; operational failures are reported separately from invalid-token losers. 16-way load is conditional on the approved capacity and measured smoke/bcrypt timings; otherwise report BLOCKED, not silently reduce the requirement.

## 7. Exact future file scope and real-service composition

Only proposed implementation paths:

1. server/test/auth-consumption.pg.test.ts — guards, target checks, read-only preflight, real clients, exact fixture ledger, barriers, test matrix, cleanup and sanitized diagnostics in one file.
2. server/test/auth-consumption.pg.vitest.config.ts — type-only ViteUserConfig, CommonJS export, root=__dirname, envDir=false, include only auth-consumption.pg.test.ts, no globalSetup/setupFiles, node/threads, one worker, fileParallelism=false, isolate=true, bail=1, no cache/coverage/watch/file reporters.

**No implementation files are created now.** A separate implementation authorization must explicitly name these paths. Two files are feasible by static analysis, not runtime-proven. Stop for revised scope if a helper, worker script or production change becomes necessary. Later execution report adds the documentation path from §1 only with approval.

Static runtime test imports limited to Vitest and approved Node built-ins; install narrow network guards and validate all target inputs before dynamic real pg, generated Prisma client and PrismaPg imports. No import of production lib/prisma.ts, env.ts, prisma.config.ts, app.ts, passport or notification/outbox graphs. Hoisted mocks replace env with synthetic fixed config and notification functions with throw-if-called stubs; dotenv/nodemailer/provider modules are defensive fail-on-evaluation traps. Unlike G2, do NOT mock pg, adapter-pg or database transaction/query behavior in the primary cases. Use real bcrypt for reset and verify persisted hashes with compare; no session issuer or registration call.

Bind production lib/prisma.js module export to an explicitly owned REAL PrismaClient using a real bounded pg pool. This replaces singleton construction only. The unchanged auth.service.ts runs actual SQL and actual interactive transactions. Build two independently imported service instances with vi.resetModules/vi.doMock binding to clients A and B; retain each module instance and prove its client affinity before concurrency. Never let global.prisma select a preexisting client. Verify adapter disposal/externally owned pool lifecycle; close both Prisma and pool exactly once.

Observation/fault wrappers in selected tests may gate/delegate an actual query or actual $transaction callback; they must never supply invented rows, mock eligibility, emulate locks or substitute rollback. Label such tests **REAL DB + HARNESS INJECTION**, distinct from **UNWRAPPED SERVICE** and **SQL PREDICATE ONLY**. Prefer database lock barriers for normal failure cases. Wrapper correctness and loader support are implementation gates; inability to bind safely blocks the suite, not permission to import unsafe composition modules.

Read-only reuse/import allowlist beyond Node/Vitest: generated Prisma client and its installed runtime dependencies, @prisma/adapter-pg, pg, bcryptjs/jsonwebtoken; actual auth.service.ts, pure errors/helpers; optional unchanged controller/response/request-context/validators only with guarded synthetic env. No other local test helpers. Both future config loaders must prove import ordering. Separate processes/restarts need a new approved worker path; two real pools/connections establish initial independent-client evidence only.

## 8. Fixtures, barriers and observability

Use random run UUID plus exact preassigned IDs, example.invalid email addresses, generated synthetic tokens/passwords only. Insert User directly; do not register, send email or create OAuth accounts. Store SHA256 in normal token fields; legacy verification cases deliberately store synthetic plaintext only in this disposable target. Create separate User/token/session fixtures for every test/repetition; never reuse consumed rows by clearing usedAt. Preassign IDs in a private ledger BEFORE each awaited insert so interrupted setup remains attributable. Persist a private owner-controlled ledger/report only at an approved artifact location, not an unapproved helper file or console token dump.

Record fixed case labels, monotonic elapsed times, connection counts, safe SQLSTATE classifications and aggregate results. No raw query parameters, credentials, bcrypt hashes, connection strings, pg_stat_activity query text or driver exception bodies in output. Keep credentials out of assertion diffs; compare booleans/digests internally and emit only safe assertions. Synthetic does not justify logging secret-shaped fields.

Read-only observer confirms actual blocking using pg_blocking_pids/pg_stat_activity wait events scoped to known own PID/application_name/database/role. Same-role visibility must be proved at preflight without pg_read_all_stats grants. Blocking control connection uses explicit BEGIN and SELECT FOR UPDATE on only the known fixture row. Signal barriers from observed backend state; bounded polling is allowed, arbitrary sleeps to guess ordering are not. Release in finally and await all tasks. Prewarm/measure real bcrypt outside the critical lock window; hold no row lock during password hashing.

Fresh observer connections check committed token/user/session state after each case, not merely promises or values returned by the service. For rollback, confirm token remains unused, old password still compares, old active sessions remain active. For success, token used, password compares to winning proposal only, active owned sessions revoked and other-user/already-revoked sessions unchanged. Successful user verification is idempotent in value, so an already-true flag alone cannot count duplicate effects: assert exactly one service success plus persisted single-use state and, when necessary, a test-only delegating call counter (not a DB audit claim).

## 9. Lock and concurrency matrix — all NOT RUN

Run each applicable group for email verification and password reset. Include single-match raw legacy verification and ambiguous hash/raw different-user rejection as compatibility variants.

| ID | Exact method | Required evidence |
|---|---|---|
| LOCK-01 | Fresh fixture; call real service; call again; inspect from new connection | One success, later generic 400; no repeated account/session effects. |
| LOCK-02 | Separate client instances A/B; hold fixture token lock until both contenders are observed waiting, then release within bound | Exactly one successful committed consume; other invalid/expired, no loser effect. |
| LOCK-03 | 2/8/16 contenders split across A/B, three fresh-fixture repetitions each per purpose; controlled token barrier | Exactly one winner per healthy run; all settled within budget; no admission/timeout failures silently counted as expected invalid replays. |
| LOCK-04 | Holder locks without changing row; observe waiter, release; second variant holder commits usedAt after advisory lookup | Waiter rechecks post-lock eligibility; usable unchanged row succeeds; consumed row rejects. |
| LOCK-05 | Hold exact token past service lock_timeout; await actual service rejection then release | Generic 500, unchanged token/user/session state, no retry; pool remains usable. |
| LOCK-06 | Hold user A's token; redeem independent user B through another connection before releasing A | B commits while A remains blocked, proving no unintended global record serialization under this harness. |

There are 30 named core groups across §§9–12, not a promised count of test functions. Repetitions/purposes create more cases. Report discovered counts during implementation and actual pass/fail/skip/blocked counts after execution; no G3 PASS exists now.

## 10. Atomicity matrix — all NOT RUN

| ID | Method and evidence classification | Expected result / limitation |
|---|---|---|
| TX-01 | UNWRAPPED SERVICE verification + fresh observer | usedAt and emailVerified commit together. |
| TX-02 | UNWRAPPED SERVICE reset; owned active/inactive and another-user sessions | Password/token/owned-active revocations commit; no other change. |
| TX-03 | Token holder consumes after service advisory lookup but before releasing its lock | Service conditional update returns zero, account effects absent; holder's separate change is not attributed to service. |
| TX-04 | Hold synthetic User row until service user UPDATE actually blocks after token consume; lock timeout | Genuine SQL failure rolls back staged token consume; no persisted account effect. Verify token lock/block sequence. |
| TX-05 | REAL DB + HARNESS INJECTION: delegate actual $transaction callback fully, then throw a synthetic exception inside callback before returning to Prisma | Actual PostgreSQL rollback of real consumed token/user/session writes; not an unwrapped production failure path. No production hook added. |
| TX-06 | Waiting contender follows another transaction that commits versus rolls back | Predicate never bypassed; rollback may permit later still-valid claimant. |
| TX-07 | Hold a fixture Session row so reset reaches session UPDATE after staging token/password; deadline profile with lock/statement limits above 5000 ms but idle timeout still bounded | Exercise actual Prisma 5000 ms transaction timeout, then fresh-state rollback/pool recovery. Explicit special profile requires approval; no source timeout change. If Prisma cannot be distinguished from server timeout, report inconclusive. |
| TX-08 | Optional owned-connection interruption, only if adapter exposes an identified current test connection safely | BLOCKED initially: no server termination, backend cancellation of unowned sessions or private driver mutation assumed. Propose bounded owned-socket method for separate review after implementation inspection; do not substitute TX-05. |
| TX-09 | Competing synthetic non-key User change, and separate deletion variant, while reset/verification waits | Serially explain committed order, FK/deadlock behavior, rollback and unrelated fields; no claim of solving concurrent login/new-session issuance. |
| TX-10 | Retry after confirmed rollback vs committed consume using fresh service client | Rolled-back still-valid token can succeed once; committed token cannot replay. |

If fixtures/locks cannot produce the intended failure point through the real service, mark BLOCKED with observed state. Do not quietly replace it with an independent hand-written SQL transaction and claim service coverage.

## 11. UTC expiry matrix — all NOT RUN

Store fixture expiry as explicit UTC timestamp without timezone using database clock, not session-local CURRENT_TIMESTAMP implicit casts. Compare raw formatted timestamp/numeric microseconds via SQL as well as Prisma Date decoding. Capture DB-clock bounds around statements; JS Date cannot prove microsecond equality.

| ID | Exact design | Evidence boundary |
|---|---|---|
| UTC-01 | Generous future DB-derived expiry | UNWRAPPED SERVICE accepts. |
| UTC-02 | DB-derived past expiry | UNWRAPPED SERVICE rejects; no effects. |
| UTC-03 | Lock-only holder on unchanged row; observe waiter before expiry, poll DB clock until strictly after stored expiry, release before lock_timeout | UNWRAPPED SERVICE rejects after obtaining lock. If CPU/hash/pool timing prevents the barrier inside budget, report inconclusive, do not weaken it. |
| UTC-04 | Separate real SQL CTE/VALUES check with expiresAt equal to the same captured claimed_at; assert strict > false; retain source predicate inspection | SQL PREDICATE ONLY. Exact wall-clock equality at the production statement cannot be scheduled reliably without a new clock hook; full service exact-equality remains BLOCKED. |
| UTC-05 | Observe real service transaction/token-lock wait starts before expiry and resumes afterward; track own PID/transaction timing, no application timestamp substitute | Reject; establishes actual transaction-start time cannot authorize expired consume. |
| UTC-06 | Separate real service pools with startup session TimeZone UTC versus Asia/Dhaka (fixed approved options); fixture UTC values identical | Same eligibility outcome; usedAt intended UTC and Prisma round-trip verified. No global/role timezone change. |
| UTC-07 | Real SQL expression checks at equality and +/-1 microsecond; actual TIMESTAMP(3) fixture storage/rounding and usedAt truncation checks | Distinguish predicate precision from millisecond column storage and JS decoding. Deterministic microsecond service timing is not claimed. |
| UTC-08 | Test-scoped application Date.now skew only while SQL clock/OS clock remain unchanged; use real timers for barriers | Future/past DB eligibility unchanged. Restore spy before cleanup; never change OS/PostgreSQL global clock. |

The validity boundary is conditional consumption time, not final commit/HTTP response time. A token validly consumed before expiry may commit afterward; expiry is never extended. Database/restore clock rollback resistance and non-UTC manual legacy data remain outside this test package.

## 12. Commit and recovery matrix — all NOT RUN

| ID | Method | Evidence classification |
|---|---|---|
| COMMIT-01 | Successful unchanged service, then fresh observer/client retry | Confirmed persisted success, single-use. |
| COMMIT-02 | Actual lock/dependent-effect failure or TX-05 callback exception | Confirmed actual rollback via fresh DB inspection. |
| COMMIT-03 | TX-05 synthetic pre-commit callback failure | REAL DB + HARNESS INJECTION; controlled application failure before COMMIT, not wire interruption. Genuine connection interruption remains TX-08 gate. |
| COMMIT-04 | First subcase: delegate real Prisma commit then suppress its success/throw synthetic acknowledgment-loss error before service caller receives success; inspect from fresh connection | Real persisted commit + MODELED CLIENT ACK LOSS. Demonstrates retry behavior; does NOT prove true wire-level ambiguous COMMIT. Actual wire-loss timing initially BLOCKED pending separately reviewed bounded method. |
| COMMIT-05 | Fresh client retries after COMMIT-04 persisted commit | Generic invalid error, no second password/account/session mutation. |
| COMMIT-06 | Reconcile fresh committed state with controlled failure/unknown signals | Report confirmed success/confirmed rollback/UNKNOWN. If observer cannot establish state, remain unknown; never infer rollback from a 500. |

Initial two-file package cannot unconditionally close G3 if mandatory true interruption/ambiguity or full service exact-equality evidence remains required. Owner must explicitly accept documented evidence limitations or approve an additional bounded method. No unconditional G3 PASS, exactly-once-response guarantee or production-readiness claim.

## 13. Cleanup and failure recovery

Before writes, verify target identity, schema/history, exclusive run, empty auth fixture tables and empty outbox by aggregate counts under the restricted role. Other application tables should have operator-confirmed zero synthetic target baseline; if role lacks visibility, obtain sanitized owner counts under G3-P instead of granting broad data access. Any unknown/nonempty data blocks initial execution; never clean it to satisfy a precondition.

Setup is a retained bounded promise. Test timeout does not cancel it. On any failure stop scheduling new cases, release all known control locks in finally, settle started promises/transactions and close/destroy only own verified client resources as supported. Cleanup must not race late setup or effects. If setup will not settle within budget, stop, preserve ledger and report cleanup BLOCKED; no blind deletion or database reset.

After settlement, reverify identity and run ownership. In one short transaction select/check exact ledger IDs and userId relations; verify emails/fixture purpose as secondary guards; delete Session, PasswordResetToken, EmailVerificationToken by exact IDs, then User by exact IDs. Check affected-row counts against observed owned rows; a mismatch aborts. Before parent deletion verify there are no unexpected Account/booking/inquiry/idempotency or other child references that cascades/SET NULL could affect; if restricted visibility prevents this, require owner metadata/zero-data assurance or stop. Never rely on cascading User deletion as the cleanup mechanism. Never delete by prefix/domain, broad usedAt/status, unbounded deleteMany, TRUNCATE or reset.

Outbox expected unchanged/empty because issuers/registration never run. Unexpected messages are preserved; stop and obtain read-only forensics and separate exact-record cleanup approval. No worker, redrive, SMTP or queue purge. Do not automatically clean unknown records from earlier runs. Crash recovery requires saved exact ledger and a new owner-approved cleanup plan, not rerunning tests to hide residuals.

After cleanup, verify all exact ledger rows absent, initial aggregate counts restored, no outstanding own sessions/locks, history/catalog fingerprints unchanged, target identity unchanged and source hashes unchanged. If a failed invariant makes cleanup unsafe, preserve fixtures and report their counts/ownership privately. Passing assertions do not override incomplete cleanup.

## 14. Commands and staged execution — proposals, NOT RUN

All commands below are future proposals. No PostgreSQL command, test, compiler or Prisma CLI ran during G3-D.

From server, accepted offline baseline commands (run only in the later approved package):

```powershell
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck --types node,vitest/globals test/auth-consumption.test.ts test/auth-consumption.vitest.config.ts
& .\node_modules\.bin\vitest.cmd run --config test/auth-consumption.vitest.config.ts
& .\node_modules\.bin\vitest.cmd run --config test/auth-consumption.vitest.config.ts --configLoader native
```

G3-P private operator identity-only entry command, after exact target/role approval and provisioning if necessary:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -W -v ON_ERROR_STOP=1 -P pager=off -h 127.0.0.1 -p 5432 -U flywithsafe_g3_auth02_test -d flywithsafe_g3_auth02_disposable
```

In that verified private session: BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; SELECT current_database(), current_user, session_user, host(inet_server_addr()), inet_server_port(), current_setting('transaction_read_only'); then approved catalog SELECTs for §3/§5/§6, aggregate counts and ROLLBACK. Stop on identity mismatch before further inspection. Use psql input/file protocol for quoted identifiers rather than fragile PowerShell -c quoting. This document is not a runnable catalog script; exact complete read-only inspection commands must be reviewed under G3-P before execution. No migration status CLI needed: compare read-only history against pinned repository files.

The following is the proposed private-session read-only inspection text for G3-P review, not an instruction to execute now. It emits catalogs and aggregate counts only. The owner must approve this scope before using it. psql's identity gate exits before later queries if the target differs. Missing tables or denied privileges stop via ON_ERROR_STOP; no repair is attempted. Returned catalogs must be compared to §§3/5/6 and the manifest; successful SQL execution alone is not preflight PASS.

```sql
\set ON_ERROR_STOP on
\pset pager off
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SELECT current_database() = 'flywithsafe_g3_auth02_disposable'
   AND current_user = 'flywithsafe_g3_auth02_test'
   AND session_user = 'flywithsafe_g3_auth02_test'
   AND host(inet_server_addr()) = '127.0.0.1'
   AND inet_server_port() = 5432
   AND current_setting('transaction_read_only') = 'on' AS g3_target_ok \gset
\if :g3_target_ok
\else
  ROLLBACK;
  \quit
\endif
SELECT current_database(), current_user, session_user,
       host(inet_server_addr()), inet_server_port(), version();
SELECT name, setting FROM pg_settings WHERE name IN
 ('TimeZone','search_path','max_connections','statement_timeout','lock_timeout',
  'idle_in_transaction_session_timeout','default_transaction_isolation');
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication,
       rolbypassrls, rolconnlimit FROM pg_roles WHERE rolname=current_user;
SELECT r.rolname AS inherited_or_member_role
 FROM pg_roles r WHERE r.rolname<>current_user
 AND pg_has_role(current_user,r.oid,'MEMBER');
SELECT datname, has_database_privilege(current_user,oid,'CONNECT') AS can_connect,
       has_database_privilege(current_user,oid,'CREATE') AS can_create,
       has_database_privilege(current_user,oid,'TEMP') AS can_temp
 FROM pg_database WHERE datallowconn ORDER BY datname;
SELECT has_schema_privilege(current_user,'public','USAGE') AS schema_usage,
       has_schema_privilege(current_user,'public','CREATE') AS schema_create;
SELECT tablename, tableowner FROM pg_tables WHERE schemaname='public'
 ORDER BY tablename;
SELECT migration_name, checksum, finished_at IS NOT NULL AS completed,
       rolled_back_at IS NOT NULL AS rolled_back
 FROM public."_prisma_migrations" ORDER BY migration_name;
SELECT table_name,column_name,data_type,udt_schema,udt_name,is_nullable,
       column_default,datetime_precision
 FROM information_schema.columns WHERE table_schema='public'
 AND table_name IN ('User','EmailVerificationToken','PasswordResetToken','Session')
 ORDER BY table_name,ordinal_position;
SELECT t.typname,e.enumlabel,e.enumsortorder
 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
 JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public'
 AND t.typname='UserRole' ORDER BY e.enumsortorder;
SELECT c.relname AS table_name,k.conname,k.contype,k.convalidated,
       pg_get_constraintdef(k.oid) AS definition
 FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 AND c.relname IN ('User','EmailVerificationToken','PasswordResetToken','Session')
 ORDER BY c.relname,k.conname;
SELECT c.relname AS referencing_table,k.conname,pg_get_constraintdef(k.oid) AS definition
 FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
 WHERE k.contype='f' AND k.confrelid='public."User"'::regclass
 ORDER BY c.relname,k.conname;
SELECT t.relname AS table_name,i.relname AS index_name,x.indisvalid,x.indisready,
       x.indisunique,x.indisprimary,pg_get_indexdef(x.indexrelid) AS definition
 FROM pg_index x JOIN pg_class t ON t.oid=x.indrelid
 JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_namespace n ON n.oid=t.relnamespace
 WHERE n.nspname='public'
 AND t.relname IN ('User','EmailVerificationToken','PasswordResetToken','Session')
 ORDER BY t.relname,i.relname;
SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,
       has_table_privilege(current_user,c.oid,'SELECT') AS can_select,
       has_table_privilege(current_user,c.oid,'INSERT') AS can_insert,
       has_table_privilege(current_user,c.oid,'UPDATE') AS can_update,
       has_table_privilege(current_user,c.oid,'DELETE') AS can_delete,
       has_table_privilege(current_user,c.oid,'TRUNCATE') AS can_truncate
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname;
SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) AS definition
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname;
SELECT schemaname,tablename,policyname,cmd,qual,with_check FROM pg_policies
 WHERE schemaname='public' ORDER BY tablename,policyname;
SELECT schemaname,tablename,rulename,definition FROM pg_rules
 WHERE schemaname='public' ORDER BY tablename,rulename;
SELECT n.nspname,p.proname,p.prosecdef,
       has_function_privilege(current_user,p.oid,'EXECUTE') AS can_execute
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prosecdef ORDER BY p.proname;
SELECT extname,extversion FROM pg_extension ORDER BY extname;
SELECT count(*) AS public_tables FROM information_schema.tables
 WHERE table_schema='public' AND table_type='BASE TABLE';
SELECT (SELECT count(*) FROM public."User") AS users,
       (SELECT count(*) FROM public."EmailVerificationToken") AS verification_tokens,
       (SELECT count(*) FROM public."PasswordResetToken") AS reset_tokens,
       (SELECT count(*) FROM public."Session") AS sessions,
       (SELECT count(*) FROM public."NotificationOutbox") AS notifications;
SELECT count(*) AS other_own_role_connections FROM pg_stat_activity
 WHERE datname=current_database() AND usename=current_user AND pid<>pg_backend_pid();
ROLLBACK;
```

An operator must also confirm no other roles/application workers are active on this exclusive database, without exporting their query text or customer records. That cannot be inferred from the restricted same-role activity count. Read-only preflight does not prove write privileges function under actual constraints; later smoke tests do. The psql gate's quit exit code is not a machine-readable success signal: the reviewer must require complete identity/catalog output and all comparisons, never treat a missing report as PASS.

Future test implementation requires separate approval before these files exist. Thereafter compile the two future files with the same standalone strict options, and review all guards/imports BEFORE running:

```powershell
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck --types node,vitest/globals test/auth-consumption.pg.test.ts test/auth-consumption.pg.vitest.config.ts
```

Future G3-X execution, only after private matched session targets/opt-ins, passed G3-P, approved exact implementation and fixture/cleanup scope:

```powershell
& .\node_modules\.bin\vitest.cmd run --config test/auth-consumption.pg.vitest.config.ts --bail=1
& .\node_modules\.bin\vitest.cmd run --config test/auth-consumption.pg.vitest.config.ts --configLoader native --bail=1
git diff --check
```

Run sequentially; second loader only after first succeeds AND postcleanup passes. Each loader has a fresh run UUID and complete preflight/cleanup. No JSON/file reporter: Vitest 5 previously created an unapproved .vitest report automatically. Capture sanitized console evidence privately only where separately allowed. Never invoke default test suite, npm test/build/postinstall, historical integration runner, prisma generate/db push/migrate/reset or application server as a shortcut.

## 15. Stop conditions, approvals and readiness

Stop on target/authentication/role mismatch; missing guard/opt-in; pending/conflicting migrations; unexpected data/triggers/policies; unsafe env/provider import; unapproved connection; mandatory invariant failure; timeout overrun; cleanup uncertainty; implementation requiring more files/dependencies/source edits. Report sanitized evidence; no automatic retry, permission escalation, migration repair, credential change or safety relaxation.

**G3-P approval request (next):** Authorize READ-ONLY preflight only for 127.0.0.1:5432/flywithsafe_g3_auth02_disposable as restricted role flywithsafe_g3_auth02_test, contingent on owner confirmation that it exists, is exclusive/disposable and is initialized with the exact seven reviewed migrations. Permit identity/version, effective role privileges, auth/schema/index/FK/default/type/trigger/RLS catalogs, migration checksums, scoped activity/settings and aggregate fixture/outbox counts. Use private authentication and matching runtime/direct/test targets, 2-second connection and 5-second read-query bounds. No DDL, fixture writes, tests, cleanup or historical/remote target connection. If prerequisites fail, stop; any database/role creation, grants or migration bootstrap needs its own explicit approval.

**Separate implementation approval request:** After design review, authorize exactly server/test/auth-consumption.pg.test.ts and server/test/auth-consumption.pg.vitest.config.ts for guarded harness implementation and offline syntax/type/config checks only. Do not authorize database connection by that coding approval. No auth.service.ts or shared harness changes. Resolve initial BLOCKED scenarios and artifact location before G3-X.

**G3-X approval request (later, not granted):** After successful G3-P and reviewed implementation, authorize the two named suite/config paths, exact endpoint/role above, synthetic INSERT/UPDATE/DELETE on the four named auth tables, owned-row SELECT FOR UPDATE locks, approved session-only timeout/timezone profiles, the 30-group matrix with stated evidence classifications and bounded 2/8/16 concurrency/repetitions, both sequential loaders, exact-ledger cleanup and sanitized verification report at the §1 path. Explicitly exclude initially BLOCKED true connection-interruption/wire-ambiguity methods unless separately reviewed, and do not count those as PASS. No other tables/DDL/provider/network operations. Stop after failures and report unresolved mandatory gaps; final G3 acceptance requires separate owner decision.

G3-P must approve a real exact existing target, not merely this candidate. G3-X approval must fill any capacity/identity/implementation/cleanup gaps from actual preflight; this generic request is not an executable approval record. G3-A follows real evidence and cleanup review. Initial readiness: design prepared; provisioning/target identity UNVERIFIED; implementation NOT CREATED; database tests NOT RUN; true wire ambiguity/interruption and precise service-clock equality BLOCKED. All 14 legal decisions BLOCKED. No automatic progression.

## 16. Technical references and documentation verification

Public primary references reviewed 2026-10-25: PostgreSQL 18 [row locks](https://www.postgresql.org/docs/18/explicit-locking.html), [clock/timezone functions](https://www.postgresql.org/docs/18/functions-datetime.html) and [session statement/lock timeouts](https://www.postgresql.org/docs/18/runtime-config-client.html). Row-lock conflicts require independent sessions for meaningful tests. Wall-clock and transaction-start clocks differ; timestamp-without-timezone conversions must be deliberate. Session timeouts protect different operations. These support the proposed test distinctions; they do not verify local database behavior.

Only this plan/owner-acceptance record may change in G3-D. Preserve accepted code/tests, historical migration/harness/legal files and all existing changes. Final static checks must confirm the 654-file baseline, absent proposed implementation/report files, matrix completeness and git diff --check. No live versions/schema/counts, test results or production-readiness findings are inferred from the design.

G3-D documentation verification: **PASS**. The 654 preexisting files retained the §2 aggregate digest; all 30 required group IDs are present exactly once as matrix rows; local reference links resolve; no trailing whitespace; git diff --check passed. Both proposed test implementation paths and the later verification report remain absent. No compiler/test/database execution occurred. This verifies documentation structure and repository preservation only, not G3 database invariants. Owner acceptance of this plan and subsequent permissions remain separate decisions.
