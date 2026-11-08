# P5-IDENTITY/SCOPE implementation report

Date: 2026-11-07. Repository: `E:\Programming\Project\fly-with-safety`.

**Verdict: PARTIAL — implementation and focused offline verification completed; disposable PostgreSQL migration/runtime proof and browser acceptance remain unexecuted. No production activation. This does not declare all Phase 5 complete.**

## Scope and preserved baseline

Implemented the approved attachment and [Phase 4 implementation brief, section N](PHASE_4_REBASELINE_AUDIT.md#n-first-recommended-complete-engineering-batch). Planning policy: deep, dependency-level context, impact-based verification, no delegation. Security decision: extend the existing authentication/session system; gate the additive runtime until separately reviewed migration, key configuration, credential retirement and tests are complete.

Phase 0–3 evidence, historical financial fixtures, consumed callers and the pre-existing Phase 4 audit were not edited. No database connection, migration, account provisioning, credential rotation, public tunnel, email delivery or payment/provider request was executed. No development service was started or stopped. Working changes were not reset, cleaned, staged or committed.

The prior audit file's observed SHA256 is `A3C09013A7C5D07A79EC7634F6DC1F18822C6995624C1DEBE9789926AEB3F2C6`. Historical source/runtime generated clients were not regenerated. Existing financial records were not inspected live or mutated; preservation here means artifact/diff preservation, not a new database reconciliation claim.

## Implemented files and behavior

| Files | Change |
|---|---|
| `server/prisma/schema.prisma`; `server/prisma/migrations/20261107000100_identity_scope/migration.sql` | Add SUPER_ADMIN, six departments and seven identity tables. No existing account promotion or data backfill. Typed assignments have exactly one resource, membership/assignment uniqueness, foreign keys, version checks and an append-only audit trigger. |
| `server/src/identity/policy.ts`, `middleware.ts` | Central permission vocabulary, recognized-role whitelist, recent privileged MFA, explicit operations-route mapping and unmapped-operation denial. Staff global content/outbox/customer/financial administration is denied. |
| `server/src/identity/auth.ts`, `store.ts` | Current database role/status/session/version validation; authorization context; assigned-ID filtering; transactional record/department guards; revocation and audit helpers. Assignment lists also recheck current account version and membership. |
| `server/src/identity/management.ts`, `routes.ts` | Employee invitations; activation; controlled account suspension/roles; department delegation; task assignment/revocation; bounded customer directory and owner audit API. No public owner-grant or password-administration route. |
| `server/src/identity/crypto.ts`, `mfa.ts` | TOTP, encrypted identity-bound factors, expiring enrollment, account-wide challenge throttling, one-use TOTP steps and recovery codes, recent session proof and revocation of other sessions on recovery/factor replacement. |
| `server/src/identity/bootstrap.ts`; `server/prisma/seed.ts` | Inert exact-identity primary-owner provisioning component with database/OID, verified email, existing ADMIN, enrolled MFA, suspension and no-existing-owner guards. The old privileged seed creation/password path was removed. Nothing was provisioned or rotated. |
| `server/src/middleware/auth.middleware.ts`; `server/src/services/auth.service.ts`; `server/src/controllers/auth.controller.ts` | Reuse JWT/cookies/refresh sessions. Versioned sessions in enabled mode; current role rather than stale JWT role; password-reset session invalidation and audit. Google requires explicit verified-email evidence; implicit linking to an existing privileged account is refused. |
| `server/src/app.ts`; `server/src/routes/admin.routes.ts`; `server/src/services/{booking,booking-commercial,contact,inquiry-status,flight,hotel,package,visa}.service.ts` | Mount the identity API; apply operations policy and assigned resource filters. Scope checks cover booking commercial/status mutations and inquiry/contact updates, including no-op booking mutations. Scope-sensitive mutations audit inside their transaction. |
| `server/src/payments/{payment-domain,payment-store,payment.routes,payment.service}.ts` | Recognize SUPER_ADMIN in existing ADMIN capabilities while retaining payment activation/refund guards. Enabled Staff payment reads require assigned booking scope; global reconciliation/refunds/manual fund recording remain denied to Staff. Provider callbacks and financial-status validation were not relaxed. |
| `client/src/lib/api/auth.ts`; `client/src/components/navbar/Navbar.tsx`; `client/src/components/admin/AdminPortal.tsx` | Four-role client type, correct owner/staff/admin navigation, actual-role badge and security/assignment links. Existing operations components reused. |
| `client/app/{owner,staff,invite}/page.tsx`; `client/app/account/security/page.tsx`; `client/src/components/admin/{IdentityWorkspace,IdentityManagement}.tsx`; `client/src/components/auth/IdentitySecurity.tsx` | Minimal workspaces; invitation, assignment, suspension and department/role forms; authenticator enrollment/verification/recovery. Account changes remount sensitive UI state. Invitation fragments are removed from the address bar; no bearer/MFA material in localStorage or remote QR services. |
| `server/test/p5-*` | Focused HTTP/security/crypto tests, strict test TypeScript configuration, environment-free offline tooling and a separately gated real-PostgreSQL test. |

## Authorization and account contracts

- **SUPER_ADMIN:** governance, role/delegation, invitations, assignment, customer and existing operations permissions. No API can grant SUPER_ADMIN or demote/suspend a SUPER_ADMIN; no self-governance. First owner uses the separately approved provisioning component.
- **ADMIN:** existing daily operations and bounded customer management; Staff invitations/assignments only within delegated departments. Cannot change roles or grant an owner. Customer suspension/reactivation revokes sessions.
- **STAFF:** MFA plus department and exact active assignment. Lists/counts are scoped. Product booking writes require the product department; Finance/Support assignments allow assigned reads, not product mutation. Conversion of inquiries to bookings, manual financial recording, global reconciliation, refunds, content, outbox and customer-directory access require operations/admin approval.
- **CUSTOMER:** existing own-account/bookings/payments/request ownership remains in place. Guest reference/email lookup keeps its existing minimized DTO boundary; it was not converted into a global authenticated directory.

An authorization version changes on account/role/delegation/assignment changes, and affected refresh sessions are revoked. Enabled authentication rejects legacy tokens without a version, suspended identities, unknown roles, stale versions and inactive sessions. Privileged routes require a current MFA proof with a 15-minute lifetime. Transactional scoped mutations recheck current identity and assignment before persistence. Existing requests already in flight are not described as globally cancelled; concurrent SQL/race behavior needs the real disposable proof.

Invitations are random 256-bit bearers stored as SHA256 digests, email-bound, one-use and valid for 24 hours. Issuer role/version/suspension and delegated departments are rechecked at activation. The issuer never receives the token/password. Delivery is separately gated; activation requires a submitted delivery and possession of the private recipient link. Existing-account invitations are refused. No external email has been sent.

MFA uses HMAC-SHA1 TOTP with a 30-second step, a one-step clock window and database-fenced consumed steps. AES-256-GCM binds ciphertext to the user ID. Five failed account challenges impose a ten-minute block across sessions; HTTP rate limits add another boundary. Ten random recovery codes are returned once and stored only as identity-bound hashes. Recovery/factor replacement revokes other sessions. Password-reset recovery retains the existing verified-email flow; an email reset does not remove an enrolled second factor.

## Executed verification

Final non-overlapping test results: **193 PASS, 0 FAIL, 1 SKIPPED**.

| Check | Actual result | Evidence |
|---|---|---|
| P5 HTTP/identity/MFA/Google/owner-component tests | 64 PASS; actual Express identity/admin/account routes and real authentication/services, mocked database/mail boundary | [tests.json](../../output/phase5/identity-scope/tests.json), `server/test/p5-identity.test.ts` |
| Disposable-target guard tests | 8 PASS; reject cloud, protected OID 34701, protected integration name, elevated/default roles, URL overrides and missing approval | Same JSON; `server/test/p5-disposable-target.test.ts` |
| Financial negative contract regression | 28 PASS, explicitly mocked provider/database boundary | Same JSON; existing `server/test/phase3-negative-contract.test.ts` unchanged |
| Booking financial/fulfillment boundary regression | 3 PASS; manual-fund reconciliation guard and no fulfillment from gateway capture | Same JSON; existing `server/test/phase3-booking-boundary.test.ts` unchanged |
| Existing password-reset/email-consumption regression | 90 PASS; offline guarded real-service suite | [auth-regression.json](../../output/phase5/identity-scope/auth-regression.json), existing `auth-consumption.test.ts` unchanged |
| Server strict TypeScript, including new test harness | PASS, exit 0 | `node node_modules/typescript/bin/tsc -p test/p5-tsconfig.json` |
| Client non-emitting TypeScript | PASS, exit 0 | `node node_modules/typescript/bin/tsc --noEmit --incremental false` |
| Server focused ESLint | 28 files; 0 errors, 0 warnings | [lint.json](../../output/phase5/identity-scope/lint.json) |
| Client changed/new UI ESLint | 10 files; 0 errors, 0 warnings | Existing Next ESLint configuration; explicit changed-file invocation |
| Prisma schema validation | PASS using explicit dummy loopback port-1 datasource; no environment-file discovery | `prisma validate --config test/p5-prisma.config.ts` |
| Migration + identity SQL syntax | PASS: migration file and 55 identity SQL templates | [sql.json](../../output/phase5/identity-scope/sql.json); cached local libpg-query, NULL/value and quoted-identifier substitutions. Syntax only, not execution/permission proof |
| Real PostgreSQL test | **SKIPPED**, not PASS | `server/test/p5-postgres.test.ts`; offline configuration forces execution approval false |
| Browser/MFA/mail/Google live flow | **NOT EXECUTED** | Needs migrated disposable runtime, private keys and separately approved delivery/OAuth environment |

The expected fixed `OperationError` log in a deliberate financial rollback test contains no submitted payload. No genuine provider SUCCESS or negative UAT was repeated. Historical 64 PostgreSQL/79 browser checkpoints were not rerun or relabelled as P5 evidence.

Reproduce offline checks from `server` with `tsc -p test/p5-tsconfig.json`, `vitest run --config test/p5-vitest.config.ts`, `prisma validate --config test/p5-prisma.config.ts`, and `node test/p5-verify-offline.cjs <existing-local-libpg-query-module-path>`. The offline Vitest configuration disables env-file discovery and forces live disposable execution off. No new PowerShell live caller was introduced; there is no claimed PowerShell execution-contract PASS for a nonexistent caller.

## Acceptance matrix

| Criterion | Status and limit |
|---|---|
| Four roles, additive migration, no automatic promotion | Implemented; schema/SQL validation PASS. Migration and regenerated disposable runtime NOT EXECUTED |
| Anonymous/unknown roles/forged role/privilege escalation | Offline HTTP PASS; current database role wins; no public SUPER_ADMIN grant |
| Customer ownership, department scope, unassigned/foreign Staff records | Offline actual-route PASS; SQL predicates and transactional guard implemented. Real PostgreSQL proof pending |
| Suspension, demotion/version invalidation and revocation | Offline PASS; transaction requests version/revocation/audit. Real concurrent revocation proof pending |
| Invitation expiry/replay/recipient and delegation bounds | Offline rejection/delegation/digest-only transport PASS; actual delivery, successful one-use activation and simultaneous consume SQL proof pending |
| Privileged MFA, replay and account-wide throttling/recovery | Offline HTTP + RFC6238 vectors + authenticated encryption PASS; actual PostgreSQL enrollment/concurrency/browser proof pending |
| Primary owner and compromised seed retirement | Provisioning component and mocked guard tests PASS; exact private owner identity, actual credential retirement and provisioning NOT EXECUTED |
| Audit and mutation boundaries | Governance, MFA/recovery, email/password recovery and scoped booking/inquiry/contact operations implemented. Immutable trigger syntax PASS; real trigger/rollback proof pending. Existing content/outbox services retain their existing operational logging under explicit ADMIN policy; this is not a claim of a new comprehensive cross-service immutable audit ledger |
| Minimal role-aware UI and compatible existing dashboards | Implemented; TypeScript/lint PASS. Real browser acceptance pending |
| Payment/security regression and historical preservation | Offline financial regressions PASS; historical financial files/migrations/generated client not modified; no new live reconciliation claimed |
| Batch final acceptance | **PARTIAL** until migration/runtime, real isolation/concurrency and browser acceptance evidence exist |

## Disposable PostgreSQL verification, migration and rollback

Prepared `server/test/p5-postgres.test.ts` and `p5-postgres.vitest.config.ts`. Do not run against the existing integration database. The pure guard requires an explicitly approved `flywithsafety_p5_disposable_<suffix>` loopback database, a matching `p5_<role>` restricted login, exact expected database/role/OID and a process-only connection URL. It explicitly rejects OID 34701 and never falls back to DATABASE_URL/DIRECT_URL or discovers credentials.

Before fixtures, the test verifies actual database/user/OID, non-superuser/non-CREATEDB/non-CREATEROLE/non-BYPASSRLS role, the exact nine completed migrations and empty User/Booking tables. It uses a fixed `pg_catalog,public` search path. Schema creation/migration/GRANT are **not** performed by this test.

The prepared transaction has at most two User inserts, one Booking, one Session, one identity account/session binding, one membership, one assignment and one audit insert, plus proof/revocation updates. It checks unassigned denial, assigned admission, current session loading, append-only audit rejection through a savepoint, version/session revocation and PENDING booking preservation. It always throws an exact controlled rollback sentinel and rechecks empty User/Booking tables. No deletion/cleanup, provider or mail call is included. Timeout: 5-second statements/connect, 20-second transaction and 45-second test. This test is a first database proof, not claimed complete concurrency/browser coverage.

Migration sequence after target designation/approval:

1. Confirm a **new disposable** target and approved restricted role; separately review provisioning privileges. Never use the protected historical DB or its credentials as a fallback.
2. Apply the eight existing migrations and the new additive migration to that disposable target under the approved migration scope. No seeds. New enum use follows migration commit.
3. Generate the matching Prisma client in the disposable build/workspace. Do not overwrite historical pinned generated runtimes to validate an old consumed caller.
4. Run the gated PostgreSQL test with the explicitly designated process-only URL and expected identity. Follow with the remaining real route/MFA/invitation concurrency and browser checks before batch acceptance. Do not infer these from mocked SQL tests.

Before first activation, leave the new flag unset/off. After activation, **do not use a blind flag-off rollback**: that could restore legacy broad Staff permissions. Restrict privileged ingress/login, revoke affected privileged sessions, retain all identity tables/audit/IDs/history, and restore only a reviewed authorization-compatible application build. No DROP enum/table, blanket role reset or historical data deletion is proposed.

## Activation and owner obligations

`IDENTITY_SCOPE_ENABLED=true` enables current-state identity checks. It has not been enabled by this work. A canonical base64 32-byte `IDENTITY_MFA_KEY` must be supplied privately to the isolated process; it is not generated, printed or stored in this report. Production key custody/rotation/recovery requires its separate release decision. Invitation submission requires explicit `IDENTITY_INVITATION_DELIVERY_APPROVED=true`, approved private mail configuration and a valid HTTPS frontend origin (HTTP allowed only for loopback development).

Treat the previously exposed seed identity as potentially compromised. Before any privileged rollout, privately identify exact affected user IDs, verify the named owner's identity/recovery access, rotate personal credentials through an approved private channel, revoke affected sessions and outstanding recovery credentials, verify controlled provider linking, and then provision/verify the intended primary owner. No shared password, old password reuse, automatic promotion or direct unverified-email flag update is authorized by this report. These account mutations have not been executed.

**Single next owner action:** provide a separately designated disposable local PostgreSQL target (database, restricted role and expected OID, with credentials through private configuration rather than chat) for the authorized additive migration and rollback-only P5 verification. No usable designated disposable target/credentials were supplied in this task. Keep the existing protected integration/Main Cloud environments unchanged.

## Integration readiness review — 2026-11-07

The owner has now designated `flywithsafety_p5_identity_scope_test` and `fws_p5_identity_app` at `127.0.0.1:5432`. This supersedes the earlier request to choose names; it does **not** establish that either resource exists or authorize its creation. Proposed separate DDL/owner login: `fws_p5_identity_migrator`.

### Observed readiness and narrow preparation

- Installed CLI: PostgreSQL **18.6**. Host-level service `postgresql-x64-18`: **Running**. Native `pg_isready`: **accepting connections** at the exact loopback endpoint. The first sandbox-restricted check could not establish availability; the host-level read-only check resolved that limitation without starting/restarting a service.
- Prior 49-pin source seal: **49 checked, 0 mismatches before this turn's edits**. That historical seal is preserved rather than overwritten. No general accepted suite was rerun.
- Corrected only the disposable target-name guard: it now also accepts the **exact** owner-designated DB/application-role pair at `127.0.0.1:5432`. Existing explicit expected-name/role/OID checks, no credential discovery, cloud/protected-OID rejection and no fallback remain. The legacy disposable pattern stays compatible; mixing its role with the new database is rejected.
- Focused target guard: **11 PASS, 0 FAIL**, including three new designation/port/mixed-role cases. Evidence: [target-tests.json](../../output/phase5/p5-integration-readiness-20261107/target-tests.json). These overlap the previous eight guard tests and must not be added wholesale to the earlier 193 as distinct coverage.
- Database/role conflicts: **NOT YET VERIFIED**. No maintenance password was supplied and no authenticated catalog connection was attempted. The readiness probe did not authenticate or inspect application data.
- Actual target OID: **NOT YET VERIFIED**. No OID is assumed or hardcoded. OID 34701 remains an explicitly forbidden protected target.
- Database creation, role creation, password setting, grants, migrations, fixture writes, isolated application/browser startup and rollout: **NOT EXECUTED**. P5 remains **PARTIAL**.

### Exact read-only conflict preflight

Use only the maintenance database `postgres` on `127.0.0.1:5432`, with the owner's maintenance identity authenticated through a private prompt. Do not load application `.env`, saved payment credentials, cloud URLs or default pgpass/service profiles. No password in command arguments, shell history, repository or result artifacts.

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SELECT current_database() AS maintenance_database,
       inet_server_addr()::text AS server_address,
       inet_server_port() AS server_port,
       EXISTS (SELECT 1 FROM pg_database
               WHERE datname='flywithsafety_p5_identity_scope_test') AS database_exists,
       EXISTS (SELECT 1 FROM pg_roles
               WHERE rolname='fws_p5_identity_app') AS app_role_exists,
       EXISTS (SELECT 1 FROM pg_roles
               WHERE rolname='fws_p5_identity_migrator') AS migration_role_exists;
ROLLBACK;
```

All three existence flags must be false before resource creation. Any conflict means STOP and report; do not adopt, alter, reset, drop, rename or change ownership of an existing resource. Repeat this catalog guard immediately before the approved CREATE statements to close ordinary review-time drift; a concurrent CREATE conflict must also stop rather than retry.

### Concrete owner approval scope — setup and migration only

Approval is requested for the following exact conditional scope; it has not been executed:

1. Authenticate privately to the local `postgres` maintenance database; run the read-only conflict preflight above. If endpoint/identity/conflict checks fail, perform no CREATE.
2. Create **exactly two new roles**, initially NOLOGIN, without membership in any existing role:

   ```sql
   CREATE ROLE fws_p5_identity_migrator NOLOGIN NOSUPERUSER NOCREATEDB
     NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
   CREATE ROLE fws_p5_identity_app NOLOGIN NOSUPERUSER NOCREATEDB
     NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
   CREATE DATABASE flywithsafety_p5_identity_scope_test
     OWNER fws_p5_identity_migrator TEMPLATE template0 ENCODING 'UTF8';
   ```

   Role creation may be transactionally grouped; CREATE DATABASE is a separate operation and cannot share that transaction. Stop and preserve any partial new NOLOGIN resources on failure. No automatic DROP or cleanup.
3. Set **distinct nonempty private passwords** for these two technical roles through masked/private input, not SQL files or command arguments. Enable the migration-role LOGIN only after private setup succeeds; keep the application role NOLOGIN until its ACLs are verified. No old seed/shared password reuse and no password changes to existing roles. The migration role owns only the new target; it receives no cluster-wide CREATEDB/CREATEROLE/superuser capability.
4. Revoke PUBLIC access on the **new database only**, grant the app CONNECT, and revoke PUBLIC CREATE on its public schema. The app gets schema USAGE and no DDL/schema ownership, role memberships, TRUNCATE or grant options. No ACL changes to another database or existing role.
5. Connect explicitly to the new target; query `current_database()`, current role, server address/port and `pg_database.oid::int`. Record the **actual OID** and verify it before every migration/test entry. Refuse OID 34701, any name/role mismatch, pre-existing application objects or nonempty adopted data. Preserve a creation receipt bound to this exact DB/owner/OID.
6. Apply exactly the **eight existing baseline migrations plus `20261107000100_identity_scope`**, pinned to their reviewed file hashes, only on that fresh empty target. No seed or `db push`, shadow database, schema reset, migration repair, `--accept-data-loss` or automatic retry. The second historical baseline drops its bootstrap Post table/sequence and changes User; this is accepted only as bootstrap replay on the newly created empty DB, never on protected data. The P5 migration itself is additive. Review all nine completed migration names/checksums afterward.
7. After migration, grant application SELECT on the target's application tables and `_prisma_migrations`. The INSERT/UPDATE/DELETE whitelist is exactly: User, Account, EmailVerificationToken, PasswordResetToken, Session, IdempotencyRecord, Destination, Package, VisaInfo, FlightInquiry, HotelInquiry, PackageInquiry, VisaInquiry, ContactMessage, Testimonial, Booking, BookingPassenger, NotificationOutbox, IdentityAccount, IdentitySession, IdentityMembership, IdentityAssignment, IdentityInvitation and IdentityMfa. IdentityAudit and GatewayPaymentEvent are SELECT/INSERT only; BookingStatusHistory is SELECT/INSERT; GatewayPayment is SELECT/INSERT/UPDATE; GatewayRefund is SELECT only for this no-refund scope. All these names refer only to the new target's public schema. No migration-metadata writes, audit/event/history deletes, broad function EXECUTE grants or ownership transfer to the app. Verify the exact resulting ACLs and restricted role flags before fixture tests.
8. Enable the application-role LOGIN only after private password and ACL setup; verify its private connection and exact DB/role/actual-OID identity. Close maintenance/migration connections. Save only sanitized flags, OID, migration hashes/results and privilege checks.

This initial approval **does not execute synthetic fixture writes or start browser/application runtimes**. Those acceptance tests remain in the requested work queue and will use this target after the setup result and exact fixture/write bounds are verified. No financial provider operation, public tunnel, normal frontend/backend restart or production flag change is part of setup.

Each connection/statement is bounded (5-second connect, 5-second preflight statements; migration statements at most 30 seconds with a bounded parent deadline). A failure stops the stage and preserves the first sanitized cause; no automatic retries, privilege escalation or destructive rollback.

For the later browser phase, use separate loopback frontend/API ports with an isolated build, this exact runtime role/DB/OID and process-only MFA key. Keep normal 3000/5000 and their database configuration untouched. Mock SSLCommerz transport only; no real gateway, SMTP or Google calls. Individually generated synthetic account credentials and a local test mail sink will support invitation/MFA flows without production accounts or shared passwords. Browser and PostgreSQL acceptance remain unclaimed until executed.

**Immediate owner decision:** approve the conditional two-role/new-database/restricted-grants/nine-migration setup scope above. Passwords must subsequently be supplied privately; never paste them into chat.

## 2026-11-07 — Confirmed identity recovery and v06 setup review

This entry supersedes the earlier setup-readiness action only. P5 acceptance remains **PARTIAL**, with setup, real PostgreSQL integration and browser acceptance still pending. No setup execution is authorized by this report update.

### Actual approved read-only observation

Evidence: `output/phase5/p5-identity-readonly-20261107-01/identity.txt` and its consumed `attempt.json`.

| Property | Observed result |
| --- | --- |
| Maintenance database / current and session role | postgres / postgres / postgres |
| `inet_server_addr()::text` | 127.0.0.1/32 |
| `host(inet_server_addr())` | 127.0.0.1 |
| Numeric server port | 5432 |
| Maintenance database OID | 5 — NOT the future P5 database OID |
| Transaction read-only | on |
| Required database, role, session role, host and port comparisons | all true |
| Original address-string comparison | false |
| Transaction completion | ROLLBACK observed |

The address representation defect is now confirmed against the exact approved endpoint. Historical v05 did not retain its identity row; this new observation does not retrospectively invent that missing row. v05's unknown operation counters remain unknown. No additional live connection was made during v06 preparation.

### Minimal v06 correction and preserved boundaries

Candidate: `server/test/p5-setup-v06/Invoke-ApprovedSetup-v06.ps1 -OwnerApprovedSetup`.

Runtime change: only replace `inet_server_addr()::text AS address` with `host(inet_server_addr()) AS address`; version the output directory, private Windows Job type and caller receipt to v06. The original strict identity/OID and password policy module is byte-identical. No CIDR trimming, broad host acceptance or guard removal.

Preserved setup scope: local 127.0.0.1:5432; maintenance postgres; new database `flywithsafety_p5_identity_scope_test`; new runtime `fws_p5_identity_app`; new migrator `fws_p5_identity_migrator`; exactly eight baseline migrations plus `20261107000100_identity_scope`. Fresh name-conflict, ownership, empty-database, actual-OID, exact migration checksum, role flags and least-privilege ACL checks remain fail-closed. Current target availability and future target OID are NOT established by the identity diagnostic.

Credentials remain private masked input and process stdin, never arguments, report values or database URLs in artifacts. Existing maintenance password keeps its separate policy. Each new role password remains distinct and subject to the unchanged 20–128 printable non-space ASCII upper/lower/digit/symbol policy and confirmation. The caller validates before starting its contained child. The reviewed 345-second parent, 330-second child and 240-second migration bounds remain unchanged.

Stop on conflicts or any failure, retain partial resources/evidence, no automatic retry, migration repair, destructive cleanup, adoption or privilege broadening. No cloud/protected database modification, fixtures, real gateway/supplier calls, browser startup, normal service restart or rollout. Any later test writes/browser acceptance require their own reviewed scope.

### Focused offline verification

- 43/43 Node tests PASS: 30 unchanged password regressions plus 13 address, strict identity/OID, live-evidence and complete setup-contract tests.
- 29/29 native Windows PowerShell 5.1 synthetic prompt/private-wire checks PASS; test endpoint prevents network use.
- Four native PowerShell files parse; owned Windows Job type compiles and disposes successfully.
- Strict TypeScript check for the isolated Prisma config PASS; all five candidate CommonJS files pass ESLint with zero errors/warnings.
- 38 setup SQL templates and all nine migration files parse offline; this is syntax verification, not migration execution.
- Node syntax, manifest/runtime resolution, invocation, historical preservation and unused-attempt verification are recorded in `output/phase5/p5-v06-preparation-20261107/offline.json` after the final seal.

The pre-update implementation report is archived byte-for-byte at `server/test/p5-setup-v06/implementation-report-before-v06.md`, retaining the exact hash required by the historical v05 manifest. All consumed callers, manifests, attempt markers and historical results remain unchanged. The new v06 manifest deliberately binds this updated report and that historical snapshot separately; historical report bytes must not be compared to the newly appended live document as if they were unchanged.

**Single next approval:** exactly one corrected v06 conditional isolated setup/migration execution, using the final SHA-256 guard supplied with the sealed offline result. That approval does not extend to integration fixtures, browser testing or production rollout.

## 2026-11-07 — v06 setup confirmed; approved integration execution boundary

The owner's attached P5 final integration request explicitly authorizes synthetic data and browser acceptance on **only** `127.0.0.1:5432/flywithsafety_p5_identity_scope_test`, runtime `fws_p5_identity_app`, expected OID **35402**. This supersedes the earlier pending setup-approval action. It does not authorize recreating resources, migrations, external services, production rollout or protected databases.

### Verified saved execution evidence

`output/phase5/p5-approved-setup-20261107-06/result.json`: passed=true; stage=setup-and-migration-verified; OID=35402; nine completed migrations; four roles, six departments, 29 application tables, 23 identity constraints, nine identity indexes; audit trigger present and all application tables empty at setup completion. This is **saved setup evidence**, not a fresh live identity or current-empty-state claim.

The 4,348 v06 source/runtime file pins matched before this report update. The exact pre-update report is retained as `server/test/p5-integration/implementation-report-before-acceptance.md`, preserving its historical v06-pinned bytes. Consumed v01–v06 callers/results remain unchanged. No protected or cloud database was connected during this turn.

### Credential-gated execution prepared

`server/test/p5-integration/Invoke-Integration.ps1 -OwnerApprovedIntegration` accepts only the existing runtime-role password through a private masked console prompt. No maintenance or migrator secret is needed for this step. Password input is UTF-8/base64 JSON over redirected process stdin; the test connection URL exists only in process memory/environment, never a repository/private plaintext credential file, command argument or artifact. A contained Windows Job owns the child tree; 100-second child and 110-second parent deadlines apply. No automatic retry.

Before fixture writes, a native server-enforced READ ONLY transaction verifies exact DB/current-role/session-role/host/numeric-port/OID, non-administrative role flags, all nine migration names/checksums, exact runtime ACLs against the saved successful setup receipt and empty application tables. Any mismatch stops. The future test is not permitted to adopt existing populated data.

Only after preflight passes, this initial scoped execution runs the existing previously skipped `p5-postgres.test.ts`: real Prisma/PostgreSQL session, department/assignment scope, audit append/immutability, authorization invalidation, PENDING booking and rollback preservation. Its synthetic two-user/one-booking/one-session setup is inside one rollback-only transaction, with no committed fixtures or DELETE cleanup. Afterwards a new native READ ONLY transaction rechecks identity, migrations, ACLs and empty-table preservation, then rolls back. Raw test stdout/stderr are not persisted; only sanitized aggregate counts/exit and guard/SQLSTATE evidence are recorded. This is **one integration test**, not complete API/browser acceptance.

### Actual verification this turn

- Eleven new exact-target guard tests PASS, zero failures.
- Strict P5 TypeScript check PASS.
- New runner/test ESLint: zero errors/warnings. Node syntax, native PowerShell 5.1 parsing and identity SQL offline parsing PASS.
- Existing 193-test and financial-regression evidence has not been relabeled as a new run. Historical SUCCESS/FAILED/CANCELLED and CANCELLED-IPN qualifications remain unchanged.
- Live target preflight, actual PostgreSQL test and browser acceptance: **NOT EXECUTED in this turn**. The required runtime secret is intentionally unavailable to the agent and must be entered privately by the owner. No new database connection, fixture write, application launch, browser launch or provider request has occurred.

### Acceptance matrix

| Requirement | Status / evidence |
| --- | --- |
| Isolated setup/migrations/schema/grants | PASS from saved v06 setup receipt; current live verification pending |
| Exact current DB/role/OID before writes | BLOCKED on private runtime credential input |
| Previously skipped PostgreSQL rollback test | Prepared for approved execution; NOT RUN |
| Full real-route four-role, invitation/MFA, suspension/demotion and ownership acceptance | PENDING; existing rollback test alone is insufficient |
| Four-role browser E2E and direct unauthorized requests | PENDING; no actual browser result |
| Financial/idempotency regressions and historical preservation | Prior accepted evidence retained; final scoped integration regression evidence still required |
| Production activation | NOT AUTHORIZED |

**P5-IDENTITY/SCOPE verdict: PARTIAL.** No new approval is requested for the already authorized isolated test scope. The immediate owner intervention is private runtime-password entry using the sealed integration command. Full P5 acceptance and the wider Phase 5 roadmap are not claimed complete.

## 2026-11-07 — Integration output-contract recovery (no live rerun)

### Confirmed cause and historical limitations

Consumed evidence: `output/phase5/p5-integration-20261107-01/result.json`. Native READ ONLY preflight verified exact DB/runtime/session role/127.0.0.1:5432/OID35402, non-administrative role flags, nine migration checksums, saved ACL equality and initial empty application tables before reaching the test stage.

The output-contract defect is confirmed. `server/test/p5-integration/run.cjs:36` unconditionally JSON-parses stdout; line 34 discards stderr; exit code is copied into the result only after parsing succeeds. Installed Vitest **5.0.3** `JsonReporter.onTestRunEnd`, in `server/node_modules/vitest/dist/chunks/index.DpLw24bj.js:17960–17964`, writes a default cached report and prints a notice unless stdout reporting is explicitly selected. An offline reproduction with DB execution disabled returned exit 0 and stdout `JSON report written to .../test/.vitest/json/output.json`, not JSON. This proves the incompatible wrapper/reporter contract; the historical stdout bytes themselves were not saved and must not be invented.

The historical child was launched and its close callback reached (otherwise the observed parse guard cannot be raised). Its native exit/signal, actual test outcome, database reach, fixture-write stages and rollback completion were NOT preserved. They remain **UNKNOWN**. `postgres:null` is not a failed database test. `rollbackPreservation:false` means the final observation was not reached: the original runner places it after the rejected execute promise at line 44. It is not proof of leaked fixtures or successful rollback.

Evidence-handling incident: the initial offline reproduction was started before preserving the default Vitest cache and wrote that cache's output.json. This was avoidable. The resulting cache reports an offline skipped test and is NOT evidence of the consumed live execution. No prior-cache snapshot is available in the inspected execution artifacts. Consumed callers, the original PostgreSQL test/config and the three saved integration artifacts remain unchanged and are sealed in `output/phase5/p5-integration-recovery-20261107/consumed-seal.json`.

### Permission review and minimal correction

The saved successful v06 grants authorize the rollback test's SELECT/INSERT/UPDATE operations on User, Session, Booking, IdentityAccount, IdentitySession, IdentityMembership and IdentityAssignment, and SELECT/INSERT on IdentityAudit. IdentityAudit UPDATE is deliberately denied; the test expects rejection and rolls back to its savepoint. That test demonstrates restricted-role update denial, not independently that the immutable trigger fired. No privilege failure is proven by the old result and no GRANT/role/schema change is justified or prepared.

New candidate: `server/test/p5-integration-v02/Invoke-Integration.ps1 -OwnerApprovedIntegration`, output `output/phase5/p5-integration-20261107-02/`. This is an integration correction, not another database setup.

- New Vitest config explicitly uses `reporters: [['json', { stdout: true }]]`; the runner no longer overrides it with `--reporter=json`. It does not create/read a default cache report or persist raw reporter messages.
- Native child exit, signal, stream byte counts and predefined diagnostic booleans are saved before strict JSON/schema/count parsing. Nonzero exit, skipped, empty, malformed or inconsistent results cannot become PASS.
- The instrumented copy of the original rollback test records only allowlisted stages and sanitized Prisma/SQLSTATE/native codes: database identity, migrations, transaction entry, writes reached, scope denial/admission, audit denial, invalidation, rollback and final empty-state observations. No credentials, connection URLs, fixture IDs, payloads or error messages are recorded.
- The independent final native READ ONLY identity/migration/ACL/all-application-table count check now runs after a completed preflight even if test execution/report parsing fails. First test failure and preservation failure are separate fields. No preservation PASS is inferred from missing fields.
- Exact OID35402, DB/runtime role, endpoint, safe role flags, nine migration checksums, original restricted grants, initial empty-state refusal, 2MB stdout cap, one-time receipts, 100/110-second deadlines, owned process tree and no-retry/no-cleanup behavior remain. No raw Vitest report is used as financial authority.

### Focused offline evidence

- **28/28 Node regression tests PASS** (11 unchanged identity guard cases and 17 output/exit/count/security contract cases).
- **Three installed-Vitest synthetic reporter scenarios verified**: pass→exit0/one passed; intentional failure→exit1/one failed; skip→exit0/one skipped. Only the first is accepted by the aggregate contract. The intentional failure/skip are infrastructure fixtures, not PostgreSQL acceptance results.
- Exact corrected PostgreSQL config also loaded offline with execution approval=false: one skipped, zero passed, no PostgreSQL test executed. Explicit stdout JSON parsed successfully. Later offline reporter runs left the default cache unchanged.
- Strict TypeScript PASS; nine CJS/TS files lint with zero errors/warnings; ten SQL templates/control statements parse offline; native PowerShell 5.1 parsing, containment-before-private-stdin order and owned Job compile/dispose PASS. Final hashes and integrity results are saved in the recovery offline receipt.
- No new database connection, fixture write, migration, provider/supplier request, tunnel or browser execution occurred in this correction.

### Current acceptance and next authorized boundary

P5 remains **PARTIAL**. Saved setup and the consumed run's native preflight are PASS. Historical rollback-test outcome and post-run database preservation are UNKNOWN; real API/four-role/browser acceptance remains pending. No accepted Phase 0–3 or historical payment/IPN qualification was changed.

One fresh live integration invocation is necessary on the currently available evidence. The user requested separate authorization for this corrected invocation: approve the exact newly sealed caller for the same isolated target, native READ ONLY preflight, one rollback-only test and final READ ONLY preservation observation. Existing runtime password goes only into the private console; no maintenance/migrator secret is needed. No resources, migrations, grants, browser process or external provider call are included. On any failure preserve evidence and stop; do not rerun either consumed integration/setup caller.
