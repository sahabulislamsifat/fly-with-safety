# Phase 3 — SSLCommerz sandbox implementation handoff

Prepared2026-11-02 after verified local rename. Scope:implementation plan,not gateway activation. Phase1G7 andPhase2 formal14/14 remain accepted. Preserve assisted booking,manual settlement,customer/staff/admin routes and UI. No real charges,supplier reservations,real passenger data,cloud DDL or paid provisioning.

## Existing foundation and integration boundaries

- Express/Node + Prisma7 + Next16/React19 remain unchanged. Reusable local PostgreSQL:127.0.0.1:5432/flywithsafety_local_integration,OID34701;existing restricted role flywithsafe_phase2_booking_test. Normal3000/5000/cloud development stays default. A future temporary same-port isolated sandbox run needs a reviewed owner-authorized switch;no new application ports/databases.
- booking-commercial.service.ts serializes on Booking row locks,uses DB-clock UTC after locking,binds ownership and expected revision,and stores durable request-ID receipts. Quotes,manual payments and receipts are strict version1 JSON in Booking.bookingDetails. Manual records are intentionally RECORDED_UNVERIFIED;never reinterpret them as provider verification.
- account.routes.ts permits customers to accept their own quotes;admin.routes.ts and booking-commercial.controller.ts preserve existing staff boundaries. booking.service.ts status/history and booking DTO/client booking-commercial.ts remain the existing read/write boundary.
- IdempotencyRecord currently holds operation/principal/key/payloadHash/reference/user,not a payment-provider outcome ledger. Reuse its admission pattern without pretending it tracks session/settlement/refund state. There is no active SSLCommerz provider implementation in the inspected server/client service/routes.

## Genuine provider contracts

Primary reference:[SSLCommerz v4](https://developer.sslcommerz.com/doc/v4/). Provider-specific facts below are distinct from the project design choices in the next sections.

| Purpose | Sandbox contract |
|---|---|
| Hosted session | POST https://sandbox.sslcommerz.com/gwprocess/v4/api.php;store returned sessionkey and validate GatewayPageURL before redirect. Session SUCCESS is not payment proof. |
| Server validation | GET https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php using val_id and private merchant credentials. Bind returned transaction/amount/currency to the local intent. |
| Reconciliation | GET https://sandbox.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php by tran_id or sessionkey. |
| Refund initiation/status | Same merchantTransIDvalidationAPI.php;bank_tran_id,unique refund_trans_id,and later refund_ref_id. Initiation success is not completed-refund proof. |

IPN is POST;its listener must be internet-reachable. Validate notifications server-side rather than trusting browser returns. Official statuses include VALID/VALIDATED and risk_level;handle them explicitly,not by truthiness. The [official IPN reference](https://sandbox-gw.sslcommerz.com/doc/v4/ipn.html) describes transaction/amount binding. Do not copy tutorial TLS-disable flags or public demo credentials. No provider transaction API was called while preparing this plan.

## Consolidated implementation order

1. **Provider adapter/config and durable intent contract,offline first.** Server-only credentials,explicit sandbox-only origin allowlist,disabled-by-default flag,no production endpoint fallback. Build exact-money parsers and normalized/redacted provider responses. Code-only Prisma/additive SQL proposal for PaymentAttempt,PaymentEvent and RefundAttempt ledgers;do not apply SQL yet. Unique provider+mode+transaction identity,actor+request-ID+payload binding,event dedupe,booking FK,refund identity and amount constraints. Keep financial audit records independent of the bounded commercial-v1 receipts array. Preserve schema/legacy reader compatibility;no public/private credential fields in DTOs. Avoid new existing-Booking scalar columns/default projections until a cloud schema rollout is approved;separate additive models and inactive gateway paths must not break normal main-cloud queries.
2. **Authenticated initiation and hosted checkout.** Add a narrow account booking-payment endpoint and matching client boundary,using existing auth/origin/ownership controls. Under consistent Booking→PaymentAttempt lock order,derive amount/currency from the accepted quote,freeze quote ID/revision,create an intent and commit before provider I/O. First sandbox pilot proposes full-quote BDT payments only;deny unsupported currencies rather than silently convert. Manual other-currency workflows remain unchanged. Bookings with unresolved manual records require staff review before an online charge to avoid double collection. No client amount authority.
3. **Validation,callbacks and atomic state updates.** Dedicated success/fail/cancel/IPN routes accept provider-shaped bounded input without relying on customer cookies. Mount any required origin/CSRF exception ONLY on those verified provider routes,never globally. Persist a normalized durable event and validate through the genuine server API. Exact merchant,tran_id,val_id/bank reference,quote,gross amount and currency must match. Do not compare net store_amount to the quoted gross amount. Implement documented verify_sign handling where supplied;do not invent signature algorithms or treat a callback/signature alone as authoritative. Unknown/mismatched responses fail closed.
4. **Reconciliation,refund and audit integration.** Add bounded worker/redrive composition using existing fencing and outbox patterns. Reconcile lost initiation/validation acknowledgements by the original intent/session ID;do not blindly create another charge. Admin-authorized refund intents reserve their amount atomically and reconcile the actual provider refund status. Append normalized audit/history and owner-scoped DTOs;no raw card/contact/callback payload or credential-bearing request URLs in logs.
5. **One reviewed local schema/permission/integration gate,then actual sandbox proof.** Batch the minimum additive SQL,least-privilege permissions and exact owned synthetic fixtures for separate owner approval. Use the SAME canonical local database and seven existing migrations;do not reset or replay them. No cloud migration without a separate reviewed approval. After code/offline acceptance and private merchant setup,run bounded genuine sandbox checkout/validation/IPN/refund acceptance with durable evidence and reviewed cleanup. No fabricated transaction successes.

## State/concurrency invariants

- Persist the intent before network I/O;never hold DB row locks over provider calls. One request key+same payload replays the same intent;changed payload conflicts. Prevent more than one active full-payment intent for a quote. Session acknowledgement loss becomes UNKNOWN/reconciliation,not automatic retry or invented failure/success.
- Browser redirect/query parameters never mark PAID. Genuine validated evidence may record financial verification;booking fulfilment/supplier confirmation stays an explicit existing operations workflow. Sandbox verification is visibly labelled sandbox,not real settlement.
- Process duplicate,early,late and out-of-order IPN/returns atomically. A delayed failure/cancel cannot downgrade verified success. A late valid payment for a cancelled booking must remain recorded for review/refund,not be discarded or fulfil automatically. Risky evidence holds fulfilment for review.
- Deduplicate by bounded canonical provider identifiers;do not assume an undocumented external event ID. Reconciliation must match exact transaction evidence rather than selecting an arbitrary first/last returned record.
- Use integer minor-unit/decimal-string conversion with provider bounds;no binary-float rounding. Existing whole-unit quotation amounts convert explicitly. Refund amount cannot exceed verified captured balance minus completed/pending refunds;duplicate requests cannot double-refund. Unknown refund acknowledgement remains unresolved until query/review.
- Keep manual RECORDED_UNVERIFIED records distinct. Extend payment DTOs with explicit provider/mode/status fields through a backward-compatible reader;do not add incompatible gateway records to strict commercial-v1 JSON or silently rewrite legacy paymentStatus.

## Targeted acceptance evidence

Offline:amount/currency/reference mismatch,ownership/staff denial,request replay/conflict,concurrent initiation/validation/refund,duplicate/reordered notifications,timeout/unknown outcomes,malformed/provider-error/risky responses,redaction,TLS/origin restrictions,and legacy manual UI/DTO compatibility. Mocked provider responses are UNIT evidence only.

Local PostgreSQL:unique/FK/rollback/lease constraints,atomic validation/audit,idempotency and durable replay under contention;restricted role only. Exact-ledger synthetic cleanup requires its own appropriate deletion approval.

Genuine sandbox:server session→hosted checkout→server validation/IPN→persisted owner/admin display;fail/cancel/expiry,return lost but IPN received,duplicate delivery,reconciliation and approved refund/status checks. Each PASS requires actual provider responses bound to local records. Do not repeat accepted Phase2 commercial/browser proofs without a genuine regression.

## Owner dependency and next batch

Code-only adapter/ledger-contract work can begin without credentials. Before genuine sandbox calls,the owner must have a merchant sandbox account and configure Store ID/password privately in an explicitly selected ignored/process-local sandbox environment. Never put them in chat,frontend,normal main .env,committed files or logs.

Owner must also approve an externally reachable HTTPS callback base and routing to the isolated Express callback paths. Localhost alone is not reachable by provider IPN. Use an owner-approved tunnel/staging arrangement only;do not provision an account,paid service or expose unrelated routes automatically. This does not authorize Cloudflare Workers or a hosting/runtime change.

Suggested private configuration names for implementation:SSLCOMMERZ_MODE=sandbox,SSLCOMMERZ_STORE_ID,SSLCOMMERZ_STORE_PASSWORD,SSLCOMMERZ_CALLBACK_BASE_URL. Names are a proposed contract,not currently activated settings. Fail closed if sandbox payment activation would use a cloud/production database. Actual schema/GRANT changes and genuine external sandbox execution require their reviewed approval;live payment processing remains unauthorized.
