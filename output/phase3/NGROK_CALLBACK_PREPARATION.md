# Proposed static sandbox callback origin — no execution authorization

Owner supplied: https://russel-semisacred-elise.ngrok-free.dev
This is proposed account metadata, not independently verified ownership/readiness or approval to publish an endpoint.

Planning policy: direct, dependency context, impact verification, no delegation.

## Preparation finding

No ngrok application was found on PATH or as a matching file in the owner's Downloads directory during this inspection. Other install locations were not exhaustively searched. Download the official Windows agent before binary/version/authenticity checks and exact CLI/config review. No agent, token file, merchant secret or environment file was read or changed.

## Separate bounded transport scope to review after agent verification

- Pin the exact owner hostname, verified agent and source dependencies; fresh one-time identity.
- Preserve frontend3000. Normal Main-cloud backend5000 must never be the tunnel upstream. Reuse a separately approved backend-only handoff for an isolated callback listener5000, with ownership/exit/connector-absence/restoration guards.
- No application, database, merchant credentials or provider import in transport listener.
- Only POST /api/v1/payments/sslcommerz/success, /fail, /cancel and /ipn (each with the full common prefix) may reach the callback handler. Retain exact-path/method/content-type/body-limit restrictions, ignore forwarded identity claims, deny other routes.
- Review ngrok Host rewrite, TLS/SNI, automatic updates, local/cloud traffic inspection and logging configuration before selecting exact flags. Do not persist raw callback bodies or agent credentials.
- Reuse bounded DNS/TLS readiness and first correlated callback before remaining negative probes. Preserve explicit TLS servername tied to the public URL even when a negative probe forges HTTP Host. Never disable certificate verification.
- No automatic request replay, failed-attempt retry, deployment, payment/provider call or database mutation. Explicit owner approval before endpoint activation/backend maintenance. Connector shutdown must be proven before restoring Main-backed5000.

## Subsequent genuine sandbox gate

Transport evidence alone is not SSLCommerz acceptance. A separately approved same-source local integration runtime must authenticate the exact local database/role before genuine bounded synthetic transactions. Keep Order Validation authoritative for financial success, transaction/amount/currency/risk/replay controls and idempotency. Test Hosted Checkout browser return as well as IPN: ngrok Free may present an HTML browser interstitial; do not assume SSLCommerz can supply bypass headers. If it blocks the real flow, stop and separately review an appropriate paid endpoint plan; no production domain purchase is required.

Sources inspected: https://ngrok.com/docs/gateway/agent/config/v3 ; https://ngrok.com/docs/pricing-limits/free-plan-limits

All consumed v01–v06 scripts and evidence remain unchanged. No new public execution or accepted payment proof rerun occurred. Phase3 remains NOT ACCEPTED.
