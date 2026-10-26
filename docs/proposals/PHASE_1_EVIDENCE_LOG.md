# Phase 1 Evidence Log

This log distinguishes observed execution evidence from approvals and future work. Existing phase reports remain authoritative for their own historical results.

## 2026-10-26 — G3 resource bootstrap: PASS

- Authorized operation: create only the absent local G3 role/database and reviewed ACL/timeout configuration.
- Exact target: PostgreSQL 18.6, 127.0.0.1:5432, database `flywithsafe_g3_auth02_disposable`, owner `postgres`.
- Independently inspected saved result: exit code **0**, `passed: true`, actual SQL marker recorded.
- Completion: **2026-10-26T09:58:29.1120945Z** (15:58:29 Asia/Dhaka).
- Actual SQL postcheck: `G3_RESOURCE_BOOTSTRAP_PASS`.
- Restricted role: `flywithsafe_g3_auth02_test`; NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT, NOREPLICATION, NOBYPASSRLS; connection limit 20; zero memberships; private SCRAM verifier configured (boolean checked; verifier not disclosed).
- Reviewed CONNECT/schema USAGE allowed; database CREATE/TEMP and schema CREATE denied; PUBLIC ACL checks passed.
- Role/database-specific `statement_timeout=5s`.
- Zero public tables; migration-history table absent.
- Saved evidence directory: `C:\Users\sahab\.codex\visualizations\2026\10\21\01a15fd3-69ff-7843-bea7-539c3d6111f9\g3-resource-bootstrap-20261026-reexecution-01`.
- Files inspected: `result.json`, `psql-output.log`; no credential literals reproduced.
- This PASS does not approve migrations, LOGIN activation, table grants, fixtures or G3-X.

## 2026-10-26 — G3 migration initialization read-only preflight: PASS

- Owner ran the prepared private-console read-only preflight once.
- Independently inspected actual `preflight-result.json` and SQL output: exit code **0**, `passed: true`, actual `G3_MIGRATION_PREFLIGHT_PASS` row recorded.
- Completion: **2026-10-26T10:16:32.7849832Z** (16:16:32 Asia/Dhaka).
- Verified exact target/admin/version/owner/UTF8; read-only transaction enabled.
- Zero public relations and no migration history; no extra user schemas, public routines or public extensions; no other target connections.
- Restricted-role privileges, memberships, SCRAM-presence boolean, ACLs and sole role/database timeout remained as approved.
- Server settings observed: TimeZone Asia/Dhaka; default isolation read committed; max_connections 100; administrator statement_timeout, lock_timeout and idle_in_transaction_session_timeout all zero. The stored five-second setting applies to the restricted role, not administrator sessions.
- Seven local migration files match the reviewed raw-byte hashes; first five also have separately recorded LF-normalized review hashes.
- Installed Prisma CLI/client package versions: **7.10.0 / 7.10.0**.
- Offline checks: **14 passed, 0 failed, 0 skipped**; helper PowerShell parsing and seven-file integrity checks passed.
- Evidence directory: `C:\Users\sahab\.codex\visualizations\2026\10\21\01a15fd3-69ff-7843-bea7-539c3d6111f9\g3-migration-initialization-20261026-01`.
- Initialization, live Prisma pending-status command, post-migration checks and G3-X: **NOT EXECUTED**.
- Exactly seven pending migrations follows from the verified empty catalog/history plus the pinned seven-file directory set. The future launcher additionally requires a matching Prisma status result before deployment.
- Next gate: separate owner authorization for the seven reviewed migrations only. See `G3_MIGRATION_INITIALIZATION_APPROVAL.md`.

## Continuing restrictions

L-01 through L-14 remain **BLOCKED**. No legal determination is changed by infrastructure evidence. G3-P restricted-role verification and G3-X remain separately gated. Phase 1I-E, Phase 1J and Phase 2 remain unauthorized.

