# Phase3 initiation recovery — minimal read-only next action

Historical proof is consumed: `postgres-proof-20261103-01`, native read-only exit0, business exit1. Ten checkpoints passed;54 unexecuted. No checkpoint assertion failed; an application CONFLICT stopped the test. Original exception message/contender index/session timezone were not captured. All eight calls used the same owner/booking/request/payload. Exactly one intent with replay-equivalent payment identity is the unchanged contract.

Saved final snapshot:4 User +2 Booking +2 Passenger +2 initial History =10 retained synthetic rows; no owned payment/refund/event/outbox. This is an observed historical snapshot, not a fresh database inventory. Six previous users/one Session were counted before the test; final unlisted preservation checks were not executed. No cleanup or database write has occurred in this recovery.

Confirmed application defect: installed adapter-pg7.10.0 drops a timestamptz offset without shifting wall time. Real-adapter offline reproduction under +06 makes a future1h quote appear expired; eight identical contenders then reject before any intent. Current source changes only clock/audit raw outputs to `AT TIME ZONE 'UTC'`. Lock order, server clock placement, expiry boundaries, deadlines, pool, request conflicts, ownership, leases, financial constraints and provider authority remain unchanged. This is not yet conclusive attribution of the historical CONFLICT; its original guard/timezone are absent.

Verification:117PASS/0FAIL/0SKIP per bundled/native loader (12new tests), strict/source-test and server TypeScript exit0, scoped ESLint0errors/0warnings, Prisma7.10.0 validate exit0 using a synthetic-only config, diff PASS. Initial sandbox107PASS/10loopback-EACCES failures are preserved separately; normal loopback execution passed all117. SQL parser checks9 read-only statements/1PLpgSQL block plus11 payment-store queries. NativePS5.1 parsing0errors. `review-verification.json` enforces an exact two-projection runtime delta and preserves hashes of the original artifacts. Consumed test/store preimages are retained here.

## Owner action

The current request authorizes necessary read-only investigation. Run `Read-OnlyClock.ps1 -OwnerApprovedReadOnlyInvestigation` ONCE in the existing private WindowsPS5.1 console, using the EXISTING restricted-role password, NOT postgres. Caller SHA256:

`78970E9410D4ABD88CA55C731DEC5345DFEAA53B9205FC3D6AD3E45A3103CB10`

Six direct pins plus the full historical artifact manifest are verified before an exclusive new read-only attempt. No existing attempt/result is present. The script rejects PGOPTIONS/PGTZ session overrides without disclosing their values. It uses native psql-X-W and exact127.0.0.1:5432/renamed database/restricted-role/OID34701 guards, BEGIN READ ONLY, timeouts and ROLLBACK. Output is limited to clock/timezone, scalar eligibility/ownership flags, exact owned row counts, unlisted counts and migration count; no payload/contact/password/hash/session token is selected. Failure stops with no retry/repair. Output/result/attempt files are new, and no historical file is altered.

Return the sanitized SQL output and `Phase3 clock/fixture read-only exit:` line. This does not authorize payment writes. Confirm current state/expiry first; if quotes have genuinely expired, never silently renew them or weaken the admission condition. Then prepare a fresh, separately approved bounded retained-fixture continuation. No old caller, new user/booking/database, cleanup, grant, schema replay, cloud change or provider request is included. Phase1/2 remain accepted; Phase3 remains NOT ACCEPTED.
