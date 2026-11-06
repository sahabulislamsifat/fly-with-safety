# Consumed smoke result review

Source: existing smoke-result.json and binding.json, inspected without another public request. All historical source/pins/attempts/results preserved.

Observed: four exact callback POSTs each returned 204 with matching random marker and request-specific origin receipt. GET success returned 200, marker false, receipt false. Counts: 4 PASS / 1 FAIL / 4 UNEXECUTED. Owned connector stopped true; normalServicesTouched false; databaseAccess false; providerCalls 0.

Evidence gap: smoke.cjs discarded response body and did not save Content-Type, Location, server headers or interstitial classification. Node https.request does not follow redirects, so no redirect chain was executed. The saved status is a direct 200 response, with no saved evidence identifying its generator. Interstitial is consistent with official Free-plan behavior but cannot be established as the exact historical response. Do not reconstruct missing evidence or mark edge deny assertions PASS.

Binding metadata additionally confirms addrType=object. This supports the prior parser failure: new URL(r.addr) expected URL-compatible input. Exact domain acknowledgement plus four correlated origin responses now prove actual callback delivery; no entitlement rejection occurred in this attempt.

Origin boundary remains unchanged: exact four POST URLs only, loopback peer, marker Host, form content type and bounded declared body length; GET and query variants denied. Existing actual loopback test covers the failed GET and four later deny cases; public outcomes for the last four remain unexecuted. A 200 generated before the origin is not origin exposure and is not a passing public-deny test.

Official sources inspected:
- https://ngrok.com/docs/pricing-limits/free-plan-limits — HTML browser interstitial, visitor continuation cookie, paid plans remove interstitial. No warning bypass is approved.
- https://ngrok.com/pricing — Hobbyist advertised $10/month with monthly billing and no interstitial; final checkout price/tax/domain availability require owner confirmation.
- https://developer.sslcommerz.com/doc/v4/ — POST IPN and server-side Order Validation; success/fail/cancel are customer return callbacks. No evidence justifies adding GET mutation callbacks. Existing POST-only routes retained.

Free endpoint supports the tested POST transport. Actual browser return, cookies, form-post preservation and merchant-enabled channels have NOT been tested with SSLCommerz. Do not claim Free cannot work at all; do not accept an uninterrupted browser-return flow based on synthetic request headers. The documented non-bypass way to remove this uncertainty is a paid ngrok plan without interstitial, preserving the isolated ingress. No purchase, plan change or public execution performed here.

Genuine sandbox execution remains separately gated: confirm chosen no-interstitial hostname/plan, then review one bounded synthetic booking/payment scope, private process-local sandbox credentials and local DB identity, initiation idempotency, Hosted Checkout success/fail/cancel, actual IPN, authoritative validation of transaction/amount/currency/risk, duplicate delivery/reconciliation and exact persisted fixture ledger. No automatic supplier fulfillment. Pending deny checks may be included once in that reviewed execution rather than repeating all accepted transport/payment suites.

Phase 3 NOT ACCEPTED. No consumed caller rerun or modified.
