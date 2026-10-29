# G3 STATUS-ONLY — Code-Only Approval Package

> **Current governance (owner-directed 2026-10-28):** [Tracker section 0](PHASE_1_INTERIM_STATUS_AND_EXIT_CHECKLIST.md#0-governing-owner-decision--2026-10-28-supersedes-prior-engineering-gate-wording) supersedes older bespoke legal-checklist and automatic counsel-signature requirements for G7 engineering acceptance. All technical controls remain mandatory. Real-data/production activation remains separately gated. Dated findings and acceptance evidence below are preserved, not re-certified.


2026-10-26, Asia/Dhaka. **PROPOSED — NOT OWNER-APPROVED; EXECUTABLE HELPER NOT CREATED; NO LIVE STATUS EXECUTION.**

## Evidence and exact scope

Current baseline: development, HEAD bbeb862b03949056c1f93539631ad31c054a11ab, initially clean. Owner directly confirmed `G3_OFFLINE_SEVEN_MIGRATION_GUARDS_PASS` and `G3 Offline exit code: 0` in the accessible Windows PowerShell 5.1 console. This closes the earlier owner-console Offline prerequisite only. It does not establish current database status.

The attached ZIP is a draft preparation package, SHA256 `9358b9af8f9e41c8e459d6548850b82cf065b591f20f1348a1aae0582118b2b4`. Its prompt A proposes a new independent script; it supplies no existing executable STATUS-ONLY implementation. Earlier source IDs/statuses and proposed evidence entries are not approvals.

Proposed implementation: create exactly ONE file, after code-only approval:

`C:\Users\sahab\.codex\visualizations\2026\10\21\01a15fd3-69ff-7843-bea7-539c3d6111f9\g3-migration-initialization-20261026-01\Get-G3MigrationStatus.ps1`

Preserve all existing helpers, SQL, Prisma configuration, seven migrations, application files, environment files and dependencies. No code-only approval permits a database connection. Documentation evidence already authorized in this session is separate.

## Reachability and command allowlist

`Offline` -> seven-name/raw-byte guards -> three existing helper/config hashes -> CLI/client package version checks -> return. No child process, credentials, output markers or database connection.

`Status + ReadOnlyStatusAuthorized` -> identical guards -> private ConsoleHost/one-attempt checks -> private administrator input -> fixed Identity child -> fixed Status child -> exact pending parser -> status-only evidence -> return.

Only two child commands are constructible:
1. Installed psql: `-X -w ... -d "host=127.0.0.1 port=5432 dbname=flywithsafe_g3_auth02_disposable user=postgres connect_timeout=2" -f "<pinned preflight.readonly.sql>"`.
2. Installed Node + installed Prisma CLI: `migrate status --config "<pinned prisma.g3.config.cjs>"`.

No caller-provided executable, SQL or arbitrary command arguments. No imports/invocation of Initialize-AfterApproval.ps1, application code or migration runner. No initialization/deployment markers. No package installation, schema initialization, role change, fixture, cleanup or repair entry point.

The installed Prisma 7.10.0 status handler was inspected: it diagnoses migration history with `optInToShadowDatabase:false`, lists migration directories, stops its engine and reports status. Its console output may contain suggested mutation commands; those strings are output only, never executed by this proposal. Version/name/hash mismatch or unexpected pending output stops.

Database read-only scope is enforced for psql through PGOPTIONS and the pinned SQL's READ ONLY transaction. The Prisma child uses the fixed read-only status command; this proposal does NOT claim the postgres role itself is restricted to reads or that libpq PGOPTIONS is proven to govern the Rust schema engine. No OS-wide egress confinement or defense against a compromised local administrator/tool is claimed. A reviewer requiring server-enforced read-only Prisma sessions must first approve and verify a compatible connection-option/configuration design; do not invent that guarantee.

## Isolation, results and failure boundaries

- Exact target/user/owner and PG 18.6 verified by the existing SQL; empty schema/history, NOLOGIN/ACL/timeout and no other target session remain required.
- All seven existing raw SQL hashes are embedded; the original manifests and SQL are not replaced.
- Existing isolated config pins literal 127.0.0.1:5432, exact database/admin/schema, matching runtime/CLI URLs; imports no dotenv/application modules.
- Child environments remove PG*, PRISMA*, DOTENV*, DEBUG/NODE_DEBUG, Node preload/path and connection-URL overrides. Parent environment/files stay unchanged.
- Existing postgres password entered privately, no new password. Transient process memory/child environment holds authentication material. No password-bearing command args; URL/password output redaction. No absolute memory-erasure guarantee.
- Native engine binary is local; checkpoint/update notices disabled. No supplier, SMTP, payment or KMS modules imported.
- Each owned read-only child has a 20-second wait bound. On expiry, terminate only that Process object; stop without retry or database/backend termination. Child-engine cleanup may require subsequent read-only investigation.
- Fresh pending success requires Prisma exit 1 AND seven-count message AND pending-history wording AND exactly seven expected standalone migration-name lines. Exit 0, connection errors, divergent/failed history, duplicates, extras, missing names or unexpected wording all stop.
- Status evidence uses only `status-only-started.json`, stage logs/results and `status-only-result.json`; never initialization markers.
- Existing status attempt/results block rerun. No automatic retry, deletion, history repair or migration.
- Failures retain sanitized stage output and native exit codes. A PowerShell process failure and an expected Prisma pending exit 1 are different outcomes.

## Acceptance checks after code-only authorization

1. Windows PowerShell 5.1 syntax parsing, no profile or execution-policy bypass.
2. Offline execution: marker and actual process exit 0, no password prompt/network/child call or status artifacts.
3. Exact names/raw hashes plus all existing helper/config pins. Changed bytes or extra/missing migration reject.
4. Existing 14 synthetic configuration checks: fixed target accepted; aliases/remote/original databases/other ports/users/schema/query overrides/mismatched URLs rejected.
5. AST/static command allowlist, no arbitrary child arguments and no forbidden mutation command invocation. Only Offline/Status parameters.
6. Synthetic pending-parser vectors: expected seven/exit1 pass; exit0, connection failure, divergent history, missing/extra/duplicate/reordered names and ANSI output classified correctly. Ordering is compared as a set after exact count; raw SQL sequence remains chronologically pinned.
7. Failure/output redaction with synthetic sentinels, no credential output; timeout and one-attempt guards reviewed.
8. Hash the created source and compare with the reviewed code block after canonical LF normalization; report the actual raw Windows file hash separately.
9. No live database, application tests, migrations, provider operations or existing file modifications.

Current documentation preparation verifies only proposed-source parsing/static structure. Items requiring an executable helper remain NOT RUN until code-only approval. Live status remains a later private-console operation; no command to execute it is issued now.

## Proposed source — for review only

```powershell
# PROPOSED SOURCE ONLY. Creation and live execution require their own approval.
[CmdletBinding()]
param([ValidateSet('Offline','Status')][string]$Action='Offline',[switch]$ReadOnlyStatusAuthorized)
$ErrorActionPreference='Stop'
$server='E:\Programming\Project\fly-with-safety\server'
$psql='C:\Program Files\PostgreSQL\18\bin\psql.exe'
$config=Join-Path $PSScriptRoot 'prisma.g3.config.cjs'
$before=Join-Path $PSScriptRoot 'preflight.readonly.sql'
$after=Join-Path $PSScriptRoot 'postcheck.readonly.sql'
$pins=@'
20260926202822_init efda6a0cd3d01b2503e4cc1557f8aba2807664db545a742e52eaca60a3b2e1cb
20260927082715_full_schema ae3bcd7668f026858ee7e43cbceb9955c451a1bf648520e6afb7814ce2cc7921
20261009000000_auth_sessions_and_password_resets e1eb929668d33cbe94f07e7512cb7174084150c50683a2e15f5709509b53e1b4
20261011000000_inquiry_idempotency 0316f0857663d04900e1ceae1e305490a9b97e49192f9aad2f74bb2f494c6706
20261011120000_notification_outbox 1ecc18d0e4381cdf0489a9919f61b58c3f9f1a3bd102303ccf1fa5f81e14eca2
20261022000100_contact_status_new 4c9af2c97dd22a88cb3b7e5fe5422ac1023bcc86fcde999409033ac5180178a7
20261022000200_booking_contact_schema bc10e7343b3c40769c43deee8b3164245319a9f35d7a3b50d4e3ee721895f32b
'@
$records=@($pins -split '\r?\n' | ForEach-Object { $parts=$_ -split ' '; [pscustomobject]@{Name=$parts[0];Hash=$parts[1]} })
$directories=@(Get-ChildItem -LiteralPath (Join-Path $server 'prisma/migrations') -Directory | Sort-Object Name)
if($directories.Count -ne 7 -or (Compare-Object @($records.Name) @($directories.Name))) { throw 'Migration set mismatch.' }
foreach($record in $records) {
  $file=Join-Path $server "prisma/migrations/$($record.Name)/migration.sql"
  if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $record.Hash) { throw 'Migration bytes changed.' }
}
foreach($item in @(
  @($config,'478DF116079E2B3381EA3C39C12E627C5B173C2DEE18B2AEFA040C471821DF59'),
  @($before,'764160417913A1E31A2B1D89CFAF094529AAE6EEFA87212E3FA159F622B07527'),
  @($after,'47594DA0BB9318A76CDD5C69F12CC33A716E7C18DC3DEB370C07C69D27492518')
)) {
  if((Get-FileHash -LiteralPath $item[0] -Algorithm SHA256).Hash -cne $item[1]) { throw 'Reviewed helper changed.' }
}
foreach($package in @('prisma','@prisma/client')) {
  $version=(Get-Content -LiteralPath (Join-Path $server "node_modules/$package/package.json") -Raw | ConvertFrom-Json).version
  if($version -cne '7.10.0') { throw 'Prisma version changed.' }
}
if($Action -eq 'Offline') { Write-Host 'G3_OFFLINE_SEVEN_MIGRATION_GUARDS_PASS'; return }
if(-not $ReadOnlyStatusAuthorized) { throw 'Reviewed live read-only status authorization required.' }
if($Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected) { throw 'Accessible private ConsoleHost required.' }
$resultFile=Join-Path $PSScriptRoot 'status-only-result.json'
$startedFile=Join-Path $PSScriptRoot 'status-only-started.json'
if((Test-Path -LiteralPath $resultFile) -or (Test-Path -LiteralPath $startedFile)) { throw 'Prior attempt exists. No automatic retry.' }
$node=(Get-Command node.exe -ErrorAction Stop).Source
$cli=Join-Path $server 'node_modules/prisma/build/index.js'
$engine=Join-Path $server 'node_modules/.pnpm/@prisma+engines@7.10.0/node_modules/@prisma/engines/schema-engine-windows.exe'
if(-not (Test-Path -LiteralPath $psql) -or -not (Test-Path -LiteralPath $engine)) { throw 'Installed local tools missing.' }
$secret=$null; $pointer=[IntPtr]::Zero; $plain=$null; $encoded=$null; $url=$null
function Invoke-StatusStage([ValidateSet('Identity','Status')][string]$Stage) {
  $IsPrisma=$Stage -eq 'Status'
  if($IsPrisma) {
    $Executable=$node
    $Arguments='"'+$cli+'" migrate status --config "'+$config+'"'
    $Label='status-only-pending'
  } else {
    $Executable=$psql
    $Arguments='-X -w -v ON_ERROR_STOP=1 -P pager=off -d "host=127.0.0.1 port=5432 dbname=flywithsafe_g3_auth02_disposable user=postgres connect_timeout=2" -f "'+$before+'"'
    $Label='status-only-identity'
  }
  $info=New-Object Diagnostics.ProcessStartInfo
  $info.FileName=$Executable; $info.Arguments=$Arguments; $info.WorkingDirectory=$PSScriptRoot
  $info.UseShellExecute=$false; $info.CreateNoWindow=$true
  $info.RedirectStandardOutput=$true; $info.RedirectStandardError=$true
  foreach($key in @($info.EnvironmentVariables.Keys)) {
    if($key -match '^(PG|PRISMA|DOTENV|NODE_OPTIONS$|NODE_PATH$|DEBUG$|NODE_DEBUG$)' -or $key -match '(DATABASE|DIRECT|INTEGRATION).*URL') {
      $info.EnvironmentVariables.Remove($key)
    }
  }
  if($IsPrisma) {
    $info.EnvironmentVariables['DATABASE_URL']=$url; $info.EnvironmentVariables['DIRECT_URL']=$url
    $info.EnvironmentVariables['PRISMA_SCHEMA_ENGINE_BINARY']=$engine
    $info.EnvironmentVariables['CHECKPOINT_DISABLE']='1'
    $info.EnvironmentVariables['PRISMA_HIDE_UPDATE_MESSAGE']='true'
    $info.EnvironmentVariables['NO_UPDATE_NOTIFIER']='1'
  } else {
    $info.EnvironmentVariables['PGPASSWORD']=$plain
    $info.EnvironmentVariables['PGOPTIONS']='-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=5000'
  }
  $process=New-Object Diagnostics.Process; $process.StartInfo=$info
  try {
    if(-not $process.Start()) { throw 'Child process did not start.' }
    $stdout=$process.StandardOutput.ReadToEndAsync(); $stderr=$process.StandardError.ReadToEndAsync()
    if(-not $process.WaitForExit(20000)) {
      # Only terminate this owned read-only child. Never terminate a PostgreSQL backend or another process.
      $process.Kill()
      $process.WaitForExit()
      throw 'Owned read-only child timed out. Stop; no automatic retry.'
    }
    $text=[regex]::Replace(($stdout.Result+[Environment]::NewLine+$stderr.Result),'\x1B\[[0-?]*[ -/]*[@-~]','')
    $safe=$text.Replace($url,'[LOCAL_DATABASE_URL_REDACTED]').Replace($encoded,'[REDACTED]').Replace($plain,'[REDACTED]')
    $safe=[regex]::Replace($safe,'(?i)postgres(?:ql)?://[^\s]+','[DATABASE_URL_REDACTED]')
    [IO.File]::WriteAllText((Join-Path $PSScriptRoot ($Label+'.log')),$safe)
    [IO.File]::WriteAllText((Join-Path $PSScriptRoot ($Label+'-result.json')),('{"exitCode":'+$process.ExitCode+'}'))
    Write-Host $safe
    return [pscustomobject]@{ExitCode=$process.ExitCode;Output=$safe}
  } finally { $info.EnvironmentVariables.Clear(); $process.Dispose() }
}
try {
  $secret=Read-Host 'Existing local postgres password (private; never paste into chat)' -AsSecureString
  $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  if([string]::IsNullOrEmpty($plain)) { throw 'Private authentication required.' }
  $encoded=[Uri]::EscapeDataString($plain)
  $url='postgresql://postgres:'+$encoded+'@127.0.0.1:5432/flywithsafe_g3_auth02_disposable?schema=public&connect_timeout=5'
  [IO.File]::WriteAllText($startedFile,('{"startedUtc":"'+[DateTime]::UtcNow.ToString('o')+'"}'))
  $check=Invoke-StatusStage 'Identity'
  if($check.ExitCode -ne 0 -or $check.Output -cnotmatch '(?m)^\s*G3_MIGRATION_PREFLIGHT_PASS\s*$') {
    throw 'Read-only identity/empty-target preflight failed.'
  }
  $status=Invoke-StatusStage 'Status'
  if($status.ExitCode -ne 1 -or $status.Output -notmatch '7 migrations found' -or $status.Output -notmatch 'not yet been applied') {
    throw 'Unexpected pending-status result. Stop.'
  }
  $names=@([regex]::Matches($status.Output,'(?m)^\s*(\d{14}_[a-z0-9_]+)\s*$') | ForEach-Object {$_.Groups[1].Value})
  if($names.Count -ne 7 -or (Compare-Object @($records.Name) @($names))) {
    throw 'Exact seven pending names not established.'
  }
  [IO.File]::WriteAllText($resultFile,'{"passed":true,"identityExitCode":0,"prismaStatusExitCode":1,"pendingCount":7,"migrationExecuted":false}')
  Write-Host 'G3_STATUS_ONLY_PENDING_SEVEN_PASS'
  return
} catch {
  if(Test-Path -LiteralPath $startedFile) { [IO.File]::WriteAllText($resultFile,'{"passed":false,"automaticRetryForbidden":true,"reviewSanitizedLogs":true}') }
  Write-Host 'STATUS_ONLY_STOPPED. Review sanitized stage logs; no automatic repair or retry.'
  throw 'G3 read-only status did not complete all gates.'
} finally {
  if($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  if($null -ne $secret) { $secret.Dispose() }
  $plain=$null; $encoded=$null; $url=$null
}
```

## Exact next owner approval request

Documentation-stage verification: **21 static documentation/security-scope checks passed, 0 failed**; proposed source parsed successfully with Windows PowerShell 5.1 without execution; git diff --check passed. Canonical proposed-source SHA256 (UTF-8, LF, one final newline): `ba3a7fa024f9fa7f47342411fe413466304fa88d03ea32e18caa536dbe64334b`. No executable helper exists. This is not evidence that pending-status parsing, child timeouts/redaction or live PostgreSQL execution have passed.

> I authorize code-only creation of the single Get-G3MigrationStatus.ps1 file at the exact path above, using the reviewed source in this document, plus offline syntax, integrity, isolation, parser and redaction verification. Preserve every existing helper/config/SQL/application/environment file. Do not connect to PostgreSQL, execute live Status, apply migrations, activate LOGIN, grant permissions, change authentication/credentials, create fixtures, run G3-X or call external services. Report the final hash, actual offline results and proposed private-console invocation, then stop for the live read-only status gate.

After accepted live STATUS-ONLY evidence, request the seven-migration authorization separately. All L-01–L-14 remain BLOCKED. AUTH-01/02/03, OUT-01–04, KMS-01–03, DB-01–04 and G5/G6/G7 remain individually tracked in the canonical interim checklist; no Phase 1 exit is inferred.

## Post-acceptance session-safety review — LIVE HOLD (2026-10-26)

The owner accepted the preceding CODE-ONLY/offline milestone. That acceptance does not establish effective restrictions on a live PostgreSQL connection. Current helper/configuration files remain unchanged.

### Current enforcement and reconfirmation

| Control | Fresh source/integrity result | Live-evidence boundary |
|---|---|---|
| Exact target | Literal 127.0.0.1:5432/flywithsafe_g3_auth02_disposable, postgres user/session/owner, PG18.6 required by pinned preflight | Not reconnected here; earlier database identity/catalog results retain original timestamps |
| Script integrity | Existing helper SHA256 ba3a7fa024f9fa7f47342411fe413466304fa88d03ea32e18caa536dbe64334b | Offline milestone accepted; no live Status run |
| Configuration integrity | Existing migration config SHA256 478df116079e2b3381ea3c39c12e627c5b173c2dee18b2aefa040c471821df59; seven SQL hashes still match | Fixed schema/connect timeout only; NO read-only startup parameter in that URL |
| psql session | PGOPTIONS sets default_transaction_read_only=on and statement/lock timeouts 5000ms; SQL BEGIN READ ONLY and identity assertion | Enforced/asserted for that psql transaction only |
| Prisma session | Separate child gets DATABASE_URL/DIRECT_URL, local engine and update/checkpoint controls; all ambient PG* removed | NO explicit Prisma-session read-only default or server statement/lock timeout is supplied |
| Private authentication | Existing password via secure console prompt; child environment only, no password in arguments, redacted output | Managed-memory/local process visibility limitations persist; no password requested in this review |
| Remote fallback | Child environment filtering plus exact isolated URL/config, no dotenv/application import | Source-backed; not OS-wide egress confinement |
| Command scope | Fixed identity preflight and fixed migrate status; no deployment/fixture/role-write entry point | Trusted installed command behavior is distinct from server-enforced permissions |
| Evidence/failure | Sanitized stage logs/native exits; exact pending set; single-attempt guard; owned-child timeout/no auto retry | External child cleanup and live error handling are not integration-verified |

**Finding RO-01:** the psql transaction cannot constrain the separate Prisma connection. The restricted test role's stored five-second timeout also does not apply to administrator postgres. A 20-second process wait is not a database-side statement timeout. Prior successful psql settings must never be labeled effective Prisma settings.

**Current disposition:** retain the CODE-ACCEPTED/offline record; withhold the previously prepared live command pending the explicitly requested session-safety review/hardening. No connection, role/grant change, migration or new executable configuration was performed.

### Version-pinned primary technical evidence

Installed Prisma/client packages are 7.10.0. Installed engines metadata identifies commit `0edf323efd1d98336f3f0a68684b56f689b900d3`. Installed CLI source SHA256 observed: `20e0bccfb7eef5f15c430bbbb1a769b0acbdd063efc97b5d6eda3dbf50518e39`.

- [PostgreSQL 18 transaction access modes](https://www.postgresql.org/docs/18/sql-set-transaction.html): transaction/session scope and override semantics; read-only disallows specified persistent writes/DDL but is not a universal no-disk-write guarantee.
- [PostgreSQL 18 client defaults](https://www.postgresql.org/docs/18/runtime-config-client.html): default_transaction_read_only normally defaults off; transaction_read_only reflects the current transaction. This is a default, not credential privilege removal.
- [Pinned Prisma URL parser](https://github.com/prisma/prisma-engines/blob/0edf323efd1d98336f3f0a68684b56f689b900d3/quaint/src/connector/postgres/url.rs): reads the URL options value into its connection configuration.
- [Pinned native connector](https://github.com/prisma/prisma-engines/blob/0edf323efd1d98336f3f0a68684b56f689b900d3/quaint/src/connector/postgres/native/mod.rs): to_config passes parsed options to the native PostgreSQL client configuration.
- [Pinned schema-engine native connection](https://github.com/prisma/prisma-engines/blob/0edf323efd1d98336f3f0a68684b56f689b900d3/schema-engine/connectors/sql-schema-connector/src/flavour/postgres/connector/native/mod.rs): routes native URLs through that connector.
- [Pinned migration-history diagnosis](https://github.com/prisma/prisma-engines/blob/0edf323efd1d98336f3f0a68684b56f689b900d3/schema-engine/commands/src/commands/diagnose_migration_history.rs): the non-shadow history path reads migration metadata. Installed CLI invokes diagnosis with shadow opt-in disabled. This supports command intent, not observed effective live GUC values.

Directory/API inspection resolved moved source paths after initial 404s. Unpinned main-branch source was not substituted for installed-version evidence.

### Proposed minimum code-only hardening — NOT IMPLEMENTED

Exact candidate file scope (both alongside existing local helpers):
1. MODIFY `Get-G3MigrationStatus.ps1`.
2. CREATE `prisma.g3.status.config.cjs`.

Preserve the original `prisma.g3.config.cjs` used by migration initialization, Initialize helper, both SQL scripts, seven migrations, application files, environment files and dependencies. Do not ALTER ROLE/DATABASE, grant permissions or activate LOGIN.

Proposed helper delta:
- Select the new dedicated status configuration filename instead of the migration configuration.
- Replace only the selected-config hash pin with the reviewed new configuration hash below.
- Construct both matching child database URLs using the exact constant suffix below.
- Retain all existing guards, literal target, private input, redaction, stage allowlist, expected pending parser, one-attempt behavior and read-only psql preflight. Do not introduce db execute, native arbitrary-SQL RPC, proxy, new network endpoint or general command path.

Exact new URL suffix (no credentials):

```text
?schema=public&connect_timeout=5&socket_timeout=10&application_name=flywithsafe_g3_status_only_ro&options=-c%20default_transaction_read_only%3Don%20-c%20statement_timeout%3D5000%20-c%20lock_timeout%3D5000%20-c%20idle_in_transaction_session_timeout%3D5000
```

Its decoded startup options are `-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=5000`. Socket timeout is ten seconds; connection timeout five seconds; application_name is fixed. These are proposed engineering bounds, not legal requirements.

Proposed full new configuration source (documentation only):

```javascript
// PROPOSED status-only configuration; not a migration deployment configuration.
const { defineConfig } = require('E:/Programming/Project/fly-with-safety/server/node_modules/prisma/config.js');
const suffix = '?schema=public&connect_timeout=5&socket_timeout=10&application_name=flywithsafe_g3_status_only_ro&options=-c%20default_transaction_read_only%3Don%20-c%20statement_timeout%3D5000%20-c%20lock_timeout%3D5000%20-c%20idle_in_transaction_session_timeout%3D5000';
const direct = process.env.DIRECT_URL;
const match = typeof direct === 'string'
  ? /^postgresql:\/\/postgres:[^@/?#]+@127\.0\.0\.1:5432\/flywithsafe_g3_auth02_disposable(\?[^#]*)$/.exec(direct)
  : null;
if (!match || match[1] !== suffix || direct !== process.env.DATABASE_URL) {
  throw new Error('Exact matching read-only G3 status targets required');
}
module.exports = defineConfig({
  schema: 'E:/Programming/Project/fly-with-safety/server/prisma/schema.prisma',
  migrations: { path: 'E:/Programming/Project/fly-with-safety/server/prisma/migrations' },
  datasource: { url: direct },
});
```

Canonical proposed config SHA256 (UTF-8/LF/one final newline): `1854e94aeb72cf3034d98f4c3f02b71c99d250b1ab9ac236160a897775b4844d`.

In-memory synthetic review: **15 checks passed, 0 failed**, including missing/off/overridden read-only options, disabled timeouts, wrong application identity and remote/alias/database/port/role/schema/URL mismatch rejection. The require/defineConfig interface was stubbed; no configuration file, helper patch, real Prisma connection or server check was created/executed. This is proposal validation, not completion of a new code package.

### Proof limits, approval sequence and stop conditions

Startup options would provide server-processed read-only defaults on each native Prisma connection while the reviewed command leaves them intact. Because postgres remains privileged, they are not an unbypassable authorization boundary: an explicitly read-write command/settings change could override defaults. This proposal never permits such a command.

For strict privilege-level write denial, a separately reviewed least-privilege design is necessary; current authorization prohibits provisioning/role/grant changes. Do not represent startup options or a dedicated application_name as removing administrator privileges.

After any separately approved code-only hardening, rerun PowerShell 5.1 offline integrity, exact-command, parser, redaction, override/option-removal and compatibility tests. Verify the migration configuration stays unchanged. Source-to-native-connection proof must include the pinned parser/connector behavior; current effective Prisma-session values cannot be established from another psql session or pg_stat_activity identity alone.

Before declaring a LIVE read-only-settings PASS, require an explicitly reviewed engine/connection-specific read-only observation or an expressly accepted source-backed startup enforcement/remaining-observability limitation. No generic SQL/proxy/RPC implementation is approved by this proposal. If an exact same-connection proof is required, design that observation first under a separate reviewed scope; do not silently call a different driver's session equivalent.

Then request a separate narrowly scoped live read-only authorization, with any unresolved observation limitation explicit. Current actual database identity, role/ACL state, effective settings and seven pending names must be freshly established under that approval. A failed guard/unknown setting blocks continuation; no attempted write is permitted as a test.

### Next owner decision

> Authorize CODE-ONLY hardening of Get-G3MigrationStatus.ps1 and creation of prisma.g3.status.config.cjs at the existing G3 artifact directory, limited to the status-config selection/hash and exact read-only startup-option URL changes above, plus offline verification. Preserve all other files and prior evidence. Do not connect to PostgreSQL, change roles/grants/authentication/database settings, execute Status/migrations/G3-X, or call external services. Report remaining connection-specific observation limits before requesting live permission.

This is a code-hardening proposal only. It does not supply a final live authorization or claim the existing accepted helper already enforces read-only Prisma sessions.
