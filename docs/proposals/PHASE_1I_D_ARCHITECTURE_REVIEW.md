> **Current status — 2026-10-25:** D-1 is authorized and executed; fresh review recommends **PASS WITH DOCUMENTED LIMITATIONS — REQUIRES OWNER REVIEW**. Only ADR-01/02/07/08's bounded synthetic contracts have M01 approval. Production decisions and all legal gates remain open. See [acceptance review](PHASE_1I_D_D1_ACCEPTANCE_REVIEW.md) and the R3 annex below; earlier status statements are historical.

# Phase 1I-D technical review and approval agenda

Status: **REVISE REVIEW DRAFT**. Prepared 2026-10-23. Documentation only; no technical, legal or infrastructure approval granted.

## Scope and provenance

Reviewed the existing repository design and five owner-supplied Downloads files. Both handoff copies have identical SHA-256 hashes; both review-draft copies are identical. The downloaded original design is reference input, not a replacement for repository findings. The merged design preserves the repository body and appends the imported legal register and expanded infrastructure checklist with explicit status overrides. Attached instructions were treated as review input within the owner's documentation-only scope.

Gravitas policy: planning deep, context dependency, verification impact, delegation none. Existing working tree on development is retained. No application changes or tests, database connections, keys, provisioning or provider operations are authorized here. Public document retrieval is research, not a supplier API request.

## Independent issue register

| ID / severity | Design section and source evidence | Defect or open decision | Owner | Required decision / approval gate |
|---|---|---|---|---|
| A01 High | Repository §§4–5 vs attachment §6 | Grouped bundle per write and per-field encryption under a passenger DEK are incompatible specifications | Security architect + backend | ADR-01 selects one. Recommend original grouped bundle with fresh DEK per write; if independent field retention is required, specify separate field keys/rotation and nonce budgets. No code before decision. |
| A02 High | §5; schema.prisma:401 | Stable AAD IDs must precede nested Prisma creation; no IDs assigned explicitly in booking.service.ts:36 | Backend | ADR-02 preallocates immutable booking/passenger IDs, canonical encoding test vectors, environment/purpose/version binding. Reparenting requires authorized decrypt/re-encrypt; field rename needs versioned decoding. |
| A03 High | §§6–7; admin.routes.ts:26 | Role authorization exists; purpose-grants and isolated KMS identity do not | Security + infrastructure | Approve grant model, assignment, step-up, expiry, audit admission and restricted workload. KMS IAM does not prove customer ownership. |
| A04 High | §§6,11; lib/prisma.ts:9 | Actual hosting identities/regions/KMS connectivity and isolated DB privileges unverified | Infrastructure + DBA | Close KMS checklist with deployment evidence before provisioning/activation. Same process with decrypt permission remains compromise risk. |
| A05 High | §12; notification.service.ts:290,305; outbox.service.ts:114 | Token-bearing URLs persisted; status reason flows to email at booking.service.ts:456 | Authentication + reliability | ADR-03 separates short-lived auth delivery material, expiry/redrive policy and customer-safe reason DTO. Reference-only design must explain how worker obtains authorized delivery material without recreating consumed credentials. |
| A06 High | §§9–10 | Deleting wrapped DEK from live rows does not erase backup copies; old snapshots can resurrect plaintext | DBA + security + privacy | Restore quarantine, deletion ledger and retained-key recovery procedure; no shared KEK destruction for single-record deletion. Separate data-change approval. |
| A07 Medium | §5; idempotency.service.ts:44,54 | Unkeyed hashes can expose known-input equality/guessing; randomized encryption cannot replace logical payload comparison | Reliability + security | Versioned HMAC/replay design separately reviewed; do not silently replace current digests or expire uniqueness evidence. |
| A08 Medium | §5 | AAD prevents cross-record swap but not replay of older valid ciphertext for the same row | Security + backend | Revision/CAS plus independent access/change audit and restore detection; document DB-attacker rollback limit. |
| A09 Medium | §§2,7; booking-dto.ts:37 | Admin mask currently reads plaintext; guest still gets passenger names/nationality | Backend + product | Persist approved minimized mask metadata; ordinary lists must never unwrap. Guest reduction is a separate compatibility decision. |
| A10 High | §9 and imported legal register | Statutory interpretations/source dates in attachment are unverified evidence leads | Qualified Bangladesh counsel + privacy owner | Every legal row BLOCKED until authenticated primary text and counsel disposition; no inferred retention or transfer permission. |
| A11 Medium | §14 vs attachment §15 | D3/D4 labels assign different scopes | Engineering lead | Preserve repository numbering: D2 architecture, D3 retention/migration policy, D4 offline primitives, D5 approved data rollout, I-E live proof. Draft's dry-run evaluator is a separately approved D4 subtask. |
| A12 High | §8; hotel.service.ts:11; providers/*.provider.ts | Search/mock contracts do not establish supplier reservation/ticketing authority | Product + supplier lead | Supplier-specific field maps, server quotes, contractual countries/roles, idempotency and reconciliation evidence before live fulfillment. |

## Proposed ADRs — decisions pending

- ADR-01: grouped authenticated document envelope, fresh 32-byte DEK and 12-byte nonce per write, full 16-byte tag. No shared-key multi-field variant until reviewed. Decrypt only after final authentication, never release partial output. Bound encoding, payload sizes and version dispatch.
- ADR-02: immutable IDs and canonical AAD; do not bind mutable owner/email/status or wrapping-key reference. Wrap metadata validated against configured key allowlist. KEK rewrap must not require rewriting content AAD. Test relocation and version upgrades explicitly.
- ADR-03: separate document crypto from authentication outbox secret protection. Preserve leases, retries, suppression truthfulness and durable idempotency. No passport in ordinary notification payloads.
- ADR-04: envelope-aware additive rollout; no indefinite fallback; corrupted encrypted records never fall back to plaintext. Rollback after encrypted writes requires an envelope-aware binary. Clear/drop plaintext only after separate approval and verification.
- ADR-05: independent field-specific retention, holds and recovery suppression. Existing numeric engineering suggestions are historical proposals, superseded by TBD pending approved schedule.

## Validation against checked-out implementation

Current schema has optional String passportNumber/passportExpiry/dateOfBirth at server/prisma/schema.prisma:401. Booking service writes these directly at lines 42–44 and 175–177. Issuing country and encrypted lifecycle metadata are absent from this model. DTO at server/src/utils/booking-dto.ts:28 excludes raw documents; admin masking at line 37 still uses raw number internally. Therefore encryption requires additive schema/reader design, not changing output DTOs to expose decrypted fields.

server/src/services/inquiry-page-query.ts:6 binds userId and status; lines 15–18 order in SQL. No document fields need encryption-driven changes to F06. server/test/integration-target.mjs and run-postgres-integration.mjs retain explicit target/opt-in and disabled email/worker controls. This is source inspection, not runtime verification. Historical 334 isolated passes and 16 live PostgreSQL passes remain historical; no tests rerun.

server/src/lib/logger.ts:9 strips arbitrary error text but generic metadata is not DLP. Historical JSON, free text, backup/exports and infrastructure telemetry require approved private inventories. No actual stored contents inspected.

## Public research boundary

Public [Akij Air](https://akijair.com/) page checked for flight/hotel/visa/holiday workflow reference only. FlyWithSafe's external inventory requirement is an independent owner decision. No Akij private architecture inferred. [OWASP cryptographic storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) checked as engineering guidance, not legal authority.

The [official section 18 page](https://bdlaws.minlaw.gov.bd/act-print-1692/section-print-57284.html) was accessible during this review. This does not authenticate the complete Act, rules, amendments, commencement, applicability or counsel interpretation. No legal row changes from BLOCKED. No dates or statutory intervals are adopted from the attachment as implementation requirements.

## Formal review packet and approval sequence

1. Engineering/product confirm data purposes, supplier dependencies, collection triggers, actual hosting and named accountable reviewers. Role owners in this packet are proposed; individual assignments remain TBD.
2. Counsel verifies each legal register row against authenticated current primary sources and records applicability, conditions and re-review date. Infrastructure region and retention decisions remain conditional until this closes.
3. Security/backend resolve ADR-01–05, purpose-grant and failure handling details; infrastructure resolves checklist evidence, costs, identity separation and recovery. Architecture review may proceed with blocked items visible; approval cannot silently waive them.
4. Owner separately approves bounded code-only primitives/tests with synthetic inputs and mock KMS. No real keys or application activation implied.
5. Separate approvals for KMS/IAM staging provisioning, additive schema execution, each backfill, plaintext removal, retention changes and exact-target database-writing tests/cleanup. Finish Phase 1 gates before Phase 2.

Request the next scope explicitly after review: architecture decisions first; subsequent code or database-changing work requires separate owner approval. Current disposition means the packet is prepared for formal review, with technical revisions and all legal decisions still open.

## R2 decision register — 2026-10-24

The earlier REVISE findings remain open. This revision completes the documentation response and is **READY FOR APPROVAL**, not technically approved. Owners below are accountable roles; named individuals must be assigned. Evidence paths refer to current checkout 99d2f60. Every row includes a next action; none is APPROVED.

| ID / area | Problem and options | Recommendation and rationale | Risks / dependencies | Owner | Evidence | Status / next action |
|---|---|---|---|---|---|---|
| ADR-01 Encryption | Grouped vs per-field envelope | Grouped fresh-DEK-per-write; smallest coherent original design, bounded bundle | Partial deletion requires re-encryption; product/retention decision | Security + backend + product | Design R2; schema.prisma BookingPassenger | PROPOSED — approve granularity before D-1 |
| ADR-02 Encryption | Binding IDs/AAD and relocation | Preallocate immutable IDs; fixed-array AAD; explicit migration contexts | ID change cannot be transparent; schema design | Backend + security | booking.service.ts nested create; design R2 | PROPOSED — approve canonical vectors and relocation rule |
| ADR-03 Encryption | Auth URLs/free text in outbox; encrypt vs deferred tokens | Separate auth-delivery design, minimize reasons, preserve issuance/retry atomicity | Token lifetime/redrive compatibility; independent key and retention | Auth + reliability | notification.service.ts; outbox.service.ts | PROPOSED — threat model token delivery before implementation |
| ADR-04 Encryption | Plaintext to encrypted rollout | Additive envelope-aware readers, encrypted new writes, separately approved backfill/clear | No unsafe plaintext fallback; compatible rollback binary | DBA + backend | schema.prisma; design §10 | PROPOSED — prepare schema only after architecture approval |
| ADR-05 Compliance | Retention/holds/backup erasure | Durations TBD; independent schedules and restore suppression | All legal rows open; no automatic deletion | Privacy + counsel + DBA | L-01–L-14; design §9 | BLOCKED — authenticate sources and counsel sign-off |
| ADR-06 KMS | Rotation vs rewrap vs content re-encryption | Distinguish all three; retain historical key access | Deleted key can make data unrecoverable; provider semantics | Security + operations | KMS R2 official rotation sources | PROPOSED — approve recovery/rotation runbook |
| ADR-07 Encryption | DEK cache performance vs exposure | No persistent cross-request plaintext cache | KMS latency/cost; JS zeroization limits | Security + backend | Architecture addendum cache section | PROPOSED — benchmark synthetic workload after approval |
| ADR-08 KMS | Role-only access vs isolated privileged service | Separate decrypt identity plus purpose grant; ordinary API encrypt-only | Additional deployment/authorization surface | Security + infrastructure | admin.routes.ts; booking-dto.ts; design matrix | PROPOSED — specify grants/step-up/audit admission |
| ADR-09 KMS | Key loss/restore and deleted data resurrection | Quarantine restore, verify keys, replay deletion ledger, dual-control break-glass | Ledger integrity and backup locations unverified | DBA + operations | Design §10; KMS-09/10 | PROPOSED — approve synthetic restore criteria |
| ADR-10 Encryption | External supplier disclosure | Minimum contractual fields via privileged orchestration | No validated fulfillment contracts; legal transfer blocked | Supplier lead + counsel | hotel.service.ts; provider implementations | BLOCKED — obtain field/country/contracts map |
| ADR-11 Hosting | A Cloudflare-centric vs B hybrid vs C retained hosts | C first if current hosts pass readiness; B desired evolution after frontend proof | Actual deployments unverified; vinext beta/adapter risk | Owner + infrastructure | Cloudflare assessment; netlify.toml; server.ts | PROPOSED — confirm topology and staging scope |
| ADR-12 KMS | AWS vs GCP vs Azure | Co-locate backend and KMS with native short-lived identity; AWS provisional if AWS compute chosen | Region/legal/budget/identity unresolved | Owner + security + finance | KMS provider matrix | PROPOSED — choose provider only with evidence |
| ADR-13 Hosting | Fresh DB reads vs Hyperdrive caching | Cache disabled for all sensitive/stateful DB paths initially | Pool/transaction limits must be proved | DBA + reliability | inquiry-page-query.ts; Hyperdrive docs | PROPOSED — test counts, atomic consumption and leases in approved staging |
| ADR-14 Encryption | Idempotency payload digest privacy | Separate versioned keyed-digest review; keep logical hash before randomized cipher | Replay history/rotation compatibility | Reliability + security | idempotency.service.ts | PROPOSED — no change in prototype |
| ADR-15 Hosting | Node runtime vs Workers API subset | Keep backend Node initially; pin supported runtime and dependencies | Local Node26 not deployed-runtime evidence | Infrastructure + backend | manifests; Cloudflare Node HTTP docs | PROPOSED — compatibility suite before any move |

### Additional operational findings and closure evidence

| Risk | Severity | Evidence / implication | Owner and closure |
|---|---|---|---|
| A13 | High | server/src/server.ts logs uncaught exceptions/rejections directly; logger sanitization is not universal | Backend/security: audit all sinks and prove sensitive errors absent before activation; no code changed here |
| A14 | High | Hyperdrive defaults may cache reads without write invalidation | DBA: cache-disabled sensitive binding, transaction/isolation proof; never weaken database tests |
| A15 | High | No demonstrated Cloudflare workload-to-KMS issuer/audience/subject chain | Infrastructure: native identity or vetted federation proof; a stored API token is not workload federation |
| A16 | Medium | vinext/OpenNext adapters absent; exact Next16.3.6 compatibility untested | Frontend lead: build/render/image/actions/auth staging matrix with pinned versions |
| A17 | High | Whole-process compromise can access plaintext during authorized operations | Security: separate deployment identities, narrow network/IAM, avoid dumps; encryption at rest does not eliminate this risk |
| A18 | Medium | Package managers/lockfiles differ between root/client/server | Engineering: document reproducible build selection before hosting migration; no lockfile changes in review |

Existing A01–A12 are preserved, not marked fixed by documentation. Legal and infrastructure owners may approve a design conditional on blockers, but that does not authorize real-data use, provisioning or implementation. D-1 must explicitly select the proposed bundle scope or require a revised per-field specification.


## R3 — D-1 acceptance and current ADR disposition (2026-10-25)

The owner approved only M01's D-1-specific ADR-01/02/07/08 contracts and M02/D-1 execution. The [fresh acceptance review](PHASE_1I_D_D1_ACCEPTANCE_REVIEW.md) reports 104 standalone passes and no-emit TypeScript PASS. Verdict: PASS WITH DOCUMENTED LIMITATIONS — REQUIRES OWNER REVIEW. Formal owner acceptance is pending. Earlier no-approval statements are historical; broader production approvals remain absent.

| ADR | Broad production status | Bounded D-1/current disposition | Owner |
|---|---|---|---|
| ADR-01 | PROPOSED | APPROVED for grouped synthetic contract only; production granularity/retention open | Security/backend/product |
| ADR-02 | PROPOSED | APPROVED for synthetic immutable AAD only; real allocation/relocation open | Security/backend |
| ADR-03 | PROPOSED | Auth-delivery V2 proposal refined in acceptance §5; implementation blocked | Auth/reliability/security |
| ADR-04 | PROPOSED | Additive rollout principle needs owner approval and separate DB/data gates | DBA/backend |
| ADR-05 | BLOCKED | Durations TBD; authoritative legal/counsel disposition required | Privacy/counsel/DBA |
| ADR-06 | PROPOSED | Rotate/rewrap/content distinction; provider runbook/recovery proof required | Security/operations |
| ADR-07 | PROPOSED | APPROVED no cross-request plaintext DEK cache in D-1 only | Security/backend |
| ADR-08 | PROPOSED | APPROVED synthetic grants only; real issuer/async interface/IAM unverified | Security/infra/backend |
| ADR-09 | PROPOSED | Restore quarantine/ledger/dual control need RPO/RTO and backup proof | DBA/operations/security |
| ADR-10 | BLOCKED | Supplier necessity/country/contracts and legal evidence absent | Supplier lead/product/counsel |
| ADR-11 | PROPOSED | C-first/B-after-proof recommendation; final topology evidence missing | Owner/infra/frontend |
| ADR-12 | PROPOSED | AWS provisional; GCP/Azure viable; no provider chosen | Owner/security/infra/finance |
| ADR-13 | PROPOSED | Sensitive read caching disabled initially; pool/freshness proof later | DBA/reliability |
| ADR-14 | PROPOSED | Versioned-HMAC/legacy comparator plan refined in acceptance §6 | Reliability/security |
| ADR-15 | PROPOSED | Node-first; supported runtime/build and Workers move need proof | Infra/backend |

Acceptance §§5–6 are current ADR-03/14 proposals. Auth token creation and outbox enqueue are separate writes today; atomic issuance and conditional single-use consumption are future requirements. Secret-bearing V2 jobs must fail closed rather than take non-durable/plaintext fallback. Digest migration must dispatch by stored version, preserve operation/principal/key uniqueness and legacy vectors, and keep guest principal scope stable initially. OAuth consume markers are a separate operation.

D1-L01–L08 and W1/W2 remain documented. No acceptance-blocking defect was identified in the supplied synchronous synthetic path. Future async policy/deadline/admission/configuration hardening requires separately approved corrections. No code changed.

Historical A01–A18 remain production risks. Offline tests do not close real grants, masks, revision/CAS, logs, backup/restore, hosting or supplier disclosure. Acceptance §4 gives precise approval wording and evidence owners for all 15 ADRs; no broad ADR was promoted to APPROVED.
