# P5 isolated setup v05 — unchanged reviewed logic

Prepared for explicit owner approval only. Do not execute during preparation or rerun any consumed v01-v04 caller.

The saved v04 result shows `NEW_MIGRATOR_PASSWORD_SIZE_POLICY` at `private-password-input`, with `childStarted=false`, `networkReached=false`, database/DDL calls zero. Its one-time receipt and results are preserved. No password value or actual length was collected. The owner has separately prepared compliant new credentials privately; preparation does not inspect or authenticate them.

v05 is a version-only copy of the reviewed v04 caller. Changes are restricted to the output directory, receipt version and Windows job type. The password policy, requirement panels, validation-before-child behavior, independent maintenance credential rule, private stdin, exact database/role guards, STOP-on-conflict, actual OID binding, all nine pinned migrations, grants, deadlines and STOP/no-retry behavior are unchanged.

Fixed scope: `127.0.0.1:5432`; maintenance database `postgres`; new target `flywithsafety_p5_identity_scope_test`; new roles `fws_p5_identity_migrator` and `fws_p5_identity_app`. Any existing resource conflict stops without adoption or mutation. Actual database OID is queried after creation, never invented. No protected/cloud database, seed/financial fixture, gateway/supplier call, normal service change, browser acceptance or production activation is included.

The existing maintenance password is subject only to its existing input rule and later PostgreSQL authentication. Only the two NEW role passwords require 20-128 printable non-space ASCII characters including lowercase, uppercase, digit and symbol. Each new-password entry and confirmation is preceded by the requirements panel. Credentials remain masked/private; no value, actual length, verifier or connection string appears in sanitized diagnostics or files. The two new values must differ from each other and the existing maintenance secret.

After approval, use only the SHA256-guarded `Invoke-ApprovedSetup-v05.ps1 -OwnerApprovedSetup` in a private Windows PowerShell 5.1 console. At ROLE NAME, Enter selects `postgres`; its password belongs in the next prompt. No secret in chat or command arguments. Evidence goes to `output/phase5/p5-approved-setup-20261107-05/`. An existing receipt or outcome blocks reuse. A failed guard preserves the first sanitized cause; no automatic retry, fallback or destructive cleanup.
