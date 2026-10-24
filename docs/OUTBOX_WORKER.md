# Notification worker rollout review

Status: code prepared; scheduling disabled by default. No deployment or database verification performed.

## Architecture and deployment facts

The API exports an Express app from `server/src/app.ts`. The package start script runs
`dist/server.js`, compiled from `src/server.ts`, which listens on a port. Previously that
entry point started a polling interval in every non-test environment. It now polls only
in local development without the VERCEL environment flag. Importing the app starts no timer.

No vercel.json or checked-in Vercel project metadata was found. Connected Vercel project
listing confirmed `fly-with-safety-server`, but project details returned HTTP 403 for the
team scope. The deployed root directory, framework detection, actual bundled entry point,
function duration, plan, pool limits and scheduler settings are therefore unverified.

Preferred minimal mechanism: Vercel Cron calls GET `/api/v1/internal/outbox/run` and waits
for processing to finish. A separately hosted worker is the alternative when low-latency
delivery or throughput exceeds available scheduling/function limits. No new infrastructure
dependency or active cron configuration is added here.

Official references, reviewed during implementation:
- https://vercel.com/docs/cron-jobs/usage-and-pricing
- https://vercel.com/docs/cron-jobs/manage-cron-jobs
- https://vercel.com/docs/cron-jobs/quickstart

Current documentation allows daily Hobby scheduling, versus once-per-minute minimum on
Pro/Enterprise. Hobby timing is not precise and is unsuitable for prompt password-reset
or booking notification delivery. Cron runs on production deployments, not preview.
Verify the actual plan and acceptable latency before selecting a cadence. Estimate costs
from invocation frequency, SMTP volume, database load and the chosen plan; none are verified.

## Trigger contract

- Requires backend-only CRON_SECRET, 32–256 base64url characters, generated securely by an
  operator and supplied through the deployment secret store. No value is stored here.
- Requires `OUTBOX_WORKER_ENABLED=true`; otherwise returns 503 after authenticating.
- Exact Authorization bearer credential comparison uses fixed-size hashes and timingSafeEqual.
- Missing/weak configured credentials return 503; bad caller credentials return 401.
- Cookie, Origin and Sec-Fetch-Site headers are rejected. User JWTs/admin roles are not
  scheduling credentials. HEAD is explicitly rejected so it cannot trigger GET side effects.
- Responses are non-cacheable. Query/body fields cannot change the batch or budget.
- Maximum scheduled batch is three records. The service clamps all batch requests to 1–20.
- The 20-second budget is an admission deadline: no new claims begin afterward. In-flight
  SMTP/database operations are awaited, not abandoned using a timeout race. This is NOT a
  hard wall-clock limit. SMTP connection/greeting/socket timeouts are 10/10/20 seconds;
  these are phase/inactivity limits, not a complete transaction deadline.
- Do not enable scheduling until measured worst-case execution, database timeouts and
  hosting duration are compatible and remain safely below the five-minute recovery lease.
  A dedicated worker is required if that cannot be established.
- Missing outbox storage or database failure returns generic 503, not an empty success.
  Batch logs contain counters; trigger errors exclude credentials and recipient details.

## Deployment configuration proposal (review only)

After confirming server is the deployment root and verifying entry-point detection and
function settings, merge a `crons` entry into the existing platform configuration. For a
verified Pro/Enterprise plan with an approved one-minute latency requirement, the proposed
entry is:

```json
{ "crons": [{ "path": "/api/v1/internal/outbox/run", "schedule": "* * * * *" }] }
```

This is deliberately not an active vercel.json. Do not use it on an unverified plan or
activate it before staging approval. Select the function-duration configuration against
the verified bundled entry point, not an assumed route filename. Configure the credential
and keep the worker disabled until all gates pass. Rollback disables the worker flag and
the platform schedule; reverting a deployment alone may not remove cron scheduling.

## Integrity and operations

Conditional database updates claim PENDING records. Expired PROCESSING records recover
after five minutes. Missed invocations leave durable PENDING work for a later invocation.
Backoff, maximum failures, F04 suppression-as-terminal-FAILED and admin-only redrive remain.
DELIVERED means transport acceptance, never confirmed inbox receipt.

No exactly-once claim: acceptance followed by a process crash can send again after lease
recovery. Phase 1F fences state updates using monotonically advancing updatedAt versions;
expired owners cannot acknowledge after recovery or transfer. Real PostgreSQL validation
is still required. This cannot prevent an already-started SMTP send from reaching a provider.
See POSTGRES_INTEGRATION_READINESS.md for the version contract and validation matrix.
Never overlap a persistent poller and scheduler without verifying shared database claims.

Reuse the existing Prisma pool; do not connect/disconnect per message or HTTP invocation.
Production pool sizing, query deadlines and connection exhaustion behavior remain release
gates. Missing-table fallback elsewhere remains non-durable and must not count as queue success.

Monitor authenticated invocation failures, last successful run, oldest pending age, queue
depth, FAILED growth, recovered leases and SMTP failures. Redrive stays behind existing
admin authorization; its audit evidence is the existing request log (request ID and route).
An actor-specific durable redrive audit trail is not added in this phase.

## Approved staging verification procedure

1. Verify disposable database host/schema, outbox migration, pooled connection settings,
   SMTP sandbox recipient restrictions, function limit, deployment entry point and plan.
2. Keep email disabled initially. Manually invoke the staging endpoint with missing,
   incorrect and correct credentials. Verify statuses, no-store headers and secret redaction.
3. Enable worker only on staging. With synthetic rows, check empty batches, maximum batch,
   suppression, delayed retries, maximum failure and authorized redrive. No live customer data.
4. Launch independent concurrent invocations; assert one successful claim per pending row
   against PostgreSQL. Repeat after missed runs and database outages; verify 503 and later recovery.
5. Interrupt a worker after claim. Verify PROCESSING persists until lease expiry, then recovers.
   Separately interrupt after sandbox SMTP acceptance; document possible duplicates honestly.
6. With separately approved sandbox SMTP sending, verify acceptance, receipt and bounce behavior.
   Measure worst-case SMTP/database timings and queue-drain throughput under the three-row cap.
7. Review logs and alert delivery. Verify no address, token or credential exposure in trigger logs.
8. Native Cron cannot be demonstrated on a preview deployment. Test schedule registration and
   actual production invocation only after separate rollout approval; do not deploy to test it here.

Real PostgreSQL claiming/recovery and infrastructure execution remain unverified. Six existing
database integration tests remain skipped and do not cover these worker scenarios.
