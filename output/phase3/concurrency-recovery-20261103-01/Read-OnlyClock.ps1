param([switch]$OwnerApprovedReadOnlyInvestigation)
$ErrorActionPreference='Stop'
if(-not $OwnerApprovedReadOnlyInvestigation){throw 'STOP: owner read-only investigation authorization required'}
$base=$PSScriptRoot
if($PSVersionTable.PSVersion.Major -ne 5 -or $Host.Name -ne 'ConsoleHost'){throw 'STOP: existing foreground Windows PowerShell5.1 required'}
if($env:PGOPTIONS -or $env:PGTZ){throw 'STOP: PostgreSQL session overrides present; no attempt started'}
foreach($name in @('readonly-attempt.json','readonly-output.txt','readonly-result.json')){if(Test-Path -LiteralPath (Join-Path $base $name)){throw 'STOP: existing read-only investigation; no retry'}}
if((Get-FileHash -LiteralPath (Join-Path $base 'readonly-pins.json') -Algorithm SHA256).Hash -cne '51A813152932718024968E5A2B8F843806C4FCCC3F3966E8F278F9A857CBC54D'){throw 'STOP: read-only pin manifest mismatch'}
$pins=Get-Content -LiteralPath (Join-Path $base 'readonly-pins.json') -Raw | ConvertFrom-Json
foreach($pin in $pins){if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: read-only investigation dependency mismatch'}}
$history=Get-Content -LiteralPath (Join-Path $base 'historical-artifacts.json') -Raw | ConvertFrom-Json
foreach($pin in $history){if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: historical artifact changed'}}
$attempt=Join-Path $base 'readonly-attempt.json'
$stream=[IO.File]::Open($attempt,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try{$bytes=[Text.Encoding]::UTF8.GetBytes('{"readOnly":true,"noRetry":true,"cleanup":false}');$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
$code=$null;$passed=$false
try{
 Write-Host 'READ ONLY. EXISTING flywithsafe_phase2_booking_test password only at the native private prompt. NOT postgres; no payment writes.'
 $ErrorActionPreference='Continue'
 & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -W -h 127.0.0.1 -p 5432 -U flywithsafe_phase2_booking_test -d flywithsafety_local_integration -v ON_ERROR_STOP=1 -P pager=off -f (Join-Path $base 'clock-fixtures.readonly.sql') 2>&1 | Tee-Object -FilePath (Join-Path $base 'readonly-output.txt')
 $code=$LASTEXITCODE
 $ErrorActionPreference='Stop'
 $passed=$code -eq 0 -and [bool](Select-String -LiteralPath (Join-Path $base 'readonly-output.txt') -SimpleMatch 'PHASE3_CLOCK_FIXTURE_READONLY_FINISHED_NOT_PAYMENT_PROOF' -Quiet)
}finally{
 $ErrorActionPreference='Stop'
 @{exit=$code;passed=$passed;readOnly=$true;paymentWrites=$false;cleanup=$false;finishedUTC=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $base 'readonly-result.json') -Encoding UTF8
 Write-Host "Phase3 clock/fixture read-only exit: $code; passed: $passed"
}
if(-not $passed){throw 'STOP: read-only investigation incomplete; preserve evidence; no retry or repair'}
Write-Host 'Return sanitized output. No PostgreSQL payment continuation has been authorized by this read-only review.'
