> **Current owner disposition — 2026-10-25:** **OWNER-ACCEPTED — SYNTHETIC D-1 SCOPE ONLY**, with D1-L01–L08/W1/W2 retained. See [formal acceptance](PHASE_1I_D_D1_FORMAL_ACCEPTANCE.md). [D-2 scope](PHASE_1I_D_D2_CRYPTO_HARDENING_SCOPE.md) is proposed only; implementation and later phases remain unauthorized. Earlier pending-acceptance statements are historical.

> **Current governance (owner-directed 2026-10-28):** [Tracker section 0](PHASE_1_INTERIM_STATUS_AND_EXIT_CHECKLIST.md#0-governing-owner-decision--2026-10-28-supersedes-prior-engineering-gate-wording) supersedes older bespoke legal-checklist and automatic counsel-signature requirements for G7 engineering acceptance. All technical controls remain mandatory. Real-data/production activation remains separately gated. Dated findings and acceptance evidence below are preserved, not re-certified.


> **Current status — 2026-10-25:** D-1 is authorized and executed; fresh review recommends **PASS WITH DOCUMENTED LIMITATIONS — REQUIRES OWNER REVIEW**. Only ADR-01/02/07/08's bounded synthetic contracts have M01 approval. Production decisions and all legal gates remain open. See [acceptance review](PHASE_1I_D_D1_ACCEPTANCE_REVIEW.md) and the R3 annex below; earlier status statements are historical.

# Phase 1I-D — Architecture Approval Decision Packet

Review date: 2026-10-25, Asia/Dhaka. Status: **REVIEW DRAFT — REQUIRES APPROVAL**. Branch `development`, HEAD `99d2f60` at review. No decision is approved by this packet. No implementation or Phase 1I-E work is started.

## 1. Decision summary and classification rules

**15 ADRs reviewed: 9 ready for bounded principle approval, 4 blocked for final technical selection, 2 blocked by legal/supplier dependencies.** The nine ready decisions still require owner and responsible technical-reviewer approval. They do not establish runtime verification, legal clearance or authority to implement.

- **PASS** means the stated read-only review/check passed. It never means a proposed ADR is approved.
- **REQUIRES APPROVAL** means enough design detail exists to ask the owner to approve the stated bounded principle. Remaining staging/production evidence is explicitly retained.
- **BLOCKED** means the final decision or operation lacks required technical evidence, legal disposition or explicit authorization. Preliminary principles may still be endorsed without closing the blocker.

Current ADR statuses in the authoritative register remain unchanged: 13 PROPOSED, 2 BLOCKED, 0 APPROVED. This packet adds an approval-readiness assessment; it does not rewrite those statuses.

**Recommended immediate decision:** select the grouped envelope and immutable-context test contract, then consider exact D-1 offline authorization. Full cloud selection, all 15 ADR approvals and legal clearance are not prerequisites for this synthetic-only scope. Real-data collection, retention, transfer, KMS and deployment remain separately gated.

## 2. Reviewed sources and repository evidence

Authoritative inputs, read in this review:

1. [Architecture review / R2 ADR register](PHASE_1I_D_ARCHITECTURE_REVIEW.md).
2. [KMS infrastructure gaps and provider comparison](PHASE_1I_D_KMS_INFRASTRUCTURE_GAPS.md).
3. [Readiness / 18 manual actions / handoff](PHASE_1I_D_REFINEMENT_READINESS_AND_HANDOFF.md).
4. [Exact synthetic prototype specification](PHASE_1I_D_SYNTHETIC_CRYPTO_PROTOTYPE_SPEC.md).
5. [Cloudflare compatibility assessment](PHASE_1I_D_CLOUDFLARE_COMPATIBILITY.md).

The [main design](PHASE_1I_D_PASSPORT_ENCRYPTION_RETENTION_DESIGN.md) was additionally checked for its R2 contract and all 14 legal-register rows. Previous documents and existing dirty work are preserved. Six proposal documents were already dirty/untracked on entry. This packet is the only new file from this review.

Focused current source checks support the continuing dependencies:

| Evidence | Current finding and consequence |
|---|---|
| `server/prisma/schema.prisma:408–410`; `server/src/services/booking.service.ts:42–44,175–177` | Passenger DOB/passport fields remain optional plaintext strings and writes. No encryption implementation can be inferred from design approval. |
| `server/src/utils/booking-dto.ts:37–38`; `server/src/services/booking.service.ts:491` | Admin masking reads raw passport internally; approved minimized mask metadata will be needed to avoid list-time unwrap. |
| `server/src/services/inquiry-page-query.ts:6–18` | Customer filter uses bound values; SQL orders by createdAt/typeRank/id, with count and page in one statement. Preserve this F06 behavior during future pooling changes. |
| `server/src/lib/prisma.ts:9`; `server/prisma.config.ts:12` | Runtime DATABASE_URL and CLI DIRECT_URL are distinct configuration inputs. Values were not inspected; no database connection was made. |
| `server/src/server.ts:18,22,52–57`; `server/src/services/outbox.service.ts:382–385` | Node bootstrap starts worker scheduling, HTTP listen and process handlers; interval implementation lives in outbox service. Porting needs lifecycle review. Raw exception/rejection logging is still a risk. |
| `server/src/routes/outbox-worker.routes.ts:8–24`; `server/test/integration-target.mjs:2–16` | Protected worker route and strict local integration opt-ins/target checks remain visible in source. This is not execution of those guards. |
| `client/package.json:21–23`; `server/package.json:22–29`; `netlify.toml:1–12` | Next16/React19, Prisma7 and Express4 architecture; Netlify Next configuration exists. Actual deployed hosts, runtime versions and regions remain unverified. |

No Wrangler, vinext or OpenNext configuration file was found by focused filename search outside dependencies. A search with no matches returns rg exit 1; that is absence of matching config, not a failed application test. No package installation, application import or runtime suite was performed.

Gravitas policy: deep planning, dependency context, impact verification, no delegation. Relevant Express/Next/React security guidance informs this review. Skill guidance supplies engineering practices, not owner authorization or legal obligations.

## 3. All 15 ADR decisions

All owners below are accountable roles; individual approvers remain TBD. Each approval must record packet revision/hash, ADR ID, chosen option, scope, accepted residual risks, conditions, approver and date. Approval of a principle does not authorize the listed future execution.

| ADR / readiness | Recommended choice | Alternatives and trade-offs | Risks / dependencies | Decision owner | Required approval / outstanding evidence |
|---|---|---|---|---|---|
| **ADR-01 — REQUIRES APPROVAL**; granularity | One grouped passenger-document bundle, fresh 32-byte DEK and 12-byte nonce per write, AES-256-GCM/16-byte tag | Per-field envelopes allow selective retrieval/erasure but add metadata, nonce and key-lifecycle complexity. Grouped removal requires decrypt/omit/re-encrypt. | Future independent retention needs may require revisiting granularity; backups remain separate. | Owner + security + backend + product | Approve grouped choice for D-1 synthetic fields only. Before production, confirm field/purpose and retention compatibility. |
| **ADR-02 — REQUIRES APPROVAL**; authenticated context | Immutable preallocated booking/passenger IDs; fixed-array canonical AAD; explicit versioned relocation | Mutable email/status/owner binding breaks normal updates; delimiter concatenation risks ambiguity. Stable IDs require planned creation flow. | Actual ID allocation/schema integration is not implemented; wrong-context and relocation tests needed. | Security + backend | Approve exact AAD vectors/ID rules for prototype. Production requires reviewed ID allocation and authorized migration procedure. |
| **ADR-03 — BLOCKED**; auth-delivery secrets | Separate versioned auth-delivery protection and minimized status reasons; retain atomic issuance/outbox semantics | Reference-only or deferred-token generation may reduce stored secrets but complicates crashes, retries, consumed tokens and expiry. | No complete credential issuance/retry/expiry/redrive threat model or concrete lifecycle selected. | Auth lead + reliability + security | Endorse separation principle if desired; final design requires crash matrix, token lifecycle, worker identity, storage and redrive policy. Excluded from D-1. |
| **ADR-04 — REQUIRES APPROVAL**; rollout | Additive envelope-aware readers, encrypted new writes, bounded approved backfill, separately approved plaintext removal | Big-bang replacement reduces transition code but risks unreadable history and failed rollback. Indefinite dual fallback leaves plaintext exposure. | Mixed-version writes, transaction/CAS behavior, masks, backups and rollback binary require proof. | DBA + backend + security | Approve rollout principle only. SQL, exact targets, backfill and removal each need separate review/authorization. |
| **ADR-05 — BLOCKED**; retention | Durations TBD; category-specific schedules, holds and restore suppression | Fixed engineering durations or shared-key deletion cannot establish lawful retention or individual erasure. | L-01–L-14 open; grouped fields may need different retention; backup inventory incomplete. | Privacy + qualified Bangladesh counsel + DBA | Authenticated current sources and scoped counsel decisions, then owner-approved schedules. No deletion authorization. |
| **ADR-06 — REQUIRES APPROVAL**; rotation | Distinguish KEK rotation, wrapped-DEK rewrap and content re-encryption; retain needed historic keys | Re-encrypt all content for every KEK rotation costs more and adds write risk; never rotating retains exposure. | Provider semantics/version routing, old snapshots and retirement evidence unknown. | Security + operations | Approve lifecycle distinction now; provider-specific runbook/quotas and recovery rehearsal before live use. |
| **ADR-07 — REQUIRES APPROVAL**; caching | No persistent cross-request plaintext DEK cache | Cache reduces KMS calls/latency but extends plaintext lifetime and complicates revocation/isolation. | Higher costs/latency; JavaScript cannot guarantee complete memory erasure. | Security + backend | Approve no-cache default for D-1 and initial design. Any later cache needs separate threat model, budgets and approval. |
| **ADR-08 — REQUIRES APPROVAL**; privilege | Separate decrypt workload identity plus assignment/purpose/expiry/step-up grant; ordinary API cannot unwrap | Same-process role checks are simpler but widen compromise impact. KMS IAM alone cannot enforce human customer ownership. | Grant issuer/trust, audit admission and deployment separation not built. | Security + infrastructure + backend | Approve boundary and synthetic policy tests. Production needs authenticated grant design, identity evidence and deny tests. |
| **ADR-09 — REQUIRES APPROVAL**; restore | Quarantined restore, key/version recovery, deletion-ledger replay and dual-controlled break-glass | Direct restore is simpler but can resurrect removed data or trigger mail/supplier actions. | Ledger integrity, backup locations, RPO/RTO and key-loss behavior unknown. | DBA + operations + security | Approve control objectives only. Final recovery runbook, approved retention and synthetic restore proof remain required. |
| **ADR-10 — BLOCKED**; supplier disclosure | Minimal supplier-specific fields through privileged orchestration; no direct supplier KMS/DB credentials | Broad passenger export is simpler but enlarges exposure and purpose/transfer risk. | No validated supplier field/country/contracts map; legal transfer decisions blocked. | Supplier lead + product + counsel | Approve specific supplier necessity, countries, contracts, security and legal disposition before live disclosure. Excluded from D-1. |
| **ADR-11 — BLOCKED** for final host selection | C first if current hosts pass readiness; B hybrid after frontend proof | A Cloudflare-centric requires broader runtime/identity/DB/email changes; B adds frontend adaptation; C minimizes changes. | Actual deployments uninspected; adapters, auth/browser, scheduler and costs unproved. | Owner + infrastructure + frontend | Owner may endorse direction now. Final topology needs deployment inventory and separately authorized compatibility/staging evidence. |
| **ADR-12 — BLOCKED** for provider selection | Match KMS to selected backend's short-lived native identity; AWS provisional only | GCP or Azure can be better if their compute/identity is chosen. Cross-cloud federation adds trust/network work. | Provider/region/SKU, workload trust, costs, quota, audit and recovery unresolved. | Owner + security + infrastructure + finance | Select only after topology, issuer/identity, region/legal and cost evidence; provisioning remains separate. |
| **ADR-13 — REQUIRES APPROVAL**; freshness | Disable Hyperdrive query caching initially on sensitive/stateful paths; preserve DB guarantees | Selective caching may help public catalog reads but risks stale permissions/auth/booking state if misrouted. | Pool/transaction compatibility and F01/F03/F05/F06 behavior need staging proof. | DBA + reliability | Approve freshness rule now; no Hyperdrive setup implied. Approved staging must prove isolation, counts, atomic consumption and fencing. |
| **ADR-14 — BLOCKED** for digest redesign | Separate versioned keyed-digest review; keep logical payload comparison before random encryption | Existing unkeyed hashes preserve replay behavior but can expose equality/guessing; naive HMAC swap can invalidate history. | Digest-key management, historical replays, expiry and rotation not specified. | Reliability + security | Require compatibility vectors, version/key lookup and concurrent replay plan before choosing redesign. No digest change in D-1. |
| **ADR-15 — REQUIRES APPROVAL**; runtime | Retain Node backend initially; pin a supported runtime and tested dependencies | Workers could reduce hosting spread but requires API/lifecycle/dependency proof. Local Node version is not deployment evidence. | Bootstrap, pg/Prisma, Passport, mail, KMS SDKs, build reproducibility unverified on Workers. | Infrastructure + backend | Approve Node-first principle; choose exact runtime after supported-version/dependency review. Any move requires compatibility suite. |

**Ready principle IDs:** 01, 02, 04, 06, 07, 08, 09, 13, 15. **Further technical selection:** 03, 11, 12, 14. **Legal/supplier block:** 05, 10. A ready principle is not a finding that the associated implementation is secure or complete.

## 4. Eighteen manual actions, ordered by urgency

Priority order reflects current decision needs; it is not an instruction to execute. **Only the bounded M01 decisions and M02 authorization are prerequisites for starting D-1.** M07 can start in parallel without delaying synthetic-only work. All later actions need their own authority. This preserves the original M IDs.

| Rank / action | Required task and accountable owner | Stage / classification | Required non-sensitive evidence and dependency |
|---|---|---|---|
| 1 — **M01** | Owner/security/backend select prototype-relevant architecture and accepted risks | Before D-1 — **REQUIRES APPROVAL** | Approve ADR-01/02 contract and ADR-07/08 test boundaries; name reviewers. Defer final cloud/legal decisions explicitly; no blanket sign-off. |
| 2 — **M02** | Owner authorizes exact nine-file prototype | Before D-1 — **REQUIRES APPROVAL** | Exact path/files/dependencies/test scope and exclusions from §7. No cloud or legal clearance needed for fake-only execution. |
| 3 — **M07** | Privacy owner and qualified Bangladesh counsel authenticate all 14 legal decisions | Parallel now; before applicable real-data workflows — **BLOCKED** | Current authoritative sources, applicability, counsel disposition, owner/re-review date. Never ask for private records. |
| 4 — **M04** | Owner/frontend/infra confirm C-first/B-later preference and actual hosts | Before hosting selection/staging — **REQUIRES APPROVAL** | Sanitized deployment/runtime/topology inventory; no account credentials. Depends on actual hosting evidence. |
| 5 — **M05** | Infrastructure/counsel map API/decrypt/DB/backup/log regions | Before live-data staging/provisioning — **BLOCKED** | Region/service/data-flow matrix and legal location disposition. No region is approved here. |
| 6 — **M06** | Security/infra prove native identity or federation design | Before real KMS staging — **BLOCKED** | Issuer/JWKS/audience/subject/lifetime or native role design, least privilege and negative-test plan; no secrets. |
| 7 — **M03** | Owner/security/infra/finance select provider, API and key type | Before KMS provisioning — **BLOCKED** | ADR-12 choice supported by M04–06, costs and lifecycle. No AWS default selection. |
| 8 — **M17** | Operations/security/DBA approve audit, restore and on-call controls | Design before staging; proof before activation — **BLOCKED** | RPO/RTO, alert ownership, sanitized restore/audit rehearsal plan and later results. Real drills need separate scope. |
| 9 — **M12** | Owner/finance approve budget and billing | Before paid resources — **REQUIRES APPROVAL** | Low/base/peak estimates, quotas, alerts and spending owner; no billing activation now. |
| 10 — **M08** | Counsel/privacy decide retention, holds and transfers | Before real collection/transfer or retention jobs — **BLOCKED** | Approved categories, start events, periods/exceptions and countries; depends on M07 and supplier/region maps. |
| 11 — **M16** | Supplier lead/counsel approve necessary fields and contracts | Before supplier-enabled staging/live disclosure — **BLOCKED** | Redacted field/country/subprocessor/security/idempotency map; flight/hotel inventory remains external. |
| 12 — **M09** | Domain admin/owner establish Cloudflare account/domain/DNS plan | Later, before domain cutover — **REQUIRES APPROVAL** | MFA/roles, ownership/renewal, TLS/cache/WAF/cutover plan. Purchases/setup remain separate. |
| 13 — **M10** | Cloud admin/security provision isolated KMS accounts/keys | After provider/identity/region/budget approval — **REQUIRES APPROVAL** | Environment/IAM/deletion-protection design and separately approved setup evidence. No real key action now. |
| 14 — **M11** | Cloud admin securely provision scoped secrets | Before approved staging deployment — **REQUIRES APPROVAL** | Variable names, scopes and rotation procedure only; no NEXT_PUBLIC key/DB exposure. |
| 15 — **M13** | Owner/DBA authorize additive database migration | After production-code/schema proposal review — **REQUIRES APPROVAL** | Exact target, SQL/checksums, preservation, backup and rollback evidence; each target approved independently. |
| 16 — **M18** | Auth/operations approve email transport and staging interoperability | Before approved notification/browser staging — **REQUIRES APPROVAL** | Provider/domain plan and explicit sandbox recipient scope; suppression/retry/bounce tests. No live mail under D-1. |
| 17 — **M14** | Owner/DBA/privacy approve backfill and plaintext removal separately | After encrypted reads/rollback/holds proved — **REQUIRES APPROVAL** | Bounded CAS batches, dry-run counts, recovery and exact operation approval; no automatic cleanup. |
| 18 — **M15** | Owner/security/reliability authorize Phase 1I-E entry | When that phase's exact scope/prerequisites are ready — **REQUIRES APPROVAL** | Signed handoff, exact tests/target/cleanup scope. Can be scheduled earlier than production work if its approved scope allows; this ranking does not require completing M14 first. |

All named people and account selections remain TBD. Deferred means unnecessary for D-1, not optional for later affected workflows. No owner should return credentials, API tokens, private keys or complete connection strings in chat.

## 5. Hosting feasibility and KMS dependencies

Cloudflare-first domain/security planning is feasible alongside an external backend. Cloudflare-only application hosting is **BLOCKED for final approval** by missing repository proof; it is not categorically impossible. The current Next16/React19 frontend and Node Express/Prisma/Passport/mail backend support a lower-disruption hybrid recommendation.

| Option | Feasibility finding | Approval/evidence needed |
|---|---|---|
| A — Cloudflare-centric | **BLOCKED** for selection; most runtime/identity disruption | Exact Next adapter build/routes/RSC/images/actions, Express lifecycle and dependencies, pg transactions/pooling, OAuth/cookies/origin checks, scheduling/mail and KMS identity proof |
| B — Cloudflare frontend/security + external Node API/worker/PG/KMS | **REQUIRES APPROVAL** as preferred evolution; runtime acceptance unverified | Frontend adapter/version acceptance, actual-domain auth/cache tests, native backend identity, region/cost/DR proof |
| C — Compatible hosts retained + Cloudflare DNS/security | **REQUIRES APPROVAL** as lowest-disruption first direction | Actual hosts must pass readiness first; domain/TLS/WAF/cache changes need separate authorization; current config is not deployment evidence |

Public provider documents rechecked 2026-10-25 confirm vinext is beta and needs compatibility review; Workers offers a Node HTTP adapter; Hyperdrive query caching is enabled by default and does not invalidate reads on writes. These capabilities do not establish application interoperability. Do not run auto-configuration/deployment commands during this review. Sources: [Next/vinext](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/), [Node HTTP](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/), [Hyperdrive caching](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/).

KMS selection sequence: chosen topology/runtime -> region/data-flow/legal constraints -> native role or verified runtime federation -> operation-specific IAM/key type -> quota/latency/cost/recovery evidence -> owner selection -> separate provisioning and staging authorization. Geography, region proximity and KMS encryption do not grant cross-border permission.

| Candidate (from reviewed KMS report) | Recommended fit | Remaining decision evidence |
|---|---|---|
| AWS KMS | Provisional if suitable AWS backend role is chosen; GenerateDataKey/Decrypt model | Exact role/key/context policy, region, audit/recovery, retained material, quotas and total cost |
| GCP KMS | Equally viable with GCP backend/service account; app-generated DEK wrapped with Encrypt/Decrypt | Federation/native identity, AAD/version handling, regional quota, recovery and total cost |
| Azure Key Vault / Managed HSM | Viable with Azure managed identity; versioned wrapKey/unwrapKey model | Algorithm/SKU, role actions, context differences, version recovery and cost; Managed HSM must be justified separately |

No provider, SDK or region selected. No current account quotas, prices, identities or recovery arrangements were verified here. Prior pricing figures remain dated planning inputs, not a new quote. Plaintext DEK caching cannot be assumed to resolve an infeasible latency/budget design.

## 6. Technical risks requiring resolution

| Risk / stage | Required resolution and owner |
|---|---|
| Granularity and partial retention — D-1 choice; production recheck | Owner/security/product accept grouped trade-off now; legal-dependent field lifecycle remains pending. If per-field is selected, revise prototype specification first. |
| ID/AAD allocation and relocation — synthetic vectors then integration | Backend/security prove canonical encoding, immutable preallocated IDs, trusted context and controlled decrypt/re-encrypt relocation. Mutable role/purpose grants remain outside content AAD. |
| Privileged grants and key identity — synthetic policy then staging | Security/infra define trusted grant issuer, assignment, expiry, step-up, audit admission and separate identity; ordinary DTOs must not unwrap. |
| Auth-delivery secrets/free-text/outbox — before notification integration | Auth/reliability select expiry/crash/redrive model without minting fresh valid tokens on every retry; preserve F03/F04 claims/fencing/suppression and F01 idempotency. |
| Legacy plaintext, admin masks and guest minimization — before rollout | Backend/DBA/product design safe mask metadata, compatible DTOs, additive schema and rollback; guest reduction requires contract review. Source: booking-dto.ts:37–38 and booking.service.ts:491. |
| Raw exception logs — before real-data activation | Backend/security review all sinks, including server.ts:52–57, and test sentinel exclusion; sanitized helper usage alone is insufficient. |
| Old-valid envelope replay and digest privacy — before integration | Security/reliability specify revision/CAS and independent audit; AEAD cannot detect same-context rollback. Digest version/key migration must preserve historical replay semantics. |
| Backup resurrection/key loss — before activation | DBA/security/ops approve retained-key inventory, quarantine, ledger integrity, restore proof and irreversible-deletion controls; deleting a live wrapped key is not backup erasure. |
| Workers/Prisma/SMTP/OAuth compatibility — before host migration | Infra/frontend/backend run separately approved runtime/browser/DB/provider tests; no guard weakening or switch to D1/alternate schema to force compatibility. |
| KMS outage, retries, quotas and costs — before KMS integration | Operations benchmark proposed timeout/retry/alert values; avoid nested retries, plaintext fallback and KMS network waits inside open DB transactions. |
| Reproducible builds — before staging | Engineering select supported pinned Node/dependency/package-manager strategy; local installed versions alone are insufficient. |

All risks remain open. Documentation of a proposed control is not implementation evidence.

## 7. Exact D-1 approval scope

**REQUIRES APPROVAL to authorize; BLOCKED from execution until supplied.** No real data, cloud identity, legal decision closure, database or paid service is needed for this prototype. Approval selects ADR-01's grouped bundle and ADR-02's immutable-context contract; ADR-07 no-cache and ADR-08 synthetic authorization boundaries apply.

Exactly nine new files, all under `server/test/prototypes/passport-crypto/`:

| File | Approved-scope proposal |
|---|---|
| contracts.ts | CryptoEnvelopeV1, EncryptionContext, DataKeyProvider, DecryptionAuthorizationPolicy, CryptoError, strict synthetic payload types |
| envelope-codec.ts | Strict bounded parser/base64url, canonical payload and fixed-array AAD serialization |
| passenger-document-crypto.ts | PassengerDocumentCrypto encrypt/decrypt, authorization before unwrap, authentication before plaintext release |
| synthetic-kms-adapter.ts | Ephemeral fake wrapping key/provider, context authentication, simulated denied/unavailable/wrong/retired keys; no provider SDK |
| fixtures.ts | Clearly synthetic values, immutable IDs and test grants; no DB/log exports |
| passport-crypto.test.ts | Positive/negative cipher, key, context, serialization and grant cases |
| boundaries.test.ts | Import/network/environment/logging isolation assertions |
| vitest.config.ts | Standalone exact test include, Node runtime, no app/global setup, dotenv or normal integration runner |
| README.md | Scope, limitations, offline commands and evidence |

Contract: AES-256-GCM; 32-byte fresh DEK and 12-byte nonce per write; full 16-byte tag; 4 KiB plaintext and 16 KiB encoded envelope limits. Fields are synthetic passportNumber/passportExpiry/dateOfBirth only. Unknown fields/versions/algorithms/key identities and malformed dates/encoding are rejected. No persistence and no plaintext fallback.

Envelope fields: payloadVersion, algorithm, aadVersion, keyProvider, keyRef, optional provider keyVersion, wrapAlgorithm, wrappedDek, nonce, ciphertext, tag. Provider metadata is allowlisted; no envelope-selected arbitrary URL. AAD is exact UTF-8 JSON serialization of `["FlyWithSafe","passenger-document","1",environmentId,bookingId,passengerId]` using validated immutable ASCII IDs.

Interfaces: DataKeyProvider.createAndWrapDataKey(context) and unwrapDataKey(metadata, context); PassengerDocumentCrypto.encrypt(payload, context) and decrypt(envelope, context, grant); DecryptionAuthorizationPolicy.assertAllowed(grant, context). Test grants check identity/role/assignment/purpose/expiry/step-up before unwrap. They are not a production grant issuer. Errors expose only sanitized code and correlation ID.

Dependencies: existing TypeScript/Vitest and Node built-ins, principally node:crypto. Ephemeral in-memory synthetic test keys only; no production keys, real KMS, new packages, manifests, lockfiles, Prisma, DB/app imports, environment loading or external network. Boundary setup must block fetch and Node networking before tested modules run; inherited production settings must not be consumed. File assertions are local and scoped; no shell/provider subprocess execution from the prototype.

Planned groups (17; exact case count determined after implementation): (1) synthetic round trip; (2) ciphertext tampering; (3) tag validation; (4) canonical AAD; (5) booking/passenger/environment binding; (6) authorization denial before unwrap; (7) outage/bounded retries; (8) provider denial; (9) versions/algorithms/key allowlist; (10) DEK/nonce freshness and length; (11) date/JSON/base64url/size validation; (12) no plaintext logs; (13) sanitized errors; (14) no app/DB/network dependencies; (15) key-lifetime cleanup/invalid keys; (16) fake historical-key behavior; (17) explicit old-valid-envelope rollback limitation.

No cross-request DEK cache; no guarantee of JavaScript memory zeroization; randomness sample tests do not prove collision impossibility. The fake must authenticate wrapped bytes/context rather than returning a fixed key irrespective of input. It is not a provider wire-format/IAM emulator.

Proposed later commands, **not executed**:

```powershell
Set-Location 'E:\Programming\Project\fly-with-safety\server'
& .\node_modules\.bin\vitest.cmd run --config test/prototypes/passport-crypto/vitest.config.ts
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck --types node,vitest/globals test/prototypes/passport-crypto/contracts.ts test/prototypes/passport-crypto/envelope-codec.ts test/prototypes/passport-crypto/passenger-document-crypto.ts test/prototypes/passport-crypto/synthetic-kms-adapter.ts test/prototypes/passport-crypto/fixtures.ts test/prototypes/passport-crypto/passport-crypto.test.ts test/prototypes/passport-crypto/boundaries.test.ts test/prototypes/passport-crypto/vitest.config.ts
```

Before executing after approval, inspect the created import graph/configuration and confirm the standalone compiler options fit installed tooling. These commands must not invoke parent application setup. A new tsconfig or additional file is outside this exact nine-file scope unless separately approved.

Expected application effect: none. Prototype cannot be imported by production. Rollback is removing only the newly authorized prototype files after preserving evidence, with no DB rollback. Removal is a future action, not executed here.

Suggested owner authorization wording (a request, **not an approval**):

> I approve D-1 only: the nine files under server/test/prototypes/passport-crypto listed in this 2026-10-25 packet, grouped-envelope and immutable-AAD contract, synthetic authorization/fake KMS, existing dependencies, offline tests and standalone no-emit TypeScript checks. This excludes production/application integration, schemas/databases, real KMS/keys, secrets/cloud resources, live providers/email/payments, retention operations, deployment and Phase 1I-E. All 14 legal decisions remain BLOCKED.

## 8. Legal dependencies

**14 BLOCKED; 0 fully independently verified; 0 formally approved.** Preserve L-01–L-14 without editing their provisional legal-source text. No legal claims are independently adopted in this packet.

Open topics: L-01 identity/application/commencement; L-02 classification; L-03 lawful basis; L-04 children; L-05 security duties; L-06 rights; L-07 retention; L-08 processing records; L-09 breach response; L-10 protection planning; L-11 transfers; L-12 authoritative text/transition; L-13 accounting versus document retention; L-14 supplier/hosting cross-border and potential foreign scope.

All require authenticated current primary text/rules, applicability review and qualified Bangladesh counsel disposition, with named owner and review date. No statutory interval, effective date or transfer permission is selected here. Engineering safeguards can be prototyped using fake synthetic data without claiming compliance; real-data operations remain blocked where applicable.

## 9. Concise owner approval checklist

- [ ] Assign named owner, security reviewer and backend reviewer; identify this packet revision.
- [ ] Select ADR-01 grouped envelope for prototype; acknowledge per-field/partial-retention trade-off.
- [ ] Accept ADR-02 exact AAD/immutable synthetic IDs and ADR-07/08 offline boundaries.
- [ ] Separately authorize the exact nine files and offline validation in D-1; no implementation starts before authorization.
- [ ] Optionally endorse remaining ready principles (04,06,09,13,15), keeping their later proof/operation gates open.
- [ ] Defer final technical choices 03,11,12,14 with evidence owners and next review dates.
- [ ] Keep ADR-05/10 and all L-01–L-14 blocked; commission counsel/supplier review independently.
- [ ] Confirm C-first/B-later direction only if desired; no account/domain/KMS/billing/deployment authority inferred.
- [ ] Leave database mutation, backfill/removal and Phase 1I-E for separate explicit scopes.

## 10. Validation and stop point

| Check performed in this review | Result |
|---|---|
| git status --short --branch / git rev-parse --short HEAD | **PASS** — development at 99d2f60; existing six proposal changes retained; only this packet added |
| Read-only Node built-in SHA-256 baseline audit | **PASS** — all 622 baseline tracked/source-document files unchanged; baseline digest 08e9d545e85359de8a73153bec6f32d7f55370dd8b4b060f07af51b62735dd52 |
| Node static structure/relative-link scan | **PASS** — 15 ADR rows (9 ready, 6 blocked), 18 unique manual actions, 9 proposed files, 14 legal rows all BLOCKED, zero missing relative document links |
| Prototype path check | **PASS** — server/test/prototypes/passport-crypto does not exist; no prototype was written |
| git diff --check / git diff --stat | **PASS** — no whitespace errors; existing tracked design diff remains 144 additions; untracked packet is not included in diff stat. Git emitted its existing LF-to-CRLF normalization warning |
| Technical/legal owner decisions | **REQUIRES APPROVAL** / **BLOCKED** as classified above; none converted to APPROVED |

Application/prototype/PostgreSQL/KMS/browser tests are **NOT RUN**: no implementation was changed and execution is outside this review. Historical test successes remain historical. Public documentation browsing is the only network activity; no provider account or operational endpoint was used. No database, credentials, real KMS, production keys, purchases, deployment, commit or push operations occurred.

**Stop point: approval package presented.** D-1 execution, production integration and Phase 1I-E remain BLOCKED pending their distinct authorizations. No proposed decision was converted to APPROVED.


## R3 — authorization and acceptance update (2026-10-25)

This update supersedes historical statements that M01/M02 awaited authorization. The owner approved ADR-01/02/07/08 only for the nine-file offline D-1 scope and authorized implementation/checks. These bounded contracts are APPROVED for D-1 only; broader production ADRs remain PROPOSED or BLOCKED. No other ADR/manual action was approved.

Fresh verification: nine files present, 104 tests/two suites pass, no-emit TypeScript PASS, no app integration. [Acceptance recommendation](PHASE_1I_D_D1_ACCEPTANCE_REVIEW.md): PASS WITH DOCUMENTED LIMITATIONS — REQUIRES OWNER REVIEW. Formal acceptance pending; prototype unchanged during review.

Acceptance §4 is the current 15-ADR matrix; §§5–6 refine auth-secret lifecycle/atomicity and versioned idempotency HMAC compatibility; §8 provides unexecuted D-2–D-6 scopes; §9 updates all 18 actions. Earlier nine-ready/six-blocked counts described readiness, not owner approvals.

Principles 04/06/09/13/15 still require owner selection. ADR-03/14 proposals need security/owner approval before code. ADR-11/12 require actual topology/identity/region/cost/recovery evidence. ADR-05/10 and all 14 legal decisions remain BLOCKED.

Next request: owner disposition/acceptance of D1-L01–L08/W1/W2, then separate exact D-2 correction/hardening authorization if desired. Acceptance itself authorizes no new code, database, keys, providers, hosting migration or I-E entry.


## R4 — D-1 owner acceptance and exact D-2 request (2026-10-25)

The owner's current explicit instruction accepts D-1 subject to D1-L01–L08/W1/W2. Matching artifact evidence and fresh 104-test/two-suite plus no-emit passes support recording **OWNER-ACCEPTED — SYNTHETIC D-1 SCOPE ONLY**. See the [formal record](PHASE_1I_D_D1_FORMAL_ACCEPTANCE.md). Prior acceptance-pending wording is historical.

M01 and M02 are satisfied only for the accepted synthetic artifact. The broader production forms of ADR-01/02/07/08 remain PROPOSED; other production ADR statuses and M03–M18 gates are unchanged. ADR-05/10 and all 14 legal entries remain BLOCKED; no legal verification or production approval is conferred.

The [D-2 implementation proposal](PHASE_1I_D_D2_CRYPTO_HARDENING_SCOPE.md) requests exactly seven existing files under server/test/prototypes/passport-crypto: contracts.ts, passenger-document-crypto.ts, passport-crypto.test.ts, boundaries.test.ts, fixtures.ts, vitest.config.ts and README.md. It preserves envelope-codec.ts, synthetic-kms-adapter.ts, the wire/AAD contract and all production paths.

Requested behavior: explicitly awaited promise authorization, finite stage/total deadlines, no unwrap after authorization failure, sequential settled-transient retries, no retry after timeout, late-DEK cleanup, and W1/W2 remediation within existing fixture/config files. Future verification includes all original 104-case coverage, the proposed asynchronous regression matrix, no-emit and both bundled/native loaders. No new behavior or D-2 test has executed.

**D-2 IMPLEMENTATION REQUIRES SEPARATE APPROVAL.** No file additions/renames, dependencies/manifests/shared config, real provider/DB/CAS/infrastructure, production integration, I-E or Phase 2 are included. The old broader candidate D-2 language in earlier reports is superseded by this exact bounded proposal for the next approval request.
