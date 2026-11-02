# One same-input authentication-parity browser host — approval required

Exact existing target: `127.0.0.1:5432/flywithsafe_phase2_booking_integration`; existing restricted role `flywithsafe_phase2_booking_test`. Existing39-invariant commercial acceptance and all owned fixtures remain. No setup, role/password change, GRANT, migration, DELETE, reset, fixture creation, commercial proof replay or provider operation.

## Evidence and limits

Consumed browser-recovery: identity-query, DATABASE_AUTHENTICATION/P2010/28P01, identityVerified false; host exit1, no READY. Close/snapshot/disconnect failures null; snapshot skipped. This is PostgreSQL rejecting authentication, not a booking/quotation/actor assertion. The original private input and effective password were never retained, so they cannot be compared with the successful historical input. No URL encoding or password-entry defect is established. All old package files remain unchanged.

| Flow | Successful reference | Failed browser |
|---|---|---|
| Private input | SecureString/BSTR | SecureString/BSTR |
| Construction | PGPASSWORD reference, EscapeDataString once | Direct BSTR string, EscapeDataString once |
| URL equivalence | Installed pg validates raw/normalized/read-only forms against same input | Not checked |
| Authentication before Prisma | Same-input psql read-only identity PASS | No psql gate |
| Transport | Process-local PGSSLMODE disable | Override guard requires unset; installed pg default is also SSL false |
| Runtime URL | Dedicated PHASE2 URL assigned to DATABASE_URL | Same dedicated selection, URL.href normalization |
| DIRECT_URL/dotenv | DIRECT_URL rejected/unused; dotenv discovery suppressed | Same |
| Prisma | Same production client and PrismaPg/pg adapter | Same |
| Node/Vitest | Same node binary/thread worker; NODE_ENV test | NODE_ENV development for browser app; no evidence of an existing cached wrong client |
| Target | Same loopback host/port/database/role | Same |

## Minimal controlled path

This is configuration unification and a discriminating preflight, NOT a claimed fix of the historical28P01 cause. One shared PS5.1 helper performs the successful SecureString→private reference→single-encoding operation; no output contains secrets. New caller rejects inherited credential/transport overrides, uses the existing local-only explicit transport, validates URL/driver equivalence offline in a child, then uses the SAME input for a fixed psql BEGIN READ ONLY/identity/ROLLBACK check. Any failure stops before host dispatch. It removes PGPASSWORD before starting Vitest so Prisma must use the verified URL. Actual child environment propagation is tested with synthetic data. No fallback password or credential hash is stored.

Only after those guards does the unchanged diagnostic browser host perform actual identity/actor checks and listen on loopback. The old identity/business suites are not invoked. This new psql gate is necessary to distinguish current same-input authentication from the recurring ambiguous path; it does not recreate historical clean-state/commercial proofs. All39 accepted invariants are reused, not re-executed.

ONE new owner-approved foreground PS5.1 execution, one existing database-password prompt; no retry. Record URL-check/psql/host exit codes separately; host preserves safe stage/error classification. On READY leave console open for the approved customer/staff/admin browser journey. The15-minute host/920s case limits and every identity/authorization guard remain unchanged. READY is not browser acceptance. Actual UI writes must remain synthetic and journaled; privileged cleanup needs later exact-ledger approval.

The prepared command is `FOREGROUND-AFTER-APPROVAL.txt`; do not execute without separate explicit approval. Root cause stays undetermined until new live evidence differentiates the paths. No new live operation was performed during preparation.
