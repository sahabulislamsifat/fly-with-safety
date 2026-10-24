# Phase 1I-B — immediate F07 response and validation protection

Policy record: planning deep; context dependency; verification impact; delegation none.
Scope: explicit DTOs, input bounds, error/log confidentiality, minimal admin mask compatibility,
and isolated regressions. No encryption, schema/data changes, pagination implementation or
integration-runner changes. Existing uncommitted Phase 1 work is preserved.

## Response contract

- Public booking creation retains its explicit receipt summary and adds Cache-Control:no-store.
- Guest POST and GET lookup use an allowlisted DTO: reference/type/status/price/currency/dates,
  safe itinerary/payment details, basic passenger identity and public status transitions.
  Customer contact values are replaced with generic/masked display strings; phone, notes,
  internal history reasons/actors, source metadata, DOB and raw passport fields are omitted.
- Customer account list/detail use the same nested JSON allowlist and safe passenger/history
  fields. Customer contact fields remain available to the authenticated owner; notes/internal
  history reasons and passport/DOB fields are omitted. Existing userId predicates remain.
- ADMIN/STAFF list/conversion/status results use an explicit operations DTO. Contact details,
  names/nationality, operational notes/reasons/actors and source references are retained.
  Raw passport/DOB/expiry/gender and internal model linkage fields are not serialized. A
  passportNumberMasked suffix replaces the raw passport field in the existing admin display;
  documents of four or fewer characters are fully masked. Both roles receive the same view.
  No document-reveal endpoint is added. Admin list queries avoid unused DOB/expiry columns;
  the number is still read internally to derive the mask, never returned as plaintext.
- Sensitive success responses and all account endpoints set no-store. GET lookup still accepts
  email in a URL for compatibility; deprecation/proof-of-mailbox ownership remains separate.

bookingDetails input is a strict flat object matching current client flight/hotel/comparison
flows (plus bounded package metadata). Unknown/nested keys and client-supplied payment/source
fields are rejected. String values are bounded to 128 characters, guest/room counts to 1–50,
and details to 4096 UTF-8 bytes. Each output field is revalidated independently, so one unsafe
legacy key does not expose the stored JSON or discard unrelated safe keys. Historical nested
inquirySnapshot and arbitrary paymentPolicy are not returned. Payment status uses an enum
allowlist; a fixed public policy preserves the no-immediate-card-charge workflow.

Passenger count is bounded at 50 on public and staff conversion input. This generous code
ceiling preserves the inspected ordinary booking flows; larger group bookings now need a
separate product decision. Document strings are trimmed; dates must be actual calendar dates;
DOB cannot be in the future. Historical expiry dates remain allowed for staff conversion.

These controls are field/schema boundaries, not content classification: arbitrary sensitive
text deliberately entered into an allowed name/itinerary field cannot be identified reliably.
Operational notes/reasons remain privileged free text. Do not treat this as DLP or encrypted
storage. Future collection policy should prohibit documents in notes and other unrelated fields.

## Error and log behavior

serializeError now emits a fixed operation-error name and only known-shaped Prisma/SQL codes,
never arbitrary messages, stacks or thrown objects. Inquiry/notification raw email-error
console output uses that serializer. Outbox fallback logging no longer includes recipient or
subject. New failed-delivery rows use EMAIL_TRANSPORT_FAILURE instead of raw provider messages;
attempts, failure/retry/redrive semantics remain unchanged. Existing persisted errors are not
rewritten. Outbox suppression reasons remain distinguishable. Server AppError 5xx bodies are
generic; unknown validation keys no longer echo attacker-controlled key names. Existing
ordinary 4xx business messages remain intact. Existing arbitrary log metadata outside the
reviewed paths is not a global sensitive-content filter.

## Exact files changed in this phase

Server source:
- server/src/utils/booking-dto.ts (new)
- server/src/validators/booking.schemas.ts
- server/src/controllers/booking.controller.ts
- server/src/services/account.service.ts
- server/src/routes/account.routes.ts
- server/src/services/booking.service.ts (only list passenger projection added to prior work)
- server/src/lib/logger.ts
- server/src/middleware/error-handler.ts
- server/src/middleware/validation.middleware.ts
- server/src/services/notification.service.ts
- server/src/services/outbox.service.ts (only log/error confidentiality changes added to prior work)
- server/src/services/flight.service.ts
- server/src/services/hotel.service.ts
- server/src/services/package.service.ts
- server/src/services/visa.service.ts

Client compatibility:
- client/src/lib/api/admin.ts
- client/src/components/admin/AdminBookingsTab.tsx

Tests/documentation:
- server/test/booking-privacy.test.ts (new, 21 cases)
- server/test/notification-outbox.test.ts (two provider-error assertions now require safe code)
- docs/proposals/PHASE_1I_B_F07_IMPLEMENTATION.md (this report)

## Observed verification

Full isolated server suite: 302 passed; 16 PostgreSQL cases skipped; 17 test files passed and
two integration files skipped. Both integration opt-ins were false; runtime/CLI targets were
dummy loopback port 1; email and workers were disabled. No database or provider operation was
performed. Existing booking lifecycle, F01, F02, OAuth and outbox regressions passed.

Server tsc --noEmit passed. Client tsc --noEmit passed. New HTTP/unit tests cover admin list
and mutation disclosure, account ownership/list/detail, public creation, guest response,
no-store headers, nested historical data, invalid/leap dates, array/input bounds, unknown-key
error leakage, safe server failures/logging and admin database projection. These are synthetic
mocked tests, not live database or browser verification. Git diff validation passed.

Compatibility limits: external callers relying on arbitrary bookingDetails keys now get 422;
guest personal display values are minimized; internal reasons/notes are absent from customer
views; raw document fields are replaced/removed; operational logs lose raw provider text.
Admin source references, passenger manifest, notes and payment readiness remain available.
Client/server changes must ship together. Browser workflow verification remains pending.

## Remaining gates and Phase 1I-C readiness

Passport/DOB are still stored as plaintext; no migrated/backfilled/encrypted records are
claimed. Envelope encryption/key management/rotation, retention/holds/purge, historical JSON
and log cleanup, a permission-controlled document reveal workflow, guest proof-of-possession
and GET deprecation require separate design/authorization. Any data-changing execution must
name the target and scope; no prior integration approval is reused for that work.

Ready to begin the separately scoped F06 pagination implementation in Phase 1I-C, with the
current response/ownership protections as regression gates. This does not mark F07 or the
website production-ready. Live PostgreSQL regressions and approved staging/browser validation
remain separate execution gates. Do not start Phase 1I-C automatically.
