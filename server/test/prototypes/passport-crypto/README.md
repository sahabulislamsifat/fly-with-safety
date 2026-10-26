# D-1 / D-2 offline synthetic passenger-document cryptography

Owner authorization: M01 bounded ADR-01/02/07/08 and M02/D-1; subsequent explicit D-2 authorization permits only seven existing files. D-1 acceptance remains historical; D-2 results below are submitted for owner acceptance.
This directory contains exactly the nine authorized files. It is outside the production TypeScript source tree. No production code may import it.

## Contract and implementation

- Grouped strict synthetic passportNumber/passportExpiry/dateOfBirth payload. At least one present field; absent fields omitted; unknown properties, accessors, malformed calendar dates and invalid encoding rejected.
- AES-256-GCM, fresh 32-byte DEK and 12-byte nonce per write, 16-byte tag. Plaintext <=4 KiB UTF-8; encoded envelope <=16 KiB.
- Fixed AAD bytes: UTF-8 JSON array `["FlyWithSafe","passenger-document","1",environmentId,bookingId,passengerId]`. Identifiers match ASCII `[A-Za-z0-9][A-Za-z0-9_-]{0,63}`. Context snapshots are immutable across awaits.
- Strict envelope metadata and canonical unpadded base64url; synthetic key/resource/version allowlists. No endpoint resolution from input.
- Synthetic grant checks actor, FULFILLMENT role, assignment/environment/passenger, purpose, expiry and step-up before unwrap. These fixtures have no issuer authenticity and are not production grants.
- Fake KMS holds ephemeral wrapping KEKs, generates fresh DEKs, authenticates wrapped bytes plus context, and simulates denied/unavailable/retired/wrong keys. No DEK cache. Operation-owned buffers are cleared best effort on success/error. Plaintext is returned only after GCM final authentication and strict shape parsing.
- At most three sequential attempts on settled, explicitly classified fake transient failures, with bounded 25/50 ms delays. Never retry a timeout, policy failure, malformed output, denial, integrity failure or unknown failure. These are offline defaults, not measured production SLOs.
- Authorization returns Promise<void>, is awaited exactly once, and must fulfill undefined. Bare void/non-void results, throws, rejections and timeout fail closed before unwrap. Grant/context/envelope snapshots precede awaits; grant expiry is checked again before each attempt, after provider output and before plaintext release.
- Optional constructor settings default to authorization/provider/total budgets of 250/250/1500 ms, with positive safe-integer limits bounded to 5000 ms. Stage budgets/delays cannot exceed total. Monotonic operation deadlines and wall-clock grant expiry are separate; injected clocks are test-only. Exact-deadline settlement is rejected even when the timer callback has not run.
- Abort signals are advisory. Timeouts close the exposed workflow and forbid retries; observed late key results are cleared best effort. The unchanged fake ignores signals. Never-settling underlying promises may remain pending in memory; event-loop blocking cannot be forcibly interrupted by JavaScript timers.

## Offline execution

Use installed dependencies from `server`; no installs, app test scripts or normal integration runner:

```powershell
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck --types node,vitest/globals test/prototypes/passport-crypto/contracts.ts test/prototypes/passport-crypto/envelope-codec.ts test/prototypes/passport-crypto/passenger-document-crypto.ts test/prototypes/passport-crypto/synthetic-kms-adapter.ts test/prototypes/passport-crypto/fixtures.ts test/prototypes/passport-crypto/passport-crypto.test.ts test/prototypes/passport-crypto/boundaries.test.ts test/prototypes/passport-crypto/vitest.config.ts
& .\node_modules\.bin\vitest.cmd run --config test/prototypes/passport-crypto/vitest.config.ts
& .\node_modules\.bin\vitest.cmd run --config test/prototypes/passport-crypto/vitest.config.ts --configLoader native
```

`--esModuleInterop` matches the existing server compiler setting and built-in default imports; it is an explicit standalone CLI option, not a shared config change. No tenth tsconfig is needed.

`vitest.config.ts` selects only the two prototype suites and uses config-only CommonJS exports with an erased type annotation. The fixture file doubles as setup: it imports only Node built-ins and erased contract types, installs network/subprocess blockers idempotently, then exports synthetic fixtures. Tests never import config. Guards precede test-module/runtime imports; a separate test checks activation before explicit runtime import, and the VM loader checks it before each load. Vite env-file loading is disabled; no app setup/global hook, Prisma, SQL, dotenv, cloud SDK or provider client is imported. Result caching and coverage output are disabled.

Guards block fetch, WebSocket when available, TCP/TLS/HTTP(S), DNS, UDP and subprocess entry points before dispatch. Tests deliberately call blocked methods with synthetic targets; the blocker throws without network I/O and records method labels only. This is a scoped harness guard, not an operating-system security sandbox against arbitrary hostile native code.

Boundary tests inspect the runtime AST/import graph and execute the four runtime files in a VM with an inaccessible process/environment, no app/DB loader and log counters. Tests never access inherited credential values. VM compilation uses the existing TypeScript library, in memory. No external resources or customer data are needed.

## Required coverage and evidence

Tests name groups 01–13 and 15–17 in passport-crypto.test.ts; group 14 is boundaries.test.ts. Coverage includes round trip, tampering, tag finalization, AAD/binding, grant denials, outages/retries, provider denial, metadata allowlists, randomness, strict serialization, no logs/sanitized errors, dependency/network/environment isolation, key cleanup, historical fake keys and old-valid replay limitations.

Historical D-1 evidence: standalone no-emit TypeScript PASS; Vitest 5.0.3 reported **2 files passed, 104 tests passed, zero skipped/failed**. Before adding D-2 tests, both loaders passed those same 104 cases with the new orchestration. Test-case count is evidence, not a correctness target.

| Required group | Result |
|---|---|
| 01 Round trip | PASS |
| 02 Ciphertext tampering | PASS |
| 03 Tag authentication | PASS |
| 04 Canonical AAD | PASS |
| 05 Context binding | PASS |
| 06 Grant denial before unwrap | PASS |
| 07 Fake outage/bounded retry | PASS |
| 08 Provider denial | PASS |
| 09 Metadata/version/key allowlists | PASS |
| 10 Freshness, sizes and nonce substitution | PASS |
| 11 Serialization/date/size/encoding | PASS |
| 12 No plaintext console logs | PASS |
| 13 Sanitized errors | PASS |
| 14 Import/environment/network isolation | PASS |
| 15 Key cleanup and invalid keys | PASS |
| 16 Fake historical keys | PASS |
| 17 Old-valid-envelope limitation | PASS; demonstrated limitation, not a rollback defense |

Historical W1/W2 warnings concerned mixed named/default exports and ESM config syntax in a CommonJS package. D-2 removes their causes by moving guards to fixtures and using config-only CommonJS. Both loaders must pass without warning suppression or package changes.

## D-2 verification and acceptance evidence

2026-10-25, development baseline 154cf93: **155 tests passed in two suites under each loader**, zero skips/failures; standalone strict no-emit TypeScript PASS. W1/W2 absent in both runs. Original 104 cases retained; 51 new cases added. Original groups 07 and 16 advance controlled fake time for backoff; their assertions remain intact. Other original cryptographic assertions remain, with imports and VM globals adapted to the approved async contract.

| D-2 group | Executed evidence |
|---|---|
| R01 | Deferred authorization succeeds only after settlement; zero early unwrap |
| R02–R03 | Async denial/rejection and sync throw sanitized; zero unwrap |
| R04–R05 | Never/late policy settlement, total bound, exact-deadline/delayed timer rejection |
| R06 | Single authorization across three settled sequential attempts |
| R07 | Original role/assignment/purpose/step-up tests plus malformed policy and expiry during authorization/backoff/provider |
| R08 | Create/unwrap timeout, late DEK clearing, pre-deadline ownership and deadline ties |
| R09 | Sequentiality, 25/50 ms delays, attempt limits 1–3 and total-budget exhaustion |
| R10 | Non-retryable failures, malformed output and timeouts |
| R11 | Late rejection observation, cooperative test-double abort, malformed cleanup, timer/listener cleanup |
| R12–R13 | Sanitized codes/reasons, no sentinel leakage and no console output across success/retry/timeout/cleanup |
| R14 | Original exact AAD/context tests plus mutable caller snapshot race |
| R15 | Original ciphertext/tag/nonce/wrapped-key/version tests |
| R16 | Original historical-key test; byte-identical fake and codec |
| R17–R18 | AST/VM/import guards, blocked dispatch tests, setup-before-import under both loaders |
| R19 | Explicit eight-file strict no-emit command; negative type assertion rejects void policies |
| R20 | All original 104 cases preserved within the passing 155; no skipped coverage |

Only contracts.ts, passenger-document-crypto.ts, passport-crypto.test.ts, boundaries.test.ts, fixtures.ts, vitest.config.ts and this README changed. No file/dependency/format added. Baseline SHA-256 values for unchanged files:

- envelope-codec.ts: `6fe22834fc66ada58772de12cc38e0bb8f58cee9ca69afa21a60ac16af687fbd`
- synthetic-kms-adapter.ts: `d022f8bfde15c14fbb9d1909e966520a2cddcc1920d17013047d87b44c82f8d4`

The 628 tracked files outside the seven-file scope retain their baseline byte digest. No database, live provider, real credential, cloud, application integration, deployment, commit or push operation was performed. Recommendation: accept D-2 for this offline synthetic scope only. Production cancellation, admission control, key lifecycle, grant authenticity, memory guarantees, rollback protection and infrastructure remain unresolved.

## Limits and stop point

- No production integration, real KMS/identity, durable storage, database or provider requests. Fake key versions do not validate AWS/GCP/Azure behavior.
- AEAD accepts an older valid envelope in the same context; independent revision/CAS/audit is required for production rollback detection.
- Freshness samples do not prove collision impossibility. Deterministic fault injection exists only in tests and never supplies cipher production defaults.
- JavaScript strings/GC/native copies cannot be reliably zeroized. Buffer cleanup assertions verify only operation-owned buffers.
- Grouped granularity is approved for this synthetic contract only. Real-data retention, mask metadata, ID allocation, trusted grants and migration remain open.
- All 14 legal decisions remain BLOCKED. Other ADRs/manual actions retain prior gates. Phase 1I-E is not authorized.
- D-2 rollback, if separately authorized, restores the seven files together to their accepted D-1 versions after preserving evidence and unrelated edits. No file deletion or schema/data rollback is required. D-3, Phase 1I-E and Phase 2 remain outside scope.
