# Draft for the existing private SSLCommerz sandbox support thread

**Subject:** Sandbox transaction trace requested — FAILED-only checkout returned POST to cancel URL

Hello SSLCommerz Integration Team,

Could you trace this exact synthetic sandbox transaction under the merchant account in this private thread?

- Merchant `tran_id`: `FWSd94c04ced6eaafe6b24a87da47`
- Local synthetic reference: `FWS-P3-F-765FD855`
- Amount: BDT 12,000
- Gateway session and Checkout URL were returned. The session key and URL are intentionally absent from our exported evidence.

| Time on 6 November 2026, UTC+06:00 | Observed evidence |
|---|---|
| 15:14:19.598 | Strict HTTPS request returned `204` with a matching nonce at the isolated callback origin. |
| 15:14:32.947 | Private owner page acknowledged the FAILED-only Dummy OTP instruction. This is a readiness confirmation. The browser control used later was not logged. |
| 15:14:33.219 | Sandbox initiation returned a session and Checkout URL. |
| 15:14:34.877 | Checkout page was visible. |
| 15:14:44.059–15:14:44.067 | Browser navigation sent `POST /api/v1/payments/sslcommerz/cancel` through the live tunnel. The isolated FAILED-only guard deliberately returned `404 OUT_OF_CASE_ROUTE`. |
| 15:14:44.067 | Runner stopped because it observed the out-of-case browser POST. |

No `/fail`, signed IPN, provider status query or sandbox warning page was recorded in this attempt. Our local payment remains `SESSION_READY`, uncaptured, with booking `PENDING`.

Please confirm which provider-side control or event was submitted for this `tran_id`, which action generated the POST to the cancellation return, the authoritative transaction outcome, and whether a separate signed IPN delivery was attempted. If there was an IPN attempt, please provide its time and delivery disposition. We already have the official FAILED and CANCELLED test instructions and need the trace for this transaction before attempting another session.

Please redact credentials, session keys, checkout URLs, customer data and raw callback bodies.
