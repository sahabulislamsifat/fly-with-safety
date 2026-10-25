# Phase 1I-D D-3B — synthetic auth-delivery verification report

Verified 2026-10-25 (Asia/Dhaka).

## 1. Executive verdict

**PASS WITH DOCUMENTED LIMITATIONS — REQUIRES OWNER REVIEW.** D-3B is recommended for bounded offline synthetic owner acceptance. It is not automatically owner-accepted. D-2 is now **OWNER-ACCEPTED — OFFLINE SYNTHETIC D-2 ONLY**, under the owner's conditional instruction and fresh passing verification; see [formal record](PHASE_1I_D_D2_FORMAL_ACCEPTANCE.md).

The owner's current master execution prompt explicitly authorized the nine new prototype files and these two reporting documents. The design-only authorization banners in older proposals remain historical; this report does not rewrite their architecture or legal decisions. No material difference between the approved nine-file inventory and the authoritative [D-3A scope §§8–9](PHASE_1I_D_D3_AUTH_DELIVERY_SECURITY_SCOPE.md) required a scope expansion.

## 2. Repository baseline

- Branch development; HEAD 154cf93, unchanged.
- Seven D-2 files were already modified at entry: README.md, contracts.ts, passenger-document-crypto.ts, passport-crypto.test.ts, boundaries.test.ts, fixtures.ts and vitest.config.ts in server/test/prototypes/passport-crypto. Preserve these changes rather than restoring Git HEAD.
- The D-3A scope document was already untracked. Its bytes remain unchanged: SHA-256 `659dd83709fa5779939caac6d53c36e94e18036aec4a0b3127e6630e534558db`.
- All nine proposed auth-delivery paths were absent before creation. Installed tools: Node v26.9.0, TypeScript 5.9.3, Vitest 5.0.3. No dependency installation or manifest change.
- All 635 tracked files at entry have the same final aggregate byte digest: `0f67b93f83c5d10aa2fec1f744a8240b4e7bb7cd6a82dad19a5534ee7213cc55`. Algorithm: SHA-256 of JSON of sorted `[path, sha256(file bytes)]` entries. This includes all previous application/privacy/pagination/reliability/security modifications and the dirty D-2 artifact.

## 3. Exact files created

Exactly nine files under server/test/prototypes/auth-delivery/:

| File | Implemented responsibility |
|---|---|
| contracts.ts | Readonly context, payload, envelope, grant, lifecycle, state/transport interfaces and allowlisted sanitized errors. |
| auth-delivery-codec.ts | Strict snapshots/serialization/AAD/envelope validation, AES-256-GCM and bounded asynchronous policy/key orchestration. |
| synthetic-key-provider.ts | Independent ephemeral fake wrapping KEKs, v1/v2, fresh DEKs, denial/unavailability/integrity behavior and disposal. |
| fake-outbox.ts | In-memory clone/publish unit, logical replay/conflict/supersession, hash-only token state, consumption, snapshot recovery, lease fencing, retries and redrive. |
| fake-transport.ts | Controlled submission/suppression/failure/ambiguity outcomes; history contains message IDs/outcomes only. |
| fixtures.ts | Synthetic records and controlled-promise helpers; idempotent network/subprocess blockers installed during setup before runtime imports. |
| auth-delivery.test.ts | T01–T18, including validation, lifecycle, deadlines, faults and concurrency interleavings. |
| boundaries.test.ts | T19–T20: exact file inventory, AST/VM/import/environment/dispatch guards and all nine passenger-artifact byte hashes. |
| vitest.config.ts | Isolated exact two-suite CommonJS configuration, disabled env loading/cache/coverage, no app/global setup. |

Exactly two additional authorized new documents: this report and PHASE_1I_D_D2_FORMAL_ACCEPTANCE.md. No tenth prototype file, rename, existing-file edit, package/config change or production import was introduced in this task.

## 4. Implementation summary

Cryptography: grouped auth-delivery payload with fixed purpose `flywithsafe.auth-delivery.v2`, separate synthetic provider/key identities, fresh 32-byte DEK and 12-byte nonce, 16-byte GCM tag. Fake wrapped keys are 60 bytes. Payload max 4096 bytes, envelope max 16384 bytes; canonical unpadded base64url, strict UTF-8, exact fields, real round-tripping dates and synthetic-only credential/recipient shapes. GCM final and payload validation precede release. No plaintext fallback or cross-request DEK cache.

AAD follows the exact approved fixed array including domain/version/environment/message/token/user/purpose and allowlisted wrapping metadata. Expected context comes from trusted fake state, never from ciphertext as authority. Wrapping also authenticates the fixed wrapping domain/context. OAuth and passenger purposes are rejected without importing their implementations. A valid old same-context envelope remains cryptographically valid; this is not an anti-rollback mechanism.

Authorization and timing: policy is awaited once and must fulfill undefined. Bare void, non-void fulfillment, throws/rejections and late policy results cannot authorize unwrap. Snapshot context/grant/envelope before waits. Positive bounded limits use the approved 250/250/1500 ms defaults, max total 5000 ms, and 25/50 ms delays only after settled classified key unavailability. No retry after timeout. Deadlines are checked at settlement even if the timer callback is delayed. Late owned DEKs are scrubbed best effort; grants/deadlines are checked again before decryption and release.

Fake atomicity: encrypt outside the fake unit; clone current state; stage account/supersession/token/message/issuance-registry effects; publish synchronously only after all fault points succeed. One committed credential/message per logical issuance. Same-key/same-request replay returns original opaque receipt; conflicts reject. Concurrent same-key contenders can perform losing ephemeral encryption work, but only one credential/message commits. Different deliberate issuances require expected account/purpose revisions. Expired receipt replay does not renew or reactivate the credential.

Lifecycle: only token hashes enter token records; recipient and raw synthetic credential stay inside the encrypted job payload. Trusted account directory is separate from outbox exports. Account identity revision prevents changing an email away and back from reviving a message. Redemption conditionally checks current purpose/hash/expiry/consumption/revocation/account state and publishes the effect with consumption in one synchronous fake transition. Wrong-purpose, invalid or reused credentials fail. Reset effects use opaque counters, never actual passwords.

Reliability: monotonically increasing lease versions, owner/expiry checks, expiry recovery and fenced acknowledgment; no transaction spans crypto or transport waits. Dispatch checks token, payload identities/hash/times, account recipient/revision, grant and current lease before sending. Retry keeps original ciphertext/token/message, bounded exponential scheduling and at most five transport attempts by default. Disabled/suppressed/terminal outcomes never become DELIVERED. Redrive validates expected version and current credential eligibility; it cannot revive expired/used/revoked/changed-recipient or integrity/forbidden records. Key recovery supports controlled eligible redrive.

Transport is a fake awaited outcome, never a real SMTP call. It is not raced against a timeout. Acceptance followed by lost acknowledgment/crash can produce a duplicate after lease recovery. DELIVERED means accepted submission with valid acknowledgment, not inbox receipt or exactly-once delivery.

## 5. Actual test evidence

Final D-3B: **145 passed in two suites per loader, zero failures/skips**, bundled duration 1.44 seconds, native 1.39 seconds; both exit 0. Scoped strict no-emit TypeScript exit 0, no diagnostics. Both loaders initialize guards safely; W1/W2 absent, no warning suppression. Final snapshot exports are recursively frozen detached copies, with explicit mutable copies used only to model adversarial persisted-state changes in tests.

D-2 initial acceptance gate: 155/155 under each loader, 1.64 seconds each; strict no-emit exit 0. Preservation rerun after D-3B implementation: **155/155 per loader**, bundled 1.94 seconds, native 1.93 seconds; strict no-emit exit 0. Do not add the two loader runs together as unique case counts: D-3B has 145 distinct cases and D-2 has 155.

Actual commands from E:\Programming\Project\fly-with-safety\server:

```powershell
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck --types node,vitest/globals test/prototypes/auth-delivery/contracts.ts test/prototypes/auth-delivery/auth-delivery-codec.ts test/prototypes/auth-delivery/synthetic-key-provider.ts test/prototypes/auth-delivery/fake-outbox.ts test/prototypes/auth-delivery/fake-transport.ts test/prototypes/auth-delivery/fixtures.ts test/prototypes/auth-delivery/auth-delivery.test.ts test/prototypes/auth-delivery/boundaries.test.ts test/prototypes/auth-delivery/vitest.config.ts
& .\node_modules\.bin\vitest.cmd run --config test/prototypes/auth-delivery/vitest.config.ts
& .\node_modules\.bin\vitest.cmd run --config test/prototypes/auth-delivery/vitest.config.ts --configLoader native
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck --types node,vitest/globals test/prototypes/passport-crypto/contracts.ts test/prototypes/passport-crypto/envelope-codec.ts test/prototypes/passport-crypto/passenger-document-crypto.ts test/prototypes/passport-crypto/synthetic-kms-adapter.ts test/prototypes/passport-crypto/fixtures.ts test/prototypes/passport-crypto/passport-crypto.test.ts test/prototypes/passport-crypto/boundaries.test.ts test/prototypes/passport-crypto/vitest.config.ts
& .\node_modules\.bin\vitest.cmd run --config test/prototypes/passport-crypto/vitest.config.ts
& .\node_modules\.bin\vitest.cmd run --config test/prototypes/passport-crypto/vitest.config.ts --configLoader native
git diff --check
```

### Executed T01–T20 matrix

| Group | Result / meaningful evidence |
|---|---|
| T01 | PASS: both purposes, serialized round trip, fixed AAD, fresh keys/nonces, strict sizes/shape/dates/encoding/accessors. |
| T02 | PASS: no plaintext credential/recipient/URL in fake job exports; hash-only token state; frozen detached snapshots; no send on encryption failure. |
| T03 | PASS: ciphertext/tag/nonce/wrapped-key tampering and append/truncate reject; malformed authenticated UTF-8/payload yields no partial result. |
| T04 | PASS: wrong environment/message/token/user/purpose, metadata/version/key identities and passenger/OAuth domains reject. |
| T05 | PASS: recipient substitution and change-away/back revision mismatch reject; issuance recipient override disallowed. |
| T06 | PASS: denial/unavailability/historical retirement, unknown/malformed key output, bounded sequential retries/deadlines, late DEK clearing, policy/grant failures and immutable caller snapshots. |
| T07 | PASS: account/token/message/registry atomic publish, replay/conflict, concurrent contenders, customer/purpose isolation and deliberate supersession. |
| T08 | PASS: faults at six staging/publish points leave neither new records nor supersession; expiry during encryption prevents commit. |
| T09 | PASS: snapshot reconstruction with same fake provider preserves receipt/message/token identity. Modeled restart only. |
| T10 | PASS: retries preserve ciphertext/token/message and do not reissue; next-attempt admission respected. |
| T11 | PASS: missing/expired/used/revoked tokens and grants; expiry during policy/backoff/provider; changed state after decrypt; wrong credential hash. |
| T12 | PASS: deterministic concurrent email/reset redemption has one winner; wrong-purpose/invalid fails; effect fault rolls back consumption and effects. |
| T13 | PASS: claimant collision, expired lease recovery, stale/late ack rejection, monotonic versions/equal/backward ticks and lost lease during decrypt. |
| T14 | PASS: submitted/suppressed/terminal/disabled/unknown outcomes truthful; max attempts and exponential schedule bounded. |
| T15 | PASS: stale redrive and expired/used/revoked/recipient/integrity cases rejected; restored-key redrive retains original protected message. |
| T16 | PASS: accepted/crash/lost-ack recovery demonstrates possible duplicate; in-flight send not abandoned; stale owner cannot overwrite new lease. |
| T17 | PASS: no console output or credential/recipient sentinel in diagnostics/history/job exports; sanitized raw/mutated failures; observed late rejection and timer/listener cleanup. |
| T18 | PASS: V1 quarantined, V2 reader/writer-off compatibility, corrupt/mixed/unknown reject, invalid restored fields/reasons reject. Historical-key proof also in T06. |
| T19 | PASS: runtime AST allowlist, exact config/file inventory, guard-before-import, VM without accessible process/environment/app loader, ten blocked dispatch entry points. |
| T20 | PASS: byte hashes for all nine passenger files unchanged; separate D-2 compiler and both-loader 155-case reruns pass. |

No required test is skipped/disabled. Tests use controlled clocks/deferred promises; no real network sleeps or services. Assertions compare secret-bearing values through booleans rather than printing the values. Final test output contains counts/status only, no raw synthetic credential, recipient or key sentinel. No unhandled rejection or hanging-timer warning was observed.

### Development diagnostics and corrections

An initial compiler invocation from repository root could not resolve server-local Node types; corrected the working directory to server, without installing dependencies. Compile-only development checks then caught record narrowing, readonly test mutation and a literal-typed mutation fixture; corrected within the new files.

The first runnable suite reported 93 passes and 27 failures (120 cases): a test helper spread userId into the strict seven-field WorkerGrant, causing denial as designed. Removed that unintended test field; the unchanged strict grant checks then passed all 120 cases. Additional adversarial cases expanded coverage to 145. Restored-state allowlists, reason-code validation and error reconstruction were strengthened within the approved scope. No assertion or guard was disabled. All final checks pass; no outstanding compiler/test failure or loader warning remains.

## 6. Security verification and repository preservation

Runtime dependencies are only the five local synthetic modules and node:crypto/node:util. AST checks reject production/app/Prisma/SQL/OAuth/env/provider SDK/network imports and dynamic require/eval/Function calls. Fixture setup imports only Node built-ins and installs blockers before runtime test imports. Config has envDir=false, empty globalSetup, exact two includes, threads/one worker/isolation, cache/watch/coverage disabled. VM instrumentation runs issuance and dispatch with inaccessible process/environment and no application loader; it is not a security sandbox.

Blockers cover fetch/WebSocket, TCP/socket/TLS/HTTP(S), DNS and promises, UDP and subprocess dispatch, recording method labels only. Existing tools execute outside that test-worker guard as explicitly approved CLI checks; no application server, integration runner, DB client, real SMTP, OAuth/provider/cloud/supplier/payment operation was started. No credential value or environment secret was requested/read/printed. No commit, push, deployment, package install, manifest, database schema or data operation occurred.

All 635 existing tracked files retain their captured byte digest, including the seven dirty D-2 files. The preexisting untracked D-3A document retains its hash. All nine passenger hashes are also checked by executable T20. Existing codec/fake hashes remain `6fe22834fc66ada58772de12cc38e0bb8f58cee9ca69afa21a60ac16af687fbd` and `d022f8bfde15c14fbb9d1909e966520a2cddcc1920d17013047d87b44c82f8d4`. Git HEAD/branch unchanged. `git diff --check` passes; separate whitespace checks cover new untracked files. Expected additions are exactly nine prototype files and two reports; the preexisting D-3A document is not a new task addition.

## 7. Existing D-1/D-2 preservation

All nine passenger prototype files remain byte-identical to this session's baseline. D-2's original 104 cases plus 51 additions still pass under both loaders. No passenger format, AAD, key provider, grants, source or tests were modified. D-2 acceptance remains bounded as recorded; D-1's prior owner acceptance is preserved.

## 8. Known limitations

1. In-memory clone/publish and deterministic interleavings do not prove PostgreSQL transactions, process concurrency, uniqueness, durable recovery or real worker restart. Snapshot restart requires the same fake key provider; it is not KMS recovery.
2. Expected context/account/token state, worker policy, snapshot origin and administrative test controls are trusted synthetic boundaries. Public fake acknowledgment/fault/recipient-change helpers are harness controls, not an authentication/authorization API for production clients. Encryption does not protect against arbitrary compromise of this trusted state or process.
3. Abort is advisory. Underlying never-settling provider promises may remain pending; timers cannot interrupt a blocked event loop. No real SDK cancellation/retry interoperability is certified.
4. Buffer cleanup is best effort. Strings, GC/native copies, ephemeral transport arguments and authorized-process compromise remain exposure paths. No production memory-erasure guarantee.
5. Credential use/revocation or lease expiry can race an already started send. SMTP acceptance and acknowledgment are not atomic. Duplicate sends remain possible; no exactly-once or real inbox-delivery guarantee.
6. Valid same-context ciphertext can be replayed; trusted fake lifecycle checks do not solve privileged rollback of the entire stored state. Production requires independent recovery/revision/checkpoint decisions.
7. V1 handling is classification/quarantine only. No real legacy inventory, migration, retention, cleanup, key rotation or backfill has been performed or approved.
8. Runtime guards/VM/AST are scoped test evidence, not OS isolation or deployed security proof. No production API compatibility/browser/staging claim is made.

## 9. ADR-03 status

The approved synthetic implementation demonstrates purpose-separated protected delivery payloads and modeled lifecycle/fencing/retry rules. **Production ADR-03 remains PROPOSED with implementation gates unresolved** (older packets may label that gate BLOCKED). Synthetic owner approval does not approve production encryption, database design or application changes.

## 10. Legal status

**14 BLOCKED — 0 formally approved.** L-01–L-14 remain unchanged. No legal research, counsel approval, statutory periods, transfer authority or deletion schedule is inferred from these tests.

## 11. Infrastructure status

No real KMS, production/shared/local PostgreSQL access, cloud provisioning, hosting change, domain purchase or billing activation. No provider selected by this implementation. Real topology, identities/IAM, region, availability, quota/latency/cost, monitoring and key recovery remain separate owner/security/infrastructure decisions.

## 12. Approval readiness

Ready for owner review of **D-3B offline synthetic acceptance only**, with §8 limitations retained. D-3B is not automatically accepted. Rollback, if separately authorized, affects only the nine new prototype files after preserving evidence and later edits; no Git reset/clean or data rollback. The two reporting records should remain historical evidence unless explicitly directed otherwise.

Recommended owner wording: “I accept D-3B for the exact nine-file offline synthetic artifact and the verification evidence in this report, with its documented limitations. This authorizes no production authentication/outbox integration, database work, real KMS/cloud/SMTP, legal changes or subsequent phase.”

## 13. Next development dependencies and stop point

Separate approvals required for real auth/notification/outbox integration; account-creation atomicity and supersession/conditional consume; protected recipient routing versus current required plaintext column; durable token/message linkage/uniqueness/revisions/revocation; compatibility readers and V1 inventory; actual worker identity and key-purpose IAM; real KMS/hosting/recovery; exact disposable PostgreSQL target plus fixture cleanup; authorized staging SMTP/browser/OAuth regressions; and legal/privacy/counsel decisions for affected processing/retention.

Phase 1I-D remains active and incomplete. D-2 is accepted offline; D-3B implementation/verification is complete within this authorization and awaits owner acceptance. D-4, real D-3 integration, Phase 1I-E and Phase 2 were not begun or completed and are not authorized by this milestone.

**VERDICT: PASS** for the authorized synthetic implementation and verification gates, with the limitations and owner-review disposition above.
