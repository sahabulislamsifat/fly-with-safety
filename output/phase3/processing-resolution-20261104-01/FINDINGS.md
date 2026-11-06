# PROCESSING: observed unresolved sandbox state

Saved readback is consumed. Root cause of strict parse failure is exact PROCESSING, not whitespace/case, network, DB or currency mismatch. SDK now tags this rejected state without accepting financial evidence. The previous error kind MALFORMED remains unchanged, so current callers and PaymentService failure handling remain fail-closed. No automatic provider requery or continuation eligibility is introduced.

Official references reviewed 2026-11-04: https://sandbox-gw.sslcommerz.com/doc/v4/order-query.html and https://developer.sslcommerz.com/doc/v4/ . Query contract lists VALID,VALIDATED,PENDING,FAILED. PROCESSING is not documented there; refund processing is a separate API contract and must not be borrowed. Callback FAIL/CANCEL semantics do not establish a deterministic sandbox UI action. No safe supported forced negative procedure confirmed; support clarification remains required. No live UI/session/provider action performed.

Continuation review completed: existing two fresh exact-owned cases, owner READY/visible-checkout confirmation,20minute case windows,65minute bound, caps, protected snapshots, unchanged trust-proxy=false limiter, strict ingress/SSH/TLS/role/DB/OID/actor/ownership checks remain in prior reviewed source. No consumed caller was repackaged or replayed. Its old-intent terminal gate remains intentionally blocking for PROCESSING. Existing success is never reopened. No authority to mutate an unresolved old intent.

Next owner action: obtain SSLCommerz Integration Support's written clarification of PROCESSING query semantics, documented synthetic FAILED/CANCELLED actions and expected callback/IPN/query outcomes. No secrets/session URLs/card details needed. No new provider call is requested now.
