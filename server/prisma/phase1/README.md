# Inactive Phase 1 schema mapping

`schema.prisma` is a full candidate snapshot of the current schema plus eight sidecar
models. `protected-models.prisma.part` is its reviewed appended source. The active
`server/prisma.config.ts`, current schema/generated client and seven migration
files are unchanged. This candidate config has no datasource URL, env discovery
or migration directory. It is for offline `prisma validate` only; do not run
`db push`, `migrate dev` or automatic diff deployment from it.

Apply nothing without separate approval. Authoritative SQL order:

1. `phase1-protected-schema.additive.DRAFT.sql`
2. `phase1-replay-recovery.additive.DRAFT.sql`
3. `phase1-compatible-worker.additive.DRAFT.sql`
4. `phase1-contracts.additive.DRAFT.sql`

All paths above are under `docs/proposals`. Each file has its own transaction;
the four-file sequence is **not atomic**. Failure leaves a committed prefix;
stop, preserve state and inspect before separately approved recovery.

| Mapping | Adapter contract / SQL-only guarantees |
|---|---|
| AuthSecurityState | User FK, monotonic generation and retirement marker; new protected registration marks only its newly inserted account |
| ProtectedCredential | Digest and job uniqueness, purpose/subject generation, one live purpose via partial index, immutable binding and monotonic consumption/revocation |
| ProtectedAuthJob | Encrypted envelope with keyRef, lease version/worker, terminal-state fencing; cyclic credential/job FKs deferred until commit |
| PassengerSecret | Passenger + booking composite ownership, revision-CAS and authenticated envelope; existing plaintext fields retained, not migrated or silently read as fallback |
| AuthIssuanceRequest | UUID hash/keyed fingerprint ledger; immutable receipt and session/credential/job subject FKs; deferred reservation-completion trigger |
| NotificationQuarantine | Source/record primary key; polymorphic ownership is checked under source-row lock, not represented as a misleading FK |
| CompatibleNotificationLease | Exact ordinary row timestamp-version/worker/expiry lease; only compatible expired claims may be reclaimed |
| NotificationSendIntent | Record/version composite primary key and immutable terminal intent; uncertain submissions cannot re-enter the send queue |

Prisma cannot represent the CHECK constraints, partial unique index, trigger logic
or FK deferrability. Those remain SQL-owned and must survive any later generated
migration review. Three defining-side compound unique keys make the actual cyclic
and passenger one-to-one relations explicit to Prisma. New FK/dispatch/replay
indexes are specified in the fourth draft. Envelope keyRef binds the existing
provider-neutral cryptographic boundary; no provider wrapping format or IAM has
been invented or provisioned.

Enrollment is an explicit exact-user manifest operation (max100, sorted locks,
one transaction). Existing state without legacyRetiredAt is not treated as a
completed enrollment. Preserve its generation, advance it and revoke outstanding
protected/legacy credentials and sessions once; never copy raw legacy tokens.
Already retired accounts are not revoked again. This intentionally invalidates
old links/sessions when separately approved; there is no transparent legacy-token
fallback in protected consumption. Old readers continue only before cutover.

`createCutoverPhase1Composition` additionally requires a fresh trusted external
cutover verifier and external-epoch admission on every issue/consume/deliver.
The verifier must bind the reviewed schema fingerprint, actual deployment/workload
identity, completed account enrollment/quarantine review, stopped legacy issuers,
consumers, workers/redrive and drained in-flight sends. Quiescence must persist
through the whole enrollment operation. A boolean callback is not operational
proof; no real verifier is configured by this code and nothing is mounted.
Switching back to the old sender/token reader after protected data is written is
unsafe. Fail closed/quiesce; preserve ledgers/intents/quarantine and obtain a
reviewed recovery disposition. No destructive down migration or credential
resurrection is provided.

The review package targets a **new** isolated
`127.0.0.1:5432/flywithsafe_phase1_schema_integration`, not the existing G3 database.
Its baseline provisioning and any SQL/fixtures/grants require explicit approval.
Native Prisma validation and fake-PG protocol tests do not prove real SQL behavior,
cross-connection concurrency, real enrollment/cutover or KMS/identity acceptance.
