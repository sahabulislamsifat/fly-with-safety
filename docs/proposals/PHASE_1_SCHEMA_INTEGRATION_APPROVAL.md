# Consolidated local Phase1 schema execution — prepared, awaiting owner approval

Package: C:\Users\sahab\.codex\visualizations\2026\10\21\01a15fd3-69ff-7843-bea7-539c3d6111f9\phase1-schema-execution-20261029-01.
Caller Invoke-Phase1Schema.ps1 SHA256: eae7f2d8683358a203cf94f2a86bcfcf2fc54d34576d48e1d6637efd40ae1202.
The package contains pinned SQL/config, execution-pins.json and package.review.json.
This supersedes the earlier prerequisite-only ticket; one owner approval now covers
the exact new database creation, baseline and additive/constraint sequence below.
No execution is authorized merely by preparing this document.

## Exact scope and operation order

Target ONLY 127.0.0.1:5432/flywithsafe_phase1_schema_integration, PostgreSQL18.6,
owner/operator postgres. Existing G3/development/integration/production databases
and roles are preserved. Current target absence and live isolation are UNVERIFIED;
first administrator READ-ONLY identity/absence guard must pass before mutation.

1. Verify caller, manifest, installed node/psql/Prisma7.10.0/engine, active schema,
   migration lock and exact seven migration names/SQL hashes. New immutable attempt
   marker uses exclusive CreateNew; existing marker/result stops without overwrite.
2. Private administrator read-only preflight on postgres: exact local server,
   admin/version and target absence. Capture a hash of existing database ACL/owner
   and role/membership metadata (no password fields).
3. CREATE DATABASE only the named target, OWNER postgres, TEMPLATE template0,
   ENCODING UTF8, initially ALLOW_CONNECTIONS false. Revoke PUBLIC access before
   enabling target connections. REVOKE ALL ON DATABASE target FROM PUBLIC; REVOKE ALL ON SCHEMA
   public FROM PUBLIC only inside this new database. No other grants/roles change.
   Verify empty new target and admin-only explicit ACLs. Cluster superusers retain
   their inherent authority; isolation does not purport to remove that authority.
4. Read-only Prisma migrate status must report exactly the seven pinned pending
   names; execute migrate deploy exactly once into this new database only. The
   current G3 migrations are not repeated on G3. Confirm completed seven-history
   checksums and empty20-table baseline with the pinned read-only preflight.
5. Apply only four copied/pinned drafts in order: protected-schema, replay-recovery,
   compatible-worker, contracts. Each file commits separately; the complete
   operation is NOT atomic. Preserve any committed prefix on failure.
6. Read-only catalog/empty-state postcheck:28 tables/eight sidecars,12 sidecar FKs,
   two deferred cyclic FKs, nine named triggers, seven purpose/query indexes,
   completed baseline history and zero application/sidecar rows. Catalog definitions
   are emitted for review; names/counts alone are not final semantic acceptance.
7. Execute only phase1-constraints.rollback.review.sql once: fixed phase1_probe_*
   synthetic rows, no SMTP/KMS/network operations, top-level ROLLBACK. Probe covers
   cyclic binding, active uniqueness, receipt completion/immutability/subject FK,
   enrollment marker, terminal job/intent and passenger ownership/revision fences.
   It is not multi-connection service/concurrency/crash proof.
8. Final read-only clean-state, ACL and pre-existing metadata preservation checks.
   Preserve sanitized stage output, actual exits and result.json. Further review
   is required even after the execution-pass marker.

## Manual execution and safety

Windows Administrator is NOT required. PostgreSQL postgres administrator authority
IS required for CREATE DATABASE/SQL. Use the existing visible Windows PowerShell5.1
console with effective RemoteSigned; no new window or policy bypass. Run the exact
hash-guarded block in FOREGROUND_AFTER_APPROVAL.txt only after owner authorization.
It asks once for the existing postgres password privately, then uses ephemeral
child-only credentials; no password in argv, project files, logs or chat.

Offline inspection command, which cannot connect or create an attempt marker:

    & '<package-directory>\Invoke-Phase1Schema.ps1' -Action Offline

Live foreground command is the complete pinned block in the package text file,
ending with -Action Execute -OwnerAuthorized. Do not manually run individual SQL,
old G3 callers or generic Prisma commands. Report actual final marker/exit and
sanitized stage summary after the authorized attempt; never send credentials.

Only fixed status/deploy Prisma commands and pinned psql files are reachable.
Child environments discard ambient PG/Prisma/dotenv/database URLs/node/debug/
proxy overrides; config has an explicit local target, no .env fallback and native
read-only/5s statement+lock startup settings. Installed engine is hash-pinned.
A120s child deadline terminates only that started child process tree on timeout;
no PostgreSQL server or unrelated process is terminated. Read-only preservation/
clean diagnosis may follow failure, never another mutation or scenario. No retries,
reset, resolve, push, seed, repair, broad cleanup, drop, marker deletion or policy
change. The new database remains for review even after failure. Uncertain outcome
or committed prefix needs separate diagnosis/recovery authorization.

## Single approval request

> I authorize ONE guarded execution of the reviewed package/caller hash above on
> 127.0.0.1:5432. Create only flywithsafe_phase1_schema_integration owned by postgres;
> restrict only this database/public-schema PUBLIC ACLs; deploy only the seven
> pinned baseline migrations there; apply only the four pinned additive SQL files;
> run the exact rollback-only synthetic constraint probe and read-only postchecks.
> Permit only owned child-tree timeout cleanup and sanitized evidence capture.
> Preserve all existing databases/roles/G3 evidence. No automatic retry/repair,
> enrollment/cutover activation, service-role grants, live G3-X/C16, external
> provisioning, production activation or deployment.

Actual restricted-role service/enrollment/replay and concurrent receipt/lease/
intent/passenger-CAS/crash/cutover verification follow accepted schema/catalog
review under their next exact role/fixture-ledger authorization. No such proof is
claimed by this initial administrator constraint package.

## Hosting/KMS decision, checked29Oct2026

Recommendation (engineering judgment): evaluate a single-cloud GCP staging stack
first: containerized Express on Cloud Run, Cloud SQL PostgreSQL and Cloud KMS with
separate user-managed runtime identities. Cloud Run supports containerized Node;
its service identity obtains API credentials without a private key file. Existing
interval workers need an explicit worker pool/job or reviewed scheduling, not an
assumption of uninterrupted CPU in an HTTP instance. Regional compute, database,
backups, logging, egress and continuous worker capacity must be budgeted; this is
not a free-stack estimate. Software KMS AES256 active versions are about USD0.06/
month plus USD0.03/10000 symmetric operations. Singapore asia-southeast1 is a
candidate region, not a selection or processing/transfer approval. Confirm exact
engine/version/availability, all service locations and a full calculator estimate.
Sources: https://docs.cloud.google.com/run/docs/securing/service-identity ;
https://docs.cloud.google.com/run/docs/container-contract ;
https://docs.cloud.google.com/run/docs/deploy-worker-pools ;
https://cloud.google.com/run/pricing ; https://cloud.google.com/kms/pricing ;
https://docs.cloud.google.com/kms/docs/locations ;
https://docs.cloud.google.com/sql/docs/postgres/db-versions .

Alternative: Render Express web service + separate worker + Render Postgres,
with federated access to AWS KMS. Paid compute/DB/worker plus an OIDC-capable Pro+
workspace and cross-cloud operations/egress add separate costs. AWS customer-
managed symmetric KMS keys start USD1/key/month plus request/rotation costs.
Render managed OIDC uses rotating per-service identity, avoiding long-lived AWS
keys. Singapore is available on Render; review all storage/backup/support regions
and actual selected plan/version. Avoid deciding from the cheapest headline tier.
Sources: https://render.com/docs/service-types ; https://render.com/pricing ;
https://render.com/docs/oidc ; https://render.com/docs/regions ;
https://aws.amazon.com/kms/pricing/ .

Owner decision batch: staging provider/runtime and monthly budget; PostgreSQL,
KMS, logs/mail/backups locations; staging project/account ownership/billing;
separate deployer, auth issuer, delivery worker, authorized passenger reader and
external recovery-authority identities with scoped trust/issuer/audience and
purpose/key-specific permissions (no generic decrypt-all or permanent runtime
admin credentials). Cloudflare domain/DNS does not imply Workers runtime.
Provider accounts and secrets are set up manually later. No provisioning occurred.
All14 units, G3-X/stronger-evidence gaps, actual F01-F07/G4-G6 and G7 remain gates;
Phase2 is unauthorized.


## Recovery — 2026-10-30: committed prefix, fourth-file continuation only

The original create-and-baseline authorization is spent. NEVER rerun its caller. Original result.json stoppedStage=additive-4, SQL exit3; additive1/2/3 logs each contain COMMIT and exit0; seven baseline deploy/postcheck exit0. Failure-existing-preservation exit0. Attempt started 2026-10-30 01:27:48 Asia/Dhaka (stored UTC2026-10-29T19:27:48.9052962Z); result file last-write UTC19:28:16. Fourth log has BEGIN and no COMMIT: a failed explicit transaction followed by psql termination implies rollback, but actual catalog rollback confirmation remains unverified. No constraint probe ran.

Root cause: final protected_job_fencing branch ended OLD."leaseUntil')) THEN instead of OLD."leaseUntil")) THEN. Canonical SQL corrected by exactly one character; no predicate, timeout, privilege or transaction scope changed. The previously passing static tests did not parse PL/pgSQL; new regression rejects the actual malformed body and checks quote balance. Offline lexical checks are not PostgreSQL syntax/execution proof.

One new package: phase1-schema-continuation-20261030-01 in the same private visualization root. It contains corrected SQL, original byte-identical rollback probe/final catalog/ACL/preservation SQL, and a fixed psql-only caller. Original package, markers, result and logs are hash-preserved.

1. Run FOREGROUND-RECONCILE.txt manually in visible PowerShell5.1: only administrator read-only sessions. It verifies original other-database/role metadata fingerprint, exact local18.6 target, owner and ACL, no other target sessions, seven exact migration checksums, 28 empty tables including the8 expected sidecars,12 sidecar FKs/2 deferred cycle FKs,5 prefix triggers/functions and source bodies, file3 createdAt column, and absence of fourth-file effects. Inventory is printed before structural checks for precise discrepancy review. Catalog definitions still need review against the three committed source files. No mutation or probe in Reconcile mode.
2. If reconciliation and definition review pass, request ONE continuation authorization: apply only guarded corrected fourth SQL in its own transaction; readonly catalog; original rollback-only constraint probe; final clean/ACL/existing-metadata preservation checks. No creation, Prisma command, baseline or first-three replay, grant, enrollment, activation or G3-X. Continue requires a successful recorded Reconcile result and repeats guards (including prefix checks inside the DDL transaction). Any mismatch stops; no repair/retry. Reconcile/Continue use separate atomic attempt markers and mode-prefixed logs.
3. Use FOREGROUND-CONTINUE.txt ONLY after separate owner mutation approval. Prior authorization does not transfer to this continuation. Caller SHA256: 4a64dc379b941705580fb010f8441d644779963f631a050b3e27c936b24e32a8. Corrected SQL SHA256: f8694d09935f64896d89dcb2b9019d009b1129e0fe389c810c563efad234da0d. Native Windows admin elevation is not needed; existing postgres password only in private console.

Next service gate remains distinct from the administrator constraint probe: a separately approved least-privilege service role must exercise actual protected-auth/issuance-replay and compatible/protected outbox PG adapters, with competing same-request issuance (one durable receipt), concurrent token consumption (one winner), rollback (no orphan credential/job/session), revocation versus consumption, lease/version CAS and stale completion rejection, send-intent/ambiguous redrive denial, enrollment retirement and recovery-epoch denial. Exact-record fixtures and final clean proof are required; no broad cleanup. Provider-neutral test doubles can isolate DB properties but cannot close real KMS/IAM requirements. This suite/role activation is still pending, not claimed delivered or approved here.


### Read-only replacement identity02 — 2026-10-30

Identity01 reconciliation is spent (psql3/caller1). DO $$ was reduced to DO $ by JavaScript replacement-string substitution during generation. Fresh phase1-schema-reconcile-20261030-02 fixes only that SQL delimiter, retains all checks, and exposes no mutation mode.73 static/lexical/integrity checks and8 native PS fake-process checks pass; PostgreSQL parser execution remains unperformed. Requires explicit ONE read-only attempt authorization before FOREGROUND-AFTER-APPROVAL.txt is executed. Do not reuse identity01. Read-only pass plus actual catalog review must precede repinning/authorization of the fourth-only mutation continuation.


### Accepted catalog and fourth-only continuation — 2026-10-30

Identity02 saved result passed=true, every stage0, final readonly ROLLBACK. Catalog ACCEPTED for continuation:28 tables/47 sidecar columns/98 indexes;12 sidecar FKs including2 initially deferred cycles;5 expected triggers and function-body fingerprints matched the exact first-three sources. Prefix guards verified empty application tables,7 exact completed migration hashes, expected ownership/ACL/isolation and absence of fourth-file column/functions/triggers/indexes/constraints. Existing catalog preservation before/after0. Thus committed prefix1–3 and rolled-back fourth effects are accepted at observation time; fresh guards repeat before mutation.

New package phase1-sql4-continuation-20261030-01 pins successful identity02 result/catalog and acceptance record. Only corrected fourth SQL, guarded in its transaction, then original rollback-only constraint probe and final readonly catalog/clean/access/existing-preservation checks. No database creation, Prisma/baseline or successful1–3 replay, grants, production activation or automatic repair. SQL4 commit and probe are separate; failure may leave SQL4 committed. Old artifacts/markers untouched. Final static/integrity/lexical42 PASS; native PS5.1 parsing/Offline and fake-process8 PASS. Inherited guard delimiter defect caught offline and regenerated by concatenation using the live-verified readonly guards; no textual dollar substitution. No server-side parsing of corrected fourth claimed yet.

Requested authorization: ONE guarded SQL4 continuation on127.0.0.1:5432/flywithsafe_phase1_schema_integration aspostgres; corrected fourth only, rollback-only probe, final readonly checks. Stop on failure; no retry/repair/reset/other rights. Caller SHA256 be4a81a9b7a7f0e05c0dbab7c0077aac46eaf3ef31b0538cd0ffb43c9fe935e0. Run FOREGROUND-AFTER-APPROVAL.txt only after explicit approval, existing private PS5.1 console.


### Committed SQL4 envelope validator patch — separate authorization pending

SQL4 is committed and MUST NOT be replayed. Existing snapshot catalog/failure-clean PASS; original constraint probe failed at runtime because ciphertext regex bound5500 exceeds PostgreSQL255. Fresh source corrected to explicit character length1..5500 and disallowed-character rejection. Only replacement function changes; constraints remain attached. New package phase1-envelope-fix-20261030-01 pins old live-stage evidence, canonical source, patch/probe/final SQL and executable hashes. Exact old source+metadata must match; same-transaction25 boundary checks must pass before patch COMMIT. Then rerun byte-identical rollback-only probe and final readonly catalog/clean/ACL/existing metadata checks; stop on failure. No create/baseline/SQL4/grants/activation/retry. Caller SHA256 edec33e3199c6c68ba1e24a870ee8dc5a066361e62a1a753299df0b281bfbe4d. Offline53+fake8 and88 relevant regressions per loader PASS, TypeScript0. SQL engine boundary results remain pending. Requested ONE owner authorization covers this function replacement, its value assertions, original rollback-only probe and final checks only. Use FOREGROUND-AFTER-APPROVAL.txt manually after approval; private existing postgres password; no new window.


### Fresh service-role setup identity02 — accepted effective-access model

Actual six-database metadata review accepted for local synthetic-only tests: role absent; no PUBLIC application table/column/function/schema-create or foreign/large-object/mapping exposure; residual CONNECT/TEMP documented. No complete connection isolation; other-database temporary objects may be possible. Target denies CREATE/TEMP and application-object access remains scoped. Fresh private package phase1-service-role-20261030-02 preserves historical failed SQL/markers and removes only the blanket CONNECT blocker in its copied role SQL. Source exact-delta verified. Caller revalidates role absence/DB set and object access before role mutation; new exposure stops. Role S/I/U6 tables + quarantine SELECT + envelope function EXECUTE; no target DELETE/DDL/admin/membership/grant options. Private password and LOGIN, admin postchecks; actor authentication/fixtures not automatically run.

Requested ONE new setup authorization, with acknowledged residual local PUBLIC CONNECT/TEMP. Caller SHA256 abb9c458b295d718d4eadda401b4bd072853dd1a1c4563a09b67d7288ef3941e. Use FOREGROUND-AFTER-APPROVAL.txt only after approval in existing PS5.1 console. Prompts: existing postgres for readonly revalidation, existing postgres again for setup, NEW named service-role password twice. No retry/repair; role setup/password/LOGIN have separate commits, partial state preserved on failure.27 static/integrity/lexical checks and11 native fake-process checks PASS; no live setup performed.


### Exact service-fixture cleanup — owner authorization pending

Actual service proof6 PASS, exit0. Four ledger entries produce3 persisted bundles plus1 rollback user. New private package phase1-service-cleanup-20261030-01 reuses exact teardown generator and original predicates; only6 target tables,3 rows each (18 total). Before any DELETE, guarded transaction validates exact linked fixture tuples/global counts, synthetic email/CUSTOMER ownership, absence of rollback/unrelated/other-table rows and unexpected DELETE triggers/rules, plus persisted outcomes; FK-safe ordering with deferred cycles, each affected count3 enforced, final emptiness and metadata fingerprint preservation before COMMIT. Then readonly accepted catalog/clean/access checks. Unexpected state stops/rolls back; no repair/retry. No role grants/DDL/other DB mutation. Actual current counts not yet read; guards enforce them during approved execution. Caller8617fbf9f69b4df0010e2602597ec755e43302c4c0ce19293cc8dadfacd1034e.29 static+8 fake checks PASS, native parsing/Offline0. Requires explicit ONE admin deletion authorization and private console execution via FOREGROUND-AFTER-APPROVAL.txt. Do not rerun service suite to clean up.
