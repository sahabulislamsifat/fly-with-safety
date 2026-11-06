# One-session SSLCommerz checkout inspection

**Offline review only. Separate owner approval is required for the exact caller hash and the provider requests below.**

The negative financial harness has a local policy that requires a terminal disposition for the retained intent and confirmed procedures for both cases. The V4 initiation contract uses a new unique transaction ID for a new payment. The reviewed contract specifies no prerequisite about the disposition of a different transaction. This inspection is a separate entry point with zero financial DB writes. It has no dependency on the retained intent's provider status. It reuses the restricted DB identity, exact retained-row ownership checks, protected snapshot comparison, and sandbox SDK. The existing financial continuation is untouched.

## Approved scope if executed

- Local target `127.0.0.1:5432/flywithsafety_local_integration`, OID 34701, role `flywithsafe_phase2_booking_test`. Two bounded `REPEATABLE READ READ ONLY` transactions with controlled rollback. Each verifies role and migration identity, exact retained 23 rows, and absence of a payment with the new transaction ID. Protected snapshots must match. Existing credentials remain private. The owner enters the restricted DB password in a masked foreground PowerShell prompt. The runner reads sandbox merchant configuration from the existing private server config.
- One transient synthetic fixture. Its `FWSI` transaction ID has 104 bits of fresh randomness and is checked against the local payment table. The amount is 10.00 BDT in the sandbox. Initiation submits synthetic contact values. There are zero booking, payment, event, outbox, schema, cleanup or other business writes. The provider-issued session key is used only in memory and only when it matches the returned `SESSIONKEY` on the documented sandbox checkout URL.
- At most two outbound provider requests. One `POST /gwprocess/v4/api.php` on `https://sandbox.sslcommerz.com` and, only on success, one `GET /gwprocess/v4/gw.php` with exactly `Q=PAY` and the returned session key. TLS verification stays on and redirects fail closed. No old-intent provider query, validation, refund, retry, payment method selection or action submission.
- Zero public listeners or tunnel processes. All callback targets are HTTPS under the reserved non-resolving `checkout-inspection.invalid` origin. If the provider requires reachable callbacks or returns an unsupported checkout URL, stop. There is no fallback scope. This run has no callback evidence objective.
- The GET response is parsed as inert HTML, with a 512 KiB cap. Scripts, forms and links are never executed. Only allowlisted candidate labels are reported. CSS and dynamic controls cannot be assessed, and an apparent label does not establish its semantics or a provider outcome. No session URL, raw response, credentials or identifiers are written to the inspection result.
- Each provider request has a ten-second deadline. The outbound deadline is 90 seconds from runner setup and the caller waits at most 110 seconds before stopping its owned Node process with a five-second shutdown wait. A timeout reports preservation as unconfirmed. A request that times out may still leave a provider session. It is left unused, with no remote cleanup or second attempt. The attempt markers survive every outcome.

## Acceptance boundary

`STATIC_CANDIDATE_ONLY` and `NO_STATIC_CANDIDATE` are inspection results. Neither authorizes a negative action. Genuine negative outcomes still require a separately reviewed execution with authentic status, matching transaction/amount/currency, actual return and applicable signed IPN, negative persistence and role checks, replay/idempotency, no capture or fulfillment, and final reconciliation. Phase 3 remains NOT ACCEPTED and Phase 4 remains ON HOLD.

The source and runtime manifest is bound into the caller. Verification is scoped to new inspection tests and its dependencies. No live provider request, database connection, listener or browser session was started during preparation.

References: [V4 initiation and Hosted Checkout URL](https://developer.sslcommerz.com/doc/v4/), [Transaction Query](https://sandbox-gw.sslcommerz.com/doc/v4/order-query.html), [Reserved test domains](https://www.rfc-editor.org/rfc/rfc2606#section-2).
