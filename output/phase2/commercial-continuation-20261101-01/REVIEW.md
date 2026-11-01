# ONE retained-fixture commercial continuation — owner approval required

Target: `127.0.0.1:5432/flywithsafe_phase2_booking_integration`, existing non-admin `flywithsafe_phase2_booking_test`. Reuse booking `FWS-2026-53YFS3` and the four existing synthetic identities. No new user, booking or passenger. No historical launcher is invoked.

## Accepted starting evidence

Actual read-only review finished `2026-11-01T13:00:53.2596484Z` (19:00:53 Asia/Dhaka), query exit 0 and ROLLBACK. Exact expected-ID/linkage counts equalled total counts: User 4, Session 4, Booking 1, BookingPassenger 1, BookingStatusHistory 1, IdempotencyRecord 1, NotificationOutbox 1. Booking PENDING, price 0, commercial absent, zero quotations/payments/acceptances. TimeZone Asia/Dhaka. This inventory is accepted in a NEW `inventory-acceptance.json`; the original review result remains unchanged with its historical review-required flag.

The UTC clock correction remains byte-identical to the prior verified fix. `clock_timestamp() AT TIME ZONE 'UTC'` returns an explicit UTC timestamp through the installed adapter, after the existing booking row lock. No other proven quotation defect was found in the scoped source review. The old generic error did not retain its HTTP status/operation, so historical sole causality is not claimed. New live evidence is required.

## Exact proposed live scope

1. Before writes, validate the actual restricted database identity, original exact privilege postcheck in READ ONLY, seven migration names/checksums/completion, session timezone, every retained actor/session/record ID and linkage, all seven table counts and PENDING/price-zero/commercial-absent state. Any mismatch stops; no reset or repair.
2. Sign in the four EXISTING accounts through the real API using the SAME existing synthetic-account password chosen during the 18:35 run. Do not choose a new account password. This creates four normal sessions; no password/account changes.
3. On the existing booking: reject past-expiry issuance, issue a short valid quotation (3s), verify replay/conflict, observe database expiry (bounded 4s polling) and deny acceptance; issue two valid future revisions, deny stale/currency/invalid-amount/superseded/role/foreign-owner operations, then eight concurrent identical customer acceptances. Assert one atomic price/quotation/history acceptance and revision 4.
4. Deny wrong quotation/currency/overamount/missing-reference/forged-verification/customer payment requests. Four concurrent identical valid manual records must create ONE `RECORDED_UNVERIFIED` record linked to the accepted quote, revision 5. Deny conflicting replay/duplicate reference; replay acceptance without duplication.
5. Deny unauthorized/invalid status changes. Eight concurrent identical PENDING→CONFIRMED calls must add one transition. Deny stale cancellation; complete and replay completion; deny terminal reversal. No payment verification or supplier reservation.
6. In a rollback-only transaction, update existing booking price then insert a history referencing a known-absent random booking ID. Require actual FK rejection P2003, absent failed history ID, and unchanged price/updatedAt/commercial JSON after rollback.
7. Verify customer detail/list/dashboard, foreign-customer isolation, staff/admin matching persisted lists, anonymous/customer admin denial and a fresh normal customer login/retrieval. Assert minimized customer history, no internal receipts and no PAYMENT_VERIFIED.
8. Join only actual admitted notification-enqueue tasks, then snapshot all actual owned IDs/counts and commercial object IDs. No worker/delivery/provider is activated. SMTP/delivery disabled. Keep fixtures for browser verification and separately approved exact cleanup.

## Mutation ceiling and safety

Planned maximum new committed rows: **5 Session + 3 BookingStatusHistory + 2 NotificationOutbox = 10**. Expected successful total: 23 rows across the same seven tables. Existing Booking JSON receives three quotations, one unverified payment and five replay receipts; price becomes 12000 BDT and status COMPLETED. The additional history UUID is rollback-only and must remain absent. These are planned limits, not observed results. Failure may leave a smaller partial state; actual ledger/snapshot is authoritative.

No DELETE, TRUNCATE, cleanup, DDL, grant, role/database creation, migration, reset, password reset, real passenger data, live payment or supplier operation. No automatic retry. Original transaction/HTTP limits retained: 60s case, 5s response /10s HTTP deadline, role statement/lock limits unchanged. New dispatch stops at 45s, leaving room for admitted requests and observation. In-flight groups settle; admitted enqueue tasks drain before ID capture. No new scenario starts on failure.

Only dotenv discovery is disabled. Authentication, authorization, Express, Prisma, transaction/locks and PostgreSQL are real. Test-only observers call original service/delivery-enqueue functions exactly once; original notification promises are preserved. Journal only fixed operation stages, bounded statuses/counts/timing and allowlisted public/Prisma/SQLSTATE codes. No raw SQL/errors/bodies/stacks/passwords/cookies/tokens/connection URLs. Old source assertions/cases are not rerun or weakened.

## Actual offline verification and approval gate

Per loader: **60 PASS /0 FAIL /0 SKIP** (27 retained-contract/forwarding/budget regressions +33 diagnostics). Default live-config check: **0 PASS /0 FAIL /1 SKIP**, one registered case, no DB connection. Strict/server/browser-host TypeScript, scoped ESLint: exit 0. Native Windows PowerShell 5.1 parser: zero errors. Static package verifier: 182 checks, 144 dependency/evidence pins, no live attempt. Historical successful 144-test regressions and Phase1 suites were not rerun. Prior clock-codec proof is reused against unchanged service bytes.

Caller SHA256: `1F0D7595377921A4404B53B733B3B2BDEDC9A62CF280B573A298ED7B23A22B0A`.
Manifest SHA256: `46A7D751B849B44175968CA50718FFC0A759656B9DD66970B9E6FA88EF1374ED`.

Separate explicit owner approval is required for ONE new live continuation before running `FOREGROUND-AFTER-APPROVAL.txt`. Enter only the existing restricted database password and EXISTING synthetic account password in the private foreground PS5.1 console. No new window or policy bypass. On failure preserve this directory and stop.

After actual PASS, continue real browser booking/customer/staff workflows. Browser host source now gates on this new proof and reuses the original actor ledger; it has not been launched, and the old unexecuted host caller's retired pins must not be bypassed. Browser submission/initial-create concurrency, final actual-ledger cleanup and the final canonical acceptance matrix remain mandatory. A commercial API PASS alone does not accept Phase2. Phase1 G7 ACCEPTED unchanged; Phase3 not started.
