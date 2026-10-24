# Prepared commands only. Initialize requires separate owner approval before invocation.
# No credentials are saved. Run in a private local terminal, without transcription.
[CmdletBinding()]
param([ValidateSet('Status', 'Initialize')][string]$Action = 'Status')

$ErrorActionPreference = 'Stop'
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$serverDirectory = Join-Path $repository 'server'
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$database = 'flywithsafe_phase1h_integration'
$expected = @(
    # Windows PowerShell 5.1 emits the JSON array as one pipeline object; enumerate its records.
    Get-Content (Join-Path $PSScriptRoot 'phase-1ha3-existing-migration-hashes.json') -Raw | ConvertFrom-Json | ForEach-Object { $_ }
) + @(
    Get-Content (Join-Path $PSScriptRoot 'phase-1ha3-new-migration-manifest.json') -Raw | ConvertFrom-Json | ForEach-Object { $_ }
)
$directories = @(Get-ChildItem (Join-Path $serverDirectory 'prisma/migrations') -Directory | Sort-Object Name)
if ($directories.Count -ne 7 -or $expected.Count -ne 7 -or
    (Compare-Object @($expected.name | Sort-Object) @($directories.Name))) {
    throw 'The reviewed seven-migration set changed. Stop for review.'
}
foreach ($migration in $expected) {
    $path = Join-Path $serverDirectory "prisma/migrations/$($migration.name)/migration.sql"
    if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $migration.sha256) {
        throw 'Reviewed migration bytes changed. Stop for review.'
    }
}
if (-not (Test-Path -LiteralPath $psql)) { throw 'Local psql was not found.' }

# Preserve and restore process configuration; never edit server/.env.
$names = @('DATABASE_URL', 'DIRECT_URL', 'INTEGRATION_TEST_DATABASE_URL',
    'EMAIL_DELIVERY_ENABLED', 'OUTBOX_WORKER_ENABLED', 'RUN_IDEMPOTENCY_INTEGRATION',
    'RUN_RELIABILITY_INTEGRATION', 'PGPASSWORD', 'PGHOST', 'PGHOSTADDR', 'PGPORT',
    'PGDATABASE', 'PGUSER', 'PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS', 'PGCONNECT_TIMEOUT')
$saved = @{}
foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$password = $null
$pointer = [IntPtr]::Zero
$plainPassword = $null
$localUrl = $null
Push-Location $serverDirectory
try {
    # A privately supplied process secret also supports non-interactive local execution.
    $plainPassword = $env:PGPASSWORD
    if ([string]::IsNullOrEmpty($plainPassword)) {
        $password = Read-Host 'Local postgres password (private input; never paste into chat)' -AsSecureString
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
        $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    if ([string]::IsNullOrEmpty($plainPassword)) { throw 'A private local password is required.' }
    $localUrl = 'postgresql://postgres:' + [Uri]::EscapeDataString($plainPassword) +
        '@127.0.0.1:5432/' + $database
    # Check raw spelling as well as fixing construction: no hostname normalization or URL overrides.
    if ($localUrl -cnotmatch '^postgresql://postgres:[^@/?#]+@127\.0\.0\.1:5432/flywithsafe_phase1h_integration$') {
        throw 'Exact local target required.'
    }
    $env:DATABASE_URL = $localUrl
    $env:DIRECT_URL = $localUrl
    $env:INTEGRATION_TEST_DATABASE_URL = $localUrl
    $env:EMAIL_DELIVERY_ENABLED = 'false'
    $env:OUTBOX_WORKER_ENABLED = 'false'
    $env:RUN_IDEMPOTENCY_INTEGRATION = 'false'
    $env:RUN_RELIABILITY_INTEGRATION = 'false'
    $env:PGPASSWORD = $plainPassword
    $env:PGHOST = '127.0.0.1'
    $env:PGHOSTADDR = '127.0.0.1'
    $env:PGPORT = '5432'
    $env:PGDATABASE = $database
    $env:PGUSER = 'postgres'
    # Remove the entries entirely: an empty PGSERVICE still requests a named service.
    Remove-Item Env:PGSERVICE, Env:PGSERVICEFILE -ErrorAction SilentlyContinue
    $env:PGCONNECT_TIMEOUT = '5'
    $env:PGOPTIONS = '-c default_transaction_read_only=on -c statement_timeout=5000'
    $inspection = @'
BEGIN READ ONLY;
SET LOCAL search_path = pg_catalog;
SELECT CASE WHEN current_database()='flywithsafe_phase1h_integration'
 AND current_user='postgres' AND host(inet_server_addr())='127.0.0.1'
 AND inet_server_port()=5432 THEN 'IDENTITY_OK' ELSE 'UNSAFE' END,
 (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'),
 to_regclass('public._prisma_migrations') IS NOT NULL,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
 (SELECT count(*) FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype IN ('e','d','c')),
 (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public');
COMMIT;
'@
    $identity = & $psql -X -w -q -At -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -U postgres -d $database -c $inspection
    if ($LASTEXITCODE -ne 0) { throw 'Read-only local inspection failed. No migration started.' }
    $result = (@($identity) -join "`n").Trim()
    if ($result -cnotmatch '^IDENTITY_OK\|[0-9]+\|[tf]\|[0-9]+\|[0-9]+\|[0-9]+$') {
        throw 'Unexpected local identity/catalog output. No migration started.'
    }
    Write-Host "Verified local catalog (identity|tables|history exists|relations|types|routines): $result"
    # Empty public tables alone would miss leftover enums or sequences from a failed migration.
    if ($Action -eq 'Initialize' -and $result -cne 'IDENTITY_OK|0|f|0|0|0') {
        throw 'Initialization requires an empty public schema and absent migration history. No automatic recovery is permitted.'
    }
    if ($env:DIRECT_URL -cne $localUrl -or $env:DATABASE_URL -cne $localUrl -or
        $env:INTEGRATION_TEST_DATABASE_URL -cne $localUrl) { throw 'Target configuration changed.' }
    if ($Action -eq 'Status') {
        & node node_modules/prisma/build/index.js migrate status --config prisma.config.ts
        $statusExit = $LASTEXITCODE
        Write-Host "Prisma status exit code: $statusExit. Code 1 requires reading the output; pending history and connection failures both use it."
        if ($statusExit -notin @(0, 1)) { throw 'Unexpected Prisma status failure.' }
    } else {
        # This is the only write-capable command. Do not invoke Initialize before explicit approval.
        $env:PGOPTIONS = '-c lock_timeout=5000 -c statement_timeout=30000'
        & node node_modules/prisma/build/index.js migrate deploy --config prisma.config.ts
        if ($LASTEXITCODE -ne 0) { throw 'Migration failed. Stop; review history and schema before any recovery.' }
        $env:PGOPTIONS = '-c default_transaction_read_only=on -c statement_timeout=5000'
        & node node_modules/prisma/build/index.js migrate status --config prisma.config.ts
        if ($LASTEXITCODE -ne 0) { throw 'Post-migration status failed. Do not start tests or workers.' }
    }
} finally {
    foreach ($name in $names) {
        if ($null -eq $saved[$name]) {
            Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
        } else {
            [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process')
        }
    }
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    if ($null -ne $password) { $password.Dispose() }
    $plainPassword = $null
    $localUrl = $null
    Pop-Location
}
