# Genuine negative procedure research — 2026-11-04

Outcome: no verified deterministic Hosted Checkout FAILED or CANCELLED procedure found in reviewed sources. This is a bounded research result, not proof that SSLCommerz cannot offer such a facility. No new payment session/provider transaction query/database/tunnel execution. Existing authenticated dashboard and linked documentation were read without login/changes/submission. No private identifiers or credential values are copied here.

## Preserved acceptance
- Phase1 local G7 ACCEPTED: docs/proposals/PHASE_1_EVIDENCE_LOG.md formal local G7 entry (line1244). Historical blocked statements are superseded only for accepted local/synthetic slices.
- Phase2 FORMALLY ACCEPTED14/14: docs/proposals/PHASE_2_ACCEPTANCE_REPORT.md and output/phase2/phase2-formal-acceptance-20261102.json.
- Rename FORMALLY VERIFIED: output/database/local-rename-closure-20261102/rename-acceptance.json; database flywithsafety_local_integration/OID34701,oldname absent,5file6literal reference patch applied,admin/restricted postchecks PASS.
- Final local reconciliation: output/phase3/final-local-reconciliation-20261104-01/result.json and caller-result.json; actual passedtrue/exit0,8migrations/4actors/2recipients/23owned rows,success untouched,incomplete intent retained,2rollbacks,preservationtrue,providerCalls0/financialWrites0/mainCloudfalse. PROCESSING is historical observation only,not re-queried.

## Future release obligations (not reopened local gates)
Gate B real sensitive-data activation and Gate C production readiness;production privacy/legal/KMS custody/IAM/retention/recovery;explicit cloud migration/deployment approval;real supplier inventory/contracts/data-transfer/fulfillment obligations remain separately gated future-release work. They are not waived and no production authorization is inferred. Missing genuine Phase3 negative tests remain mandatory NOW,not moved to these future gates. Phase4 stays ON HOLD.

## Candidate assessment
|Candidate|Official support / Hosted?|Genuine outcome established?|Return/IPN contract and acceptance decision|
|---|---|---|---|
|Official sandbox test cards|Official V4 sandbox inputs; Hosted capable|Success flow documented; deterministic decline action not found|Does not alone prove FAILED. Need provider-supported specific action plus genuine status/return/IPN as applicable. No invented card or OTP attempted.|
|fail_url and cancel_url|Official Hosted callback destinations|Callback semantics defined; no specific verified UI action|Authentic matching return plus authoritative transaction outcome and required IPN evidence could satisfy negative gate, but URL configuration itself cannot.|
|Popup X/browser close/session timeout|No verified deterministic negative procedure|No; incomplete intent remains unresolved|Must not label FAILED/CANCELLED. PAY-disabled cause remains unproven; no new checkout opened.|
|Dashboard Self-Test/IPN Testing|Official tool observed live through authenticated dashboard navigation|Input requires an already successful sandbox payment|Replays/checks IPN listener; not a negative transaction generator. Not executed and not needed for accepted SUCCESS.|
|Invoice cancellation|Official separate Invoice API action invoiceCancellation|Invoice state, not established Hosted transaction cancellation|Outside accepted Hosted test scope; cannot satisfy current CANCELLED gate. Not called.|
|Official PHP Hosted/Laravel integrations|Official source; Hosted examples and fail/cancel handlers|They consume callbacks; do not document a deterministic negative generator|Sample local order status Processing/Canceled must not be conflated with provider query PROCESSING/CANCELLED. Do not copy callback-only local updates as financial authority.|
|Community integration code/discussions|Unofficial; route/SDK examples|No verified deterministic method in reviewed material|Useful implementation reports,not provider policy or genuine outcome evidence.|
|Merchant dashboard controls/manual|Authenticated current overview+Self-Test inspected; official legacy manual reviewed|No negative generator identified in inspected surfaces|Current overview exposes operations/settings/support; no setting edited. This is not an exhaustive audit of every hidden dashboard capability. Legacy manual does not prove current sandbox controls.|

## Sources reviewed
1. Official V4 integration https://developer.sslcommerz.com/doc/v4/ — sandbox cards,return/IPN/Order Validation contracts.
2. Official current sandbox docs https://sandbox-gw.sslcommerz.com/docs — equivalent callback/test setup.
3. Official Transaction Query https://sandbox-gw.sslcommerz.com/doc/v4/order-query.html — status enum does not establish PROCESSING terminal meaning.
4. Official live observed Self-Test https://sandbox-gw.sslcommerz.com/docs/self-test — successful-transaction prerequisite; no submission.
5. Official Invoice cancellation https://developer.sslcommerz.com/doc/v4/invoice.html — separate invoice action.
6. Official PHP source https://github.com/sslcommerz/SSLCommerz-PHP/blob/master/example_hosted.php and https://github.com/sslcommerz/SSLCommerz-PHP/blob/master/lib/SslCommerzNotification.php — Hosted initiation/callback URLs.
7. Official Laravel source https://github.com/sslcommerz/SSLCommerz-Laravel/blob/master/app/Http/Controllers/SslCommerzPaymentController.php — fail/cancel handlers,local business status names.
8. Official merchant manual https://merchant.sslcommerz.com/app/webs/attdoc/UserManualV3.pdf — legacy dashboard/search/IPN context; age limits applicability.
9. Community author example https://stackoverflow.com/questions/68275177/how-can-i-integrate-sslcommerze-to-my-django-app — session initiation/return URL example,no deterministic negative action found.
10. Community package source https://github.com/dgvai/laravel-sslcommerz and https://github.com/ShiponKarmakar/sslcommerz-whmcs/blob/main/README.md — route/status handling,not authoritative sandbox test procedures.

Availability limits: StackOverflow generic search and selected GitHub issue/nodejs repository pages failed to fetch; not counted as reviewed evidence. No merchant credential read or changes; dashboard password stayed masked. No demo/payment initiation page opened. No existing SUCCESS/query/transport suite repeated.

## Exact remaining provider-dependent gate
Need official Hosted Checkout steps that produce FAILED and CANCELLED (including PAY prerequisites),the expected authentic POST-return/IPN/query/validation status for each,and safe disposition of an old PROCESSING intent for the strict continuation eligibility guard. Then adapt/re-pin the existing two-fresh-fixture negative continuation ONLY; new public/provider/DB approval remains required. Require matching genuine authority,negative persistence/roles/replay/idempotency,protected success and final negative-run reconciliation before formal acceptance. No new diagnostic execution proposed.

One next owner action: follow up the existing SSLCommerz Integration Support ticket for that exact written procedure/contract clarification. Do not send secrets or manually mutate merchant transaction state.
