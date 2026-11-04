# Transport failure investigation and diagnostics-only recovery — approval PENDING

Policy: replan for missing failure diagnostics; dependency context; impact verification; no delegation. Allowed writes: this new recovery directory and current mutable Phase3 evidence log. Old caller, eight pins, attempt, origin, checks, result, profile and caller-result remain untouched.

## Observed failure, not a guessed network root cause

Original attempt `callback-tunnel-20261103-01` began2026-11-03T10:33:03.823Z, finished10:33:10.444Z (Asia/Dhaka16:33:03–16:33:10). Saved result: stage `public-path-checks`, failure `PROBE_CONNECTION_FAILED`, exit1, passedfalse. Original public hostname was generated. Code advances to public-path-checks only AFTER local listener bind, hostname parsing and a registered-connection log marker, so those startup conditions were met; this is not a startup timeout.

First planned operation was POST `/api/v1/payments/sslcommerz/success`, expected204 plus probe header. `checks.json` is empty because v01 appended checks only AFTER response headers. Given that loop and saved error, one request was attempted and failed before an HTTP response; no subsequent probes ran. Correct adjudication: attempted1,HTTP-completed0,PASS0,transportFAIL1,untouched30. Historical result's fail0/unexecuted31 counters mean no recorded HTTP responses; do not rewrite them or count failed attempts as PASS.

Verified diagnostics defect: v01 `req.on('error', () => reject(Error('PROBE_CONNECTION_FAILED')))` discards the original Error/code. Raw connector stdout/stderr were only buffered in memory and not saved; no startup/network journal exists. This gap cannot recover DNS/TCP/TLS/timeout cause retrospectively. Do not claim Quick Tunnel DNS propagation, TLS roots, Windows networking, Cloudflare outage, ingress rejection or a password issue caused it. Existing DNS cache inspection produced no matching record, which proves no historical cause.

## Safety observations

Original result says connectorPID22388,tunnelStoppedtrue,databaseAccessfalse,merchantCalls0,credentialsReadfalse. Current read-only OS inspection: port5000 has zero listeners; no PID22388, cloudflared, or matching v01 Node runner exists. Connector profile contains no files. No residual owned public exposure observed. Source has no app/Prisma/provider import, .env read or data forwarding; only fixed synthetic probes were possible. No unexpected route was observed accessible, but there is NO public isolation PASS: the first intended callback request failed before response, and every denial probe remains unexecuted. Existing guard has prior offline evidence only.

## Smallest correction prepared

Same pinned guard, exact unchanged probe handler/31-request plan, config, binary, target127.0.0.1:5000, Host rewrite, timeout/deadline/environment/stop rules and response assertions. No DNS warm-up/retry, timeout tuning, alternate port or relaxed route checks. Changes are diagnostic-only:

- Persist allowlisted native error codes/classifications (DNS/TCP/TLS/TIMEOUT/PERMISSION/unknown) without original messages, stack, headers, URLs, error objects or secret material. Preserve aggregate/cause codes when known.
- Append sanitized startup milestones and connector exit to new journal.jsonl; no raw stdout/stderr or callback bodies saved.
- Record each probe before HTTPS dispatch, plus expected/observed/error; failed transport counts as attempted1/FAIL1 and leaves30 untouched.
- Preserve original failure separately from a shutdown failure; report both. Explicit listenerStopped evidence and console stage/counters added.
- Fresh directory, new explicit recovery switch and new caller/manifest hashes. Old one-attempt authorization is not reused.

## Proposed ONE recovery scope

Only after fresh explicit approval: foreground `Invoke-CallbackProbe.ps1 -OwnerApprovedOnePublicTransportRecovery`, one temporary Cloudflare tunnel, at most31one-shot synthetic HTTPS requests,60seconds startup/5seconds each/180seconds overall plus owned-child shutdown. Wait for origin AND registered connection, not URL alone. Port5000 occupied or any precondition mismatch:STOP. No existing process termination. Owned tunnel/listener always closed after proof/failure; unconfirmed stop reported with PID. No automatic retry/repair.

No database/app/credentials/merchant access, writes, migration, GRANT, cloud change or SSLCommerz call. Frontend3000 and normal services untouched. All four formPOST callback paths retained; all login/admin/booking/account/other methods still denied. Public requests reach ONLY a probe process with no application inside. Transport recovery is not genuine merchant acceptance and is not proof that the unknown network problem was fixed.

Actual offline results, nativePS5.1 parsing, integrity comparison and new caller SHA256 are recorded in verification.json after verification. Original result files are hash-pinned by new manifest. Phase1G7/Phase2 acceptance,64PG/79controlledbrowser evidence remain accepted;Phase3 NOT ACCEPTED.
