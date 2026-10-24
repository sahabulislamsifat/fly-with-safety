# Phase 1I-D — exact D-2 cryptographic hardening scope

Prepared 2026-10-25 (Asia/Dhaka). **DOCUMENTATION READY FOR OWNER REVIEW — IMPLEMENTATION NOT AUTHORIZED.** D-1 is [owner-accepted for synthetic scope only](PHASE_1I_D_D1_FORMAL_ACCEPTANCE.md). This proposal neither implements D-2 nor changes production ADRs.

## 1. Objective, exact boundaries and baseline

Harden the offline prototype's asynchronous orchestration and test loading while preserving its ciphertext, AAD, fake data, network restrictions and synthetic-only authorization model. Address D1-L04/05 and W1/W2 within the existing nine-file directory. Improve handling of late key material and bounded operation settings; do not claim to close production memory, rollback, IAM, nonce-budget or admission issues.

Exactly **seven existing files** would be edited, all under `server/test/prototypes/passport-crypto/`:

1. contracts.ts
2. passenger-document-crypto.ts
3. passport-crypto.test.ts
4. boundaries.test.ts
5. fixtures.ts
6. vitest.config.ts
7. README.md

**No new file or rename.** envelope-codec.ts and synthetic-kms-adapter.ts remain byte-identical. Production application paths, documents beyond this proposal, manifests, lockfiles, tsconfig, providers and databases are excluded from the requested implementation scope. If actual implementation needs an eighth edit, tenth file, new dependency or format change, stop and request a revised scope first.

Baseline: development at 99d2f60; nine prototype files; fresh D-1 tests 104/104 in two suites and strict no-emit TypeScript pass. The 597-file digest matches the prior acceptance review. No D-2 code/test exists through this task; all new behaviors and checks below are **PROPOSED / NOT RUN**.

## 2. Per-file modification contract

| File | Existing behavior | Required proposed modification / security reason | Compatibility and error cases | New evidence / acceptance | File rollback |
|---|---|---|---|---|---|
| contracts.ts | Policy returns void; provider methods return promises without operation controls | Require Promise<void> authorization; define operation-control/finite-limit types and optional provider control parameter; preserve CryptoEnvelopeV1 and CryptoError codes | Legitimate old void-returning policy implementations must explicitly migrate to async; sync throws are still caught. Existing fake's fewer parameters remain structurally compatible; no abort capability implied | Strict compiler rejects legitimate bare-void policies; runtime rejects bare/non-void fulfillment; existing fake compiles unchanged; no wire-type drift | Restore accepted D-1 file with dependent orchestration/tests together, never a mixed interface set |
| passenger-document-crypto.ts | Synchronous policy call; at most three immediate fake attempts | Await bounded policy exactly once; snapshot inputs; total/per-stage deadlines; sequential settled retries; abort signaling, late result cleanup and expiry checks; no unhandled rejection/plaintext fallback | Constructor's existing three arguments retained; optional fourth limits/clock object proposed. Encrypt/decrypt return contracts and sanitized codes unchanged. Timeout/expired/late results fail closed | Tests R01–R16 plus budget/cleanup cases; zero unwrap after failed authorization; no cross-request DEK cache | Restore with D-1 contracts/tests; no persistence rollback |
| passport-crypto.test.ts | 104-suite coverage shared with boundaries; synchronous policy fixtures and immediate retry assumptions | Add controllable async policies/providers, fake-clock deadline/retry tests, late-key cleanup and malformed-result cases; migrate only assertions required by the explicit async/backoff change | Preserve all original cryptographic/authorization assertions and test-purpose mapping. Original timing assertions use explicit fake-time advancement; no arbitrary count padding | All 20 required groups plus additional race cases below; original 104-case coverage retained/mapped; no skips or weakened assertions | Restore accepted tests with runtime; remove no unrelated tests |
| boundaries.test.ts | Imports guards from config; AST/network/VM evidence for four runtime files | Import guard state from fixtures; assert default/native config isolation and temporal guard-before-import evidence; provide only required safe clock/timer/AbortController globals to VM; retain runtime import restrictions | VM remains instrumentation, never a security sandbox. No new runtime built-in imports required by this design; test harness may use existing Node globals | Runtime remains environment/app/DB independent; both loaders enforce guards; no unauthorized imports; no hanging timers or unsafe listener leaks | Restore together with fixtures/config/runtime |
| fixtures.ts | Imports installOfflineGuards from config; exports synthetic data/grants | Move existing guard implementation and named guard state here; install first at top-level before exporting fixtures; no tested runtime imports; make initialization idempotent for a suite | Contract imports remain type-only. All fixture values stay synthetic. Tests stop importing config, avoiding dual-use config module | Guards installed in setup before runtime imports; all existing network/subprocess blockers remain active and observable | Restore with original config/importers |
| vitest.config.ts | Runtime ESM defineConfig import, default export plus named guards in CommonJS package | Config-only CommonJS module.exports object with type-only annotation, no runtime imports/ESM syntax/named guard exports; retain exact includes, setup, envDir false, no app/global setup and disabled result/coverage output | Same filename/package mode, no manifest/lockfile change; installed Node must support erasable TS. Any unsupported loader result is a blocker, not a reason to silently suppress warnings | Bundled and native-loader standalone runs pass without W1/W2; exact test/root/setup scope preserved | Restore config plus fixtures/importer set |
| README.md | D-1 commands/results and accepted limitations | Record D-2 contract/commands/new actual results, cancellation limits, warning status, original-case mapping and immutable files | Do not relabel proposals as passing tests, or accepted limits as solved production controls | Evidence matches observed outputs and keeps D-1 history/production exclusions | Restore accepted D-1 README with code set |

No dependency installation is proposed. Use installed TypeScript/Vitest and Node built-ins only. No production cipher, grant issuer, SDK adapter, cache, database or HTTP client is added.

## 3. D2-A — explicitly awaited authorization

The following is an interface proposal inside this Markdown document, not implemented TypeScript:

```typescript
interface OperationControl {
  readonly signal: AbortSignal;
  readonly deadlineAtMonotonicMs: number;
}

interface DecryptionAuthorizationPolicy {
  assertAllowed(
    grant: unknown,
    context: EncryptionContext,
    control: OperationControl,
  ): Promise<void>;
}
```

Provider methods retain existing return types; an optional trailing OperationControl parameter is proposed for createAndWrapDataKey and unwrapDataKey. The unchanged fake may ignore it because it has no cancellation implementation. Fewer accepted function parameters do not establish cancellation support. No real-provider contract is certified here.

### Admission and ordering

1. Validate/snapshot/freeze context and primitive synthetic grant fields before any asynchronous boundary. Mutable caller objects are never re-read later. Synthetic grant checks remain actor/role/environment/booking/passenger/purpose/expiry/step-up; they do not become authentic production claims.
2. Snapshot/parse the envelope before awaiting policy so it cannot be switched during the await. To retain denial-first error behavior, keep any sanitized envelope validation failure pending until authorization succeeds; failed authorization still returns FORBIDDEN and performs zero unwrap. Invalid context retains INVALID_INPUT.
3. Invoke policy **exactly once per decrypt**, within its absolute authorization deadline. Legitimate supplied validation is migrated into an async method that preserves the same predicates and fulfills undefined. Do not support accidental fire-and-forget void returns as successful authorization.
4. Require a promise/promise-like result and adopt it through one fully observed settlement path. Bare undefined, booleans, strings, missing/call-throwing then behavior or non-undefined fulfillment is a policy-contract failure -> FORBIDDEN. A thenable is not permission to execute untrusted plugin code: policy instances remain internally supplied synthetic test dependencies. Sync throws and rejected promises are denied and sanitized.
5. Await fulfillment before unwrap. On timeout/rejection/denial/malformed result, close the operation, signal abort and return FORBIDDEN. Do not retry policy, unwrap, or allow late authorization to advance the workflow. Success requires the operation still active and current monotonic time strictly before its deadline, not merely the timeout callback not having fired yet.
6. After authorization, recheck the frozen grant expiry using the configured wall clock immediately before every unwrap attempt. Check again before accepting provider output and before plaintext release. Do not call the policy again to refresh an expired grant. Expiry during an already started provider call cannot undo that call; its result must be discarded/cleared, and no later unwrap attempt may begin.
7. Only after successful authorization, valid envelope and valid grant can key use/decrypt begin. Tag authentication and decoded payload validation still precede return. No plaintext/key/provider error data enters logs.

Grant wall-clock validity and operation monotonic deadlines are separate concepts. Keep synthetic policy and orchestration wall-clock injection consistent in tests; do not compare epoch expiry to performance.now(). Default policy remains synthetic and async; its constructor's test clock can remain compatible.

## 4. D2-B — deadlines, cancellation and sequential retries

### Test-only proposed settings

Retain maxAttempts in constructor position three (allowed integers 1–3). Add an optional fourth settings object. Proposed initial defaults: authorization 250 ms, provider attempt 250 ms, total operation 1500 ms, retry delays 25 ms then 50 ms. These are **offline test defaults**, not production SLOs, measured KMS budgets or legal periods. No jitter or SDK retry behavior is represented as production-ready.

Validate settings as finite safe positive integers, stage budgets <=total, retry delays bounded within total, and total <=5000 ms for this harness. Reject invalid options with INVALID_INPUT before invoking policy/provider. Supply test-only monotonic and wall clock functions; never load them from environment variables. Use controlled fake timers, not real sleeps, for slow/race tests.

Set one absolute operation deadline at entry. Authorization deadline = min(entry+authBudget, totalDeadline). Each provider attempt deadline = min(attemptStart+attemptBudget, totalDeadline). Retry delays count against total. All settling paths must clear their timers/listeners; success at or after the deadline fails closed even if the timer callback is delayed by the event loop.

### State/settlement rules

- Use one operation-local state/token: ACTIVE, then a terminal SUCCEEDED/FAILED/TIMED_OUT. No shared/global request-state cache and no callback may reopen terminal state.
- Each stage/attempt also has a single-settlement guard. A winning key result transfers ownership exactly once to the active cipher; late-result cleanup applies only to a result that was not admitted. Never clear an actively admitted key from a losing timeout/cleanup branch. Test both resolution-before-timeout and timeout-before-resolution interleavings.
- Attach both fulfillment and rejection observers immediately when a policy/provider promise is created/adopted. Observe all late rejection paths; no abandoned race/cleanup branch may produce an unhandled rejection. Cleanup handlers themselves must not throw an unobserved rejection.
- A timeout rejects the exposed workflow and signals AbortController. **Signaling abort is not proof of cancellation.** The fake ignores optional signals; a future provider requires separate real cancellation evidence. A never-settling underlying operation can remain pending in memory despite caller timeout; do not claim otherwise.
- After policy timeout, ignore late fulfillment/denial/rejection for workflow purposes; never unwrap. After provider timeout, do not start any retry, even if abort was requested. This avoids overlapping underlying calls when cancellation is unproved.
- Late provider success containing a DEK must be recognized by its known result shape and cleared best effort before discarding. Never decrypt or return that result. Clear valid operation-owned DEKs in finally on every accepted/error/expiry path. No persistent plaintext cache.
- Retry only an explicitly classified fake transient-unavailable **rejection that has fully settled**, while the total deadline and (for decrypt) grant are still valid. Await the bounded delay before starting the next attempt; no parallel chains or hidden nested SDK retries.
- Do not retry explicit provider denial, integrity failure, malformed provider output, unknown failure, policy failure, grant expiry or any timeout. Malformed fulfilled provider results must be sanitized without unsafe property access or raw exception leakage.
- Encryption also receives bounded provider creation behavior but no new authorization requirement or public cipher format. A creation timeout cannot yield an envelope; a late created DEK must be cleared and discarded.

### Public error compatibility

| Condition | Existing sanitized public code | Retry |
|---|---|---|
| Invalid input/context/settings | INVALID_INPUT | None |
| Policy denied/threw/rejected/timed out/malformed; grant expired | FORBIDDEN | None; zero new unwrap after failure |
| Provider denied | KEY_ACCESS_DENIED | None |
| Content or wrapped-key integrity failure | INTEGRITY_FAILURE | None |
| Provider/total-operation deadline, exhausted transient retries, malformed/unknown provider failure | KEY_UNAVAILABLE | Only already-settled classified transient rejection may retry before exhaustion; never retry timeout |
| Invalid envelope/version | INVALID_ENVELOPE / UNSUPPORTED_VERSION | None |

Internal test classifications may distinguish timeout/abort/late-result counters without exposing raw messages, grant material, payload, key data or URLs. Do not add public error codes or fields unless separately approved. Do not use plaintext fallback.

The [Node AbortController documentation](https://nodejs.org/api/globals.html#class-abortcontroller), checked 2026-10-25, describes signaling supported operations; this proposal deliberately does not equate it with cancellation of arbitrary promises. Actual D-2 deadline behavior remains unimplemented/unverified.

## 5. D2-C — compatibility and unchanged cryptographic formats

Preserve CryptoEnvelopeV1 and AAD byte-for-byte: AES-256-GCM, fresh 32-byte DEK/12-byte nonce, 16-byte tag, fixed ordered namespace/type/version/environment/booking/passenger array, strict allowlists and existing size/date/base64url rules. No revision, timestamp, purpose grant or new key field is inserted into V1 AAD or ciphertext. Preserve no-decrypt-on-tamper, no partial plaintext release and key cleanup.

The fake adapter and codec remain untouched. An optional provider control argument changes orchestration typing, not the fake wire format; old test providers can ignore trailing options but receive no cancellation guarantee. Old envelopes must remain readable with enabled fake historical keys.

Constructor compatibility: keep existing provider/policy/maxAttempts positions; settings are optional. Legitimate synchronous policy success is intentionally migrated to explicit Promise<void>. Existing injected sync throws remain denial. Existing tests that depend on zero-delay transient retries are updated only to advance approved fake timers; no meaningful original assertion is dropped. No automatic adapter accepts bare void success, since that would hide the exact asynchronous contract defect.

If implementation discovers a need to edit envelope-codec.ts or synthetic-kms-adapter.ts, list exact changes and request scope expansion before editing. No new format version is justified by this asynchronous hardening.

## 6. D2-D — rollback/revision protection, design only

Same-context old V1 envelopes remain cryptographically valid. D-2 must keep that limitation visible and its existing test passing. No database field, CAS function, persistence model or live checkpoint client is part of this implementation proposal.

Later design recommendation:

- Define authoritative monotonic content revision and expected prior revision for each passenger document; distinguish a content change from KEK rewrap if separate wrapping revision is needed. Revisions must bind to a canonical envelope digest and opaque record/context identity through trusted metadata; an unbound adjacent counter is inadequate.
- Authorized writes would compare-and-swap expected revision and atomically commit the new envelope/record revision with the same operation's idempotency evidence. Encryption/provider waits stay outside open DB transactions; a conflict must not silently overwrite. Retry generation retains fresh key/nonce semantics and replay compatibility.
- Store or anchor an independent monotonic audit/checkpoint outside the database administrator's rollback domain. A counter and audit/outbox row rolled back together with the same DB are not independent protection.
- Define checkpoint publish/ack semantics, failure/lag policy and read admission explicitly. A DB commit plus an asynchronous checkpoint is not globally atomic; unpublished commits and compromised outbox state remain an exposure until a reviewed protocol closes it. Privileged reads/restores may need to fail closed while reconciliation is incomplete.
- Restores enter quarantine, reconcile independent checkpoints and deletion/hold ledger, prove retained key access, and only then allow privileged release or external effects. Controlled relocation allocates a newly authorized target context and re-encrypts; never silently reuses old AAD under changed IDs.

Offline possibilities in a later separately approved scope: state-model/vector tests for revision ordering, duplicate operations, stale updates, checkpoint lag and restore mismatch. This D-2 scope documents them but implements no revision model. Actual transaction/uniqueness/concurrent writer/restart/restore proof requires separately approved schema/code, exact disposable database and fixture cleanup. No claim that a same-DB CAS alone defeats a privileged DB rollback.

## 7. W1/W2 root cause and exact seven-file remediation

Actual files: vitest.config.ts imports defineConfig with runtime ESM syntax, exports default config and named guard/state helpers; fixtures.ts and both test files import those helpers from config. server/package.json has no type:module. W1 comes from mixed exports in the bundled config entry; W2 comes from ESM syntax in a file detected as CommonJS for native loading. Both warnings were re-observed with passing D-1 tests.

Recommended single remediation within the seven files:

1. Move installOfflineGuards and offlineBoundary into **existing fixtures.ts** with its existing synthetic fixtures. Keep contract imports type-only, and only approved Node built-ins for guard setup. Install guards before exporting fixture values; no tested runtime imports and no app/environment/global setup.
2. Change both tests' helper imports to fixtures.ts. Config is no longer a runtime fixture/helper module.
3. Keep **vitest.config.ts at the same path** as a config-only CommonJS export (module.exports). No runtime import/export syntax and no defineConfig call are necessary. A type-only annotation may use the installed exported `import('vitest/config').ViteUserConfig` type; it is erased at runtime. Do not use TypeScript export-assignment syntax that requires transformation, add a file/rename to .mts, or change package module mode.
4. Retain root, exact two-file include, fixtures setup, envDir false, empty globalSetup, Node/threads isolation, one worker, no watch/result cache/coverage outputs and bounded test hooks. No catch-all test glob or ordinary integration runner.
5. Require both the current bundled loader and explicit native-loader acceptance checks after implementation. The installed Vitest source passes configLoader through to Vite; its CLI help text names bundle/runner, while current Vite docs also describe native. Treat native rejection or loader-specific differences as a failed acceptance gate; do not silently install/upgrade tools or change manifests to bypass it.

This avoids a tenth setup/guard file and package changes. It is a **proposal**, not a tested fix. If same-file CommonJS typing/native loading fails, stop with exact diagnostics and request a revised scope rather than silently renaming or suppressing the warning.

Official docs checked 2026-10-25: [Vite config loading](https://vite.dev/config/) and [Node TypeScript/module detection](https://nodejs.org/api/typescript.html). Current Node type stripping is not a promise that arbitrary TS constructs work natively; use erasable type annotations only. Documentation guidance is not repository interoperability proof.

## 8. Proposed D-2 regression tests — not run

Use fake timers/controlled promises and explicitly injected clocks; no real sleeps, cloud calls or new dependencies. Test names/counters must contain synthetic values only. All existing 104-case coverage is retained; a mapping documents legitimate contract/timing updates, not a fixed numeric target for new cases.

| ID | Required proposed regression / evidence |
|---|---|
| R01 | Asynchronously allowed grant fulfills undefined; decrypt succeeds only after policy settles |
| R02 | Explicit asynchronous denial -> FORBIDDEN; zero unwrap |
| R03 | Rejected policy promise and synchronous policy throw sanitize to FORBIDDEN; zero unwrap |
| R04 | Never-settling policy times out at auth/total bound; zero unwrap |
| R05 | Late policy resolve/reject after timeout cannot reopen workflow; no unhandled rejection |
| R06 | Policy invoked exactly once despite multiple provider retries; no silent grant refresh |
| R07 | Role/purpose/assignment/expiry/step-up and malformed result failures produce zero unwrap; bare void, truthy values and non-void promise fulfillment denied |
| R08 | Provider create and unwrap time out; operation stops, no overlapping retry; late DEKs cleared without encrypt/decrypt |
| R09 | Fully settled transient failures retry sequentially within 1–3 attempts and total budget; delays count against total |
| R10 | No retry on authorization, explicit key denial, integrity, malformed/unknown output or timeout |
| R11 | Late provider/policy rejection, cleanup handlers, abort and timer paths yield no unhandledRejection event; listeners/timers cleaned; no warning suppression |
| R12 | Public errors retain existing codes/correlation only; provider reasons, abort reasons and injected sentinel causes never exposed |
| R13 | No plaintext/token/key/grant logs on success, timeout, abort, retries and late cleanup |
| R14 | Original exact AAD, immutable input snapshots and wrong environment/booking/passenger rejection remain |
| R15 | Ciphertext/tag/nonce/wrapped-key/version tampering still fails without plaintext release |
| R16 | Fake enabled historical key still works and retired key fails; codec/fake hashes remain unchanged |
| R17 | No app/Prisma/SQL/environment/provider/network imports; AST/VM and blocked-call tests retained |
| R18 | Guard activation precedes tested modules under bundled and native loader; exact include/setup/envDir behavior |
| R19 | Standalone explicit-file no-emit TypeScript passes with existing dependencies and same eight TS files |
| R20 | Original 104-case coverage passes with reviewed async/timer-only updates; no skips/weakening; total new case count reported from execution |

Additional required cases within those groups: exact-deadline tie, delayed timer callback, grant expiry during authorization/backoff/provider response, caller mutation during policy wait, late key creation/unwrap after timeout, mismatched/malformed result types, invalid/NaN/infinite/negative limits, repeated execution without lingering timers, and cancellation-aware **test double** acknowledgment versus unchanged fake ignoring signals. Do not claim a timeout test cancels the latter's underlying work.

## 9. Future validation, rollback and acceptance criteria

Future commands from server, **not run for D-2 now**:

```powershell
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck --types node,vitest/globals test/prototypes/passport-crypto/contracts.ts test/prototypes/passport-crypto/envelope-codec.ts test/prototypes/passport-crypto/passenger-document-crypto.ts test/prototypes/passport-crypto/synthetic-kms-adapter.ts test/prototypes/passport-crypto/fixtures.ts test/prototypes/passport-crypto/passport-crypto.test.ts test/prototypes/passport-crypto/boundaries.test.ts test/prototypes/passport-crypto/vitest.config.ts
& .\node_modules\.bin\vitest.cmd run --config test/prototypes/passport-crypto/vitest.config.ts
& .\node_modules\.bin\vitest.cmd run --config test/prototypes/passport-crypto/vitest.config.ts --configLoader native
```

Before any later run, inspect changed imports/setup/config and preserve offline guards. A native-loader run is an explicit new acceptance check after approved changes, not a test already passed on the present D-1 configuration.

D-2 passes only if: exactly the seven approved files changed, with no added or renamed file; codec/fake byte hashes unchanged; all original meaningful assertions retained; R01–R20 and added race cases pass without skips/unhandled rejections; strict no-emit succeeds; both loaders retain exact isolation and warnings are absent because their causes were removed; source/wire/AAD/private error compatibility is proved; no app/DB/provider/secret/package operation occurred. Any remaining failed gate is reported, not waived.

Rollback: preserve the accepted D-1 versions of the seven files before approved editing; restore them together only under the authorized rollback plan and after preserving review evidence. Never revert unrelated dirty files or use git reset/clean/checkout. Re-run the accepted D-1 standalone command after a rollback. There is no data migration or persistent state to reverse, and no authority for deleting files. Accepted D-1 remains an historical milestone; a later D-2 working artifact must be identified separately.

## 10. Dependencies, risks and exact owner request

D-2 requires only explicit owner code-scope authorization, the accepted D-1 artifact and existing local dependencies. Legal verification, cloud billing/accounts, real KMS identity/provider selection and database isolation can remain unresolved because D-2 is fake-only. None of those gaps is closed by D-2.

Production ADR-03/04/06/09/11/12/13/14/15 remain PROPOSED; ADR-05/10 remain BLOCKED. ADR-01/02/07/08 production versions remain PROPOSED. Existing-compatible-hosting first, Cloudflare DNS/security when approved and hybrid after proof remain recommendations; AWS KMS stays provisional. All 14 legal entries remain BLOCKED.

Excluded: production paths/integration/cryptography, real grants/IAM, changes to envelope-codec.ts or synthetic-kms-adapter.ts, ciphertext/AAD version changes, schemas/databases/CAS/persistence/backfill/cleanup/retention, real SDK/keys/cloud/network/email/supplier/payment calls, environment secrets, packages/lockfiles/shared configs, provisioning/billing/domains/deployments, commits/pushes, Phase 1I-E and Phase 2.

**Exact approval request:** approve editing only the seven named existing prototype files for the awaited policy contract, bounded sequential fake operations, expiry/late-result cleanup, same-file config cleanup, corresponding offline regression tests and README evidence described here. Include the two-loader standalone checks and no-emit TypeScript command. Require codec/fake byte preservation and no added files/dependencies/format or production behavior. Any expansion requires separate explicit approval.

No D-2 authorization is inferred from D-1 acceptance. **Stop before D-2 implementation.**
