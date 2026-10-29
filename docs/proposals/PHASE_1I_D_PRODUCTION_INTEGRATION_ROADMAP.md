# Phase 1I-D — Production Integration Roadmap and Phase 1 Exit

> **Current governance (owner-directed 2026-10-28):** [Tracker section 0](PHASE_1_INTERIM_STATUS_AND_EXIT_CHECKLIST.md#0-governing-owner-decision--2026-10-28-supersedes-prior-engineering-gate-wording) supersedes older bespoke legal-checklist and automatic counsel-signature requirements for G7 engineering acceptance. All technical controls remain mandatory. Real-data/production activation remains separately gated. Dated findings and acceptance evidence below are preserved, not re-certified.


Prepared 2026-10-25 (Asia/Dhaka). **REVIEW DRAFT — ROADMAP READY, AWAITING OWNER REVIEW.** Planning and documentation only. Every implementation, database, provider, infrastructure and phase-transition gate below is proposed, not approved. L-01–L-14 remain **BLOCKED**.

## 1. Executive Summary

The shortest safe path is to close credential-consumption races independently, agree one production auth-delivery contract, implement atomic issuance/protected outbox dispatch, integrate a selected trusted key service, and prove the real transaction/worker/restore boundaries. Passenger confidentiality, privacy DTOs, idempotency and pagination remain part of the security acceptance boundary; synthetic crypto acceptance has not implemented them in the application.

Do not replace the working outbox, create more synthetic prototypes, migrate hosting for its own sake, or build proprietary flight/hotel inventory. Preserve existing claim/ack fencing, suppression truthfulness, OAuth state consumption, origin protection and API ownership rules. Real inventory/pricing/reservations/fulfillment remain external-supplier responsibilities under separate activation approvals.

Two decisions determine the critical path: (1) the exact intended Phase 1 exit scope and enabled data workflows; (2) hosting/workload identity/KMS plus applicable legal disposition. Code-only fixes and synthetic unit verification can progress independently after exact approval. They cannot turn an unresolved production control into VERIFIED.

No authoritative standalone Phase 1 exit checklist or complete current Phase 0 closure register was located in the inspected repository reports. Existing handoff criteria and this owner's required minimums are used below as a **proposed** checklist for G0 adoption. Unknown legacy findings cannot be silently closed. Missing scope evidence is a G0 dependency, not justification for indefinitely adding new milestones.

## 2. Current Verified State

“Verified” in this planning session means static source/document inspection unless explicitly stated otherwise. No application, test, database or external service was executed.

| Evidence class | Current finding |
|---|---|
| Owner disposition | [D-1](PHASE_1I_D_D1_FORMAL_ACCEPTANCE.md), [D-2](PHASE_1I_D_D2_FORMAL_ACCEPTANCE.md), [D-3B](PHASE_1I_D_D3B_FORMAL_OWNER_ACCEPTANCE.md) are owner-accepted within offline/synthetic scopes only. D-3A design completed. |
| Historical executable evidence | D-2 155 cases per bundled/native loader; D-3B 145 per loader, T01–T20 and strict TypeScript. [D-3B report](PHASE_1I_D_D3B_VERIFICATION_REPORT.md) records exact commands, limits and hashes. Not rerun now. |
| Historical database evidence | Owner reports Phase 1H seven applied migrations, 16/16 PostgreSQL cases and clean final fixtures. Current files contain those 16 cases. No live catalog/count/history or current consistency was checked now. |
| Current application controls | Code contains F01 principal/payload-bound durable idempotency, F02 origin enforcement, F03 protected worker, F04 suppression/submission distinction, F05 durable OAuth consume marker, F07 response DTOs and F06 database pagination. Runtime/deployed correctness is not newly verified. |
| Current gaps | Raw auth URLs in queued JSON; separate token/enqueue writes; consumption read/update race; worker lacks credential lifecycle admission; passenger sensitive fields still plaintext; production key/authorization/storage/recovery paths absent. |
| Status | Phase 1I-D incomplete; Phase 1I-E, Phase 1J and Phase 2 unauthorized. Production ADRs retain existing PROPOSED/BLOCKED gates. Fourteen legal rows remain BLOCKED. |

Older [architecture review](PHASE_1I_D_ARCHITECTURE_REVIEW.md), [decision packet](PHASE_1I_D_ARCHITECTURE_APPROVAL_DECISION_PACKET.md), [KMS gaps](PHASE_1I_D_KMS_INFRASTRUCTURE_GAPS.md), [Cloudflare review](PHASE_1I_D_CLOUDFLARE_COMPATIBILITY.md) and [readiness handoff](PHASE_1I_D_REFINEMENT_READINESS_AND_HANDOFF.md) contain historical “prototype not started” or “acceptance pending” statements. Later formal acceptance records supply milestone precedence. They do not approve production ADR-03 or select hosting/KMS. No existing document is rewritten here.

## 3. Repository and Architecture Baseline

Branch development, HEAD 154cf93. Seven preexisting tracked D-2 modifications and 13 preexisting untracked files (nine auth-delivery prototype files and four D-2/D-3 documents) are preserved. Before writing this roadmap, all **648** tracked/nonignored-untracked files were hashed. SHA-256 of sorted JSON `[path,sha256(bytes)]` entries: `39d6b900e8e5f3b29989528e5756a8167050e5948c4000a33a5cf2250fcaf8ef`. This roadmap was absent. It is the only authorized new artifact.

Important source map (existing paths relative to repository):

| Path / symbol | Static fact and significance |
|---|---|
| `server/src/services/auth.service.ts` — issueVerificationToken, register, requestPasswordReset, verifyEmail, resetPassword | Credential generation/hash, separate writes and redemption boundaries; primary integration point. |
| `server/src/services/notification.service.ts` — sendEmailVerification, sendPasswordReset, sendEmailRaw | Token-bearing params reach enqueue; transport acceptance/suppression semantics already explicit. |
| `server/src/services/outbox.service.ts` — enqueueNotification, processOutboxBatch, redriveFailedNotification | Durable JSON, direct-send fallback, updatedAt fencing, retry and redrive. |
| `server/src/routes/outbox-worker.routes.ts` — GET /internal/outbox/run | Constant-time scheduler secret check, browser credential/origin rejection, enabled gate, fixed batch/time budget, no-store. Scheduler admission is not KMS decrypt authorization. |
| `server/src/app.ts` — protectRequestOrigin and route registration; `server/src/routes/auth.routes.ts` — authRateLimiter | Origin enforcement precedes parsing/routes, auth rate limits retained. |
| `server/src/middleware/oauth-state.ts` — beginGoogleState, verifyGoogleState | Random state, signed browser cookie, expiry and unique persistent consume marker. Keep separate from auth-delivery crypto. |
| `server/src/controllers/auth.controller.ts` — getCookieOptions, setAuthCookies | Production HttpOnly/Secure/SameSite=None cookies; actual-domain browser/origin/OAuth proof remains needed. |
| `server/src/services/booking.service.ts` — createBooking, createBookingFromInquiry | Both write plaintext sensitive passenger fields; preallocate IDs before encryption later. |
| `server/src/utils/booking-dto.ts` — bookingDTO; `server/src/controllers/booking.controller.ts` | Response allowlists and guest masking already applied; internal raw selects do not prove raw HTTP disclosure. |
| `server/src/services/idempotency.service.ts` — createIdempotentInquiry, payloadHash | Unique operation/principal/key transaction, payload comparison and stable logical hash; SHA-256/locale-based legacy serializer require ADR-14 compatibility review before change. |
| `server/src/services/inquiry-page-query.ts` — inquiryPageQuery; `server/src/services/account.service.ts` — listInquiries | Parameterized UNION ALL, ownership in each branch, stable timestamp/type/id order, LIMIT/OFFSET and total/page in one statement. Do not reimplement F06. |
| `server/src/lib/prisma.ts` / `server/prisma.config.ts` | Runtime DATABASE_URL versus CLI DIRECT_URL; config imports dotenv. Do not import/run either during planning. |
| `netlify.toml`; `server/src/server.ts` — startServer | Next plugin/build intent and Node Express lifecycle; interval worker starts only in development outside Vercel. Not proof of deployed topology/region or durable production scheduling. |

No vercel.json, wrangler/OpenNext/vinext configuration or shared server/vitest.config.ts was found in the inspected paths. Code references to Vercel do not prove a Vercel deployment. Test scripts/default test discovery require inspection before later execution; never assume a missing config is an isolation boundary.

Schema and seven migration files inspected as text: 20260926202822_init; 20260927082715_full_schema; 20261009000000_auth_sessions_and_password_resets; 20261011000000_inquiry_idempotency; 20261011120000_notification_outbox; 20261022000100_contact_status_new; 20261022000200_booking_contact_schema. No migration command, live database comparison or new SQL file was produced.

## 4. D-1/D-2/D-3B Reuse Assessment

| Component | Reuse class | Production adaptation / gate |
|---|---|---|
| AES-GCM sequence, validation principles, fixed AAD vectors, error allowlisting | Algorithm/design directly reusable; production packaging still needs review | Promote reviewed pure helpers into one application-owned implementation with focused tests; no imports from server/test/prototypes. |
| Passenger context/payload/envelope parser in `server/test/prototypes/passport-crypto/envelope-codec.ts` | Interface adaptation | Parser currently allowlists fake providers/wrapped-key forms. Preserve accepted files/bytes; approve actual metadata/version/limits rather than weakening validation. |
| D-2 bounded async orchestration in `passenger-document-crypto.ts` | Adaptation | Use measured provider budgets, one retry authority, awaited policy, no timeout retry without cancellation proof; retain no cross-request plaintext DEK cache. |
| D-3B `AuthDeliveryCodec`, canonicalAAD | Adaptation / trusted provider dependency | Domain/AAD order remains reference. Synthetic recipient/token/key literals and 60-byte fake wrapped-key assumption cannot certify real credentials/KMS. Register production metadata explicitly; a changed wire/AAD contract needs a separately approved version and vectors. Never silently redefine accepted V1/V2. |
| Synthetic grants, SyntheticAuthorizationPolicy/SyntheticWorkerPolicy | Test doubles only | Replace caller-provided role strings with authenticated service identity plus trusted purpose/assignment/expiry/step-up/admission policy. |
| SyntheticKmsAdapter/SyntheticKeyProvider | Test doubles only | No ephemeral fake KEK, fake identity or local-key fallback in production. Real provider/resource mapping and unwrap permissions require G4. |
| FakeOutbox/FakeTransport/fault clocks | Test doubles only | Port invariants/test cases to current Prisma/outbox, not their array-based implementation. Real locking/transactions/SMTP proof separate. |
| D-3B logical issuance, one-time consume, revisions and lease cases | Schema/transaction-dependent design | Existing token/outbox linkage and identity generation need a minimal relational design; do not add every fake field automatically. |
| Guard/config/test vectors | Offline verification reuse | Retain standalone suites unchanged; use scoped production-unit mocks/config so imports cannot initialize Prisma, env files or SMTP. |
| Retention/erasure/restore/supplier disclosure | Legal/operational-dependent | L-01–L-14 disposition and approved policies; no automatic deletion/key destruction. |
| More prototypes, general crypto framework, hosting rewrite | Not required for minimum exit | Existing accepted suites already model the stated risks. Add only a concrete missing proof in application tests. |

One shared production envelope/key-control layer is preferable to copying async orchestration into every service. Proposed module boundaries are narrow: `server/src/security/envelope.ts` (pure validation/bounded key contracts), `server/src/security/auth-delivery.ts`, `server/src/security/passenger-document.ts`, and `server/src/security/data-key-provider.ts` (interface/registry only). These paths are **proposed new files**, not implemented/approved. Select an actual adapter file only after G4; no provider-specific dependency is selected here.

## 5. Current Production Security Gaps

| Finding | Source-backed evidence | Disposition |
|---|---|---|
| P-G01 High: reusable mail credentials in storage | auth.service.ts:55–70,183–203 constructs raw links; notification.service.ts:287–315 forwards params; outbox.service.ts:106–117 stores JSON verbatim | P0 auth-delivery confidentiality; no evidence of exploitation asserted. |
| P-G02 High: partial issuance/supersession | auth.service.ts register, resendVerification and requestPasswordReset perform account/token/delete/enqueue separately | P0 atomic issuance and deliberate supersession; encryption outside short DB transaction. |
| P-G03 High: redemption race | verifyEmail/resetPassword read unused/unexpired before transaction, then update token by id alone | P0 conditional consume and account/password/session side effects in one transaction. Static risk, no live reproduction now. |
| P-G04 High: bypass of protected durable delivery | enqueueNotification falls back to direct send for unavailable table/nontransactional failure | P0 secret-job fail-closed; ordinary-message fallback remains separately classified. |
| P-G05 High: no auth credential admission in worker | processOutboxBatch renders/sends payload; redriveFailedNotification resets any FAILED row without token checks | P0 purpose/token/account/expiry/revocation/recipient admission before decrypt/send/redrive. |
| P-G06 High: plaintext passenger storage | schema.prisma BookingPassenger.dateOfBirth/passportNumber/passportExpiry; booking.service.ts:37–45,170–177 | P0 for enabled sensitive workflows. F07 DTOs mitigate output, not storage/backup access. |
| P-G07 Blocking dependency: actual identity/key/recovery | Only standalone fake providers/policies exist; source has no real document/auth-delivery integration | P0 before real protected workflows; G4 selection and proof cannot be inferred from Cloudflare preference. |
| P-G08 Medium: remaining unsafe exception sinks | server.ts uncaughtException/unhandledRejection/shutdown handlers log raw values; logger.ts serializeError already strips messages/stacks | Narrow residual sink hardening, not wholesale logging rewrite. Review proxy/APM/access logs separately before live token pages. |
| P-G09 Compatibility: legacy plaintext and digest state | verifyEmail accepts hash or legacy raw row; outbox has unversioned params; idempotency stores SHA-256 of canonical logical payload | Separate reader/supersession/legacy disposition; ADR-14 versioned digest review must not break replay. No inventory of live values. |

Guardrails already present are not new defects: updatedAt claim/ack/expiry fencing, explicit suppression, authenticated worker trigger, F02 pre-business rejection, OAuth state marker, booking DTOs and parameterized F06 queries. Maintain them and obtain fresh integration evidence after relevant changes.

## 6. Authentication Integration Plan

1. First isolate AUTH-02: conditional single-use verification/reset with existing schema. Recheck token identity/hash/usedAt/expiry inside the transaction; exactly one winning consume commits its user change/session revocations. Hash a reset password outside the transaction. Preserve legacy verification lookup until separately dispositioned; do not retire legacy data accidentally.
2. Settle consumption-time semantics at G1: expiry must not be extended by waiting for a lock. Prefer a parameterized conditional DB update using current database wall time where needed; prove lock-wait/expiry behavior at G3. Transaction-start `now()` or a timestamp captured before a long wait must not silently redefine the validity window. A count other than one aborts all side effects with the existing generic API error.
3. For AUTH-01, allocate immutable token/message IDs, generate once, hash verification material and encrypt before transaction. In the transaction recheck account/generation, supersede prior intended credentials, persist token and protected outbox row, commit together. Registration account creation joins that unit if all-or-nothing is selected; returning a session before durable issuance commits is not acceptable under that choice.
4. Define logical issuance identity for retry/lost response, same-key payload conflict and concurrent deliberate issuance. Use durable constraints/short transactions, not a process-local map. Retry/redrive never calls issuance. Existing public endpoint response/cookie and enumeration behavior remain unchanged unless separately approved.
5. AUTH-03 binds recipient to a trusted account identity generation and original token purpose/message. Current account.service.ts updateProfile changes name only. No email-change endpoint was found in this service, but code absence does not prove no operator/other writer can change email; choose a guarded identity-generation strategy before activation, including change-away/back and account recreation.
6. Preserve routes/authRateLimiter, protectRequestOrigin, session cookie paths, credentialed CORS, OAuth begin/verify state and durable replay records. Production auth delivery must neither reuse the JWT/OAuth key nor change callbacks/redirects as a side effect.

## 7. Outbox Integration Plan

Keep NotificationOutbox and existing processOutboxBatch. Add an explicit version/purpose dispatch branch with strict schema validation. Ordinary V1 inquiry/contact/booking messages retain their approved behavior; secret V1 verification/reset jobs enter an owner-approved inventory/quarantine/compatibility disposition. Corrupt/unknown V2 must never fall back to V1 or direct SMTP.

Preallocate the row identity used in AAD. Preserve stable idempotency and token linkage. A JSON envelope fits payload storage, but recipient confidentiality and relational linkage do not: never keep a cleartext copy of an encrypted recipient just to satisfy the current NOT NULL column. See DB-01.

After claim, verify current token purpose, account identity, original recipient, expiry/consumption/revocation and worker authority. Await authorized decrypt; recheck lifecycle and lease before actual send. Build URLs only from approved configured origins/templates; ciphertext cannot supply endpoints or arbitrary HTML. Retain bounded lease ownership/expiry acknowledgments and monotonic updatedAt advancement. Do not hold a transaction across crypto or SMTP.

Retries preserve the original credential/envelope/message. Suppression/invalid/expired/denied/integrity outcomes cannot be labeled DELIVERED or treated as endless transient failures. Redrive performs current admission and expected-version CAS; it never renews expiry or issues a token. Preserve existing attempt/backoff limits unless separately justified.

SMTP acceptance followed by process failure/lease loss can lead to duplicate submission after recovery. A stale worker must not overwrite current state, but fencing cannot retract transport acceptance. Do not abandon an in-flight SMTP send using Promise.race and then retry it. Provider cancellation/idempotency, if available, require actual evidence; neither proves inbox receipt.

## 8. KMS Integration Plan

Select hosting, environment boundaries, region/data flow, short-lived workload identity and IAM before provider. Cloudflare domain/DNS/security preference selects no application runtime. Existing Node/Express/Prisma/nodemailer dependencies favor retaining a proven compatible runtime initially; this is a recommendation, not deployed compatibility proof. Hybrid/Workers alternatives need the tests in [Cloudflare compatibility](PHASE_1I_D_CLOUDFLARE_COMPATIBILITY.md). No current vendor documentation, availability or pricing was queried in this no-external-services task.

Minimum application interfaces: trusted logical key reference → fixed provider/resource/version registry; fresh DEK creation plus wrap, or approved provider GenerateDataKey; unwrap under purpose-specific identity; explicit async authorization; OperationControl/deadlines and classified provider outcomes. SDK ciphertext sizes/algorithms/version resolution must replace fake assumptions through reviewed format/version contracts. Keep PII out of provider encryption context/audit labels. Never resolve endpoints from envelope input.

Separate passenger-document, auth-delivery, JWT/OAuth and any idempotency-digest keys. Ordinary booking/list APIs must not gain passenger unwrap. Auth-delivery worker has no passenger key. Trusted service identity alone is insufficient for customer/purpose admission; verify role/assignment/context/step-up/expiry and apply no cross-request plaintext DEK caching initially.

Choose one layer to own retries; account for SDK internal retries, concurrent admission, total deadlines, cancellation acknowledgment and late-result cleanup. The accepted fake timeout defaults are not production SLOs. Demonstrate denied/throttled/unavailable/old-key/disabled-key behavior in authorized staging. No plaintext fallback.

Rotation, KEK rewrap and content re-encryption are distinct. Preserve historic resource/version access for retained envelopes/backups. Establish dual-control deletion, alerting, restricted logs, RPO/RTO, recovery owner, break-glass and restore quarantine before activation. Minimum audit/alerts/recovery are P0; cosmetic dashboards are deferrable. Real provisioning, key access, cost/billing and provider tests each need separate scope.

## 9. Database Integration Plan

| Requirement | Classification | Minimal proposal / decision |
|---|---|---|
| Conditional usedAt/expiry consume with side effects | Application-only, existing schema | AUTH-02 needs no new table/column. A real DB concurrency test is still mandatory. |
| Encrypted payload / format version | No column needed for JSON alone | Store explicit envelope/version discriminator in payload. Strict app dispatch; relational CHECK constraints may reinforce selected invariants. |
| Protected recipient + durable token-message linkage | Additive schema migration / compatibility | Candidate: recipient becomes nullable for protected jobs only; add optional unique emailVerificationTokenId/passwordResetTokenId foreign keys and backrelations. Check exactly one correct token relationship for protected purposes, neither for ordinary jobs. Do not add a parallel auth-outbox table by default. Final design may choose equivalent normalized linkage; G1/G3 must settle FK deletion semantics and ordinary-row checks. No SQL generated now. |
| Supersession/revocation/account identity | Conditional additive schema migration | Candidate revokedAt and issuance/identity generation fields only where required by selected lifecycle. Existing deleteMany is not a durable revocation history. Avoid adding every fake revision field; prove concurrent deliberate issuance and change-away/back policy. |
| Passenger envelope/metadata/CAS | Additive schema migration | Nullable envelope/version and minimal approved mask/revision metadata beside existing columns; immutable preallocated IDs. Decide column versus relation by least privilege, not preference. CAS stops ordinary stale writes; independent checkpoint/restore policy is needed for privileged rollback. |
| Existing plaintext tokens/jobs/passengers/backups | Data migration/backfill / operational | Private inventory, reader compatibility, approved batch scope, verification, then separately approved plaintext removal; no automatic rewrite/deletion. Temporary mixed-reader access must be bounded and explicit. |
| Idempotency digest | Conditional additive + application/versioned migration | Preserve operation/principal/key unique index and legacy serializer. ADR-14 keyed logical digest/version/key identity must be separately selected before protected payload use; never hash randomized ciphertext for equality. Historical hashes need disposition, not silent replacement. |
| Worker lease fields | No schema change by default | Existing status + millisecond updatedAt CAS already implements fencing. Do not add a lease table/token column without evidence that current invariant is insufficient. |
| F06 composite indexes | Deferred pending evidence | Owner/status/createdAt/id indexes only after representative authorized query plans demonstrate benefit. No index migration merely because an audit suggested one. |
| Backup/key restore/deletion holds | Operational/recovery configuration; legal-dependent schema only if chosen | Quarantine and reconcile authoritative lifecycle/checkpoints; same-DB revision alone is not independent rollback proof. |

G3 preparation and execution are separate. Review exact schema diff and SQL, constraints, FK actions, nullability, enum/transaction rules, indexes, timeouts, old-client compatibility, history/checksums and failure recovery. Preserve the existing seven migrations. A later migration is additive and separately named/reviewed; no db push/reset shortcut.

Current runtime/CLI/test URLs can differ because code reads different environment variables. Future approved tests must verify matching DATABASE_URL/DIRECT_URL/INTEGRATION_TEST_DATABASE_URL privately, literal loopback/port/name, disposable owner designation, schema/history and empty outbox. Existing runner restricts full reliability execution to 127.0.0.1:5432/flywithsafe_phase1h_integration with explicit opt-ins, disabled email, schema preflight and bail-on-first-suite failure. Do not assume it remains disposable/empty now; never target preserved flywithsafe_integration or remote resources. Do not run this runner in the present task.

## 10. Minimum Code Change Matrix

Fourteen proposed change units: **Authentication 3; Outbox 4; KMS/crypto integration 3; Database 4**. Counts are change units, not distinct file counts. Full repository-relative source paths and symbols are in §3; matrix basenames refer to that map. Schema means server/prisma/schema.prisma, and proposed security-module basenames resolve under server/src/security/ as listed in §4. New files are marked proposed. Each ID's second table supplies dependencies/legal/tests/rollback/approval details. P0/P1 labels are proposed for G0, not a waiver of any finding.

| ID / domain / priority | Existing issue and exact files | Minimum change / reused design / invariant |
|---|---|---|
| AUTH-01 / Authentication / Critical P0 | auth.service.ts issuance/register/resend/reset; notification.service.ts auth send functions | Preallocate IDs, encrypt outside transaction, atomically persist intended token/job/supersession/account effects; D-3B issuance model; no orphan/double issuance or retry-generated credential. |
| AUTH-02 / Authentication / Critical P0 | auth.service.ts verifyEmail/resetPassword; proposed `server/test/auth-consumption.test.ts` and `server/test/auth-consumption.vitest.config.ts` | Conditional single-winner consume plus side effects; D-3B T12; preserve generic errors, legacy lookup, public routes/cookies/OAuth. First independent package. |
| AUTH-03 / Authentication / Critical P0 | auth.service.ts; account.service.ts identity writer boundary; proposed auth-delivery.ts policy | Trusted recipient/purpose/account-generation checks and supersession policy; D-3B T05/T07/T11; no silent retarget or change-away/back resurrection. Name-only profile update need not be rewritten. |
| OUT-01 / Outbox / Critical P0 | notification.service.ts; outbox.service.ts enqueue/render paths; proposed auth-delivery.ts | Versioned protected auth branch, strict metadata, secret-job fail-closed; D-3B T01–T06/T18; ordinary job behavior preserved. |
| OUT-02 / Outbox / Critical P0 | outbox.service.ts processOutboxBatch/redriveFailedNotification; worker route admission retained | Lifecycle/decrypt/send/redrive admission and sanitized terminal codes; D-3B T10–T16; preserve existing lease/expiry CAS, retry limits and transport truthfulness. |
| OUT-03 / Outbox / Critical P0 for retained legacy | outbox.service.ts readers; auth.service.ts legacy verification branch; proposed unit tests | Reader-before-writer V1/V2 disposition; no corrupt-V2 plaintext fallback; bounded legacy access, no data action implied. |
| OUT-04 / Outbox/security sinks / Critical P0 for secrets | server/src/server.ts exception hooks; server/src/lib/logger.ts; notification/outbox error paths | Use existing safe serializer/allowlisted reasons at residual sinks; D-3B T17; no raw provider/credential/body/status-reason logging. |
| KMS-01 / KMS/crypto / Critical P0 for encryption | proposed envelope.ts, data-key-provider.ts, auth-delivery.ts and selected adapter path TBD after G4 | Shared reviewed primitives and purpose-specific provider registry; D-1/D-2/D-3B adaptation; explicit production format/vectors, no fake fallback. |
| KMS-02 / KMS/authorization / Critical P0 for decrypt | proposed auth-delivery.ts/passenger-document.ts policy boundary; worker/auth middleware review-only unless scoped | Real workload identity plus purpose/customer grants before unwrap; bounded operations/no persistent DEK cache; D-2 policy/deadline invariants. |
| KMS-03 / KMS/passenger integration / Critical P0 when sensitive storage enabled | booking.service.ts createBooking/createBookingFromInquiry; booking-dto.ts; proposed passenger-document.ts | Preallocate immutable IDs, encrypt confidential fields and return approved masks without ordinary-list decrypt; preserve F07/F01 and D-1 AAD design. |
| DB-01 / Database / Critical P0 for protected auth | server/prisma/schema.prisma token/outbox models; future migration path allocated only under G3 | Protected routing and durable token-job relationship with constraints, no ordinary-job breakage; D-3B atomic/lifecycle invariants. |
| DB-02 / Database / Conditional P1 → P0 for chosen identity/supersession | schema.prisma User/token models; auth/account writer paths | Minimum selected revocation/generation/issuance uniqueness; not a copy of fake state tables. |
| DB-03 / Database / Critical P0 for passenger confidentiality | schema.prisma BookingPassenger; booking service/DTO readers; future migration TBD | Additive envelope/version/minimal mask/CAS metadata and compatible read/write rollout; existing plaintext kept until approved removal. |
| DB-04 / Database/idempotency / Conditional P1 → P0 if protected logical payloads require it | schema.prisma IdempotencyRecord; idempotency.service.ts; relevant booking/inquiry callers | Separately reviewed versioned logical keyed digest, retain old replay vectors/principals/unique key; ADR-14 remains unresolved, never silently deferred as solved. |

| ID | Dependencies / legal reference | Required evidence | Rollback / approval |
|---|---|---|---|
| AUTH-01 | G1 lifecycle, OUT-01, DB-01/02 and KMS-01; L-02/03/05/08/09/10/11/14 for real processing | Registration, resend/reset failures at each commit stage; replay/conflict/concurrent supersession; no send/fallback on failed commit | Disable new writers, keep compatible reader; no partial token reissue. Exact G2 code approval; G3/G4/G5 separately. |
| AUTH-02 | G1 exact package, no KMS/schema dependency; L-03/05/10 apply at activation, not synthetic testing | Unit one-winner/failure rollback, generic errors, expired/used/legacy tokens; real lock-wait/concurrent consume at G3 | Preserve evidence; restore only package code under approved rollback, not unsafe production rollback after proving a security fix. G2 exact approval. |
| AUTH-03 | G1 identity decision, DB-02, KMS-02; L-02/03/06/10 | Wrong customer/purpose/recipient, email away/back, revoked/expired generation, no fresh credential on retry | Fail closed/disable affected writes, preserve identity generation. G1/G2 then G5. |
| OUT-01 | Approved production wire contract, DB-01, KMS-01; L-02/03/05/08/11/14 | Payload secrecy and no plaintext routing duplicate; unknown/corrupt formats denied; ordinary job regression | Reader first, writer flag off; never select plaintext fallback. G2 then separate G3/G4. |
| OUT-02 | AUTH-01/03, KMS-02 and existing F03/F04; L-03/05/09/10 | Lease loss/expiry, multiple workers, consumed/revoked token, suppression/max attempts/redrive, accepted-send crash | Pause secret dispatch; retain durable jobs and versions; no blind retry of ambiguous send. G2/G5. |
| OUT-03 | Private approved inventory, G1 version policy; L-01/03/07/08/12/13/14 | Mixed readers, V1 quarantine/approved disposition, writer disabled, historic-key failure, backups | Compatible readers retained after V2 writes; no V1-only rollback or automatic deletion. G1/G2, each data action separately. |
| OUT-04 | Existing serializeError; operational sink inventory; L-02/05/08/09 | Sentinel exclusion in errors/console/APM/access logs; static sink checks and staging transport failures | Retain sanitized diagnostics; no restoration of raw secret logs. G2 code and G6 logging policy. |
| KMS-01 | G4 topology/provider/resource/format/budget; L-02/05/10/11/14 | Real synthetic-data wrap/unwrap, denied/throttled/disabled/historical key, explicit metadata/version vectors | Stop writes, retain readers/keys; no production rekey on rollback. G2 interface work only, G4 actual access. |
| KMS-02 | Trusted identity/IAM/admission, topology and actor policy; L-02/03/04/05/06/10/11/14 | Zero unwrap on denial; customer/purpose/step-up/expired grant; identity separation; no cache leakage | Revoke/pause affected workload, preserve ciphertext; no temporary broad unwrap grants. G1/G4/G5. |
| KMS-03 | DB-03, approved passenger collection purposes/grants, ADR-14 disposition; L-02/03/04/05/06/07/08/11/13/14 | F07 list/detail/mutation/guest controls, atomic encrypted writes/CAS/idempotent replay, no plaintext/mask leak | Writer off, envelope-aware reader retained, restoration quarantine. G1/G2/G3/G4; no backfill permission. |
| DB-01 | G1 routing/linkage/foreign-key deletion policy; L-03/05/07/08/10 | Exact schema/history, one protected message/token, correct purpose and ordinary job nullability | Additive rollback by writer pause/forward fix; preserve rows, no automatic down migration. G3 prepare and execute approvals distinct. |
| DB-02 | AUTH-03/supersession decisions; L-03/06/07/08/10 | Parallel issuance/consume/email identity changes, rollback and restart | Preserve generations/revocations; do not lower versions or resurrect superseded tokens. G3 separate. |
| DB-03 | Passenger production format/ID/least privilege and recovery; L-02/04/05/06/07/08/11/13/14 | Constraints/CAS/concurrent update/restore, dual-read/legacy vectors, approved masked metadata | Preserve columns/envelopes/historic keys; no data clearing without its own approval. G3 plus each backfill/removal gate. |
| DB-04 | ADR-14 owner/security selection and replay inventory; L-02/05/07/08 | Legacy/new vectors, key rotation/replay, guest principal stability, logical equality across fresh ciphertext | Keep version-dispatched old readers/keys; never recompute historical records blindly. Separate G1 design/G2 code/G3 schema/data approvals. |

No approval is implied by a file appearing in this matrix. Proposed new names are scope candidates; later approval must freeze one exact allowlist and contracts.

## 11. Legal Verification Dependency Map

Subjects below are reproduced from the actual [legal register](PHASE_1I_D_PASSPORT_ENCRYPTION_RETENTION_DESIGN.md), including its section references as register labels, **not fresh statutory verification**. The register's provisional statutory indications were not adopted as legal facts. No outside source/counsel was contacted. Every row remains BLOCKED; no invented time period, commencement date, transfer permission or applicability conclusion.

For every row, authoritative closure evidence means authenticated full applicable primary text/version/checksum, precise page/section, current rules/notices, retrieval/review date, applicability analysis, qualified Bangladesh counsel disposition, accountable owner and re-review condition. Individual reviewer names are TBD. Synthetic-only coding under exact approval can proceed without real data or legal closure; counsel must determine whether particular real-data processing/retention gates apply.

| ID / exact register subject | Status / affected engineering work | What it gates / required additional evidence | Accountable decision-maker / synthetic path |
|---|---|---|---|
| L-01 — Act identity, application, commencement — §1 | BLOCKED; all real-data packages and G7 baseline | Operative legal baseline for intended release; full applicable law/commencement/amendment evidence. Does not block this planning. Phase 1 legal exit applicability unresolved until counsel/owner disposition. | Bangladesh counsel + privacy owner; synthetic analysis allowed. |
| L-02 — Data classification — §2 | BLOCKED; AUTH/OUT privacy, KMS-01–03, DB-01/03/04 | Classification/purpose inventory and required safeguards for actual fields; blocks affected real processing/security acceptance, not fake fixtures. | Privacy owner + counsel/security; synthetic tests allowed. |
| L-03 — Lawful basis/consent — §§5–8 | BLOCKED; AUTH-01/03, OUT-01/02, DB linkage/generation | Approved basis/notices/consent by collection and notification workflow before new/changed real processing. Not a blanket “consent solves everything” rule. | Privacy/product + counsel; code with fake data can proceed. |
| L-04 — Child travelers — §9 | BLOCKED; KMS-02/03, DB-03, passenger workflows | Guardian/age/necessity requirements and current child-data handling; block child-workflow activation unless separately reviewed exclusion is enforced. Current support for child passenger types prevents assuming N/A. | Product/privacy + counsel; child-shaped synthetic cases allowed. |
| L-05 — Confidentiality/security — §§16–17, 22 | BLOCKED; all security controls | Applicable technical/organizational requirements and effectiveness evidence before affected production acceptance; prototype tests do not resolve legal adequacy. | Security owner + counsel/privacy; offline hardening allowed after code approval. |
| L-06 — Data subject rights — Chapter III | BLOCKED; AUTH-03, passenger metadata, recovery/deletion | Verified rights/procedures/exception/time requirements; block production rights/deletion operations until supported workflow and opinion. Engineering may design interfaces without real records. | Privacy/support + counsel; synthetic rights tests allowed. |
| L-07 — Retention — §18 | BLOCKED; OUT-03, token/passenger legacy, DB-01–04, backups | Category-specific approved retention, start events, exceptions/holds and restore behavior; no purge/backfill/removal or arbitrary indefinite storage policy. Actual applicable Phase 1 acceptance requirement needs legal review. | Privacy/counsel + DBA; synthetic clocks do not select legal durations. |
| L-08 — Processing records — §19 | BLOCKED; issuance/audit/recovery/DB metadata | Exact audit/register scope and record-category policy; no inference that an audit requirement authorizes retaining passport values. | Privacy/security operations + counsel; fake audit vectors allowed. |
| L-09 — Breach response — §20 | BLOCKED; OUT-04, KMS alerts/incident/recovery | Applicable notification thresholds, recipients/procedure and timing plus named operational response; needed before real-service incident readiness acceptance. | Security operations/privacy + counsel; tabletop/synthetic faults allowed. |
| L-10 — Data protection planning — §22 | BLOCKED; G0–G7 risk/architecture sign-off | Current applicable planning/standards duties, documented owners/risk assessment; design existence alone is not legal approval. | Accountable project/privacy owner + counsel/security; design work allowed. |
| L-11 — Classification and international transfer — Chapter VII, starting §29 | BLOCKED; KMS/hosting/email/backup/supplier data flow | Actual countries, provider/subprocessor roles, contracts, applicable transfer/storage conditions; block affected real overseas processing. No remote KMS/hosting assumption. | Privacy/counsel + infrastructure/supplier owner; local synthetic planning allowed. |
| L-12 — Repeal/authoritative language — §§44–45 | BLOCKED; legal baseline for all affected activation | Authenticated applicable text/language and transition interpretation; old summaries cannot settle current obligations. | Qualified Bangladesh counsel/privacy; technical vectors may proceed. |
| L-13 — VAT/accounting vs passport retention and start events | BLOCKED; retained documents/receipts, DB-03, lifecycle | Current applicable tax/accounting primary text and scoped opinion distinguishing accounting records from passport values; block unsupported retention/deletion decisions. | Bangladesh tax/legal counsel + finance/privacy; fake records allowed. |
| L-14 — Cross-border supplier/hosting processing and any EU scope | BLOCKED; regions, email/KMS/backups/suppliers | Countries, roles, contracts, applicability and transfer opinion, including whether any EU scope applies; never assume it does or does not. | Privacy counsel + supplier/infrastructure owners; synthetic work allowed. |

All fourteen require an applicability/disposition record for G7's legal checklist; they need not all prevent unrelated offline code. Rows relevant to the selected real-data Phase 1 exit profile must be resolved before that acceptance/activation. Conditional later-feature rows may stay gated only through explicit legal-owner and project-owner scope decisions, not an engineer's N/A label. If current exit requirements demand full legal closure, every remaining row blocks exit. The evidence to choose between these profiles is currently missing; G0/G7 must settle it. Retention, child support and international processing cannot be silently deferred while those actual workflows remain active.

## 12. Checkpoint-Based Approval Gates

Each row is a future checkpoint, not current authority. G3 schema preparation is not execution; G4 selection is not provisioning; G5 test approval is not customer-data permission.

| Gate | Prerequisites / proposed scope | Acceptance evidence / responsible reviewer | Failure, stop and rollback / next dependency |
|---|---|---|---|
| G0 — Roadmap approval | Source findings, exact Phase 1 scope/closure register, P0/P1/P2 and legal mapping | Owner + security/reliability/privacy adopt exit checklist, roles and critical path; record remaining scope ambiguities | Stop new implementation if scope is unagreed; revise this plan under approval. Next G1; infrastructure/legal fact gathering can run in parallel only under its scope. |
| G1 — Auth/outbox integration design | G0; concrete production payload/provider metadata, issuance/consume/recipient rules, V1 reader/rollback, worker authority, exact file/test allowlist | Auth/reliability/security/DB reviewer sign reviewed contracts; approve AUTH-02 independently if desired | Unsettled code contract or implicit real-data authority stops affected package; no execution. Next exact G2 approval. |
| G2 — Application implementation | Separate owner authorization per package; code-only/synthetic default; G4 decisions where adapter-specific code needs them | Scoped compiler/unit/privacy/OAuth/origin/outbox tests; source-safe mocks/guards; security reviewer | Stop on scope expansion/import/network side effect; preserve diff and forward-fix or approved scoped rollback. No DB/KMS activity. Next G3/G4/G5 as applicable. |
| G3 — Schema/transaction validation | G1 schema design, exact additive diff and migration SQL review; disposable target designation and private target checks | DBA/security approve preparation; owner separately approves migration execution and each fixture/cleanup run; real conditional concurrency/rollback/history proof | Wrong target/history/schema/nonempty foreign fixture stops before writes. Migration failure stops without auto retry/resolve/reset. Preserve evidence; forward recovery separately approved. Next G5. |
| G4 — Provider/identity approval | Actual topology/regions/data flow, legal applicability, supported runtime/SDK, identity/IAM/key separation, quotas/cost/rotation/recovery | Infrastructure/security/finance/privacy/owner select provider and trust model; actual staging access/provisioning separately authorized | No assumed provider/runtime compatibility or static-secret shortcut; key/identity failures pause activation. Never delete keys as rollback. Next provider-specific G2/G5. |
| G5 — Controlled security verification | Relevant G2/G3/G4 evidence; exact approved isolated targets, fixture and provider scopes | Database/auth/reliability/security accept real atomicity, multi-instance, expiry/lease, KMS denial/recovery and F01–F07 regression evidence | Any false delivery, disclosure, double consume, stale ack, target mismatch or fallback blocks completion. Pause writer/worker; no automatic cleanup. May map to I-E only after its explicit entry authorization. |
| G6 — Staging/release verification | G5, approved staging topology, applicable legal sign-offs, compatible rollback/recovery plan | QA/security/operations accept browser/cookies/origin/OAuth, authorized email submission, restore/key-failure and monitoring evidence; owner signs release package | No live mail/provider/deployment without specific authority. Quarantine restore or disable affected flow on failure. Corresponds to proposed Phase 1J only after owner authorization. |
| G7 — Phase 1 exit / Phase 2 request | Approved closure register/checklist, accepted G5/G6 scope, applicable legal dispositions, residual risk decisions | Owner/security/privacy/reliability sign evidence-based exit; separately authorize exact Phase 2 scope | Missing mandatory proof/legal scope or unresolved critical issue blocks exit. Disabled-feature exclusions require proof and approval, not a label. No automatic launch or Phase 2. |

G2 implementation and G3 migration preparation may iterate without live execution. G4 host/identity/region/counsel work can proceed in parallel with AUTH-02, but secure real encryption cannot finish without it. Later gate numbering does not require blocking all unrelated earlier code until every infrastructure decision is final.

## 13. Critical Path / Parallel / Deferred Classification

P0 is mandatory for the proposed Phase 1 security exit profile, subject to G0 ratification; Critical in §10 maps to P0. Conditional items become P0 when their selected workflow needs them.

| Class | Work and safety rationale | Owner disposition / trigger / residual risk |
|---|---|---|
| P0 | AUTH-02; AUTH-01/03 and OUT-01/02; no-secret fallback; truthful fenced delivery; key/authorization controls required by enabled sensitive flows; necessary DB constraints/concurrency proof; F07 plaintext exposure disposition; F01/F02/F05/F06 preservation; minimal safe logs/recovery/staging/legal acceptance | Owner/security cannot call these complete from fake tests. No critical finding deferred solely for schedule. |
| P0 conditional on actual legacy presence | OUT-03 legacy plaintext/token/passenger/backups | Private inventory needs approval; until known, exposure is unresolved. No blind purge or claim of “no data.” |
| P1 parallel, then P0 dependency | Hosting/provider/region/short-lived identity, IAM and cost/availability/restore evidence; selected DB-02 lifecycle schema; selected DB-04 digest privacy | Infrastructure/security/DB/legal can prepare concurrently. Once used by the architecture these are mandatory before affected activation. ADR-14 disposition cannot silently disappear from G7. |
| P1 conditional later feature | Child/supplier transfer workflows, hybrid hosting, provider-specific integration not in chosen Phase 1 profile | Only defer if disabled/excluded with owner/legal evidence; current child/data collection support or retained data may make this P0. |
| P2 | Cloudflare Workers migration/hosting optimization unrelated to retained host readiness | Future infrastructure milestone (not automatically Phase 2); trigger approved migration benefit/compatibility proof. Residual risk: retained-host limitations remain and must be acceptable. Owner approves deferral. |
| P2 | Nonessential dashboards/DX/convenience tooling/general crypto framework | Future maintenance milestone; trigger measured operational/developer need. Minimum alerts/audit/runbooks remain P0, not deferred. Owner accepts limited convenience only. |
| P2 conditional | Additional F06 indexes/performance tuning | Future performance milestone after authorized synthetic query plans. Trigger SLO/plan evidence; residual deep-offset cost monitored. Existing bounded query/correct ownership cannot be deferred. |
| P2 separate product scope | Domain purchase, payment activation and new supplier connectors | Future separately scoped product/infrastructure milestones. No Phase 1 exit dependency found in inspected evidence; G0 must confirm. Residual product limitation: demo/manual behavior stays honestly labeled and real fulfillment cannot be claimed. |

No newly invented prototype phase is needed. Deferred work has a future owning milestone and trigger; none is automatically authorized by acceptance of this roadmap.

## 14. Dependency-Aware Implementation Sequence

| Package / size | Specific outcome and exact change IDs | Prerequisites / approval / tests | Rollback / parallelism |
|---|---|---|---|
| W0 — Small | Owner adopts closure scope/checklist and assigns reviewers | G0; reconcile any missing Phase 0/1 exit artifact | Documentation revision only. Legal/infrastructure fact-finding can be scoped concurrently. |
| W1 — Small–Medium | AUTH-02 single-use consume, exact three-file request in §20 | Independent G1 contract and G2 code approval; unit/TypeScript plus later G3 real race proof | Scoped code rollback under approval, no data changes. Parallel with W2/infrastructure. |
| W2 — Medium; externally blocked decisions | AUTH-01/03, OUT-01–03 and DB-01/02 concrete contract, production format and recipient/linkage design | G1; no new prototypes; decide registration atomicity/legacy/generation | Reader/writer/recovery plan retained. Parallel with W1 and W4 decisions. |
| W3 — Large | Implement auth issuance/protected dispatch and minimal shared key contracts; OUT-04 sinks | G2 exact files, schema preparation G3, relevant provider contract decisions; unit/security/privacy tests | Reader first, writes disabled until prerequisites; no real activation. Parts parallel with passenger schema review. |
| W4 — Blocked by external decision | Hosting/KMS/identity/region/budget/legal/recovery selection; KMS-01/02 actual adapter | G4, separate provider access/provisioning and code approval | Preserve key access, no key destruction; critical-path dependency for actual encryption. |
| W5 — Large | KMS-03/DB-03 passenger integration; DB-04 selected digest compatibility; explicit legacy plan | Production contract/collection/grant approvals, G2/G3/G4 and legal/data gates | Additive reader-first, immutable IDs/CAS, no new plaintext fallback. Can parallel with auth adapter work after shared interfaces agreed. |
| W6 — Medium–Large | Actual DB atomicity/concurrency and selected provider integration; F01–F07 regressions | G3 execution + G5 isolated targets/fixtures; exact cleanup and SMTP-disabled default | Stop on failure; no reset/automatic redrive/cleanup. No reliance on historical 16 tests as new proof. |
| W7 — Medium; externally gated | Staging browser/OAuth/email/restore/release verification | G6 / explicitly approved Phase 1J package, applicable legal and operational readiness | Pause writers/secret worker, retain readers/keys; restore quarantine. |
| W8 — Small review, blocked on evidence | G7 Phase 1 exit and separate Phase 2 request | Complete mandatory closure register; approved exclusions/risk dispositions and legal applicability | No automatic phase transition or public launch. |

Earliest safe completion is bounded by the slower of (auth/passenger implementation + real DB proof) and (hosting/identity/KMS + legal disposition), followed by staging/recovery and owner exit review. Relative sizes are planning estimates, not promised dates. Staffing, approval turnaround, actual schema/data inventory, environment readiness and counsel/provider decisions can dominate elapsed time.

## 15. Test and Validation Strategy

No tests executed in this planning session. Future evidence layers:

1. Code-only compiler and isolated unit tests: mock Prisma module **before** auth import, mock notification/env/provider modules, disable envDir and block network/subprocess before application modules execute. Verify import graph/config first. Do not invoke build/postinstall/prisma generate as a hidden side effect.
2. Preserve existing `server/test/booking-idempotency.test.ts`, `booking-lifecycle.test.ts`, `booking-privacy.test.ts`, `request-origin.test.ts`, `oauth-state.test.ts`, `oauth.test.ts`, `notification-delivery.test.ts`, `notification-outbox.test.ts`, `outbox-lease.test.ts`, `outbox-worker.test.ts`, `inquiry-pagination.test.ts` and API tests. Inspect their mocks/config and use a reviewed offline selection; do not run an unrestricted default suite assuming it is safe.
3. Reuse D-1/D-2 vectors and D-3B T01–T20 as application acceptance cases; keep their accepted files unchanged. Extend actual production-boundary tests, not fake implementations. No numeric test target substitutes for invariants.
4. Real PostgreSQL under separate G3/G5 approval: simultaneous same-token consume/effect, transaction rollback, lock wait across expiry, parallel issuance/supersession, durable token/job uniqueness, process restart/retry, lost worker/lease expiry, compatible versions, encrypted booking CAS/idempotency. Exact fixture ownership/cleanup; empty outbox and all three local URLs guard; no protected database, remote DB, supplier or SMTP side effects.
5. Real provider checks under separate G4/G5 scope with synthetic data: actual workload identity/IAM denial, resource/version/context restrictions, timeouts/SDK retries/throttling/late results, historic key rotation/restore, audit leakage and availability. No production credentials required or implicitly allowed.
6. F06 real PostgreSQL query correctness: same-statement total/page, tied timestamp/type/id order, empty/deep page, customer/type/status isolation, concurrent inserts/deletes and plans under representative synthetic load. Indexes only after evidence. Current Phase 1H reliability cases do not establish this post-F06 behavior.
7. Authorized staging browser/SMTP/recovery checks: legitimate cross-origin credentials, F02 rejection/preflights, register/login/logout/session restoration, verification/reset, Google valid/invalid/replay callbacks, minimized bookings/admin/guest responses and cache bypass. Mail submission is not inbox delivery; crash ambiguity must remain documented. Validate token query strings do not reach proxy/APM/referrer logs.

Existing `server/test/idempotency.integration.test.ts` and `reliability.integration.test.ts` define six and ten cases respectively. `run-postgres-integration.mjs` connects even during preflight; it is forbidden now. Future new migrations require reviewed history/preflight updates; do not weaken guards to make a new schema pass. Existing fixture setup-settlement/diagnostics/exact-cleanup behavior remains a required regression.

## 16. Rollback and Recovery Strategy

Application rollback is not database rollback. Deploy readers before new writers; preserve ability to stop issuance/dispatch while reading protected records. Once protected rows exist, a V1-only binary is unsafe. Fail closed instead of routing secret jobs through legacy plaintext/direct-send paths. Keep lease versions/revocations/generations monotonic; a rollback must not revive consumed credentials.

Schema changes are additive initially, old migrations immutable. Review locks/timeouts/backups and a forward recovery procedure. If migration one succeeds and a later migration fails, stop and inspect history/catalog under separate authority; never automatically retry, resolve history, reset/drop or apply a destructive down migration. No key deletion as rollback.

Data backfill, plaintext clearing, deletion/holds, historic token retirement and each cleanup require their own exact approval/verification. Backups/replicas/exports remain a separate exposure surface. Restore into quarantine; verify envelope/key availability, trusted lifecycle/revision state, holds/deletion ledger and independent checkpoint where required before releasing data or enabling external effects. Same-DB counter/outbox/audit does not defeat privileged rollback of that whole DB.

Preserve raw evidence privately without secrets in logs/reports. Every package records owner/reviewer, source revision/diff, old/new format vectors, stop conditions, recovery actor and exact permissible reversal. No reset/clean/force checkout of existing unrelated work.

## 17. Phase 1 Exit Criteria

This is the proposed checklist for G0 adoption, not a claim that the existing roadmap already approved it. States are VERIFIED, PENDING, BLOCKED or NOT APPLICABLE WITH JUSTIFICATION. VERIFIED is scoped to its stated evidence.

| Exit item | Current state | Evidence required to close |
|---|---|---|
| D-1/D-2/D-3B bounded owner acceptance | VERIFIED — documents only | Formal records exist; synthetic results remain scoped. No production closure implied. |
| Complete Phase 1 finding/exit inventory | BLOCKED | Owner confirms authoritative scope/any missing Phase 0 closure list and adopts acceptance criteria. |
| Authentication delivery secrecy and no insecure fallback | BLOCKED | Real application protected writes/readers/routing and legacy disposition; OUT-01/03 tests and applicable keys/authorization. |
| Atomic issuance/supersession and single-use consume | PENDING | AUTH-01/02/03 implementation plus real DB concurrent/expiry/rollback/restart proof. |
| Outbox reliability/status/lease/retry/redrive | PENDING | Existing code preserved, fresh changed-path DB/worker/transport failure evidence and current scheduler readiness. |
| Durable caller/payload idempotency | PENDING | Existing F01 source and historical DB evidence retained; new encrypted payload/digest/replay compatibility and durable regression accepted. |
| Origin/cookie/OAuth state and replay protection | PENDING | Existing F02/F05 source retained; fresh offline and authorized actual-domain staging evidence. |
| F07 DTO/validation and F06 pagination | PENDING | Existing code present; changed-path privacy tests and actual PostgreSQL pagination/concurrency/plan evidence. |
| Passenger storage confidentiality for enabled flows | BLOCKED | KMS-03/DB-03 actual protection plus legacy/backups/grants; or an explicit reviewed exclusion that removes collection/access and deals with retained data. Merely hiding UI is insufficient. |
| Trusted keys/authorization/rotation/recovery | BLOCKED | G4/G5 identity, IAM, resource/context denial and historical-key/restore proof. |
| Schema/history/transaction/multi-instance correctness | PENDING | Exact approved target and migration/constraint/concurrency tests after implementation; historical seven migrations/16 tests not enough. |
| Relevant legal applicability and approvals | BLOCKED | §11 counsel/owner dispositions for selected exit profile; unresolved applicability is not N/A. |
| Security/operational staging and recovery | BLOCKED | Authorized G6 browser/email/cache/restore/monitoring evidence and reviewers. |
| Residual risks, disabled features and owner exit | BLOCKED | Approved risk criteria, explicit dispositions/exclusion enforcement and G7 signature; no unaccepted critical finding. |
| Domain purchase/payment/new supplier connector activation | NOT APPLICABLE WITH JUSTIFICATION — proposed only | No such Phase 1 prerequisite found; G0 must ratify deferral. No real inventory/fulfillment claim while suppliers remain unapproved. |

Phase 1 may exit only when the owner adopts the checklist, every mandatory item has appropriate current evidence accepted, critical findings are closed or formally dispositioned under approved criteria, legal applicability/required permissions are resolved for that exit scope, and G7 is explicitly signed. A controlled technical exit with real-data/public activation still disabled is possible **only if the owner and legal/security reviewers explicitly approve that scope**; it is not assumed here. Public production launch additionally requires all actual deployment, data processing, operational and release approvals. Phase 2 always requires its own scope/entry authorization.

## 18. Phase 1I-E and Phase 1J Entry Requirements

I-E is not started. Proposed G5 scope can map to I-E only after owner approval of its exact source version, accepted code prerequisites, current schema, disposable target, key/provider permissions, network restrictions, synthetic fixture ownership/cleanup and tests. Do not infer DB/provider permission from a phase label. Legal gates remain closed for real data; synthetic test authorization is separate.

Phase 1J is not started. G6 proposes its staging/release entry package: accepted applicable integration proof, designated staging topology/identity/regions, key recovery, approved data/mail/browser/provider scopes, legal disposition, current app/client checks and rollback/runbooks. No independent authoritative Phase 1J checklist was located; owner must reconcile/adopt its scope before execution. It must not expand silently to payments, domains or all suppliers.

## 19. Phase 2 Authorization Requirements

Phase 2 remains unauthorized. Require G7 Phase 1 exit evidence, unresolved-risk and feature-exclusion register, purpose/data/supplier architecture, selected hosting/KMS/regions/identity, operational/legal permissions relevant to the actual next scope, exact implementation files/targets/tests, any write/cleanup/deployment limits and explicit owner authorization. No acceptance record or roadmap creates blanket production authority.

## 20. Exact Next Implementation Approval Request

Recommend **W1 / AUTH-02 only** as the smallest independently executable production-code correction. It closes a confirmed security defect without waiting for KMS or changing schemas. It does not claim to resolve confidential outbox payloads or finish Phase 1I-D.

Proposed exact three-file allowlist (two new paths, verified absent during planning):

1. Existing `server/src/services/auth.service.ts` — only verifyEmail and resetPassword transaction/consume handling; retain generation/hash format, legacy verification lookup, endpoints/cookies/error contract and OAuth behavior.
2. Proposed new `server/test/auth-consumption.test.ts` — isolated synthetic unit tests with hoisted Prisma/notification/env mocks, network/subprocess blockers before auth imports, no app/DB/SMTP initialization.
3. Proposed new `server/test/auth-consumption.vitest.config.ts` — config-only exact single-suite standalone runner, envDir=false, no global app setup/coverage/cache, one worker; both loaders if current toolchain supports safely. This extra dedicated test config is necessary because no shared isolated server config was found; do not assume default test execution is safe.

Prerequisites: owner accepts the narrow G1 consume contract (single winner, DB-consistent expiry boundary, rollback with user/password/session side effects, unchanged legacy/API behavior) and separately authorizes this exact G2 allowlist. No schema/KMS prerequisite. If implementation cannot meet it in these three files, stop for scope revision rather than editing middleware/manifests/config elsewhere.

Required tests: valid verification/reset; same credential simultaneous modeled contenders; consumed/expired/wrong/missing token; transaction side-effect failure rollback; reset hash outside transaction; sessions revoked only by winning reset; legacy verification path preserved; no raw secrets in errors/logs. Tests must not be presented as real DB concurrency proof. Plan actual parallel/lock-wait/expiry tests for a separately approved G3 target; do not run them under this code-only package.

Proposed later validators from server: `node_modules/.bin/tsc.cmd --noEmit --incremental false`; standalone Vitest `run --config test/auth-consumption.vitest.config.ts` with bundled/native loader; reviewed offline authentication/OAuth/origin regression selection; diff/scope checks. Inspect the future test graph/guards before any run. No installs, build/generate lifecycle, credentials, env edits, live queries/mail/provider calls or application startup.

Rollback: preserve diff/evidence; revert only these package edits under authorization, never reset unrelated work. No schema/data reversal. Once activated, do not intentionally restore a known unsafe consumption path as ordinary rollback; disable affected redemption and use a reviewed forward fix if necessary.

Requested future approval wording: “Approve W1/AUTH-02 under the exact three-file scope and invariants in this roadmap §20, with offline synthetic unit/TypeScript/loader checks only. Preserve all existing work. No database access/writes, schema changes, KMS/cloud/SMTP/OAuth/supplier/payment operations, deployment or phase transition. Stop after verification.” **This request has not been approved or executed.**

## 21. Unresolved Questions and External Dependencies

- Owner: adopt authoritative Phase 1 closure inventory, exit profile and Phase 1J criteria; assign named reviewers and acceptable risk-disposition rules. No invented deadline.
- Authentication/DB: registration atomicity, public issuance idempotency semantics, concurrent supersession, trusted DB expiry boundary, identity-generation writers and FK/on-delete/ordinary-versus-secret routing constraints.
- Security: production format/version/key metadata and provider wrapped-size limits; real grants/step-up/workload identities; passenger mask/retention granularity; ADR-14 legacy keyed-digest compatibility; independent rollback checkpoint/recovery protocol.
- Infrastructure/operations: actual hosts/regions/runtime/SDK, scheduler cadence/overlap, short-lived federation/IAM, minimum logs/alerts/quotas/cost/RPO/RTO, historical key/backup availability. Cloudflare preference is not a selected runtime; no provider is selected.
- Privacy/counsel: every L-01–L-14 disposition, applicable real-data scope, holds/retention/deletion, child-data and country/subprocessor/transfer map. None was researched or approved here.
- Data owner: private approved inventory of actual legacy jobs/tokens/passenger fields/backups before any backfill/deletion/retirement or no-data claim. No database was accessed now.
- QA/reliability: fresh post-integration PostgreSQL/F06/privacy/worker/OAuth evidence, approved staging and actual transport/recovery test scope. Historical synthetic/Phase 1H results cannot substitute.

Planning verification: 21 required sections, all 14 legal identifiers, G0–G7, P0/P1/P2, proposed first package, actual source-path existence, acceptance-record precedence, document links and whitespace checked statically. All 648 preexisting tracked/nonignored-untracked files must retain the captured aggregate digest; only this roadmap may be new. No application/test, database, provider, cloud, environment, dependency, deployment or Git mutation was executed.

Actual final static results: **PASS** — 21 sections; 14 change units; all 14 legal subjects matched verbatim to the source register and remain BLOCKED; eight gates; 29 explicitly qualified source references checked (proposed/missing paths separately classified); seven migration files read as text; two first-package new paths confirmed absent; document links/new-document whitespace and `git diff --check` passed. All 648 preexisting files matched the baseline digest. No application or database tests were run. **VERDICT: PASS** for planning-document completeness and repository preservation, not production acceptance.

**ROADMAP READY — AWAITING OWNER REVIEW.** Phase 1I-D remains incomplete; Phase 1I-E, Phase 1J and Phase 2 remain unauthorized. Stop after this planning document.
