> **Current owner disposition — 2026-10-25:** **OWNER-ACCEPTED — SYNTHETIC D-1 SCOPE ONLY**, with D1-L01–L08/W1/W2 retained. See [formal acceptance](PHASE_1I_D_D1_FORMAL_ACCEPTANCE.md). [D-2 scope](PHASE_1I_D_D2_CRYPTO_HARDENING_SCOPE.md) is proposed only; implementation and later phases remain unauthorized. Earlier pending-acceptance statements are historical.

# Phase 1I-D — D-1 acceptance and security ADR review

Review date: 2026-10-25 (Asia/Dhaka). Branch `development`, HEAD `99d2f60`.

**PASS WITH DOCUMENTED LIMITATIONS — REQUIRES OWNER REVIEW.** The approved synthetic implementation meets the reviewed D-1 contract and current checks pass. This is an acceptance recommendation, not formal owner acceptance, production architecture approval, or permission to integrate. Phase 1I-D overall is incomplete; Phase 1I-E remains unauthorized.

## 1. Authority, inventory and evidence limits

The owner explicitly approved M01 for ADR-01/02/07/08 only within the offline synthetic contract and authorized M02/D-1 implementation and checks. The current request authorizes review and documentation refinement; it does not authorize code corrections. The Downloads M01/M02 handoff and [approval packet §7](PHASE_1I_D_ARCHITECTURE_APPROVAL_DECISION_PACKET.md) define the nine-file scope. All other ADRs retain production approval gates. Formal acceptance of completed D-1 is still pending.

Reviewed all nine files in `server/test/prototypes/passport-crypto/`: contracts.ts, envelope-codec.ts, passenger-document-crypto.ts, synthetic-kms-adapter.ts, fixtures.ts, passport-crypto.test.ts, boundaries.test.ts, vitest.config.ts and README.md. No unauthorized file exists in that directory. The seven authoritative Phase1I-D documents listed in the current handoff exist and were used; this report is the additional acceptance artifact.

Entry status: the main design was modified; six other Phase1I-D reports and the prototype directory were untracked. HEAD and visible change scope match the preceding reported development baseline. No application or prototype edits were made in this review. Nine prototype SHA-256 hashes and a 597-file baseline (tracked files outside proposals plus all nine prototype files) were captured before documentation changes. This establishes current-session preservation; the preceding session's 623-file statement is historical evidence, not a new 623-file test claim.

This is a fresh source-and-test review in the same agent workflow, not an external independent security certification. No application/database, deployed hosting, real KMS, SMTP or supplier behavior was exercised.

## 2. Current verification and exact commands

Preflight: inspected standalone configuration, fixture setup, every import and production references. Static import scan found 9 files, 42 import declarations, zero unexpected dependencies. Focused searches found no prototype imports/references in `server/src`, `client/src` or `client/app`. No application bootstrap or database client is loaded by the standalone suites.

Executed from `E:\Programming\Project\fly-with-safety\server`:

```powershell
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck --types node,vitest/globals test/prototypes/passport-crypto/contracts.ts test/prototypes/passport-crypto/envelope-codec.ts test/prototypes/passport-crypto/passenger-document-crypto.ts test/prototypes/passport-crypto/synthetic-kms-adapter.ts test/prototypes/passport-crypto/fixtures.ts test/prototypes/passport-crypto/passport-crypto.test.ts test/prototypes/passport-crypto/boundaries.test.ts test/prototypes/passport-crypto/vitest.config.ts
& .\node_modules\.bin\vitest.cmd run --config test/prototypes/passport-crypto/vitest.config.ts
```

| Check | Current result |
|---|---|
| Standalone TypeScript | PASS: exit 0, no diagnostics; no emit or shared config changes |
| Standalone Vitest 5.0.3 | PASS: 2 files, 104 tests, zero failed/skipped; reported duration 1.78 seconds |
| Local Node | v26.9.0, directly checked; not a production runtime selection |
| Import/environment boundaries | PASS within reviewed harness: exact local imports, envDir false, fixture setup precedes tested modules, VM runtime path reads no process/environment and emits no logs |
| Network/subprocess boundaries | PASS: deliberate fetch/TCP/TLS/HTTP(S)/DNS/UDP/subprocess calls throw before dispatch; labels only recorded |
| Application/backend/database/provider suites | NOT RUN: outside current review authorization; historical counts remain historical |
| Git/preservation/document consistency | Final static evidence is recorded in §10 |

All 17 required groups are represented in the current passing suite:

| Group | Evidence / disposition |
|---|---|
| 01 Round trip | Grouped synthetic values, serialized envelope, absent fields; PASS |
| 02 Ciphertext | Modified, truncated and extended content rejected; PASS |
| 03 Tag | Full-tag tamper and invalid lengths; PASS |
| 04 AAD | Exact fixed-order UTF-8 vector, invalid IDs, snapshot; PASS |
| 05 Binding | Wrong environment/booking/passenger, independently of fake wrap; PASS |
| 06 Authorization | Role/actor/assignment/purpose/expiry/step-up denial, zero unwrap calls; PASS |
| 07 Outage | Creation/unwrap attempt caps, transient recovery; PASS |
| 08 Provider denial | Sanitized failure without retry; PASS |
| 09 Allowlists | Version/algorithm/provider/key reference and wrapped-key tamper; PASS |
| 10 Freshness | DEK/nonce sizes and samples, broken-provider freshness oracle, nonce substitution; PASS |
| 11 Validation | Calendar dates, UTF-8 size limits, JSON/base64url, unknown/accessor fields; PASS |
| 12 Logs | Console spies report no runtime output with synthetic sentinels; PASS |
| 13 Errors | No external message/code/cause material exposed; PASS |
| 14 Isolation | AST/import checks, blocked calls, VM with forbidden environment/app loader; PASS |
| 15 Lifetime | Invalid DEKs and operation-buffer cleanup success/error; PASS |
| 16 Historic keys | Fake old-version decrypt before retirement, failure after; PASS |
| 17 Rollback | Old valid same-context envelope remains decryptable; PASS as an explicitly demonstrated limitation |

No coverage percentage, fuzzing proof, OS-level network sandbox, third-party cryptographic audit or real-provider test is claimed.

## 3. Cryptographic findings and acceptance limitations

Established Node crypto primitives are used: randomBytes, createCipheriv/createDecipheriv and AES-256-GCM; no custom block cipher, MAC or random generator. `passenger-document-crypto.ts:49–69` generates a fresh 12-byte nonce and uses the fake provider's fresh 32-byte DEK per write; the 16-byte tag is fixed. `:72–95` checks authorization before unwrap, binds AAD, waits for final authentication, validates decoded payload, and clears owned buffers in finally. This follows [Node's documented authentication ordering](https://nodejs.org/api/crypto.html#deciphersetauthtagbuffer-encoding), checked 2026-10-25.

`envelope-codec.ts:6–119` snapshots own data descriptors, restricts IDs to ASCII, rejects unknown fields/accessors, validates dates and canonical base64url, enforces 4 KiB plaintext / 16 KiB encoded envelopes, and restricts metadata. Exact AAD is `["FlyWithSafe","passenger-document","1",environmentId,bookingId,passengerId]`. Mutable status/email/owner and wrapping-key aliases are excluded. Inputs are copied before awaits. No plaintext fallback exists.

`synthetic-kms-adapter.ts:7–64` keeps only ephemeral wrapping KEKs, not a DEK cache. Wrapped DEKs authenticate opaque bytes, context and fake version; wrong context/key/tampering fails. Both content and key wrapping use GCM with random nonces. Approved synthetic data and identities are fixtures, not production records.

No acceptance-blocking defect was identified in the supplied synchronous synthetic policy/fake-provider execution path. These limitations require explicit owner disposition:

| Finding | Severity / applicability | Evidence and required treatment |
|---|---|---|
| D1-L01 Memory lifetime | Medium; accepted prototype limitation | Buffer fill checks do not prove removal of JS strings, GC/native copies or process dumps. No complete zeroization claim; future production dump/telemetry/lifetime controls required. |
| D1-L02 Same-context rollback | High if production relied on AEAD alone | Group17 demonstrates valid old ciphertext replay. Future revision/CAS plus independent audit/restore policy required; DB-admin rollback is not solved solely by a revision stored in the same DB. |
| D1-L03 Synthetic grants | High if reused as production authorization | grants are caller-constructible test objects with no trusted issuer. ADMIN/CUSTOMER are denied in tests, but only a real grant/ownership service can authenticate an operator. Never wire this policy directly to browser claims. |
| D1-L04 Synchronous policy extension | Medium, future interface hardening | `contracts.ts:54–56` declares assertAllowed returning void; decrypt calls it synchronously at passenger-document-crypto.ts:75. The current policy is synchronous. An injected asynchronous checker would require an explicitly awaited contract and regression tests; arbitrary async adapters are not validated by D-1. No such correction executed. |
| D1-L05 KMS timing/fidelity | High for production readiness | Maximum three immediate fake attempts is not a timeout, jitter/backoff, abort or real IAM/SDK test. Unknown failures sanitize safely, but a hanging future provider is not handled by the fake contract. D-4 evidence remains mandatory. |
| D1-L06 Nonces/key use | Medium, future operational limits | One content encryption per fresh DEK avoids repeated content-key use by design. Repeated fake wrapping under one KEK has the usual random 96-bit nonce birthday risk, approximately q(q-1)/2^97 for q wraps; samples do not prove uniqueness. Set provider-/algorithm-specific use budgets before production; no statutory or universal count is adopted. |
| D1-L07 Harness boundary | Medium, scoped evidence limit | Patches and AST allowlists protect the reviewed code path, not arbitrary hostile native dependencies. The VM is instrumentation, not a security sandbox; [Node explicitly warns against that interpretation](https://nodejs.org/api/vm.html). No .env credential values were read by the reviewed runtime path. |
| D1-L08 Validation resource budgets | Low in offline scope; future hardening | Output sizes are checked; HTTP body limits, streaming/backpressure, adversarial object resource costs and duplicate-envelope-key policy are not production admission controls here. Decide and test before integration. |

Warnings actually re-observed:

- **W1 MIXED_EXPORTS: harmless for current installed bundled execution; actionable maintenance.** The config exports default configuration and named guard helpers used by setup. Both suites loaded correctly. No suppression or exports rewrite performed.
- **W2 native-loader CommonJS/ESM warning: actionable before a loader/toolchain upgrade.** The current bundle loader succeeds, but a future native-loader default could reject this TypeScript config in the CommonJS package. No manifest/module-mode change or tenth file is authorized. A future config correction must test guard ordering and preserve the exact scope or request a changed scope.

D-2 correction/hardening proposal: only after separate approval, review contracts.ts, passenger-document-crypto.ts and passport-crypto.test.ts for an awaited policy/provider deadline contract; boundaries.test.ts, fixtures.ts and vitest.config.ts for compatible loader/guard separation; README.md for evidence. No correction is required to claim the present bounded synchronous synthetic suite passed. Renames/additional files/manifests require explicit scope revision. Owner acceptance must not imply acceptance of these interfaces for production.

## 4. Current ADR resolution matrix

This current matrix supersedes historical readiness statements, without erasing prior research. **Every broader production ADR remains PROPOSED or BLOCKED.** Four bounded D-1 contracts have explicit M01 approval and executed evidence; that does not approve their production equivalents. No other decision was promoted to APPROVED.

| ADR | Current recommendation / alternatives | Owner and evidence | Approval / next gate |
|---|---|---|---|
| ADR-01 | Grouped bundle for D-1; retain per-field alternative for independently required lifecycle | Security/backend/product; groups01/10, design R2 | D-1 ONLY APPROVED; production PROPOSED, field/retention decision required |
| ADR-02 | Canonical immutable context; controlled relocation, no mutable PII/status in AAD | Backend/security; groups04/05 | D-1 ONLY APPROVED; production PROPOSED, real ID allocation/migration proof |
| ADR-03 | Encrypt reusable auth delivery secrets under separate purpose/key; no fresh token per retry; see §5 | Auth/reliability/security; actual issuance/outbox source | PROPOSED design refined; execution BLOCKED on owner/security lifecycle/schema/identity review |
| ADR-04 | Additive envelope-aware rollout and rollback; alternative big-bang rejected for risk | DBA/backend; design §10 and source plaintext model | PROPOSED; owner approval, exact schema/DB/backfill gates |
| ADR-05 | Durations TBD, holds, restore suppression; no invented schedule | Counsel/privacy/DBA; L-01–14 | BLOCKED; legal/counsel and owner policy |
| ADR-06 | Distinguish rotate/rewrap/content re-encrypt; retain historical resources | Security/operations; KMS report | PROPOSED; provider runbook, ownership, budget/recovery approval |
| ADR-07 | No cross-request plaintext DEK cache; caching alternative needs a new threat model | Backend/security; groups15/16 | D-1 ONLY APPROVED; production PROPOSED, latency/cost proof |
| ADR-08 | Separate privileged identity + authenticated grant, not role alone | Security/infra/backend; group06; D1-L03/04 | D-1 ONLY APPROVED; production PROPOSED, grant issuer/IAM/step-up/audit admission |
| ADR-09 | Quarantined restore, deletion-ledger replay, dual-controlled break-glass | DBA/ops/security; design + D1-L02 | PROPOSED; actual backups, RPO/RTO, ledger trust and restore proof |
| ADR-10 | Minimal contractual supplier fields through privileged orchestration | Supplier lead/product/counsel; no contract evidence | BLOCKED; legal/contract/country/operational sign-off |
| ADR-11 | C first if actual hosts qualify; B after frontend proof; defer A | Owner/infra/frontend; Cloudflare report + §7 | PROPOSED direction; final selection BLOCKED on actual hosting/runtime/browser/cost evidence |
| ADR-12 | Match KMS to backend native short-lived identity; AWS provisional, GCP/Azure viable | Owner/infra/security/finance; KMS report + §7 | PROPOSED options; final choice BLOCKED on topology/identity/region/budget/recovery |
| ADR-13 | No sensitive Hyperdrive read caching initially | DBA/reliability; F06 source, CF report | PROPOSED; owner approval and exact pool/transaction/freshness tests |
| ADR-14 | Versioned HMAC payload comparator with legacy replay dispatch; keep principal unchanged initially | Reliability/security; idempotency.service.ts + §6 | PROPOSED design refined; execution BLOCKED on canonicalization/key/reader rollout approval |
| ADR-15 | Keep compatible Node backend initially; Workers alternative requires proof | Infra/backend; actual bootstrap/dependencies + CF report | PROPOSED; supported pinned runtime and reproducible build approval |

Proposed approval wording for still-unapproved bounded principles (each must be explicitly selected): “I approve ADR-[04/06/09/13/15] as the principle described in this review, with its listed residual risks and later proof gates. This authorizes no code, cloud or database operation.” For ADR-03/14: “I approve the versioned proposal for detailed design/test planning only; authorize implementation separately by exact files and exclusions.” For ADR-11/12, do not request final selection before the listed evidence is available. All wording is a request/template, not recorded approval.

## 5. ADR-03 — notification/authentication secret proposal

### Actual source findings and threat model

`auth.service.ts:55–70,183–203` creates hashed verification/reset token records, then invokes notification enqueue separately. `notification.service.ts:287–319` passes raw token-bearing URLs in params; `outbox.service.ts:112–115` persists those params. Outbox wrappers permit a dbClient, but these auth calls do not pass a shared transaction. Non-transactional fallback at outbox.service.ts:143–155 can send directly. Therefore atomic token-plus-message persistence is a **future requirement**, not a current guarantee.

`auth.service.ts:152–169,206–220` looks up an unused token, then updates by ID in a later transaction. Conditional single-use consumption under concurrent redemption needs targeted design/testing; the current source inspection is not evidence of a compare-and-set consumption lock. Existing Google OAuth state is separate: middleware/oauth-state.ts verifies the signed browser binding and uses a unique consumed marker. It must not be swept into email-token or generic inquiry-digest migration.

Threats: read-only DB/backup/support access exposes reusable mail credentials; row/recipient swaps, logs/provider errors and exported dead letters leak them; crashes can leave token without mail; retries can mint excess valid credentials; redrive can revive used/expired material; stale workers can acknowledge work they no longer own. Process compromise during authorized decrypt/send remains a residual risk. SMTP acceptance/acknowledgment ambiguity prevents a blanket exactly-once mail promise.

### Recommended versioned design — not implemented

1. Preallocate opaque message/token IDs; generate one credential per deliberate issuance. Persist only its verification hash in the token table. Encrypt the minimal delivery secret before opening the DB transaction, under an independent auth-delivery purpose/key. Passenger decrypt identity and notification identity remain separate.
2. Proposed auth-delivery payload V2: templateVersion, purpose, tokenRecordId, opaque userId, exact original recipient, issuedAt/expiresAt and raw token, encrypted together. Outbox stores envelope plus non-secret routing references, never a raw URL/token. AAD binds environment/domain/message ID/token ID/purpose/version; provider context contains no PII. Worker compares authenticated recipient against row recipient and current applicable account identity before sending. Changed email/recipient invalidates the message; do not silently retarget it.
3. In one transaction revoke superseded credentials where applicable, create the hashed token and corresponding V2 outbox row with stable idempotency key derived from purpose/tokenRecordId. Account creation must be included if the chosen registration contract requires all-or-nothing semantics. Resolve this explicitly. No plaintext send fallback for secret-bearing messages on DB/encryption failure or disabled/missing outbox infrastructure; preserve existing ordinary-notification fallback only where separately appropriate.
4. Worker claims using current lease/version fencing. After admission, validate template and token purpose/identity/expiry/revocation/used state; decrypt only with auth-worker identity; build URL from an allowlisted configured frontend origin, not an input endpoint. No arbitrary stored HTML/URL destinations. No passport keys or documents in this flow.
5. Retry the same credential and message identity only while still valid. Do not issue a new token during retry/redrive. Expired/revoked/used messages terminate using current FAILED status and a sanitized reason code, never DELIVERED. Suppression retains F04 truthfulness. A fresh credential requires a deliberate authenticated/rate-limited issuance operation.
6. Keep transport outside database transactions. A token can become consumed after pre-send validation; the sent link may then be unusable. At redemption enforce atomic usedAt/expiry/purpose checks with the credential's side effects in one transaction. Do not claim the send/consume race is eliminated by an outbox lease.
7. Preserve acknowledgment CAS ownership AND expiry checks, monotonically advancing updatedAt and retry/max-attempt/redrive semantics. Redrive must also reject obsolete auth material before making it eligible. Recheck before actual send. Provider idempotency may reduce duplicates if supported; SMTP ambiguous acceptance still permits duplicates.
8. Logs/audit/dead letters contain opaque IDs, template version and result codes only; no decrypted material, recipient body, raw provider exception, token query string or arbitrary status reason. Replace free-text status reasons with approved codes/customer-safe allowlisted text; existing HTML escaping is not data minimization.
9. Roll out readers before V2 secret writers. V1 raw-URL jobs require a private approved inventory and explicit bounded compatibility disposition; no automatic production cleanup, no indefinite fallback from corrupt V2 to V1 plaintext. A rollback binary after V2 writes must understand V2 and preserve worker fencing. Payload versions can use existing JSON; token/outbox linkage/constraints may still need a separately reviewed additive schema change. No schema sufficiency claim yet.
10. Ciphertext, backups, tombstones and auth-delivery audit retention require an approved schedule. Credential expiry is not itself a legal deletion authorization. Destruction of a shared KEK is not per-message erasure; retained versions and restore quarantine remain required.

### Crash/retry and acceptance matrix

| Condition | Required outcome / proposed test |
|---|---|
| KMS/preparation fails before transaction | No secret persistence or email; safe generic auth response contract reviewed |
| Token or outbox write fails | Transaction rolls back both; no secret-class direct SMTP fallback |
| Commit succeeds, request/worker crashes | Exactly one durable issuance/message identity recovered; retry never mints token |
| Repeated/concurrent issuance | Reviewed supersession semantics; no unintended parallel valid credentials; rate limits preserved |
| Concurrent redemption | Atomic single-use transition plus account/password/session effects; one intended successful consumption |
| Expired/consumed/revoked/redriven row | No credential reactivation; terminal sanitized failure, deliberate new issuance only |
| Recipient/template/context/key swap | Integrity/policy rejection before transport |
| Worker loses lease or exceeds expiry | Cannot acknowledge under stale version; transport ambiguity explicitly reconciled |
| Disabled mail / missing config / provider failure | No false DELIVERED; existing retry/terminal distinctions remain truthful |
| Provider accepted, crash before ack | Safe duplicate/reconciliation behavior documented; no exactly-once claim |
| OAuth callback/consumer marker | Existing browser binding and durable uniqueness preserved; no mail-key/digest coupling |
| Legacy V1 / V2 / missing old key / restore | Version dispatch, no plaintext fallback, envelope-aware rollback, no expired-secret revival |
| Logs/errors/support exports | Sentinel credentials/URLs absent across retries, failures and redrive |

Tests are proposals only; no authentication/outbox code or database tests were executed in this review. Owner/security must approve issuance atomicity, consume CAS, legacy handling and precise files before implementation.

## 6. ADR-14 — migration-safe idempotency digest proposal

Current service: idempotency.service.ts:26–47 recursively sorts keys using localeCompare, then hashes JSON with SHA-256. :49–55 derives guest principal from normalized email using unkeyed SHA-256. :70–87 atomically commits the resource and unique operation/principal/key record; :94–119 recovers a winner after P2002, compares payload hashes and fetches its record. schema.prisma:130–142 uses String payloadHash and durable composite uniqueness. Booking create supplies logical request payload before any future randomized encryption (booking.service.ts:16–18,66–78).

Recommendation: versioned HMAC-SHA-256 over a canonical logical request plus domain/environment/operation/stable principal/idempotency key. HMAC key is independent from passenger DEKs, wrapping KEKs, JWT/OAuth secrets and auth-delivery encryption. Never hash randomized ciphertext for replay equality. Canonicalization is part of the version: preserve legacy serializer exactly for old rows; specify UTF-8/field/array/null/omission/date/ordering rules with test vectors for new rows. Locale-dependent sorting must not silently change an existing version.

Proposed payloadHash encoding uses the existing String field, for example a strictly parsed version/key-ID/digest prefix for V2 and legacy 64-hex SHA-256 detection for V1. Exact grammar/length/algorithm allowlist must be approved. This may avoid a new column, but schema/data-target validation and deployment review are still required before claiming no migration is needed.

Safe sequence:

1. Deploy readers that dispatch on the **stored** digest version/key ID while keeping legacy writes. Keep existing principal and unique tuple unchanged; never add a fresh principal/key namespace merely because the digest version changes.
2. Once every live and rollback-compatible reader understands V2, separately authorize V2 writes behind a flag. Compute the new logical digest before encryption, obtain key material/service results outside a transaction, and commit resource plus digest record atomically as today.
3. On a unique race, recover the persisted winner and compare using that row's version/key. V1/V2 contenders must converge on the same original resource or conflict; version skew must not create a duplicate or treat storage/key failure as absence.
4. Legacy replay verifies against the original V1 algorithm. A V2 digest cannot be reconstructed from a V1 hash alone. Do not replace it with HMAC(oldHash) and claim the original payload was authenticated. Optional lazy upgrade requires a verified replay payload and separately approved CAS update matching the old digest and row identity; bulk backfill is not authorized.
5. Retain historical HMAC keys/version routing for the approved idempotency evidence lifetime and relevant backups. Missing/disabled/unknown key/version fails closed with a sanitized availability/conflict-independent result; never silently accept a payload or create another resource. No secret-bearing digest values in logs.
6. Digest writes can be disabled on rollback, but an old binary unable to verify V2 cannot be used once V2 records exist. Preserve V2-capable readers and historical keys. No deletion/expiry of uniqueness evidence without a reviewed lifecycle policy.

Guest principal SHA-256(email) remains a separate unresolved privacy exposure if principals are left unchanged. A future opaque/HMAC principal change needs durable alias mapping and concurrency/uniqueness migration proof; changing only the string would permit duplicate creation. Do not present payload HMAC as eliminating all guest equality leakage. OAuth's oauth:google:consume operation is not routed through createIdempotentInquiry and must remain explicitly excluded unless separately reviewed.

Proposed tests: frozen V1 vectors; insertion order/arrays/null/omissions/normalized inputs; canonical V2 vectors; cross-caller isolation; stored-version replay/conflict; V1/V2 simultaneous winners; transaction rollback; unavailable/rotated HMAC key; unknown prefix rejection; verified lazy-upgrade CAS races; restart/multi-process recovery; unchanged OAuth marker behavior; no raw payload/hash/key logs. Offline mocks first. Any persistent verification needs separately approved disposable target and exact cleanup. No implementation or backfill occurred.

## 7. Hosting and KMS decision closure limits

ADR-11 documentation recommendation is resolved to **C-first, B after proof**, conditional on actual hosts being fit; A remains deferred. This resolves a proposed direction, not final hosting approval. Next16/React19 frontend adapters, Node Express bootstrap, PrismaPg connection behavior, Passport cookies/origins/state, SMTP and scheduling still need exact runtime/deployed-domain evidence. Cloudflare Pages static export does not provide the whole application's required server behavior as-is. Workers Node HTTP adaptation and vinext/OpenNext are options, not evidence that dependencies work unchanged.

Current public [Next/vinext guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) and [Node HTTP adapter](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/) were rechecked 2026-10-25. vinext remains beta; no compatibility/deployment command was run. Actual account regions, costs, WAF/cache/TLS configuration and workload identity remain unknown. Start with no caching for private APIs and sensitive/stateful DB reads; preserve F01/F02/F03/F05/F06 checks under any migration.

ADR-12 remains **PROPOSED / final selection BLOCKED**. AWS GenerateDataKey/Decrypt is a candidate with AWS-native short-lived identity; GCP app-generated DEK plus Encrypt/Decrypt and service identity is viable; Azure Key Vault wrap/unwrap with managed identity is viable. Managed HSM is a distinct operational/cost choice, not an automatic requirement. Provider operations are not interchangeable with the fake format. Current official API references were checked; no resource, key, identity, quota or billing API was called.

Required decision evidence: actual API/decrypt/worker host -> supported runtime/SDK -> native identity or proven issuer/audience/subject federation -> API/DB/KMS/backup/log/supplier region map -> legal location review -> API-specific IAM and key/version allowlists -> granted quota, p95/p99 latency and cost forecast -> recovery/audit/on-call and owner approval. CF secrets or CI OIDC do not by themselves prove runtime federation. No provider, region or numeric budget is selected. Prior pricing stays a dated worksheet; no new quote is asserted.

Official sources checked 2026-10-25: [AWS GenerateDataKey](https://docs.aws.amazon.com/kms/latest/APIReference/API_GenerateDataKey.html), [GCP envelope encryption](https://docs.cloud.google.com/kms/docs/envelope-encryption), [Azure key types](https://learn.microsoft.com/en-us/azure/key-vault/keys/about-keys). Existing KMS report retains quota/rotation/identity/pricing references and all open closure requirements.

## 8. Independently approvable implementation packages — not executed

These new D-2–D-6 labels are proposal packages from the current handoff, **not renumbering of earlier roadmap stages D2–D5**. Each needs a fresh exact code/data/provider scope. Proposed paths below are candidates, not created files or authorization.

| Package | Exact bounded proposal / candidate affected files | Dependencies / risk | Validation and rollback | Required approval / exclusions |
|---|---|---|---|---|
| D-2 Crypto hardening | Awaited authorization/deadline/interface design, admission budgets and config warning disposition; prototype contracts.ts, passenger-document-crypto.ts, passport-crypto.test.ts, boundaries.test.ts, vitest.config.ts, fixtures.ts, README.md; production interface/revision proposal in existing design | D-1 owner disposition; security review; medium in isolated harness | Offline regression, strict no-emit, deny-before-unwrap/timeout/no-output checks, unchanged dependency scope; retain prior nine-file snapshot if reverting | Explicit correction file/behavior approval; any rename/tenth file/manifest separate. No app integration, DB, KMS, provider adapters |
| D-3 Notification secrets | §5 design/tests, then separately approved implementation in auth.service.ts, notification.service.ts, outbox.service.ts; proposed auth-delivery codec module and auth-secret tests; existing notification-delivery/outbox/lease/oauth regressions | ADR-03, token/consume/legacy/identity decisions; high | Offline fake-transport/DB transaction tests first; later exact disposable integration separately approved; V2-aware rollback reader, write flag off | Separate design and code scopes; schema/real keys/SMTP/cleanup not implicit. No password/token record rewrites now |
| D-4 Real KMS readiness | Provider decision and IAM/runbook docs; future approved adapter path under server/src/security, exact one chosen SDK only after dependency approval | M03–06/12/17; ADR-11/12; high | Fake adapter contracts first, then separately approved synthetic staging identity/denial/throttle/old-key/restore/latency proof; disable crypto feature while retaining historical access | Resource/account/key/identity/billing approval distinct from code/dependency approval. No real provisioning/deploy under this proposal |
| D-5 DB encryption integration | Future server/src/security/passenger-document service/policy/codec; booking.service.ts, booking-dto.ts, booking validation and scoped regressions; proposed additive schema.prisma/migration design; include separately reviewed ADR-14 comparator design in idempotency.service.ts only if expressly authorized | D-2/D-4, trusted grants, masks/IDs/CAS, ADR-04/08/14; high | Offline mocks/typechecks/DTO/replay tests; exact approved disposable DB later for atomicity/concurrency/history; envelope-aware rollback, no corrupt-ciphertext plaintext fallback | Exact production-code scope and separate schema/DB targets; no migration execution/backfill/retention/live supplier operations implied |
| D-6 Migration/lifecycle | Review SQL/backfill/dry-run plan, versioned batch checkpoints and restore/holds/deletion ledger proposal in docs/proposals; future script paths must be enumerated before approval | D-5 proof, preservation inventory, legal-approved schedule for deletion/transfer; critical | Read-only counts/proposal first; then separately approved bounded CAS batches and exact-record checks; encrypted-aware readers and recovery snapshots; irreversible removal not promised reversible | Each migration/backfill/clear/drop/deletion/cleanup independently authorized with exact target. No automatic operations or shared-key destruction |

ADR-14 should be a separately selected sub-scope within D-5 or its own approved task; it is not silently bundled into booking encryption. No production files, schemas, scripts or dependencies in this table were changed.

Candidate path register for later exact-scope review (not authorization):

- D-2: the seven named files in the table are all beneath `server/test/prototypes/passport-crypto/`; no new file is currently proposed. Production interface/CAS discussion edits the existing main design only.
- D-3: `server/src/services/auth.service.ts`, `server/src/services/notification.service.ts`, `server/src/services/outbox.service.ts`; proposed new `server/src/security/auth-delivery.ts` and `server/test/auth-delivery-secrets.test.ts`; existing `server/test/notification-delivery.test.ts`, `server/test/notification-outbox.test.ts`, `server/test/outbox-lease.test.ts`, `server/test/oauth-state.test.ts`. No schema change implicitly included.
- D-4: readiness/runbook changes in the existing KMS report first; proposed `server/src/security/kms-key-provider.ts` and `server/test/kms-key-provider.test.ts` only after selecting one provider. SDK/package.json/lockfile changes require a separately enumerated dependency scope; no package choice is approved yet.
- D-5: proposed `server/src/security/passenger-document.service.ts`, `server/src/security/passenger-document.policy.ts`, `server/src/security/passenger-document.codec.ts`, `server/test/passenger-document-privacy.test.ts`; existing booking service/DTO/validator, booking-privacy/lifecycle/idempotency regressions, and an additive schema/migration proposal. If selected, ADR-14 separately affects `server/src/services/idempotency.service.ts` and its replay regressions. Final migration directory name and exact SQL must be reviewed before any authorization to execute.
- D-6: proposed `docs/proposals/PHASE_1I_D_MIGRATION_DATA_LIFECYCLE_PLAN.md` first; potential `server/scripts/backfill-passenger-documents.ts` and `server/scripts/verify-passenger-envelopes.ts` require their own code scope and exact-target run authorization. No retention/deletion script is proposed for execution before legal clearance. Each artifact must be checked for path collisions before creation.

## 9. Manual actions, legal status and phase gates

| Action | Current disposition / next owner step |
|---|---|
| M01 | APPROVED only for D-1 contracts ADR-01/02/07/08; owner must not be recorded as approving broader production designs |
| M02 | Authorized and executed; fresh checks pass; completed-deliverable acceptance still requires owner disposition of this review |
| M03 | KMS selection pending infrastructure/security/finance evidence |
| M04 | Owner hosting direction/topology confirmation pending; C-first/B-later recommendation unchanged |
| M05 | Region/data-flow decisions pending infra/counsel |
| M06 | Runtime identity/federation proof pending infra/security |
| M07 | Counsel/primary-source authentication pending; can proceed in parallel |
| M08 | Retention/holds/transfer schedule remains blocked |
| M09 | Cloudflare/domain setup unapproved; no account/purchase/configuration action |
| M10 | Real KMS setup unapproved |
| M11 | Secret provisioning unapproved; no credentials requested |
| M12 | Budget/billing approval pending |
| M13 | Additive schema execution requires exact reviewed SQL/target and separate approval |
| M14 | Backfill/plaintext removal separately gated after preservation/reader proof |
| M15 | Phase 1I-E entry unapproved; current review does not initiate it |
| M16 | Supplier necessity/contracts/country map pending; all real flight/hotel inventory/reservations remain external |
| M17 | Audit/restore/on-call/RPO/RTO approval and synthetic rehearsal pending |
| M18 | Email infrastructure/browser interoperability unverified; no live mail tests |

All 14 legal rows L-01–L-14 remain **BLOCKED**, with zero fully independently verified or formally approved entries. Their subjects remain application/commencement, classification, basis, children, security, rights, retention, processing records, breach, planning, transfer, authoritative text, accounting distinction and supplier/hosting foreign scope. Historical PARTIAL leads do not close a row. No legal text/period/commencement/transfer rule was adopted or altered. All operational retention durations remain TBD pending authoritative verification and qualified Bangladesh counsel review.

Phase 1I-D documentation is consolidated for review; D-1 verification is complete with limitations and owner acceptance pending. Broad production architecture, other implementation packages, real infrastructure, database/data lifecycle and legal-dependent production remain open. Therefore **Phase 1I-D COMPLETE is not attained**.

Phase 1I-E entry is **BLOCKED pending explicit task authorization and applicable entry gates**: select the precise phase scope, approve its prerequisite technical decisions/code, designate disposable/staging targets separately, specify provider/email/network scope and synthetic fixtures/cleanup, and retain legal restrictions on any real-data operation. Historical 16 live database passes do not verify encryption integration or F06 performance after future changes. F07 DTO/access/logging, F06 ownership/count/order/query plans, F01/F03/F05 durability and KMS failure/restore behavior need the appropriate later checks. No I-E execution now.

Recommended next owner wording: “I accept the D-1 synthetic milestone with D1-L01–L08 and W1/W2 documented, without production approval. Separately, I authorize only [selected D-2 exact files/behaviors/checks] from this report.” Acceptance and correction scope must be distinct; no acceptance or new authorization is presumed.

## 10. Final preservation and safety record

Documentation-only changes: seven existing authoritative reports gain explicit dated current-status/navigation and refinement annexes; this report is new. Prior content is retained as historical review evidence rather than deleted or silently made authoritative over current scoped approval. Final static checks below verify preservation, legal rows and links. No D-1 file, application file, manifest, lockfile, schema or migration changed.

Network activity was limited to public official documentation research; this was not KMS/provider account activity. Standalone test calls intentionally hit local guard functions and made no external requests through the reviewed paths. No database access, customer records, production keys/credentials, SMTP, supplier/payment operations, cloud provisioning, billing, domain purchase, deployments, commits or pushes occurred. Only ephemeral fake test keys were generated by the authorized rerun.

| Documentation file | Current-review change |
|---|---|
| [Main design](PHASE_1I_D_PASSPORT_ENCRYPTION_RETENTION_DESIGN.md) | Current-status banner and R3 scope, acceptance, secret/digest and legal-boundary annex |
| [Architecture review](PHASE_1I_D_ARCHITECTURE_REVIEW.md) | Current-status banner and current 15-ADR table distinguishing D-1 contracts from production approval |
| [KMS gaps](PHASE_1I_D_KMS_INFRASTRUCTURE_GAPS.md) | Fake-only evidence, retained infrastructure/key-domain/recovery dependencies |
| [Cloudflare assessment](PHASE_1I_D_CLOUDFLARE_COMPATIBILITY.md) | Continued unverified runtime status and C-first/B-after-proof direction |
| [Prototype specification](PHASE_1I_D_SYNTHETIC_CRYPTO_PROTOTYPE_SPEC.md) | Pre-authorization wording explicitly superseded; current execution/review evidence |
| [Readiness/handoff](PHASE_1I_D_REFINEMENT_READINESS_AND_HANDOFF.md) | M01/M02 update, remaining gates, unexecuted packages and I-E restrictions |
| [Approval packet](PHASE_1I_D_ARCHITECTURE_APPROVAL_DECISION_PACKET.md) | Scoped authority and acceptance recommendation; other decisions remain open |
| This new acceptance review | Source/test evidence, limitations, threat/compatibility proposals, packages and owner requests |

Final static results: **PASS** — Node SHA-256 audit confirmed all 597 baseline source/prototype files unchanged, including each of the nine prototype files; each original body of the seven edited reports remains byte-identical between its new banner and annex. Baseline digest: c6819e0f83d478b3c5d0c84087b46ef6fa24cceeb39fb9a7ebcdc86de1ee614f. Static scans found 15 current ADRs, 18 current manual actions, 14 legal rows all BLOCKED, zero missing relative document links and zero whitespace issues in the eight reviewed documents. `git diff --check` passed; Git's pre-existing LF-to-CRLF normalization warning remains. `git diff --stat` lists 161 tracked design additions, including earlier work; untracked reports are not represented by that stat. Scope is eight documentation files only, with all prior edits preserved. VERDICT: PASS for these static scope/preservation checks; acceptance recommendation remains as stated at the top.


## R4 — subsequent formal owner disposition (2026-10-25)

The project owner has now explicitly accepted the bounded synthetic milestone, subject to D1-L01–L08 and W1/W2. The [formal acceptance record](PHASE_1I_D_D1_FORMAL_ACCEPTANCE.md) is authoritative for that disposition: **OWNER-ACCEPTED — SYNTHETIC D-1 SCOPE ONLY**. Earlier statements in this report that formal owner acceptance was pending describe the state at review, not the current disposition.

Fresh verification in the acceptance-record task: the 597-file source/prototype digest matches this review; exactly nine files; 104 standalone passes/two suites, no failures/skips; strict no-emit TypeScript PASS. Both warnings remain observed and accepted, not resolved. No material discrepancy or acceptance-blocking defect was found, and no prototype code changed.

M01 approval remains bounded to D-1 versions of ADR-01/02/07/08. Broader production ADRs remain PROPOSED or BLOCKED, and all 14 legal rows remain BLOCKED. The [D-2 exact seven-file scope](PHASE_1I_D_D2_CRYPTO_HARDENING_SCOPE.md) is ready for owner review but is NOT AUTHORIZED FOR IMPLEMENTATION. It proposes awaited policy/deadline/late-result and config changes; no D-2 test is claimed passed.

This milestone acceptance neither completes Phase 1I-D overall nor authorizes production integration, data operations, real KMS, infrastructure, Phase 1I-E or Phase 2. The technical review and all recorded limitations are retained unchanged as historical evidence.
