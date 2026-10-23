# FlyWithSafe Phase 1H-B2 — local-only migration wrapper
# Runs on Windows PowerShell 5.1+ / PowerShell 7+
# Default: read-only preflight. Supply -Apply after reviewing the script and authorization.
# Never runs resets, db push, migration resolve, tests, or remote database operations.
[CmdletBinding()]
param(
    [switch]$Apply,
    [string]$RepoRoot = 'E:\Programming\Project\fly-with-safety'
)

$ErrorActionPreference = 'Stop'
$targetDb = 'flywithsafe_phase1h_integration'
$targetHost = '127.0.0.1'
$targetPort = 5432
$targetRole = 'postgres'
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$expected = @(
    '20260926202822_init',
    '20260927082715_full_schema',
    '20261009000000_auth_sessions_and_password_resets',
    '20261011000000_inquiry_idempotency',
    '20261011120000_notification_outbox',
    '20261022000100_contact_status_new',
    '20261022000200_booking_contact_schema'
)

# IMPORTANT: preserve current terminal environment, including existing remote URLs.
$previous = @{}
$restoreNames = @()
$didPush = $false
$plainPassword = $null
$targetUrl = $null
$securePassword = $null

function Run-LocalReadOnlyQuery([string]$query) {
    $result = & $psql -X -w -At -v ON_ERROR_STOP=1 `
        -h $targetHost -p $targetPort -U $targetRole -d $targetDb -c $query
    if ($LASTEXITCODE -ne 0) {
        throw 'Local PostgreSQL read-only query failed. No migration was attempted.'
    }
    return (@($result) -join "`n").Trim()
}

try {
    if (-not (Test-Path -LiteralPath $psql -PathType Leaf)) {
        throw 'Expected PostgreSQL 18 psql.exe not found. Check the installed path before proceeding.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'server\prisma.config.ts') -PathType Leaf)) {
        throw 'Expected server/prisma.config.ts not found. Wrong repository path?'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'server\node_modules\prisma\build\index.js') -PathType Leaf)) {
        throw 'Local Prisma CLI is missing. Do not change databases; install project dependencies separately.'
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'node.exe is not available in this PowerShell session.'
    }

    $serverPath = Join-Path $RepoRoot 'server'
    $migrationPath = Join-Path $serverPath 'prisma\migrations'
    $actual = @(Get-ChildItem -LiteralPath $migrationPath -Directory | Select-Object -ExpandProperty Name | Sort-Object)
    if (($actual -join '|') -cne (($expected | Sort-Object) -join '|')) {
        throw 'Migration directory set differs from the seven approved migrations. STOP.'
    }
    foreach ($name in $expected) {
        if (-not (Test-Path -LiteralPath (Join-Path $migrationPath "$name\migration.sql") -PathType Leaf)) {
            throw "Missing migration.sql in approved directory: $name"
        }
    }

    # An .env loader could restore an invalid PGSERVICE, so refuse a conflicting file.
    foreach ($rel in @('.env', '.env.local', 'server\.env', 'server\.env.local', 'server\prisma\.env')) {
        $f = Join-Path $RepoRoot $rel
        if (Test-Path -LiteralPath $f -PathType Leaf) {
            if (Select-String -LiteralPath $f -Pattern '^\s*(PGSERVICE|PGSERVICEFILE)\s*=' -Quiet) {
                throw "PGSERVICE/PGSERVICEFILE occurs in $rel. Remove that configuration privately before rerunning."
            }
        }
    }

    # Save and REMOVE inherited libpq environment variables: never set PGSERVICE=''.
    $namesBefore = [Environment]::GetEnvironmentVariables('Process')
    $restoreNames = @($namesBefore.Keys | Where-Object { "$_" -match '^PG[A-Z0-9_]*$' }) + @(
        'PGSERVICE', 'PGSERVICEFILE', 'PGSYSCONFDIR', 'PGPASSWORD',
        'DATABASE_URL', 'DIRECT_URL',
        'INTEGRATION_TEST_DATABASE_URL', 'INTEGRATION_TEST_DIRECT_URL',
        'PRISMA_DATABASE_URL', 'SHADOW_DATABASE_URL'
    )
    $restoreNames = @($restoreNames | Select-Object -Unique)
    foreach ($name in $restoreNames) {
        $item = Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue
        $previous[$name] = @{ Exists = ($null -ne $item); Value = $(if ($null -ne $item) { $item.Value } else { $null }) }
        Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
    }
    if (Test-Path Env:\PGSERVICE) { throw 'PGSERVICE was not removed. STOP.' }

    # Ask privately in the user's terminal. Never place passwords in command lines or scripts.
    $securePassword = Read-Host 'Enter LOCAL PostgreSQL postgres password' -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try {
        $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    if ([string]::IsNullOrEmpty($plainPassword)) { throw 'No local database password provided.' }

    [Environment]::SetEnvironmentVariable('PGPASSWORD', $plainPassword, 'Process')
    [Environment]::SetEnvironmentVariable('PGSSLMODE', 'disable', 'Process')
    [Environment]::SetEnvironmentVariable('PGCONNECT_TIMEOUT', '5', 'Process')

    $encodedPassword = [Uri]::EscapeDataString($plainPassword)
    $targetUrl = 'postgresql://{0}:{1}@{2}:{3}/{4}?schema=public&sslmode=disable' -f `
        $targetRole, $encodedPassword, $targetHost, $targetPort, $targetDb
    foreach ($name in @('DATABASE_URL','DIRECT_URL','INTEGRATION_TEST_DATABASE_URL','INTEGRATION_TEST_DIRECT_URL')) {
        [Environment]::SetEnvironmentVariable($name, $targetUrl, 'Process')
    }
    $encodedPassword = $null

    # This query is read-only and checks that the target is the new, empty database.
    $preflight = @'
SELECT CASE WHEN
    current_database() = 'flywithsafe_phase1h_integration'
    AND current_user = 'postgres'
    AND host(inet_server_addr()) = '127.0.0.1'
    AND inet_server_port() = 5432
    AND pg_get_userbyid((SELECT datdba FROM pg_database WHERE datname = current_database())) = 'postgres'
    AND to_regclass('public._prisma_migrations') IS NULL
    AND NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S','f')
    )
    AND NOT EXISTS (
        SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typtype = 'e'
    )
THEN 'PREFLIGHT_OK' ELSE 'PREFLIGHT_BLOCKED' END;
'@
    if ((Run-LocalReadOnlyQuery $preflight) -cne 'PREFLIGHT_OK') {
        throw 'Local database identity, ownership, schema emptiness, or migration history failed verification. STOP.'
    }
    Write-Host 'PASS: Approved local database is reachable and contains no public application schema.'
    Write-Host 'PASS: Exactly seven expected migration directories exist.'
    Write-Host 'PASS: PGSERVICE is absent from the current process.'

    # Prisma config must reference the caller-supplied local datasource variables.
    $configContents = [IO.File]::ReadAllText((Join-Path $serverPath 'prisma.config.ts'))
    if ($configContents -notmatch 'DIRECT_URL|DATABASE_URL' -or
        $configContents -match '(?i)pooled\.db\.prisma\.io|db\.prisma\.io') {
        throw 'Prisma configuration requires manual URL-safety review. Refusing migration.'
    }

    # In Prisma 7, migrate status returns code 1 on a fresh uninitialized database.
    # This is a READ-ONLY inspection; a nonzero code alone is not proof of an error.
    Push-Location $serverPath
    $didPush = $true
    $prismaCli = '.\node_modules\prisma\build\index.js'
    $statusLines = @(& node $prismaCli migrate status --config prisma.config.ts 2>&1)
    $statusExit = $LASTEXITCODE
    $statusText = ($statusLines | Out-String)
    $missingInStatus = @($expected | Where-Object { $statusText -notmatch [regex]::Escape($_) })
    if ($statusExit -ne 1 -or $missingInStatus.Count -ne 0 -or
        $statusText -match '(?i)P1000|P1001|P1002|P1013|service\s+""|authentication failed|connection refused|error:' -or
        $statusText -notmatch [regex]::Escape($targetDb) -or
        $statusText -notmatch '127\.0\.0\.1:5432') {
        throw 'Prisma status did not unambiguously show exactly the seven expected unapplied migrations. STOP and review status privately.'
    }
    Write-Host 'PASS: Prisma status identifies all seven expected unapplied migrations.'

    if (-not $Apply) {
        Write-Host 'READ-ONLY PREFLIGHT PASSED. No migrations executed.'
        Write-Host 'To apply after authorization, re-run the same script with -Apply.'
        return
    }

    $answer = Read-Host 'Type APPLY-LOCAL-7 to authorize seven migrations ONLY to flywithsafe_phase1h_integration'
    if ($answer -cne 'APPLY-LOCAL-7') { throw 'Approval text did not match. No migration executed.' }

    # Check the live target again immediately before the only permitted write.
    if ((Run-LocalReadOnlyQuery $preflight) -cne 'PREFLIGHT_OK') {
        throw 'Fresh local preflight failed. No migration executed.'
    }
    Write-Host 'Applying the seven approved migrations to the NEW LOCAL DATABASE ONLY.'
    & node $prismaCli migrate deploy --config prisma.config.ts
    if ($LASTEXITCODE -ne 0) {
        throw 'Prisma migration failed. STOP. Do not retry, reset, or resolve migration history automatically.'
    }

    # Read-only, exact-name postcheck; any failure is a STOP, never a reset.
    $expectedSql = ($expected | ForEach-Object { "'$_'" }) -join ', '
    $postcheck = @"
SELECT CASE WHEN
    current_database() = '$targetDb'
    AND host(inet_server_addr()) = '$targetHost'
    AND inet_server_port() = $targetPort
    AND (SELECT COUNT(*) FROM public._prisma_migrations) = 7
    AND (SELECT COUNT(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) = 7
    AND NOT EXISTS (SELECT 1 FROM public._prisma_migrations WHERE migration_name NOT IN ($expectedSql))
    AND to_regclass('public."Booking"') IS NOT NULL
    AND to_regclass('public."BookingPassenger"') IS NOT NULL
    AND to_regclass('public."BookingStatusHistory"') IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ContactMessage' AND column_name = 'serviceType'
    )
    AND EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'ContactStatus' AND e.enumlabel = 'NEW'
    )
    AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ContactMessage'
          AND column_name = 'status' AND column_default LIKE '%NEW%'
    )
    AND (
        SELECT COUNT(*) FROM pg_constraint
        WHERE contype = 'f' AND convalidated
          AND conrelid IN (
              'public."Booking"'::regclass,
              'public."BookingPassenger"'::regclass,
              'public."BookingStatusHistory"'::regclass
          )
    ) = 3
    AND (
        SELECT COUNT(*) FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename IN ('Booking','BookingPassenger','BookingStatusHistory')
    ) >= 7
    AND (SELECT COUNT(*) FROM public."NotificationOutbox") = 0
THEN 'POSTCHECK_OK' ELSE 'POSTCHECK_BLOCKED' END;
"@
    if ((Run-LocalReadOnlyQuery $postcheck) -cne 'POSTCHECK_OK') {
        throw 'Migration command returned success but read-only postcheck did not pass. Investigate; do not reset.'
    }
    Write-Host 'SUCCESS: Seven migrations applied and essential schema checks passed.'
    Write-Host 'No integration tests or cleanup were run.'
}
finally {
    if ($didPush) { Pop-Location }
    $targetUrl = $null
    $plainPassword = $null
    $securePassword = $null
    foreach ($name in $restoreNames) {
        Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
        if ($previous.ContainsKey($name) -and $previous[$name].Exists) {
            # Do not recreate a broken empty service setting after completion.
            if ($name -in @('PGSERVICE','PGSERVICEFILE') -and
                [string]::IsNullOrWhiteSpace([string]$previous[$name].Value)) { continue }
            [Environment]::SetEnvironmentVariable($name, [string]$previous[$name].Value, 'Process')
        }
    }
}
