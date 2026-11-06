# Phase 3 consolidated acceptance matrix

**Final verdict: ACCEPTED AND CLOSED · 10/10 original gates PASS.** The [final matrix and owner decision](#final-acceptance-after-cancelled-v01) supersede the historical assessments below. Production release obligations are tracked separately.

Assessment:2026-11-04 Asia/Dhaka. Phase3 NOT ACCEPTED; Phase4 ON HOLD; budget $0.
Phase1G7/Phase2 14/14 remain ACCEPTED. This matrix reports saved evidence and offline
checks; no fresh DB/provider/public operation was performed for this update.
Previous matrix is preserved in output/phase3/negative-continuation-20261104-01/previous-phase3-matrix.md.

|Gate|Evidence accepted now|Status / remaining requirement|
|---|---|---|
|1 Public HTTPS/boundary/TLS|[7/7 synthetic](../../output/phase3/localhost-run-injection-v01/result.json), v02 spoofing negatives and genuine SUCCESS return/IPN|Partial PASS; fresh exact-origin/spoof gates required for continuation. Owner's TOFU/HTTPS-termination acceptance is sandbox-only, not production trust.|
|2 Isolated runtime/DB|[Corrected read-only PASS](../../output/phase3/db-preflight-readonly-20261104-01/result.json):OID34701/8migrations/4actors/2staff/340catalog rows/rollback|PASS evidence preserved; current DB/23retained rows/new fixture absence/caps/credentials must be freshly reverified under execution approval.|
|3 Genuine Hosted Checkout|[v02 SUCCESS](../../output/phase3/genuine-sandbox-e2e-20261104-02/result.json) VERIFIED,captured|Partial PASS; genuine FAIL/CANCEL NOT TESTED. Incomplete FAIL is SESSION_READY; latest observed provider token PROCESSING is unresolved and outside reviewed query enum.|
|4 Browser return/IPN|Actual signedSUCCESSIPN,303return,rendered local landing|Partial PASS; official negative actions/IPN expectations pending. Timeout or popupX is not a genuine negative outcome.|
|5 Authority/matching/risk|Genuine SUCCESS validation VALID/VALIDATED,amount1200000minorBDT,riskfalse,ownedtransaction; [ledger](../../output/phase3/genuine-sandbox-e2e-20261104-02/ledger.jsonl) private local evidence|Partial PASS; negative authoritative results still required. Added SIMULATED mismatch/risk tests are not provider acceptance.|
|6 Replay/concurrency/fraud|64accepted PG mock-gateway checks, genuine success initiation/replay, new targeted simulated callback/concurrency/idempotency/forgery tests|Partial PASS; deferred genuine-run forged/unknown/negative replay checks and final adjudication pending.|
|7 Persistence/roles|Saved genuine SUCCESS payment +PENDINGbooking, customer/staff/admin service consistency and other-owner denial;79injectedUI checkpoints retained|Partial PASS; FAIL/CANCEL persistence/role consistency and final fresh read-only reconciliation pending. No claim of genuine new UI79run.|
|8 PAID/FULFILLED|Genuine SUCCESS bookingPENDING, no supplier action; simulated negative/risk/separation tests PASS|Partial PASS; continuation final state and protected-success comparison required.|
|9 Regression/preservation|[v02 preservationtrue](../../output/phase3/genuine-sandbox-e2e-20261104-02/result.json);23saved owned rows reconciled; immutable inventory +new offline test pack|Partial PASS; live final snapshot/retained-row equality and targeted postexecution regression not yet run. No cleanup authorized.|
|10 Formal acceptance|All evidence retained; no financial PASS inferred from offline tests|BLOCKED until official FAIL/CANCEL procedures, actual negative provider scenarios, final reconciliation and explicit acceptance review.|

## Actual offline implementation

[Versioned continuation review](../../output/phase3/negative-continuation-20261104-01/REVIEW.md)
implements the isolated callback limiter after unchanged ingress, fresh2-case scope,
new provider/store caps, real service/callback wiring, owner-ready private forms,
20minute timer only after navigation,65minute run bound, protected previousSUCCESS
and old-incomplete-intent preflight, final read-only snapshot checks and exact ledger.
Production code/global proxy settings are unchanged. No old caller is reused.

support-procedure.json is deliberately PENDING_OFFICIAL_SUPPORT. Both PS and runner
refuse BEFORE private credentials/DB/tunnel/provider work. Confirmation/source/actions
must be reviewed, pinned again, and separately approved; filling text alone is not
execution authorization. Card/OTP/session/credential content is excluded from artifacts.

## Remaining gates and owners

Support alone blocks: documented deterministic FAILED action, exact popupX/cancellation
semantics, expected negative API/IPN status and PAY-disabled prerequisites. Owner must
provide official reply/link; no guessed cards/OTP/action or callback fabrication.

Separate live approval also remains necessary (not a support-only blocker): current
DB/fixture recheck, one bounded query of old incomplete FAIL without changing it,
public ingress activation,2fresh negative Checkout cases and final persistence/security
checks. Provider paid/pending/ambiguous old intent stops before new writes. No success
replay, refunds, migrations, roles, SMTP, supplier calls, cloud writes or deletion.

[Offline verification](../../output/phase3/negative-continuation-20261104-01/verification.json)
lists actual PASS counts, hashes and method/flag checks. Accepted7/64/79 not rerun.
History stays in immutable execution folders; this current matrix is intentionally mutable.


## 2026-11-04 support-independent acceleration

A [single retained-intent read-only query](../../output/phase3/retained-intent-query-20261104-01/REVIEW.md)
is prepared for separate approval. It has no Support-method prerequisite: local
identity/OID34701/8migrations/23owned rows and protected snapshots, then at mostONE
GET Transaction Query for the old incompleteFAIL. No public endpoint,session,
validation,capture,refund or DB business write. Actual result is NOT YET TESTED.
No SUCCESS provider request is repeated. This can resolve authoritative intent
status while support is pending, but cannot prove missing browser return/IPN.

Current official docs confirm IPN diagnostics require an already successful sandbox
transaction; that tool is not a genuine FAILED/CANCELLED generator and is not run.
No documented forced decline or X-action cancellation procedure was established.
Current transaction-bound UI cannot be observed without separate session approval;
previous missing FAIL DOM/network evidence prevents diagnosing disabledPAY.
Expiry,validation and browser-state explanations remain unproven hypotheses.

Gates1/3/4/5/7/8 retain genuineSUCCESS partialPASS; gate2 current readonly query is
approval-pending; gate6 accepted offline evidence remains intact; gate9 final live
preservation remains pending; gate10NOT ACCEPTED. No financial/security gate is
weakened. See query package verification.json for new focused tests/pins. Existing
48simulated tests/1473checks and7/64/79accepted proofs were not rerun.

## Latest actual retained-query result and precise blocker

[Consumed queryv01](../../output/phase3/retained-intent-query-20261104-01/result.json):
8migrations/4actors/2staff/23owned rows verified;2controlled rollbacks;preservationtrue;
financialWrites0,providerCalls1,publicConnections0. GenuineSUCCESS is unchanged.
Only provider-response parsing failed withMALFORMED. No response envelope/type/HTTP
metadata was saved; historical exact cause is unrecoverable and not guessed.
The incomplete intent remainsSESSION_READY/provider outcomeUNKNOWN; no FAILED,
CANCELLED orEXPIRED outcome is inferred from this parser failure.

A [versioned one-query observation](../../output/phase3/retained-intent-query-20261104-02/REVIEW.md)
is prepared offline, not executed. It repairs diagnostic persistence using bounded
redacted metadata while retaining the unchanged strict SDK and original response.
It requires fresh single-query approval; no new Checkout,tunnel or business writes.
The live local-preservation subgate is now PASS for this query; authoritative old
intent status, genuine negative outcomes and final complete acceptance remain pending.
Phase3 NOT ACCEPTED,Phase4 ON HOLD; accepted SUCCESS/7/64/79 are not repeated.

## Actual v02 retained-query observation — status enum unresolved

[Saved v02 result](../../output/phase3/retained-intent-query-20261104-02/result.json): HTTP200 JSON/APIConnect DONE, one record; transaction, amount and currency match. Only STATUS_ENUM failed. Unknown status was collapsed to OTHER; exact spelling was not persisted, so no FAILED/CANCELLED/EXPIRED outcome can be inferred. Two controlled rollbacks,23 owned rows and preservation PASS; SUCCESS untouched; zero financial writes/public connections.

[Status-only readback review](../../output/phase3/retained-status-readback-20261104-01/REVIEW.md) repairs that diagnostic gap offline, preserving the original response and strict SDK. It is NOT executed and requires fresh one-query approval. Accepted 48 simulated/7 transport/64 PostgreSQL/79 browser evidence remains unchanged. Genuine FAIL/CANCEL, final full reconciliation and formal acceptance remain pending. Phase3 NOT ACCEPTED; Phase4 ON HOLD.

## PROCESSING discovery — final status-only readback consumed

[Actual saved readback](../../output/phase3/retained-status-readback-20261104-01/result.json): exact token PROCESSING (STRING,length10,no whitespace), HTTP200/APIConnect DONE, transaction/amount/currency matching; only STATUS_ENUM failed. This is an observed unresolved provider state, NOT PENDING, FAILED, CANCELLED or successful payment. Latest saved guards verify local identity/eight migrations/four actors/two staff/23 owned rows, two controlled rollbacks and preservationtrue; SUCCESS untouched. No new live verification was run in this offline change.

Small SDK correction: PROCESSING still throws MALFORMED and returns no Evidence; its safe unresolvedStatus tag is PROCESSING. No enum expansion, normalization, retry, business-state update, payment capture or fulfillment. Unknown statuses remain rejected. Historical pre-change SDK and matrix are archived in processing-resolution-20261104-01; consumed packages are unchanged and intentionally cannot be reused after source pins change.

Official review: [V4 Query](https://sandbox-gw.sslcommerz.com/doc/v4/order-query.html) lists VALID/VALIDATED/PENDING/FAILED, not PROCESSING. [V4 integration](https://developer.sslcommerz.com/doc/v4/) documents callback semantics/test success credentials but no verified deterministic forced-decline or popup-X cancellation action was established. No new Checkout UI was accessed; PAY-disabled cause remains unknown. Support must clarify PROCESSING and genuine FAIL/CANCEL actions/expected callback and IPN statuses. A simulated IPN tool or session timeout cannot satisfy those gates.

Negative continuation remains offline-ready but execution BLOCKED: procedure PENDING and old-intent terminal eligibility not established. Its existing guard stays fail-closed; no third status query is proposed. After official clarification, source pins and reviewed procedure must be updated before a separately approved fresh FAIL/CANCEL-only batch. Fresh DB/fixture/caps/spoof gates and final preservation are still mandatory. Existing 48 simulated tests/1473 checks,7/64/79 and genuine SUCCESS evidence are retained, not provider negative acceptance. Final targeted live reconciliation/gates3–9 remain partial; gate10 BLOCKED. Phase3 NOT ACCEPTED;Phase4 ON HOLD;budget$0.

Processing correction verification: [63/63 focused offline tests and 1119 checks](../../output/phase3/processing-resolution-20261104-01/verification.json), including15 new PROCESSING cases;1009 historical pins checked with explicit pre-change SDK/matrix archives;102 historical artifacts unchanged. [Toolchain](../../output/phase3/processing-resolution-20261104-01/toolchain-result.json):strictTypeScript/lint/Node/nativePS5.1 and17 SELECT parsing PASS;no live operations. Previously accepted48 continuation simulations and7/64/79 proofs were not rerun.

## Final independent acceptance sprint — authoritative current disposition

|Gate|Formal status now|Evidence / exact remaining condition|
|---|---|---|
|1 HTTPS/TLS/exact public boundary|PASS (sandbox transport scope)|Accepted7/7 and genuine SUCCESS return/IPN; not rerun; future endpoint activation still needs live preflight.|
|2 Isolated DB/runtime|PASS (saved execution scope)|Latest readback identity/OID34701/8migrations/4actors/23rows; current final read-only check separately approval-pending.|
|3 Genuine provider outcomes|BLOCKED|SUCCESS PASS; FAILED/CANCELLED NOT TESTED. PROCESSING is unresolved, not a negative outcome.|
|4 Returns and IPN|BLOCKED|SUCCESS PASS; genuine negative returns/IPN expectations need official provider procedure and actual execution.|
|5 Authoritative matching/risk|BLOCKED (partial evidence)|SUCCESS validation/matching/risk PASS; actual negative authority missing; offline malicious checks retained.|
|6 Replay/idempotency/concurrency/authenticity|BLOCKED (final live negative adjudication)|64PG/79browser and focused simulated coverage accepted; new PROCESSING/service consistency tests added; no simulation upgraded to provider evidence.|
|7 Persistence/roles|BLOCKED (partial evidence)|SUCCESS role/ownership PASS; current23rows check prepared; negative persisted states not yet genuine.|
|8 Paid versus fulfilled boundary|PASS (implemented invariant)|Genuine paid booking PENDING; no supplier action; offline PROCESSING cannot capture or terminal-settle/fulfill.|
|9 Final regression/preservation|BLOCKED (live reconciliation approval)|Targeted offline work complete; local-only final reconciliation prepared; later negative-run reconciliation will still be required.|
|10 Formal Phase3 acceptance|BLOCKED|All mandatory negative provider and final evidence gates must pass. Phase4 ON HOLD.|

[Local-only final review](../../output/phase3/final-local-reconciliation-20261104-01/REVIEW.md) requests no provider calls. Old PROCESSING status is not queried again. Saved genuine SUCCESS and23rows remain immutable. This is not final acceptance of incomplete FAIL/CANCEL scenarios. Existing limiter/caps/20minute owner-confirmed stage/65minute run controls remain unchanged. Current merchant dashboard capabilities were not authenticated/observed; public official docs give callback meaning but no confirmed deterministic forced-decline/X-cancel action. External acceptance blocker remains specific provider-supported negative instructions plus actual missing outcomes; no application PASS inferred.

Sprint verification:11 new offline boundary/reconciliation tests PASS;1 focused IPN signature/tamper test PASS (47 unrelated SDK tests intentionally unselected). TypeScript/lint/15SELECT/Node/nativePS5.1 and1000pins PASS. Prior48 negative simulations,63SDK/regression,64PG,79browser and7transport evidence preserved rather than rerun. Live final local reconciliation has NOT executed. See [offline report](../../output/phase3/final-local-reconciliation-20261104-01/offline-result.json).

## Final read-only reconciliation accepted; negative procedure research

Actual final-local-reconciliation-20261104-01 result/caller-result independently read:passedtrue/exit0,23owned rows,SUCCESS untouched,uncaptured SESSION_READY retained,8migrations,2controlled rollbacks,preservationtrue,zero provider/financial/public/MainCloud operations. This independently completes the local reconciliation subgate; do NOT rerun it. Gate9 still requires reconciliation after future genuine negative execution.

Phase1 LOCAL G7,Phase2 14/14 and local rename FORMALLY VERIFIED remain accepted from existing records. GateB/GateC,production privacy/KMS/retention/cloud migration/supplier obligations remain separate future-release requirements; missing Phase3 provider gates are not deferred or waived.

[Focused negative-method findings](../../output/phase3/negative-procedure-research-20261104/FINDINGS.md):official V4/current sandbox/official PHP+Laravel/community sources reviewed. Existing authenticated merchant dashboard and its Self-Test were inspected read-only; IPN tool requires successful sandbox transaction,not a negative generator. No verified deterministic Hosted FAILED/CANCELLED method found; invoice cancellation/popupX/timeout/simulated callbacks cannot satisfy this gate. No claim that the provider has no such facility. Existing continuation/limiter/caps/source remain unchanged; no new caller or provider status diagnostic created.

Current ten-gate disposition:1PASS sandbox transport;2PASS saved isolated execution;3BLOCKED genuineFAILED/CANCELLED;4BLOCKED negative returns/IPN contract+evidence;5BLOCKED negative authority;6offline/replay/concurrency evidence PASS,final negative live adjudication BLOCKED;7SUCCESS/independent23row persistence PASS,negative persistence/role checks BLOCKED;8PASS paid-vs-fulfilled invariant;9independent local reconciliation PASS,post-negative reconciliation still pending;10BLOCKED formal acceptance. Phase3 NOT ACCEPTED;Phase4 ON HOLD;budget$0.

## 2026-11-05 production-parity negative contract and genuine UAT

**A. Implementation and MOCKED CONTRACT TESTS — complete within the local contract scope. B. Genuine provider UAT — pending FAILED and CANCELLED. Formal Phase 3 remains NOT ACCEPTED.**

The pre-change tracked source is recorded at Git commit `0e7f5ec0e39b7b7dde7f6a04cdda17069a12e9d8`. All 102 inventoried historical artifacts match their accepted hashes. The saved local reconciliation still reports preservation of 23 owned rows. Historical manifests describe their original source and execution scopes.

The existing callback form parser, signature verification, durable notice, authenticated Transaction Query, matching amount/currency/transaction checks, capture validation, payment history and authenticated return view remain the basis of the contract. The callback now reconciles the matching attempt directly. Transaction Query row `store_id` is checked when present. Signed negative IPNs with distinct statuses remain distinct notices. Duplicate notices stay idempotent. Conflicting terminal negatives reopen reconciliation. When a new notice arrives during a query, a negative result from that query is deferred and the next check remains due. This uses the existing mutable `due` field and lease, including same-millisecond arrivals. Captured success remains protected. The schema and deployment configuration are unchanged.

| Original gate | A. Implementation and local contract evidence | B. Genuine provider evidence |
|---|---|---|
| 1. Callback HTTPS and boundary | Accepted boundary retained. Form handling exercised in the actual router with an in-process HTTP request/response pair. | Existing transport proof retained. |
| 2. Isolated sandbox runtime | Default and production gateway rejection tested. Test provider and Prisma boundary mocked. | Existing isolated-runtime proof retained. |
| 3. Hosted outcomes | Confirmed negative branches tested with synthetic V4-shaped replies. | SUCCESS accepted. Genuine FAILED and CANCELLED pending. |
| 4. Return and IPN | Negative browser redirect, signed negative IPN acknowledgement and signature tamper rejection tested. | Genuine negative returns and applicable signed IPN pending. |
| 5. Authority and matching | Authenticated query, row/store and transaction/amount/currency mismatch, missing validation ID, unsupported status and query failure tested. | Matching authoritative negative outcome pending for each case. |
| 6. Idempotency and concurrency | Same-notice replay, simultaneous IPN, distinct IPN during a query, conflicting negatives and delayed result after capture tested. | Negative-run replay/security evidence pending. |
| 7. Persistence and role consistency | Actual store code exercised over a simulated atomic Prisma transaction. Event write fault rolls status back. Customer/staff/admin views and foreign owner denial tested. | Negative local PostgreSQL persistence and role checks pending in genuine run. |
| 8. Capture and fulfillment | Negative responses never capture. Captured success stays verified. Booking remains PENDING. | Existing SUCCESS boundary proof retained. |
| 9. Final preservation | Accepted local reconciliation retained. Compatibility checked against existing immutable-state trigger fields. | Protected reconciliation after genuine negatives pending. |
| 10. Formal acceptance | Local contract evidence accepted for A. | Pending the original genuine negative evidence requirements. |

[MOCKED CONTRACT TESTS](../../server/test/phase3-negative-contract.test.ts) passed 28/28. Server/client type checks, strict test TypeScript, scoped ESLint for six changed files and `git diff --check` passed. The initial loopback test transport hit sandbox EACCES. The final suite exercises Express without a listening socket and uses a mocked Prisma boundary. No new PostgreSQL execution or provider transaction occurred. Previously accepted suites were not rerun.

The official IPN contract lists `CANCELLED` and `EXPIRED`. The published Transaction Query table does not enumerate them. Their query branches are tested as synthetic compatible responses using the documented envelope shape. A callback status alone cannot establish the corresponding final outcome when the provider's authoritative response is unavailable or ambiguous. [V4 IPN](https://sandbox-gw.sslcommerz.com/doc/v4/ipn.html), [V4 Transaction Query](https://sandbox-gw.sslcommerz.com/doc/v4/order-query.html).

**Owner decision pending.** Authorize independent Phase 4 engineering under a separate scope while production payment activation stays blocked and Phase 3 remains formally unaccepted, or keep Phase 4 on hold until original acceptance. Phase 4 remains on hold pending that decision. This decision does not waive genuine negative UAT or approve supplier calls, production activation or database mutations.

## 2026-11-05 engineering closure

[Engineering Completion Report](PHASE_3_ENGINEERING_COMPLETION_REPORT.md) gives the current disposition of all ten gates. Saved negative integration evidence confirms real PostgreSQL 32/32 PASS, exit 0, with only the provider transport mocked. Both negative states persisted uncaptured, the constraint probe rolled back status and event, and the protected records were preserved. The [mandatory provider-UAT register](PHASE_3_MANDATORY_PROVIDER_UAT_REGISTER.md) remains open for genuine FAILED/CANCELLED and dependent checks. Engineering is complete within the reviewed scope. Original Phase 3 acceptance and production payment activation remain blocked. The proposed Phase 4 policy is pending explicit owner approval.

## Latest evidence matrix after genuine FAILED v03

| Original gate | Current disposition and evidence |
|---|---|
| 1. Public HTTPS, boundary, TLS | PASS for saved sandbox evidence. [FAILED v03 readiness](../../output/phase3/failed-uat-cloudflare-20261106-03/transport-preflight.json). Fresh CANCELLED readiness is part of its approved run. |
| 2. Isolated sandbox runtime | PASS for FAILED v03. [Restricted DB preflight](../../output/phase3/failed-uat-cloudflare-20261106-03/readonly-preflight.json). |
| 3. Hosted outcomes | SUCCESS and genuine FAILED PASS. Genuine CANCELLED pending. [FAILED v03 case](../../output/phase3/failed-uat-cloudflare-20261106-03/result.json). |
| 4. Return and IPN | FAILED v03 signed browser return and distinct genuine signed IPN PASS. CANCELLED evidence pending. [FAILED v03 journal](../../output/phase3/failed-uat-cloudflare-20261106-03/ledger.jsonl). |
| 5. Provider authority | Two authenticated FAILED queries matched transaction, amount and currency. CANCELLED authoritative evidence pending. [FAILED v03 journal](../../output/phase3/failed-uat-cloudflare-20261106-03/ledger.jsonl). |
| 6. Replay, concurrency, fraud | Retained local integration proof and genuine FAILED v03 replay PASS. CANCELLED replay pending. [FAILED v03 case](../../output/phase3/failed-uat-cloudflare-20261106-03/result.json). |
| 7. Persistence, roles and ownership | FAILED v03 uncaptured, roles consistent, foreign ownership denied. CANCELLED persistence pending. [FAILED v03 owned rows](../../output/phase3/failed-uat-cloudflare-20261106-03/owned-final.json). |
| 8. Paid versus fulfilled | FAILED v03 booking PENDING with empty outbox. CANCELLED boundary check pending. [FAILED v03 owned rows](../../output/phase3/failed-uat-cloudflare-20261106-03/owned-final.json). |
| 9. Final protected reconciliation | FAILED v03 protected reconciliation PASS with 23 retained rows and historical SUCCESS intact. Final post-CANCELLED reconciliation pending. [FAILED v03 postcheck](../../output/phase3/failed-uat-cloudflare-20261106-03/retained-postcheck.json). |
| 10. Formal Phase 3 acceptance | BLOCKED pending genuine CANCELLED evidence and final protected ten-gate review. Phase 4 ON HOLD. [Provider-UAT register](PHASE_3_MANDATORY_PROVIDER_UAT_REGISTER.md). |

[FAILED v03 SHA-256 evidence seal](../../output/phase3/cancelled-uat-cloudflare-20261106-01/failed-v03-evidence-seal.json) preserves the consumed package and its 19 files. [CANCELLED-only execution review](../../output/phase3/cancelled-uat-cloudflare-20261106-01/REVIEW.md) is subject to separate owner approval.

## Final acceptance after CANCELLED v01

| Original gate | Decision | Evidence |
|---|---|---|
| 1. Public HTTPS, TLS and exact callback boundary | PASS | CANCELLED readiness and 40 correlated HTTPS proofs, with signed exact-route return. [Ledger](../../output/phase3/cancelled-uat-cloudflare-20261106-01/ledger.jsonl) |
| 2. Isolated runtime and restricted DB | PASS | Restricted local DB identity, eight migrations and fresh fixture guard. [Preflight](../../output/phase3/cancelled-uat-cloudflare-20261106-01/readonly-preflight.json) |
| 3. Genuine Hosted Checkout outcomes | PASS | Genuine [SUCCESS](../../output/phase3/genuine-sandbox-e2e-20261104-02/result.json), [FAILED](../../output/phase3/failed-uat-cloudflare-20261106-03/result.json) and [authoritative CANCELLED](../../output/phase3/cancelled-uat-cloudflare-20261106-01/ledger.jsonl). This is the outcome gate. |
| 4. Browser returns and IPN | PASS | Owner approved the original conditional requirement for this transaction. Signed CANCELLED return and private landing observed. Genuine SUCCESS and FAILED IPNs verified. Separate live CANCELLED IPN `NOT_OBSERVED`, provider generation and dispatch `UNKNOWN`. See the adjudication below. |
| 5. Authoritative matching and risk | PASS | Exact transaction, BDT 12,000, authenticated store context and `risk=false`. [Query ledger](../../output/phase3/cancelled-uat-cloudflare-20261106-01/ledger.jsonl) |
| 6. Authenticity, replay, idempotency and concurrency | PASS | Genuine authenticated cancellation, exact saved notice key replay and same-key initiation tests using the real service over an isolated ledger. Conflict, concurrent delivery and signed IPN regressions passed. Prior real PostgreSQL concurrency and replay proof retained. [Closure tests](../../server/test/phase3-cancelled-closure.test.ts) · [PostgreSQL proof](../../output/phase3/negative-postgres-20261105-01/result.json) |
| 7. Persistence, ownership and role consistency | PASS | Saved genuine CANCELLED persistence plus identical customer, staff and admin payment views and foreign-owner 404 using the saved fixture identities in the real service. Prior real PostgreSQL role checks retained. [Owned snapshot](../../output/phase3/cancelled-uat-cloudflare-20261106-01/owned-final.json) · [Closure tests](../../server/test/phase3-cancelled-closure.test.ts) |
| 8. PAID versus FULFILLED | PASS | Uncaptured CANCELLED, PENDING booking, unchanged PENDING history and empty outbox. [Owned snapshot](../../output/phase3/cancelled-uat-cloudflare-20261106-01/owned-final.json) |
| 9. Targeted regression and protected reconciliation | PASS | Post-run targeted regression 12/12. Saved post-shutdown protected PostgreSQL reconciliation confirmed historical SUCCESS, FAILED v03 and 23 retained rows. Read-only fixture cross-check and FAILED artifact hashes 19/19 passed. [Closure tests](../../server/test/phase3-cancelled-closure.test.ts) · [Retained postcheck](../../output/phase3/cancelled-uat-cloudflare-20261106-01/retained-postcheck.json) |
| 10. Formal acceptance | PASS | Gates 1–9 passed and the owner-approved Gate 4 decision is recorded below. Phase 3 ACCEPTED AND CLOSED. |

The targeted run selected four new closure checks and eight existing CANCELLED/negative regressions. It passed 12/12 across three files, with 36 out-of-scope tests skipped. Strict TypeScript passed. The new tests reconstruct only required service inputs from the saved fixture and synthesize omitted fields. They do not represent a new live database replay or role check. Database persistence and protected reconciliation evidence comes from the completed UAT's saved post-shutdown read-only queries. Production code and consumed execution artifacts are outside the closure edits.

### Owner-approved Gate 4 adjudication

The [original requirement](PHASE_3_ENGINEERING_COMPLETION_REPORT.md#মূল-দশটি-acceptance-gate) calls for genuine returns and signed IPN evidence if the provider sends it. The [approved CANCELLED runner](../../output/phase3/cancelled-uat-cloudflare-20261106-01/REVIEW.md) required a separate signed IPN to pass that execution. Its recorded timeout and failed result are historical evidence. The [SSLCommerz clarification](https://mail.google.com/mail/u/0/#inbox/KtbxLthNQSfqtNmlrffvmgRHlmTPcjFPFg) describes IPN as a backup, and [V4 IPN](https://sandbox-gw.sslcommerz.com/doc/v4/ipn.html) lists CANCELLED as supported.

The owner explicitly approved the conditional assessment for sandbox transaction `FWSed46b7b83ed58a623140c5fbde`, subject to the original wording and the saved configuration check. The runner sets the registered Cloudflare HTTPS origin as the session callback base. The pinned session builder sends `ipn_url` at that same origin under `/api/v1/payments/sslcommerz/ipn`. The runner admits the exact IPN route and mounts its POST handler. All 313 source pins matched. The saved ledger records 40 successful origin-correlated forwarding proofs, the signed `POST /cancel` and no recorded callback rejection or delivery failure. Forwarding probes exercised `/fail` on the shared origin. Signed-IPN contract and PostgreSQL integration evidence covers the handler. The saved evidence supports the configured route and shared-origin reachability. Direct provider delivery to `/ipn` for this transaction remains unobserved. [Session configuration](../../server/src/payments/sslcommerz.ts#L88) · [Runner](../../server/test/phase3-cancelled-uat/run.ts#L103) · [IPN handler](../../server/test/phase3-cancelled-uat/callbacks.ts#L38) · [Ledger](../../output/phase3/cancelled-uat-cloudflare-20261106-01/ledger.jsonl) · [PostgreSQL integration](../../output/phase3/negative-postgres-20261105-01/result.json)

Gate 4 passes under the original conditional wording for this transaction. The evidence includes the genuine signed CANCELLED return, matching authoritative CANCELLED, preserved financial state, signed IPN handler coverage, and genuine SUCCESS and FAILED IPNs. Separate live CANCELLED IPN is `NOT_OBSERVED`, provider generation and dispatch are `UNKNOWN`, and the historical runner result remains `passed: false` with `TIMEOUT_INDETERMINATE`. Provider evidence of an expected IPN with unresolved delivery for this transaction would reopen Gate 4. [Historical runner result](../../output/phase3/cancelled-uat-cloudflare-20261106-01/result.json)

### Separate production release obligations

Phase 3 acceptance covers the reviewed sandbox scope. Production gateway activation and deployment require separate release approval. Gate B/C, production privacy, KMS and retention, cloud migrations and mutations, live funds or customer data, and supplier connectivity or fulfillment remain separate release obligations. [Release boundaries](PHASE_3_ENGINEERING_COMPLETION_REPORT.md#phase-transition-policy-প্রস্তাব--অনুমোদনের-অপেক্ষায়)
