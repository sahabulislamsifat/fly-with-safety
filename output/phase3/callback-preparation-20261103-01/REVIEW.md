# Temporary sandbox callback preparation — NO PUBLIC EXPOSURE EXECUTED

Decision: compact planning; dependency context; impact verification; no delegation. Scope: this preparation directory and the current mutable Phase3 evidence document. Existing consumed packages, production source, environment files and evidence remain unchanged.

Recommend Cloudflare Quick Tunnel for this short synthetic-only test: no account/domain purchase, temporary HTTPS hostname, lifetime tied to foreground connector. Cloudflare handles public TLS and sees callback traffic; random URL is NOT authentication. No sensitive passenger/card data. No service installation or router/firewall change. ngrok is an alternative but its free HTML interstitial complicates browser-return evidence. Neither provides a production availability guarantee.

No cloudflared or ngrok executable was found on PATH. Do not start a tunnel to the unrestricted existing backend. Do not run the consumed injected browser host with genuine keys.

## Prepared boundary, not yet live-verified

`ingress.cjs` is a test-host-only middleware candidate, NOT wired into production or a running host. A new genuine host must install it BEFORE the real application. Only loopback peers are accepted. All public requests must arrive with connector-overwritten Host `phase3-callback.invalid`. That Host permits only form POSTs at these exact URLs (no query, trailing slash or alternative encoding):

- /api/v1/payments/sslcommerz/success
- /api/v1/payments/sslcommerz/fail
- /api/v1/payments/sslcommerz/cancel
- /api/v1/payments/sslcommerz/ipn

Other public paths/verbs return empty404 before any application query. Existing real callback parsing/rate limits/notification checks/authoritative Order Validation remain required. This middleware does not authorize a payment or replace those checks. No email/OTP/Basic challenge on provider paths: SSLCommerz IPN cannot complete an interactive challenge.

Connector candidate arguments, NOT an execution instruction:
`cloudflared tunnel --no-autoupdate --url http://127.0.0.1:5000 --http-host-header phase3-callback.invalid`

The reviewed installed binary must support this Host override. Fail closed if not. No connector config/default environment may override the target/Host or create extra published routes. Before mounting the real app or entering merchant credentials, prove through the generated public URL that Host is overwritten even with malicious Host/forwarded headers; all non-callback paths and callback GET must fail. Until those actual public probes pass, the tunnel is NOT accepted as callback-only. Guard tests simulate requests; they do not prove cloudflared transport behavior. No extra application port is needed.

## Shortest controlled sequence / approval boundaries

1. Obtain official Windows cloudflared binary, pin exact version + upstream release SHA256, verify before running. No global install/service/auto-update. Read `--version`/`tunnel --help` only first. This preparation has NOT downloaded or executed a binary. Owner approval requested for this narrow acquisition/version verification next; no tunnel or merchant request in that approval.
2. Prepare one genuine same-port host with accepted local OID34701/eight migrations/restricted-role and exact existing-ledger preservation guards. Start with no real app/credentials exposed, validate callback-only public ingress, then mount the real app under those guards. Use temporary HTTPS origin as process-local SSLCOMMERZ_CALLBACK_BASE_URL; keep frontend localhost3000/backend localhost5000. Do not change server/.env, normal cloud DATABASE_URL/DIRECT_URL or CORS defaults. Explicit new owner approval before public exposure and any bounded fixture/provider writes.
3. Owner confirms rotation already performed. Read neither existing .env contents nor secrets for this preparation. Genuine sandbox store ID/password and local DB password must be entered privately into reviewed isolated process; never load the entire normal .env. No production credentials. Preserve the existing payment encryption key where old encrypted records must be read; do not silently replace it.
4. Genuine execution scope must pin fixture IDs, counts, transactions/amounts, external SSLCommerz endpoints, time budget and stop conditions before approval. Reuse existing synthetic actors, but captured mock bookings cannot receive a new charge. Merchant-enabled channels must be observed, not inferred. Refund external scope needs explicit inclusion. No SMTP, supplier fulfillment, cloud DB, privileged cleanup or automatic retry.
5. Keep public URL/process alive through return/IPN/delayed-notice checks; stop owned tunnel at agreed deadline. Persist only allowlisted stage/status/count evidence, not raw callback bodies, merchant query URLs, passwords, session keys or card data. Quick Tunnel URL may change on restart, which requires a newly reviewed origin; never silently retry a consumed attempt.

Official references reviewed2026-11-03:
- https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
- https://developers.cloudflare.com/tunnel/reference/origin-parameters/
- https://developers.cloudflare.com/tunnel/downloads/
- https://raw.githubusercontent.com/cloudflare/cloudflared/master/cmd/cloudflared/tunnel/cmd.go
- https://ngrok.com/docs/pricing-limits/free-plan-limits
- https://developer.sslcommerz.com/doc/v4/

Phase3 remains NOT ACCEPTED. Accepted64PG/79controlled-browser checks are preserved; no existing suite rerun, data mutation, tunnel, merchant call, credential read or cleanup performed here.

Observed offline verification: `node --test output/phase3/callback-preparation-20261103-01/ingress.test.cjs` exit0,36PASS/0FAIL/0SKIP. `git diff --check` exit0 (existing LF/CRLF warnings only). No TypeScript/production source changed; no historical regression rerun. Shell read-only GitHub release metadata request failed DNS resolution, so no upstream binary version/checksum is claimed or fabricated. Connector acquisition/version verification is the next preparation prerequisite; it is not public-exposure authorization.
