param([switch]$OwnerApprovedNewAttempt)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
if(-not $OwnerApprovedNewAttempt){throw 'STOP: separate explicit owner approval for this new attempt required'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: private interactive PS5.1 required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: policy differs; no bypass'}
$root=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$manifest=Join-Path $PSScriptRoot 'pins.json'
if((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne 'BF599CE85A79FA26D32A756A8244F363031AB269E28CCE68C7F15477CD893A2D'){throw 'STOP: manifest mismatch'}
foreach($pin in (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: source/evidence integrity mismatch'}
}
$marker=Join-Path $PSScriptRoot 'attempt-started.json'
$resultPath=Join-Path $PSScriptRoot 'result.json'
$ledger=Join-Path $PSScriptRoot 'fixture-ledger.jsonl'
$report=Join-Path $PSScriptRoot 'vitest-result.json'
$identityReport=Join-Path $PSScriptRoot 'identity-vitest-result.json'
$identityDiagnostic=Join-Path $PSScriptRoot 'identity-diagnostic.json'
foreach($path in @($marker,$resultPath,$ledger,$report,$identityReport,$identityDiagnostic)){if(Test-Path -LiteralPath $path){throw 'Existing new recovery attempt; no retry'}}
$names=@('DATABASE_URL','DIRECT_URL','PGPASSWORD','PGOPTIONS','PGSSLMODE','PGSSLNEGOTIATION','PGSERVICE','PGSERVICEFILE','PHASE2_BOOKING_MODE','PHASE2_BOOKING_DATABASE_URL','PHASE2_BOOKING_LEDGER','PHASE2_SYNTHETIC_PASSWORD','PHASE2_IDENTITY_MODE','PHASE2_IDENTITY_DATABASE_URL','PHASE2_IDENTITY_RESULT')
foreach($name in $names){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'STOP: credential/mode environment must be empty'}}
$databaseSecret=Read-Host 'EXISTING restricted-role password privately; this SAME input will be used for psql and Prisma' -AsSecureString
$accountSecret=Read-Host 'Separate synthetic browser-account password, at least 16 characters (private)' -AsSecureString
if($databaseSecret.Length -eq 0 -or $accountSecret.Length -lt 16){$databaseSecret.Dispose();$accountSecret.Dispose();throw 'STOP: private input invalid; no attempt started'}
$databasePtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($databaseSecret)
$accountPtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($accountSecret)
$stage='private-url-equivalence'
$passed=$false
$urlExit=$null; $psqlExit=$null; $identityExit=$null; $suiteExit=$null
try {
 # Align both clients on the already approved loopback-only local transport.
 $env:PGSSLMODE='disable'
 $env:PGPASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($databasePtr)
 $env:PHASE2_BOOKING_DATABASE_URL='postgresql://flywithsafe_phase2_booking_test:'+ [Uri]::EscapeDataString($env:PGPASSWORD)+'@127.0.0.1:5432/flywithsafe_phase2_booking_integration'
 $stream=[IO.File]::Open($marker,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$bytes=[Text.Encoding]::UTF8.GetBytes((@{startedUTC=[DateTime]::UtcNow.ToString('o');target='flywithsafe_phase2_booking_integration';role='flywithsafe_phase2_booking_test';oneNewAttempt=$true} | ConvertTo-Json -Compress));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
 & 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'verify-private-url.cjs')
 $urlExit=$LASTEXITCODE
 if($urlExit -ne 0){throw 'STOP: private URL equivalence failed before database execution'}
 $stage='same-input-psql-readonly'
 & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -w -h 127.0.0.1 -p 5432 -U flywithsafe_phase2_booking_test -d flywithsafe_phase2_booking_integration -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'credential-preflight.readonly.sql')
 $psqlExit=$LASTEXITCODE
 Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
 if($psqlExit -ne 0){throw 'STOP: same-input psql read-only gate failed'}
 $stage='same-input-prisma-readonly'
 $env:PHASE2_IDENTITY_MODE='owner-readonly-investigation'
 $env:PHASE2_IDENTITY_DATABASE_URL=$env:PHASE2_BOOKING_DATABASE_URL
 $env:PHASE2_IDENTITY_RESULT=$identityDiagnostic
 & 'C:\Program Files\nodejs\node.exe' (Join-Path $root 'server/node_modules/vitest/vitest.mjs') run --config (Join-Path $root 'server/test/phase2-identity-readonly.pg.vitest.config.ts') --reporter=default --reporter=json --outputFile=$identityReport
 $identityExit=$LASTEXITCODE
 if($identityExit -ne 0 -or -not (Test-Path -LiteralPath $identityDiagnostic) -or -not (Test-Path -LiteralPath $identityReport)){throw 'STOP: same-input Prisma read-only gate failed'}
 $identity=Get-Content -LiteralPath $identityDiagnostic -Raw | ConvertFrom-Json
 $identitySummary=Get-Content -LiteralPath $identityReport -Raw | ConvertFrom-Json
 if($identity.passed -ne $true -or $identitySummary.numPassedTests -ne 1 -or $identitySummary.numFailedTests -ne 0 -or $identitySummary.numPendingTests -ne 0){throw 'STOP: identity/clean-state evidence incomplete'}
 foreach($name in @('PHASE2_IDENTITY_MODE','PHASE2_IDENTITY_DATABASE_URL','PHASE2_IDENTITY_RESULT')){Remove-Item -LiteralPath ('Env:'+ $name) -ErrorAction SilentlyContinue}
 $stage='restricted-business-integration'
 $env:PHASE2_BOOKING_MODE='owner-approved-synthetic'
 $env:PHASE2_BOOKING_LEDGER=$ledger
 $env:PHASE2_SYNTHETIC_PASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($accountPtr)
 & 'C:\Program Files\nodejs\node.exe' (Join-Path $root 'server/node_modules/vitest/vitest.mjs') run --config (Join-Path $root 'server/test/phase2-booking.pg.vitest.config.ts') --reporter=default --reporter=json --outputFile=$report
 $suiteExit=$LASTEXITCODE
 if($suiteExit -ne 0 -or -not (Test-Path -LiteralPath $report)){throw 'STOP: business integration incomplete'}
 $summary=Get-Content -LiteralPath $report -Raw | ConvertFrom-Json
 if($summary.numPassedTests -ne 1 -or $summary.numFailedTests -ne 0 -or $summary.numPendingTests -ne 0){throw 'STOP: business integration assertions incomplete'}
 $stage='complete';$passed=$true
 Write-Host 'PHASE2_RECOVERY_RESTRICTED_API_POSTGRESQL_PASS_FIXTURES_RETAINED'
} catch {
 Write-Host ('PHASE2_RECOVERY_STOP_'+$stage)
 throw 'STOP: new recovery attempt incomplete. Preserve evidence; no retry, repair or cleanup.'
} finally {
 if(Test-Path -LiteralPath $marker){[IO.File]::WriteAllText($resultPath,(@{passed=$passed;stage=$stage;urlExit=$urlExit;psqlExit=$psqlExit;identityExit=$identityExit;suiteExit=$suiteExit;finishedUTC=[DateTime]::UtcNow.ToString('o');fixturesRetained=($stage -eq 'restricted-business-integration' -or $passed);privilegedOperations=$false} | ConvertTo-Json -Compress))}
 Write-Host ('Phase2 recovery business suite exit: '+$suiteExit)
 foreach($name in $names){Remove-Item -LiteralPath ('Env:'+ $name) -ErrorAction SilentlyContinue}
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($databasePtr)
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($accountPtr)
 $databaseSecret.Dispose();$accountSecret.Dispose()
}
