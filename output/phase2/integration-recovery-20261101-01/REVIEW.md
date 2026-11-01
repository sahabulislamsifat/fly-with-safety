# New bounded Phase 2 recovery attempt — OWNER APPROVAL REQUIRED

## Evidence and diagnosis

The original integration and first read-only diagnostic are spent and preserved. Original integration: 0 passed / 1 failed, exit 1 at generic identity stage. Read-only diagnostic: exit 1, stage read-only-guard, P2010 / SQLSTATE 28P01, no identity or count result. Owner separately demonstrated successful read-only psql login to the exact restricted role/database. This establishes successful psql authentication; it does NOT establish that the two sessions received identical private bytes or transport settings, nor recover the discarded original exception.

Source trace: SecureString -> BSTR -> EscapeDataString once -> private environment URI -> WHATWG URL.href -> installed pg parser's single decodeURIComponent -> PrismaPg/pg. No trimming, second explicit encoding, alternative role, target mismatch or dotenv override was found. URI fields override PGUSER/PGPASSWORD defaults when present. Native Windows PowerShell 5.1 synthetic verification passed 10 password cases through 3 paths (30 checks), including reserved characters, literal percent sequences, Unicode and leading/trailing spaces; no database connection or actual credential inspection occurred. No URL-construction defect is proven; no speculative application, role or password change is included.

## Proposed single workflow (not yet executed)

Use the existing visible private Windows PowerShell 5.1 console, normal RemoteSigned policy, no new window or policy bypass. Enter the existing restricted database password ONCE and a separate >=16-character synthetic-account password. Neither is recorded in arguments, files, logs, response, hash or report. Stop if a credential/mode/transport/service environment variable is already present. Both clients use the same private database-password value; align `PGSSLMODE=disable` for this exact loopback-only synthetic target so default TLS negotiation cannot differ between psql and pg. This does not alter PostgreSQL configuration or production TLS policy.

1. Pin/source/evidence and fresh-attempt guards.
2. Offline installed-pg round-trip equality check for the actual private input; output only PASS/STOP.
3. Restricted-role psql using the SAME input via private PGPASSWORD; fixed read-only identity SQL, no extra prompt.
4. Remove PGPASSWORD; reuse the reviewed Prisma read-only identity diagnostic with the exact same URI input. Require correct identity/session, read-only settings, zero application rows and seven migrations. Report allowlisted codes and aggregate counts. Any mismatch stops BEFORE synthetic writes.
5. Only if all gates pass, execute the unchanged, originally reviewed one-case business suite ONCE, using the same URI and new attempt-local ledger/report paths. Preserve its original assertions, four synthetic actors, fixture scope, request/concurrency profiles and timeouts. No old launcher is invoked.
6. Record each actual process exit/stage and retain exact fixtures. No cleanup, grant, role change, schema operation, migration, reset, repair, retry, browser launch, supplier/provider or live payment operation.

A passing new attempt demonstrates current successful authentication and business assertions; it does not retrospectively prove why an earlier private input was rejected. If psql fails, no Prisma/business suite runs. If psql passes but Prisma fails, preserve that same-input distinction and safe diagnostic. No automatic credential reset.

## Offline review

Original 127 source pins unchanged. New manifest: 148 pins including both historical failures, reviewed tests, parser/runtime inputs, psql binary and new preflight files. Private-URL guard: 9 positive/negative cases PASS, including wrong input, double encoding, empty password, target and query overrides. Four-stage ordering and fail-fast guards checked. Native PS5.1.26100.9818 syntax: zero parser errors. Node syntax checks passed. New SQL was statically reviewed; it has not been executed or server-parsed. No actual live fix/PASS is claimed.

Caller SHA256: `FF1F67F6120E1F6B66A052AFC6DBAB0FE40DB399636CFC684A70C9522CD0B4FE`.

Manifest SHA256: `BF599CE85A79FA26D32A756A8244F363031AB269E28CCE68C7F15477CD893A2D`.

Separate explicit owner approval is required for this ONE new workflow before using `FOREGROUND-AFTER-APPROVAL.txt`. Earlier one-attempt authorizations are not reused. Phase2 remains NOT ACCEPTED; Phase1 G7 remains ACCEPTED.
