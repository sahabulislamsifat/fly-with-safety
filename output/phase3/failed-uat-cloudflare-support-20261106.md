# Draft to SSLCommerz Integration Support · sandbox attempt on 6 November 2026

**Subject:** Sandbox Hosted Checkout dummy OTP warning and unexpected `POST /cancel` on a FAILED-only case

Hello SSLCommerz Integration Team,

We followed the sandbox Mobile Banking flow described in your existing support reply. The browser showed the dummy OTP page with a Failed button, the provider `warning.php` message “There is an error to process your payment!”, and an Easy Checkout cancellation confirmation popup. These observations may belong to different browser flows. Our evidence does not establish which provider action was submitted or its outcome.

Please correlate the following **sandbox** attempt in the existing private merchant support thread. The local synthetic booking reference is `FWS-P3-F-FB68A2F4`. The amount is **BDT 12,000**. Our sanitized run artifacts contain the local fixture identity and session-presence flags. The merchant `tran_id` and gateway session key were not persisted in those artifacts. Please identify the matching merchant transaction from the sandbox store and initiation timestamp below. If your support form requires an exact merchant transaction ID, append the verified sandbox dashboard identifier privately. Do not use the local booking reference as `tran_id`.

| Time in Bangladesh, UTC+06:00 | Recorded event |
|---|---|
| 6 Nov 2026, 14:33:01.597 | Strict HTTPS forwarding check returned `204` with matching nonce at the isolated origin. |
| 14:33:23.872–14:33:24.081 | One sandbox initiation dispatched. Gateway session and Checkout URL were returned. |
| 14:33:47.644–14:33:47.701 | The isolated listener received `POST /api/v1/payments/sslcommerz/cancel`. The browser recorded HTTP `404` from our FAILED-only guard, classified `OUT_OF_CASE_ROUTE`. |
| 14:33:53.969 | A new correlated forwarding sample returned `204`. |
| 14:33:58.978 | Owner confirmed Checkout readiness. |
| 14:53:59.502 | Checkout evidence wait ended as `TIMEOUT_INDETERMINATE`. |

There was no accepted `/fail` browser return or signed `/ipn` in our journal and no authoritative Transaction Query was sent. The scoped local payment remains `SESSION_READY`, uncaptured, and the booking remains `PENDING`.

For this exact attempt, please confirm:

1. The merchant transaction identifier, whether a dummy OTP Failed submission or explicit cancellation was recorded, and the provider outcome with timestamps.
2. The reason `warning.php` appeared, and the route, method and delivery disposition for the provider return. In particular, did the provider dispatch the recorded `POST /cancel`, and which action generated it?
3. Whether a signed negative IPN was attempted for the same transaction. Please provide its outcome and timestamp, or confirm no delivery was attempted. Please also identify the authoritative response/status field we should use to reconcile the resulting sandbox transaction.

Please redact credentials, session keys, checkout URLs, payment instruments and raw callback bodies. We have the official test steps and are asking about this specific attempt's provider trace.
