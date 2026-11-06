# Final independent local read-only reconciliation

NOT EXECUTED. Separate one-time owner approval required. Budget $0. Phase3 NOT ACCEPTED;Phase4 ON HOLD.

Target only 127.0.0.1:5432/flywithsafety_local_integration, existing flywithsafe_phase2_booking_test role, OID34701. Private masked role password; no postgres/merchant/cloud credential. Exact eight migration checksums/four actors/two recipients/permissions/triggers and pending fresh-fixture absence are checked using the existing corrected helper.

Two server-enforced READ ONLY transactions, each controlled rollback. Reuse verifyRetained against exact saved23 rows (3Booking,3Passenger,4History,2Payment,8Event,3Outbox), ownership/tran/quote/amount/currency; enforce one captured VERIFIED success, one uncaptured SESSION_READY incomplete intent, matching JSON state and required success validation/bank identity. Existing bookings must retain saved PENDING statuses. PROCESSING is a separately hashed historical provider observation, not a new query or a local terminal state.

Protected snapshot before/after compares migrations/catalog/role and unrelated users/sessions/bookings/passengers/history/payments/events/refunds/outbox in memory only. No credentials/payloads/personal data are saved. Limitation: this proves consistency against saved owned records and stability during this reconciliation. A full pre-v02 unrelated-row snapshot was not persisted; historical unrelated preservation relies on the existing genuine-v02 preservationtrue evidence, not a fabricated historical full-row comparison.

Zero provider calls/credential reads, global fetch rejects, no dotenv/gateway runtime import, no HTTP listener/SSH/tunnel/browser, no writes except local attempt/result evidence. No migration/grant/refund/delete/seed/service stop/retry. Native DB connect/statement10s, query15s, transactions30s each, parent wait110s. Ambiguity/failure preserves artifacts and stops; no automatic repair. Success is independent reconciliation only, not provider FAIL/CANCEL acceptance.

Invocation: Invoke-Reconciliation.ps1 -OwnerApprovedFinalLocalReconciliation -> server/test/phase3-final-reconciliation/main.ts --owner-approved-final-local-reconciliation-v01, private child gate PHASE3_FINAL_RECONCILIATION_APPROVED=true. Caller verifies all source/runtime pins before atomically creating its marker and prompting. No previous attempt allowed.

Official review: https://developer.sslcommerz.com/doc/v4/ and https://sandbox-gw.sslcommerz.com/doc/v4/order-query.html . Callback semantics do not establish a verified deterministic negative test action. Authenticated merchant dashboard was not inspected; no authenticated session was supplied/accessed. Official support procedure remains pending; no new payment/UI action assumed. Strict negative harness/limiter/caps remain unchanged and must be reviewed/re-pinned after official actions are confirmed.
