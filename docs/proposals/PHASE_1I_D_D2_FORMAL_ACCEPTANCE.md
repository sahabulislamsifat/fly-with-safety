# Phase 1I-D D-2 — formal bounded owner acceptance

**OWNER-ACCEPTED — OFFLINE SYNTHETIC D-2 ONLY**

Recorded 2026-10-25 (Asia/Dhaka), development HEAD 154cf93, with seven preexisting D-2 working-tree changes. Authority: the owner's current “D-2 Formal Owner Acceptance + D-3B Synthetic Auth-Delivery Security Implementation” execution instruction conditionally authorizes recording acceptance after successful independent verification. Those conditions were met; no material acceptance-blocking discrepancy was found. This records owner authorization, not an agent's unilateral production approval.

## Accepted artifact and current evidence

Exactly seven changed existing files in server/test/prototypes/passport-crypto: contracts.ts, passenger-document-crypto.ts, passport-crypto.test.ts, boundaries.test.ts, fixtures.ts, vitest.config.ts and README.md. Nine total prototype files; codec and fake adapter untouched. Reviewed [D-2 scope](PHASE_1I_D_D2_CRYPTO_HARDENING_SCOPE.md), complete prototype and R01–R20 coverage. Original 104 cases retain meaningful assertions; 51 added cases cover awaited policy, deadlines, sequential retries, late-key cleanup and isolation. Groups 07/16 use fake-time advancement for the approved backoff change.

Fresh commands from server:

```powershell
& .\node_modules\.bin\vitest.cmd run --config test/prototypes/passport-crypto/vitest.config.ts
& .\node_modules\.bin\vitest.cmd run --config test/prototypes/passport-crypto/vitest.config.ts --configLoader native
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck --types node,vitest/globals test/prototypes/passport-crypto/contracts.ts test/prototypes/passport-crypto/envelope-codec.ts test/prototypes/passport-crypto/passenger-document-crypto.ts test/prototypes/passport-crypto/synthetic-kms-adapter.ts test/prototypes/passport-crypto/fixtures.ts test/prototypes/passport-crypto/passport-crypto.test.ts test/prototypes/passport-crypto/boundaries.test.ts test/prototypes/passport-crypto/vitest.config.ts
```

Both loaders: Vitest 5.0.3, two suites, **155 passed, zero failed/skipped**, exit 0, 1.64 seconds each. Strict no-emit: exit 0, no diagnostics. W1/W2 absent without warning suppression. Guard setup, exact includes, disabled env loading, AST/VM/import and blocked-dispatch checks passed. Authorize-before-unwrap, denial-first behavior, immutable snapshots, bounded stage/total deadlines, settled-only sequential retries, late result handling and sanitized errors were reviewed and exercised. No D-2 code was modified by this acceptance task.

Byte SHA-256: envelope-codec.ts `6fe22834fc66ada58772de12cc38e0bb8f58cee9ca69afa21a60ac16af687fbd`; synthetic-kms-adapter.ts `d022f8bfde15c14fbb9d1909e966520a2cddcc1920d17013047d87b44c82f8d4`. The 635 tracked files at entry, including all D-2 modifications, have aggregate digest `0f67b93f83c5d10aa2fec1f744a8240b4e7bb7cd6a82dad19a5534ee7213cc55` (sorted JSON path/byte-hash entries). Preserve them during D-3B.

## Limitations and remaining gates

- Advisory abort does not prove underlying cancellation. Never-settling provider promises may remain pending; blocked event loops cannot be forcibly interrupted by timers.
- Buffer clearing is best effort; JavaScript strings, GC/native copies and process compromise remain exposure paths.
- Same-context historical valid ciphertext remains replayable. No independent revision/CAS/checkpoint/restore protection was implemented.
- Grants, keys, transport isolation and provider outcomes are synthetic. No production authorization, IAM, SDK interoperability, KMS, deployment or real memory guarantee follows from these tests.
- All 14 legal decisions remain BLOCKED. Production ADRs retain their existing gates. No retention periods or cross-border permissions are approved.

Acceptance covers this offline artifact only. Excluded: application integration, PostgreSQL/schema/migrations/backfills/deletions, real keys/KMS/cloud, credentials, SMTP/OAuth/supplier/payment operations, infrastructure, deployments, commits/pushes and Phase 1I-E/Phase 2. Later D-3B synthetic implementation has its own current owner authorization; this acceptance does not expand it. Phase 1I-D overall remains incomplete.

**VERDICT: PASS** — owner-accepted within the stated offline D-2 boundary.
