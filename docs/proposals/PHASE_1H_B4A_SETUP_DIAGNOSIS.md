# Phase 1H-B4A setup diagnosis

Scope: test-only diagnostics and setup/cleanup sequencing. No database access or writes.

The exact timeout operation is NOT established by the supplied beforeAll timeout alone.
Registration awaits user lookup, bcrypt hashing, user insertion, verification-token insertion,
notification enqueue and session creation. Application imports precede registration. Any of
these can contribute to the ten-second hook budget. No measured evidence justifies raising it.

SMTP suppression does not suppress durable enqueue. Registration can create one verification
notification before its request completes. This is a plausible source of the observed row,
but ownership and chronology remain unverified; another process cannot be excluded.

Confirmed code defect: hook timeout does not cancel its async setup. Previously afterAll
could select owned notifications before a late setup insert committed. Both suites now retain
their setup promise and wait for settlement before exact-record cleanup. If setup remains
hung, cleanup may itself time out; it must not guess ownership or delete racing records.
The runner uses bail=1 to stop subsequent cases/suites after the first failure. File arguments
do not promise execution order. Serial execution alone did not guarantee a clean database
after failed setup. Keep every other API/worker stopped during future runs.

Added fixed-label timing diagnostics for application/Prisma import, registration request and
reliability empty-outbox verification. Logs contain elapsed milliseconds and status, no error
objects or payloads. They narrow the next investigation; registration sub-operation timing
would still be needed if that request is the slow step. Existing network and target guards,
empty-outbox assertions and owned-record cleanup predicates remain intact.

Files: both integration suites, run-postgres-integration.mjs, setup-timing.ts and its unit test.
Offline results: 38 passed, 16 PostgreSQL cases collected and skipped; backend TypeScript,
runner syntax and git diff checks passed. These results do not establish a live fix.

## Residual-record review and next gate

The owner reports one notification; current count and provenance have not been queried.
Preserve it and any related user/token/session/inquiry/idempotency records. No deletion is
authorized. First perform separately reviewed read-only inspection on the exact local target:
record counts and notification ID, template identifier, status and timestamps. Compare its
recipient privately with the failed run's exact synthetic email. Do not export notification
payloads, verification URLs/tokens, customer details or credentials. Compare creation time
with setup/cleanup logs. Identify other writers and confirm they are stopped.

If ownership is proven, prepare a transaction proposal listing each exact synthetic record
ID and expected count, including dependent auth rows and known cascades. Obtain explicit
cleanup approval before executing it. If ownership is uncertain, preserve the record and
do not run the combined suite. Never clear the entire outbox to pass its assertion.

After approved exact-record cleanup and read-only verification of empty outbox, obtain
separate approval for one diagnostic execution of the 16 cases and their normal fixture
cleanup. Use the private environment setup in PHASE_1H_B3_RUNNER_READINESS.md, then from
E:\Programming\Project\fly-with-safety\server run:

    node test/run-postgres-integration.mjs

The runner performs catalog checks before fixture writes and bails on the first failure.
Preserve fixed-label timing output and sanitized hook errors. Do not retry automatically.
Combined execution is NOT ready while the residual record or timeout cause remains unresolved;
the next authorized run would be diagnostic, not a claim of verified reliability.
