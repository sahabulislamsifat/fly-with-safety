# Phase 3 SSLCommerz sandbox — implementation evidence

2026-11-03. **Schema ACCEPTED; first proof FAILED; read-only follow-up confirms false-expiry clock mechanism; retained-fixture continuation prepared, awaiting separate approval; Phase 3 NOT ACCEPTED.** Phase 1 G7, Phase 2 14/14 and the verified local rename remain accepted. The schema, failed business attempt and successful read-only follow-up are consumed and preserved. No genuine provider transaction, tunnel, deployment, real refund or live charge was executed. No dependencies were added.

## Delivered source

| Files | Implemented behavior |
|---|---|
| `server/src/payments/sslcommerz.ts` | Genuine V4 session/validation/transaction-query/refund APIs, bounded response reads/timeouts, redirect/TLS safety, exact paisa conversion, normalized allowlisted evidence, documented notification-signature verification, AES-GCM encrypted session storage with payment-bound AAD. |
| `server/src/payments/payment-domain.ts` | Owned accepted quotation admission, full-quote BDT intent, immutable amount/quote binding, risk/late-payment holds, captured-state monotonicity, refund reservations and financial/operations views. Optional legacy quotation descriptions remain optional. |
| `server/src/payments/payment-store.ts` | Prisma parameterized SQL, Booking→Payment→Refund locks, DB clock, durable intent/event/refund storage, atomic booking summary/history/customer+operations outbox, no direct email fallback. Operations notifications are bounded to 20 staff/admin recipients per effect. |
| `server/src/payments/payment.service.ts` | Durable idempotent initiation before network I/O, ambiguous initiation recovery, callback dedupe, independently validated capture, fencing, bounded reconciliation/backoff/review alerts, partial refund reservations and genuine refund-status checks. Provider HTTP runs outside transactions. |
| `server/src/payments/payment.routes.ts`, `server/src/app.ts` | Authenticated no-store payment routes; exact four provider POST exceptions before the browser Origin guard; bounded URL-encoded callback parsing/rate limits; admin-only bounded worker admission; browser redirects to a review page, never a payment-success assertion. |
| `server/src/services/booking-commercial.service.ts` | Active/captured gateway intents prevent a conflicting new manual payment record under the same Booking lock. Disabled normal/manual paths do not query new tables. Existing durable manual replay is preserved. |
| `server/src/services/booking.service.ts` | Gateway-tagged bookings cannot be manually marked COMPLETED through the legacy status command. No supplier, PNR or ticket is fabricated. |
| `server/prisma/schema.prisma`, `server/prisma/migrations/20261103000100_gateway_sandbox_ledgers/migration.sql` | Additive GatewayPayment/GatewayPaymentEvent/GatewayRefund models; FK/unique/active-intent constraints, immutable capture identity trigger, parent-locked refund balance trigger, unique provider refund reference. Owner-applied local COMMIT and preservation accepted; no cloud activation. |
| `client/src/components/booking/GatewayPaymentPanel.tsx`, `GatewayReturn.tsx`, `client/app/payments/return/page.tsx` | Customer checkout/resume, server-sourced financial/refund status, bounded status refresh, audit timeline, authorized recheck/refund controls, neutral return page and existing-admin operations queue (50 entries maximum). Existing latest-request scope prevents stale read display. No gateway credentials in browser code. |
| `client/src/components/booking/BookingCommercialPanel.tsx`, `client/src/components/admin/AdminBookingsTab.tsx` | Existing customer/admin booking panels host gateway controls. Existing manual indicator is explicitly labelled manual; styling/animations/routes are preserved. |
| `server/test/phase3-{provider,lifecycle,http,booking-boundary}.test.ts`, `phase3-gateway.vitest.config.ts` | Focused offline provider/domain/HTTP/legacy-boundary regressions. Database/provider operations are mocked. |
| `server/test/phase3-ledger.pg.integration.ts`, `phase3-ledger.pg.vitest.config.ts` | First proof consumed:10checkpoint PASS/54unexecuted,Vitest0PASS/1FAIL. Current source reuses the exact4actors/2bookings/2passengers/2initialHistory, creates no actors/bookings, preserves64checkpoint IDs/financial assertions/60s timeout/45s budget, and retains contender index/fixed guard label. New retained fixture guard and14offline tests added. Historical caller must not run again. |

Raw evidence and source hashes: `output/phase3/code-foundation-20261103/`.

## Actual verification

| Check | Actual result |
|---|---|
| New Vitest bundled loader | **98 PASS / 0 FAIL / 0 SKIP**, exit 0 |
| New Vitest native loader | **98 PASS / 0 FAIL / 0 SKIP**, exit 0 |
| Affected existing commercial/status regression | **60 PASS / 0 FAIL / 0 SKIP**, bundled, exit 0 |
| Server TypeScript | PASS, exit 0 |
| Strict payment source/test TypeScript | PASS, exit 0 |
| Client TypeScript | PASS, exit 0 |
| Scoped ESLint | PASS, 0 errors / 0 warnings, exit 0 |
| Prisma 7.10 validation | PASS, exit 0; synthetic CLI environment, no connection/migration |
| SQL parser | PostgreSQL18 WASM: migration 17 statements + 2 trigger functions; guarded execution 32 statements + 6 PL/pgSQL blocks PASS |
| Windows PowerShell 5.1 parsing | PASS, caller not executed |
| `git diff --check` | PASS, exit 0 |
| Existing frontend/backend health | localhost:3000 HTTP200; localhost:5000/api/v1/health HTTP200; no start/stop/configuration change |
| First real PostgreSQL proof | **FAILED**, Vitest0 PASS/1 FAIL;10 checkpoints PASS/0 failed assertions/54 unexecuted; snapshot and disconnect PASS. |
| Post-fix affected payment regression, bundled/native | **117 PASS /0 FAIL /0 SKIP per loader**, exit0;12 new tests (10 clock +2 diagnostics). |
| Post-fix strict/server TypeScript, scoped ESLint, Prisma validation | PASS, exits0; lint0 errors/0 warnings; synthetic-only Prisma validation config loads no normal .env. |
| Payment browser/genuine provider proof | **NOT RUN**, not counted as an offline SKIP or PASS. |

Tests cover merchant/response/URL failures, exact money, ownership, changed request payload, concurrent unit-model initiation, UUID normalization, callback/signature/amount tampering, VALID/VALIDATED, mismatch/risk/late outcomes, stale lease rejection, restart/commit-ACK uncertainty, refunds and over-reservation, authorization, no automatic fulfillment, encryption corruption/context/key denial and minimized errors. The expected negative HTTP500 test logs only `OperationError`; its test passes. An initial sandbox loopback EACCES was resolved by running the same mocked HTTP tests with local socket access. No database/provider credentials were used by these tests.

The 60 affected tests are a focused compatibility check, not a rerun or replacement of the accepted 164-test Phase 2 record. Mock serialization is not PostgreSQL race evidence. No genuine payment channel or merchant refund capability has yet been demonstrated.

## Operational contract and boundaries

Initiation: authenticated owner → Booking lock → accepted quote/contact/currency admission → durable intent + audit COMMIT → provider session HTTP → encrypted session acknowledgement. Same actor/request/payload replays; changed payload conflicts. A lost acknowledgement stays unresolved and blocks another full charge until authoritative reconciliation. Manual records remain RECORDED_UNVERIFIED and are never gateway proof.

Notification: exact provider form endpoint → optional documented signature verification and bounded identity parsing → durable notice → bounded server-side transaction query and Order Validation → exact transaction/gross amount/currency/validation/bank/risk checks → atomic financial audit + booking operations summary/history/outbox. Browser status/amount fields never authorize payment. A provider outage preserves due work. No raw callback/card/contact body is retained. Documented merchant identity is checked whenever returned. TLS bypass options are not used.

Permitted progression: INITIATING→SESSION_READY/UNKNOWN; unresolved→authoritatively FAILED/CANCELLED/EXPIRED or captured VERIFIED/RISK_REVIEW/EXCEPTION_REVIEW. A late genuine capture is recorded even after a terminal/closed booking, with an operations hold. Captured funds cannot be downgraded by a stale failure. Holds cannot automatically become VERIFIED. Multiple genuine captures create an exception rather than erase actual money. Refund INITIATING→PROCESSING/UNKNOWN→provider-confirmed REFUNDED/CANCELLED; initiation never means completed refund.

Reconciliation admits at most one booking and one payment per tick, one pending refund query per payment, ten automatic checks and persisted backoff. Leases are committed before HTTP and checked with the database clock after locking before finalization. Expired/stale ownership cannot finalize or clear a replacement lease. Retry exhaustion emits a durable review event and operations notification. The explicit `reconcileSandboxPayments()` entry point and authenticated ADMIN POST `/api/v1/payments/reconciliation/run` are implemented; **no new background worker or scheduler was started**. An approved sandbox run must admit/schedule this bounded tick for missed-notification/restart proof.

Refunds use captured balance minus completed/pending reservations, unique request/provider identity and parent locking. A lost refund acknowledgement without a provider reference remains reserved UNKNOWN for merchant/manual investigation; it is never blindly re-submitted. The documented refund-status example does not promise `refund_amount`: correlation uses the stored private initiation reference, original bank/merchant transaction, and amount when supplied. Merchant refund capability must be demonstrated before enabling refund execution.

Booking status remains distinct from financial status. VERIFIED maps to AWAITING_OPERATIONS, risk/late/overpayment/refund states retain holds, and no supplier fulfillment path is enabled. A real supplier integration and approval are required before completing gateway-funded bookings. Legacy manual settlement indicators have a separate label and are not provider proof.

## Private sandbox configuration — placeholders only

Configure a separate owner-controlled ignored/process-local **local integration** environment. Do not overwrite normal `server/.env`, activate cloud staging/main, or add these secrets to frontend/public variables.

```dotenv
SSLCOMMERZ_ENABLED=false
SSLCOMMERZ_SANDBOX=true
SSLCOMMERZ_SCHEMA_VERIFIED=false
SSLCOMMERZ_API_BASE_URL=https://sandbox.sslcommerz.com
SSLCOMMERZ_STORE_ID=<PRIVATE_SANDBOX_STORE_ID>
SSLCOMMERZ_STORE_PASSWORD=<ROTATED_PRIVATE_SANDBOX_PASSWORD>
SSLCOMMERZ_STORAGE_KEY=<PRIVATE_CANONICAL_BASE64_32_BYTE_DEVELOPMENT_KEY>
SSLCOMMERZ_CALLBACK_BASE_URL=<OWNER_APPROVED_PUBLIC_HTTPS_ORIGIN>
SSLCOMMERZ_REFUNDS_APPROVED=false
EMAIL_DELIVERY_ENABLED=false
FRONTEND_URL=http://localhost:3000
DATABASE_URL=<PRIVATE_RESTRICTED_LOCAL_POSTGRESQL_URL>
DIRECT_URL=<PRIVATE_RESTRICTED_LOCAL_POSTGRESQL_URL>
```

Runtime uses DATABASE_URL; existing Prisma7 CLI config uses DIRECT_URL. Both local integration references must target `127.0.0.1:5432/flywithsafety_local_integration`, role `flywithsafe_phase2_booking_test`. Activation fails on a cloud/admin database target, production NODE_ENV, a different provider API origin, missing schema approval or invalid storage key. No plaintext session-storage fallback is available. Initially only full-quote BDT checkout is supported; other manual currencies are unchanged, not silently converted.

Owner must rotate previously exposed credentials privately; none were copied/read into this implementation. In the **sandbox merchant dashboard**, verify Store identity and enabled channels; configure the approved HTTPS IPN endpoint `/api/v1/payments/sslcommerz/ipn`. Session requests derive `/success`, `/fail`, `/cancel` from the same callback base. Route only those approved POST paths to the existing local backend5000; do not expose unrelated routes automatically. Public HTTPS routing/tunnel/account provisioning requires owner approval. Local frontend remains3000. The Hosted Checkout request has no `multi_card_name` filter; actual channel availability is determined by the merchant account, not hardcoded claims.

Provider contract references: [official V4 APIs](https://developer.sslcommerz.com/doc/v4/), [official notification implementation](https://github.com/sslcommerz/SSLCommerz-PHP/blob/master/lib/SslCommerzNotification.php). No tutorial TLS-disable settings or public demo credentials were copied.

## Owner gate and recovery

Reviewed local schema package: `output/phase3/code-foundation-20261103/schema-review/REVIEW.md`. **Owner executed once; saved result exit0/passed=true, COMMIT and final read-only preservation markers independently inspected and ACCEPTED.** The original caller and 18 pins still match. Original reported finishUTC:2026-11-02T19:30:08.2310577Z. Actual result explicitly records businessTestsExecuted=false/providerCalled=false. No users/bookings/payment fixtures were created by that operation. Existing seven migrations were not replayed; the exact eighth migration was recorded. No cloud operation occurred. Acceptance evidence: `output/phase3/postgres-proof-20261103-01/schema-acceptance.json`. Do not rerun the consumed schema caller.

The package checks old migration checksums, OID34701, destination identity, absence of new objects, no competing local client connection, accepted private backup checksum/ACL, existing record counts/column/access metadata, new-table privilege restrictions and empty ledgers. DDL/grants/new migration ledger row are one transaction. Final read-only checks are a separate stage. Any failure consumes the attempt and stops. A missing commit marker means UNVERIFIED, never proof of rollback. If a failure or acknowledgement loss occurs, preserve all artifacts and inspect the catalog read-only; no automatic DROP/retry/repair/restore. The backup was archive-read verified historically, not restore-rehearsed.

The restricted-role proof `output/phase3/postgres-proof-20261103-01/` was approved and executed ONCE. Native private URL parity and read-only schema/access guards PASS, read-only exit0; business exit1 at eight-contender-initiation (CONFLICT/APPLICATION_GUARD). All eight calls share the same owner, booking, billing object and requestId; the intended contract is one intent/dispatch with replay-equivalent payment identity, not eight competing distinct operations. No contender indices or original AppError message were captured, so the precise historical guard/index cannot be recovered. This evidence gap is explicit; no permission/deadlock explanation is inferred.

The saved final owned-row snapshot is complete:4 User,2 Booking,2 Passenger,2 initial History =10 rows; no GatewayPayment/Event/Refund or owned outbox row. Snapshot and disconnect PASS. The original6 users/1 session were counted before fixture creation; end-to-end unlisted preservation checkpoints were unexecuted. The owner subsequently executed the minimal read-only clock/fixture query once: actual saved result exit0/passedTrue,ROLLBACK,6unlisted users/1Session,8completed migrations,all10retained rows and0owned financial/outbox rows. Native identity matches renamed DB/restricted role/OID34701. This confirms current counts/owned linkage, not historical full metadata equality for unlisted records. No agent SQL execution,cleanup or new fixture write occurred. Original artifacts remain hashed and unchanged; consumed test/pre-fix store sources are archived.

Confirmed source defect: installed adapter-pg7.10.0 maps timestamptz `2026-11-03 06:00:00+06` to `06:00:00+00:00`, losing the actual instant. Payment-store's old raw clock/audit queries used this path. Deterministic real-adapter plus service tests reproduce eight pre-intent eligibility CONFLICT outcomes for a future1h quote. Actual native read-only follow-up now confirms Asia/Dhaka and21600.002109seconds offset-discard shift. Both original quotes had2308seconds remaining at that observation, were eligible at the actual instant, and appeared expired if the offset was discarded; ownership/state/amount/currency/manual-payment guards all matched. This confirms the false-expiry mechanism for these retained fixtures; the original omitted per-contender message/index is still unrecoverable. Fix remains only two raw date projections with `AT TIME ZONE 'UTC'`, retaining the post-lock server clock, deadlines, leases, strict expiry and financial admission. No global timezone/dependency/schema/retry-policy change. Accepted read-only source hashes/parsed observations: `output/phase3/retained-proof-20261103-01/accepted-readonly.json`.

Post-fix verification:117 PASS/0 FAIL/0 SKIP per bundled/native loader, exits0 (12 new tests:10 clock/store/concurrency/boundary +2 fixed-label diagnostics). Strict/source-test and server TypeScript, scoped ESLint0/0, Prisma validation with a synthetic-only config, and diff checks PASS. The first sandbox regression had107PASS/10 loopback-EACCES failures; with normal loopback access all117 pass. Both reports are preserved. This is offline evidence, not completion of the54 live unexecuted checkpoints. Future group diagnostics record each index and safe fixed guard label; no arbitrary message is retained. No payment provider/browser operation ran.

## Phase 3 acceptance checklist (master prompt stages)

| Stage | Current status / required next evidence |
|---|---|
| 3A existing foundation | Source reconciliation complete; accepted Phase1/2 retained. |
| 3B schema/constraints | Actual local COMMIT/preservation ACCEPTED; restricted-role login/catalog/access preflight PASS. Business constraint/rollback proof pending. |
| 3C initiation | Implemented + offline PASS; genuine merchant session/initiation and channel evidence pending. |
| 3D callbacks/Order Validation | Implemented + offline PASS; approved public HTTPS IPN/returns, actual VALID/VALIDATED/risk/duplicate/reordered events pending. |
| 3E reconciliation/refunds/operations | Implemented + offline PASS; actual DB races/fencing/crash recovery, scheduled admission, provider reconciliation and merchant-supported refund proof pending. |
| 3F frontend/customer/admin | Implemented + TypeScript/lint PASS; actual sandbox-backed authenticated Playwright journey pending. |
| 3G automated verification | Previous117offline PASS per loader retained; new14retained-guard tests PASS per loader; no full-suite rerun. First real proof:10checkpoint PASS/54unexecuted;Vitest0PASS/1FAIL. Read-only clock/owned-prestate follow-up actualPASS. New64-check writing continuation NOT RUN. |
| 3H genuine sandbox E2E | NOT RUN. Private rotated merchant setup and owner-approved public HTTPS/external transaction scope required. |
| 3I final acceptance | NOT ACCEPTED until required genuine evidence passes. No production/live payment authorization. |

Single next owner action: approve ONE fresh `output/phase3/retained-proof-20261103-01/REVIEW.md` continuation,203pins/64unchanged checkpoints. It reuses the10retained fixtures, performs0new User/Account/Session/Booking/Passenger writes and no quote refresh; only the original bounded owned payment/refund/event/history/outbox effects remain. Native read-only and application guards require exact ownership/prestate and more than90seconds quote validity before business writes; mismatch/expiry stops without retry or repair. Existing role DB password only, no synthetic-account password prompt. Final hashes/PS5.1/parser/strictTS/lint and14newtests PASS; no continuation attempt exists. No old caller is reusable. Privileged cleanup/browser/provider execution require their respective approval boundaries; Phase1/2 and normal main-cloud configuration remain unchanged.
