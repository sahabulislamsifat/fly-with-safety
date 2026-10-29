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
and routing, crash/restore quarantine, request-idempotent issuance, provider/identity
composition and real integration tests must precede activation. Restore must not
resume jobs automatically: an older backup can restore old generations together.

Offline tests exercise real cryptography and workflow code against synthetic
transaction stores and fake PostgreSQL connections. They do not prove database
locking, SQL execution, real identity, delivery, KMS or deployed-data protection.
No module logs raw errors, tokens, recipients, documents or connection strings.
