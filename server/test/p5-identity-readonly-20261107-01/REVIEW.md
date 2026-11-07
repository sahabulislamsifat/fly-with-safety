# P5 v05 identity mismatch — focused findings and read-only review

Status: OFFLINE PREPARATION ONLY. No new PostgreSQL connection, setup, migration, role operation or v06 caller executed/prepared.

Policy record: planning=compact; context_depth=dependency; verification_depth=impact; delegation=none. Scope: this diagnostic directory only; consumed packages and implementation report unchanged.

## Confirmed defect and remaining historical uncertainty

`server/test/p5-setup-v05/run.cjs:20` selects `inet_server_addr()::text AS address`.
`server/test/p5-setup-v05/policy.cjs:48` requires exact address `127.0.0.1`, numeric port 5432, configured database and supplied maintenance user.
PostgreSQL 18 official documentation states that explicit inet-to-text conversion retains the netmask, including /32 for IPv4. `host(inet_server_addr())` returns only the IP address. Thus the query representation and strict address predicate are incompatible even for the intended IPv4 loopback server. This is a CONFIRMED implementation defect; a documented-shape offline fixture reproduces the exact guard error.

Reference: https://www.postgresql.org/docs/18/functions-net.html (Table 9.40, abbrev, host and text).

The actual identity row was not saved. Consequently the historical address value and any additional failed database/role/port comparisons remain UNKNOWN. Do not claim the observed historical value was 127.0.0.1/32. The expected maintenance username came from private input, not a persisted field; the new diagnostic deliberately fixes it to postgres as requested. Server version and cluster fingerprint are not part of this failing predicate. OID validation is a separate subsequent guard at policy.cjs:49.

Minimal setup correction for subsequent owner review: change only `inet_server_addr()::text AS address` to `host(inet_server_addr()) AS address`; retain exact IP/port/database/role and OID checks. This candidate SQL is included in the diagnostic for comparison, NOT applied to consumed v05. No v06 is generated.

## Historical execution effects

Saved result/journal: `output/phase5/p5-approved-setup-20261107-05/`.
The guard was raised after connection, session-local SET statement_timeout and the identity SELECT at run.cjs:36. Therefore this was not a before-network failure. Database/DDL counters in caller-result remain null/unknown; they are not reported as zero.

Name-conflict inspection starts later (run.cjs:42); CREATE ROLE starts at line 48 and CREATE DATABASE at line 52. These operations are unreachable after this identity exception. Saved resourcesCreated=[], migrations=[], oid=null, connectionsClosed=true. The oid field is the future P5 database OID, not a recorded maintenance DB OID. Source and saved evidence establish no resource-creation path was reached by this run; no new live catalog check has established current name availability. Outer result also explicitly retains currentStageOutcomeUnconfirmed=true.

The 4,321 v05 manifest file pins verified without mismatch. The 18 saved files across v01–v05 were hashed into historical-seal.json without modifying originals.

## Separate approval requested: one identity observation

Fixed target: host and hostaddr 127.0.0.1, port 5432, DB postgres, user postgres. No Git Bash/default-service target inference.

The supplied caller checks the SQL and installed psql binary hashes, atomically creates a fresh attempt marker, clears inherited PG* environment overrides in process memory and restores them on exit. psql -X ignores startup files; -W obtains the existing password through its native private prompt, never from arguments, history or a new plaintext file. No new role-password policy is applied.

One psql connection only; connect timeout 5 seconds, statement timeout 5 seconds, lock timeout 2 seconds. Password entry itself is interactive and has no claimed wall-clock limit. No automatic retry. READ ONLY is set at connection startup and in an explicit transaction; final ROLLBACK. A connection loss closes/rolls back the transaction. No DDL or business writes.

Collect only current/session role, maintenance DB name/OID, server address in both representations, port, read-only flag and exact comparison booleans. Do not query application data, role grants, passwords, P5 conflict catalogs, financial fixtures, server control-system identifiers or cloud targets. Output contains only these identity observations and transaction command tags. Native errors use SQLSTATE verbosity. Observation completion is NOT setup acceptance.

Caller SHA256: B8D9E45DED998AC3EDB3C7B0EE8E077EF0B8395D5DB383191B4ACD3B3CB12AA2

SQL SHA256: 974F2A485D5F7FDEC16D45AD0BD8DA8234C641A42B032A26A719506FA7EEF14F

psql.exe SHA256: 945EB0BBF8475A7FB0C863D85E36F2E15CF6B2D9FADB4D617BE4E59D4BB17BB0

Only after separate owner approval, run in a private Windows PowerShell 5.1 console:

```powershell
& {
  $ErrorActionPreference = 'Stop'
  $p = 'E:\Programming\Project\fly-with-safety\server\test\p5-identity-readonly-20261107-01\Invoke-IdentityReadOnly.ps1'
  if ((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -cne 'B8D9E45DED998AC3EDB3C7B0EE8E077EF0B8395D5DB383191B4ACD3B3CB12AA2') {
    throw 'STOP: identity caller hash mismatch'
  }
  & $p -OwnerApprovedReadOnlyIdentity
}
```

No execution-policy bypass. Failure consumes the diagnostic attempt; preserve output and stop. No setup continuation is chained to this command.
