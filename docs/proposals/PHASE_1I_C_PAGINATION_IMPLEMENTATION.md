# Phase 1I-C — database-backed inquiry pagination

Policy record: planning compact; context dependency; verification impact; delegation none.
Scope: inquiry page retrieval/validation/ordering, offline regressions and this report.
No database connection, migration, fixture write, cleanup, provider operation or deployment.
Existing F07 DTOs and PostgreSQL integration/network guards are preserved.

## Files changed in this phase

- server/src/services/account.service.ts
- server/src/services/inquiry-page-query.ts (new)
- server/src/validators/account.schemas.ts
- server/src/validators/inquiry-query.schemas.ts (new)
- server/src/routes/admin.routes.ts
- server/src/services/flight.service.ts
- server/src/services/hotel.service.ts
- server/src/services/package.service.ts
- server/src/services/visa.service.ts
- server/test/inquiry-pagination.test.ts (new, 32 offline cases)
- docs/proposals/PHASE_1I_C_PAGINATION_IMPLEMENTATION.md (this report)

## Exact query changes

Removed findInquiries/findInquiryPage and the combined all-record fetch, application sort,
and slice. Customer listInquiries now validates its input even when called directly, builds
one Prisma.sql query, and invokes $queryRaw once. Four static public-qualified SELECT branches
project only id, reference/status/timestamps, inquiry type, summary and travel date. Every
branch binds the authenticated userId and optional validated InquiryStatus predicate. When
type is supplied, the query includes only its static branch. No caller-provided identifiers,
order expression or SQL fragment is interpolated. Hostile values remain bound parameters.

An inquiries CTE feeds a bounded page ordered by createdAt DESC, typeRank ASC, id DESC.
Type ranks are flight=0, hotel=1, package=2, visa=3. Combined tie-breaking retains the former
type-group priority while making within-type equal timestamps deterministic using the unique
ID. Type+ID uniquely breaks cross-table ties. A totals aggregate LEFT JOINs the page, ensuring
that an empty/out-of-range page still returns the actual total. The application drops the
sentinel row and internal rank/count columns and explicitly constructs summary DTOs.
Prisma count bigint is converted to a checked safe integer before HTTP serialization.

Count and page execute in one SQL statement, so PostgreSQL's statement snapshot supplies
both. No transaction or cross-request snapshot token is needed. Insertions/deletions between
separate HTTP page requests can still shift offset pages; deterministic ties do not freeze
the dataset. This statement-level guarantee has source/query-contract evidence here, not an
executed concurrent PostgreSQL test.

Typed customer pages use that same one-statement mechanism. Typed admin lists retain their
existing Prisma count plus bounded findMany queries; add id DESC to createdAt DESC ordering.
Their existing independent count/page reads remain eventually consistent under concurrent
changes, rather than promising the customer query's same-statement snapshot. They were already
database-paginated and were not rewritten into raw SQL. The bounded account dashboard merge
is unchanged; it is not the unbounded inquiry pagination defect.

## Validation and compatibility

Customer inquiry defaults remain page=1, limit=10. Admin defaults remain page=1, limit=20.
Both cap page size at 50 and inquiry page number at 10,000. Positive decimal digit strings
are parsed; partial numbers, booleans, arrays, blank values, zero/negative/fractional values,
unsupported statuses and out-of-range pages are rejected. Admin inquiry GET routes now use
validateQuery before invoking services, preserving existing ADMIN/STAFF middleware order.
Direct account service callers also fail before querying if input is invalid.

Response remains {inquiries,pagination:{page,limit,total,totalPages}}. Summary fields, arrow
format, package-title fallback, empty-date null behavior and ISO timestamp serialization are
preserved. Empty databases report totalPages=0; empty offset pages retain nonzero totals.
No passenger/contact/notes fields are selected in the new summary query. Owner identity comes
from the authenticated session, never a query userId/email. Existing booking F07 DTOs, logs,
validation and privacy tests remain unchanged and pass.

Intentional compatibility changes: malformed admin queries that formerly silently defaulted
or partially parsed now return 422; inquiry pages above 10,000 are rejected; equal-timestamp
ordering is now specified. No page numbers, response property names or frontend types change.
Booking list query validation is outside this change and retains its prior behavior.

## Offline evidence

Full isolated suite: 334 passed; 16 PostgreSQL cases skipped; 18 test files passed and two
integration files skipped. Both database integration opt-ins were false, email/workers disabled,
and runtime/CLI URLs pointed to synthetic loopback port 1. Server tsc --noEmit passed; client
tsc --noEmit passed. Git diff/whitespace checks passed. No database tests were executed.

32 added cases inspect SQL ownership predicates/parameters, status filters in each branch,
stable ORDER BY keys, typed branch choice, offset/limit binding, empty-page totals, output
allowlisting, rejected malformed inputs, defaults/caps, direct-service rejection, admin
validation, deterministic admin findMany arguments, authenticated ownership and anonymous
rejection. A mocked total of one million verifies bounded application retrieval and count
handling. It is NOT a database large-volume benchmark or proof that PostgreSQL evaluates the
SQL correctly. Actual SQL parsing, ordering and snapshot behavior require the live gate below.

## Performance and index proposals — no migration prepared/applied

Application memory/result transfer is bounded to at most 50 summaries (or one empty-page
sentinel); the database still processes matching rows to count and order. PostgreSQL may
materialize the reused CTE and sort its projection, potentially using temporary disk for
large histories. Offset cost grows with depth even under the page cap. Do not describe this
as constant-time database access or proven fast at one million rows.

Current inquiry models have separate createdAt/status/email/reference indexes but no
userId-leading index. Evaluate (userId,createdAt,id) and, where status selectivity merits it,
(userId,status,createdAt,id). Admin filtered pages may benefit from (status,createdAt,id).
The CTE/order/count plan may not exploit the full sort order of a proposed index; inspect
actual plans before approving additions. Do not create all combinations automatically.
Review write cost and index-build locking separately. No new table/view/schema is required
for functional correctness. A cursor-based API remains a distinct future contract decision.

## Proposed live PostgreSQL verification — separate approval required

1. Fresh read-only exact-target, seven-migration/schema/constraint and residual-count preflight
   on the explicitly approved disposable database. Never assume it remains clean from Phase 1H.
   Keep other API/worker/test writers stopped; preserve SMTP/provider guards.
2. Approve a NEW synthetic pagination fixture scope plus exact-record cleanup. Existing 16
   reliability cases alone do not verify this query. Do not reuse prior approval automatically.
3. Seed customer A/B and guest inquiries in all four models with unique run-owned IDs/emails,
   mixed statuses, equal timestamps, empty titles/dates, and enough rows to cross several pages.
   Verify all pages against the independently specified ordering, no duplicates/missing rows,
   user isolation, typed/combined filters, exact totals and out-of-range behavior.
4. Exercise concurrent insertion/deletion while querying and verify page/count consistency
   for each individual statement. Separate HTTP requests need not share one snapshot.
5. After approving fixture volume, use EXPLAIN (ANALYZE, BUFFERS) on the read query only in that
   isolated environment. Measure unfiltered/status-filtered first/deep pages at representative
   volumes. Capture plans/timings without sensitive data, URLs or credentials. Propose index
   SQL only after reviewing results; executing an index migration requires another approval.
6. Run the existing 16 reliability cases only under explicit renewed execution/cleanup scope,
   including the empty-outbox gate. Verify exact fixture cleanup and final read-only counts.
   No reset, blanket deletion or automatic rerun after failure.

## Readiness

Code and offline gates are complete for F06, with no schema/data changes. The next scoped
Phase 1I security task can begin using these regressions. F06 live SQL/performance verification,
F07 storage encryption/retention and staging browser validation remain open; this is not a
production-readiness claim. No further phase, migration or database execution is automatic.
