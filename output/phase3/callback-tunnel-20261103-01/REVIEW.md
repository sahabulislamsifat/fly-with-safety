# One temporary public callback transport proof — approval PENDING

Policy: compact planning, dependency context, impact verification, no delegation. Permitted preparation writes: this folder and mutable Phase3 evidence documentation. Historical evidence, application source and environment files unchanged.

## Verified executable

- Owner supplied `C:\Users\sahab\Downloads\cloudflared-windows-amd64.exe`.
- Version2026.10.7 built2026-10-30T09:43UTC; `--version` and `tunnel --help` both exit0.
- Authenticode status Valid; signer Cloudflare, Inc.
- Size55390512bytes; SHA256 `2493DBC168923BB3E59E5E7716F71DECED92992EEA9ACD6E9D74F84AC7751343` exactly matches GitHub release2026.10.7 asset digest obtained read-only2026-11-03.
- Source: https://github.com/cloudflare/cloudflared/releases/tag/2026.10.7 ; metadata https://api.github.com/repos/cloudflare/cloudflared/releases/latest . No binary download/global install/service/auto-update performed by agent. Windows signature and official release hash are verified, not a claim that all software risks are eliminated.
- Installed help confirms `--http-host-header` applies with `--url`, and warns debug logs include headers; debug is not enabled.

## ONE proposed execution, not executed

Only after explicit owner approval, run `Invoke-CallbackProbe.ps1 -OwnerApprovedOnePublicTransportProof` in foreground Windows PowerShell5.1. Full hash-guarded command will be recorded alongside the caller. Revalidate caller/manifest/source/binary SHA256 and Authenticode. Refuse existing attempt/results. Refuse ANY existing port5000 listener; never terminate or replace a normal backend. Bind only127.0.0.1:5000; leave frontend3000 alone. The probe listener contains NO application, credential handling, DB client, merchant client, .env loading or forwarding to any other local service.

Spawn ONE owned cloudflared Quick Tunnel, fixed origin127.0.0.1:5000 and overwritten Host `phase3-callback.invalid`; no inherited TUNNEL/PG/DATABASE/proxy/merchant variables or owner config. An explicit pinned empty connector.yml prevents default configuration discovery; connector profile is a new empty local directory. Verified release source selects Quick Tunnel mode with explicit --url. Updates disabled; management diagnostics disabled; metrics bind ephemeral LOOPBACK only (not an extra application endpoint). This contacts Cloudflare's Quick Tunnel service and edges and creates a temporary public hostname; it is an external operation requiring approval. No paid account/domain or merchant setup. Cloudflare can see synthetic probe traffic. Random URL is not authentication.

Wait at most60seconds for both generated trycloudflare.com URL and registered connection; a printed URL alone is not readiness. Run31 one-shot synthetic HTTPS checks with valid TLS verification, 5second per-request timeout and180second total budget. Do not retry any failed request/process/attempt. Do not follow redirects. Positive checks: exactly four formPOST callback paths return204 plus a probe-only marker. All other requests denied; they never reach application code:

- `/api/v1/payments/sslcommerz/success`, `/fail`, `/cancel`, `/ipn` (all four share full prefix).
- GET on each callback denied.
- GET/POST on root,health,login,refresh,admin,bookings,payment operations,account denied.
- Callback query/trailing slash/case variants denied.
- JSON denied; other form body rejected without persistence.
- Forwarded Host/original-URL spoof on login denied; Host localhost spoof on booking denied (edge400/403/404/421 accepted; no redirects or success).

Accept positive requests only when the connector-overwritten Host reaches the loopback-only boundary. Never pass public requests with localhost Host to the real application. Existing `callback-preparation-20261103-01/ingress.cjs` is reused unchanged and pinned. `probe.cjs` further denies even local app paths; NO real payment callback is processed. Exact synthetic form body only, bounded256bytes. Production16kb callback parsing/rate limiting/authoritative validation is not replaced by this transport probe.

On PASS or failure, stop only the owned connector/listener. No automatic restart, repair or database cleanup. Preserve new attempt/check/result/origin artifacts. If stop cannot be confirmed, STOP and report exact child PID; do not claim public exposure ended. Connector transient logs are read in memory for URL/readiness only; no raw payload/header log persisted. The public URL is non-secret but expires when stopped. Results explicitly state databaseAccess=false,merchantCalls=0,credentialsRead=false. Reuse no historical marker or authorization.

## Not in this approval

No SSLCommerz/API/HostedCheckout call, genuine IPN, card/payment action, new User/Booking/Session/payment record, credentials/.env read, database connection, migration, GRANT, cleanup or cloud operation. Phase1G7/Phase2 acceptance and64PG/79controlled-browser evidence unchanged. Store Password rotation remains owner-confirmed, not a secret inspected here. This standalone temporary URL is transport evidence, not a merchant callback origin for real transactions and not payment acceptance.

After actual31transport checks PASS: pin the same guard and verified binary in the separately reviewed genuine sandbox host/fixture/provider execution. Its current origin must remain alive during the approved payment window; no silent origin reuse after stop. Genuine host must mount guard BEFORE all app middleware and verify local OID34701/eight migrations/restricted role and existing ledgers before writes; process-local secrets only. That later approval has not been requested or granted by this review. No normal cloud service may be tunneled.

## Offline evidence

New probe suite36PASS/0FAIL/0SKIP,exit0,including31HTTP-plan handler cases and an actual unapproved child invocation that failed before marker creation. No network listener/tunnel was started by tests. Node syntax checks exit0; git diff check exit0 with existing newline warnings. All203accepted PostgreSQL source pins independently match; no historical proof suite was rerun. Native Windows PowerShell5.1 parsing and final dependency verification must pass before publishing the foreground command; actual final status is recorded in verification.json.
