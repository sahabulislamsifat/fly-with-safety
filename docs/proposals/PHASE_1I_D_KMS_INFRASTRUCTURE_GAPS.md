> **Current status — 2026-10-25:** D-1 is authorized and executed; fresh review recommends **PASS WITH DOCUMENTED LIMITATIONS — REQUIRES OWNER REVIEW**. Only ADR-01/02/07/08's bounded synthetic contracts have M01 approval. Production decisions and all legal gates remain open. See [acceptance review](PHASE_1I_D_D1_ACCEPTANCE_REVIEW.md) and the R3 annex below; earlier status statements are historical.

# Phase 1I-D — KMS infrastructure readiness gap report

Status: REVIEW DRAFT; all infrastructure gates OPEN, no provisioning approved. Checked-out source confirms Prisma runtime uses DATABASE_URL (server/src/lib/prisma.ts:9), CLI uses DIRECT_URL (server/prisma.config.ts:12), and netlify.toml references Next.js hosting. This does not prove deployed regions, hosting plans, worker identity or network configuration. No account/cloud settings inspected.

### Appendix B — Missing KMS/infrastructure requirements to answer

| Gate | Required infrastructure evidence / decision | Owner | Status |
|---|---|---|---|
| KMS-01 | Choose hosting provider(s), runtime (including any Vercel/serverless/Express workers), region and supported KMS service; confirm Bangladesh and destination-country data-location implications | Infrastructure + legal | `[PENDING]` |
| KMS-02 | Establish separate development, staging and production key projects/accounts and service identities; prohibit production key access from development/CI | Infrastructure + security | `[PENDING]` |
| KMS-03 | Inventory workload authentication options: short-lived identities, role assumption, secret injection, required VPC/private endpoints or secured outbound KMS egress; no persistent keys in GitHub/env files | Infrastructure | `[PENDING]` |
| KMS-04 | Define encrypt/generate-data-key/decrypt/rotate/audit IAM permissions for API, fulfillment worker, approved support workflow and key administrators; demonstrate separation of duties | Security + infrastructure | `[PENDING]` |
| KMS-05 | Confirm KEK key type, non-exportability, allowed operations, rotation/versions, ciphertext portability and what happens when aliases or key policies change | Security architect | `[PENDING]` |
| KMS-06 | Define KMS availability objectives, per-environment quotas, cold-start latency, supplier issuance deadlines, concurrency and rate limits; estimate calls and spend | Infrastructure + operations | `[PENDING]` |
| KMS-07 | Choose whether DEKs are cached at all; set cache lifetime, memory isolation, expiration, access scope and secure handling of KMS outages/throttling | Security + backend | `[PENDING]` |
| KMS-08 | Configure sanitized application and KMS audit logs, key-use anomaly detection, alert recipients, restricted access and approved logging retention | Security operations | `[PENDING]` |
| KMS-09 | Design key loss/compromise response, break-glass access, recovery and restoration testing, historical KEK availability, RPO/RTO, and protection against irreversible key deletion | Security + operations | `[PENDING]` |
| KMS-10 | Document encrypted PostgreSQL backups/snapshots, legacy plaintext backups, regional replicas, object storage, export controls, and restore/test access | Infrastructure + DBA | `[PENDING]` |
| KMS-11 | Implement only after separate approval: mock-KMS offline harness, deterministic synthetic fixtures for regression, negative authorization and corrupted-ciphertext tests, interface test vectors | Backend + security | `[PENDING APPROVAL]` |
| KMS-12 | Record external supplier contracts, required document fields, secure transmission, incident notifications, retention and subprocessor chain; do not infer from Akij Air's public site | Product + legal | `[PENDING]` |


## Required closure evidence and proposed defaults

| Gate | Missing evidence / review recommendation | Accountable role | Closure condition |
|---|---|---|---|
| KMS-01 | Actual API/worker/frontend hosting, regions, residency and provider selection | Infrastructure + counsel | Signed topology and blocked legal rows resolved for chosen locations |
| KMS-02 | Project/account and CI trust policies | Security | Demonstrate dev/CI cannot use production keys; no shared identities |
| KMS-03 | Federation issuer/audience/subject, credential lifetime, TLS egress/DNS/private endpoints | Infrastructure | Supported serverless-to-KMS authentication and connectivity proof in separately approved staging; no assumed VPC |
| KMS-04 | API-specific policy map: local DEK plus Wrap/Unwrap vs provider GenerateDataKey | Security architect | Exact chosen provider operations; ordinary API and notification worker cannot unwrap; application owns customer/purpose authorization |
| KMS-05 | KEK algorithm/resource/version/alias and disabled/deleted key behavior | Security | Version resolution and old-backup decrypt documented; administrators separated from decrypt workloads |
| KMS-06 | Volume, burst, quota, timeout, latency, budget and SLO | Operations + finance | Model wrap calls = passenger writes; unwrap = authorized bundle accesses; add rewrap/restore traffic, retries and audit/egress costs; no invented prices |
| KMS-07 | Plaintext caching decision | Backend + security | Recommend no cross-request DEK cache initially; explicit memory/cold-start limits, bounded retry and fail-closed behavior |
| KMS-08 | Application/KMS log sinks, alert destination, on-call and retention | Security operations | Denied/bulk/integrity/throttle/key-disable alert plan with safe test; no plaintext or token labels |
| KMS-09 | RPO/RTO, incident owner, break-glass, irreversible deletion safeguards | Security + operations | Recovery rehearsal and dual-control lifecycle policy before activation; old keys retained for live envelopes/backups |
| KMS-10 | Actual DB snapshot/replica/export region, encryption, retention, restore access | DBA | Restricted backup manifest, quarantine and deletion-ledger replay; no claim of instant erasure |
| KMS-11 | Offline interfaces and staged verification scope | Backend | Separate code approval for mock-only cipher/key/auth interfaces; no real key generation now |
| KMS-12 | Supplier field/country/subprocessor/retention contracts | Product + counsel | Signed contract/API maps and legal transfer decision; Akij public UX supplies no such evidence |

All owners are accountable role proposals; individual names are TBD. PENDING in the imported checklist means OPEN, never passed. Legal-dependent checks are additionally BLOCKED for legal sign-off. KMS IAM cannot evaluate a human booking purpose without the application authorization boundary. Co-locating decrypt capability in the general API remains a documented residual compromise risk.

## Failure and recovery acceptance

Safe list/search availability must be independent of unwrap. Encryption failure rejects sensitive writes without plaintext persistence. Wrong tags/unknown versions/policy denial receive no plaintext fallback or unsafe retries. KMS outage retries must be bounded; supplier deadlines and timeout reconciliation require review. KEK rewrap does not erase leaked old material. Deleting shared KEKs is not passenger retention cleanup. Key loss may be irrecoverable; recovery claims require an approved restore drill.

## Approval agenda

Complete hosting/identity discovery; resolve legal location dependencies; select KMS and exact operation policy; approve budget/SLO/DR/audit; request separate provisioning and staging verification scope. No infrastructure evidence was generated through live access in this task.

## R2 provider evaluation and infrastructure decisions — 2026-10-24

REVIEW DRAFT. All KMS-01–12 remain open; none is satisfied by vendor documentation. All provider capabilities below are **documented, not exercised in this repository**. No account, key, IAM, networking, quota or billing state was accessed.

| Dimension | AWS KMS | Google Cloud KMS | Azure Key Vault / Managed HSM |
|---|---|---|---|
| Node/Express SDK | Candidate @aws-sdk/client-kms | Candidate @google-cloud/kms | Candidate @azure/keyvault-keys plus @azure/identity |
| DEK generation/wrapping | GenerateDataKey AES_256 returns plaintext DEK and wrapped blob; Decrypt unwraps | Application CSPRNG 32-byte DEK; symmetric Encrypt wraps, Decrypt unwraps | Application CSPRNG DEK; CryptographyClient wrapKey/unwrapKey, e.g. approved RSA-OAEP-256 key |
| IAM split | Writer GenerateDataKey only; decrypt service Decrypt on exact resource/context; separate key admin | Writer cryptoKeyVersions.useToEncrypt; reader useToDecrypt; distinct service accounts/custom roles | Separate wrapKey/unwrapKey data actions and management identity; avoid unnecessarily broad roles |
| Native identity | Compute IAM role with temporary credentials | Attached service account / workload identity | Managed identity |
| External identity | STS/OIDC trust constrained by issuer, audience and subject | Workload Identity Federation with attribute conditions, optionally service-account impersonation | Entra federated credential matching issuer/subject/audience |
| Context | Non-secret encryption context, logged and policy-condition capable | Authenticated additional data; adapter must preserve exact bytes | RSA wrap has no equivalent arbitrary AAD parameter; application AES-GCM context remains essential |
| Version/recovery | Stable key resource; KMS retains rotated material for decrypt while available; alias is not historical identity | Persist/respect key version metadata; old versions remain required | Versioned key identifier; retain required versions; distinguish Vault from Managed HSM backup/recovery |
| Runtime/Cloudflare | Node candidate; Workers SDK credential/signing compatibility untested | Node candidate; Workers transport/auth dependencies untested | Node candidate; Workers credential/crypto dependencies untested |
| Operational fit | Provisional first candidate only if backend uses suitable AWS identity | Equally viable if GCP compute/identity selected | Viable with Azure identity; Managed HSM adds cost and operational responsibility |

No SDK is installed or selected by this review. Express is not itself a KMS limitation; runtime, credentials, transport and deployment boundaries matter. Native identity co-location is preferred over static cloud credentials in a Worker. A Cloudflare secret binding is not proof of short-lived workload federation. Cloudflare-to-provider runtime issuer availability remains UNKNOWN until an approved identity proof supplies issuer/JWKS/audience/subject/lifetime and negative trust tests. CI federation does not automatically provide runtime identity.

### Region, network and residency gates

Choose API, decrypt workload, PostgreSQL, backups, KMS, logs and supplier regions together. No region is approved, and proximity to Bangladesh is not legal transfer permission. Infra must verify actual regional service/SKU availability, TLS egress, DNS, private endpoint feasibility, NAT/egress charges, latency and failure domains. Cloudflare edge execution may occur outside the database region; placement alone must not be treated as a residency guarantee. Provider-local KMS plus Node backend avoids an unnecessary cross-cloud unwrap round trip but does not close legal gates.

### Cost and quota worksheet

No approved monthly budget or workload forecast exists. Prices are a dated planning input, not a quote. Let E be monthly new envelope writes, D authorized decrypts, W rewraps, R retry calls, V retained key versions and B backup/restore calls:
- AWS operation volume roughly E + D + W + R + B when using provider ReEncrypt for rewrap; verify permissions/billing for the chosen operation.
- GCP/Azure application unwrap-then-wrap rewrap generally needs 2W calls; never assume all providers offer one-call server-side rewrap.
- Total = key/version/SKU fixed charges + operation units + audit/log storage + network/egress + compute + backup/recovery. Each environment is separate. Multiple passenger fields do not multiply wraps under the proposed grouped envelope.
- GCP published software symmetric key-version hourly price was USD 0.000082192, with cryptographic operations USD 0.03/10,000 at review; roughly USD 0.06 per 730-hour version-month, before other charges. AWS and Azure region/SKU totals require a scoped calculator quote; do not transplant a headline price across algorithms/regions.
- AWS quotas vary by operation/region/key type. GCP's current regional quota model differs from older global fixed-quota assumptions. Azure limits are weighted by key type/size and time window. Capture actual granted quotas and headroom before choosing concurrency.

Finance must return a sanitized estimate for low/base/peak scenarios, including rotation/restore bursts and retained versions. No budget number is invented.

### Lifecycle and failure policy proposal

Development, staging and production use distinct resources and identities; CI has no production decrypt. Writer creates/wraps; privileged service unwraps; key administrators cannot implicitly use decrypt. Alias selects future writes; stored immutable identity/version routes old reads.

KEK rotation changes future wrapping material; it does not re-encrypt passenger ciphertext. Rewrap changes only wrapped DEK and wrapping metadata under CAS. Content re-encryption uses a new DEK/nonce and versioned payload. Never retire a key/version until live rows, snapshots, exports and restore evidence prove it unnecessary under approved retention. Deleting a shared KEK is not single-passenger erasure.

Proposed initial operational limits, to be approved and measured: 2-second total KMS budget per attempt group, maximum 2 retries with jitter for transient/throttle errors inside that budget, no retry for policy denial/invalid envelope/integrity failure. SDK defaults must be overridden so nested retries do not multiply. KMS failure rejects sensitive writes; no plaintext persistence. Ordinary list/search remains available without unwrap. Do not hold a database transaction open while waiting for KMS.

Proposed alerts: any integrity failure, key disable/delete event or unexpected workload decrypt pages security; access-denied burst >=5 in 5 minutes and throttle/error ratio >1% over 5 minutes with >=100 calls alerts operations; p95 KMS latency >500ms for 10 minutes prompts investigation; quota utilization >70% and budget forecast >80% prompts review. These are engineering starting values, not measured SLOs or legal intervals. Owners must tune against approved supplier deadlines, traffic and on-call capacity.

Recovery: stop privileged work on compromise, revoke affected identity under incident approval, preserve sanitized audit evidence, assess plaintext exposure, provision replacement only under separate authorization, and rewrap/re-encrypt as required. Do not delete old keys as an automatic response. Restore to quarantined approved environment, recover key/version access, apply deletion/hold ledger, test synthetic reads and prevent notifications/supplier side effects. RPO/RTO and break-glass approvers remain TBD; lost destroyed key material may be unrecoverable.

### Refinement gap mapping

| Addendum gate | Mapped original gate | Missing closure evidence | Owner | Status |
|---|---|---|---|---|
| KMS-R01 provider operations | KMS-04/05 | Approved API/key type/IAM map and adapter test | Security | OPEN |
| KMS-R02 identity | KMS-02/03 | Runtime identity trust and negative tests | Infrastructure | OPEN |
| KMS-R03 regions/network | KMS-01/03/10 | Topology, egress, region and backup map | Infrastructure + DBA | OPEN |
| KMS-R04 runtime | KMS-06/11 | Pinned runtime/SDK compatibility and latency evidence | Backend | OPEN |
| KMS-R05 costs/quotas | KMS-06 | Forecast, actual quota, budget approval | Finance + operations | OPEN |
| KMS-R06 lifecycle/recovery | KMS-08/09/10 | Audit, alert, restore and old-key rehearsal | Security operations | OPEN |
| KMS-R07 legal | KMS-01/12 | Authoritative sources and qualified counsel disposition | Counsel + privacy | BLOCKED |

### Official evidence, accessed 2026-10-24

- [AWS GenerateDataKey](https://docs.aws.amazon.com/kms/latest/APIReference/API_GenerateDataKey.html), [encryption context](https://docs.aws.amazon.com/kms/latest/developerguide/encrypt_context.html), [rotation](https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html), [OIDC trust](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html).
- [AWS pricing](https://aws.amazon.com/kms/pricing/), [request quotas](https://docs.aws.amazon.com/kms/latest/developerguide/requests-per-second.html).
- [GCP envelope encryption](https://docs.cloud.google.com/kms/docs/envelope-encryption), [federation](https://docs.cloud.google.com/iam/docs/workload-identity-federation), [rotation](https://docs.cloud.google.com/kms/docs/rotate-key), [pricing](https://cloud.google.com/kms/pricing), [quotas](https://docs.cloud.google.com/kms/quotas).
- [Azure key types](https://learn.microsoft.com/en-us/azure/key-vault/keys/about-keys), [federation](https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation), [rotation](https://learn.microsoft.com/en-us/azure/key-vault/keys/how-to-configure-key-rotation), [pricing](https://azure.microsoft.com/en-us/pricing/details/key-vault/), [limits](https://learn.microsoft.com/en-us/azure/key-vault/general/service-limits).

Recommendation: select hosting and identity first, then the corresponding KMS. AWS is provisional, not selected. No cloud-only feature claim constitutes repository verification.


## R3 — KMS evidence after D-1 review (2026-10-25)

[Acceptance review](PHASE_1I_D_D1_ACCEPTANCE_REVIEW.md): fresh 104 synthetic passes and no-emit TypeScript PASS. KMS-11's bounded fake-provider harness has executed with M01/M02 authorization; owner acceptance remains pending. This does not close real infrastructure readiness. Other KMS-01–12 and KMS-R01–07 evidence requirements remain open/blocked.

The fake uses ephemeral v1/v2 wrapping KEKs and context authentication, not a DEK cache. It cannot prove real SDK/IAM/alias/version semantics, region/quotas/billing, latency, key retirement or recovery. Three immediate attempts are synthetic outcomes, not a real timeout/backoff/SLO. A future async policy cannot silently replace its synchronous checker.

AWS KMS remains provisional if AWS-native compute identity is selected. GCP app-generated DEK plus Encrypt/Decrypt with native identity is viable. Azure Key Vault wrap/unwrap with managed identity is viable; Managed HSM requires distinct operational/cost justification. Current [AWS API](https://docs.aws.amazon.com/kms/latest/APIReference/API_GenerateDataKey.html), [GCP guidance](https://docs.cloud.google.com/kms/docs/envelope-encryption), and [Azure key types](https://learn.microsoft.com/en-us/azure/key-vault/keys/about-keys) were rechecked 2026-10-25. Prior prices remain dated inputs; no new quote or account quota was obtained.

Selection order remains actual hosting/runtime -> native identity or proven federation -> region/data-flow/legal review -> operation/IAM/key map -> quotas/latency/cost -> audit/recovery/backup/on-call -> owner choice -> separately approved provisioning/staging. No provider, SDK or region selected. Cloudflare secrets and CI OIDC do not establish runtime identity.

Auth-delivery encryption and a future idempotency HMAC need distinct purposes/key material from passenger encryption, JWT/OAuth and each other. Include these domains in cost/recovery/rotation inventories. Retain historical HMAC keys for the approved replay/backup lifetime; deleting shared KEKs does not erase individual messages or snapshots.

Backup closure still requires actual locations/replicas/exports, retained key/version manifest, quarantine, deletion/hold-ledger integrity, RPO/RTO and dual-controlled emergency access. No restore, database, KMS or provisioning operation occurred. All 14 legal rows remain BLOCKED.
