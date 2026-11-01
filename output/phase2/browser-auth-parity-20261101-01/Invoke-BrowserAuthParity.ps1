param([switch]$OwnerApprovedOneAuthParityHost)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
if(-not $OwnerApprovedOneAuthParityHost){throw 'STOP: separate explicit approval required for this new authentication-parity host'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: private interactive PS5.1 required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: policy differs; no bypass'}
$root=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$manifest=Join-Path $PSScriptRoot 'pins.json'
if((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne '036479FB59A1F640E0379096453AAFE6939F96FE9CEBDE42A0AF522E386E8F33'){throw 'STOP: manifest mismatch'}
foreach($pin in (Get-Content -LiteralPath $manifest -Raw|ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: dependency/evidence integrity mismatch'}
}
$accepted=Get-Content -LiteralPath (Join-Path $root 'output/phase2/final-evidence-acceptance-20261101-01/accepted-evidence.json') -Raw|ConvertFrom-Json
if($accepted.passed -ne $true -or $accepted.checkedInvariants -ne 39 -or $accepted.composedBusinessEvidence -ne $true){throw 'STOP: accepted commercial evidence missing'}
foreach($name in @('attempt-started.json','caller-result.json','vitest-result.json','host-journal.jsonl','host-stdout.txt','ready.json','host-result.json','finalization.json','stop-request.json','retained-records.json','retained-records-unavailable.json','psql-stdout.txt')){
 if(Test-Path -LiteralPath (Join-Path $PSScriptRoot $name)){throw 'Existing auth-parity host attempt; no retry'}
}
$names=@('DATABASE_URL','DIRECT_URL','PGPASSWORD','PGOPTIONS','PGSSLMODE','PGSSLNEGOTIATION','PGSERVICE','PGSERVICEFILE','PGHOSTADDR','PHASE2_BOOKING_DATABASE_URL','PHASE2_BROWSER_MODE','PHASE2_BROWSER_ARTIFACT_DIR')
foreach($name in $names){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'STOP: credential/mode/transport environment must be empty'}}
. (Join-Path $PSScriptRoot 'Set-PrivatePhase2Connection.ps1')
$secret=Read-Host 'EXISTING flywithsafe_phase2_booking_test password privately; ONE input for psql and Prisma, no postgres/account password' -AsSecureString
$stage='private-connection';$urlExit=$null;$psqlExit=$null;$hostExit=$null
try {
 Set-PrivatePhase2Connection -Secret $secret
 $marker=Join-Path $PSScriptRoot 'attempt-started.json'
 $stream=[IO.File]::Open($marker,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$data=@{target='flywithsafe_phase2_booking_integration';role='flywithsafe_phase2_booking_test';startedUTC=[DateTime]::UtcNow.ToString('o');businessAcceptance=$false}|ConvertTo-Json -Compress;$bytes=[Text.Encoding]::UTF8.GetBytes($data);$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
 $stage='private-url-equivalence'
 & 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'verify-private-url.cjs')
 $urlExit=$LASTEXITCODE
 if($urlExit -ne 0){throw 'STOP: private URL/driver equivalence failed; no database connection attempted'}
 $stage='same-input-psql-readonly'
 & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -w -h 127.0.0.1 -p 5432 -U flywithsafe_phase2_booking_test -d flywithsafe_phase2_booking_integration -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'credential-preflight.readonly.sql') | Tee-Object -FilePath (Join-Path $PSScriptRoot 'psql-stdout.txt')
 $psqlExit=$LASTEXITCODE
 if($psqlExit -ne 0){throw 'STOP: same-input psql failed; browser host not dispatched'}
 if(@(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'psql-stdout.txt')|Where-Object { $_.Trim() -eq 'PHASE2_SAME_INPUT_PSQL_READONLY_PASS' }).Count -ne 1){throw 'STOP: same-input psql evidence missing'}
 # Do not let pg fall back to a password environment variable; Prisma must use the verified URL.
 Remove-Item -LiteralPath Env:PGPASSWORD -ErrorAction SilentlyContinue
 $env:PHASE2_BROWSER_MODE='owner-approved-synthetic'
 $env:PHASE2_BROWSER_ARTIFACT_DIR=$PSScriptRoot
 $stage='prisma-browser-host'
 Write-Host 'Leave console open at READY for the real synthetic browser journey. No business proof or cleanup will rerun.'
 & 'C:\Program Files\nodejs\node.exe' (Join-Path $root 'server/node_modules/vitest/vitest.mjs') run --config (Join-Path $root 'server/test/phase2-browser-host.pg.vitest.config.ts') --reporter=default --reporter=json --outputFile (Join-Path $PSScriptRoot 'vitest-result.json') | Tee-Object -FilePath (Join-Path $PSScriptRoot 'host-stdout.txt')
 $hostExit=$LASTEXITCODE
 if($hostExit -ne 0){throw 'STOP: browser host failed; preserve precise diagnostic, no retry'}
 $stage='host-closed-not-business-acceptance'
} catch {
 Write-Host ('PHASE2_AUTH_PARITY_STOP_'+$stage)
 throw 'STOP: one auth-parity attempt incomplete; preserve evidence, no retry or cleanup'
} finally {
 if(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'attempt-started.json')){
  [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'caller-result.json'),(@{stage=$stage;urlExit=$urlExit;psqlExit=$psqlExit;hostExit=$hostExit;businessAcceptance=$false;finishedUTC=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Compress))
 }
 Write-Host ('Phase2 auth-parity browser host exit: '+$hostExit)
 foreach($name in $names){Remove-Item -LiteralPath ('Env:'+$name) -ErrorAction SilentlyContinue}
 $secret.Dispose()
}
