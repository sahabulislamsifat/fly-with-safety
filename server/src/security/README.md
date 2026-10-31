# Provider-neutral secret data plane

`secret-data-plane.ts` is an internal AES-256-GCM component. The protected workflow
modules below now use it. Existing authentication/booking routes and the running
ordinary outbox worker do not activate these modules. It is not a KMS provider,
trusted identity issuer or production activation switch.

- Trusted server composition must supply an awaited authorization boundary and
  per-operation acquisition of a fresh owned 32-byte data key. There is no default
  provider, synthetic production fallback, key environment variable or cache.
- Authorization must validate the real caller, purpose, ownership and immutable
  context. An arbitrary request-supplied callback is not trusted authorization.
- The component binds its domain/version/purpose and opaque caller AAD bytes.
  Canonical application context, wrapping/key metadata, version dispatch and
  database compatibility still require the reviewed integration contract. This
  component does not replace or alter the accepted synthetic prototype formats.
- Caller bytes are snapshotted, authorization precedes key acquisition, and
  authorization/key/total budgets are 250/500/1500ms. There are no automatic
  retries. Abort signals are advisory; late owned keys are erased when returned.
- AAD presented to authorization/provider adapters is the effective domain-bound
  byte sequence. Adapters must not mutate it. No provider-specific endpoint,
  region, IAM, logging or wrapping API is selected here.
- Caller owns successful plaintext returned by `openSecret` and must erase it.
  Owned keys and temporary buffers are cleared on best effort. JavaScript/native
  copies, crash dumps, immutable strings and ignored provider cancellation are
  not covered by a memory-zeroization guarantee.

Before application use: select the real provider/hosting/identity and key
mapping; review the persisted envelope/AAD and schema compatibility; implement
trusted grants and actual authorization; then separately authorize required
migrations, fixtures, real-provider interoperability and staging verification.
Until those steps, KMS-01/02/03 and DB-01/02/03 remain incomplete. No existing
plaintext database record is encrypted or removed by adding this component.

## Implemented integration code; not an activated production path

- `protected-envelope.ts`: strict internal V1 codec; key-reference/purpose and
  immutable record AAD; no plaintext routing duplicate. This is a candidate
  application format, not a replacement for the accepted prototype format.
  Trusted composition must resolve only approved key references and supply real
  authorization and key wrapping/unwrapping. No selected provider or default key.
- `protected-auth.ts`: encrypt before transaction; recheck locked account/generation;
  atomic supersession, credential and job writes. Registration also creates the
  account and refresh session in that unit; caller signs/returns access only after
  successful commit. A durable revocation increments the account generation.
  Immutable purpose/record/job/generation binding prevents cross-purpose delivery.
- `protected-auth.pg.ts`: actual parameterized PostgreSQL adapter supplied an
  explicit trusted pool; no import-time connection or environment fallback.
  Transaction/lock timeouts are 5 seconds; no retry after any exception/ambiguous
  COMMIT. Consumption locks before DB-wall-clock expiry and preserves atomic
  password/session effects. No current G3 source or database has been changed.
- Delivery admits a trusted worker, validates decrypted recipient and token digest,
  then atomically fences a durable send intent against current lifecycle/lease.
  SENDING, ambiguous, suppressed and submitted jobs are never automatically
  reclaimed. Only expired LEASED jobs, which have no send intent, can be reclaimed.
  Actual SMTP is awaited; acceptance is not inbox receipt. A revocation after the
  committed send-admission point cannot retract already admitted external work.
  Real workload identity, transport composition and recovery remain unverified.
- `legacyDisposition` is a strict compatibility classifier, not a completed legacy
  data migration: unknown/protected/legacy-auth data is quarantine-only. Existing
  ordinary jobs retain their reader. No retained record is deleted or silently
  downgraded. The existing worker still needs an explicit reviewed rollout/cutoff;
  its current legacy auth path is not made safe merely by this classifier.
- `passenger-secrets.ts`: real encrypted writer/authorized reader and PostgreSQL
  compare-and-set persistence; binds booking/passenger/revision. No public/guest
  decrypt default, raw-field fallback or automatic list decryption. Existing
  booking writes/read DTOs still require integration and retained-data disposition.
- `logical-digest.ts`: canonical, domain/principal/operation/key-version-bound
  HMAC-SHA256 for new logical records; never hashes randomized ciphertext. Keys
  are explicitly supplied. Existing inquiry hashes/replays are unchanged; key
  rotation, legacy dispatch and application idempotency wiring remain incomplete.

`docs/proposals/phase1-protected-schema.additive.DRAFT.sql` is a candidate additive
schema, deliberately outside `prisma/migrations`. It includes reciprocal deferred
credential/job constraints, identity-change generation/revocation and passenger
ownership linkage. It has NOT been parsed/executed by PostgreSQL. Retained-account
enrollment, restricted privileges, generated Prisma mapping, compatible consumption
and routing, actual request/quarantine schema constraints, provider/identity
composition and real integration tests must precede activation. Restore must not
resume jobs automatically: an older backup can restore old generations together.

Offline tests exercise real cryptography and workflow code against synthetic
transaction stores and fake PostgreSQL connections. They do not prove database
locking, SQL execution, real identity, delivery, KMS or deployed-data protection.
No module logs raw errors, tokens, recipients, documents or connection strings.

## Application service composition added 2026-10-29

- `services/protected-auth.service.ts` composes existing validators, real cost-12
  bcrypt, immutable CUSTOMER identity, pre-commit token signing and the protected
  atomic registration/issuance/revocation/consumption stores. It exposes the service
  methods needed by auth controllers, but does not replace the pinned existing auth
  module or register public routes. Refresh material returns only after commit.
- `PostgresProtectedAuthStore.lookupAccount/lookupCredential` provide parameterized
  reads for that composition. Existing-account enrollment is mandatory before
  activation: an absent security-state row must not silently fall back to legacy
  issuance. The new protected consume path does not itself migrate legacy tokens.
- `services/outbox.service.ts::processProtectedNotificationJob` connects fenced
  admission to `notification.service.ts::createProtectedNotificationDelivery` and
  the existing real renderer/transport. Fixed approved frontend origin, strict
  token/recipient validation, no ordinary enqueue fallback, real suppression,
  submission/ambiguous outcomes. Existing worker startup never calls it implicitly.
- Existing `createIdempotentInquiry` now accepts a trusted, explicit digest policy.
  No current caller enables it. New writes can use canonical keyed digests; replay
  selects the stored key version. Old SHA-256 rows remain readable by upgraded
  callers. Missing/unknown key versions or a keyed row without a compatible reader
  fail closed. Owned HMAC keys are cleared; no new key environment/config fallback.
  Stable guest principal mapping and existing ordinary callers remain unchanged.

These service boundaries are executable and offline-integrated; public activation,
schema execution, real KMS/trusted workload and PostgreSQL proof are still pending.
Inquiry digest integration and registration email uniqueness are separate from the
durable issuance request ledger implemented below. Neither activates a public route.

## Durable requests, compatible reader and recovery — 2026-10-29

- `issuance-replay.ts`: UUIDv4 request identity is stored only as SHA-256 keyHash;
  a keyed/versioned fingerprint binds operation and snapshotted logical input.
  Registration fingerprints include the password via HMAC, never a raw persisted
  password or random bcrypt hash. Request keys must be retained across a caller's
  network retries. The first committed receipt wins; changed input returns a fixed
  conflict. Fast replay performs no new credential generation/hash/encryption;
  concurrent race losers may prepare outside the transaction but never apply it.
- `prepareProtectedIssuance` separates pre-transaction crypto from one-shot atomic
  application. The PG request reservation, account/credential/job/session effects
  and receipt completion share one ReadCommitted transaction. Unfinished reservation
  cannot commit through the adapter; draft DB triggers/constraints also enforce
  completion, immutability and subject linkage. COMMIT errors are not auto-retried.
- Service methods `registerRequest`, `requestPasswordResetOnce` and
  `resendVerificationOnce` integrate this protocol. Unknown/verified-account no-op
  receipts are durable too. Registration replay returns only `{status:'replayed'}`,
  never old or fresh refresh/access credentials; a caller lacking its first session
  must sign in. Enabling the request-ledger composition disables the compatibility
  issuance methods, so callers cannot bypass it by omitting a request ID.
- `notification-recovery.ts` strictly dispatches protected envelopes and known
  ordinary templates. Legacy auth, mixed/unknown/malformed payloads and known
  credential fields under ordinary templates are quarantine-only. JSON snapshots
  reject getters/proxies/cycles and are bounded. This is not an exhaustive detector
  of secrets embedded in arbitrary free text; retained-data inventory is still needed.
- `notification-recovery.pg.ts` persists quarantine metadata and fences exact
  record/version/state with a row lock. Payloads are retained; ordinary jobs become
  terminal FAILED, pending/leased protected jobs become QUARANTINED with a higher
  lease version. SENDING/AMBIGUOUS/SUBMITTED/SUPPRESSED states are never requeued or
  rewritten. The reader checks durable quarantine before releasing ordinary payloads;
  protected claim/admit/send/ack queries deny quarantined rows.
- `quarantineRestoredBatch` snapshots and validates an exact manifest of at most100
  distinct records before writing, then stops at the first failure. A committed
  prefix may remain; inspect durable metadata before any separately reviewed recovery.
  It neither restores a database nor clears quarantine, redrives, deletes or broadly
  cleans records. Restored send-intent rows require ambiguity reconciliation.
- `recovery-epoch.ts::SignedRecoveryAdmission` is a concrete Ed25519 verifier with
  a pinned public key/scope/epoch, fresh nonce per admission, exact action binding,
  signed ready flag, short validity and a250ms monotonic authority deadline. No cache,
  retries, environment fallback or default authority/key. Issuance, consumption and
  protected outbox entry require recovery admission. The authority must live outside
  restored database state; its real implementation/provisioning is not selected.
  Before actual restore: quiesce all old workers/routes and advance external epoch.
  An application callback or signed statement cannot detect an unannounced privileged
  database restore by itself. Real clock/identity/authority/restore exercises remain G4–G6.

`phase1-replay-recovery.additive.DRAFT.sql` requires the protected-schema draft and
is also outside `prisma/migrations`. Neither draft is PostgreSQL-validated/applied.
Keep the existing G3 target/schema and seven migration pins intact while C16 runs.
Prisma mapping, reviewed grants, sidecar/ledger deployment, old-worker/redrive cutoff,
reviewed controller/client activation and actual nonproduction SQL
proof must precede activation. There is no production private signing key or fake
authority in src; tests generate synthetic keys locally. All existing route/worker
startup remains unchanged, and current passenger plaintext has not been migrated.

## Compatible boundaries and worker composition — 2026-10-29

- `controllers/auth.controller.ts::createProtectedAuthController` is unmounted.
  Mandatory UUIDv4 Idempotency-Key feeds the durable request methods. Registration
  replay returns a sign-in disposition without user, session or cookie writes.
  Existing named legacy handlers and cookie attributes remain unchanged.
- Client `auth-attempt.ts` stores only an operation/UUID/revision in memory. Forms
  preserve the ID on network/5xx/408/429/unknown outcomes, invalidate it on payload
  edits, block simultaneous dispatch, and terminate it on successful or definitive
  rejection responses. No automatic retries or browser persistence. Legacy API
  responses remain accepted; protected registration replay requires sign-in.
- `compatible-outbox.service.ts` admits ordinary/protected source scopes before
  discovery, snapshots payload/metadata, checks quarantine and recovery, then uses
  the ordinary versioned lease or existing protected fenced delivery. Max3 jobs
  with20s dispatch admission; SMTP is awaited, never raced against a timeout.
- `compatible-outbox.pg.ts` uses the supplied pool and parameterized row/version/
  actor checks. An ordinary send intent commits before transport; existing intents
  exclude discovery, claims and redrive. Lost intent/SMTP/ack outcomes remain
  ambiguous and cannot trigger automatic resend. Only SAFE_PRE_SEND_FAILURE with
  no intent/quarantine and remaining quota can be explicitly redriven; attempts
  are never reset. Stale/expired leases cannot acknowledge or start a send.
- `compatible-outbox.controller.ts` requires explicit trusted worker/operator
  identity resolvers. Browser worker requests and unsupported methods are rejected;
  request bodies cannot select an actor or batch limits. Protected redrive is denied;
  use a fresh issuance request. Neither controller is mounted.
- `protected-phase1.composition.ts` assembles the concrete supplied-pool stores,
  mandatory digest-backed replay service, controllers and compatible worker.
  Construction performs no query, key acquisition or route/timer activation.
  Existing controller/notification imports retain their normal env/legacy Prisma
  dependencies; this is not an env-free standalone runner. New persistence uses
  the supplied pool only. Tests replace all ambient DB/config/transport dependencies
  before import, deny sockets/process/DNS and simulate client HTTP in memory.

`phase1-compatible-worker.additive.DRAFT.sql` maps the ordinary lease/send-intent
tables and protected FIFO timestamp. It requires the other two additive drafts,
is outside the seven approved migrations, and has NOT been parsed or executed by
PostgreSQL. No grants, old-worker cutoff, account enrollment, production identity,
recovery authority, KMS, schema or new route activation has occurred. The current
Prisma model/legacy worker remains unchanged. Future rollout must atomically retire
legacy worker/redrive paths; a legacy worker does not understand these intents.
Actual schema constraints, concurrent CAS/claim/send-intent and restore behavior,
trusted authority/identity/key lifecycle and browser end-to-end proof remain gates.

## Schema contract and enrollment/cutover — 2026-10-29

The inactive full Prisma candidate is in `prisma/phase1/schema.prisma` with its own
URL-free config; native Prisma7.10.0 validation PASS. Mapping/SQL ownership and
compatibility rules are in `prisma/phase1/README.md`. Four additive drafts now
specify all eight sidecars, deferred credential/job and receipt constraints,
FK/query indexes, live-purpose uniqueness, encrypted-envelope checks, immutable
credential/receipt/intent bindings and job/passenger revision fencing. SQL has
NOT been parsed or executed by PostgreSQL; generated current client is unchanged.

`enrollment-cutover.ts` implements exact-user enrollment against a separately
designated local integration target. One transaction locks sorted users, preserves
existing generation, records retirement, advances generation, revokes outstanding
protected credentials and retires old links/sessions. No raw-token import or data
deletion. AuthSecurityState existence alone is not completion: nullable monotonic
legacyRetiredAt distinguishes unretired accounts. Reinspection skips completed
accounts and never revokes their new sessions. Commit uncertainty stops without
retry. Protected registration marks only its new account in the same transaction.
All protected lookup/consume/send admission SQL excludes an unretired marker.

After the fourth draft, unretired email updates keep legacy behavior; enrolled
email changes still advance generation and revoke credentials/sessions. Sidecar
RESTRICT FKs deliberately prevent unsafe parent deletion once referenced; deletion
and retained-data disposition need reviewed handling, not cascading loss. Old
issuer/consumer/worker/redrive processes must be stopped/drained for enrollment
and protected rollout; compatible readers do not make old senders safe.

`createCutoverPhase1Composition` additionally wraps recovery with fresh, bounded
trusted cutover verification of the reviewed schema hash before external-epoch
admission. No default readiness, identity, runtime flag or DB-self-attestation.
The external verifier and actual quiescence are still operational dependencies;
mocked true callbacks are not evidence that production processes stopped. None
of these factories are mounted, nor is enrollment invoked by application startup.
The isolated SQL pre/postcheck and rollback-only synthetic constraint probe are
prepared in `docs/proposals/PHASE_1_SCHEMA_INTEGRATION_APPROVAL.md`; no execution,
schema/grants/fixtures or provider operation occurred in this batch.
