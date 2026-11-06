# Phase3 restricted PostgreSQL payment proof — awaiting owner approval

Target only `127.0.0.1:5432/flywithsafety_local_integration`, OID34701, existing role `flywithsafe_phase2_booking_test`. No administrator login, schema/role/grant changes, new database, application server/port, cloud request or provider/SMTP request.

The schema-only operation is already consumed and accepted from its actual attempt/stdout/result, both success markers and exit0. Its original 18 pins and artifacts remain unchanged. This package MUST NOT rerun it.

## Exact new synthetic scope

The earlier approval explicitly excluded business fixtures. This proof therefore needs separate explicit approval of these new writes:

- Four new synthetic User rows: booking customer, other customer, STAFF and ADMIN. New UUID IDs and `@example.invalid` identities are recorded before writes. One privately entered development-only password is bcrypt-hashed for these accounts; no plaintext/password hash is printed or journalled. Existing users/accounts/passwords are never overwritten. These actors can be reused by the later browser journey.
- Two new Booking rows, two BookingPassenger rows (no DOB/passport/document data) and two initial history rows. Both bookings have synthetic accepted-quotation prestates, BDT12000, an explicit `MOCK_ONLY` fixture tag and no supplier reservation. This is fixture setup, not a new claim that quotation acceptance/provider processing occurred.
- At most two retained GatewayPayment rows, one GatewayRefund row, seven owned BookingStatusHistory rows total, sixteen normal-path payment events and 105 bounded new owned NotificationOutbox rows. The outbox maximum follows five atomic effect groups × (customer + at most20 staff/admin). Existing staff/admin recipients may appear only in these new local notification records; **no delivery worker or SMTP is invoked**. All actual IDs, including refund-linked outbox IDs, are snapshotted for later review. On an unexpected failure additional owned diagnostic events may be retained; the exact journal, not the expected normal count, governs any future cleanup.
- Rollback-only negative statements target only new owned payment/refund/event IDs. They test active-booking uniqueness, immutable amount, FK enforcement, refund balance/reference uniqueness and atomic outbox/history rollback. Even unexpected acceptance is followed by an intentional rollback. No DELETE/TRUNCATE/DDL is attempted, including permission-negative tests.
- No new Session/Account rows are created by this proof. Later browser sign-ins and any same-port host switch need their bounded reviewed scope. No synthetic login is submitted to the normal main-cloud backend.

## One sequential workflow

1. Existing private Windows PowerShell5.1, RemoteSigned unchanged. Verify caller,169 dependency pins, successful schema result and absence of all new attempt/result artifacts. Create a fresh exclusive attempt marker.
2. Owner enters EXISTING restricted-role database password once. The proven SecureString conversion and one percent-encoding path are reused, with the canonical renamed target. No credential in argv/files/chat. Native psql and Prisma use the same private input. Constructor-only pg URL parity guard performs no connection.
3. Native psql runs `preflight.readonly.sql`: actual identity/OID, no other local connection, eight migration names/checksums, three tables/fourteen valid indexes/two triggers/four RESTRICT FKs, exact accepted trigger bodies, EXECUTE permissions, required column permissions and prohibited privileges. New financial ledgers must be empty. This transaction ends ROLLBACK. Failure stops before business dispatch; no retry.
4. Owner chooses a NEW separate synthetic-account password, at least16 characters and at most72 UTF8 bytes (bcrypt boundary), and remembers it privately for later browser sign-ins. No normal cloud/database password reuse is requested.
5. ONE Vitest case executes the existing application payment service/store against real PostgreSQL. The gateway is an injected test double and global fetch is denied. No genuine merchant keys are read. The 64 planned check IDs are pinned in `test-contract.json`; each observed result has a bounded expected-versus-observed record. First failure stops later stages and preserves original sanitized Prisma/SQLSTATE/checkpoint evidence.
6. Drain in-flight groups, release test rendezvous, capture exact owned IDs and disconnect. No cleanup. Caller passes only with test exit0, all64 checks PASS, zero unexecuted checks, complete final snapshot and disconnection.

The existing 60s case timeout and production transaction budgets are unchanged. Eight contenders use the existing pool configuration; no pool expansion/concurrency reduction. A 45s admission cancellation blocks new guarded writes and checks cancellation before transaction commit. A paused old worker is always released and drained in finalization. A timeout/failed snapshot is never accepted.

## Evidence limits

This proves real PostgreSQL application transactions and constraints with **mocked provider responses**. It cannot establish genuine SSLCommerz authentication, actual IPN HTTPS delivery, merchant-enabled channels, real Order Validation/refunds, physical process restart or physical COMMIT-wire loss. Those remain separate acceptance evidence. The test simulates application acknowledgement loss only after a real session commit and recreates the service to test durable replay.

Outbox proof is atomic publication, linkage, dedupe and pending/non-delivery state. No message is called delivered or sent. Existing notification transport acceptance is not reopened; external delivery must not be inferred from queued records.

The risk fixture remains RISK_REVIEW; the happy fixture ends with verified simulated capture and provider-double-confirmed partial refund/operations hold. Both booking statuses remain PENDING; no supplier/ticket/fulfillment is fabricated. These are explicitly simulated local records and must never be copied to Main or counted as real provider proof.

## Offline review

- New diagnostics:7 PASS/0FAIL/0SKIP per bundled/native loader; historical98 tests retained unchanged and not rerun.
- Synthetic private connection path:10 PASS/0FAIL/0SKIP under actual Windows PowerShell5.1 and existing RemoteSigned; no policy bypass/change, database connection or real credentials. Initial sandbox registry-access restriction was diagnosed and the synthetic-only test ran with normal registry read access.
- Strict source/test TypeScript PASS; scoped ESLint0 errors/0 warnings; git diff check PASS.
- PostgreSQL18 parser:7 read-only statements,1 PLpgSQL guard and11 source SQL queries PASS. No SQL was executed by offline review.
- PowerShell5.1 parsing:caller/helper/offline test PASS.169 dependency pins match. No live proof attempt exists.

Current reviewed caller SHA256: `07BFCB319F14E9C9412564A4901E02D03765B708D7C42903B2ED2C6BA3045026`.

On failure preserve every marker/result/ledger; no automatic retry, password reset, repair, grant, schema replay or cleanup. Later privileged deletion requires actual exact-ledger review and separate approval. Normal localhost3000/5000 and both cloud databases remain untouched by this workflow.
