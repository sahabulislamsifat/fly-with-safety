# Reviewed Phase3 LOCAL additive schema gate — NOT EXECUTED

Target only `127.0.0.1:5432/flywithsafety_local_integration`, original OID34701. Existing role remains `flywithsafe_phase2_booking_test`. Main `flywithsafety` and staging `flywithsafety_integration` are not connected or modified. Fresh explicit owner approval is required.

Exact SQL: `apply.review.sql`; source migration: `server/prisma/migrations/20261103000100_gateway_sandbox_ledgers/migration.sql`; exact grant source: `../restricted-access.review.sql`. Hashes are in `review-hashes.json` and 18 dependency pins in `pins.json`.

Caller SHA256: `6FCDED4588137814D02BE628E78DB5B5865D9B8C3D609C1BCEFD5BAF57F6263A`.

Scope:

- Verify canonical local identity/OID, no other local client connection, seven completed baseline migration names/checksums, no unfinished migration, no preexisting Phase3 objects, existing restricted-role flags/membership and accepted private backup checksum/private ACL. No session termination.
- Create only GatewayPayment, GatewayPaymentEvent and GatewayRefund; their PK/FK/unique/check constraints and indexes; two immutable-capture/refund-reservation trigger functions and triggers. No existing application-table column/index/data changes.
- Existing role receives SELECT/INSERT on the three new tables; column UPDATE only status/valId/bankId/dueAt/state on GatewayPayment and state on GatewayRefund; EXECUTE only the two new trigger functions. No DELETE, TRUNCATE, DDL, membership, role recreation or broad grants. Public access to new functions is revoked; no existing ACL is altered.
- Insert exactly one `_prisma_migrations` ledger row for `20261103000100_gateway_sandbox_ledgers`, with the pinned original SQL checksum. Do not replay or resolve existing migrations.
- In the same transaction verify baseline counts/schema/access metadata preservation and restricted new privileges. COMMIT, then separate read-only OID/eight-migration/empty-ledger/baseline preservation checks and ROLLBACK of that read-only transaction.

The existing logical backup remains private and unchanged. Prior full archive read/decompression was verified; **no restore rehearsal** is claimed. Approved execution rechecks its checksum and owner+SYSTEM-only access. No new backup/upload/restore is included.

Caller uses exactly **one native psql connection** and one password prompt, directly to the canonical local database. That prompt requires the existing **postgres administrator** password, not the restricted-role password. Password entry is native/private. Windows Administrator is not required. No URL/password is constructed, logged or stored by this caller.

No test fixtures, business requests, SMTP, provider session/refund, frontend/backend restart, port change, external exposure or production activation is included. Payment flags stay disabled. The real PostgreSQL service proof is a later separately scoped execution.

The mutation is transactional; final read-only checks are separate. Failure consumes the fresh CreateNew attempt marker and stops. Missing commit output is **UNVERIFIED**, not a rollback claim. No retry, repair, cleanup, DROP, password reset or automatic reverse/restore. Preserve any committed state and all output for read-only investigation.

Offline evidence: 18 pins PASS; PostgreSQL18 WASM parses 32 SQL statements/6 PLpgSQL blocks; AST verifies only three new CREATE TABLE targets and one existing-table DML targeting the new migration ledger entry; native connection count1; Windows PowerShell5.1 parsing PASS. No actual execution attempt exists. These checks do not prove live schema acceptance.

After explicit approval use `FOREGROUND-AFTER-APPROVAL.txt` once in the existing private Windows PowerShell5.1 console. Do not execute in Codex automatically.
