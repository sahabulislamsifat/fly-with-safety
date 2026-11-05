# ONE retained incomplete-intent query — approval required, not executed

## Version02: complete redacted response observation, unchanged strict parser

Actual v01 completed8migration/4actor/23owned-row guards,2controlled rollbacks and
preservationtrue with1provider call; parser returnedMALFORMED. No raw response,
HTTP/content classification,envelope or field-type observation was saved. Exact
historical cause cannot be recovered. Do not claim an authentication,expiry,
amount/status or protocol error without evidence. v01 remains consumed and intact.

This version reuses its EXACT oneQuery wrapper/SDK/parser unchanged. A transport
observer reads only a bounded131072byte clone for classification, then returns the
ORIGINAL Response to the strict SDK. No values coerced,fields defaulted,outcome
invented or provider body altered. Allowed metadata: HTTP status,content-type enum,
JSON shape,APIConnect/status allowlist,element type/count,known field types,
amount/currency/transaction match booleans,risk-value recognition,identifier-presence
booleans and exact parser failure-path labels. No raw body/arbitrary key names,
credential,URL,card/bank/transaction/validation ID values or secret hashes. Unknown
statuses remainOTHER and diagnosticOnly; they never authorize capture or acceptance.
Record metadata persists on MALFORMED as well as successful parsing. Oversize/HTML/
invalidJSON/envelope/record/type/mismatch cases are tested offline; valid responses
still take the original strict path. This repairs a confirmed observation gap,
NOT a proven provider or financial-parser bug. A new one-shot query requires fresh
approval because v01's external authorization was consumed.

New entry server/test/phase3-query-observation/main.ts;
flag --owner-approved-retained-query-v02. Same PS switch OwnerApprovedRetainedQuery,
target/role/OID/caps/readonly snapshots and outcome bound as below. No original
execution source,caller,manifest or result is edited. No production parser changes.

2026-11-04 Asia/Dhaka,$0. Phase3 NOT ACCEPTED; Phase4 ON HOLD.
Support-independent progress: read official current status of the exact previous
SESSION_READY intent. Do not create a new session, synthetic payment or public UI.
This is not another transport/Checkout diagnostic, and needs no support response.

## Exact authorized scope to request

Caller Invoke-RetainedQuery.ps1 -OwnerApprovedRetainedQuery verifies manifest,
source/runtime hashes and absence of caller/runner attempts; creates a distinct
one-time marker, then masked EXISTING local restricted-role password input. No
password in args/history/files. Clean child env and URL/DIRECT parity. Runner
requires --owner-approved-retained-query-v02 and PHASE3_RETAINED_QUERY_APPROVED=true.
Original consumed callers and unexecuted negative continuation are never run.

Exact local127.0.0.1:5432/flywithsafety_local_integration,restricted role
flywithsafe_phase2_booking_test,OID34701. Server default_transaction_read_only=on,
explicit READ ONLY transactions; connection/statement10s,query15s,transaction30s,
parent outcome wait110s. Native identity/current readonly mode first. Reuse the
live-proven corrected helper for8migration checksums,4actors/2staff,permissions
and planned-new-fixture absence. Exact saved23owned rows/ownership/financial IDs
must match, including immutable genuineSUCCESS. A full protected snapshot stays
in memory; controlled ROLLBACK before any provider request, no lock over HTTP.

Only if all guards PASS: privately read ONLY sandbox flag/StoreID/password from
existing server/.env through dotenv.parse; no env-file edits or cloud target selection.
One existing SSLCommerzClient.query call, GET to official sandbox
/validator/api/merchantTransIDvalidationAPI.php, exact old incomplete tranID from
verified saved/DB state. API auth stays in verified HTTPS as documented; full URL,
credentials,identifier and response payload are NEVER logged/persisted. Redirects
are refused, response bounded128KiB/10s. Transport wrapper permits ONLY this GET,
exact store/transaction identity and one attempt; no automatic retry on failure.
No session/initiation/OrderValidation/refund/IPN replay/SMTP/supplier operation.
Unused callback/frontend fields and process-random key exist only to satisfy the
existing client type; no callback/service/payment-store is constructed or used.

Provider outcome summary: enum status/risk,record count,matching and private-ID-
presence booleans only. No-record/multiple/PENDING/VALID/risk cannot authorize
continuation or local capture. EXPIRED staysEXPIRED, notFAILED. Even an actual
FAILED/CANCELLED query result is not full browser-return/IPN E2E acceptance.
This query cannot mark an old payment PAID/FAILED/CANCELLED or update Booking.

Then ONE final readonly protected snapshot+retained-row comparison/ROLLBACK,
including after provider failure when a baseline exists. Postcheck attempt is
tracked separately, never retried. NativeSQLSTATE/adapter/gateway enums only;
arbitrary error messages/raw payloads are excluded. No merchant secret/key hashes.
All local records and original evidence retained on any error. Normal3000/5000,
Main/Staging Cloud and all public connector processes remain untouched.
If process deadline/outcome is unconfirmed report owned PID and STOP; no unrelated
kill, repair or command rerun. No new tunnel or browser is created.

Maximum business mutations0,SQL schema/privilege changes0,initiation0,validation0,
refund0,provider transaction queries1,public endpoints0. Execution approval for
this procedure does not authorize a negative-payment continuation or UI session.

## Official findings and remaining UI uncertainty

Reviewed https://developer.sslcommerz.com/doc/v4/ and current
https://sandbox-gw.sslcommerz.com/docs on2026-11-04. They document fail_url,
cancel_url,query API,statuses and test cards. No verified deterministic decline
recipe or documented top-rightX semantics was found. A UI close/expired session
must not be classified genuineFAILED/CANCELLED. The previousFAIL capture contains
no provider DOM/validation/JS resource errors; disabledPAY cannot be attributed
to validation,expiry or browser state from current evidence. No current
transaction-bound Checkout was reopened to guess. Store status query may resolve
intent state, not retrospectively prove the disabled-button cause.

Current official IPN diagnostics:
https://sandbox-gw.sslcommerz.com/docs/self-test?section=ipn-testing explicitly
requires an already successful sandbox transaction. It is a listener test, not a
documented decline/cancel generator. It was NOT run; no successful payment is replayed.
Official query example:
https://sandbox-gw.sslcommerz.com/docs (OrderQuery/QuerybyTransactionID section).

## Offline validation and preserved evidence

New mocked tests verify exactly-one GET,concurrent/repeated-call refusal,no retry,
redirect/merchant/amount/currency/transaction mismatch rejection,risk and successful
outcomes not authorizing capture,empty/multiple results not invented failures,
and unapproved entry refusal. No genuine API/DB connection in tests. Existing48
tests,1473checks,7transport/64PG/79browser and genuineSUCCESS are retained,not rerun.
Review verifies historical inventory102+all25v02 artifacts and existing continuation
source/runtime hashes. Prior mutable matrix is archived byte-for-byte before the
owner-requested current matrix update. Old caller/manifest bytes stay unchanged.

Only after separately approved execution will its saved result be interpreted.
Negative methods remain pending official evidence; missing gates are never PASS.


