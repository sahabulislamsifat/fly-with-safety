# Phase 1I-D — G1 AUTH-02 Design and G2 Approval Packet

Prepared 2026-10-25 (Asia/Dhaka). **G1 OWNER-APPROVED — DESIGN ONLY.** The FlyWithSafe project owner explicitly approved this G1 design in the subsequent owner declaration, subject to its documented security boundaries and dependencies. This approval covers the atomic conditional-consumption model, exact three-file implementation scope, A01–A18 regression plan, isolated runner requirements and targeted rollback strategy. It does not authorize G2 implementation or establish runtime/database correctness. All legal entries L-01–L-14 remain **BLOCKED**.

## 1. Executive Summary

AUTH-02 corrects one narrow defect: the current email-verification and password-reset transactions do not condition consumption on the token still being unused and unexpired. Proposed design: identify the credential, lock that exact token row inside an interactive Prisma transaction, then conditionally consume using a fresh database UTC time and commit the dependent account/session effects in the same transaction. One committed consumption per credential; no in-process lock or cache is authoritative.

The existing schema can represent this scoped usedAt/expiry invariant. It cannot represent durable revokedAt/account-generation semantics; those remain DB-02/AUTH-03. No new credential generation, issuance/supersession, notification/outbox integration, OAuth change or schema modification is included.

Authority and references: [adopted integration roadmap §§6/20](PHASE_1I_D_PRODUCTION_INTEGRATION_ROADMAP.md), [G0 adoption](PHASE_1I_D_G0_ROADMAP_ADOPTION.md), [master execution plan §7](FLYWITHSAFE_PHASE_1_TO_6_GATED_EXECUTION_PLAN.md), [D-3A lifecycle](PHASE_1I_D_D3_AUTH_DELIVERY_SECURITY_SCOPE.md) and [D-3B verification](PHASE_1I_D_D3B_VERIFICATION_REPORT.md). Earlier “G1 not approved” banners describe historical status. The original request authorized preparation; the subsequent owner declaration explicitly approves this design only. G2 still requires separate explicit approval. Other existing documents remain unchanged.

Baseline: development, HEAD 154cf93; seven dirty D-2 tracked files plus 16 existing untracked files, 651 total tracked/nonignored-untracked files. Aggregate SHA-256 of sorted JSON `[path,sha256(bytes)]` entries: `7e4e7ac8bb614ed7427a13841c6079ad5e2cf0438510a188db926dd6551f587c`. This design document was absent and is the only permitted addition. No tests, database connection or application module execution occurred.

## 2. Existing Authentication Behavior

All paths below are existing repository-relative source files. References describe current static evidence, not live records or deployed behavior.

| Source / symbol | Confirmed behavior |
|---|---|
| `server/src/services/auth.service.ts:31–36` — hashToken/newOpaqueToken | SHA-256 hex of submitted string; new credential uses 48 random bytes/base64url. Preserve both contracts. |
| `auth.service.ts:55–71` — issueVerificationToken | Stores hashed credential in EmailVerificationToken.token, with expiry; then sends a raw verification URL through notification service. Separate writes, outside AUTH-02 correction. |
| `auth.service.ts:74–92` — register | Creates user, issues verification, then creates session separately. No new registration atomicity claim here. |
| `auth.service.ts:152–169` — verifyEmail | findFirst matches hash OR legacy plaintext, usedAt=null and expiresAt>application time; then array transaction updates User.emailVerified and token.usedAt by id alone. |
| `auth.service.ts:172–180` — resendVerification | Deletes unused verification tokens, then issues a new one. No durable revocation/generation field. |
| `auth.service.ts:183–203` — requestPasswordReset | Deletes unused reset rows, creates hashed tokenHash with expiry, then queues a raw reset URL. Not changed by this package. |
| `auth.service.ts:206–220` — resetPassword | Finds unused/unexpired token by hash; bcrypt with SALT_ROUNDS=12 outside transaction; array transaction changes user password, sets token.usedAt by id and revokes active user sessions. |
| `server/prisma/schema.prisma:88–115` | EmailVerificationToken.token and PasswordResetToken.tokenHash are unique; id primary keys; user FK; expiresAt/usedAt. No revokedAt, purpose column, token-message FK or identity generation in these token models. |
| `server/prisma/migrations/20261009000000_auth_sessions_and_password_resets/migration.sql`; full-schema migration | Token DateTime columns are TIMESTAMP(3) without time zone; application writes use Date values. Existing UTC storage interpretation must be verified later; no live timezone assumption was queried. |
| `server/src/routes/auth.routes.ts:49–72` | POST verification/reset endpoints have auth rate limiter and Zod validation. |
| `server/src/validators/auth.schemas.ts:23–24` | Token string 32–512 characters; reset password uses existing bounded password policy. Do not replace validators. |
| `server/src/controllers/auth.controller.ts:100–128` | Service Promise<void> success mapped to existing JSON; reset clears existing auth cookies; errors forwarded. |
| `server/src/middleware/oauth-state.ts` / auth routes / passport config | Separate browser-bound signed state and durable replay marker. Read for compatibility only; no AUTH-02 dependency on executing this graph. |

The token-field unique indexes prevent duplicate stored values within their respective tables. They do not make a later id-only update conditional on unused state. Existing array transactions provide atomicity for their submitted writes, not a second check of the earlier read.

## 3. Confirmed Security Weakness

Two requests can both read the same unused credential before either current transaction commits. Both later transactions update that token by id, so both can apply the account effect. A second password reset can overwrite the first request's password and repeat session effects. This is an evidence-supported race in the code, not a newly executed PostgreSQL exploit.

An expiry accepted before password hashing/lock wait can also become stale. The new authoritative check must occur after the relevant wait, not simply repeat a timestamp captured earlier in application memory.

Legacy verification has another edge case: two distinct rows could match the submitted string's hash and legacy raw form. Each stored value can satisfy its own unique constraint. The new design rejects ambiguous matching unused candidates instead of guessing an account. This fail-closed edge case is explicitly part of the requested G1 decision; it does not retire ordinary single-match legacy credentials.

Not claimed fixed: concurrent issuance/supersession across different credentials, global account generation, durable revocation, token/outbox atomic issuance, raw notification storage, refresh-token/session issuance races, or login concurrent with reset. Those remain their existing change-unit dependencies.

## 4. Proposed Conditional Consumption Algorithm

### Inputs and advisory lookup

1. Capture primitive submitted token/password values before any await. Keep existing API validation outside the service and existing public signatures. Never interpolate these strings into SQL or log them.
2. Compute existing SHA-256 digest. Verification: find up to two unused candidates matching digest OR legacy raw value; select only id/userId. Zero or more than one → existing generic invalid/expired error, no transaction effects. Reset: find its single unused tokenHash candidate; select id/userId. No search of the other purpose's table.
3. Do not use an application-clock expiry filter as the authority. Proposed lookup omits local-clock expiry rejection; expiry is decided in the database transaction. This avoids application clock skew redefining acceptance. Expired reset candidates may therefore incur bcrypt work before rejection; preserve rate limits and password bounds. Do not introduce an unbounded lookup or new issuer.
4. Reset only: bcrypt-hash the captured password with existing SALT_ROUNDS before acquiring transaction/row locks. No crypto provider, mail or network work occurs inside the transaction.

### Authoritative transaction

5. Use `prisma.$transaction(async tx => …)` with proposed explicit ReadCommitted isolation, maxWait=2000 ms and timeout=5000 ms. These bounded transaction settings are proposed package defaults, not measured production latency guarantees; owner acceptance includes them. Installed generated declarations support the callback overload and these option fields.
6. On that same tx/connection, execute a **static-table, bound-value SELECT … FOR UPDATE** for candidate id/userId and exact submitted credential representation. Return only id/userId. Do not rely on an expiry predicate evaluated while initially searching for the lock. Lock result zero → invalid/expired; malformed or multiple rows → invariant failure. Never use SKIP LOCKED to misclassify a busy credential as available for independent work.
7. **Only after the lock statement resolves**, run a separate bound-value conditional UPDATE. Predicate: same id/userId/credential representation, usedAt IS NULL and expiresAt strictly greater than a single fresh database UTC timestamp. Set usedAt from that same timestamp; RETURNING only id/userId. This is the proposed consumption linearization point. It must not be combined with the initial lock search in a way that captures time before waiting.
8. Verify returned cardinality and identity at runtime: exactly one row for the selected id/user is required. Zero → existing generic 400. More than one, malformed result or unexpected identity → generic internal invariant failure. Both paths throw inside tx, rolling back any write; no user/session change follows failure.
9. Apply the dependent account effect with the same tx client. Require exactly one targeted user affected (or a successful unique-user update). Verification sets emailVerified=true. Reset changes only that user's password and revokes all that user's active sessions; zero active sessions is valid. Do not create a session or consume another purpose's credential.
10. Resolve service Promise<void> only after commit. Any failure aborts the entire unit. No application-level mutex, process-wide flag, local validity cache or automatic transaction retry.

### Proposed predicate shape — documentation only, not executable migration

Use two explicit static query branches in auth.service.ts, not request-selected SQL identifiers. A verification UPDATE may use this schematic SQL with **bound parameters**; its preceding SELECT FOR UPDATE is a separate statement on the same transaction:

```sql
WITH claim_clock AS MATERIALIZED (
  SELECT clock_timestamp() AT TIME ZONE 'UTC' AS claimed_at
)
UPDATE public."EmailVerificationToken" AS t
SET "usedAt" = date_trunc('milliseconds', c.claimed_at)
FROM claim_clock AS c
WHERE t.id = $1 AND t."userId" = $2
  AND (t.token = $3 OR t.token = $4)
  AND t."usedAt" IS NULL AND t."expiresAt" > c.claimed_at
RETURNING t.id, t."userId";
```

$1/$2 are the selected opaque id/userId; $3 is the digest and $4 is the captured legacy-compatible submitted value. The reset branch names only public."PasswordResetToken" and matches tokenHash=$3, with no raw/legacy fallback. In future TypeScript use Prisma's safe tagged `$queryRaw` parameter binding, not `$queryRawUnsafe`, concatenation or a formatted SQL string. Do not issue this SQL during G1 or initial mock-only G2.

`AT TIME ZONE 'UTC'` aligns the clock expression with the intended UTC meaning of the existing timestamp-without-time-zone fields. Capture one post-lock claim time in the materialized CTE; truncate only stored usedAt to milliseconds, not the full-precision strict expiry comparison. No session/database timezone or column-type change is proposed. Existing non-UTC/manual legacy data would require separate inventory and disposition, not an implicit conversion.

This makes expiry valid at the conditional-update time, not at response time or final commit time. A transaction validly consuming just before expiry may commit afterward. It never extends expiresAt. Confirm these exact semantics and timestamp decoding against the approved PostgreSQL target at G3/G5.

## 5. Email-Verification Design

Keep `verifyEmail(token: string): Promise<void>`. Hashing and normal single-match legacy plaintext lookup remain supported. Fail-closed ambiguous candidates return the same generic invalid/expired message; they do not reveal how many accounts matched or which format exists.

Lock and UPDATE only EmailVerificationToken with id/user/credential bindings. A waiter that finds the first winner committed must fail usedAt IS NULL and must not update User. If the first transaction rolls back, a later contender may legitimately consume if still unexpired; “single use” means at most one **committed** consumption, not permanently burning a token after a failed effect.

Set emailVerified for the returned user inside tx; already-verified user state does not authorize replay of an already-used credential. No email, token deletion, session creation, issuer/supersession change or notification resend. Existing controller success remains `{success:true,data:{message:'Email verified successfully'}}`.

## 6. Password-Reset Design

Keep `resetPassword({token,password}): Promise<void>`, current SHA-256 lookup and bcrypt SALT_ROUNDS=12. Capture inputs, find candidate, hash outside the transaction, lock only PasswordResetToken and conditionally consume. Two contenders may each finish bcrypt, but only the committed token winner may update password/revoke sessions.

Update returned user's password and `session.updateMany` for userId/revokedAt=null in the same tx. Preserve session revocation meaning and current controller cookie-clearing paths/options. A user update or session update failure rolls back usedAt and password; there must be no partial reset. Do not reset email-verification state or create a new login session.

Existing controller success remains `{success:true,data:{message:'Password reset successfully. Please sign in.'}}`. Reuse/expiry/missing/wrong purpose receives generic reset invalid/expired error. A commit whose response is lost may be followed by a rejected retry; do not report the retry as a new successful reset or mint another credential.

## 7. Prisma Transaction and Concurrency Model

Installed static evidence: `server/src/generated/prisma/index.d.ts:319–354` declares safe tagged `$queryRaw` and interactive `$transaction` with isolation/maxWait/timeout. Prisma/schema type inspection does not establish runtime adapter behavior. Existing schema primary/unique/FK fields suffice for this exact row-consume design; no generated-client edit, migration, new dependency or new runtime Prisma namespace import is required just to use a tagged tx query.

Why not simply updateMany after a read? It can prevent double use if unused is in its predicate, but an application timestamp captured before a row-lock wait does not satisfy this design's fresh DB-time expiry boundary. Explicit row locking followed by a second clocked conditional UPDATE keeps that boundary clear. Atomic DELETE would change audit/usedAt semantics unnecessarily; an in-memory lock would not protect multiple instances.

Expected interleavings (proposed, not live-tested):

| Interleaving | Required result |
|---|---|
| Two lookups see unused row; first consumes/commits | Second waits for row lock, then conditional UPDATE returns zero; one account effect. |
| First consumes then account/session effect throws | Entire first tx rolls back; next claimant may win if still valid. |
| Another tx only locks the row, without changing it, until after expiry | Explicit lock statement finishes first; subsequent clocked UPDATE rejects. This case must be tested, not inferred only from changed-row predicate re-evaluation. |
| Credential deleted/superseded after lookup, before lock | No matching locked row/UPDATE → reject, no effects. No stronger concurrent-issuance/generation guarantee is implied. |
| Credential value/user binding no longer matches candidate | Reject, never fall through to another row or purpose. |
| Transaction admission/lock timeout, deadlock or serialization failure | Abort/rollback, sanitized internal error, no automatic retry or account effect outside tx. |
| Commit succeeds but connection/client response fails | Outcome may be uncertain to caller; later retry must not repeat committed effects. No exactly-once response guarantee. |

Token-first locking and later user effects can interact with account deletion/supersession lock order. Keep the unit short/bounded, propagate rollback safely, and test deadlock/parent-delete cases at G3/G5 before activation. A broader issuer/account lock-order redesign is not silently included in AUTH-02.

Primary technical references checked 2026-10-25: PostgreSQL documents [row-level locks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS) and [Read Committed waiting/re-evaluation](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-READ-COMMITTED). The proposed separate post-lock statement avoids treating an earlier search-time decision as final. [Date/time documentation](https://www.postgresql.org/docs/18/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT) distinguishes wall-clock time from transaction-start time and describes timezone conversion; [UPDATE RETURNING](https://www.postgresql.org/docs/18/sql-update.html) reports updated rows. These are design references, not proof that the installed Prisma/adapter/schema behaves correctly. No PostgreSQL/API/KMS service request or database command was executed; only public documentation was read.

Later G3/G5 proof must cover two independent connections/processes, commit/rollback/lock-only waits crossing expiry, session-timezone variation, timestamp precision, exact row counts, parent deletion, adapter transaction affinity, timeout/deadlock and commit-ack ambiguity. Verify schema/constraints/no unexpected triggers against an explicitly approved disposable database and separately approved fixture cleanup. Historical Phase 1H cases do not cover this new algorithm.

## 8. Exact Three-File Implementation Plan

| Future file | Permitted implementation / preserved contract | Edge cases, types and verification | Risk / scoped rollback |
|---|---|---|---|
| Existing `server/src/services/auth.service.ts` | Only verifyEmail/resetPassword and directly necessary adjacent private consume/result-validation helpers/type-only imports. Capture inputs; purpose-static lock/update branches; interactive atomic effects; sanitized errors. All other functions/signatures/hash/issuer/OAuth/session helpers stay unchanged. | Zero/multiple/malformed rows, ambiguous legacy, wait/expiry, missing user/effect failure, no retry. Use unknown/guards for raw result validation; existing Prisma TransactionClient types; no any/unsafe cast or SQL identifier interpolation. | Extra DB round trip/locking; generic 500 on operational faults. Preserve exact pre-G2 bytes and patch; approved scoped reversal only. |
| New `server/test/auth-consumption.test.ts` | A01–A18 synthetic unit/compatibility cases, staged fake tx/scheduler, hoisted mocks and a guard-first beforeAll bootstrap in this same file. Load the real service dynamically only after guards. Optional direct controller/error-handler invocation with synthetic request/response stand-ins; no Express listener/app/OAuth graph. | Fake DB clock independent from app clock; stage effect/rollback; query text/parameter-binding checks without echoing values; typed mocks, deterministic promises, timer/listener cleanup. | Model is not DB correctness. New file removable only after ownership/later-edit/approval check; retain evidence first. |
| New `server/test/auth-consumption.vitest.config.ts` | Config-only CommonJS with erased ViteUserConfig type; root=__dirname, envDir=false, include=['auth-consumption.test.ts'], globalSetup=[], setupFiles=[], node/threads/one worker, fileParallelism=false, isolate=true, no watch/cache/coverage. | Bounded hooks/tests; both bundled/native loaders; exact one-suite scope. Guard initialization lives in the test's awaited beforeAll bootstrap, not config/default app setup; mock factories remain hoisted. | Loader/hoist compatibility must be proved after creation. No fourth setup/config file, manifest or env change; stop if necessary. |

Both new paths are confirmed absent. Three-file scope applies to future implementation only. AUTH-02 must not edit schema, migrations, routes/controllers/middleware, env/config, notification/outbox, OAuth, generated client, package/lockfiles, accepted prototypes, existing test files or other service functions. If additional edits become necessary, stop and request revised G2 approval.

## 9. Test Cases A01–A18

Every row is **PROPOSED / NOT RUN**. The 18 IDs are coverage groups, not an invented passing-case count. Variants use synthetic users, bounded strings, fake DB state/clock and controlled promise scheduling; no real credential or PostgreSQL.

| ID | Required cases | Expected outcome / evidence boundary |
|---|---|---|
| A01 | Valid hashed verification; single-match legacy raw verification; already-verified user with still-unused token | One committed consume and targeted emailVerified effect; Promise<void>; supported legacy retained. |
| A02 | Expired verification, exact expiry equality, lock-only wait crossing expiry, application/DB clock difference | Generic verification error; zero user effects; query contains fresh UTC DB-time predicate, not bound pre-wait Date. Mock timing is not PG proof. |
| A03 | Verification reuse after committed winner | Generic verification error, no second account update; consumed state remains. |
| A04 | Two verification contenders read same row; first commits versus first rolls back | At most one committed effect; waiter rejects after commit, can win after rollback if still valid. |
| A05 | Valid reset; no active sessions; multiple active sessions | Hash outside tx with existing cost; winning user's password and active-session revocations commit together; no new session. |
| A06 | Expired reset/equality, expiry during bcrypt/lock wait, UTC/session-timezone query inspection | Generic reset error and no password/session effects; DB-time decision authoritative. |
| A07 | Reset reuse with same or different proposed password | No second committed password/session change; generic reset error. |
| A08 | Two reset contenders/hash completions and opposite completion order | One committed reset effect for that credential; loser cannot overwrite. No process-local production lock. |
| A09 | Lock returns zero, conditional UPDATE returns zero, malformed/multiple/wrong-user result, DB timeout/error | No dependent user/session changes; rollback; count mismatch fails closed; raw metadata/credential not exposed. |
| A10 | User effect failure; reset session-update failure after password staged; transaction commit rejection | Consumption/password/session changes roll back in the model. Distinguish known rollback from ambiguous post-commit acknowledgment; real proof later. |
| A11 | Unknown/invalid token, SQL-injection-shaped bound input, ambiguous legacy candidate set | Existing generic error and no mutation; no raw input/query values in error/log/assertion output. No guessed account. |
| A12 | Reset-only credential submitted to verify and verification-only credential submitted to reset | Correct purpose-static table rejects; no cross-purpose search/fallback. Identical strings deliberately stored in both tables are not a schema-enforced global-purpose separation guarantee. |
| A13 | Direct unchanged controller success/error paths, response utility/error-handler behavior with fake req/res/next | Exact existing success JSON, invalid token status/code/messages, reset cookie clearing only after success; no listener/app import. Not deployed HTTP proof. |
| A14 | Outside-function/source hashes for OAuth/state/routes/cookies helpers; no OAuth imports/calls from suite | No changed OAuth logic or new runtime dependency. No claim that actual Google/cookie interoperability was exercised. |
| A15 | Console spies, sanitized ORM/bcrypt faults containing sentinels, query diagnostics/assertion formatting | No token/password/hash value or raw query params in logs/errors; only safe codes/opaque structure. Final test output scanned. |
| A16 | Guard-before-service ordering, no actual Prisma/env/notification/SMTP/provider module evaluation; blocked dispatch and exact config/import graph | Mocks hit canonical modules, no .env reads, no live DB/adapter or external service initialized; fail closed before tested imports if bootstrap fails. |
| A17 | Static impact scan of current auth callers/tests; reuse actual validators/controller response contracts in isolated cases; preserve unrelated auth exports | Current existing tests have no located direct verifyEmail/resetPassword transaction-shape dependency; API validation/OAuth spies remain compatible by source review. Original API/OAuth suites are not falsely reported as run. |
| A18 | Existing backend strict no-emit plus explicit test/config compilation and both loaders | Real future compiler/runner results required; no cast/any to hide interface errors; no install/shared tsconfig change. |

Additional variants within these groups: input mutation during bcrypt, missing/deleted user with rollback, account lookup/consume binding mismatch, unknown DB error sanitization, no mail/session creation in consume, token undeleted audit state, untouched expiry/hash contracts, no ordinary autorefresh retry, and repeated runs without leaked timers/listeners.

## 10. Test Runner Isolation Strategy

### Actual dependency audit

Static in-memory TypeScript transpilation of existing files (not execution) confirmed these emitted runtime imports:

- auth.service.ts: bcryptjs, jsonwebtoken, crypto, ../lib/prisma.js, ../utils/errors.js, ../config/env.js, ../utils/helpers.js and ./notification.service.js. Generated Prisma/UserRole imports are type-only and erased.
- auth.controller.ts: jsonwebtoken, auth.service.js, response.js, errors.js and env.js. Auth middleware types are erased; controller module need not initialize Passport/app.
- helpers/errors are pure local utilities plus crypto; response uses request-context's Node AsyncLocalStorage. These do not need database/env/provider initialization.
- Actual env.ts reads candidate .env files with fs/dotenv at import; actual lib/prisma.ts constructs PrismaClient/PrismaPg from DATABASE_URL at import; notification.service.ts imports nodemailer/env/outbox. **None may execute in the new suite.** envDir=false only blocks Vite env-file loading, not explicit dotenv calls.

### Exact safe bootstrap within the three files

1. Dedicated config selects only auth-consumption.test.ts, no application/global setup or inherited default suite. It imports no tested runtime or environment loader. Config has no named guard exports/mixed default export.
2. In auth-consumption.test.ts, `vi.hoisted` initializes synthetic state/mocks only. Static runtime imports are limited to Vitest and approved Node built-ins needed by the harness. **Do not statically import auth.service.ts/controller/other tested application modules.** A single async beforeAll installs guards and only then dynamically imports the real subject. Keep the accepted guard behavior as a reference, not a runtime prototype-fixture import. This avoids accessing uninitialized static imports inside vi.hoisted, avoids a fourth setup file and needs no top-level await in this CommonJS/NodeNext package.
3. Before the first application import, patch fetch/WebSocket, TCP/socket/TLS, HTTP(S) including agents, DNS and promises, UDP and subprocess APIs with throw-before-dispatch stubs; sync builtin ESM exports. Assert installed state and a deliberately blocked synthetic dispatch before importing the subject. Record labels only. If setup fails, throw from beforeAll and do not import application code. No environment value, connection URL or credential is read by this bootstrap.
4. Register complete hoisted `vi.mock` factories for canonical ../src/lib/prisma.js, ../src/config/env.js and ../src/services/notification.service.js. Return a fake ORM/tx, synthetic fixed config and fail-if-called mail functions. Add fail-on-evaluation sentinel mocks for adapter-pg/pg, dotenv and nodemailer as defensive traps; they are not real provider imports. Mock bcrypt hash/compare and jwt sign/verify as needed. Do not use importActual on prohibited modules. Inside guarded beforeAll, dynamically import the **real auth.service.ts**; do not replace the subject with FakeOutbox or a duplicate implementation. Types may use erased type-only imports/typeof import; runtime service values are populated after the awaited bootstrap.
5. Fake ORM methods default to fail closed. `$transaction` supplies only staged synthetic tx methods, publishes state after the callback succeeds, and discards staged effects on failure. `$queryRaw` captures static template text/bound value slots with no printed values; model row locks/contenders via deterministic test scheduler. Production code never uses this scheduler.
6. No separate setup file is needed: hoisted factories, beforeAll guards and tests share the approved test file. Both loaders must demonstrate the initialization order; source/AST/import assertions must prevent actual Prisma/adapter/pg/dotenv/nodemailer/app/Passport module evaluation. Local Vitest declarations document hoisted factories running before imports; their compatibility is still a future runtime check. A boundary failure fails the suite, never enables a live fallback.
7. A13 may directly import unchanged controller/response/error-handler utilities after mocks; if error-handler imports logger, mock its output or use safe console capture with synthetic metadata. No app/router/listen/Supertest import. All production code outside the allowed functions remains read-only.

Existing api.test.ts/oauth-state.test.ts/request-origin.test.ts and notification tests directly import app/env/Prisma before per-case spies. They **must not be imported into this one-suite config or executed under unreviewed defaults**. The source scan found no direct test of verifyEmail/resetPassword's array transaction to preserve; existing booking transaction mocks test other functions. This resolves safe execution of the new AUTH-02 suite without another production edit/dependency. It does not certify the entire original regression harness as safe.

A13/A14/A17 therefore distinguish unit contract/source preservation from fresh execution of original HTTP/OAuth suites. Older broader neighborhood requirements are not waived: whole-application acceptance still needs their safe, separately approved execution. If the owner requires those original suites at the initial G2 package gate, first approve an amended safe-runner scope; do not silently broaden include, reuse unsafe defaults or claim A17 ran them. This is an explicit owner-review condition, not a hidden passing check.

Future commands from server, **NOT RUN** during G1:

```powershell
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck --types node,vitest/globals test/auth-consumption.test.ts test/auth-consumption.vitest.config.ts
& .\node_modules\.bin\vitest.cmd run --config test/auth-consumption.vitest.config.ts
& .\node_modules\.bin\vitest.cmd run --config test/auth-consumption.vitest.config.ts --configLoader native
git diff --check
```

No build/postinstall/prisma generate, installation, shared tsconfig/config edit or integration runner. Type checking emits no code or database operation. Initial G2 runs A01–A18 only after reviewing implemented guards/mocks/config. No fixed case count or pass result is invented now.

## 11. OAuth Compatibility

Do not modify/import-execute passport configuration, Google strategy, state cookie generation, state expiry/consume uniqueness, callback routes, redirect behavior, session restoration/refresh/logout or login/register/issuer functions. Preserve OAuth/JWT secrets and purpose isolation; no token-consumption query may touch IdempotencyRecord or OAuth consume markers.

Existing auth.controller.ts cookie clearing occurs only after resetPassword resolves; failed/reset-loser requests must not clear cookies as a success side effect. Existing routes retain authRateLimiter, validation and F02 origin protection. A14 establishes exact outside-scope nonmutation and lack of new OAuth dependencies; real browser/Google/cross-origin session behavior remains a later authorized regression/staging gate.

## 12. Error Handling and Logging

Preserve invalid/reused/expired/missing/wrong-purpose error contracts:

| Path | Public service/API contract |
|---|---|
| Verification | AppError.badRequest('This verification link is invalid or expired.'); HTTP 400/BAD_REQUEST under existing error middleware. |
| Reset | AppError.badRequest('This password reset link is invalid or expired.'); HTTP 400/BAD_REQUEST. |
| Malformed route input | Existing Zod validation/422 behavior remains outside service changes. |
| Operational/invariant/unknown bcrypt/DB/commit failure | Sanitized AppError.internal() / HTTP 500 with existing generic “Internal server error” envelope; no raw cause, query text/params or submitted data. |

Use a private per-call invalid-credential error/factory to distinguish expected rejection from unknown failures. Never pass through arbitrary thrown AppError details/messages as trusted auth rejection; normalize unknown exceptions without attaching raw causes. Throw inside the transaction so sanitization cannot accidentally swallow failure and commit staged effects. No new console/logger calls are needed in consume functions. Do not log token, password, digest, candidate values or driver exceptions.

The current error-handler.ts already uses serializeError for unknown failures; the new service boundary should ensure submitted query data does not escape through driver errors before that boundary. Safe request IDs and codes are adequate diagnostics. No username/account existence or already-used state distinction in public responses. Do not change global logging, middleware or API error structure in this package.

## 13. Rollback Strategy

Current auth.service.ts exact byte SHA-256: `54c1a4f4141cea0bdae59887b45a3edd94df63a580281233cba98b6cde5ed784`.

Current function-text SHA-256 (TypeScript AST node getText over source, without normalization): verifyEmail `932044bb44f05a5a8675cc0b50fc73fdb7c41977eb1009a103c0d2d6494f52cd`; resetPassword `802d6a13092629062c7ca860842252466e18764a897f4f44a627b87916f25c75`.

Future G2 rollback procedure:

1. Reinspect branch/HEAD/status, hash all preexisting tracked/untracked artifacts and capture current full auth.service.ts bytes plus the exact authorized patch before editing. If current file differs from this design baseline, reconcile before execution; do not overwrite the user's newer edits.
2. Keep recoverable baseline/evidence in an approved session artifact or owner-authorized location, not an unapproved fourth repository file. Record original absence and later hashes/ownership of both new test files. No Git commit is authorized as a backup mechanism.
3. After implementation, record full diff, tests/output without secrets and hashes; compare all unrelated functions/imports/files against the pre-G2 baseline. Direct helper/import additions must remain necessary to the two consume paths.
4. If rollback is requested/authorized, inspect current diff and later edits first. If unchanged since G2, restore only AUTH-02 hunks/bytes from captured pre-G2 state; if others edited the same function, stop for a reviewed merge instead of clobbering their work.
5. Preserve test/evidence artifacts before removal. Remove the two newly created test files only with ownership and explicit deletion/rollback authorization; otherwise leave them for review or restore only authorized later changes. Never remove another user's new file because its name matches this plan.
6. Run the previously passing **safe** relevant checks on the restored code using an approved retained harness, verify outside-function/OAuth/source hashes, and report the rollback result. Do not run a new-race assertion expecting vulnerable baseline code to pass; distinguish baseline compatibility from the corrected security behavior.
7. No database was executed by initial G2, so no schema/data restore is needed. After a later real activation, do not re-enable known unsafe consumption as casual rollback: pause affected redemption and use a reviewed forward fix/recovery decision.

Prohibited: git reset --hard, git clean -fd, force checkout, repository-wide restore, automatic test-file deletion, unapproved commit/push, database reset/cleanup or production-state restoration. Restoring source does not authorize reversing actual user password/session changes.

## 14. DB-02 Dependencies

Existing schema is sufficient for row-based single committed consumption and account-effect atomicity under the proposed transaction. It is insufficient for the following broader claims:

- Explicit persisted revokedAt/generation status; currently supersession deletes unused rows. Missing/deleted rows are rejected, but this is not durable revocation history.
- Account-wide issuance generation/supersession across multiple simultaneously valid credentials, recipient change-away/back, expiry/restore rollback resistance or account recreation policy.
- Token/job relationship, notification expiry/redrive admission and atomic issuer/outbox writes.

Those remain DB-02/AUTH-03/AUTH-01/DB-01 as applicable. No new field is inferred from Session.revokedAt; session revocation is a different model. No schema is required merely to add the conditional usedAt predicate and lock/update transaction. If owner acceptance requires full durable revocation now, G2 is blocked pending a revised package/schema design; do not expand silently.

Real database tests, trigger/policy/timezone inventory, actual adapter support/permissions, lock order/deadlocks, runtime timeouts and concurrency proof remain G3/G5. Current schema text and primary documentation are design evidence, not real PostgreSQL verification. No authorization for any local/remote database or protected integration target is inherited here.

Legal dependencies remain unchanged: L-03/05/10 are directly relevant to real auth/security activation; other L-01–L-14 dependencies remain mapped in the adopted roadmap. All 14 remain BLOCKED. Fake offline coding/testing does not approve real processing, retention/deletion, transfer, KMS or production readiness. No legal conclusion or statutory period is adopted.

## 15. G1 Acceptance Criteria

| Criterion | Design assessment / future acceptance boundary |
|---|---|
| Actual code paths/schema/API/test imports inspected | Prepared with symbols/lines and static emitted-dependency evidence; no live data. |
| Single-use and transaction algorithm precise | Lock exact candidate, fresh UTC conditional consume, one row, atomic effect/rollback, no local authority/retry. G3/G5 needed for actual guarantee. |
| Expiry/legacy/purpose semantics explicit | Strict DB-time post-lock boundary; single-match legacy retained; ambiguous legacy denies; purpose-static tables. Owner-approved as design choices, subject to documented verification dependencies. |
| Exact three-file scope | Defined, two new paths absent; no implementation files created. |
| Isolation feasibility | New one-suite hoisted-mock graph can avoid actual env/Prisma/notification initialization without another production edit/dependency. Runtime hoist/loader proof deferred until G2. |
| A01–A18 and compatibility | Complete proposed scenarios; original HTTP/OAuth suites are not disguised as executed tests. Broader safe-runner approval condition explicit. |
| Rollback and DB-02 | Complete scoped procedure, current hashes and absence of durable revocation explicit. |
| Legal/status/preservation | All 14 BLOCKED, G0 adopted, G1 OWNER-APPROVED — DESIGN ONLY, G2/later phases not authorized; all unrelated preexisting files must retain baseline. |

**G1 OWNER-APPROVED — DESIGN ONLY.** Recorded from the owner's explicit declaration on 2026-10-25 (Asia/Dhaka), following the original “G1 DESIGN READY — AWAITING OWNER REVIEW” verdict. The owner accepts the design subject to documented boundaries and dependencies; SQL/locking, loader isolation and runtime behavior remain unproven. No unavoidable extra production file or dependency is identified for A01–A18. Full original-suite execution or durable revocation in initial G2 would require a separate scope decision as stated above.

## 16. Exact G2 Approval Request

G1 design acceptance is now recorded. The following remains a request for separate explicit G2 authorization, not permission already granted:

> Approve AUTH-02 G2 under exactly server/src/services/auth.service.ts, server/test/auth-consumption.test.ts and server/test/auth-consumption.vitest.config.ts. Implement the reviewed conditional-consumption algorithm with explicit post-lock UTC database-time expiry, one-row verification, atomic user/password/session effects, preserved hash/legacy/API/OAuth contracts, ambiguous-legacy fail-closed behavior and bounded interactive transactions. Use the isolated real-service A01–A18 suite, standalone strict no-emit TypeScript and both reviewed loaders; preserve every unrelated existing file. No schema/migration/database execution, env/dependency changes, KMS/cloud/SMTP/OAuth/provider/supplier/payment operation, deployment, commit/push or phase transition. Stop after offline code verification and report remaining real DB and broader regression gates. If extra files, unsafe imports or stronger revocation semantics are needed, stop for revised approval.

G1 owner approval is **design only**, not that G2 approval. All 14 legal decisions remain BLOCKED. If full original HTTP/OAuth regression execution is required at initial G2 exit, resolve its safe-harness allowlist before execution rather than using the new single-suite config to bypass its include or silently weakening earlier gates. No proposed command was run in G1.

## 17. Known Limitations

Offline models validate ordering/predicates/rollback logic, not PostgreSQL/Prisma locking/durability or multi-instance correctness. The row-lock algorithm relies on supported static table mapping, ordinary transactional behavior, intended UTC timestamp storage, trustworthy database clock and verified actual schema/policies/triggers. Hardware clock rollback, privileged DB rollback and cross-credential/account issuance races are not solved here.

Two valid credentials for the same account can each have one legitimate committed use until generation/supersession policy is implemented. Concurrent login/session creation versus reset remains outside this narrow change. A transaction may commit after valid consume time; a lost response does not mean rollback. Unknown operational failure is sanitized rather than automatically retried. Extra queries/row locks may affect latency and create deadlock interactions; bounded failure and later real tests are required.

No production authorization/KMS/encrypted outbox/passenger-storage/staging/email/Google/browser/compliance proof is established. Existing synthetic milestone acceptance is not expanded by this design. No fresh production test counts or guaranteed delivery dates are claimed.

## 18. Phase Status

G0: owner-adopted planning baseline. G1 AUTH-02: **G1 OWNER-APPROVED — DESIGN ONLY**, subject to documented security boundaries and dependencies. G2: **NOT AUTHORIZED**. D-1/D-2/D-3B: owner-accepted within their synthetic boundaries. Phase 1I-D: in progress/incomplete. Phase 1I-E, Phase 1J and Phase 2: **NOT AUTHORIZED**.

Original G1 design session operations: source/proposal/schema/generated-type reads, static in-memory TypeScript dependency analysis, public PostgreSQL documentation review, and this single documentation addition. No application/tests, PostgreSQL, customer data, real credentials, KMS/OAuth/mail/provider, schema/migration, package/env, deployment or Git-history operation occurred. Existing acceptance/roadmap/ADR/legal files remained unchanged.

Documentation verification: PASS — all 18 required sections and A01–A18 coverage rows present; local reference links resolve; no trailing whitespace; git diff --check passed. All 651 preexisting tracked/nonignored-untracked files retain the baseline aggregate digest recorded in §1. auth.service.ts retains its §13 byte hash; both proposed test/config paths remain absent. Only this document was added. No runtime tests, TypeScript project check or database concurrency test was executed; all proposed G2 commands and A01–A18 results remain NOT RUN.

Owner-acceptance recording session: updated this packet only to record the explicit design approval and preserve the separate G2 gate. No production code or implementation test files were changed/created, and no database, Prisma, KMS, OAuth or deployment operation was performed. All 14 legal decisions remain BLOCKED. Stop after recording acceptance, checking preservation and presenting §16 for separate approval.
