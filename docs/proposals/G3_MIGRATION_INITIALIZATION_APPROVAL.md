# G3 Migration Initialization Approval Package

> **Current governance (owner-directed 2026-10-28):** [Tracker section 0](PHASE_1_INTERIM_STATUS_AND_EXIT_CHECKLIST.md#0-governing-owner-decision--2026-10-28-supersedes-prior-engineering-gate-wording) supersedes older bespoke legal-checklist and automatic counsel-signature requirements for G7 engineering acceptance. All technical controls remain mandatory. Real-data/production activation remains separately gated. Dated findings and acceptance evidence below are preserved, not re-certified.


Date: 2026-10-26. Status: **READ-ONLY PREFLIGHT PASS; MIGRATION EXECUTION REQUIRES SEPARATE APPROVAL**.

## Verified state and evidence

Branch `development`, HEAD `0270994`; working tree was clean before this documentation work. Previous application, security, Prisma and integration-test files are preserved.

The fresh private-console preflight completed at 2026-10-26T10:16:32.7849832Z, exit 0, with an actual SQL `G3_MIGRATION_PREFLIGHT_PASS` result. Target: **127.0.0.1:5432/flywithsafe_g3_auth02_disposable**, administrator/session user and database owner **postgres**, PostgreSQL **18.6**, encoding UTF8. Public relations: **0**; migration history: **absent**; other target sessions: **0**.

The restricted test role remains NOLOGIN and fully restricted, connection limit 20, no memberships, CONNECT/schema USAGE only, and stored role/database `statement_timeout=5s`. The private password verifier was checked only as a boolean. No passwords, URLs containing passwords or verifiers appear here.

Administrator defaults have no statement/lock/idle-transaction timeout. The future psql inspection children explicitly use read-only mode and five-second statement/lock timeouts. The existing final two migrations supply their own five/30-second local timeouts. Do not assume these bounds cover the first five migrations or every Prisma-engine operation.

Evidence is in the session artifact directory stated in the Phase 1 Evidence Log. No migration or database-writing test was executed during this preflight.

## Exact approved candidate sequence

| Order | Migration | Reviewed operations |
|---|---|---|
| 1 | 20260926202822_init | Initial User/Post tables, primary/unique keys, relationship. |
| 2 | 20260927082715_full_schema | Replace initial User identity shape; drop intermediate Post/FK/User sequence; create auth, inquiries and content structures, enums, indexes and foreign keys. |
| 3 | 20261009000000_auth_sessions_and_password_resets | PasswordResetToken and Session, unique token/hash keys, indexes and user FKs. |
| 4 | 20261011000000_inquiry_idempotency | Durable operation/principal/key uniqueness and user FK. |
| 5 | 20261011120000_notification_outbox | NotificationStatus, NotificationOutbox and unique/retry indexes. |
| 6 | 20261022000100_contact_status_new | Transactionally add ContactStatus.NEW and commit. |
| 7 | 20261022000200_booking_contact_schema | Booking enums and three tables; ContactMessage.serviceType/default; seven explicit indexes and three FKs. |

Exactly these seven directories exist. Every migration.sql matches the reviewed raw SHA256 manifests:
- `docs/proposals/phase-1ha3-existing-migration-hashes.json`
- `docs/proposals/phase-1ha3-new-migration-manifest.json`

The prepared launcher also embeds those seven raw hashes independently. No manifest or migration was changed. The first five files use CRLF; their LF-normalized hashes remain the original reviewed values. This review did not substitute normalized bytes for the actual deployment files.

### SQL safety conclusions

- Migration two contains genuine destructive statements against intermediate objects created by migration one. They are acceptable only on this independently verified empty target with no application writers. It is unsafe to reuse this initialization procedure on an existing application database.
- The required User.updatedAt addition has no default and depends on the empty User table.
- Migration six commits NEW before migration seven uses it as a default, satisfying PostgreSQL enum transaction ordering.
- Booking user FK uses SET NULL; passenger/history ownership FKs use CASCADE. Reference uniqueness and idempotency uniqueness are retained.
- No supplier/SMTP/payment calls, role grants, LOGIN changes, external SQL imports, program execution or extensions occur in these files.
- No entire-seven-migration atomicity is claimed. The original five lack explicit whole-migration transaction wrappers; failure can leave partial state.
- Existing TIMESTAMP(3) without time zone storage is preserved. Server TimeZone is Asia/Dhaka; AUTH-02 UTC behavior still needs separately authorized G3 verification.

## Prepared isolated execution

Credential-free helpers are outside the repository:

`C:\Users\sahab\.codex\visualizations\2026\10\21\01a15fd3-69ff-7843-bea7-539c3d6111f9\g3-migration-initialization-20261026-01`

- `Initialize-AfterApproval.ps1`: defaults to Offline; Initialize requires an explicit OwnerAuthorized switch and an accessible private console. Pins the exact migration set, SQL/helper bytes and package versions. Refuses a previous attempt marker.
- `prisma.g3.config.cjs`: absolute existing schema/migration paths, no dotenv or application imports; rejects mismatched URLs, remote/alternate hosts, alternate databases/roles/ports/schema and appended overrides.
- `preflight.readonly.sql`: independently verifies exact identity, empty schema/history, role/ACL/timeout and exclusive target before deployment.
- `postcheck.readonly.sql`: read-only baseline assertions and full schema/catalog evidence for subsequent review.
- `verify-offline.cjs`: synthetic configuration validation with Node network/fetch blocking.

The launcher prompts privately for the EXISTING postgres password. It constructs one fixed target and gives matching DATABASE_URL/DIRECT_URL only to Prisma children. It strips inherited PG*, PRISMA*, DOTENV*, NODE_OPTIONS/NODE_PATH and database-URL overrides from child environments. Parent environment and repository .env files are never changed.

The explicit Prisma config loads with dotenv=false in installed Prisma 7.10.0. It does not invoke the repository config, which imports dotenv/config and reads DIRECT_URL. Offline loading confirmed the fixed target and no intercepted .env reads. Repository .env credentials/targets were not printed.

Only installed Node/Prisma/local schema-engine binaries are used. Update notices/checkpoint are disabled. These are database-target safeguards, not a claim of OS-wide outbound firewall enforcement. No application/server is started and no SMTP/provider modules are imported.

Private credentials temporarily exist in process memory/child environment for CLI authentication. They are absent from command arguments, source files and saved stage logs; logs redact the private password and database URLs. This does not guarantee secure erasure of all managed/runtime copies. Run without transcription or debug tooling.

### Checks before the only mutation command

1. Validate exact seven names/raw hashes, helper hashes and Prisma 7.10.0 packages.
2. Prompt privately; write an attempt marker to prevent automatic retry.
3. Execute bounded read-only psql preflight on the exact literal target.
4. Require installed Prisma `migrate status` to report the same seven pending migrations. On a fresh database, pending history normally yields exit 1; other output fails closed.
5. Repeat empty-target/exclusivity preflight immediately before deployment.
6. Invoke only `migrate deploy --config <isolated absolute config>`.
7. On exit 0, run read-only postchecks. Require independent catalog review before final acceptance.

There remains a short check-to-use race against another privileged administrator. Keep other admin/schema writers stopped. Guards do not protect against a concurrent malicious local administrator or compromised installed tools.

The CLI pending-status/deploy paths have NOT been executed here. Their future output checks deliberately stop on unexpected wording/errors rather than weakening the guard.

## Future command — DO NOT RUN BEFORE SEPARATE APPROVAL

Run once in the owner's accessible private PowerShell console:

```powershell
& 'C:\Users\sahab\.codex\visualizations\2026\10\21\01a15fd3-69ff-7843-bea7-539c3d6111f9\g3-migration-initialization-20261026-01\Initialize-AfterApproval.ps1' -Action Initialize -OwnerAuthorized
```

Do not invoke the historical Phase 1H wrapper: it targets a different database.

Offline validation, without credentials or database access:

```powershell
& 'C:\Users\sahab\.codex\visualizations\2026\10\21\01a15fd3-69ff-7843-bea7-539c3d6111f9\g3-migration-initialization-20261026-01\Initialize-AfterApproval.ps1' -Action Offline
```

## Failure and recovery

- Any identity, emptiness, checksum, version or pending-set mismatch: stop before deploy.
- Nonzero deploy result: stop immediately; preserve sanitized stdout/stderr, per-stage actual exit codes and attempt/result files. Do not rerun, reset, resolve, repair or delete anything.
- Determine database state with separately reviewed read-only catalog/history inspection; capture completed, unfinished and rolled-back migration rows without exposing migration error logs containing secrets.
- If migration six succeeds and seven fails, NEW may remain committed. Do not remove it or mark seven applied. Review actual catalog/history; obtain separate recovery approval.
- If exit 0 but connection/postcheck fails, completion is uncertain until read-only verification; never infer rollback from a lost client acknowledgement.
- No automated down migration exists. Dropping the disposable database, reversing schema or changing migration history requires separate explicit approval.
- No automatic process termination is used if a migration hangs. Ask for diagnostic/recovery approval rather than killing an unidentified process.

## Post-migration acceptance checklist

Read-only checks must establish:
1. Exact target, administrator, owner and PG version unchanged.
2. Exactly seven intended history rows, all completed, no failures/rollbacks, checksums matching approved bytes or Prisma's documented line-ending-equivalent checksums.
3. Exactly 20 intended public tables, including migration history; no Post table/User_id_seq.
4. Nine intended enum types and exact labels/order, including ContactStatus.NEW and all booking enums.
5. Required PKs, unique reference/token/idempotency keys, FK columns/targets/actions and indexes match reviewed SQL; compare definitions, not just the historical 82-index count.
6. Column types, nullability, ContactMessage changes/defaults, booking defaults and auth timestamp precision match schema.
7. All 19 application tables remain empty. No synthetic fixtures, seed or cleanup.
8. Owner, NOLOGIN, ACLs, memberships, connection limit and stored timeout unchanged; no table grants to test role.
9. Saved sanitized deployment exit code and postcheck output reviewed before recording initialization PASS.

The prepared postcheck asserts baseline counts/emptiness/role restrictions and emits detailed definitions. It intentionally reports BASELINE_PASS_REQUIRES_CATALOG_REVIEW rather than claiming every emitted definition was automatically validated.

## Verification and approval boundary

Executed: fresh read-only psql preflight PASS; seven migration raw-byte checks PASS; PowerShell syntax/offline guard PASS; Node configuration checks **14 passed / 0 failed / 0 skipped**. Initial offline verifier assertions about Windows path spelling and mere dotenv module loading were corrected to test normalized paths and actual environment-file reads; final checks passed. No backend application changes required tests or TypeScript reruns.

Windows PowerShell 5.1 parsed the prepared launcher successfully. Direct 5.1 helper execution in the agent environment was blocked with `AuthorizationManager check failed`; no execution-policy bypass or policy change was attempted. The offline guard executed successfully under the agent's current PowerShell. Before any authorized initialization, the owner must confirm the Offline command works in the accessible private console. If it fails, stop and report the policy error; migration approval does not authorize changing execution policy.

All **661** pre-existing repository files retain their original SHA256 values. Their sorted path/hash digest remains `5bf5bcb2a5b4f531799bfc6b5ef28a4a1f8a4e3763d644627d2f962aa47ebfc9`. Only this approval document and the new Phase 1 Evidence Log were added to the repository. Git diff validation and explicit new-document whitespace checks passed.

Not executed: live Prisma status, migrations, post-migration checks, restricted-role login/G3-P or G3-X tests.

### Exact next authorization request

**COMPLETED 2026-10-28:** owner explicitly approved and the guarded initialization executed once. Deploy/postcheck/supplemental role-check all exit0; all seven completed raw checksums and catalog definitions reviewed against SQL. Canonical Evidence Log records PASS. The historical initialization request below is fulfilled: NEVER rerun it on this initialized database. Reader remains restricted LOGIN; test role remains restricted NOLOGIN with no table grants. Next step is a new narrowly reviewed test-role access/permission package and separately authorized read-only G3-P, not another initialization, R1 empty-target preflight or fixture run.

**2026-10-28 readiness update (supersedes earlier dated 'live status not executed'):** R1 and R2 now PASS; actual reader identity/preflight exit0, fixed Prisma7.10.0 status exit1 with exactly seven reviewed pending names, helper passed=true and migrationExecuted=false. See canonical Evidence Log. Seven migrations are ready for a SEPARATE execution decision, not authorized by R2. Fresh administrator target/empty-schema/hash/pending guards remain mandatory at execution time. Use explicit installed Utility import in the private PowerShell caller; do not alter reviewed initialization wrapper, migration SQL or pins. Preserve new reader CONNECT/USAGE/settings and existing G3-X NOLOGIN, ownership/memberships/ACLs during read-only postchecks. Current empty-target Status preflight is unsuitable after migration; use approved initialization postcheck instead. No post-migration reader grants or G3-X activation implied. Previous scope/acceptance evidence below is retained as dated history.

> I authorize one guarded initialization attempt applying exactly the seven migration names listed above, in chronological order, with Prisma 7.10.0 to 127.0.0.1:5432/flywithsafe_g3_auth02_disposable as postgres, subject to fresh identity/empty-target/checksum/pending-set guards. I also authorize read-only status and post-migration catalog verification and sanitized evidence capture. Stop on any mismatch or failure without retry, repair or history changes. This excludes every other database, additional schema changes, LOGIN activation, table grants, HBA/authentication changes, credential changes, fixtures/integration tests, suppliers/payments/SMTP and deployment.

L-01–L-14 remain **BLOCKED**. G3-P access activation and G3-X remain separate approval gates. No Phase 1I-E, Phase 1J or Phase 2 work is authorized.

