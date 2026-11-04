# Isolated callback scope — approval required, not executed

Decision: compact implementation, dependency-level review, impact verification; no delegation. Historical callers and evidence are immutable.

Latest saved auth-result: authenticated session PASS, owned shutdown PASS. Public failure occurred after exact `started tunnel` URL match, when `new URL(r.addr)` threw. Raw addr was not retained, so missing vs malformed vs changed field cannot be established. No ERR_NGROK entitlement code was recorded. Do not claim an account/domain rejection or a fixed provider/network defect.

The new binding parser treats structured exact URL acknowledgement only as acknowledgement. It NEVER declares upstream verified from that log. A random per-run 192-bit response marker plus per-request local receipt is mandatory for each allowed public probe; denied probes must not reach the handler. This supplies direct upstream evidence without guessing a log field.

ONE transport-only execution: existing private rotated config, pinned ngrok executable, unchanged edge policy, new ephemeral 127.0.0.1 listener (never 3000/5000), nine HTTPS requests: four callback POSTs, denied GET, login/admin/booking paths, and callback query variant. First allowed request must correlate before subsequent checks. TLS validation and exact SNI stay enabled. Browser-like headers do not claim genuine Hosted Checkout return evidence.

No handoff, normal service stop/restart, app import, DB connection, provider call, credential value inspection or retry. Public budget 90 seconds + owned process shutdown 5 seconds. One CreateNew attempt. Only the owned connector is stopped; uncertain shutdown is a failure requiring inspection, never a normal-service action. Original ngrok domain/policy remains unchanged. Agent errors are allowlisted; bodies/tokens/raw logs are not persisted. No automatic DNS retries: a failure stops once with its native code.

The separate `server/test/phase3-isolated-callback-runtime.ts` is prepared but NOT launched by this transport proof. It requires separate genuine-provider approval, process-local local-DB URL parity, exact live OID/role/host identity and sandbox configuration before binding an ephemeral loopback port. It mounts only existing paymentCallbacks behind the deny-all boundary, not the normal app, auth endpoints or worker. It preserves authoritative validation/idempotency in existing production services. Genuine provider execution additionally requires a reviewed owned-transaction/fixture write budget and an initiation/auth harness; those are not yet approved or claimed complete.

Validation: 26 unit tests PASS; real loopback test covers all nine smoke route cases PASS (initial sandbox EACCES was an environment limitation; outside-sandbox local-only run passed). Runtime strict TypeScript PASS after correcting module/type resolution. No public proof or DB/provider access occurred during preparation.

Next gate: owner approval of this ONE transport smoke. If successful, separately scope genuine sandbox transaction initiation, callback/IPN, Order Validation and final fixture preservation. Do not rerun accepted 64/79 proofs.
