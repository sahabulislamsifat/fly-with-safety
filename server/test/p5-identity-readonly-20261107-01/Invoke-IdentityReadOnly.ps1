param([switch]$OwnerApprovedReadOnlyIdentity)
$ErrorActionPreference = 'Stop'
if (-not $OwnerApprovedReadOnlyIdentity) { throw 'STOP: separate read-only identity approval required' }
$sql = Join-Path $PSScriptRoot 'identity.sql'
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
if ((Get-FileHash -LiteralPath $sql -Algorithm SHA256).Hash -cne '974F2A485D5F7FDEC16D45AD0BD8DA8234C641A42B032A26A719506FA7EEF14F') { throw 'STOP: SQL hash mismatch' }
if ((Get-FileHash -LiteralPath $psql -Algorithm SHA256).Hash -cne '945EB0BBF8475A7FB0C863D85E36F2E15CF6B2D9FADB4D617BE4E59D4BB17BB0') { throw 'STOP: psql hash mismatch' }
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$out = Join-Path $repo 'output\phase5\p5-identity-readonly-20261107-01'
[void][IO.Directory]::CreateDirectory($out)
$marker = Join-Path $out 'attempt.json'
$file = [IO.File]::Open($marker, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
try {
  $bytes = [Text.Encoding]::UTF8.GetBytes(('{"scope":"READ_ONLY_IDENTITY_ONLY","startedUTC":"'+[DateTime]::UtcNow.ToString('o')+'"}'))
  $file.Write($bytes, 0, $bytes.Length)
} finally { $file.Dispose() }
# Prevent inherited libpq service, endpoint, password and options overrides.
# Save only in process memory, restore in finally; no private values are logged.
$saved = @{}
$exitCode = $null
try {
  foreach ($item in @(Get-ChildItem Env: | Where-Object { $_.Name -like 'PG*' })) {
    $saved[$item.Name] = $item.Value
    Remove-Item -LiteralPath ('Env:\'+$item.Name)
  }
  Write-Host 'EXISTING LOCAL postgres password only at the native masked prompt. No new role passwords.'
  $target = 'host=127.0.0.1 hostaddr=127.0.0.1 port=5432 dbname=postgres user=postgres connect_timeout=5 application_name=FWS_P5_IDENTITY_READONLY options=''-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=2000'''
  & $psql -X -W --no-readline --dbname $target --set=ON_ERROR_STOP=1 --set=VERBOSITY=sqlstate --tuples-only --no-align --file $sql --output (Join-Path $out 'identity.txt')
  $exitCode = $LASTEXITCODE
} finally {
  foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
}
if ($exitCode -ne 0) { throw 'STOP: identity observation failed; preserve output, no retry' }
Write-Host 'READ_ONLY_IDENTITY_OBSERVATION_COMPLETE_NOT_SETUP_ACCEPTANCE'
Write-Host ('Review non-secret identity evidence: '+(Join-Path $out 'identity.txt'))
