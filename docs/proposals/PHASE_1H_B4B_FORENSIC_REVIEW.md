# Phase 1H-B4B read-only forensic review

## Owner-supplied forensic results — 23 October 2026

The -f invocation completed in READ ONLY mode and ended with ROLLBACK. Identity:
127.0.0.1:5432 / flywithsafe_phase1h_integration / postgres. The mixed-case public
NotificationOutbox table exists; earlier lowercase lookup failures were quoting failures.

Exactly one notification was returned:

- Record fingerprint: 16be3863bbf2c88d2b5d3ac99d4465c2.
- Recipient fingerprint: 526e704c2620c76d589e78bf5a7c2906.
- PENDING, attempts 0, no idempotency key; EMAIL_VERIFICATION template.
- Recipient matches the strict inquiry-registration synthetic pattern.
- createdAt and updatedAt: 2026-10-23 10:25:29.338 (timestamp without timezone).
- Candidate run start: 2026-10-23 16:25:18.801+06, or 10:25:18.801 UTC.
- No matching user, inquiry or booking.

Counts: notification 1; users, verification tokens, sessions, flight inquiries, bookings and
idempotency records all 0. These are owner-supplied query results, not an agent connection.

Assuming Prisma's stored timestamp follows UTC, the notification was inserted 10.537 seconds
after fixture run-ID generation. That is consistent with registration completing an enqueue
after the ten-second setup budget while cleanup had already selected notifications and then
removed the synthetic user (whose auth rows cascade). NotificationOutbox has no recipient-to-
User foreign key, so such a notification can survive user cleanup. Absence of auth rows alone
does not prove exactly when or by which process they were removed.

The fixture pattern, template, missing idempotency key, run timestamp and otherwise empty
database provide strong evidence of an inquiry setup artifact. Confirm the candidate run
timestamp against the failed invocation before attributing it to that specific run; the
pattern alone cannot exclude a different synthetic invocation. The precise slow operation
remains unproven: run-ID generation is not the beforeAll start, and no stage timings from
that failed execution have been supplied.

An exact single-record cleanup proposal is now reasonable after owner confirmation of the
failed-run timestamp and private identification of the actual record ID. Preserve the row
until explicitly approved. Privately resolve the fingerprint to exactly one ID and verify
the recipient fingerprint, timestamps, template, status and attempts still match. Bind an
approved deletion to that actual ID plus those reviewed conditions inside one transaction;
require exactly one affected row or roll back. Never delete merely by pattern or MD5 value.
No user/auth/inquiry/booking/idempotency cleanup is justified by these zero counts.
After separately approved cleanup, verify the outbox is empty read-only and obtain separate
diagnostic-test/fixture-cleanup approval. No cleanup or live rerun is authorized by these results.

The remaining sections document the earlier review and inspection plan; their previously
pending evidence statements are superseded by the results above. No source edits or new
regression execution were needed to interpret this output.

Planning: compact; context: dependencies; verification: impact; delegation: none.
Only forensic SQL and this report are added. No test/application code or database changed.
Applied investigation-first and verification-only review to avoid asserting an unmeasured cause.

## Supplied evidence

The successful identity SELECT establishes owner access to 127.0.0.1:5432 /
flywithsafe_phase1h_integration. The next statement failed with public.notificationoutbox
in lowercase. PostgreSQL folds unquoted names; schema.prisma and migration SQL use the quoted
mixed-case NotificationOutbox name. PowerShell's native -c argument passing lost the quotes.
This is a command transport failure, not evidence that the actual mixed-case table is missing.
No notification rows or counts were returned. ON_ERROR_STOP terminated the command in an
aborted read-only transaction; the later COMMIT did not execute. No writes were requested.

## Prepared read-only inspection

Use phase1h-b4b-forensics.readonly.sql via psql -f, avoiding native quoting of SQL text.
The file sets ON_ERROR_STOP, disables the pager, begins READ ONLY, applies a five-second
statement timeout and pg_catalog search path, validates exact database/host/port/role,
and queries business tables only inside the successful psql conditional. It ends in ROLLBACK.
Its only meta commands set display/error behavior, capture the identity boolean, and branch;
there is no program execution, file export, DDL, DML, lock acquisition request or dynamic SQL.
No token, verification URL, payload, name, address or credential is printed. MD5 values are
correlation fingerprints, not anonymization guarantees or deletion authorization.

Output provides notification fingerprints, recipient fingerprints, status/attempts/timestamps,
verification-template boolean, idempotency-key presence, and a strict synthetic registration
pattern boolean. For a matching pattern it derives the candidate run start time from the
Date.now() segment. It reports exact counts plus user/recipient fingerprint joins and related
verification-token/session counts; inquiry/booking/idempotency IDs are fingerprinted.

Keep all writers stopped while inspecting; READ ONLY alone does not prevent other sessions
from changing data. Timestamp comparisons must account for the database timestamp convention
and the output timezone. A generated run timestamp precedes setup, not necessarily the test
invocation or the first database write.

## Ownership assessment — pending actual query output

Inquiry setup uses idem-<Date.now()>-<random suffix>-auth@integration.test. Registration awaits
user creation, a verification token, EMAIL_VERIFICATION enqueue and session creation. The
verification notification has no idempotency key. Disabled SMTP still permits durable enqueue.
Thus one such row is consistent with failed registration setup. Match its recipient fingerprint
to a synthetic user's email fingerprint and compare candidate run start/record timestamps to
the known failed invocation. The pattern alone is not proof: another invocation could produce
similar rows, and unknown writers must be excluded. No query results currently establish which
records remain. The reported one notification is historical owner evidence, not a refreshed count.

A verification token without a session could narrow the interrupted registration stage, but
cannot prove which awaited operation stalled or when the client hook timed out. The source
shows no real SMTP operation is required for enqueue. Do not call the timeout an SMTP failure.

## Cleanup and timing review

Both suites await their setup promise before selecting/deleting owned records. Partial settled
setup can be cleaned by exact run emails/IDs/keys; User cascades cover its synthetic auth rows.
If setup never settles, afterAll can time out without cleanup. Waiting is not cancellation.
If an insert succeeds server-side but the client does not receive completion, a later read-only
inspection is required. Cleanup failures and process termination can leave records; no silent
automatic reset or recovery is justified. Finally/disconnect handling is not guaranteed if
cleanup queries throw. bail=1 plus serial files reduces propagation but is not a transaction,
resource cancellation mechanism, or proof that all background work ended.

Current timing covers app/Prisma imports, registration request and reliability outbox count.
It does not cover supertest/config imports, individual registration SQL/bcrypt stages, reliability
identity/precision/index queries, or cleanup stages. It can narrow the next diagnostic run but
cannot yet establish the exact cause. Preserve the ten-second timeout until measurements
justify a scoped change. No instrumentation changes are needed to interpret the current
forensic query; further instrumentation should follow the slow stage actually observed.

Exact target URL/approval guards remain active in runner, suites and replay helper. Both test
suites stub fetch and SMTP transport construction; runner disables Google credentials, email
delivery and workers. No supplier/payment flow is part of these tests. Empty-outbox verification
remains mandatory. This is scoped test isolation, not proof of an OS network sandbox.

## Next steps and approvals

1. Owner runs the read-only file with private local authentication and provides sanitized output.
2. Correlate fingerprints, fixture pattern and timestamps with the exact failed invocation.
   If still ambiguous, retain every record and gather additional read-only evidence locally.
3. Only after ownership is established, prepare a separate transaction proposal using exact
   locally retained record IDs, expected counts, related FK rows and identified cascades.
   Fingerprints alone do not identify approved DELETE predicates. Do not delete by prefix,
   template, arbitrary age, or whole-table scope. Obtain explicit approval before cleanup.
4. After separately approved cleanup, verify counts and empty outbox read-only. Confirm no
   other writer/worker is active and no failed setup remains running.
5. Obtain separate approval for one diagnostic run of 16 cases plus their normal synthetic
   cleanup. Use the private setup documented in PHASE_1H_B3_RUNNER_READINESS.md, then from
   E:\Programming\Project\fly-with-safety\server run node test/run-postgres-integration.mjs.
   Keep fixed-label timings and sanitized failures. Stop after failure; no automatic rerun.

No live PostgreSQL correctness, ownership, cleanup readiness or timeout resolution is claimed.
Historical B4A offline evidence is 38 passed and 16 skipped; it was not rerun for these two
read-only review artifacts. No database access, test execution, cleanup or migrations occurred.
