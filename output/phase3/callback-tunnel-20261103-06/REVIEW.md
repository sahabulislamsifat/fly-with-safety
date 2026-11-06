# v06 TLS identity correction — pending separate owner approval

Planning policy: compact; dependency context; impact verification; no delegation.
Decision: change only the public HTTPS request's explicit TLS servername to the validated tunnel origin hostname. Evidence: historical v05 actual request reproduced entirely offline selects localhost for case31's Host localhost:5000; new selection matches the public URL. No TLS validation override, certificate bypass or probe assertion change.

## Historical evidence

v05 result/checks/journal/handoff remain immutable: DNS and first correlated callback PASS;30 public PASS,1 FAIL,0 unexecuted;case31 GET /api/v1/bookings, Host localhost:5000, ERR_TLS_CERT_ALTNAME_INVALID, no origin receipt. Public URL https://intervention-captured-monitoring-installations.trycloudflare.com/api/v1/bookings. Old certificate SAN/error.host were not retained, so its exact certificate cannot be reconstructed. Synthetic SAN reproduction is explicitly not the historical certificate. v05 restored backend and preserved frontend.

## Exact delta and fixed boundary

The sole run.cjs change adds servername: new URL(origin).hostname. TCP target and TLS identity remain the public tunnel; forged HTTP Host remains localhost:5000, preserving the intended negative test. Node default chain/hostname verification and rejectUnauthorized:true remain. Cloudflared's origin HTTP Host rewrite remains phase3-callback.invalid. No ingress changes or security assertion weakening.

The same DNS observation bounds, first correlated callback gate,31 requests,180-second proof budget and360-second foreground outcome budget remain. No retries. No merchant/app/database/credential access in the pure listener or connector. Four exact callback form POST routes only; unrelated routes and methods denied. No SSLCommerz call or payment acceptance.

## Backend-only maintenance and restoration

Normal frontend21588 with supervisor7940 is untouched. Only currently verified backend29236/supervisor24296 receives one graceful stop request through v05/normal-restore's existing controller. These current identities replace the consumed v05 ownership snapshot. Fresh v06 outputs are separate. No v01–v05 replay or marker deletion.

Controller compatibility: v05's restored-backend controller appends its child's exit to v05/child-exits.jsonl instead of writing the original service-recovery/backend-exit.json. v06 therefore requires the exact restore-backend.ts/PID29236/code0/no-signal acknowledgement from that existing journal, after both original backend processes are observed absent. The mutable exit journal is not pinned because the authorized stop appends to it; the producer controller source is pinned. No historical journal edit/removal is performed.

Pure listener exclusively binds127.0.0.1:5000 after confirmed graceful backend exit. It must pass local correlated readiness before creating one temporary connector. Safe normal Main backend restoration requires confirmed probe exit and connector absence; uncertain exposure blocks restoration. No forced kill or unrelated session stop. Restoration loads existing normal server environment privately, disables payments/worker/delivery and verifies Main identity read-only; no business mutation. Frontend remains running, no new application port or database.

Failure: preserve all artifacts, report exact stage and HTTP/TLS/DNS code; no retry/repair. New public execution and backend maintenance require separate explicit owner approval. No execution is authorized by preparing this folder. Stale ownership, existing attempt, partial artifacts, changed pins/binary or occupied/unrelated port must STOP.

## Verification interpretation

TLS regression uses the actual historical/current request function with an Agent stub that never opens a socket. All31 option selections and synthetic SAN checks do not constitute actual public TLS acceptance. Reused backend flow tests are VM-only. A fresh real public proof is required for31/31 transport acceptance. Phase3 genuine provider acceptance remains pending even after transport PASS.
