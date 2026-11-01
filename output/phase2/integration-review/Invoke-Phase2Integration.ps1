param([switch]$RunAuthorizedSyntheticProof)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
if(-not $RunAuthorizedSyntheticProof){throw 'STOP: synthetic integration scope must be explicitly selected'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: private interactive PS5.1 required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: policy differs; no bypass'}
$root=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$setup=Join-Path $root 'output/phase2/setup-review/result.json'
if(-not (Test-Path -LiteralPath $setup)){throw 'STOP: actual setup success evidence missing'}
if((Get-Content -LiteralPath $setup -Raw | ConvertFrom-Json).passed -ne $true){throw 'STOP: setup not accepted'}
$manifest=Join-Path $PSScriptRoot 'pins.json'
if((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne 'B46824F561E7DF5D2362550FDA25E96DAC5261588FC0EEFD605F3790E044D808'){throw 'STOP: manifest mismatch'}
foreach($pin in (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: source integrity mismatch'}
}
$marker=Join-Path $PSScriptRoot 'attempt-started.json'
if((Test-Path -LiteralPath $marker) -or (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'fixture-ledger.jsonl')) -or (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'result.json'))){throw 'Existing Phase2 integration attempt; no retry'}
$environmentNames=@('DATABASE_URL','DIRECT_URL','PGPASSWORD','PHASE2_BOOKING_MODE','PHASE2_BOOKING_DATABASE_URL','PHASE2_BOOKING_LEDGER','PHASE2_SYNTHETIC_PASSWORD')
foreach($name in $environmentNames){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'STOP: integration credential/mode environment must be empty'}}
$databaseSecret=Read-Host 'EXISTING flywithsafe_phase2_booking_test password (private, NOT postgres)' -AsSecureString
$accountSecret=Read-Host 'Choose a separate development-only password for synthetic browser accounts, at least 16 characters (private)' -AsSecureString
if($accountSecret.Length -lt 16){$databaseSecret.Dispose();$accountSecret.Dispose();throw 'STOP: synthetic account password too short; no attempt started'}
$databasePtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($databaseSecret)
$accountPtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($accountSecret)
try {
 $env:PHASE2_BOOKING_DATABASE_URL='postgresql://flywithsafe_phase2_booking_test:'+ [Uri]::EscapeDataString([Runtime.InteropServices.Marshal]::PtrToStringBSTR($databasePtr))+'@127.0.0.1:5432/flywithsafe_phase2_booking_integration'
 $env:PHASE2_SYNTHETIC_PASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($accountPtr)
 $env:PHASE2_BOOKING_MODE='owner-approved-synthetic'
 $env:PHASE2_BOOKING_LEDGER=Join-Path $PSScriptRoot 'fixture-ledger.jsonl'
 $stream=[IO.File]::Open($marker,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$started=@{target='flywithsafe_phase2_booking_integration';role='flywithsafe_phase2_booking_test';startedUTC=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress;$bytes=[Text.Encoding]::UTF8.GetBytes($started);$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
 $report=Join-Path $PSScriptRoot 'vitest-result.json'
 & 'C:\Program Files\nodejs\node.exe' (Join-Path $root 'server/node_modules/vitest/vitest.mjs') run --config (Join-Path $root 'server/test/phase2-booking.pg.vitest.config.ts') --reporter=default --reporter=json --outputFile=$report
 $suiteExit=$LASTEXITCODE
 $passed=$false
 if($suiteExit -eq 0 -and (Test-Path -LiteralPath $report)){
  $summary=Get-Content -LiteralPath $report -Raw | ConvertFrom-Json
  $passed=($summary.numPassedTests -eq 1 -and $summary.numFailedTests -eq 0 -and $summary.numPendingTests -eq 0)
 }
 $result=@{passed=$passed;suiteExit=$suiteExit;fixturesRetained=$true;privilegedOperations=$false;finishedUTC=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress
 [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'result.json'),$result)
 Write-Host ('Phase2 restricted integration suite exit: '+$suiteExit)
 if(-not $passed){throw 'STOP: proof incomplete. Preserve the ledger; no retry or cleanup.'}
 Write-Host 'PHASE2_RESTRICTED_API_POSTGRESQL_PASS_FIXTURES_RETAINED'
} finally {
 foreach($name in $environmentNames){Remove-Item -LiteralPath ('Env:'+ $name) -ErrorAction SilentlyContinue}
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($databasePtr)
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($accountPtr)
 $databaseSecret.Dispose();$accountSecret.Dispose()
}
