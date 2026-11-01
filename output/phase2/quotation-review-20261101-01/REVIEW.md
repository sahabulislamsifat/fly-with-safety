# Quotation-stage recovery: evidence and read-only reconciliation

## Established evidence

Recovery attempt finished 2026-11-01 12:35:58 UTC (18:35:58 Asia/Dhaka). URL equivalence, psql and Prisma identity/empty-state preflight passed. Prisma identity test 1 PASS; business test 0 PASS / 1 FAIL, exit 1 at generic quotation stage. The old catch discarded the original assertion/response/error. No underlying SQLSTATE or precise quotation operation is recoverable from that report. Authentication investigation is closed for this attempt.

Actual journal records four user inserts, four authenticated sessions, a booking creation checkpoint and four successful existing-request replays plus payload-conflict denial before `booking-replay-pass`. Final actual database ID snapshot observed 4 User + 4 Session + 1 Booking + 1 BookingPassenger + 1 BookingStatusHistory + 1 IdempotencyRecord + 1 NotificationOutbox = 13 owned rows across seven tables. Exact IDs remain in the original ledger; the read-only SQL binds to every ID and linkage. No quotation snapshot was recorded. No acceptance checkpoint, payment stage, rollback-only probe, final clean state or unrelated-row preservation result was established. A failed whole test is not relabeled PASS; only these narrower checkpoints have evidence.

## Confirmed code defect, live causality still unverified

Installed PrismaPg `normalize_timestamptz` replaces a numeric offset with +00:00 without adjusting the wall time. The offline reproducer runs the real installed PrismaClient and adapter against intercepted synthetic pg wire rows, with no database connection. `2026-11-01 18:35:00+06` becomes the incorrect `2026-11-01T18:35:00Z`. This can wrongly reject a valid near-future quotation in a non-UTC session. It is a genuine reproducible service defect; the old generic report does not establish it as the sole live failure cause. Actual current session TimeZone and committed quotation state require the prepared read-only query.

Minimal service fix: `SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`, still after the same Booking FOR UPDATE lock. PostgreSQL returns an explicitly UTC timestamp; the existing adapter handles it without a lost offset. No schema, grant, session timezone setting, timeout, expiry predicate, concurrency or business assertion changes.

Future diagnostic fix: separate quotation customer-denial, staff-offer, admin-denial, ownership-denial and concurrent-acceptance stages. Journal only actual/expected HTTP status and an allowlisted public error code; operation failures retain allowlisted Prisma/SQLSTATE classifications. No raw body/message/stack/token/connection string. All 43 original assertions and eight concurrent acceptance calls remain. Original source byte copies and hashes are in `original-source` and `preservation.json`; historical failed directories/callers/markers/results were not edited. Their old source pins are intentionally retired after the source correction, not repinned or bypassed.

## Actual offline verification

Before fix: codec reproduction 4 PASS, service-query regression 1 FAIL. After fix, independently per loader: clock 5 PASS, safe diagnostics 33 PASS, affected commercial/status/HTTP 60 PASS = 98 PASS / 0 FAIL / 0 SKIP. Strict and server TypeScript, scoped ESLint: exit 0. Native Windows PowerShell 5.1 parsing: zero errors. Full prior 144-test suites and live business suites were not rerun. Counts/paths/hashes are in `verification.json`; the exact ledger-ID/static SQL review is in `static-review.json`.

## One current owner action, read-only only

Run the hash-guarded `Invoke-QuotationReview.ps1 -ReadOnlyReviewAuthorized` in the existing private PS5.1 console under the explicit read-only investigation scope. The native psql prompt requests only the existing restricted-role password. The caller checks SQL/ledger hashes, guards the exact local identity in BEGIN READ ONLY, reads server timezone, expected-ID/linkage versus full table counts, booking price/status/commercial revision and quotation metadata, and ends ROLLBACK. No DML/DDL, cleanup, service request, credential URL construction, role setup or old attempt invocation. Output is persisted locally. Exit 0 means inventory query completion, NOT automatic inventory/Phase2 acceptance; discrepancies must be reviewed.

The review has not run. No new mutating integration package/approval is requested until current fixture and quotation state are reconciled. Then prepare a bounded continuation using retained fixtures and actual state; do not silently require an empty target or reset it. Any mutation/cleanup requires its own explicit reviewed owner authorization. Phase1 G7 ACCEPTED remains unchanged; Phase2 NOT ACCEPTED; Phase3 NOT STARTED.
