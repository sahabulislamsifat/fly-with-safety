# Partial genuine v02: SUCCESS preserved, negative continuation BLOCKED

2026-11-04,Asia/Dhaka. $0. Phase3 NOT ACCEPTED; Phase4 ON HOLD.
This is offline analysis and a versioned continuation PLAN, not an approved or
execution-ready caller. No live DB/provider/public connection was made here.

## Saved evidence and timeout

Source ../genuine-sandbox-e2e-20261104-02/result.json,ledger.jsonl,owned-final.json,
return-success.png and pinned main.ts. Start17:57:10Dhaka. SUCCESS adjudicated
17:59:55 after actual signedIPN/303success return/private browser render. FAIL
session created17:59:55.202. Result file written18:06:57. About422seconds elapsed
from FAIL session creation to final result, including navigation/cleanup. Exact
wait-start/timeout/browser-close events were not logged; do not invent timestamps.

Unique source of BOUNDED_STAGE_TIMEOUT in genuine-fail is bounded(wait,420000):
hasReturn && processed matching-source callback; success additionally requiresIPN.
FAIL has neither return landing nor fail callback; no FAIL financial origin receipt.
FAIL payment remainsSESSION_READY/capturedfalse, onlyINTENT+SESSION_READY events.
Thus this is owner/provider interaction not completed within the7minute runner
window, NOT a genuineFAILED payment. Outer30minute deadline had not elapsed.
Catch records timeout; finally closes the owned browser and SSH. Browser closing
is intended timeout cleanup, not demonstrated app crash/provider cancellation.
Original run did not capture why PAY was disabled or the owner's actions.
Owner subsequently confirmed: PAY disabled, noFail/Decline/Cancel control visible,
X not clicked, no payment submitted forFAIL. X behavior remains unverified.

## Actual preserved genuine SUCCESS

Owned success payment e0c1909f-17f9-4375-a04c-492291f4750a isVERIFIED,capturedtrue;
booking bb4b0355-69c4-42ab-aa41-3d246652fe8a remainsPENDING. Signed actualIPN and
success return processed; browser generic local landing screenshot inspected.
Ledger authoritative validation entries reportVALID/VALIDATED,1200000minorBDT,
riskfalse,transactionOwnedtrue,val/bank IDs present. No supplier action.
Customer/staff/admin service views and other-customer denial passed. One financial
History and3queuedOutbox rows, no SMTP. Owner replay notices are not calledIPN.
Saved preservationtrue and connectorStoppedtrue; source counters within all caps.
This validates saved PostgreSQL evidence, NOT a new live DB read this turn.

Persisted owned rows:3Bookings,3Passengers,4Histories,2Payments,8Events,3Outbox=23.
SUCCESS owns14 linked rows, incompleteFAIL6, unstartedCANCEL3. Event counter10 is
attempts;2ON CONFLICT duplicates did not insert. CANCEL has no payment. No row
deletion, correction, session re-initiation or new source modification to v02.
Fresh exact-identity/ownership/poststate verification is required before continuation.

## Rate-limit warnings and prepared narrow correction

Existing router uses express-rate-limit default keyGenerator. Isolated Express
trust proxy=false plus X-Forwarded-For producesERR_ERL_UNEXPECTED_X_FORWARDED_FOR;
default keyGenerator plus Forwarded producesERR_ERL_FORWARDED_HEADER. Official
library docs identify these as configuration warnings logged during validation.
ActualSUCCESS303/IPN200 passed despite them; no evidence they caused FAIL timeout.
No rate-limit429 is saved. Do not call warning text a financial rejection.

Prepared server/test/phase3-fail-cancel/callback-limit.ts uses an explicit shared
run bucket AFTER an unforgeable server-side admission WeakSet and loopback check,
with global trust proxy stillfalse. Client XFF/Forwarded identity is never parsed
or trusted for bucket keys; spoofing cannot get a fresh bucket. Existing60/min and
reviewed total callback budget remain. No validate:false, header removal or scheme
bypass. Ingress still enforces exact Host/HTTPS/method/path/framing before marking.
Production callback router remains UNCHANGED. This tested component is not yet
wired into an executable continuation. A future factory limiter dependency seam
must preserve production defaults and be tested before any approval request.

## Official negative-test method: real blocker

Reviewed officialV4 docs and official SSLCommerz SDK examples. They document
test cards, fail_url/cancel_url/IPN contracts and validation/query APIs. No verified
deterministic decline card/OTP, force-fail parameter or this UI'sX behavior was
found. The newer sandbox-gw docs were indexed but could not be fetched reliably.
Cannot infer wrongCVV/expired/random cards createFAILED; cannot treat close/timeout
asCANCELLED. Must obtain provider-supported current HostedCheckout instructions.
PAY-disabled prerequisites also need provider clarification; not an application
failure proved by these captures. Do not open a new session merely to guess.

## One coherent FAIL/CANCEL-only continuation after methods confirmed

1. Freeze all v02 evidence and SUCCESS rows as protected baseline. Recheck exact
   localDB/role/OID34701,8migrations/actors and23owned rows/read-only state with no
   SUCCESS provider re-test. Include SUCCESS in unrelated-preservation snapshot.
2. In same separately approved workflow, allow one authenticated HTTPS query of
   old incompleteFAIL tranID only; no initiate/refund/local financial update for
   it. If provider reports paid/unresolved/ambiguous state, STOP for reconciliation.
   No automatic re-initiation of its existing request/payment/booking.
3. Old storage key was process-only and is gone; callback hostname was ephemeral
   and stopped. Do not attempt to decrypt/reopen/reassign old Checkout or change
   accepted quotes. Fresh exact-owned negative-case fixtures/session URLs may be
   necessary under separate bounded approval; never reuseSUCCESS. Reuse untouched
   CANCEL booking only if quote/window/absence/ownership remain verified; otherwise
   review fresh fixture IDs explicitly. No implicit quote renewal or fixture writes.
4. Owner-ready gate BEFORE each initiation; written supported instructions and
   explicit READY action. Start case timer after checkout navigation. Prepared
   OwnerCaseWindow component has max20minutes/case; readiness<=5min/case and total
   proposed batch<=55min. Warn at5min/1min/10sec; journal start/deadline/remaining,
   callback predicates and exact cleanup reason. No unbounded waits/auto-extension.
   These time components are tested but not yet integrated in a new executable.
5. Actual provider failure/cancel controls only. Browser X action is tested only
   if officially specified; browser-close alone is never payment cancellation.
   Preserve TLS/strictSSH pin/callback guard/spoofing gate. No repeated7smoke cases.
6. Expected genuineFAILED/CANCELLED must agree with authoritative transaction
   query and actual return; record actualIPN separately when provider supplies it.
   UnexpectedVALID/risk/amount/currency/identity mismatch must abort, not become a
   synthetic negative result. Reuse accepted64/79 security/role components; finish
   deferred forged/unknown callback negatives against new negative fixtures only.
7. Review exact new fixture IDs and calculated write/provider caps, timestamps,
   callback-limiter seam, invocation, hashes and nativePS5.1 BEFORE execution approval.
   No caller exists yet because supported outcome triggers/current state are unknown.
   One future approval covers this coherent batch; no automatic retries, refunds,
   supplier fulfillment, schema changes, cloud access or cleanup.
8. Final protected SUCCESS/unrelated snapshot equality and exact financial ledger;
   targeted changed-source regression; no formal acceptance until all gates met.

## Single owner action now

Ask SSLCommerz Integration Support for official current sandbox steps to trigger
FAILED and CANCELLED in HostedCheckout, whether top-rightX POSTs cancel_url/IPN,
and prerequisites that enable PAY. A ready-to-send non-secret request is in
OWNER-SUPPORT-QUESTION.txt. Do not send credentials, session URLs, real cards or
callback payloads. No message was sent by the agent. Provide the official reply/link
before approving another negative-payment execution.

Sources reviewed: https://developer.sslcommerz.com/doc/v4/ ;
https://github.com/sslcommerz/SSLCommerz-NodeJS/blob/master/readme.md ;
https://github.com/sslcommerz/SSLCommerz-Python/blob/master/README.md ;
https://express-rate-limit.mintlify.app/reference/error-codes .
