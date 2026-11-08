# P5 setup v03 — precise private-password preflight

Offline recovery only. v02 remains consumed and immutable. A fresh owner execution approval is required for this version; preparation does not authorize a PostgreSQL connection.

## Verified v02 finding

The saved `caller-result.json` reports `childStage=before-network`, `childFailure.guard=NEW_PRIVATE_PASSWORD_POLICY`, `networkReached=false`, `databaseCalls=0`, `ddlCalls=0`. Its `caller-attempt.json` is present. No Node `attempt.json` or Node `result.json` was found. Do not delete/reset these files or rerun v02.

In the pinned v02 source, the maintenance password has a separate string/nonempty/maximum-512 input check. The combined NEW 20–128 printable non-space ASCII + lowercase/uppercase/digit/symbol rule applies **only** to `appPassword` and `ownerPassword`. Maintenance input passed its format gate; this does not prove that it would authenticate to PostgreSQL, since no connection occurred.

The saved generic guard does not identify which new field or which sub-rule failed. Actual values/lengths were deliberately not saved. The exact historical sub-rule is therefore unrecoverable from available sanitized evidence; it is not guessed, and no secret is requested to reconstruct it.

## Narrow v03 change

- Keep maintenance policy and all new-role requirements separate and unchanged in intent.
- Validate each new technical password immediately at its masked prompt, before confirmation/other prompts/child startup. Emit only the predefined field (`APP` or `MIGRATOR`) and first failed rule label: INPUT_REQUIRED, SIZE_POLICY, ASCII_POLICY, LOWERCASE_REQUIRED, UPPERCASE_REQUIRED, DIGIT_REQUIRED or SYMBOL_REQUIRED. Confirmation mismatch has its own label.
- Recheck the same predicates independently in Node before any network operation. The ASCII predicate rejects all control characters, including trailing newlines, matching the stated printable non-space ASCII policy.
- Do not save or print passwords, actual lengths, character counts, hashes/verifiers or connection strings as diagnostics. No policy is relaxed to obtain PASS.
- Preserve early role validation, one-time caller receipt, sanitized failures, exact restricted targets, conflict STOP, actual OID binding, pinned nine migrations, private stdin and owned process containment.
- Version output folder and Windows job type only. The provisioning runner is otherwise byte-identical to v02. The migration config and every migration are unchanged. No old credential is modified or tested against a database during recovery.

Synthetic regression covers both fields and each predicate, existing short/digit-only/Unicode maintenance input acceptance, separate maintenance rejection rules, correct PowerShell string return/confirmation behavior, and actual PowerShell -> JSON/UTF8 -> Node policy transport. All fixtures are synthetic; no real password prompt, socket, role creation or migration is executed.

First ROLE NAME prompt: press Enter for `postgres`. The following prompt is its existing password. Only the two NEW technical passwords require 20–128 printable non-space ASCII characters and all four character classes. Use distinct new values; the existing maintenance password is never sent to the new-password validator.

Run only the approved SHA256-guarded `Invoke-ApprovedSetup-v03.ps1 -OwnerApprovedSetup` in a private Windows PowerShell 5.1 console after owner approval. Failure preserves the one-time receipt and sanitized evidence; no retry, fallback or cleanup. Browser acceptance, fixtures and production rollout remain excluded.
