# One local read-only verification — NO execution approval yet

Target only PostgreSQL127.0.0.1:5432/flywithsafety_local_integration,
flywithsafe_phase2_booking_test,OID34701. No public/SSH/browser/provider connection,
normal service change, cloud access, financial write, schema/permission change or retry.

## Saved failure and exact defect

Original ../genuine-sandbox-e2e-20261104-01 remains immutable/consumed.
readonly-preflight.json proves identity,8migrations,4actors,recipient and permission
guards returned successfully. Main's stage still says db-readonly-preflight while
performing preserve(). Its first query repeats migration columns; second query is
the public catalog snapshot returning pg_class.relkind (PostgreSQL internal char).
All later normal string/boolean/time/OID columns have adapter mappings; char does not.

Real installed PrismaClient + PrismaPg with a mocked pg wire result reproduces
P2010/meta.driverAdapterError.cause={kind:UnsupportedNativeDataType,type:char}, with
no SQLSTATE. This is adapter result decoding, not server SQL syntax or permissions.
PostgreSQL catalog documentation confirms relkind's type. Original result saved
only P2010/null SQLSTATE, not nested kind/type or per-query stage: exact historical
native error is irrecoverable. Source ordering, successful saved guard result and
deterministic reproduction identify the defective snapshot projection; live native
metadata and corrected projection remain separately unverified until this approval.

Also reproduced: raw OID maps to JS bigint; JSON.stringify(snapshot) then throws.
Minimal VERSIONED replacement preserves all guards and all selected columns:
relkind::text AS relkind,relowner::text AS relowner,atttypid::text AS atttypid.
Owner/type values retain full decimal precision. No dropping catalog/ACL checks.
Original preflight.ts and approved caller/pins/results are NOT edited/rebuilt.
New safe diagnostics retain operation enum, allowlisted adapter kind/type and native
SQLSTATE from bounded own-data error paths; no arbitrary messages/getters/raw data.

## Exact one-time workflow

Invoke-ReadOnlyPreflight.ps1 -OwnerApprovedReadOnlyPreflight verifies manifest,
source/runtime pins, absence of attempt/output; creates caller marker atomically.
Existing restricted-role password only at masked private prompt; no credential in
arguments/history/env file. Clean child configuration sets URL/DIRECT parity and
requires --owner-approved-readonly-preflight plus PHASE3_READONLY_APPROVED=true.
No dotenv/merchant credential reading. Existing normal processes untouched.

Pool uses default_transaction_read_only=on,10s connection/statement timeout,
15s client-query timeout,max1. Native read-only identity MUST verify exact target,
role,OID,host/port and transaction_read_only before any catalog/application read.
Native pg executes EXACT original catalog SELECT, retains only relkind wire OID18
boolean (no raw rows/headers). Then same installed Prisma adapter, in explicit
READ ONLY transaction, executes unchanged identity/migration/actor/absence/permission
guards and corrected full preservation snapshot; test JSON serialization in memory.
Controlled sentinel forces ROLLBACK; successful rollback required for PASS.
No User/session/booking/payment payload or snapshot is persisted. Only enums, query
operation labels, guard booleans, catalog row count and sanitized failure codes.

Runner deadline90s; transaction<=60s; parent wait<=110s. On timeout/any fail preserve
markers/output and STOP, no retry/repair/termination of unrelated processes.
This does not authorize a genuine provider batch. After live PASS, prepare a new
versioned batch using corrected helper under separate execution approval. Accepted
transport7/7,PG64 and injected-browser79 are not rerun. Phase3 NOT ACCEPTED,Phase4 held,$0.

## Prior operation/preservation scope

Original counts={},cases=[],notices=[]; no SSH-process/assigned-origin ledger exists.
owned-final.json has empty owned bookings/passengers/history/payment/events/outbox.
Only read-only guard/snapshot/final-snapshot attempts occurred before failure, plus
local evidence files/private process key. Protected baseline was incomplete, so no
claim of completed preservation comparison. No mutation path was reached by source
ordering; live current fixture absence and preservation reads are rechecked here.
