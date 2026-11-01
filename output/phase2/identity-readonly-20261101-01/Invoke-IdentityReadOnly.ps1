param([switch]$ReadOnlyInvestigationAuthorized)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
if(-not $ReadOnlyInvestigationAuthorized){throw 'STOP: explicit read-only investigation required'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: private interactive PS5.1 required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: policy differs; no bypass'}
$root=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$manifest=Join-Path $PSScriptRoot 'pins.json'
if((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne 'BBC432A5C4004CB2C2F979538385DA88BEE8BDDB103C041235ABDF5542512506'){throw 'STOP: manifest mismatch'}
foreach($pin in (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: source/evidence integrity mismatch'}
}
$marker=Join-Path $PSScriptRoot 'attempt-started.json'
$diagnostic=Join-Path $PSScriptRoot 'diagnostic.json'
$report=Join-Path $PSScriptRoot 'vitest-result.json'
$result=Join-Path $PSScriptRoot 'result.json'
foreach($path in @($marker,$diagnostic,$report,$result)){if(Test-Path -LiteralPath $path){throw 'Existing read-only diagnostic attempt; no retry'}}
$names=@('DATABASE_URL','DIRECT_URL','PGPASSWORD','PGOPTIONS','PHASE2_BOOKING_MODE','PHASE2_BOOKING_DATABASE_URL','PHASE2_SYNTHETIC_PASSWORD','PHASE2_IDENTITY_MODE','PHASE2_IDENTITY_DATABASE_URL','PHASE2_IDENTITY_RESULT')
foreach($name in $names){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'STOP: runtime credential/mode environment must be empty'}}
$secret=Read-Host 'EXISTING flywithsafe_phase2_booking_test password privately; read-only investigation only, NOT postgres' -AsSecureString
$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
 $env:PHASE2_IDENTITY_DATABASE_URL='postgresql://flywithsafe_phase2_booking_test:'+ [Uri]::EscapeDataString([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr))+'@127.0.0.1:5432/flywithsafe_phase2_booking_integration'
 $env:PHASE2_IDENTITY_MODE='owner-readonly-investigation'
 $env:PHASE2_IDENTITY_RESULT=$diagnostic
 $stream=[IO.File]::Open($marker,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$bytes=[Text.Encoding]::UTF8.GetBytes((@{startedUTC=[DateTime]::UtcNow.ToString('o');readOnly=$true;target='flywithsafe_phase2_booking_integration';role='flywithsafe_phase2_booking_test'} | ConvertTo-Json -Compress));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
 & 'C:\Program Files\nodejs\node.exe' (Join-Path $root 'server/node_modules/vitest/vitest.mjs') run --config (Join-Path $root 'server/test/phase2-identity-readonly.pg.vitest.config.ts') --reporter=default --reporter=json --outputFile=$report
 $suiteExit=$LASTEXITCODE
 $passed=$false
 if($suiteExit -eq 0 -and (Test-Path -LiteralPath $diagnostic) -and (Test-Path -LiteralPath $report)){
  $detail=Get-Content -LiteralPath $diagnostic -Raw | ConvertFrom-Json
  $summary=Get-Content -LiteralPath $report -Raw | ConvertFrom-Json
  $passed=($detail.passed -eq $true -and $summary.numPassedTests -eq 1 -and $summary.numFailedTests -eq 0 -and $summary.numPendingTests -eq 0)
 }
 [IO.File]::WriteAllText($result,(@{passed=$passed;suiteExit=$suiteExit;readOnly=$true;finishedUTC=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress))
 Write-Host ('Phase2 read-only identity diagnostic exit: '+$suiteExit)
 if(-not $passed){throw 'STOP: read-only diagnostic failed. Preserve evidence; no retry or repair.'}
 Write-Host 'PHASE2_READONLY_IDENTITY_AND_EMPTY_STATE_PASS_NOT_INTEGRATION_ACCEPTANCE'
} finally {
 foreach($name in $names){Remove-Item -LiteralPath ('Env:'+ $name) -ErrorAction SilentlyContinue}
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
 $secret.Dispose()
}
