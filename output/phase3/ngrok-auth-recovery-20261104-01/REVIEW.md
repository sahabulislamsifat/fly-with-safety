# Private agent credential correction + endpoint-free authentication — pending explicit approval

Planning compact; dependency context; impact verification; delegation none. Scope only this package and owner-controlled new private config. No production/app/security changes. Existing accepted proofs and consumed files remain intact.

## Verified evidence and remaining uncertainty

ngrok-public-proof-20261103-02 result: native ERR_NGROK_105 at authenticated-domain-and-policy-binding;0 public requests,31 unexecuted; owned listener/tunnel stopped, normal backend restored and frontend preserved. Official error means the supplied value does not look like a proper ngrok Authtoken. It does NOT prove an invalid domain, plan, policy, server outage or a revoked/expired token.

Effective credential source: LOCALAPPDATA/FlyWithSafe/ngrok-sandbox-20261103-01/ngrok-auth.yml, agent.authtoken. Explicit config1 private then config2 agent-safety.yml. Safety file has no credential/endpoint. Launcher clears environment; ngrok child gets Windows essentials plus isolated profile paths, no NGROK_* or proxy/token/API-key variables. No --authtoken argument on the public run. Current process/user/machine NGROK_AUTHTOKEN,NGROK_API_KEY,NGROK_CONFIG,NGROK_CONFIG_PATH presence all false. Their historical registry state is not recorded, but cleared child environment excludes their inheritance regardless.

The private token was inspected only inside a local read-only process; no value, length, hash, raw YAML or reusable fingerprint emitted. Generated-shape audit identified one agent.authtoken key; no leading/trailing/embedded whitespace, control/non-ASCII characters, literal wrapper quotes, command text, URL, known placeholder or empty value. That heuristic is NOT a vendor format validator or proof of Agent-vs-API-key type. The first narrow audit did not understand quoted YAML version syntax; after a synthetic regression correction, the supported-version audit completed. Both sanitized audit outputs preserved. Existing private file never changed. The specific remaining cause is wrong credential type, incomplete/incorrect value or another ngrok token-format requirement; no particular one is proven. Do not trim, edit guessed characters, reset accounts or claim a URL bug.

Minimum owner correction: open https://dashboard.ngrok.com/get-started/your-authtoken in the account owning the assigned dev domain. Copy ONLY the full Agent Authtoken value, not an API key, command, URL or quotes. A newly generated token is NOT mandatory; use the correct existing dashboard Agent token if available. If owner cannot recover/identify it, they may separately create an Agent Authtoken, not reset unrelated credentials. No dashboard API/admin account operation automated here.

## Exactly one proposed execution

- Fresh owner-attempt guard; preserve every old failed artifact and old private config.
- Masked private-console SecureString input. No token typed into history, printed, returned or written in repository. Basic obvious input errors reject without normalization. Not a full vendor format check.
- Save via official config add-authtoken in new LOCALAPPDATA/FlyWithSafe/ngrok-auth-recovery-20261104-01/ngrok-auth.yml, owner+SYSTEM-only ACL. Existing target directory rejects overwrite. Token necessarily passes transiently as the native add-authtoken argument; do not run transcript/process-argument recording. Output suppressed. Existing private config unchanged.
- Config check is syntax-only; no success claim from it.
- Then ONE owned native agent session: start --none, explicit private+safety configs, no endpoint name, --all, http/tcp/tls command, public URL, application port, listener, API key or merchant/DB environment. Agent receives credential via its private file and authenticates only to ngrok over its normal verified TLS control connection. Approval therefore authorizes that authentication exchange with ngrok; it does NOT authorize public exposure. No SSLCommerz or app/database call.
- Require structured tunnel-session-start acknowledgement; client/config chatter is not PASS. This is an internal control-session event name; no tunnel/endpoint is requested by --none. An unexpected started-tunnel event fails. Stop on first error/warning/ERR_NGROK code; no second client launch. Thirty-second session deadline plus5-second owned-process shutdown bound. Kill only the owned no-endpoint agent after PASS/FAIL; do not stop healthy services or unrelated processes.
- Keep only safe enums/booleans/native codes, exit and shutdown status. No raw native log, body, certificate, account data or token persisted. Preserve state/no retry on any failure. Parent result plus independent no-residual-session check required before later public operation.

Authentication PASS does not prove static hostname ownership or endpoint/policy entitlement. Those still require a separately approved later endpoint binding; do not rerun the consumed public callers. Only after real authentication PASS may a new public package use the new private config path. No automatic switch of old package/config/environment.

## Official references

https://ngrok.com/docs/errors/err_ngrok_105
https://ngrok.com/docs/gateway/agent/cli (start --none: run no endpoints or tunnels)
https://ngrok.com/docs/gateway/agent/config

Phase1 G7,Phase2 14/14,Phase3 PostgreSQL64/browser79 preserved. Phase3 NOT ACCEPTED.
