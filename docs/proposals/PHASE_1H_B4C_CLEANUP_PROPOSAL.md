# Phase 1H-B4C single-record cleanup proposal

Planning: compact; context: dependencies; verification: impact; delegation: none.
This phase prepares two SQL files and this report only. No database operation was executed.

## Ownership gate

Owner-supplied B4B output establishes one synthetic-pattern EMAIL_VERIFICATION notification,
PENDING, zero attempts, no idempotency key, unchanged reviewed timestamps, and zero users,
verification tokens, sessions, flight inquiries, bookings and idempotency records.
This is strong evidence of a synthetic inquiry-registration artifact. It does not independently
identify the failed invocation. No saved PostgreSQL run log was found among the inspected
output/docs/test log filenames. Match the failed invocation privately to candidate run-ID time
2026-10-23 16:25:18.801+06 (10:25:18.801Z; epoch milliseconds 1792751118801).
That is fixture-ID generation time, not a measured beforeAll start. The 10.537-second gap
assumes stored timestamps use UTC. The exact timeout operation remains unknown.

No actual record identifier, recipient or credential is included in this report. The resolver
has not been executed: private exact-one mapping remains a required owner action.

## Read-only private resolution

Run this now if desired in a private PowerShell session without transcription, psql echo-all,
or expanded debugging. Enter the password only at psql's private prompt:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -W -v ON_ERROR_STOP=1 `
  -h 127.0.0.1 -p 5432 -U postgres -d flywithsafe_phase1h_integration `
  -f 'E:\Programming\Project\fly-with-safety\docs\proposals\phase1h-b4c-resolve.readonly.sql'
```

The file begins READ ONLY, validates exact host/port/database/role, and uses SELECT ... gset
to resolve exactly one record using both reviewed fingerprints, state, timestamps, template,
strict synthetic-recipient pattern and candidate run epoch. The actual ID stays in a private
psql variable, is never printed, and is unset afterward. Zero/multiple matches fail with
ON_ERROR_STOP. Only the known fingerprint and successful resolution boolean are output.
This establishes unique mapping and synthetic characteristics, not invocation ownership.
Provide sanitized resolver output and non-secret failed-run timestamp confirmation before
cleanup approval. Never paste the actual ID, recipient, token or password.

## Cleanup transaction — proposal only

phase1h-b4c-cleanup.review.sql contains the only proposed DELETE. It is NOT approved for execution.
The script checks explicit ownership and cleanup acknowledgment values before BEGIN. These
values document a prior human decision; setting them is not itself authorization.
Inside the transaction it validates exact identity, takes short bounded table locks on the
reviewed tables, checks one outbox row and all reviewed zero business/auth counts,
and rejects unreviewed user triggers or inbound notification foreign keys. It then resolves
the exact primary key internally with all reviewed predicates and deletes by that key.
Locks keep validated state stable; exactly one affected row and an empty resulting outbox
are required. Any SQL exception aborts the transaction, with sanitized SQLSTATE-only error.
ON_ERROR_STOP closes psql on error; the uncommitted transaction rolls back. No automatic retry.
The transaction uses five-second lock and statement timeouts. Never kill blocking sessions.

All other tables/records are preserved. No broad pattern deletion, user deletion, cascade
cleanup, sequence reset or schema change is included. The table locks can block writers;
stop all API/worker/test processes before a later approved execution. After COMMIT this
deletion cannot be undone by ROLLBACK. There is no hidden backup/export; a private backup,
if the owner requires one, must be separately authorized because the payload contains tokens.

Only AFTER confirmation, successful private resolution and explicit single-record cleanup
approval is the proposed command:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -W -v ON_ERROR_STOP=1 `
  -h 127.0.0.1 -p 5432 -U postgres -d flywithsafe_phase1h_integration `
  -v ownership_confirmed=failed-run-2026-10-23T10:25:18.801Z `
  -v cleanup_approved=single-reviewed-notification-only `
  -f 'E:\Programming\Project\fly-with-safety\docs\proposals\phase1h-b4c-cleanup.review.sql'
```

Stop on refusal, unexpected counts, error or ambiguous connection loss. Do not retry a
possibly committed deletion. Re-run the B4B read-only forensic file afterward to verify
exact identity and zero notifications while retaining all other expected counts.

## Separate diagnostic rerun

After clean read-only verification, obtain a NEW approval for one 16-case diagnostic run
and its normal exact-record synthetic cleanup. That approval is distinct from deletion
of this residual notification. Use the private matching-URL setup in
PHASE_1H_B3_RUNNER_READINESS.md; from E:\Programming\Project\fly-with-safety\server run:

    node test/run-postgres-integration.mjs

Both setup promises are still awaited before cleanup; fixed-label timing diagnostics and
bail=1 remain present. Timeout is unchanged. The runner preserves exact endpoint/URL/approval,
history/schema/index/constraint and empty-outbox checks. SMTP/fetch blocking remains in both
suites; no provider or payment test is authorized. Preserve sanitized stage timings and the
first failure; no automatic retries or residual cleanup beyond approved fixture scope.

## Verification and remaining blockers

Observed offline checks: 38 tests passed, 16 PostgreSQL cases discovered and skipped; backend
TypeScript, runner syntax and git diff checks passed. SQL files were reviewed statically,
not parsed or executed by PostgreSQL; no transactional behavior is claimed as verified.
The exact candidate epoch was independently calculated offline. Application changes and
migration SQL are preserved. Ownership confirmation, private exact-one resolution, cleanup
approval, post-cleanup evidence and diagnostic-rerun approval remain open.
