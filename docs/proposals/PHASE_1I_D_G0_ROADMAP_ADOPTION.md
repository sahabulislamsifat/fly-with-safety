# Phase 1I-D — Formal G0 Roadmap Adoption

**OWNER-ADOPTED — G0 PLANNING BASELINE ONLY**

Recorded 2026-10-25 (Asia/Dhaka). Owner: FlyWithSafety Project Owner, through the current “G0 Roadmap Adoption, Production Security Integration, External Supplier Architecture & Phase 1–6 Delivery” instruction. This is adoption of the planning baseline, not implementation or production-security acceptance.

## 1. Adopted artifact and authority

The owner conditionally authorized formal adoption after repository and consistency verification. Those planning conditions are satisfied. Adopted artifact: [PHASE_1I_D_PRODUCTION_INTEGRATION_ROADMAP.md](PHASE_1I_D_PRODUCTION_INTEGRATION_ROADMAP.md), all 21 sections, exact byte SHA-256:

`671a2f05cc015d01dc400c50e470b4d0e06a02f4d655451710e3a66148b62f11`

Repository: E:\Programming\Project\fly-with-safety, branch development, HEAD 154cf93. The adoption applies to this working-tree artifact, not just the commit: the roadmap and other accepted records are currently untracked. No commit is implied.

The roadmap's historical “awaiting owner review” banner remains unchanged. This later record supplies the owner's scoped disposition. The current owner's stricter G7 requirement governs: mandatory P0 findings must be resolved and required integration/legal/recovery evidence accepted. G0 does not waive an unresolved mandatory P0 through a generic risk-acceptance statement or approve a reduced Phase 1 exit profile. Any feature exclusion/applicability decision requires explicit owner/security/legal evidence and cannot be inferred here.

## 2. Baseline and consistency verification

Verified statically: current branch/HEAD; full 21-section roadmap; four domains and 14 change units; source-backed auth/outbox/schema paths; legal register subjects/statuses; exit checklist; and formal D-1/D-2/D-3B acceptance records. Synthetic evidence remains historical: D-2 155 cases per loader and D-3B 145 per loader. No test or service ran now.

Baseline: 635 tracked files, including seven preexisting D-2 modifications; 14 existing untracked files (nine auth-delivery prototype files and five proposal/acceptance/roadmap documents); 649 total tracked/nonignored-untracked files. Aggregate SHA-256 over sorted JSON `[path,sha256(bytes)]` entries:

`fd7f1f88b108c640ca36c7fdbb6a750b0b93be4897bc771f051601e45798cba4`

Both output paths authorized for this session were absent before writing. Preserve all existing files byte-for-byte. The only additions are this adoption and the [gated execution master plan](FLYWITHSAFE_PHASE_1_TO_6_GATED_EXECUTION_PLAN.md).

No material source contradiction prevents adoption as a planning structure. Two explicit qualifications are retained:

- Token models have usedAt and expiresAt but no revokedAt. AUTH-02 can close conditional-consumption races and reject missing/deleted/superseded records; durable explicit revocation/generation remains DB-02/ AUTH-03 dependent. G1 must not invent a schema field or claim full durable revocation in the three-file no-schema package.
- The standalone full Phase 0 closure register and independently approved Phase 1 exit checklist were not located. This adoption accepts the roadmap's planning/checklist structure, not a claim that unknown findings are closed. The master plan uses the owner's current P0/G7 requirements; inventory reconciliation, named reviewers and exit evidence remain open before G7.

Actual supplier source remains search-oriented mocks; payment/fulfillment capabilities are not established by existing booking-status models. The owner's new Phase 2–6 sequence is the delivery planning baseline; older placeholder phase comments are historical and were not rewritten.

## 3. Exact 14-change-unit inventory

The following identifiers and domains are extracted from adopted roadmap §10. Descriptions summarize that existing row, not new change units. Their full contracts/files/tests/legal/rollback requirements remain in the adopted roadmap and master plan.

| ID | Adopted domain | Planned change |
|---|---|---|
| AUTH-01 | Authentication | Preallocated identities and atomic credential/protected-job/supersession/account issuance. |
| AUTH-02 | Authentication | Conditional single-winner verification/reset consumption with atomic side effects. First implementation candidate. |
| AUTH-03 | Authentication | Trusted recipient/purpose/account-generation and supersession admission. |
| OUT-01 | Outbox | Versioned protected auth payload branch and secret-job fail-closed behavior. |
| OUT-02 | Outbox | Lifecycle/decrypt/send/redrive admission, preserving lease fencing and truthful bounded delivery. |
| OUT-03 | Outbox | Reader-before-writer V1/V2 and historical plaintext compatibility/disposition. |
| OUT-04 | Outbox/security sinks | Safe exception serialization/reason allowlists at residual secret-bearing sinks. |
| KMS-01 | KMS/crypto | Shared reviewed primitives, purpose-specific key registry and selected production adapter. |
| KMS-02 | KMS/authorization | Trusted workload plus customer/purpose grants before unwrap; bounded operations/no plaintext cache. |
| KMS-03 | KMS/passenger integration | Immutable-ID passenger encryption and approved non-decrypting masked views. |
| DB-01 | Database | Protected routing and constrained durable token/job linkage. |
| DB-02 | Database | Minimal selected revocation/generation/issuance uniqueness schema. |
| DB-03 | Database | Additive passenger envelope/version/mask/CAS metadata and compatible rollout. |
| DB-04 | Database/idempotency | Separately reviewed versioned keyed logical digest with legacy replay compatibility. |

Counts: Authentication 3; Outbox 4; KMS/crypto 3; Database 4; total 14. These are change units, not independent unconstrained authorizations or file counts.

## 4. Scope and limitations of adoption

G0 adopts prioritization/dependencies, approval structure and planning baseline. AUTH-02 is first; dependency-driven database/KMS preparation may precede activation of later app packages. Existing outbox, idempotency, OAuth, privacy/pagination and accepted prototype invariants remain mandatory preservation boundaries.

D-1, D-2 and D-3B remain owner-accepted **synthetic only**. No production ADR becomes APPROVED. All legal entries L-01–L-14 remain BLOCKED; no statutory period, permission, compliance conclusion or deletion authority is created. Cloudflare DNS/security preference does not select hosting/KMS; supplier/payment providers are not selected or accessed.

No AUTH-02 or other application implementation; Prisma/migration creation/execution; database connection; secret generation/injection/rotation; KMS/cloud/supplier/payment/SMTP/OAuth call; deployment/domain purchase/billing; package installation; Git reset/cleanup/commit/push; or subsequent phase entry is authorized by G0.

## 5. G1 entry and separate G2 gate

G1 requires an exact package design: current source/symbols, allowed files, conditional consume/expiry and legacy semantics, current-schema revocation limitation, API/OAuth invariants, safe test initialization, regression coverage, rollback/stop conditions and accountable reviewers. The AUTH-02 packet is prepared in master plan §7. It is **awaiting explicit G1 design acceptance**.

G2 requires a second explicit owner authorization for the exact three files and permitted behavior, offline commands/guards and exclusions. G1 is not G2. If safe mandatory regression execution needs a broader harness or a schema contract, stop and request revised scope; do not bypass guards or introduce a fourth file silently. G3/G4/G5/G6/G7 and KEY-0–KEY-6 carry their own exact permissions.

## 6. Outstanding dependencies and disposition

Named reviewer assignments; exact consume-time expiry semantics and isolation proof; production identity/grants/envelope metadata; token/outbox routing/linkage/revocation; legacy inventory and rollback; hosting/KMS/region/IAM/cost/recovery; all relevant legal dispositions; supplier commercial/capability/access agreements; payment sandbox contracts; actual integration/staging/recovery evidence; and complete Phase 1 closure inventory remain open.

**G0 disposition: OWNER-ADOPTED — PLANNING BASELINE ONLY.** G1/G2 are not approved. Phase 1I-D remains incomplete. Phase 1I-E, Phase 1J and Phase 2–6 execution remain unauthorized. Stop after the two planning records and their static verification.

Final static verification PASS: adopted roadmap hash matches; 14 actual unit IDs/four domains and three synthetic acceptance records confirmed; all legal entries remain BLOCKED; all 649 preexisting files matched their baseline digest; only the two authorized documents were added. Document links/whitespace and Git diff checks passed. No runtime tests or external operations were executed. **VERDICT: PASS** for G0 planning adoption conditions, not production readiness.
