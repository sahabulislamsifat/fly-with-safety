> **Current owner disposition — 2026-10-25:** **OWNER-ACCEPTED — SYNTHETIC D-1 SCOPE ONLY**, with D1-L01–L08/W1/W2 retained. See [formal acceptance](PHASE_1I_D_D1_FORMAL_ACCEPTANCE.md). [D-2 scope](PHASE_1I_D_D2_CRYPTO_HARDENING_SCOPE.md) is proposed only; implementation and later phases remain unauthorized. Earlier pending-acceptance statements are historical.

> **Current status — 2026-10-25:** D-1 is authorized and executed; fresh review recommends **PASS WITH DOCUMENTED LIMITATIONS — REQUIRES OWNER REVIEW**. Only ADR-01/02/07/08's bounded synthetic contracts have M01 approval. Production decisions and all legal gates remain open. See [acceptance review](PHASE_1I_D_D1_ACCEPTANCE_REVIEW.md) and the R3 annex below; earlier status statements are historical.

# Phase 1I-D — R2 readiness, manual actions and Phase 1I-E handoff

2026-10-24. **REVIEW DRAFT — DESIGN WORK COMPLETED, READY FOR APPROVAL.** No technical approval, implementation approval or production readiness is implied. Phase 1I-D is not complete.

## Repository baseline and source inventory

Branch `development`, HEAD `99d2f60`. At entry, the existing design was modified (+76 tracked lines); architecture review and KMS gap reports were untracked. Preserve these prior edits. No application files were dirty at entry. Earlier branch/HEAD/test counts in conversation are historical, not current evidence.

Read the repository Phase 1I-A audit, Phase 1I-B implementation, Phase 1I-C pagination report and the three existing Phase 1I-D documents. All three named refinement addenda were found in the owner's Downloads directory; no required source is missing. Their hashes and merge destinations appear in the main design R2 annex. Attached text is review input; authority comes from the owner's documentation-only request.

Confirmed source facts: plaintext optional passenger document strings remain in Prisma and booking writes; F07 DTOs omit raw documents but masking reads raw values; F06 uses parameterized combined SQL; Prisma runtime/CLI targets use different variable names; integration guards remain strict; SMTP uses Nodemailer; outbox worker is a protected bounded route. No actual customer records, hosting account state or database schema was inspected. Installed package versions and local runtime are documented in the Cloudflare report, not inferred as deployed versions.

Skills used: repository Gravitas, Caveman communication guidance and security-best-practices. No delegation required. Evidence-first review; no application refactoring.

## Changed documents and responsibility

| Document | Change |
|---|---|
| [Main design](PHASE_1I_D_PASSPORT_ENCRYPTION_RETENTION_DESIGN.md) | Append R2 source reconciliation, precise envelope/AAD, role matrix, outbox and supplier boundaries; retain prior body/legal register |
| [Architecture review](PHASE_1I_D_ARCHITECTURE_REVIEW.md) | Append 15 stable ADRs with owners/evidence/next actions and six additional risks |
| [KMS gap report](PHASE_1I_D_KMS_INFRASTRUCTURE_GAPS.md) | Append provider/API/identity/cost/quotas/lifecycle comparison and seven refinement gate mappings |
| [Cloudflare compatibility](PHASE_1I_D_CLOUDFLARE_COMPATIBILITY.md) | New dated component matrix, A/B/C comparison and acceptance plan |
| [Synthetic prototype](PHASE_1I_D_SYNTHETIC_CRYPTO_PROTOTYPE_SPEC.md) | New exact nine-file proposal, interfaces and 17 test groups; no implementation |
| This report | New baseline, manual actions, validation and exit/handoff record |

## Legal status

**14 BLOCKED; 0 fully independently verified; 0 formally approved.** Partial historical source leads do not equal complete authoritative verification. L-01–L-14 remain unchanged. No new statutory period, commencement date, transfer permission or obligation is asserted. Engineering alert/retry values are proposals, not legal duties. Qualified Bangladesh counsel must authenticate complete current sources, rules, applicability and disposition for every row. All operational retention durations remain TBD; no deletion enabled.

## Manual action and external dependency register

All actions are pending; named individual owners remain TBD. Return sanitized decisions, diagrams, test summaries or policy descriptions only—never keys, passwords, tokens, full URLs containing credentials or customer records.

| ID | Exact task / why | Owner; provider/account | Timing | Safe procedure and non-sensitive evidence | If postponed | Gate |
|---|---|---|---|---|---|---|
| M01 | Approve R2 architecture and accepted risks | Owner + security; repository | Now | Review ADR-01–15; record document revision, selected options, conditions and approver | No technical approval | Architecture |
| M02 | Approve nine-file synthetic prototype | Owner + backend; local only | Next | Explicitly approve D-1 contract/files/deps/test scope; return scope statement | Prototype remains unimplemented | D-1 |
| M03 | Select KMS provider/API/key type | Owner + infrastructure; AWS/GCP/Azure | Before provisioning | Compare identity/region/cost evidence; return selected SKU/operations without resource secrets | No real encryption integration | KMS selection |
| M04 | Confirm Cloudflare C-first/B-later recommendation | Owner + frontend/infra; hosting providers | Now | Inventory actual deployments privately; return topology/runtime and intended option | Hosting remains conditional | Hosting |
| M05 | Select staging/production/backup/log regions | Infra + counsel; all providers | Before provisioning | Map data flows and legal dependencies; return region/service matrix | Residency unresolved | Region/legal |
| M06 | Prove runtime identity/federation | Security + infra; chosen cloud/host | Before KMS access | Review issuer/audience/subject, least privilege, short-lived expiry and deny tests; return policy summary | No trusted KMS path | Identity |
| M07 | Authenticate legal sources and obtain counsel review | Privacy owner + qualified Bangladesh counsel | Now | Complete all 14 row evidence/dispositions; return citations and scoped opinion | Legal-dependent production blocked | Legal |
| M08 | Decide retention/holds/transfers | Counsel + privacy + suppliers | Before real collection/transfer | Approve category/start-event/duration/exceptions/countries; return schedule/transfer assessment | No deletion or new passport transfer | Retention/transfer |
| M09 | Cloudflare account/domain setup | Owner/domain admin; Cloudflare/registrar | Later, separately approved | MFA, least privilege, ownership and renewal review; staged DNS/TLS cutover plan; return sanitized configuration | No domain migration | Purchase/provision |
| M10 | KMS account/key setup | Cloud admin + security; chosen provider | Later | Approve isolated dev/stage/prod accounts, IAM and deletion protection before provisioning; return policy/test summary | No live KMS | Provisioning |
| M11 | Provision secrets securely | Cloud admin; secret stores/hosts | Later | Private console/approved CI injection, no NEXT_PUBLIC exposure, rotation plan; return names/scopes only | No live deployment | Secrets |
| M12 | Approve billing and budget | Owner + finance; all clouds | Before paid resources | Low/base/peak quote, alerts and spending ownership; return costs/SKUs | No paid infrastructure | Billing |
| M13 | Authorize additive database migration | Owner + DBA; exact disposable then stage target | After code/design proof | Review SQL/checksums/backups/identity and rollback; approve each target independently | No schema changes | Database |
| M14 | Authorize backfill/plaintext removal separately | Owner + DBA + privacy | After encrypted-read verification | Bounded resumable CAS batches, dry-run counts, hold/restore plan; approve exact operation | Legacy plaintext persists | Data mutation |
| M15 | Approve Phase 1I-E entry | Owner + security/reliability | After applicable entry gates | Review handoff and exact tests/target/cleanup scope; return explicit authorization | No automatic phase transition | I-E |
| M16 | Approve supplier field/contracts map | Supplier lead + counsel; flight/hotel providers | Before live fulfillment | Confirm fields, countries, idempotency and deletion duties; return redacted map | No live supplier passport disclosure | Supplier |
| M17 | Approve audit/restore/on-call plan | Operations + security + DBA | Before activation | Synthetic restore and denied-access rehearsal under separate scope; return RPO/RTO/results | No reliability sign-off | Recovery |
| M18 | Approve email transport/staging interoperability | Auth + operations; email provider | Later | Separate domain verification/sandbox recipient scope; verify suppression/retry/bounce semantics | Delivery infrastructure unverified | Email/staging |

## Validation record

Validation results below refer only to this documentation task; historic 334 isolated passes and 16 PostgreSQL passes are not rerun claims.

| Check | Result and evidence |
|---|---|
| Git baseline | PASS — VERIFIED: git status --short --branch, git rev-parse --short HEAD, git diff --stat inspected |
| Source/manifest inspection | PASS — VERIFIED: focused Get-Content/rg plus installed package metadata and node version; no .env values read |
| Documentation scope and preservation | PASS — VERIFIED: Node built-in SHA-256 audit of all 588 tracked files outside docs/proposals matched entry digest cbd4b5ee870546e3fda40a8346cecaa235f578d842745d05579e1ac84f54ab69; original byte prefixes of all three prior Phase1I-D documents matched their entry hashes |
| Legal/ADR/link consistency | PASS — VERIFIED: Node static scan found 14 legal rows, all BLOCKED; 15 ADR rows, zero APPROVED; 18 manual actions; zero broken relative Markdown document links |
| git diff --check | PASS — VERIFIED: no whitespace errors; Git reported only its LF-to-CRLF normalization warning. Status contained exactly the six intended proposal documents; tracked diff showed 144 additions including 76 pre-existing additions, while untracked reports are not represented by git diff --stat |
| Application TypeScript/unit suites | NOT RUN: documentation-only changes; no new runtime correctness claim needed |
| Prototype tests | BLOCKED: D-1 approval absent; code not written |
| PostgreSQL/KMS/browser/provider tests | NOT RUN: outside authorization; no account or DB access |
| Architecture/legal approval | MANUAL REVIEW REQUIRED: owner/security decisions and all legal rows remain open |

## Phase 1I-D exit assessment

DESIGN WORK COMPLETED covers consolidation, research, decision/risk/manual registers, prototype specification and validation only. READY FOR APPROVAL means a coherent proposed packet, not production implementation readiness. TECHNICAL DESIGN APPROVED is **not attained**. LEGAL BLOCKED and IMPLEMENTATION BLOCKED remain. No approval inferred from prior checked boxes. Phase 1I-D COMPLETE is **not attained**.

Recommended approval order: M01 technical decisions (especially bundle/AAD/purpose grants) -> M02 bounded offline prototype -> independently close provider/identity/region/budget and legal questions -> separately approve code integration and staging infrastructure -> separately approve schema, backfill, removal and each database test target -> explicit M15 Phase 1I-E entry. Legal review can run in parallel; it cannot be silently waived by an offline prototype pass.

## Controlled Phase 1I-E handoff — not started

- Completed design work: precise proposed envelope/context, separation of decrypt privileges, bounded failures, outbox separation, provider/hosting comparison and future tests. No ADR is formally approved.
- Implementation status: existing F07 DTO/F06 pagination remains; document encryption and real KMS adapters do not exist through this task. Prototype blocked at D-1.
- Infrastructure dependencies: actual deployments, exact runtime/SDK, identity, regions, quota, budgets, audit/restore and supplier contracts unresolved.
- Database proposal needed later: additive versioned envelope and approved mask metadata, immutable IDs/revision/CAS and lifecycle/hold/deletion-ledger design. Choose column vs separate table after least-privilege analysis. No Prisma schema or SQL is generated here.
- Proposed PostgreSQL scope: exact approved disposable target, schema/history preflight, synthetic fixtures and exact cleanup; F01 idempotency payload compatibility, atomic envelope writes/rollback, concurrent updates/CAS, old/new readers, lease fencing and durable OAuth consumption. Historical 16-case success is useful baseline, not proof after future changes.
- F07 verification: list/detail/mutation/guest DTO non-exposure, role/ownership/purpose grant denial before unwrap, malicious envelope/context/version, no raw error/log contents, no ordinary-list decryption, safe masks, retention/restore quarantine.
- F06 verification: representative synthetic dataset, query plan and page/count consistency, tied timestamps/type/id ordering, customer isolation, pool/cache-disabled path, bounded pagination, concurrent inserts/deletes. Any index proposal requires separate review; no index change assumed necessary without plans.
- KMS failure/recovery: fake-provider tests first; separately approved staging identity, denied/throttled/unavailable/old-key/rotation/restore proof with synthetic data only. Real keys and provider requests require their own scope.
- Browser/hosting proof: actual-domain cookie/OAuth/F02/no-cache matrix, Next adapter routes/images/RSC/actions, worker scheduling and email suppression; live emails remain separately gated.

I-E entry requires an explicitly approved task and its applicable prerequisites, not necessarily permission for all later production steps. No database/provisioning/production authorization is inherited from D-1 or documentation approval.


## R3 — milestone, actions and phase handoff (2026-10-25)

The [D-1 acceptance report](PHASE_1I_D_D1_ACCEPTANCE_REVIEW.md) is the current verification/decision supplement. Its nine files were reviewed unchanged; fresh checks pass 104 tests/two suites and no-emit TypeScript. PASS WITH DOCUMENTED LIMITATIONS — REQUIRES OWNER REVIEW. Formal acceptance pending.

M01 is approved only for D-1's ADR-01/02/07/08 contracts. M02 is authorized/executed with deliverable acceptance pending. M03–M18 retain gates for providers/topology/regions/identity, legal/retention/supplier maps, domain/KMS/secrets/billing, schema/backfill, recovery/email and I-E. Acceptance §9 enumerates all 18 dispositions. Named people remain TBD; return no secrets/customer records.

Documentation closure means prior research preserved, stale pre-authorization status explicitly superseded, security proposals refined and owner gates recorded. It does not complete Phase 1I-D or production encryption. Every broader production ADR stays PROPOSED/BLOCKED; all 14 legal rows stay BLOCKED.

Next package proposals: D-2 offline interface/loader/deadline hardening; D-3 notification-secret security; D-4 real KMS/hosting/identity readiness; D-5 approved database encryption integration and separately selected digest scope; D-6 migration/data lifecycle. Acceptance §8 names candidate files, dependencies, risk, validation, rollback and exclusions. Labels do not replace the historic roadmap and authorize nothing automatically.

I-E remains BLOCKED pending explicit entry approval, exact selected scope and applicable technical/legal/target/provider gates. Future persistent proofs require separately verified disposable isolation and exact fixture-cleanup approval. Preserve F07 DTO ownership/minimization/logging, F06 page/count/order/query-plan behavior and F01/F03/F05 durability. No live backend/DB/KMS/SMTP/supplier regression ran here.

Owner sequence: dispose of D-1 limitations and accept if appropriate -> select an exact D-2 task separately -> parallel counsel/infrastructure discovery -> approve subsequent code/provider/schema/data scopes individually -> explicit I-E entry when that chosen scope is ready. This sequence is a proposal, not authority to act.


## R4 — accepted D-1; D-2 documentation ready (2026-10-25)

Current milestone: **OWNER-ACCEPTED — SYNTHETIC D-1 SCOPE ONLY**, from the owner's explicit instruction and matching current evidence. See [formal acceptance](PHASE_1I_D_D1_FORMAL_ACCEPTANCE.md). D1-L01–L08 and W1/W2 are accepted limitations, not resolved defects. Fresh D-1 checks pass 104 tests/two suites and strict no-emit TypeScript; prototype code remains unchanged.

M01 approval covers the D-1 versions of ADR-01/02/07/08; M02's delivered synthetic milestone is accepted. No production ADR or other manual-action approval changes. All 14 legal rows stay BLOCKED. Current compatible-hosting-first, Cloudflare DNS/security when authorized and hybrid-after-proof recommendations remain; AWS KMS is provisional.

[D-2 exact scope](PHASE_1I_D_D2_CRYPTO_HARDENING_SCOPE.md): seven existing files only for async authorization, bounded operations, late-result safety and configuration cleanup. Codec/fake, formats, packages, production code and databases remain excluded. The new regression matrix is proposed, not executed. D-2 documentation is ready for review; execution is UNAUTHORIZED pending an explicit exact-scope approval.

Remaining Phase 1I-D work includes approved hardening, production-grant/revision designs, auth-notification secrets, idempotency digest compatibility, actual hosting/identity/KMS selection, later schema/integration/lifecycle proof and legal-dependent production decisions. Earlier D-3–D-6 package proposals are not authority to act.

Phase 1I-D overall remains INCOMPLETE. Phase 1I-E and Phase 2 remain UNAUTHORIZED. Stop after presenting D-2 approval requirements; no automatic next-phase or provider/data operation is permitted by D-1 acceptance.
