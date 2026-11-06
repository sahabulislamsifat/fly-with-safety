# ngrok callback preparation — no public execution authorization

Planning: compact; dependency context; impact verification; no delegation. Allowed edits: this preparation directory only; global official skills installed separately as requested. Existing application, .env, databases and consumed evidence unchanged.

## Actual preparation

- Read https://ngrok.com/agent-setup/prompt.md directly and the official skills documentation.
- Installed official ngrok 7 relevant skills via skill-installer from commit6f2d9b4fa2d7068560726bcc3969a4b906d44a4c: setup, expose-localhost, secure-endpoint, receive-webhooks, troubleshoot-ngrok, engine and surfaces. No plugin/MCP/account API integration installed.
- Existing Windows Microsoft Store ngrok.ngrok3.39.11.0, agent3.39.11-msix-stable; Store package StatusOk/SignatureKindStore. Inner ngrok.exe is not independently Authenticode signed; do not describe it as a signed standalone executable. Actual binary SHA2566CCA51C969E13AD038A608B015000815135A3148CE4BB6A6F63C8AA536198E16. No installation/update was needed.
- Existing default config check exit1: LocalAppData/ngrok/ngrok.yml missing; current process NGROK_AUTHTOKEN absent. This is setup missing, not evidence of rejected credentials. No token or merchant file read.
- Proposed exact HTTPS origin: https://russel-semisacred-elise.ngrok-free.dev, owner-supplied; account ownership/online DNS/TLS not verified. No public request made.

## Authentication owner action

Official ngrok-setup requires the owner to configure their agent authtoken privately, not supply it in chat. Get the token only from https://dashboard.ngrok.com/get-started/your-authtoken. The prepared Set-PrivateNgrokAuth.ps1 uses a SecureString prompt so the value is not entered into shell history. It pins the Store package/binary and invokes official config add-authtoken followed by config check with captured, suppressed native output. Token necessarily exists transiently in the child CLI argument; do not run a transcript or process-argument recorder during private setup. It saves only in LOCALAPPDATA/FlyWithSafe/ngrok-sandbox-20261103-01/ngrok-auth.yml with owner+SYSTEM inherited file access, outside the repo. Existing private directory/process token causes STOP rather than replacement. Failure preserves private partial state; no retry/cleanup. No API key is required. No tunnel command is authorized by this setup step. Actual account/domain authorization is only proved during the separately approved endpoint execution.

Native default config was not modified. Safety config validation exit0 is only an offline schema check, not authentication or remote Traffic Policy entitlement acceptance.33 local policy/origin-model tests PASS; installed skills48 files matched pinned Git blob hashes. These are preparation results, not public probe results.

## Prepared finite policy

policy.json requires exact HTTPS owner hostname, POST, one of four raw paths and no query. Wrong conditions receive edge404. Forwarded identity/routing headers stripped; Host overwritten with the existing ingress marker. Existing unchanged origin guard again enforces loopback peer, Host, exact method/path, form content type and16KiB size; callback handler checks actual payment authentication. Google OAuth/basic auth must not gate provider callbacks. Do not substitute ngrok generic verify-webhook for SSLCommerz server-side validation or invent provider support.

agent-safety.yml contains no token/endpoint; disables local inspector UI, remote management, update checks and logs. Future CLI must also specify --inspect=false. No implication that disabling agent inspection disables all provider-side metadata retention; genuine synthetic traffic traverses ngrok and retention must be reviewed before live provider execution.

Official docs confirm add-headers Host replaces rather than appends. Policy's ngrok CEL/plan entitlement acceptance remains UNVERIFIED until the approved agent session; local tests are expression-model plus real origin guard checks, not a fake platform validator. Free browser interstitial may affect payment return; never count a skipped/blocked browser return as PASS or assume SSLCommerz sends a bypass header.

## Minimum separately approved execution scope

Reuse existing backend-only handoff rather than a new application port. Keep frontend3000 untouched. Before any change, freeze exact current normal backend5000 owner/supervisor/creation times and prove no unrelated listener or residual public connector. Stop only the proven owned backend gracefully after separate approval. Only then bind a pure no-app/no-DB/no-credential callback transport listener127.0.0.1:5000; local correlated callback PASS is mandatory before ngrok. Never launch ngrok while the Main-backed5000 is the upstream.

Future new one-time caller must pin agent, policy, origin, current ownership and source; use explicit static URL, explicit safety config, private token source and --inspect=false. No generic8080, app.acme.com, auto-tunnel, Google login, alternate hostname or fallback. Bound public window180seconds, first correlated DNS/TLS/HTTP callback before remaining30 security checks; fixed TLS SNI remains public hostname even in forged-Host negative case. No provider/DB/credential access in proof, no retries.

Stop only owned ngrok and probe processes; verify their absence before restoring normal Main-backed5000. Uncertain connector shutdown blocks restoration, not TLS verification. Restore only existing normal app/unchanged env and verify read-only Main identity/health; no migrations/seeds/jobs/provider calls/business writes. Failure preserves marker/artifacts; no automatic repair/replay.

Public execution caller is deliberately not emitted/authorized yet: private agent authentication is the immediate owner dependency. Authenticating the CLI does not itself approve publication or merchant transactions. Subsequent genuine SSLCommerz scope must separately pin exact reusable local database/OID/role/eight migrations/owned fixtures and rotated sandbox keys privately; maintain authoritative Order Validation, notification checks, amounts/currency/risk/idempotency/replay controls and no supplier fulfillment.

## Official references

https://ngrok.com/docs/for-agents/skills
https://ngrok.com/docs/gateway/agent/config/v3
https://ngrok.com/docs/gateway/traffic-policy/actions/add-headers
https://ngrok.com/docs/gateway/traffic-policy/variables/req
https://ngrok.com/docs/pricing-limits/free-plan-limits

Phase1/2 and accepted Phase3 PG64/browser79 evidence preserved. Phase3 NOT ACCEPTED.
