> **Current status — 2026-10-25:** D-1 is authorized and executed; fresh review recommends **PASS WITH DOCUMENTED LIMITATIONS — REQUIRES OWNER REVIEW**. Only ADR-01/02/07/08's bounded synthetic contracts have M01 approval. Production decisions and all legal gates remain open. See [acceptance review](PHASE_1I_D_D1_ACCEPTANCE_REVIEW.md) and the R3 annex below; earlier status statements are historical.

# Phase 1I-D — Cloudflare and hosting compatibility

REVIEW DRAFT R2, 2026-10-24. Public documentation research only. No deployments, account inspection, credentials, build adapters or provider requests. No component is SUPPORTED AND VERIFIED in this repository through this review.

## Checked-out architecture

Client manifests/installed packages identify Next 16.3.6, React 19.2.8, App Router and Tailwind 4. Server uses Express 4.22.3 installed (manifest ^4.19.2), Prisma/client/adapter-pg 7.10.0, pg 8.23.0, TypeScript 5.9.3 and Vitest 5.0.3. Local Node is 26.9.0; this is not a verified hosting runtime. Client and server package-manager versions differ. No vinext/OpenNext/Wrangler configuration was found.

`netlify.toml` describes a Next build with the Netlify plugin. `server/src/server.ts` uses app.listen, process handlers and a development-only interval. `server/src/lib/prisma.ts` constructs PrismaPg from DATABASE_URL; `server/prisma.config.ts` uses DIRECT_URL. These establish code/configuration intent, not actual deployed hosts or regions. Next config is not a static export. Current account/admin/auth flows and images need runtime acceptance testing.

## Component matrix

| Component | Classification | Finding and required repository proof |
|---|---|---|
| Next16 on Workers/vinext | DOCUMENTED BUT UNTESTED IN OUR REPOSITORY | Current Cloudflare guide recommends vinext, a beta Vite implementation of Next APIs. Exact 16.3.6 behavior/build compatibility is unproved. Test every route, RSC boundary, server action, middleware, image and cache behavior before adoption. [C1] |
| Next on OpenNext | DOCUMENTED BUT UNTESTED IN OUR REPOSITORY | Alternative adapts Next output; requires explicit adapter/version compatibility. Do not assume exact installed release is supported. Compare against vinext using the same acceptance matrix. [C2] |
| RSC/SSR/actions/ISR | PARTIALLY SUPPORTED | Documented adapter features are substantial, but middleware/image behavior and runtime differences remain. No repository rendering tests run. [C1,C2] |
| Pages static export for current full application | UNSUPPORTED | Static export does not provide the required server runtime as-is. Pages can serve a deliberately static subset; that is a separate architecture decision. [C3] |
| Express on Workers | PARTIALLY SUPPORTED | Node HTTP adapter exists; Express is not categorically impossible. Existing bootstrap/process lifecycle and dependencies require adaptation. Keep Node backend initially. [C4] |
| Passport/Google OAuth/cookies | UNKNOWN | Repository flow is stateful through durable DB records, not a portable-runtime proof. Test redirects, callback state single-use, denied consent, Secure/HttpOnly/SameSite cookies, credentialed CORS and F02 origin checks across actual domains. Never relax guards to fix deployment. |
| Prisma7 + pg + Hyperdrive | DOCUMENTED BUT UNTESTED IN OUR REPOSITORY | Official Prisma/pg guidance exists; current adapter initialization and global client lifetime need runtime-specific review. Verify transactions, raw parameterization, timezone/Date semantics, connection exhaustion and shutdown. [C5] |
| PostgreSQL pooling/freshness | DOCUMENTED BUT UNTESTED IN OUR REPOSITORY | Hyperdrive pools connections; eligible reads can be cached and writes do not invalidate those entries. Start with cache disabled for auth, booking, inquiries, counts, leases and idempotency. Never route migration CLI through a cache/pool without explicit support. [C6] |
| Scheduled outbox | DOCUMENTED BUT UNTESTED IN OUR REPOSITORY | Cron can invoke a bounded worker. Existing protected route rejects browser-origin/cookie requests and requires secret + enabled flag. Scheduler must preserve that contract; app setInterval is not durable scheduling. [C7] |
| Queues / Workflows | DOCUMENTED BUT UNTESTED IN OUR REPOSITORY | Possible wake-up/orchestration tools, not replacements for transactional outbox truth. Queue only opaque IDs; duplicate deliveries/retries must retain database claims/fencing. Avoid persisting token payloads in workflow history. [C8,C9] |
| SMTP / transactional email | PARTIALLY SUPPORTED | Workers TCP port25 blocked by default; current Nodemailer 465/587, TLS and timeout behavior untested. Cloudflare now documents outbound Email Service via binding/API/SMTP; domain verification and adapter semantics still require approval/testing. Do not claim it is only inbound forwarding. [C10,C11] |
| AES-GCM/external KMS | UNKNOWN | Available crypto primitives do not establish SDK/auth/federation compatibility. Test exact runtime with fake adapter first, then separately approved identity/KMS staging. Backend Node is lower disruption. |
| Secrets | DOCUMENTED BUT UNTESTED IN OUR REPOSITORY | Worker secrets are available; environment-specific scope/rotation/access evidence missing. No NEXT_PUBLIC KMS or DB material, no static key committed to config. Secret storage is not identity federation. [C12] |
| DNS/domain/TLS | DOCUMENTED BUT UNTESTED IN OUR REPOSITORY | Cloudflare domain/DNS preference is viable planning input. Ownership, registrar eligibility, origin certificates, Full(strict) TLS, DNSSEC and safe cutover still need owner review. No purchase or configuration performed. [C14] |
| WAF/cache/private responses | DOCUMENTED BUT UNTESTED IN OUR REPOSITORY | Explicit bypass/no-store for auth, account/admin, guest lookup, sensitive APIs, callbacks and worker routes. Never Cache Everything over cookie responses; WAF is additional control, not authorization. Validate redirects/Set-Cookie and origin reachability. [C13,C15] |
| Monitoring/audit | DOCUMENTED BUT UNTESTED IN OUR REPOSITORY | Configure sanitized app logs plus provider audit and scheduler freshness; prohibit body/token capture. Retention/location/on-call remain open. [C16] |

Pin an audited Workers compatibility date. Current Node compatibility defaults have changed for newer dates; do not copy an old flag recipe blindly. Native/partial/stub API support must be checked against each dependency. [C4]

## Options and recommendation

| Option | Disruption / effort | Reliability/security/performance | Recurring-cost model | Recommendation |
|---|---|---|---|---|
| A Cloudflare-centric | Highest: frontend adapter plus Express/runtime/DB/email/KMS adaptation | More edge integration; regional DB/KMS round trips and new identity risks; no compatibility proof | Workers CPU/requests + Hyperdrive + queue/workflow usage + external PG/KMS/email + logs | Defer; not justified by current evidence |
| B Hybrid | Medium: Cloudflare frontend proof; retain compatible Node API/worker and PG | Native backend identity and existing semantics; front-to-API latency/CORS must be measured | CF frontend/security + Node compute + PG/backups + KMS/email/logs/egress | Preferred evolution if Cloudflare frontend acceptance passes |
| C Retain compatible hosts, CF DNS/security | Lowest application disruption | Preserves known code paths; deployed compatibility still needs evidence; origin lockdown and cookie behavior must be checked | Existing host bill + chosen CF/domain/security plan + later KMS + existing services | Recommended first step, conditional on current-host readiness |

No dollar total can be responsibly estimated without traffic, CPU, locations, plan, logs and retained versions. Obtain low/base/peak calculators for each option using the same workload. Include domain annual renewal, WAF plan, backend minimums, PG backups, email volume, transfer and incident/restore bursts. Worker pricing is usage-based; no assumption that a free tier covers production. [C17]

Sequence: inventory actual deployments -> approve C and regions -> staging DNS/TLS/auth/no-cache checks -> independently benchmark vinext vs OpenNext -> approve B only if acceptance passes. If actual hosts are unsuitable, select compatible Node hosting before activation; C is not an endorsement of uninspected deployment state. Cloudflare-only is not a requirement.

## Future acceptance proof, separately authorized

Pin builds/lockfile strategy; compare all public/customer/admin routes and responsive images, RSC/actions and error behavior. Verify OAuth callback/cookie combinations in real browsers; F02 allowed/denied origins and credentialed preflight; F05 durable state consumption. On an approved disposable DB, rerun F01/F03/Phase1F concurrency and F06 snapshot/count/order tests through the proposed pool. Exercise outbox duplicates, lease expiry, suppression and provider ambiguity without live mail initially. Verify private cache misses across customers, external KMS policy denial, no plaintext logs and scheduler overlap. Fail closed on any mismatch.

## Official sources, accessed 2026-10-24

- C1 [Next/vinext guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/).
- C2 [OpenNext guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/).
- C3 [Pages Next guide](https://developers.cloudflare.com/pages/framework-guides/nextjs/).
- C4 [Node compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/) and [Node HTTP adapter](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/).
- C5 [Prisma ORM with Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/prisma-orm/).
- C6 [Query caching](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/) and [connection lifecycle](https://developers.cloudflare.com/hyperdrive/concepts/connection-lifecycle/).
- C7 [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).
- C8 [Queues](https://developers.cloudflare.com/queues/).
- C9 [Workflows](https://developers.cloudflare.com/workflows/).
- C10 [TCP sockets](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/).
- C11 [Outbound Email Service](https://developers.cloudflare.com/email-service/get-started/send-emails/).
- C12 [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
- C13 [Origin cache control](https://developers.cloudflare.com/cache/concepts/cache-control/).
- C14 [Full strict TLS](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).
- C15 [WAF](https://developers.cloudflare.com/waf/).
- C16 [Workers observability](https://developers.cloudflare.com/workers/observability/).
- C17 [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

All classification statements are design assessments, not deployed verification. Provider documentation alone closes no application acceptance gate.


## R3 — hosting refinement after D-1 (2026-10-25)

The [D-1 review](PHASE_1I_D_D1_ACCEPTANCE_REVIEW.md) verifies Node-only synthetic behavior. It does not verify Workers, vinext/OpenNext, SMTP, cookies/OAuth, Prisma/PostgreSQL or external-KMS interoperability. No component is promoted to SUPPORTED AND VERIFIED by D-1.

ADR-11 remains C-first if actual compatible hosts pass readiness, then B hybrid after frontend proof; A Cloudflare-centric is deferred. Cloudflare domain/DNS/security preference does not select application topology. Actual deployed hosts/regions/identity/runtime/cost remain unknown.

The [Next/vinext guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) and [Node HTTP documentation](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/) were rechecked 2026-10-25. vinext remains beta; Node HTTP adaptation is documented, but dependency/lifecycle compatibility needs tests. No conversion/build/deployment or account operation ran.

Before selecting A/B, prove exact Next16 routes/RSC/actions/images/middleware; credentialed API/OAuth/state/cookies and F02 origin rejection; Prisma7 pooling/transactions and F06 count/order; protected scheduling/overlap/fencing; email suppression/transport semantics; and runtime KMS trust. Pages static export remains insufficient for the complete server-dependent application as-is. Node interval scheduling is implemented in outbox.service.ts and started from server.ts; it is not a durable serverless scheduler.

Keep private/cookie/auth/admin/worker responses out of edge caches and sensitive Hyperdrive reads cache-disabled initially. No numeric recurring budget is adopted without comparable low/base/peak workload, plans, regions and log/backup/KMS/email costs. No price-refresh claim. Topology, billing, domain/accounts and deployment each require separate approval. Real flight/hotel inventory and fulfillment remain external; no supplier calls occurred.
