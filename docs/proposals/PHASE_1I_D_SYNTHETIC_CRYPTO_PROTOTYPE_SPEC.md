> **Current status — 2026-10-25:** D-1 is authorized and executed; fresh review recommends **PASS WITH DOCUMENTED LIMITATIONS — REQUIRES OWNER REVIEW**. Only ADR-01/02/07/08's bounded synthetic contracts have M01 approval. Production decisions and all legal gates remain open. See [acceptance review](PHASE_1I_D_D1_ACCEPTANCE_REVIEW.md) and the R3 annex below; earlier status statements are historical.

# Phase 1I-D — synthetic crypto prototype specification

REVIEW DRAFT R2, 2026-10-24. **BLOCKED — AWAITING CODE-SCOPE APPROVAL (D-1).** This document creates no implementation or tests. Approval must explicitly include ADR-01's grouped-envelope recommendation; otherwise revise the specification first.

## Exact proposed files

All are NEW proposed files under `server/test/prototypes/passport-crypto/`; none exists as a result of this task. No production imports, package scripts, manifests, lockfiles or Prisma files would change.

| File | Purpose |
|---|---|
| contracts.ts | CryptoEnvelopeV1, EncryptionContext, DataKeyProvider, DecryptionAuthorizationPolicy, CryptoError and strict payload types |
| envelope-codec.ts | Size-bounded parsing/base64url validation, canonical payload and fixed-array AAD serialization |
| passenger-document-crypto.ts | PassengerDocumentCrypto: grouped synthetic bundle encryption/decryption with auth-before-unwrap and final-before-release |
| synthetic-kms-adapter.ts | Test-only fake provider with ephemeral in-memory wrapping key and simulated failures; never exported to production |
| fixtures.ts | Obviously synthetic values, immutable test IDs, contexts and authorized/denied grants |
| passport-crypto.test.ts | Positive/negative crypto and authorization tests |
| boundaries.test.ts | Dependency, logging, network/DB isolation and no-production-import assertions |
| vitest.config.ts | Standalone Node test configuration with exact include, no app setup/global hooks or dotenv |
| README.md | Scope, assumptions, safe commands and limitations |

Allowed dependencies: existing TypeScript/Vitest, Node `node:crypto` and Node built-ins for the boundary harness only. No cloud SDK, database/Prisma, app bootstrap, environment loader, HTTP client, supplier, email or payment dependency. No install required. Existing `node:crypto` generates ephemeral synthetic test keys only after D-1 approval; these are not cloud keys or production secrets.

## Interfaces and data contract

- EncryptionContext: readonly environmentId, bookingId, passengerId; validated immutable synthetic ASCII IDs. Purpose/domain and versions are constants, not caller-selectable arbitrary strings.
- SyntheticPassengerDocumentV1: strict optional passportNumber, passportExpiry, dateOfBirth strings. Dates validated as calendar dates; absent fields omitted; unknown keys/oversize content rejected. Fixtures clearly marked synthetic, never loaded from DB or production logs.
- CryptoEnvelopeV1: exact R2 design fields payloadVersion, algorithm, aadVersion, keyProvider, keyRef, optional provider keyVersion, wrapAlgorithm, wrappedDek, nonce, ciphertext, tag. Limit 4 KiB plaintext and 16 KiB encoded envelope; 32-byte DEK, 12-byte nonce, 16-byte tag. Canonical unpadded base64url only.
- DataKeyProvider.createAndWrapDataKey(context): Promise of `{ plaintextDek: Uint8Array, wrappedDek, keyRef, keyVersion?, wrapAlgorithm }`; unwrapDataKey(envelopeWrappingMetadata, context): Promise<Uint8Array>. Returned key length is checked and cleared best effort after use. A separate rewrap interface is deferred; prototype does not simulate production migrations.
- PassengerDocumentCrypto.encrypt(payload, context): Promise<CryptoEnvelopeV1>; decrypt(envelope, context, grant): Promise<SyntheticPassengerDocumentV1>. Return no plaintext before tag verification and post-decryption shape validation. No plaintext fallback.
- DecryptionAuthorizationPolicy.assertAllowed(grant, context): checks identity, role, assigned booking/passenger, allowed purpose, expiry and step-up condition before provider invocation. Grant fixtures are internal test objects; accepting arbitrary browser claims is explicitly not a production authorization design.
- CryptoError exposes only a code and correlation ID: INVALID_INPUT, INVALID_ENVELOPE, UNSUPPORTED_VERSION, FORBIDDEN, KEY_UNAVAILABLE, KEY_ACCESS_DENIED, INTEGRITY_FAILURE. Unknown provider failures map to KEY_UNAVAILABLE without raw message/cause serialization. Public endpoint mapping is outside scope.

AAD is UTF-8 JSON serialization of the fixed validated string array `["FlyWithSafe","passenger-document","1",environmentId,bookingId,passengerId]`. Exact-byte vectors cover escaping rejection, ordering and ID/environment substitution. KeyRef is not content AAD: enforce an independent provider/key allowlist. No untrusted envelope field selects arbitrary URLs or credentials.

SyntheticKmsAdapter uses an ephemeral wrapping key and authenticates wrapped bytes/context; tampering must not succeed merely because the fake returns a fixed DEK. It counts calls without logging material, supports allowed/denied/unavailable/wrong-key/retired-version responses, and resets per test. It models interface behavior only, not AWS/GCP/Azure wire formats, IAM or recoverability. No persistent cross-request plaintext DEK cache. Randomness injection is test-only; deterministic known-answer vectors never become production defaults. A small randomness sample is not a proof of collision impossibility.

## Complete proposed regression scope

| Group | Required assertions |
|---|---|
| 1 Round trip | Synthetic passport/date bundle, omitted fields, empty/invalid payload handling |
| 2 Ciphertext | Bit flip, truncation and appended bytes rejected |
| 3 Tag | Modified/short/long tags rejected; no plaintext emitted before final |
| 4 AAD | Exact canonical vectors; changed domain/version/encoding rejected |
| 5 Binding | Wrong passenger, booking or environment fails; envelope swap fails |
| 6 Authorization | Denied role, assignment, purpose, expired grant, missing step-up; zero unwrap calls |
| 7 Unavailability | Fake transient outage fails closed within bounded retry budget; no fallback |
| 8 Denial | Provider permission denial sanitized and not retried |
| 9 Versions | Unknown payload/AAD/wrap/algorithm/key identity rejected before unwrap where possible |
| 10 Nonces/DEKs | Correct lengths, fresh per encryption, injected repeated-key/nonce misuse caught by test expectations; controlled vectors isolated |
| 11 Serialization | Dates including leap days, unknown fields, canonical encoding, UTF-8/size boundaries, malformed JSON/base64url |
| 12 Logs | Spy all harness sinks; sentinel passport/DOB/key/token strings absent on success/failure |
| 13 Failures | Raw fake provider error includes sentinels; exposed error code/correlation only, no raw cause |
| 14 Isolation | No Prisma/app imports/env loading; network APIs blocked; no external setup; no DB needed |
| 15 Key lifetime | Wrong-length DEK rejected; cleanup path invoked on success/error; no claim of guaranteed JS memory erasure |
| 16 Rotation limits | Historical fake key version readable while enabled, unavailable after fake retirement; no claim of live provider rotation |
| 17 Replay limit | Old valid same-context envelope remains cryptographically valid; document need for revision/CAS rather than claim AEAD prevents rollback |

Exact test count depends on cases written after approval; these are 17 planned groups, **zero executed prototype tests**.

## Future safe execution and rollback

After separate approval, from `server`, use the existing local Vitest executable with only the new standalone configuration:

```powershell
& .\node_modules\.bin\vitest.cmd run --config test/prototypes/passport-crypto/vitest.config.ts
```

Before running, inspect the config/import graph and network blockers; inherited production environment variables must not be read. Do not invoke the normal PostgreSQL integration runner. Test logs contain test names/counts only. Add a no-emit standalone TypeScript check using the installed compiler with explicit files/options or an approved local prototype tsconfig (the latter would require adding it to the exact scope).

Expected application compatibility effects: none, because there are no app imports or route/schema changes. Passing tests establishes offline primitives only; no production authorization, Cloudflare, KMS, storage or legal verification. Rollback is removal of only the newly approved prototype files after preserving review evidence; no database rollback exists or is needed. No cloud resource, real PII, provider credential or billing account is required.

**D-1 request:** approve exactly the nine proposed files, grouped envelope contract, existing-dependency-only offline implementation and tests above. This excludes production integration, schemas, real keys, cloud calls, retention jobs and Phase 1I-E. Legal rows remain BLOCKED even if this code scope is later approved.


## R3 — authorized execution and acceptance (2026-10-25)

Earlier BLOCKED — AWAITING CODE-SCOPE APPROVAL language describes the pre-authorization proposal. The owner subsequently approved exactly the nine-file D-1 scope and ADR-01/02/07/08 only for its synthetic contract. All nine files exist. Fresh checks pass 104 tests/two suites, zero failures/skips, and no-emit TypeScript.

[Acceptance review](PHASE_1I_D_D1_ACCEPTANCE_REVIEW.md): PASS WITH DOCUMENTED LIMITATIONS — REQUIRES OWNER REVIEW. Formal owner acceptance is pending. No implementation/correction occurred during this review. Exact commands, findings and proposed correction scopes appear there.

The actual compiler command includes --esModuleInterop, matching the existing server setting; no shared config/tenth tsconfig was added. fixtures.ts doubles as safety setup, importing the config guard helper before tested runtime modules. VM/patch/AST evidence is scoped to reviewed paths; it is not an OS sandbox.

D1-L01–L08 and W1/W2 remain open limitations/dispositions. Fake attempts do not supply real provider deadlines. A future asynchronous grant checker requires a reviewed awaited contract. No blocking defect was identified in the approved synchronous path. Future D-2 changes require explicit files/behavior/dependency/test approval.

Production integration, schemas/databases/backfills/retention, real KMS/keys/SDKs, provider resources, SMTP/suppliers/payments, deployment and I-E remain outside D-1. All 14 legal rows remain BLOCKED.
