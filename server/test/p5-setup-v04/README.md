# P5 setup v04 — explicit pre-prompt requirements

Preparation only; fresh one-time owner execution approval is required. v01-v03 remain frozen and consumed, including all actual receipt/result artifacts. No old caller is rerun.

The saved v03 result confirms `NEW_MIGRATOR_PASSWORD_LOWERCASE_REQUIRED` at `private-password-input`, `childStarted=false`, `networkReached=false`, database/DDL calls zero. The policy worked correctly. The owner's separate successful Git Bash login is owner-reported evidence, not repeated or independently queried during this recovery.

v04 only adds a static requirements panel before **each** new-password entry and confirmation. It explicitly lists 20-128 printable ASCII characters, no spaces/Unicode/control characters, lowercase a-z, uppercase A-Z, digit 0-9, symbol, and distinct credentials. It displays no entered value, actual length, character count or sample password. Existing maintenance credentials retain their separate policy.

The policy validator, database/role targets, conflict STOP, actual OID binding, nine reviewed migrations, grants, deadlines, early input checks, sanitized results, private stdin and process containment are unchanged. Runner output folder and owned-job type are versioned. No database connection, creation, migration, fixture, browser, normal-service or credential mutation occurs during preparation.

Run only the new SHA256-guarded `Invoke-ApprovedSetup-v04.ps1 -OwnerApprovedSetup` after explicit owner approval. First ROLE NAME prompt: press Enter for `postgres`; its existing password belongs in the following masked prompt. Both NEW technical-role values must satisfy the displayed unchanged requirements. No passwords in chat or arguments. Failure preserves evidence and stops; no automatic retry or cleanup.
