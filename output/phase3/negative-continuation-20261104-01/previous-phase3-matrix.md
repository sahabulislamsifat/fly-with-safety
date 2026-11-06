# Phase 3 consolidated acceptance matrix

Current assessment:2026-11-04. Phase3 NOT ACCEPTED; Phase4 ON HOLD; budget $0.
Phase1 G7 and Phase2 14/14 remain ACCEPTED. No genuine provider transaction has run.

| Gate | Current status | Actual evidence / remaining condition |
|---|---|---|
|1 Public HTTPS/boundary/TLS/browser return|BLOCKED, synthetic subgate PASS|[localhost.run7/7](../../output/phase3/localhost-run-injection-v01/result.json). No repeat smoke. Owner conditionally accepted sandbox-only TOFU/HTTPS termination risk. New fail-closed spoofing preflight and actual provider POST return still pending.|
|2 Isolated sandbox runtime/config/IPN|BLOCKED|[Executable review](../../output/phase3/genuine-sandbox-e2e-20261104-01/REVIEW.md), scoped store/provider/runtime implemented. Fresh DB identity/role/OID34701,8checksums, actors/recipient ownership/permissions, private credential auth must pass within approved execution.|
|3 Genuine Hosted Checkout transaction|NOT TESTED|Three fresh synthetic success/fail/cancel cases prepared; no provider calls performed.|
|4 Genuine return/IPN|NOT TESTED|Real browser return and signed successfulIPN required; no manufactured IPN. Failure/cancel IPN observed where supplied.|
|5 Authoritative validation/matching/risk|BLOCKED|[64 deterministic PostgreSQL checks](../../output/phase3/retained-proof-20261103-01/proof-result.json) accepted MOCK_ONLY. Genuine merchant-authenticated validation/transaction/amount/currency/risk evidence pending.|
|6 Idempotency/replay/concurrency/fraud|BLOCKED, deterministic subgate PASS|64 accepted checks retained. New scoped budget/forwarding/ownership tests PASS; genuine session replay/duplicate/forged notification effects still pending.|
|7 Persistence and role consistency|BLOCKED|[79 injected UI checkpoints](../../output/playwright/phase3/browser-acceptance.json) accepted, not genuine provider evidence. Genuine durable state and real customer/staff/admin service views pending; no claim of repeated full UI acceptance.|
|8 PAID versus FULFILLED|BLOCKED|Source and deterministic evidence preserve boundary; genuine payment must prove Booking remainsPENDING and no supplier action.|
|9 Final regression/fixture preservation|NOT TESTED|New changed-source targeted checks pass; genuine owned final ledger, in-memory unrelated preservation and final source applicability remain pending. No deletion authorized.|
|10 Formal Phase3 acceptance|BLOCKED|Requires all mandatory gates above and actual evidence adjudication. No automatic acceptance from harness exit0.|

## Current execution boundary

Owner's limited risk acceptance permits preparation only. Genuine public/provider/DB execution needs ONE separate approval of the [pinned coherent batch](../../output/phase3/genuine-sandbox-e2e-20261104-01/REVIEW.md).
Normal frontend3000/Main-backed5000 remain outside the harness. New ephemeral loopback callback plus private landing; unchanged strict SSH pin and TLS. No cloud/migration/refund/SMTP/supplier/cleanup.

Exact [fixture ledger and limits](../../output/phase3/genuine-sandbox-e2e-20261104-01/fixture-plan.json):
3Booking/3Passenger/3initialHistory/3Payment maximum,6financialHistory,36event attempts,18queuedOutbox,90payment saves,100store transactions.
Provider3initiation/12query/6validation;12callback admissions/24denied financial requests.
0User/Account/Session/Refund/deletions. Existing fixtures and unlisted records protected.
30minute run; owner manually completes only synthetic provider Checkout cases.
Preflight failure before writes/provider stops; partial execution retained, no retry.

## Evidence interpretation and remaining owners

Engineering completed offline harness/security/contract checks; verification.json in the reviewed folder supplies final counts and source pins.
Live identity, credentials, proxy spoofing behavior and provider outcomes are explicitly NOT verified during offline preparation.
Owner: one bounded execution approval, then existing restricted-role password privately and manual genuine sandbox checkout.
Provider: actual hosted channels, successful/failed/cancelled outcomes, realIPN and authoritative responses. Unsupported or missing outcome remains pending, never simulated.
Engineering: inspect actual result/ledger, final targeted regression and preservation, then formal acceptance only with all criteria met.
Separate cleanup approval only if needed. Phase4 cannot start before formal Phase3 acceptance.

Official contracts: [SSLCommerzV4](https://developer.sslcommerz.com/doc/v4/) and [localhost.runHTTP](https://localhost.run/docs/http-tunnels).
Historical diagnostic folders/callers/markers remain immutable; no old workflow rerun.
