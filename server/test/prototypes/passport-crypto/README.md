# D-1 offline synthetic passenger-document cryptography

Owner authorization: 2026-10-25, M01 bounded ADR-01/02/07/08 and M02/D-1 only.
This directory contains exactly the nine authorized files. It is outside the production TypeScript source tree. No production code may import it.

## Contract and implementation

- Grouped strict synthetic passportNumber/passportExpiry/dateOfBirth payload. At least one present field; absent fields omitted; unknown properties, accessors, malformed calendar dates and invalid encoding rejected.
- AES-256-GCM, fresh 32-byte DEK and 12-byte nonce per write, 16-byte tag. Plaintext <=4 KiB UTF-8; encoded envelope <=16 KiB.
- Fixed AAD bytes: UTF-8 JSON array `["FlyWithSafe","passenger-document","1",environmentId,bookingId,passengerId]`. Identifiers match ASCII `[A-Za-z0-9][A-Za-z0-9_-]{0,63}`. Context snapshots are immutable across awaits.
- Strict envelope metadata and canonical unpadded base64url; synthetic key/resource/version allowlists. No endpoint resolution from input.
- Synthetic grant checks actor, FULFILLMENT role, assignment/environment/passenger, purpose, expiry and step-up before unwrap. These fixtures have no issuer authenticity and are not production grants.
- Fake KMS holds ephemeral wrapping KEKs, generates fresh DEKs, authenticates wrapped bytes plus context, and simulates denied/unavailable/retired/wrong keys. No DEK cache. Operation-owned buffers are cleared best effort on success/error. Plaintext is returned only after GCM final authentication and strict shape parsing.
- At most three immediate attempts on explicitly classified fake transient failures. Policy/provider denial, integrity failures and unknown provider errors are not retried. This is no real KMS timeout/backoff/SLO implementation.

## Offline execution

Use installed dependencies from `server`; no installs, app test scripts or normal integration runner:

```powershell
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck --types node,vitest/globals test/prototypes/passport-crypto/contracts.ts test/prototypes/passport-crypto/envelope-codec.ts test/prototypes/passport-crypto/passenger-document-crypto.ts test/prototypes/passport-crypto/synthetic-kms-adapter.ts test/prototypes/passport-crypto/fixtures.ts test/prototypes/passport-crypto/passport-crypto.test.ts test/prototypes/passport-crypto/boundaries.test.ts test/prototypes/passport-crypto/vitest.config.ts
& .\node_modules\.bin\vitest.cmd run --config test/prototypes/passport-crypto/vitest.config.ts
```

`--esModuleInterop` matches the existing server compiler setting and built-in default imports; it is an explicit standalone CLI option, not a shared config change. No tenth tsconfig is needed.

`vitest.config.ts` selects only the two prototype suites. The fixture file doubles as setup: it imports only config and erased contract types, installs network/subprocess blockers, then exports synthetic fixtures. Thus guards precede test-module/runtime imports. Vite env-file loading is disabled; no app setup/global hook, Prisma, SQL, dotenv, cloud SDK or provider client is imported. Result caching and coverage output are disabled.

Guards block fetch, WebSocket when available, TCP/TLS/HTTP(S), DNS, UDP and subprocess entry points before dispatch. Tests deliberately call blocked methods with synthetic targets; the blocker throws without network I/O and records method labels only. This is a scoped harness guard, not an operating-system security sandbox against arbitrary hostile native code.

Boundary tests inspect the runtime AST/import graph and execute the four runtime files in a VM with an inaccessible process/environment, no app/DB loader and log counters. Tests never access inherited credential values. VM compilation uses the existing TypeScript library, in memory. No external resources or customer data are needed.

## Required coverage and evidence

Tests name groups 01–13 and 15–17 in passport-crypto.test.ts; group 14 is boundaries.test.ts. Coverage includes round trip, tampering, tag finalization, AAD/binding, grant denials, outages/retries, provider denial, metadata allowlists, randomness, strict serialization, no logs/sanitized errors, dependency/network/environment isolation, key cleanup, historical fake keys and old-valid replay limitations.

Verified in this execution on 2026-10-25 (Asia/Dhaka): standalone no-emit TypeScript check PASS; Vitest 5.0.3 reported **2 files passed, 104 tests passed, zero skipped/failed**. Test-case count is evidence, not a correctness target.

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

Two non-failing tool warnings were observed: mixed named/default exports in the standalone config, and ESM syntax in a TypeScript config loaded as CommonJS by the current config bundler. Current approved commands succeeded. A future Vite native-loader default may require separately reviewed configuration changes; no manifest, shared config or tenth file was changed to suppress warnings.

## Limits and stop point

- No production integration, real KMS/identity, durable storage, database or provider requests. Fake key versions do not validate AWS/GCP/Azure behavior.
- AEAD accepts an older valid envelope in the same context; independent revision/CAS/audit is required for production rollback detection.
- Freshness samples do not prove collision impossibility. Deterministic fault injection exists only in tests and never supplies cipher production defaults.
- JavaScript strings/GC/native copies cannot be reliably zeroized. Buffer cleanup assertions verify only operation-owned buffers.
- Grouped granularity is approved for this synthetic contract only. Real-data retention, mask metadata, ID allocation, trusted grants and migration remain open.
- All 14 legal decisions remain BLOCKED. Other ADRs/manual actions retain prior gates. Phase 1I-E is not authorized.
- Rollback, if separately requested, removes only these nine prototype files after preserving evidence. No schema/data rollback applies.
