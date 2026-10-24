# Phase 1I-D — D-1 formal acceptance

Recorded 2026-10-25 (Asia/Dhaka).

**OWNER-ACCEPTED — SYNTHETIC D-1 SCOPE ONLY.**

Project: FlyWithSafe / FlyWithSafety. Milestone: the nine-file offline synthetic cryptography prototype. Repository: `E:\Programming\Project\fly-with-safety`, branch `development`, reviewed HEAD `99d2f60`. Phase 1I-D overall is not complete.

## 1. Acceptance authority and conditions

Source: the project owner's explicit acceptance instruction in the currently supplied master prompt, section 3, at `C:\Users\sahab\.codex\attachments\42804ef8-7197-4c52-b0e7-858b1343d8d7\Pasted text.txt`:

> I accept the FlyWithSafe Phase 1I-D D-1 offline synthetic cryptographic prototype as a completed technical milestone, subject to the documented review evidence and limitations D1-L01 through D1-L08 and warnings W1/W2.

The instruction authorizes recording acceptance only if actual repository evidence matches the review and no material contradiction or acceptance-blocking defect is found. That condition is satisfied by the current baseline comparison, source inspection and fresh standalone checks below. No handwritten signature, named individual reviewer, external certification or earlier acceptance date is invented. The owner is identified only as the project owner providing this instruction.

The [D-1 acceptance review](PHASE_1I_D_D1_ACCEPTANCE_REVIEW.md) remains the historical technical recommendation: PASS WITH DOCUMENTED LIMITATIONS — REQUIRES OWNER REVIEW. This record supplies the subsequent owner disposition; it does not rewrite that review as a production sign-off.

## 2. Accepted artifact and boundaries

Exactly nine existing files under `server/test/prototypes/passport-crypto/`:

1. contracts.ts
2. envelope-codec.ts
3. passenger-document-crypto.ts
4. synthetic-kms-adapter.ts
5. fixtures.ts
6. passport-crypto.test.ts
7. boundaries.test.ts
8. vitest.config.ts
9. README.md

Accepted bounded principles: ADR-01 grouped **synthetic** AES-256-GCM envelope, fresh 32-byte DEK and 12-byte nonce per write, full 16-byte tag; ADR-02 canonical immutable-context AAD; ADR-07 operation-scoped DEK handling without a cross-request plaintext cache; ADR-08 synthetic authorization checks before unwrap/decrypt. Scope includes the fake KMS, strict validation/error handling, documented isolation and offline tests. The production versions of these ADRs remain PROPOSED.

No prototype file was changed during this acceptance-record task. The reviewed artifact matches the previous 597-file source/prototype baseline, SHA-256 digest `c6819e0f83d478b3c5d0c84087b46ef6fa24cceeb39fb9a7ebcdc86de1ee614f`. The digest covers the same ordered tracked-file inventory outside proposals plus the nine prototype files, not a signed security certificate or production build identity. Verification found nine prototype files and no unexpected application/prototype change.

## 3. Historical and fresh verification

| Evidence | Previously reported review | Checked in this task |
|---|---|---|
| Standalone Vitest | 104 passes, two suites, no skips/failures | PASS: rerun on installed Vitest 5.0.3; 104 passes, two suites, no skips/failures; duration 1.90 seconds, exit 0 |
| Standalone TypeScript | No-emit check passed | PASS: same explicit-file strict no-emit command, exit 0, no diagnostics |
| Required groups | 17 groups represented | Source mapping and passing unchanged suites confirmed; no new D-2 regression claimed |
| Scope/imports | Nine files; no production integration | PASS: nine files, 42 static import declarations, zero unexpected dependencies; no production references found in server/src or client/src/app |
| Isolation | Guards before subject imports; no app/DB setup; runtime VM has no environment access | Current config/fixtures/import graph inspected, unchanged boundary suites rerun successfully; evidence remains scoped to reviewed paths, not an OS sandbox |
| Prior preservation | 597 source/prototype files unchanged in review | Entry digest exactly matches that baseline; final task preservation is checked separately after documentation edits |
| Warnings | W1/W2 present | Both reproduced; no suppression, package or loader changes |

Actual commands executed from `server`:

```powershell
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck --types node,vitest/globals test/prototypes/passport-crypto/contracts.ts test/prototypes/passport-crypto/envelope-codec.ts test/prototypes/passport-crypto/passenger-document-crypto.ts test/prototypes/passport-crypto/synthetic-kms-adapter.ts test/prototypes/passport-crypto/fixtures.ts test/prototypes/passport-crypto/passport-crypto.test.ts test/prototypes/passport-crypto/boundaries.test.ts test/prototypes/passport-crypto/vitest.config.ts
& .\node_modules\.bin\vitest.cmd run --config test/prototypes/passport-crypto/vitest.config.ts
```

No app-wide unit, browser, PostgreSQL or provider suites were run. Historic Phase 1H/I-B/I-C results are not current verification claims. Only ephemeral fake test keys were generated by the authorized rerun.

## 4. Accepted limitations — not resolved defects

All identifiers and meanings from the acceptance review are retained. Acceptance permits the existing bounded synthetic milestone; it does not certify suitability for production.

| ID / severity and applicability | Why bounded D-1 is accepted | Risk if transferred unchanged | Owner / next disposition | Required later evidence |
|---|---|---|---|---|
| D1-L01 — Medium; JS memory lifetime | Owned-buffer cleanup is tested and limits are explicit; no real data | Strings/GC/native copies, telemetry and dumps can retain plaintext | Security/backend; D-2 documentation, production design later | Cleanup paths including late keys; no-log tests; dump/telemetry policy; never promise complete zeroization |
| D1-L02 — High for production rollback | Same-context old-envelope acceptance is deliberately demonstrated | Old valid values can replace current values; same-DB revision can also be rolled back | Security/DBA; D-2 design only, later persistence scope | CAS/revision protocol, independent checkpoints, restore reconciliation; separately approved DB/concurrency proof |
| D1-L03 — High for production authorization | Test grants are explicitly synthetic; role/purpose/assignment/expiry/step-up denials precede unwrap | Caller-constructed claims lack a trusted issuer, ownership service and IAM | Security/identity owner; later production grant design | Trusted issuance, revocation, identity/purpose/assignment tests; synthetic D-2 remains fake-only |
| D1-L04 — Medium; async extension hazard | Supplied policy is synchronous and tested; no async policy claimed | A promise-returning policy could be ignored by a void contract | Backend/security; proposed D-2 | Awaited contract, malformed results, reject/deny/timeout/late completion, exactly-once policy and zero unwrap on failure |
| D1-L05 — High for production timing/provider fidelity | Three-attempt immediate fake behavior is accurate and tested | Hanging/late SDK calls, nested retries, real IAM/quotas/outages unverified | Backend/operations; D-2 bounds, D-4 real-provider proof | Total/attempt deadlines, no overlapping retries, late-result cleanup and later approved SDK/identity/latency tests |
| D1-L06 — Medium; nonce/key use | Fresh per-write DEK/nonce generation is inspected and sampled | Random samples do not prove uniqueness; reused wrapping KEKs need operational budgets | Security/operations; later provider/key lifecycle design | Approved algorithm/provider use limits, volume/collision analysis and historical-key recovery; no universal budget invented |
| D1-L07 — Medium; harness claim boundary | Guards, AST and VM provide evidence for reviewed modules | Cannot contain arbitrary hostile/native dependencies or prove OS-level isolation | Test/security owner; D-2 harness review | Guards precede imports under both proposed loaders, no environment/app/DB dependencies, accurately limited claims |
| D1-L08 — Low offline, significant for production admission | Encoding/payload caps are enforced in the bounded harness | HTTP resource costs, huge object admission, concurrency and duplicate-key policy unproven | Backend/security; D-2 timing bounds, later admission/parser scope | Finite timer/settings checks, oversized inputs; separate production body/concurrency/parser budgets before integration |

| Warning | Accepted current disposition | Owner / next action | Closure evidence required |
|---|---|---|---|
| W1 — MIXED_EXPORTS | Non-failing with current bundled config; not resolved | Test tooling owner; D-2 proposal moves named guard exports out of config into existing fixtures.ts | One config export and unchanged early guards; warning absent on rerun, not suppressed |
| W2 — native-loader/CommonJS/ESM | Current bundle loader works; future-loader risk accepted, not resolved | Test tooling owner; D-2 proposal uses same-file CommonJS config without runtime ESM syntax | Typecheck plus bundled/native loader proof with exact test inclusion; no manifest/lockfile/tenth file |

## 5. Exclusions, remaining gates and status

This acceptance authorizes none of: D-2 implementation; production cryptography or application integration; real passenger-data encryption; trusted production grants/IAM; real KMS SDKs/keys/providers; schema/Prisma/database connections or changes; migrations/backfill/cleanup/retention/deletion; cloud/account/domain/billing/provisioning; deployments; SMTP/supplier/payment requests; commits/pushes; Phase 1I-E or Phase 2.

All fourteen L-01–L-14 decisions remain **BLOCKED**: zero fully independently verified and zero formally approved legal entries. No legal periods, commencement or transfer permissions are adopted. ADR-05 and ADR-10 remain BLOCKED; other production ADRs retain PROPOSED status. AWS KMS remains provisional; existing-compatible-hosting first and Cloudflare DNS/security/hybrid-after-proof remain recommendations.

The [D-2 scope](PHASE_1I_D_D2_CRYPTO_HARDENING_SCOPE.md) is a separate unexecuted proposal. Acceptance of D-1 does not accept that proposal or close any listed limitation. Further implementation needs explicit exact-file authorization.

**Milestone disposition: OWNER-ACCEPTED — SYNTHETIC D-1 SCOPE ONLY.** No material discrepancy or acceptance-blocking defect was found in the accepted artifact. If a later material defect is found, record and escalate it for owner disposition; do not silently broaden this acceptance. Phase 1I-D overall remains incomplete.

## 6. Documentation change and final preservation evidence

| File | This task's change |
|---|---|
| This formal acceptance record | New scoped owner decision, evidence, limitations and exclusions |
| [D-2 hardening scope](PHASE_1I_D_D2_CRYPTO_HARDENING_SCOPE.md) | New exact seven-file proposal; no implementation |
| [D-1 acceptance review](PHASE_1I_D_D1_ACCEPTANCE_REVIEW.md) | New current-status banner and R4 owner-disposition annex; original review retained |
| [Architecture approval packet](PHASE_1I_D_ARCHITECTURE_APPROVAL_DECISION_PACKET.md) | Scoped acceptance and exact next approval request; unrelated ADRs unchanged |
| [Readiness/handoff](PHASE_1I_D_REFINEMENT_READINESS_AND_HANDOFF.md) | Accepted milestone, pending D-2 authorization, later-phase gates |

Final static checks PASS: all 597 baseline source/prototype files remain unchanged; exactly nine prototype files; original bodies of all eight existing Phase1I-D reports preserved, with five reports entirely untouched and three receiving only status/banner annexes. Static scans verified eight limitation rows, seven proposed D-2 files, 20 proposed regression groups, all 14 legal rows still BLOCKED, zero broken relative document links and zero whitespace issues. `git diff --check` passed, retaining only Git's earlier LF-to-CRLF normalization warning. The existing tracked main-design diff remains 161 additions from earlier tasks; this task did not modify that file, and untracked documentation changes do not appear in that stat.

Only the five documentation files above changed in this task. No application/prototype code, schema, migration, package/lockfile, credential, database, KMS/cloud/provider, SMTP/supplier/payment, deployment, commit or push action occurred. Public official documentation retrieval supported the D-2 design; it was not an operational provider call. Ephemeral fake keys were generated only by the authorized D-1 rerun. D-2 behavior and its new tests remain NOT IMPLEMENTED / NOT RUN.
