# Phase 2 isolated booking setup — 2026-10-31-01

PREPARED, NOT EXECUTED. On 2026-11-01 the owner supplied successful read-only PostgreSQL18 evidence: BOTH database and role ABSENT (zero rows), transaction rolled back. The execution guard rechecks absence immediately before creation. No Phase 1 resource is reused.

Requested approval, conditional on BOTH proposed resources being absent:

- Create only `127.0.0.1:5432/flywithsafe_phase2_booking_integration`, owned by postgres; remove PUBLIC target database privileges.
- Deploy the seven pinned baseline migrations into this NEW database with Prisma. No Phase 1 additive SQL, fixtures, seed, reset or application database modification.
- Create only `flywithsafe_phase2_booking_test`, LOGIN with a new development-only password entered privately through psql `\password`.
- Restrict PUBLIC usage/creation on this NEW public schema; grant the test role USAGE and database CONNECT.
- Role: no superuser/CREATEDB/CREATEROLE/inheritance/replication/BYPASSRLS/membership. Connection limit 12 accommodates the existing default application pool of 10; no pool code change. Statement/idle transaction 5s, lock 2s.

| Objects | Privileges | Reason |
|---|---|---|
| User | SELECT, INSERT; UPDATE(name) | Synthetic actor fixtures, active account and profile |
| Session | SELECT, INSERT; UPDATE(revokedAt,lastUsedAt) | Synthetic active sessions and logout/refresh |
| Booking | SELECT, INSERT; UPDATE(status,bookingDetails,totalPrice,updatedAt) | Request, quote acceptance, payment records and status |
| BookingPassenger, BookingStatusHistory | SELECT, INSERT | Append synthetic manifest/history |
| IdempotencyRecord, NotificationOutbox | SELECT, INSERT | Request replay and suppressed notification enqueue |
| FlightInquiry, HotelInquiry, PackageInquiry, VisaInquiry | SELECT | Existing customer dashboard summary |
| _prisma_migrations | SELECT(migration_name,checksum,finished_at,rolled_back_at) | Restricted integration preflight |

No DELETE, TRUNCATE, REFERENCES, TRIGGER, grant options, schema CREATE or object ownership. No unrelated database/PUBLIC ACL changes. Existing unrelated databases may still have PUBLIC CONNECT/TEMPORARY; this is not complete cluster connection isolation.

`Invoke-Phase2Setup.ps1` requires explicit `-OwnerAuthorized`, interactive Windows PowerShell 5.1, RemoteSigned without bypass, clean credential environment, pinned source/binary/manifest hashes, exact seven-directory set and an exclusive new attempt marker. Actual absence is rechecked before CREATE DATABASE. Every failed stage stops; no retry, repair or deletion. The sequence is not fully atomic; committed partial state must be preserved.

Normal Windows user console is sufficient; PostgreSQL administrator credentials are required privately. No Windows elevation or external account is required. No command is authorized by this review document itself. The owner must approve after the read-only existence result is reviewed.

Exact migrations, in order: `20260926202822_init`, `20260927082715_full_schema`, `20261009000000_auth_sessions_and_password_resets`, `20261011000000_inquiry_idempotency`, `20261011120000_notification_outbox`, `20261022000100_contact_status_new`, `20261022000200_booking_contact_schema`. Quotation/payment records currently use the existing Booking JSON field; no new Phase2 DDL is required. Postconditions check every SELECT/INSERT/UPDATE column, negative privileges, ownership, grant options and target PUBLIC access. Failure results record a bounded stage and exit code, never a password/URL or raw driver error.

The prepared `phase2-booking.pg.test.ts` is a separate restricted-role API/PostgreSQL test, NOT executed by setup. It is skipped without its explicit synthetic mode, exact target URL and a new exclusive fixture journal. It retains fixtures and performs no DELETE; later cleanup requires exact ledger review/approval. It exercises actual production HTTP handlers and PostgreSQL, not browser submission/login. Real browser submission remains a subsequent verification once this target is available.
