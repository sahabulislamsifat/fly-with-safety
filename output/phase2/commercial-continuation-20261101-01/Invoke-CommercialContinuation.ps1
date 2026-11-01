param([switch]$OwnerApprovedRetainedContinuation)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
if(-not $OwnerApprovedRetainedContinuation){throw 'STOP: separate explicit approval for this new retained-fixture continuation required'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: private interactive PS5.1 required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: policy differs; no bypass'}
$root=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$manifest=Join-Path $PSScriptRoot 'pins.json'
if((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne '46A7D751B849B44175968CA50718FFC0A759656B9DD66970B9E6FA88EF1374ED'){throw 'STOP: manifest mismatch'}
foreach($pin in (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: reviewed source/evidence mismatch'}
}
if((Get-Content -LiteralPath (Join-Path $PSScriptRoot 'inventory-acceptance.json') -Raw | ConvertFrom-Json).accepted -ne $true){throw 'STOP: retained inventory not accepted'}
$marker=Join-Path $PSScriptRoot 'attempt-started.json'
$ledger=Join-Path $PSScriptRoot 'fixture-ledger.jsonl'
$report=Join-Path $PSScriptRoot 'vitest-result.json'
$diagnostic=Join-Path $PSScriptRoot 'diagnostic.json'
$resultPath=Join-Path $PSScriptRoot 'result.json'
foreach($path in @($marker,$ledger,$report,$diagnostic,$resultPath)){if(Test-Path -LiteralPath $path){throw 'Existing retained-fixture continuation attempt; no retry'}}
$names=@('DATABASE_URL','DIRECT_URL','PGPASSWORD','PGOPTIONS','PGSSLMODE','PGSSLNEGOTIATION','PGSERVICE','PGSERVICEFILE','PHASE2_BOOKING_MODE','PHASE2_BOOKING_DATABASE_URL','PHASE2_BOOKING_LEDGER','PHASE2_SYNTHETIC_PASSWORD','PHASE2_IDENTITY_MODE','PHASE2_IDENTITY_DATABASE_URL','PHASE2_IDENTITY_RESULT','PHASE2_BROWSER_MODE','PHASE2_BROWSER_ARTIFACT_DIR','PHASE2_CONTINUATION_MODE','PHASE2_CONTINUATION_ARTIFACT_DIR')
foreach($name in $names){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'STOP: credential/mode/transport environment must be empty'}}
$databaseSecret=Read-Host 'EXISTING flywithsafe_phase2_booking_test database password privately' -AsSecureString
$accountSecret=Read-Host 'EXISTING synthetic browser-account password chosen for the successful 18:35 actor sign-ins; do NOT choose a new password' -AsSecureString
if($databaseSecret.Length -eq 0 -or $accountSecret.Length -lt 16){$databaseSecret.Dispose();$accountSecret.Dispose();throw 'STOP: private input invalid; no attempt started'}
$databasePtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($databaseSecret)
$accountPtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($accountSecret)
$suiteExit=$null;$passed=$false
try {
 $env:PGSSLMODE='disable'
 $env:PHASE2_BOOKING_DATABASE_URL='postgresql://flywithsafe_phase2_booking_test:'+ [Uri]::EscapeDataString([Runtime.InteropServices.Marshal]::PtrToStringBSTR($databasePtr))+'@127.0.0.1:5432/flywithsafe_phase2_booking_integration'
 $env:PHASE2_SYNTHETIC_PASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($accountPtr)
 $env:PHASE2_CONTINUATION_MODE='owner-approved-retained-fixtures'
 $env:PHASE2_CONTINUATION_ARTIFACT_DIR=$PSScriptRoot
 $stream=[IO.File]::Open($marker,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$bytes=[Text.Encoding]::UTF8.GetBytes((@{startedUTC=[DateTime]::UtcNow.ToString('o');target='flywithsafe_phase2_booking_integration';role='flywithsafe_phase2_booking_test';reusesBooking='FWS-2026-53YFS3';oneNewAttempt=$true} | ConvertTo-Json -Compress));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
 & 'C:\Program Files\nodejs\node.exe' (Join-Path $root 'server/node_modules/vitest/vitest.mjs') run --config (Join-Path $root 'server/test/phase2-commercial-continuation.pg.vitest.config.ts') --reporter=default --reporter=json --outputFile=$report
 $suiteExit=$LASTEXITCODE
 if($suiteExit -eq 0 -and (Test-Path -LiteralPath $report) -and (Test-Path -LiteralPath $diagnostic)){
  $summary=Get-Content -LiteralPath $report -Raw | ConvertFrom-Json
  $detail=Get-Content -LiteralPath $diagnostic -Raw | ConvertFrom-Json
  $passed=($summary.numPassedTests -eq 1 -and $summary.numFailedTests -eq 0 -and $summary.numPendingTests -eq 0 -and $detail.passed -eq $true -and $detail.stage -eq 'complete')
 }
 if(-not $passed){throw 'STOP: retained-fixture continuation incomplete; preserve evidence, no retry or cleanup'}
 Write-Host 'PHASE2_RETAINED_COMMERCIAL_CONTINUATION_PASS_FIXTURES_RETAINED'
} finally {
 if(Test-Path -LiteralPath $marker){[IO.File]::WriteAllText($resultPath,(@{passed=$passed;suiteExit=$suiteExit;fixturesRetained=$true;createdUsersOrBookings=$false;privilegedOperations=$false;finishedUTC=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress))}
 Write-Host ('Phase2 retained commercial continuation exit: '+$suiteExit)
 foreach($name in $names){Remove-Item -LiteralPath ('Env:'+ $name) -ErrorAction SilentlyContinue}
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($databasePtr)
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($accountPtr)
 $databaseSecret.Dispose();$accountSecret.Dispose()
}
