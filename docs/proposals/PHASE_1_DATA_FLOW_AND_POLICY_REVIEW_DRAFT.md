# Phase 1 — Data Flow, Privacy and Operations Review Draft

> **REFERENCE-ONLY, removed from active engineering gating on 2026-10-28.** Research and useful technical/privacy requirements are preserved. Historical checklist statuses are not current engineering blockers or legal approvals. See [single governing owner decision](PHASE_1_INTERIM_STATUS_AND_EXIT_CHECKLIST.md#0-governing-owner-decision--2026-10-28-supersedes-prior-engineering-gate-wording). No redundant new legal package is created.


2026-10-26, Asia/Dhaka. **REVIEW DRAFT — NOT FOR PUBLICATION, LEGAL APPROVAL OR OPERATIONAL ACTIVATION.**
Baseline: development HEAD bbeb862b03949056c1f93539631ad31c054a11ab. Static local source review only; no customer records, database connections, provider requests or production configuration were inspected.

## 1. Reconciliation with the supplied draft

The attached DATA_FLOWS_AND_POLICY_DRAFTS.md is a useful starting proposal, not deployed-state evidence. Its approximate GitHub anchors are replaced below with current local paths. Its counsel register is mapped into the existing [legal evidence review](PHASE_1I_D_LEGAL_EVIDENCE_REVIEW.md), not adopted as a second authoritative legal register.

- bookingDetails is JSON in storage, but current input is a strict flat allowlist with a 4096-byte limit; historical output is filtered again. Do not describe current validated input as unrestricted arbitrary JSON.
- DTO minimization is implemented; it does not establish encrypted database persistence. Passenger passport/DOB/expiry strings are still assigned in source.
- Public privacy text's no-child-collection assertion conflicts with supported child/infant input. Its generic encryption/data-center/regular-assessment statements lack sufficient implementation/deployment evidence in this review.
- Hotel/flight search defaults are mock providers. Payment status/manual booking metadata is not gateway settlement or supplier fulfillment.
- The package's proposed evidence appendix is not actual local execution evidence. Only the owner's directly confirmed Offline marker/exit are newly recorded as such.
- Actual vendor identities, countries, contracts, production feature enablement, backups and operational records remain UNKNOWN.

## 2. Current code-derived processing inventory

Paths are repository-relative and line anchors refer to the baseline above. A code capability does not prove deployment, a stored real record or a real disclosure.

| Asset / fields | Collection, purpose and persistence | Authorization/output/external boundary | Source and unresolved fact |
|---|---|---|---|
| Account identity: id/email/name/password hash/role/avatar/verification flag | Register/login/profile; User stores account data; Account stores provider identity and optional access/refresh material | AuthUser response is selected; customer account routes require authentication; provider actual enablement/contract unknown | schema.prisma:48,73; auth.service.ts:73–101; account.routes.ts:14–32. Hashing is not a complete provider-token protection policy. |
| Verification/reset credentials: token/hash, userId, expiry/used timestamps | Current issuers generate opaque credentials and store hashes; legacy verification compatibility remains | Raw credential URL goes to notification service; consumption has AUTH-02 transaction controls | schema.prisma:88,102; auth.service.ts:55–70,152–221,239–263,277. Historic token rows/logs not inspected. |
| Sessions/JWT and cookies | Session stores refresh-token hash, expiry/revocation metadata; JWT carries user/role/session claims | HttpOnly cookies; production secure/SameSite=None, development lax; frontend fetch includes credentials | schema.prisma:115; auth.service.ts:35–52; auth.controller.ts:7–38; client/src/lib/api/client.ts:109. Browser/deployed domains and cookie inventory unknown. |
| OAuth account/state | Google routes and configured strategy; Account provider identifiers/token fields exist | OAuth validation/role checks must remain; no provider account/callback contacted | config/passport.ts; routes/auth.routes.ts:75–96; middleware/oauth-state.ts:12; schema.prisma:73. Provider purposes/scopes/retention and deployment region require owner evidence. |
| Inquiry identity/travel/preferences: name/email/phone, dates, route/destination, cabin/occupancy, notes, optional userId | Flight/Hotel/Package/VisaInquiry persist requests for agency handling | Account endpoints require auth; admin API requires ADMIN/STAFF; current list validation/pagination retained | schema.prisma:217–311; account.routes.ts:14–25; admin.routes.ts:26,44,71,98,128. Free notes may contain volunteered sensitive data; actual content unknown. |
| Booking/contact/payment-state metadata: customer details, reference, type/model/status, price/currency, bounded itinerary JSON, notes | Booking creation or inquiry conversion persists operational state; state does not prove paid/reserved travel | Public booking creation uses optionalAuth; lookup uses reference/email with limiter; account/admin paths have separate boundaries | bookings.routes.ts:17–37; booking.schemas.ts:7–46,63–77; booking.service.ts:195–280; schema.prisma:374. Gateway agreement and true settlement unknown. |
| Passenger documents: names/type/gender/DOB/passport/expiry/nationality | Input caps/date validation; adult/child/infant supported; source writes optional document strings | Customer/admin DTOs omit raw DOB/expiry/passport; admin receives a mask. No production field encryption is established | booking.schemas.ts:19–46; booking.service.ts:34–44,163–177; schema.prisma:401; utils/booking-dto.ts:29–46. Supplier necessity, child consent and actual historical stores unknown. |
| Booking history/reasons/operator identifiers | BookingStatusHistory stores transitions, optional reason/changedBy | DTO restricts history fields by audience; notes/reasons can be free text | schema.prisma:419; utils/booking-dto.ts:47–49. Audit/record purpose, retention and operator training require approval. |
| Notification recipient/subject/template/params/status/attempts/errors | NotificationOutbox stores recipient and JSON params; verification/reset URLs can enter that payload | Worker processing/leases/retry and truthful suppression exist; SMTP sends only under configured conditions | outbox.service.ts:99–115,254; notification.service.ts:36–67,287–316; schema.prisma:442. Actual provider/region/legacy payloads/delivery unknown. |
| Idempotency principal/key/logical digest/reference/optional user | Durable replay isolation; canonical payload hashing; can link a person to an operation | Caller/operation scoping is an integrity control, not anonymization or a lawful retention decision | idempotency.service.ts:43–49,66–109; schema.prisma:129. Digest privacy/keyed-version policy DB-04 remains open. |
| Contact/support and testimonials | ContactMessage stores contact/content; Testimonial can contain author/quote information | Staff management routes exist; publication/moderation and support channels need actual operating evidence | schema.prisma:318 and testimonial model; admin.routes.ts:29–41. Do not collect passport scans in ordinary support mail. |
| Logs/errors/request metadata | Structured logger carries requestId and supplied metadata; serializeError minimizes driver errors | Error handler uses sanitization, but raw startup/shutdown/exception sinks still exist; query email lookup can enter access/referrer logs | logger.ts:10–36; error-handler.ts:18,51; server.ts:12,39,53–57; bookings.routes.ts:32. Central logs/APM/access-log policy unknown. |
| Inventory/supplier/payment integrations | Provider interfaces exist; default flight/hotel searches use mocks; manual payment policy is returned | Real inventory/reservation/fulfillment must use external systems under approved contracts; no live supplier/gateway asserted | flight-aggregator.service.ts:25; hotel.service.ts:11; utils/booking-dto.ts:17–20; future-stubs.routes.ts:14. API fields, recipients/countries and commercial relationships unknown. |
| Backups, exports, object storage and subprocessors | No live stores/backup systems inspected; this source pass is not a complete infrastructure inventory | Require private inventory, access controls, restore quarantine and approved propagation/holds | UNKNOWN — infrastructure/operations owner must supply systems, regions, providers, copies and retention facts. |

HTTP body limits and origin protection exist (app.ts:67–69 and request-origin middleware); they do not establish legal basis or complete privacy compliance.

## 3. Confirmed documentation/control gaps and proposed tickets

| Finding | Evidence | Required owner/gate |
|---|---|---|
| P01 Child notice conflicts with input capability | privacy/page.tsx:117–120 vs booking.schemas.ts:22 | Product/privacy/counsel L-04; separate exact notice/code change approval. Do not silently disable or relabel children. |
| P02 Public safeguard claims exceed reviewed evidence | privacy/page.tsx:64 vs plaintext passenger assignments and absent production KMS proof | Security/privacy L-05/L-10; fact-check wording and actual controls before publication. Disk/provider encryption remains unknown. |
| P03 Sensitive token URLs persist through ordinary outbox params | auth.service.ts:68–70 -> notification.service.ts:294–315 -> outbox.service.ts:110–115 | AUTH-01/03, OUT-01/02/03, KMS/DB dependencies; no application fix authorized here. |
| P04 Residual log and URL-query exposure surfaces | server.ts raw sinks; GET lookup email query | OUT-04/L-05/L-09; exact sink/lookup design and synthetic sentinel regression package. No real log inspection. |
| P05 Policy operational promises unproven | privacy/page.tsx mentions payment details, personalization and rights; mocks/manual flows/current account routes do not establish all promises | Product/privacy/support/finance provide actual enabled-feature evidence; draft accurate scope only. |
| P06 No approved category schedule/processor-country map supplied | Existing legal register and package gaps | L-07/08/11/13/14, business/DBA/infra/vendor facts and written counsel dispositions. |

These are source/document observations, not confirmation of a live breach or actual customer-data contents.

## 4. Six workstream briefs and acceptance evidence

| Brief | Inputs / legal IDs | Engineering package and measurable review outcome |
|---|---|---|
| A — Applicable legal baseline | Corporate/market facts, authenticated Gazette/amendments/notices; L-01/L-12 | Counsel signs operative-provision schedule; owner accepts exact release profile; source/version archive complete enough for that decision. |
| B — Collection, basis, children | Field/purpose matrix, screens, supplier necessity, guardian model; L-02/03/04 | Approved field allowlists and basis/notice per workflow; child decision represented in actual behavior and tested denial/guardian cases. |
| C — Security and planning | Threat model, source exposures, hosting/IAM/key contracts; L-05/L-10 | Fourteen security-unit evidence matrix, real identity/KMS choices and later G5/G6 effectiveness tests. AES-256-GCM remains a proposed engineering design, not a statutory algorithm claim. |
| D — Rights and incidents | Verified support channels, identity verification, operations contacts/rules; L-06/L-09 | Approved runbooks plus synthetic intake/denial/hold/propagation and incident tabletop results; no invented regulatory clock. |
| E — Retention/register/tax | Actual categories, lifecycle, holds, backups, VAT facts; L-07/08/13 | Separate signed schedules for documents, operational records, audit and finance; authorized synthetic expiry/hold/restore tests before any real deletion. |
| F — Vendors and transfers | Agreements, field specs, countries/access/subprocessors; L-11/L-14 | Approved field-recipient-country-purpose map and contract/transfer conditions; no outbound real traveler data before relevant gate. |

## 5. Privacy notice — review copy, not publication-ready

**Issuer:** [legal entity and trading name — OWNER TO CONFIRM]. **Contact:** [verified privacy/support address — OWNER TO CONFIRM]. **Effective date:** TBD after counsel and owner acceptance.

We use information supplied through accounts, travel inquiries, booking requests and support interactions to operate the specific services described in the approved purpose register. Relevant categories can include account/contact information, travel requirements and traveler details. A purpose, necessity, legal basis and required/optional status must be recorded for each category before this text is finalized.

The present source includes agency-assisted booking and demonstration inventory. A search result or operational payment status must not be described as supplier reservation, ticket issuance or successful payment. Identify actual enabled payment, supplier and marketing services before listing their data collection here.

Traveler passport/DOB/expiry collection requires a separately approved necessity and protection decision. Children/infants are represented in current input; the final notice must state the counsel-approved guardian workflow or a fully enforced feature exclusion. This draft does not declare a legal age threshold.

Only approved recipients should receive the minimum data required for an approved purpose. Insert actual supplier, mail, hosting, payment and subprocessor categories/countries after contract and transfer review. Do not promise a transfer mechanism that has not been established.

Security descriptions must match proven controls. Account protections, response minimization and proposed encryption are distinct. No claim is made here that all stored traveler fields are encrypted or that production KMS, secure facilities or periodic assessments are verified.

Retention follows a category-specific approved schedule, including lawful holds, processors and backup handling. No period is inserted until its basis/start event and applicability are reviewed. Pending decisions do not authorize indefinite retention.

Individuals may use the verified channel for applicable rights requests. Explain secure verification, applicable procedures/exceptions and real operational capability after counsel review. Do not promise immediate universal deletion or a deadline not established by operative law.

Describe actual cookies/browser storage/analytics separately after inventory. HttpOnly session cookies in source do not establish absence of other client or third-party storage. State truthful notice revision/contact procedures once approved.

**Publication blockers:** named entity/contact, purposes/bases, actual feature/vendor/country inventory, child decision, truthful safeguard evidence, approved rights/retention language, counsel disposition and owner sign-off.

## 6. Retention and legal-hold matrix — every duration TBD

| Category / store | Proposed purpose/end-event to validate | Period + legal source | Hold / propagation requirement to decide | Owner / evidence |
|---|---|---|---|---|
| User/provider account and sessions | Account service, expiry/revocation/closure | TBD, L-03/06/07 | Fraud/security/legal holds; provider account and backups | Auth/privacy; session/closure tests later |
| Verification/reset material | Issue, consume, expire or supersede | TBD, L-05/07 | Token usability differs from record retention; legacy outbox/backups | Auth/security/DBA |
| Passport/DOB/expiry | Approved supplier necessity ends | TBD, L-02/04/07/11 | Minimal operational copies; legal holds and restore quarantine | Privacy/booking/DBA |
| Booking/inquiry/contact/history | Service fulfillment/support/dispute purpose ends | TBD, L-03/06/07/08 | Separate notes/sensitive inputs, supplier corrections and holds | Product/support/privacy |
| Notification recipient/payload/error | Delivery/failure/redrive purpose ends | TBD, L-05/07/09 | Credentials must not be reactivated or resent after restore; processor copies | Reliability/privacy |
| Idempotency records | Defined replay/integrity window and dispute needs | TBD, L-05/07, DB-04 | Preserve authorized replay semantics; no unreviewed key invalidation | Reliability/security |
| Processing/audit metadata | Approved accountability event/record category | TBD, L-08 | Minimal metadata, access control, source/timing/legal interpretation | Privacy/security operations |
| Accounting/receipt/settlement records | Finance/tax event or proceeding trigger | TBD, L-13 | Finance-specific holds; no automatic passport coupling | Finance/tax counsel |
| Logs/APM/exports/backups/provider copies | Actual store and recovery purpose | TBD, L-05/07/09/11/14 | Region, immutable copies, deletion propagation/restore suppression | Operations/infra/privacy |

No purge job, backfill, retention setting or live record action is implemented or authorized. Category-by-category final approval must identify source, trigger, duration, exception, reviewer, owner, technical implementation and proof.

## 7. Rights-request runbook — proposed

1. Intake via verified private channel; assign a case ID and minimal category/request metadata. Do not request a passport copy by default.
2. Assess fraud/sensitivity; verify identity/authority proportionately, including guardian or authorized-agent cases. Never disclose account existence or another person's records to an unauthenticated requester.
3. Scope affected account, passenger, inquiry, outbox, finance, log, backup and processor copies. Access only under separate authorized operational scope.
4. Counsel/privacy determine applicable right, procedure, deadline, exceptions and lawful holds. Record a reasoned decision without raw documents/tokens in tickets.
5. Obtain exact operation approval for retrieval/export/correction/restriction/deletion/processor propagation. This draft provides no database-operation permission.
6. Verify recipient-bound secure response, corrections/deletion outcome and backup/restore behavior where applicable. Keep minimized proof and notify requester using the legally approved procedure.
7. Reconcile unresolved supplier/backup copies; do not falsely mark completion. Review rejection/appeal/escalation options with counsel.

Synthetic acceptance plan: unauthenticated denial, authorized scope isolation, agent/guardian verification, lawful hold, partial fulfillment, processor propagation, redacted audit, restored-copy suppression and secure response. No tests executed here.

## 8. Incident runbook — proposed

Detect and triage; open a restricted case; preserve minimal necessary evidence and access controls; identify categories, affected systems and scope. Keep token/passport values out of general channels.

Security operations proposes containment; accountable owner approves exact credential/network/service/data actions under incident authority. This document authorizes none of those state changes. Preserve forensic chain and assess backup/supplier involvement.

Counsel/privacy decide applicable notification thresholds, recipients, content, form and timing from the operative instrument set. Timing fields and named contacts remain TBD; no universal 72-hour rule is adopted. Coordinate supplier/processor assistance under contract.

After approved recovery, validate credential validity, worker leases, duplicate/delivery ambiguity and restore quarantine. Record root cause, controls, obligations, evidence and follow-up owners. Claim resolution only from actual verification.

Synthetic tabletop: token-bearing outbox disclosure; passenger-field log exposure; wrong-recipient dispatch; key outage/denial; restored expired credentials; supplier incident with uncertain scope. Each needs later exact exercise approval.

## 9. Supplier/processor and KMS/region evidence request

For each actual provider, obtain legal entity/role, contract/DPA, intended fields and necessity, processing purposes, storage/backup/log/support access countries, subprocessors and onward transfers, retention/return/deletion, incident cooperation, audit evidence and termination/suspension terms. Record business owner and legal/security disposition. Do not send a traveler sample or credentials to obtain these facts.

Inventory supplier offer/search separately from reservation/fulfillment, ticket/PNR creation, hotel confirmation, cancellation/refund and payment settlement. Mock providers are not contractual inventory and a browser redirect is not proof of fulfillment.

Before G4 selection, obtain host/runtime and workload identity/issuer, IAM boundaries, endpoint/resource/region/key-version mapping, residency implications, key lifecycle/disable/recovery, backup/key separation, availability/RPO/RTO, cost/quotas and alerts/monitoring. KMS selection does not by itself resolve L-11/L-14. No provisioning, real-key creation or provider call is approved here.

Processing register design: processing ID, category, purpose/basis decision reference, source, actors, recipients/countries, approved schedule, holds, control/evidence references, named accountable owner, version and review trigger. Store no raw passports, credentials, mail bodies or password-bearing URLs.

Staff access design: named duties, least privilege and purpose, reviewed join/move/leave procedures, independent customer ownership checks, restricted privileged decrypt, protected audit and periodic access review. A role label alone is not trusted KMS authorization.

## 10. Owner and acceptance checklist

Owner must assign real people to counsel, privacy/product, finance/tax, security, DBA/reliability, infrastructure/KMS, supplier and support/incident responsibilities. No reviewer names or approvals are invented.

Keep AUTH-01/02/03, OUT-01–04, KMS-01–03, DB-01–04 individually tracked. AUTH-02 G3 proof is independent of unresolved real-KMS selection but still requires its scoped database approvals. G5 integrated and G6 staging/recovery evidence remain required; G7 is an owner decision after mandatory evidence and legal dispositions. No Phase 2 authorization follows automatically.

Acceptance for this DOCUMENTATION package: current source anchors and contradictions recorded; fourteen canonical decisions still BLOCKED; fresh official-source access distinguished from failed/historical access; policy/runbook placeholders explicit; no application/helper/database changes. Operational readiness and legal compliance remain BLOCKED.

## 11. 2026-10-27 current-code inventory and disclosure proposals — REVIEW DRAFT

This supplements, rather than replaces, sections 2–10. Business clarifications and source provenance are in legal annex section 8. This is a complete model/field enumeration of the inspected Prisma schema plus the source-visible flow/sink inventory below; it is **not** a complete deployed-system or real-record inventory. No database, production configuration or customer record was accessed. No statutory classification, period, legal basis or transfer permission is assigned.

### 11.1 Field manifest

Generated from the current schema source, not Prisma generation or database introspection. Each entry includes scalar fields and logical relation fields; relations are not duplicate physical columns. Types/optionality are included. Every listed personal or potentially personal field inherits the relevant category handling in section 11.2. Public content fields can still hold personal information entered by editors. No record values are included.

| Model | Source | All declared fields/types |
|---|---|---|
| User | server/prisma/schema.prisma:48 | `id:String`, `email:String`, `password:String?`, `name:String?`, `role:UserRole`, `emailVerified:Boolean`, `avatar:String?`, `createdAt:DateTime`, `updatedAt:DateTime`, `accounts:Account[]`, `emailVerificationTokens:EmailVerificationToken[]`, `passwordResetTokens:PasswordResetToken[]`, `sessions:Session[]`, `idempotencyRecords:IdempotencyRecord[]`, `flightInquiries:FlightInquiry[]`, `hotelInquiries:HotelInquiry[]`, `packageInquiries:PackageInquiry[]`, `visaInquiries:VisaInquiry[]`, `bookings:Booking[]` |
| Account | server/prisma/schema.prisma:73 | `id:String`, `userId:String`, `provider:String`, `providerAccountId:String`, `accessToken:String?`, `refreshToken:String?`, `createdAt:DateTime`, `user:User` |
| EmailVerificationToken | server/prisma/schema.prisma:88 | `id:String`, `token:String`, `userId:String`, `expiresAt:DateTime`, `usedAt:DateTime?`, `createdAt:DateTime`, `user:User` |
| PasswordResetToken | server/prisma/schema.prisma:102 | `id:String`, `tokenHash:String`, `userId:String`, `expiresAt:DateTime`, `usedAt:DateTime?`, `createdAt:DateTime`, `user:User` |
| Session | server/prisma/schema.prisma:115 | `id:String`, `userId:String`, `refreshTokenHash:String`, `expiresAt:DateTime`, `revokedAt:DateTime?`, `createdAt:DateTime`, `lastUsedAt:DateTime`, `user:User` |
| IdempotencyRecord | server/prisma/schema.prisma:130 | `id:String`, `operation:String`, `principal:String`, `key:String`, `payloadHash:String`, `referenceNumber:String`, `userId:String?`, `createdAt:DateTime`, `user:User?` |
| Destination | server/prisma/schema.prisma:149 | `id:String`, `slug:String`, `name:String`, `country:String`, `description:String?`, `startingPrice:Int`, `image:String?`, `featured:Boolean`, `status:ContentStatus`, `createdAt:DateTime`, `updatedAt:DateTime`, `packages:Package[]` |
| Package | server/prisma/schema.prisma:170 | `id:String`, `slug:String`, `title:String`, `destinationId:String`, `description:String?`, `price:Int`, `durationDays:Int`, `featuredImage:String?`, `gallery:String[]`, `itinerary:Json?`, `inclusions:String[]`, `exclusions:String[]`, `featured:Boolean`, `status:ContentStatus`, `createdAt:DateTime`, `updatedAt:DateTime`, `destination:Destination`, `packageInquiries:PackageInquiry[]` |
| VisaInfo | server/prisma/schema.prisma:198 | `id:String`, `country:String`, `slug:String`, `visaRequired:Boolean`, `processingTime:String?`, `fee:String?`, `documents:String[]`, `notes:String?`, `status:ContentStatus`, `updatedAt:DateTime`, `createdAt:DateTime` |
| FlightInquiry | server/prisma/schema.prisma:217 | `id:String`, `referenceNumber:String`, `userId:String?`, `fromAirport:String`, `toAirport:String`, `departureDate:String`, `returnDate:String?`, `passengers:Int`, `cabinClass:String`, `name:String`, `email:String`, `phone:String?`, `notes:String?`, `status:InquiryStatus`, `createdAt:DateTime`, `updatedAt:DateTime`, `user:User?` |
| HotelInquiry | server/prisma/schema.prisma:243 | `id:String`, `referenceNumber:String`, `userId:String?`, `destination:String`, `checkIn:String`, `checkOut:String`, `guests:Int`, `rooms:Int`, `name:String`, `email:String`, `phone:String?`, `notes:String?`, `status:InquiryStatus`, `createdAt:DateTime`, `updatedAt:DateTime`, `user:User?` |
| PackageInquiry | server/prisma/schema.prisma:268 | `id:String`, `referenceNumber:String`, `userId:String?`, `packageId:String?`, `packageTitle:String?`, `travellers:Int`, `travelDate:String?`, `name:String`, `email:String`, `phone:String?`, `notes:String?`, `status:InquiryStatus`, `createdAt:DateTime`, `updatedAt:DateTime`, `user:User?`, `package:Package?` |
| VisaInquiry | server/prisma/schema.prisma:293 | `id:String`, `referenceNumber:String`, `userId:String?`, `destination:String`, `nationality:String`, `travelPurpose:String?`, `name:String`, `email:String`, `phone:String?`, `notes:String?`, `status:InquiryStatus`, `createdAt:DateTime`, `updatedAt:DateTime`, `user:User?` |
| ContactMessage | server/prisma/schema.prisma:318 | `id:String`, `referenceNumber:String`, `firstName:String`, `lastName:String`, `email:String`, `phone:String?`, `subject:String`, `serviceType:String?`, `message:String`, `status:ContactStatus`, `createdAt:DateTime`, `updatedAt:DateTime` |
| Testimonial | server/prisma/schema.prisma:340 | `id:String`, `quote:String`, `author:String`, `role:String?`, `rating:Int`, `status:TestimonialStatus`, `createdAt:DateTime`, `updatedAt:DateTime` |
| Booking | server/prisma/schema.prisma:374 | `id:String`, `referenceNumber:String`, `bookingType:BookingType`, `bookingModel:BookingModel`, `status:BookingStatus`, `customerName:String`, `customerEmail:String`, `customerPhone:String?`, `totalPrice:Int`, `currency:String`, `bookingDetails:Json?`, `notes:String?`, `userId:String?`, `createdAt:DateTime`, `updatedAt:DateTime`, `user:User?`, `passengers:BookingPassenger[]`, `statusHistory:BookingStatusHistory[]` |
| BookingPassenger | server/prisma/schema.prisma:401 | `id:String`, `bookingId:String`, `firstName:String`, `lastName:String`, `passengerType:String`, `gender:String?`, `dateOfBirth:String?`, `passportNumber:String?`, `passportExpiry:String?`, `nationality:String?`, `createdAt:DateTime`, `booking:Booking` |
| BookingStatusHistory | server/prisma/schema.prisma:419 | `id:String`, `bookingId:String`, `fromStatus:BookingStatus`, `toStatus:BookingStatus`, `reason:String?`, `changedBy:String?`, `createdAt:DateTime`, `booking:Booking` |
| NotificationOutbox | server/prisma/schema.prisma:442 | `id:String`, `channel:String`, `recipient:String`, `subject:String`, `payload:Json`, `status:NotificationStatus`, `attempts:Int`, `maxAttempts:Int`, `nextAttemptAt:DateTime`, `processedAt:DateTime?`, `error:String?`, `idempotencyKey:String?`, `createdAt:DateTime`, `updatedAt:DateTime` |

### 11.2 Storage, purpose, access, retention and disclosure map

All periods, start triggers, holds, recipient propagation and backup erasure/recovery rules remain TBD for counsel/owner approval (L-07/08/13). Expiry/revocation of a usable credential does not prove deletion of its record or payload. Referential cascade behavior is not a retention or rights-fulfillment program.

| Manifest group / engineering risk (not statutory class) | Purpose/storage/projection and potential disclosure | Retention/deletion/logging gap and required owner |
|---|---|---|
| User/Account — identity and credential HIGH | User holds password hash and identity; Account permits provider access/refresh fields. Current Google strategy discards received access/refresh arguments (config/passport.ts:40); schema capability is not proof of stored provider secrets. Auth responses select id/email/name/role/emailVerified; cookies carry access/refresh material. | Verify provider/account necessity and historical contents privately later; closure/supersession/backup/rights propagation and privileged access need auth/privacy review. Never put hashes/tokens into logs or ordinary exports. |
| EmailVerificationToken/PasswordResetToken/Session — authentication secrets HIGH | Current issuers store hashes; legacy verification consumption compatibility remains. JWT includes sub/email/role/sid. Raw verification/reset URLs reach notification params. | Existing usedAt/expiry/revokedAt and token supersession deletes are not full retention. AUTH-01/03, OUT-01–03, DB-01/02 and security/privacy schedules required. |
| IdempotencyRecord — linkable operational/security data HIGH | Principal/key/payloadHash/reference/user link are durable. OAuth consumption also uses this table with operation oauth:google:consume, state as key, hash and fixed reference (middleware/oauth-state.ts:48–56). Logical digests are not anonymization. | Approved replay/expiry/cleanup, state retention and DB-04 digest policy must preserve replay safety. No real inventory or deletion authorized. |
| Flight/Hotel/Package/VisaInquiry — contact/itinerary HIGH | Services persist contact/travel/notes under optional userId; customer list/details enforce ownership; admin requires ADMIN/STAFF. Email confirmations disclose name/reference/type to configured SMTP recipient; no live supplier disclosure shown. | Free notes may contain unnecessary identity/health/child information. Define necessity, warnings, projections, support access, end-event and holds; privacy/product/support owners. |
| Booking/BookingPassenger/BookingStatusHistory — traveler/financial/linkable HIGH | Passenger document strings are assigned without field encryption in booking.service.ts:34–44,163–177. DTOs remove raw passport/DOB/expiry, mask passport for admin and constrain history by audience. Guest output still includes traveler names/type/nationality and itinerary when passengers are loaded; account identity is masked. | Guest necessity and names/nationality exposure require explicit review, not an “anonymous lookup” claim. Notes/reasons/customer contact require limited staff access. KMS-03/DB-03 plus rights/retention/hold/restore design needed. No production data examined. |
| NotificationOutbox — routing/authentication payload HIGH | recipient/subject/payload/template/params/error and attempts are stored. SMTP submission is a potential external disclosure only when enabled. F03/F04 lease/retry/suppression controls are preserved. | Raw auth URLs/recipient require AUTH/OUT/KMS/DB work. Retry failures/redrive/backups must not resurrect credentials. Separate recipient, payload, error and audit lifetimes; reliability/security/privacy owners. |
| ContactMessage/Testimonial — personal/free text HIGH | Contact/support captures identity/message; public testimonial contains author/quote/role. Staff moderation and publication are different purposes. | Verify publication basis/consent, contact channel, volunteer-sensitive-data minimization and removal/rights propagation; product/support/privacy owners. |
| Destination/Package/VisaInfo — editorial content; conditional personal risk | Titles/descriptions/images/gallery/itinerary/documents/notes and publishing state are content rather than evidence of uploaded traveler documents. Public rendering/image URLs may involve hosts/CDNs. | Editor content can introduce personal data/third-party assets. Verify upload/storage/provider behavior and editorial publication rights; product/infra/privacy. No passport-upload model established by VisaInfo.documents. |
| Browser/request/transient state | Auth cookies auth_token and refresh_token; OAuth state cookie google_oauth_state or production __Host-google_oauth_state, signed state/query and durable consumption marker. Flight input includes tripType, airports, dates, adult/child/infant counts, cabin and optional multi-city legs; hotel search has destination/dates/guests/rooms (validators/flight.schemas.ts, hotel.schemas.ts). | Cookies have source-configured lifetimes; actual browser, CDN, proxy, analytics and countries need G6/private deployment inventory. Source search found no localStorage/sessionStorage/document.cookie or named analytics implementation in client/src and client/app; this is not proof no browser/third-party storage exists. |

**Bounded bookingDetails keys:** offerId, flightNumber, departureDate, returnDate, cabinClass, hotelId, checkIn, checkOut, guests, rooms, packageId, packageTitle, travelDate. Current input is strict, flat, max 4096 serialized UTF-8 bytes, text max128; max50 passengers with real calendar checks (booking.schemas.ts:3–46). Output filters historical JSON again, permits known payment status, supplies fixed public payment policy/supportContact; admin may get bounded sourceInquiryId/sourceInquiryReference/sourceInquiryType (utils/booking-dto.ts:7–24). Text allowlists bound structure but do not prevent users placing sensitive values in legitimate strings/notes. Supplier-required fields and semantic minimization need later review; no arbitrary nested sensitive JSON is authorized by current input.

**Mail parameter inventory:** CONTACT_CONFIRMATION(to, firstName, referenceNumber); INQUIRY_CONFIRMATION(to, name, referenceNumber, type); EMAIL_VERIFICATION(to, name, verificationUrl); PASSWORD_RESET(to, name, resetUrl); BOOKING_CONFIRMATION(to, name, referenceNumber, bookingType, totalPrice, currency); BOOKING_STATUS(to, name, referenceNumber, status, optional reason). These flow through notification.service.ts exported methods to outbox.service.ts payload.params. Optional dbClient is an internal call parameter, not business data or an approved disclosure. Review strict message DTO separation under OUT-01; no actual mail sent.

**Log/sink inventory:** request-id.ts:22–28 logs requestId, method, path with query removed, status and durationMs. Thus the application request logger is not shown logging lookup email query; reverse proxies/CDN/APM/browser history remain unverified. logger.ts:10–36 serializes selected error codes but accepts arbitrary supplied metadata, so it is not a universal automatic field scrubber. server.ts:12,39,53,57 still sends raw errors/reasons to console. flight-aggregator.service.ts:37 logs provider name and raw error.message; mock default does not remove the future provider-error risk. Outbox logs identifiers, suppression reasons and sanitized errors; identifier linkability and provider logging/retention require review. AUTH/OUT sentinel tests must exercise every sink, not just serializeError.

**Outbound and derived inventory:** frontend API fetch includes credentials; Google profile/callback operates only when configured; SMTP receives message routing/content; default flight/hotel inventory uses mocks. No current source evidence of live Trip.com/Booking.com fulfillment, production marketing delivery or card collection/settlement is established. Payment status/price/currency and selected payment policy are operational metadata. No new supplier/provider request made. In-memory plaintext/password/url objects, HTTP bodies, validation errors, JWT/cookie buffers, URL history and mail rendering are transient handling surfaces; memory erasure is not proven. Proxy logs, APM, support exports, object storage, backups, developer copies and processor copies require a separately authorized infrastructure/retained-data inventory.

### 11.3 Purpose ledger and review-ready operating policies

| Purpose | Minimum categories and recipients to justify | Decision/control still required |
|---|---|---|
| Register/login/restore/recover | Account identity, password/credential hashes, cookies, verification/reset mail | L-03/05/07; protected issuance/delivery, session revocation, truthful notice and finite credential-record schedule. |
| Search/inquiry/support | Route/destination/dates/counts and request contact/free text | No automatic passport necessity at search/inquiry; minimize fields/notes, authenticated detail access and support intake safeguards. |
| Reservation/fulfillment | Only supplier-required traveler/contact fields at the approved booking step | Actual supplier contracts, necessity, child/guardian rules, encryption/access, international transfer and dispatch gates. Intended workflow is not permission to activate it. |
| Payments/accounting/disputes | Actual invoice/payment-state/ledger evidence; no unnecessary passport copy | Tax counsel separates financial schedule/holds from traveler documents. No live payment provider assumed. |
| Marketing — intended, not verified operational | Separate contact/preference/evidence ledger and campaign recipients/channels | Product/counsel approve basis, notices, audience/child restrictions, withdrawal/suppression and tests. No blanket booking consent or SMTP activation. |
| Security/operations/rights/incidents | Minimal audit/processing/case metadata and verified contacts | Access/case identity checks, holds, recipient propagation, incident escalation and legally verified clocks. Never copy raw passport/token into tickets or incident logs. |

Sections 5–10 remain review-ready policy drafts, not public promises. Final privacy/retention/rights/incident/supplier-processing documents must use the corroborated operator, purposes, field map, recipients/countries, contact ownership and counsel decisions above. Incident playbooks distinguish detection, containment, evidence preservation and legal notification decision without inventing a reporting deadline. Rights playbooks distinguish request verification, access/correction, eligibility/holds, recipient/backup propagation and restore quarantine without promising immediate universal erasure. Supplier terms must address field/purpose limits, security, assistance, access countries/subprocessors, incident notice, return/deletion and exit. No provider agreement is presumed.

### 11.4 Separately approvable P01 and P02 packages — no public source edited

Both proposals target only client/app/privacy/page.tsx, in sequence after actual text/counsel review; implementation permissions are NOT supplied by this documentation task. No layout.tsx, backend, schema, dependency or new test files are included. Read-only source/static checks and existing client no-emit checks suffice for narrow copy changes; actual child/marketing controls need separately designed code/test scopes.

**P01 — child-data inconsistency, BLOCKED pending reviewed workflow.** Evidence: privacy/page.tsx:117–120 denies knowing collection from children under16; booking.schemas.ts:22 supports child/infant passenger records and flight schemas support counts. Owner intends child travel at release. Proposed interim factual disclosure for review: “Our booking forms include child and infant traveler categories.” This factual correction does not establish lawful processing. Final guardian/authorized-booker, required fields, purpose, applicable age, rights and retention wording must be supplied by counsel and product before publication. Remove unsupported no-child/under16 assertions only under the separately approved copy patch. Backend guardian enforcement/evidence is not implemented or authorized here. Acceptance: final notice and actual end-to-end child controls agree; no invented statutory age, blanket guardian consent or implied approval; later synthetic tests cover unauthorized bookers, missing/invalid evidence, bypass paths and minimization. Text-only patch cannot close L-04 or enable child processing.

**P02 — unsupported security and operating disclosures, BLOCKED pending verified copy.** Evidence includes privacy/page.tsx:64 (encryption/facilities/regular assessments), :91 (seven-year booking retention), :98 (claimed transfer safeguards), :103–112 (analytics/personalized advertising), :139–145 (unverified US postal contact/privacy mailbox), :11 (render-time “last updated”). These observations supplement P02; existing P03–P06 IDs retain their meanings. Verify displayed operator/contact, payment/supplier/marketing/personalization claims and rights channel against actual business facts. Proposed security copy for review: “Our application uses account authentication, access controls and measures that limit personal information in selected API responses. Security measures and their effectiveness require ongoing review.” Do not claim deployed passenger field encryption, certified facilities, independent regular assessments, approved transfer mechanisms or a universal retention period. Replace the seven-year assertion only with counsel-approved category/purpose language; source text alone does not establish a substitute period. Use a real owner-approved policy revision date rather than today's render date. No fake address/mailbox or unverified supplier name may be inserted. Acceptance: each public assertion has an evidence owner, source, operating scope and review date; no cross-border permission or rights deadline invented; P01 text preserved; client checks pass; publication/deployment separately authorized.

**Feature exclusion proposal only:** if intended processing cannot receive approval, owner/counsel must approve exact scope reduction plus API/server/UI/import/dispatch denial, synthetic bypass tests, operational procedure and retained-data/hold/rights handling. Do not treat unresolved intended children/passports/international/marketing as already excluded. No existing data obligation disappears through a feature flag or notice edit.
