# G3 STATUS reader — provisioning and verification approval ticket

Prepared 2026-10-28. PROPOSED ONLY. No database connection or provisioning performed.
Authority: owner requested preparation, not execution. Engineering governance remains tracker section 0; no retired checklist is reinstated.

## 1. Baseline and integrity

development HEAD bbeb862b03949056c1f93539631ad31c054a11ab. Existing documentation changes preserved.
Evidence Log records 139 offline assertions (42 config/SQL/preservation + 59 fake-process + 6 rejection + 32 governance), zero final failures/skips. This preparation inspected the record, not a fresh rerun of those assertions.

Fresh raw SHA-256 checks matched:

| Artifact | SHA-256 |
|---|---|
| Get-G3MigrationStatus.ps1 | fb00fee44b42352df4b8dbfc9c73dcafacb742a247b4a65d0f8d05d28363a360 |
| prisma.g3.status.config.cjs | f7e0ecdc3d6325c4268b889aa3fd966d4c6f3088402e0a235069ca4ed5099963 |
| preflight.status.readonly.sql | c75c292a4ff0fdf73e425bc3d7ef782132a942655f773dd59a968b07df8e4313 |

Helper still pins config/SQL/postcheck hashes, exact seven migration bytes/names and Prisma/client7.10.0. Offline returns before live work. No helper edit in this task.

## 2. Privilege contract and limits

Only connection target: 127.0.0.1:5432/flywithsafe_g3_auth02_disposable, PostgreSQL18.6, UTF8, owner postgres. Administrator provisions; separate flywithsafe_g3_status_reader performs future Status. Preserve flywithsafe_g3_auth02_test and its NOLOGIN state.

Before migrations, reader needs LOGIN, database CONNECT, public schema USAGE and normal readable catalog access. No application-table grant, sequence privilege, schema CREATE, database CREATE/TEMP, ownership, membership, grant option, broad pg_read_all_data/pg_monitor role, migration authority or password-catalog access. Existing preflight uses DO with the trusted plpgsql language: require installed trusted plpgsql and effective USAGE; if absent/denied, STOP rather than install/grant automatically.

After migrations, propose only SELECT ON TABLE public._prisma_migrations plus existing CONNECT/USAGE. No SELECT on customer tables and no default privileges/all-tables grant. This is a future separate approval; _prisma_migrations may contain operational logs and must not be printed indiscriminately. Actual engine/catalog compatibility must be observed under later live authorization. Current helper explicitly rejects any migration history/public relations; it must NOT be reused after initialization without separately reviewed adaptation.

Roles are cluster-wide. A new role can inherit PUBLIC privileges without memberships. Explicit helper URLs constrain its own connections, not every possible use of its password. PostgreSQL ACLs have no per-role DENY overriding PUBLIC CONNECT/TEMP. Do not change other databases or HBA to claim global confinement. Before approval, accept this residual scope or request a separate dedicated-cluster/HBA design if universal host/database confinement is required. Review PUBLIC privileges, security-definer routines, extensions, foreign access and built-in execution on the approved target; ordinary safe catalogs are not a universal sandbox. Read-only defaults remain changeable user settings, not privilege revocation.

## 3. Private console and fail-closed prechecks

Use an accessible NEW private Windows PowerShell 5.1 console, no transcript/history capture of secrets. Private environment cleanup applies to this console process only; do not edit repository .env, user/machine environment or authentication configuration. Before launching psql, remove inherited PG* variables from the new process environment; explicit connection arguments replace service/host/password-file fallbacks. No .psqlrc because -X; enter postgres password only at -W prompt. Never paste a connection URL/password into chat.

```powershell
# In the new private console only; no database operation until separately approved.
Get-ChildItem Env: | Where-Object Name -Like 'PG*' |
    ForEach-Object { Remove-Item -LiteralPath ('Env:' + $_.Name) }
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -W `
    -v ON_ERROR_STOP=1 -P pager=off `
    -d 'host=127.0.0.1 port=5432 dbname=flywithsafe_g3_auth02_disposable user=postgres connect_timeout=2'
```

The SQL below is for manual, separately approved execution in that session. First execute this bounded read-only precheck; a psql SQL error under ON_ERROR_STOP terminates this attempt. No automatic retry.

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
SET LOCAL lock_timeout='5s';
DO $guard$
BEGIN
  IF NOT COALESCE(current_database()='flywithsafe_g3_auth02_disposable'
    AND current_user='postgres' AND session_user='postgres'
    AND host(inet_server_addr())='127.0.0.1' AND inet_server_port()=5432
    AND current_setting('server_version_num')='180006'
    AND current_setting('password_encryption')='scram-sha-256',false)
    OR NOT EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database()
      AND pg_get_userbyid(datdba)='postgres' AND pg_encoding_to_char(encoding)='UTF8')
    OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='flywithsafe_g3_status_reader')
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='flywithsafe_g3_auth02_test' AND NOT rolcanlogin)
    OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid())
    OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname !~ '^pg_')
    OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')
    OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')
    OR EXISTS(SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE n.nspname='public')
    OR to_regclass('public._prisma_migrations') IS NOT NULL
    OR EXISTS(SELECT 1 FROM pg_database d CROSS JOIN LATERAL aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) a
      WHERE d.datname=current_database() AND a.grantee=0)
    OR EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner))) a
      WHERE n.nspname='public' AND a.grantee=0)
    THEN RAISE EXCEPTION 'G3_STATUS_PROVISION_PRECHECK_FAILED';
  END IF;
END $guard$;
SELECT current_database(),current_user,host(inet_server_addr()),inet_server_port(),version();
ROLLBACK;
```

Before mutation also capture a private non-secret baseline: G3-X role attributes, memberships and pg_db_role_setting; target database/schema ACLs and ownership; public relation/history count; available extensions/security-definer routines and trusted-language access. Reject unexpected execute/ownership/parameter grants, event-trigger automation, concurrency or unknown objects; do not repair them. Reconfirm identity/absence immediately before stage A. DBA controls concurrent administration during this manual window; catalog checks do not lock out administrators.

## 4. Minimal mutation sequence — NOT APPROVED FOR EXECUTION

Stage A (same verified administrator session, never switch databases):

```sql
BEGIN;
SET LOCAL statement_timeout='5s';
SET LOCAL lock_timeout='5s';
CREATE ROLE flywithsafe_g3_status_reader NOLOGIN NOSUPERUSER NOCREATEDB
  NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 20;
COMMIT;
```

CREATE without IF NOT EXISTS refuses an unexpected existing role. Stage A commits before private input, preventing an idle uncommitted role transaction. Use the named prompt:

```text
\password flywithsafe_g3_status_reader
```

Choose/confirm a new password privately. Do not use PASSWORD literals, command-line secrets, files or transcripts. STOP if that command errors or is interrupted. Before stage B, administrator checks only a boolean: password exists and starts with SCRAM-SHA-256; no password/hash is selected for output.

```sql
BEGIN;
SET LOCAL statement_timeout='5s';
SET LOCAL lock_timeout='5s';
DO $guard$
BEGIN
  IF NOT COALESCE(current_database()='flywithsafe_g3_auth02_disposable'
    AND current_user='postgres' AND session_user='postgres'
    AND host(inet_server_addr())='127.0.0.1' AND inet_server_port()=5432,false)
    OR NOT EXISTS(SELECT 1 FROM pg_authid WHERE rolname='flywithsafe_g3_status_reader'
      AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls AND rolconnlimit=20
      AND rolpassword LIKE 'SCRAM-SHA-256$%')
    THEN RAISE EXCEPTION 'G3_STATUS_PASSWORD_OR_IDENTITY_FAILED';
  END IF;
END $guard$;
GRANT CONNECT ON DATABASE flywithsafe_g3_auth02_disposable TO flywithsafe_g3_status_reader;
GRANT USAGE ON SCHEMA public TO flywithsafe_g3_status_reader;
ALTER ROLE flywithsafe_g3_status_reader IN DATABASE flywithsafe_g3_auth02_disposable
  SET statement_timeout='5s';
ALTER ROLE flywithsafe_g3_status_reader LOGIN;
COMMIT;
```

Only statement_timeout is persisted to match the pinned preflight's exact setting-array check. Do not add persisted read-only/lock/idle defaults silently. Future helper supplies read-only/lock/idle settings per connection. Commit stage B only after role/ACL/membership/ownership preconditions still hold; any unexplained privilege is a stop, not a reason to issue broad REVOKE.

## 5. Verification boundaries

Provisioning approval should include administrator read-only postchecks only: identity/version/owner, exact role flags, zero memberships in either direction, no object ownership, effective CONNECT=true, TEMP/CREATE=false, public USAGE=true/CREATE=false, no grant options, no unexpected direct ACLs/parameter ACLs, exact single role/database setting ['statement_timeout=5s'], SCRAM boolean only, zero public relations, no history, unchanged G3-X attributes/memberships/settings and unchanged preexisting target ACL entries apart from the new grantee. Inspect relevant ACL/default-ACL, language and executable non-system SECURITY DEFINER exposure. Record just sanitized booleans/counts and results, not raw configuration secrets.

Negative-access verification is catalog-based: has_database_privilege, has_schema_privilege, has_table_privilege/has_sequence_privilege/has_parameter_privilege where objects exist, pg_auth_members and ownership queries. Do NOT attempt CREATE/INSERT/UPDATE/DELETE, SET ROLE into another identity, or test writes followed by rollback. A missing table is not proof of denied SELECT. No reader database connections or Prisma calls are included in this provisioning ticket.

Later separately approved reader authentication/connection verification must use literal host/port/database/user, read-only startup options from pinned helper, five-second statements/locks/idle timeout, bounded connection deadline and current/session identity checks. Run pinned status preflight with effective reader permissions, not SET ROLE in an admin session. Keep admin session closed while preflight checks exclusive target access. Verify read-only behavior using settings and privileges; do not attempt writes. Treat unobservable engine-session settings as a stated limitation. A separate subsequent approval is required for fixed Prisma migrate status and its seven-name/exit-result checks. Missing-history output/exit1 formatting may differ; never loosen parser or grant privileges automatically on mismatch.

## 6. Stop, failure and recovery

- Any precondition mismatch: no provisioning; record sanitized error, psql exit and target. Do not retry, change HBA/PUBLIC ACLs, remove resources or alter historical databases.
- Stage A fails: transaction aborts; verify committed role absence read-only. Do not infer rollback solely from client exit.
- Password setup fails after stage A: role may remain committed NOLOGIN with unknown password state. Stop; no reset/drop/retry without separate recovery approval.
- Stage B fails: transaction rolls back its grants/settings/LOGIN; stage A role/password can remain. Verify actual role/ACL state read-only; do not activate, clean up or repair automatically.
- Postcheck fails after commit: role may be LOGIN with grants. Stop; record exact partial state. Even disabling LOGIN, revoking grants, terminating sessions or deleting role requires separate narrowly scoped recovery approval. Never compensate by modifying other roles/databases.
- Interactive prompts must be accessible. No open transaction while waiting for a password. Do not launch hidden consoles or collect passwords through tools. Preserve private evidence without credentials; report exit codes and PASS/FAIL/UNKNOWN accurately.

## 7. Smallest execution authorization request

> Authorize one guarded G3 STATUS-reader provisioning attempt on PostgreSQL18.6 at 127.0.0.1:5432/flywithsafe_g3_auth02_disposable as administrator postgres, after fresh read-only identity/absence/empty-target/ACL checks. Create only flywithsafe_g3_status_reader initially NOLOGIN with the flags/limit above; commit before private interactive initial SCRAM password setup; grant only target CONNECT and public USAGE, set its target-specific statement_timeout=5s, then enable LOGIN transactionally. Include administrator read-only preservation/postchecks and sanitized evidence. Preserve owner postgres, G3-X role and all existing resources. Accept that cluster-wide PUBLIC connectivity outside this helper is not globally revoked by this ticket. Stop on any mismatch/failure with no retry or repair. Exclude reader connections, live Prisma Status, migrations, history/customer-table grants, fixtures, G3-P/X, HBA/PUBLIC ACL changes, other database access, providers and deployment.

No approval is inferred from preparation. If stricter global confinement is required, resolve its separate design before authorizing this ticket.

## 8. Dependencies and source references

Provisioning/postchecks → separate reader authentication/preflight → separate live Status → exact seven-migration authorization → separately reviewed post-migration history-read/helper changes if needed → test-role access and G3-P → G3-X30 groups and acceptance. Other mandatory engineering units remain in the canonical tracker: AUTH01–03, OUT01–04, KMS01–03, DB01–04, P01/P02, G4/G5/G6/G7 and F01–F07 regressions. Phase1 incomplete; Phase2 not authorized.

Official technical references consulted 2026-10-28 (no legal research):
- https://www.postgresql.org/docs/18/sql-createrole.html — cluster-wide roles and privilege flags.
- https://www.postgresql.org/docs/18/sql-grant.html — separate CONNECT/schema/table grants; effective PUBLIC privileges must be reviewed.
- https://www.prisma.io/docs/orm/v7/reference/prisma-cli-reference#migrate-status — status compares migrations with history; documented nonzero failure/pending cases. Not a granular privilege guarantee or proof of this pinned engine's actual execution.

## 9. Provisioning completed; next separate reader-authentication ticket

Provisioning is complete, not a pending instruction. Owner supplied actual console markers G3_STATUS_PREFLIGHT_PASS, G3_STATUS_READER_PROVISION_PASS and Provisioning finished. Exit code: 0. These corroborate the agent-observed exit-code.json psqlExitCode0. Preserve completed attempt files, reviewed SQL and database state; never rerun provisioning. Administrator-side success is not reader authentication or Prisma-engine proof.

### Ticket R1 — reader authentication and preflight ONLY (approval requested)

Target/identity: only 127.0.0.1:5432/flywithsafe_g3_auth02_disposable as flywithsafe_g3_status_reader. No postgres fallback. No use/activation of flywithsafe_g3_auth02_test.

Prerequisites: same three hashes from section 1; unchanged seven migration files/version guards; provisioning exit0 accepted; empty public schema/history expected; no other target database sessions. No automatic closure/termination of other sessions. Open a new accessible private PowerShell console with no transcript. No secrets in arguments, files or chat. Existing reader password is entered only at native psql -W prompt; no password change.

Exact proposed private-console body (DO NOT RUN until R1 approval):

```powershell
$ErrorActionPreference='Stop'
$g3Dir='C:\Users\sahab\.codex\visualizations\2026\10\21\01a15fd3-69ff-7843-bea7-539c3d6111f9\g3-migration-initialization-20261026-01'
$g3Sql=Join-Path $g3Dir 'preflight.status.readonly.sql'
if((Get-FileHash -LiteralPath $g3Sql -Algorithm SHA256).Hash -cne 'C75C292A4FF0FDF73E425BC3D7EF782132A942655F773DD59A968B07DF8E4313') { throw 'Status SQL changed' }
& 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -NonInteractive -File (Join-Path $g3Dir 'Get-G3MigrationStatus.ps1') -Action Offline
if($LASTEXITCODE -ne 0) { throw 'Offline integrity guard failed; no connection' }
# Process-local cleanup in this fresh private console, never user/machine environment.
Get-ChildItem Env: | Where-Object Name -Like 'PG*' | ForEach-Object { Remove-Item -LiteralPath ('Env:'+$_.Name) }
$env:PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=5000'
try {
    & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -W -v ON_ERROR_STOP=1 -P pager=off `
      -d 'host=127.0.0.1 port=5432 dbname=flywithsafe_g3_auth02_disposable user=flywithsafe_g3_status_reader connect_timeout=2' `
      -f $g3Sql
    $g3Exit=$LASTEXITCODE
    Write-Host ('Reader preflight finished. Exit code: '+$g3Exit)
    if($g3Exit -ne 0) { throw 'Reader preflight failed; stop without retry' }
} finally { Remove-Item Env:PGOPTIONS -ErrorAction SilentlyContinue }
```

Use only once under R1 approval and preserve actual output/exit. This is a proposed manual procedure, not a new created/executed helper. If a guarded launch wrapper is desired, it must only encapsulate this R1 operation and local one-attempt evidence, never invoke Status implicitly. Password-prompt waiting is interactive; connect_timeout applies to connection establishment and five-second server settings to SQL/lock/idle transactions, not an overall deadline including human input.

Acceptance: actual reader login succeeds; current_user=session_user=reader, literal target/version/owner/encoding match; transaction/default read-only ON; statement/lock/idle limits5s; exact role flags/limit20 and persisted role/database statement_timeout only; effective CONNECT/USAGE, no CREATE/TEMP/schema CREATE, no memberships/ownership or executable non-system security-definer escape; no public ACLs/relations/history/other target connections; G3_STATUS_PREFLIGHT_PASS and psql exit0; SQL transaction ends ROLLBACK. Negative checks are privilege/catalog inspection only, never trial writes or SET ROLE. This script does not inspect password catalogs. Sanitized output must exclude passwords/URLs/customer data. An absent table is not proof of denied table access.

Failure: any hash, identity, authentication, privilege, timeout, missing marker or unexpected state stops R1. Record exit/error and partial evidence; do not reset passwords, provision/regrant, change HBA, repair scripts, terminate sessions or retry automatically. If no psql connection is possible, report authentication/connection failure without fallback. Preserve provisioning success as historical evidence even if R1 fails; do not erase one with the other. Actual native Prisma session settings remain unverified by this psql session.

Smallest R1 approval request:

> Authorize one reader-authentication/preflight attempt only, using the pinned preflight.status.readonly.sql and exact R1 private-console procedure on 127.0.0.1:5432/flywithsafe_g3_auth02_disposable as flywithsafe_g3_status_reader. Use the existing password privately, startup read-only/timeouts and sanitized evidence; stop on failure without retry/repair. Exclude Prisma commands, provisioning/credential/grant changes, migrations, fixtures, G3-P/X and all other targets.

### Ticket R2 — fixed live Prisma STATUS-ONLY (NOT included in R1)

Request only after actual R1 PASS is accepted. Revalidate hashes, exact migration set, versions and absence of earlier Status-attempt files. The existing Get-G3MigrationStatus.ps1 -Action Status -ReadOnlyStatusAuthorized runs its OWN reader identity/preflight first and then only the pinned Prisma migrate status command. Thus R2 approval must explicitly cover this repeated identity connection as well as Prisma's connection; R1 is not reused as stale live evidence. Never manually bypass the identity stage.

R2 acceptance: reader identity/preflight exit0; fixed Prisma7.10.0 reports the exact seven pending names with the reviewed native exit1 and expected output; helper completes with G3_STATUS_ONLY_PENDING_SEVEN_PASS and sanitized evidence. Unexpected missing-history formatting, failure or different migration set means STOP, not parser weakening, privilege expansion or migration execution. No Prisma engine-session proof is inferred from a separate psql session. Existing startup-option/ACL/source evidence limitations remain explicit. Role provisioning, migration deploy, reader history-table grants, test access/P/X and cleanup are excluded.

Current state: provisioning PASS; R1 NOT EXECUTED/approval pending; R2 NOT EXECUTED/approval pending. Seven-migration and later G3 gates remain separate. No new phase transition.

## 10. R1 attempt02 diagnosis and proposed bounded recovery

This later record supersedes section9's dated not-executed R1 status: attempt01 interrupted; attempt02 executed once but failed before connection. Owner supplied CommandNotFoundException for Get-FileHash at Invoke-R1.ps1 line12, the initial SQL hash check. Source ordering proves Offline child/psql were not reached in attempt02. Authentication is unverified, not rejected. Preserve both attempt directories/results; no automatic retry or repair.

Offline diagnosis in clean Windows PowerShell5.1 reproduced absent Get-FileHash command discovery despite the installed Utility manifest existing. Explicit Import-Module of the installed Microsoft.PowerShell.Utility manifest resolved Get-FileHash; SHA256 output matched independent .NET SHA256. Running existing Get-G3MigrationStatus.ps1 -Action Offline in a child with that explicit import produced G3_OFFLINE_SEVEN_MIGRATION_GUARDS_PASS, exit0. No database connection. Why automatic module discovery failed remains unresolved; no machine/module-cache/environment-policy change is proposed.

Proposed recovery scope (NOT IMPLEMENTED): create only g3-reader-r1-20261028-03/Invoke-R1.ps1 based on reviewed launcher, with two functional changes:

1. Before its Get-FileHash guard, explicitly import the installed Utility manifest with -ErrorAction Stop:

```powershell
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
```

2. Its separate Windows PowerShell Offline child must also explicitly import that manifest before invoking the unchanged helper with -Action Offline. Parent imports do not propagate to a new child session. Use only fixed installed executable/helper paths, no user input or dynamic shell construction. Preserve every hash pin, exact identity/target, private psql prompt, PG cleanup/startup options, evidence, failure/no-retry behavior and SQL bytes. Do not modify shared helper/config/preflight, system modules, profiles or persistent environment. New directory preserves failed-attempt markers.

After code-only parser/hash/scope/offline checks, execute at most ONE fresh R1 attempt only with separate explicit permission included below. No Prisma connection. Failure of import, integrity or connection/preflight stops without further retry/repair. No new password, roles or grants.

Approval request:

> Authorize the exact attempt03 launcher-only module-import correction described in section10 and its offline verification, followed by ONE fresh R1 reader-only authentication/preflight attempt if those checks pass. Preserve attempt01/02, all reviewed SQL/hash/target guards and successful provisioning. Existing reader password remains private. Exclude Prisma commands, provisioning, credential/privilege changes, migrations, fixtures and G3-P/X. Stop on first failure with no further retry/repair.

## 11. R1 verified PASS; next R2-only approval

Actual Attempt03 result is psqlExitCode0; owner console includes G3_STATUS_PREFLIGHT_PASS, ROLLBACK and Reader preflight finished. Exit code: 0. Canonical Evidence Log records exact identity/settings/role/schema proof and wrapper hash. No R2 execution yet. The preceding section9/10 statuses are dated history, superseded by this actual R1 PASS.

R2 proposed private-console invocation (only after separate approval): explicitly Import-Module the installed Microsoft.PowerShell.Utility manifest in the same PowerShell5.1 process, verify existing Get-G3MigrationStatus.ps1 SHA256 fb00fee44b42352df4b8dbfc9c73dcafacb742a247b4a65d0f8d05d28363a360, then invoke that unchanged helper with -Action Status -ReadOnlyStatusAuthorized. The parent import fixes known command discovery without changing any helper bytes. Confirm no status-only-started.json/result.json exists before execution; never delete old attempt evidence. Existing helper independently checks other pins, versions, exact seven migrations, private ConsoleHost, target and options, then repeats reader identity preflight before fixed native Prisma migrate status. These repeated connections must be covered by R2 approval. No raw URLs/passwords in output.

Smallest R2 approval request:

> Authorize exactly ONE guarded R2 live STATUS-ONLY attempt using the unchanged pinned Get-G3MigrationStatus.ps1 on PostgreSQL18.6 at127.0.0.1:5432/flywithsafe_g3_auth02_disposable as flywithsafe_g3_status_reader. Include explicit installed Utility-module import in the private caller, offline integrity checks, repeated reader preflight, fixed Prisma7.10.0 migrate status and sanitized evidence. Use existing reader password privately. Stop on any failure/output mismatch without retry, repair or privilege expansion. Exclude provisioning, password/role/grant changes, migrations, fixtures, G3-P/X and deployment.

Expected acceptance remains exact seven pending names, preflight exit0 and reviewed native status exit1 with expected pending output, successful helper marker and sanitized result. Empty-history formatting/engine/catalog privilege compatibility is unverified until execution; do not treat any native exit1 as PASS without all exact output checks. R1 does not establish Prisma's effective session settings. Seven-migration initialization remains a later distinct authorization.
