# Phase 2 isolated booking setup — 2026-10-31-01

PREPARED, NOT EXECUTED. Database/role existence is still UNKNOWN until the owner's read-only output arrives. No Phase 1 resource is reused.

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

The prepared `phase2-booking.pg.test.ts` is a separate restricted-role API/PostgreSQL test, NOT executed by setup. It is skipped without its explicit synthetic mode, exact target URL and a new exclusive fixture journal. It retains fixtures and performs no DELETE; later cleanup requires exact ledger review/approval. It exercises actual production HTTP handlers and PostgreSQL, not browser submission/login. Real browser submission remains a subsequent verification once this target is available.
