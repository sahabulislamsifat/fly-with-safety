# Phase 1I-A — F07 traveler data and F06 inquiry pagination

## Scope and evidence

Planning: deep; context: dependencies; verification: impact; delegation: none. Audit and plan
only. Branch development retains the existing dirty tree. No application code, schema,
migration or environment file changed. No database connection, test execution or provider
request occurred. Owner reports Phase 1H seven migrations, 20 tables, 16/16 live integration
cases and zero residual records; those are accepted starting evidence, not re-executed here.

Reviewed Express services/routes/validators/auth/error/logging, Prisma models, client booking
types/lookup rendering, booking lifecycle/idempotency tests and account API tests. Relevant
Express and Next.js security skill guidance was consulted. Findings describe source behavior;
no actual traveler records were inspected. Severity reflects confidentiality and availability
impact, not proof of exploitation or a jurisdiction-specific legal conclusion.

## F07 findings

### F07-1 — High: bulk passenger disclosure to general operations roles

[booking.service.ts](E:/Programming/Project/fly-with-safety/server/src/services/booking.service.ts:484)
lists bookings with passengers:true and statusHistory:true. This returns passport number,
expiry and DOB alongside names/nationality. Status-update responses include the same full
passengers at lines 462–466; conversion returns them at lines 260–298.
[booking.controller.ts](E:/Programming/Project/fly-with-safety/server/src/controllers/booking.controller.ts:50)
serializes these service results directly. All are gated by ADMIN/STAFF at
[admin.routes.ts](E:/Programming/Project/fly-with-safety/server/src/routes/admin.routes.ts:28),
so this is excessive privilege/exposure within authorized roles, not an unauthenticated leak.

Fix: define audience-specific explicit Prisma selects plus response DTOs for list, status,
conversion and detail. Default responses must omit passport/DOB; provide masked metadata only
where useful. Do not grant every STAFF user automatic decryption. A separate restricted,
audited reveal operation should exist only if operations can justify it. Its permission model,
purpose and minimal audit fields need approval; do not invent a new role hierarchy silently.

### F07-2 — High: arbitrary JSON defeats sensitive-field minimization

[booking.schemas.ts](E:/Programming/Project/fly-with-safety/server/src/validators/booking.schemas.ts:25)
accepts bookingDetails as z.record(...,z.any()).
[booking.service.ts](E:/Programming/Project/fly-with-safety/server/src/services/booking.service.ts:34)
stores it verbatim; lookup spreads the full object at lines 336–367. Account booking lists
select it at [account.service.ts](E:/Programming/Project/fly-with-safety/server/src/services/account.service.ts:132)
and account detail includes all Booking scalar fields at line 140. A caller can place passport
data in nested JSON even though named passenger passport fields are excluded from lookup.
Notes and status reasons are also free text returned in guest/customer views. Actual sensitive
content in these fields is not established; the uncontrolled storage/echo path is established.

Fix: inventory existing client keys before replacing JSON with per-booking-type allowlists.
Separate server-owned payment/source metadata from customer-supplied itinerary data. Keep the
current payment readiness behavior, without trusting client paymentStatus as authoritative.
DTOs must allowlist nested fields independently of input validation, covering historical JSON.
Remove internal notes/reasons from guest views unless explicitly customer-facing. Do not use
recursive key-name blacklisting as the sole defense. Historical JSON review/backfill is a
separate approved data operation. Client contract evidence:
[bookings.ts](E:/Programming/Project/fly-with-safety/client/src/lib/api/bookings.ts:15) and
[lookup page](E:/Programming/Project/fly-with-safety/client/app/bookings/lookup/page.tsx:187).

### F07-3 — High: sensitive fields stored directly, no field-level encryption boundary

[schema.prisma](E:/Programming/Project/fly-with-safety/server/prisma/schema.prisma:401)
defines optional String passportNumber/passportExpiry/dateOfBirth. Creation assigns plaintext
values directly at booking.service.ts:37–45 and conversion at lines 170–178.
[prisma.ts](E:/Programming/Project/fly-with-safety/server/src/lib/prisma.ts:1) uses a normal
PrismaPg adapter; no encryption/decryption layer is present in these paths. Database volume,
backup encryption, connection TLS and provider KMS settings were not inspected and must not
be reported absent. Application encryption limits raw DB/backup disclosure; it does not
protect against a compromised process that has decryption privileges.

First minimize collection: passport/DOB should be collected only when needed for fulfillment,
not necessarily at inquiry creation. If retention is necessary, propose an authenticated,
versioned envelope using vetted AES-256-GCM or a managed envelope-encryption service. Keep
keys separate from DB data; define key IDs, rotation, access grants, backup/restore, missing-key
failure behavior and audited decrypt permissions. Bind ciphertext to record/field identity
with authenticated context; never use a fixed nonce, JWT secret or a public NEXT_PUBLIC key.
Do not log plaintext, ciphertext blobs or key material. Nationality/gender and traveler names
also need minimization; final encryption field selection requires a documented threat model.
These recommendations follow
[OWASP cryptographic storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
and [key management](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html).

Proposed schema: nullable versioned encrypted traveler-document envelope (or explicit encrypted
columns with key-version metadata), alongside existing columns during an approved expand phase.
Generate a stable row ID before encryption if AAD binds to it. Backfill only under separate
approval; verify decrypt/read compatibility and counts before stopping plaintext writes and
later removing plaintext. Never silently read plaintext indefinitely after migration. Key loss
is not repaired by rolling back application code. Preserve F01 hashes of canonical validated
logical input BEFORE randomized encryption, so retries remain payload-bound and deterministic.
Existing text columns could technically hold ciphertext, but doing so silently breaks old
readers and does not provide a safe compatibility transition; do not choose it as a shortcut.

### F07-4 — Medium: no visible sensitive-data retention/purge policy

BookingPassenger has only createdAt and a cascading Booking relation
([schema.prisma](E:/Programming/Project/fly-with-safety/server/prisma/schema.prisma:401));
no traveler-document expiry/purge lifecycle was found. Deleting a User does not establish
passenger erasure: optional Booking.userId retains bookings via the existing SET NULL behavior.
Outbox payload/error storage and backups must be included in the policy, not only passenger
columns. This is a missing application control, not proof that external retention controls
do not exist. Fix: agree minimum collection, document purge dates, legal holds and backup
retention with the owner; later implement an idempotent exact-scope purge with counts and audit
metadata. Do not delete bookings/history required for business accountability merely to remove
passport fields. New purge/hold timestamps may be warranted after policy approval.

### F07-5 — Medium: logs are not an effective sensitive-data boundary

[logger.ts](E:/Programming/Project/fly-with-safety/server/src/lib/logger.ts:8) preserves arbitrary
Error.message and non-production stacks despite its secret-free comment.
[error-handler.ts](E:/Programming/Project/fly-with-safety/server/src/middleware/error-handler.ts:47)
logs that serialization. Prisma diagnostics can contain submitted values. Raw error logging
also exists in notification.service.ts:96 and inquiry email catch paths. Outbox fallback logs
recipient/subject at outbox.service.ts:73–79; provider failure messages are persisted at line 289.
No real passport log event was observed. Fix: structured allowlisted error code/name/request-ID
logging, field-aware redaction and tests using synthetic sensitive error strings. Keep useful
operational codes without message bodies; audit privileged reads without data values.
Positive control: request-id.ts strips query strings; unknown HTTP 500 responses are generic.

### F07-6 — Medium: guest lookup relies on reference plus email; GET puts email in URL

[bookings.routes.ts](E:/Programming/Project/fly-with-safety/server/src/routes/bookings.routes.ts:31)
accepts email in a GET query. Guest lookup returns contact/traveler data, notes and history
after email comparison (booking.service.ts:301–372), with a shared 30-request limiter. Named
passport/DOB fields are excluded. Email is an identifier, not proof of control of that mailbox.
Fix: minimize guest DTO immediately; plan an owner-approved proof-of-possession flow if
expanded detail access is required. Deprecate GET/email-query usage compatibly, keeping the
current client POST path. Add explicit Cache-Control:no-store on sensitive responses and
review CDN behavior. Browser/proxy logs remain a risk even though application request logs
strip queries. Do not remove existing guest functionality without a compatibility decision.

### F07-7 — Low/Medium: weak traveler data validation and missing array bound

[booking.schemas.ts](E:/Programming/Project/fly-with-safety/server/src/validators/booking.schemas.ts:3)
checks DOB/expiry shape but not real dates or chronology; passport is optional/max30 with no
normalization and passenger arrays have no maximum. app.ts:67 limits bodies to 100kb, so this
is not unlimited HTTP input, but it still permits large nested work relative to booking needs.
Fix: product-agreed passenger ceiling, bounded JSON shape/depth and real date validation;
trim/normalize supported document formats without an overly narrow international passport
regex. Future-date rules must distinguish new customer intake from historical staff conversion.

## Preserved security boundaries and missing tests

Account routes requireAuth; queries bind userId for list/detail, not client email. Session
existence/expiry/revocation is checked. Admin routes require ADMIN/STAFF. Public create returns
a small summary DTO (booking.controller.ts:16), and lookup explicitly selects passenger fields
without passport/DOB. Do not report those protections missing. Role claims come from the JWT
after session validation rather than a fresh User role read (auth.middleware.ts:26–31); assess
role-change/session invalidation before introducing sensitive reveal permissions.

Existing booking-lifecycle tests cover role rejection, valid conversions/status transitions,
matching lookup and wrong-email 404. They do not comprehensively prove nested sensitive-field
omission across all endpoints. Mocks can return only safe fixtures and thereby miss ORM-select
regressions. F01 idempotency and the owner-verified Phase 1H concurrency suite must be preserved.

## F06 findings and query plan

### F06-1 — Medium: unbounded combined customer inquiry pagination

[account.service.ts](E:/Programming/Project/fly-with-safety/server/src/services/account.service.ts:36)
findInquiries has no skip/take or select. listInquiries without type (lines 96–105) fetches all
four datasets, maps, sorts and slices in memory; total is the fetched length. Work/memory and
unnecessary PII retrieval grow with customer history. User isolation is present in every branch.

Preferred replacement: a static UNION ALL query through Prisma 7 tagged $queryRaw/Prisma.sql,
with one allowlisted branch per FlightInquiry/HotelInquiry/PackageInquiry/VisaInquiry. Each
branch binds the authenticated userId and validated optional status and selects only summary
columns. The outer SQL applies ORDER BY createdAt DESC, type ordinal ASC, id DESC plus bound
LIMIT/OFFSET. No user-controlled table names, order expressions or string concatenation.
Map types/dates/status into the current {inquiries,pagination} contract. Preserve page/limit,
total/totalPages, reference/type/summary/travelDate and out-of-range empty pages.

For totals use four Prisma count({where}) operations with exactly the same predicates plus
the bounded UNION page query. Use a short RepeatableRead Prisma transaction if count/page
snapshot consistency is required (recommended here); handle serialization/retry policy
explicitly, without adding automatic business-write retries. A count window alone loses the
total on an empty offset page. No new table/view/dependency is needed. Ordinary findMany cannot
express a globally ordered union of four independent models. Four take(page*limit) queries
plus JS merging is only a bounded interim alternative; it remains deep-page memory work and
does not meet the preferred database-backed global pagination requirement.

### F06-2 — Low/Medium: unstable ties and independent count/page snapshots

Typed customer lists already use count/findMany with skip/take at account.service.ts:46–54.
Admin inquiry services also already paginate in DB: flight.service.ts:73–94,
hotel.service.ts:66–83, package.service.ts:110–127, visa.service.ts:85–102. They order only by
createdAt and use independent Promise.all queries. Equal timestamps can move records across
pages; concurrent writes can make totals and page differ. Add an explicit id tie-breaker,
and document snapshot semantics. Do not rewrite these as in-memory pagination. Pagination
does not provide cross-request snapshot isolation; changing datasets can still shift offsets.

Admin routes parseInt page/limit and cast status without query-schema validation
([admin.routes.ts](E:/Programming/Project/fly-with-safety/server/src/routes/admin.routes.ts:42)).
Services clamp limit 1–50 and page>=1, which is a useful existing bound, but malformed status,
fractional/partial numeric strings and huge offsets are not explicitly rejected. Reuse a
strict shared query schema with existing defaults, integer/safe-range checks and supported
status enums. Customer account query already validates limit<=50 at account.schemas.ts:3.
Plan any new deep-page cap as an explicit API decision; do not silently break existing pages.

### F06-3 — Medium performance risk: absent composite ownership/sort indexes

Inquiry models at schema.prisma:217–313 have separate reference/email/status/createdAt indexes,
but no userId-leading index. Propose (userId,createdAt,id), and consider
(userId,status,createdAt,id) based on measured query plans. Admin filtered pages may benefit
from (status,createdAt,id). Do not add every combination without EXPLAIN evidence and a write-
overhead review. Database efficiency is not proven by client row bounds alone; UNION offsets
still cost more on deep pages. A future cursor contract is a separate API change.

Other in-memory sorting identified: account dashboard at lines 77–82 merges at most 16 rows
already bounded by four take:4 queries and keeps five. It is not the unbounded F06 defect.
Airport catalog filtering and mock-provider sorting are not database inquiry pagination.
Booking conversion JSON duplicate scans at booking.service.ts:132/222 are a separate concern,
not page slicing; record for later scope rather than refactor them in this phase.

## Implementation order and approval gates

1. Confirm allowed response fields and client JSON keys. Add synthetic exposure/ownership tests
   before DTO/input/logging changes. Deliver default redaction, strict nested DTOs, safe errors,
   and no-store headers first, without database changes. Keep lifecycle/idempotency contracts.
2. Replace only mixed inquiry pagination with parameterized DB union/count queries. Add query
   validation, deterministic ordering, narrow summary selects and snapshot semantics. Preserve
   typed/admin response contracts and role/customer isolation. No schema migration required.
3. Approve encryption field scope, decrypt permission, key service and rotation/recovery design.
   Prepare additive schema and deployment compatibility plan separately. Do not enable an
   unprovisioned key dependency or start plaintext backfill/purge.
4. Measure query plans on approved synthetic volumes. Propose only justified composite index
   migrations. Neither EXPLAIN ANALYZE against live data nor fixture writes are authorized here.
5. Approve retention policy, legal-hold behavior, purge design and rollback/recovery safeguards.

Database-changing approvals must name the exact disposable target and scope independently:
new migrations/index creation, synthetic database tests and exact fixture cleanup, encryption
backfill/rotation/re-encryption, plaintext removal and retention purge. Production execution,
credential/key provisioning, infrastructure changes and deployment each require explicit scope.
Earlier Phase 1H approval does not authorize these new operations. Do not assume the current
integration DB remains empty without a fresh read-only preflight when execution is approved.

## Security and regression test plan

- Mocked role/ownership matrix: anonymous, guest lookup, customer A/B, STAFF, ADMIN; verify
  all list/create/replay/convert/status/detail responses omit synthetic passport/DOB everywhere,
  including nested historical JSON, notes/reasons, arrays and error paths. Check ORM select
  arguments as well as HTTP DTOs; test exact allowed fields, not only absence in safe mocks.
- Validate real/invalid dates, unsupported nesting, passenger limits, document normalization,
  existing itinerary/payment metadata compatibility and unknown-field rejection behavior.
- Capture logger output for synthetic Prisma/transport/validation failures containing document
  values. Assert values/tokens/ciphertext/key material never appear. Verify no-store headers.
- Encryption unit vectors: round trip, wrong key/AAD, tampering, unique nonces, missing/retired
  key, explicit legacy migration state, masked audiences, rotation and F01 identical-payload
  replay despite different encryption randomness. No real traveler inputs.
- Pagination unit tests: four/single types, ownership predicate in EVERY branch/count, status,
  empty/out-of-range pages, totals independent of page rows, equal timestamps across types,
  bounded result selection, invalid/huge input and parameterized hostile strings. Capture raw
  SQL parameters; never validate by comparing only a mock's pre-paginated return value.
- Regression suites: booking lifecycle/idempotency, account API, admin, origin, OAuth,
  notification/outbox and existing 16 PostgreSQL cases. Offline tests first. Later, separately
  approved synthetic PostgreSQL tests establish actual union ordering, count snapshot behavior,
  constraints and index plans; preserve provider/SMTP blocking and exact-record cleanup.

No tests were run for this audit; prior counts are historical evidence only. Completion means
the source audit and implementation plan are ready for review, not that F06/F07 are fixed.
