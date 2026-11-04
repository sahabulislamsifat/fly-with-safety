param([switch]$OwnerApprovedBoundedBrowserProof)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
if(-not $OwnerApprovedBoundedBrowserProof){throw 'STOP: separate bounded browser fixture/session approval required'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: existing private foreground Windows PowerShell5.1 required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: execution policy differs; no bypass'}
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
foreach($name in @('attempt-started.json','readonly-stdout.txt','ready.json','host-journal.jsonl','host-result.json','caller-result.json','retained-browser-records.json','stop-request.json','finalization.json','vitest-result.json')){if(Test-Path -LiteralPath (Join-Path $PSScriptRoot $name)){throw 'STOP: existing browser attempt; no retry'}}
if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'pins.json') -Algorithm SHA256).Hash -cne '__MANIFEST_SHA__'){throw 'STOP: browser manifest mismatch'}
foreach($pin in (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'pins.json') -Raw | ConvertFrom-Json)){if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: browser source/proof pin mismatch'}}
. (Join-Path $PSScriptRoot 'Assert-BackendPortFree.ps1')
Assert-Phase2BackendPortFree
$names=@('DATABASE_URL','DIRECT_URL','PGPASSWORD','PGOPTIONS','PGSSLMODE','PGSSLNEGOTIATION','PGSERVICE','PGSERVICEFILE','PGPASSFILE','PGHOSTADDR','PGTZ','NODE_ENV','EMAIL_DELIVERY_ENABLED','PHASE3_BROWSER_OWNER_APPROVED','PHASE3_BROWSER_ARTIFACT_DIR','SSLCOMMERZ_STORE_ID','SSLCOMMERZ_STORE_PASSWORD','SSLCOMMERZ_STORAGE_KEY','DEBUG','NODE_DEBUG','NODE_OPTIONS','PRISMA_LOG_LEVEL')
foreach($name in $names){if([Environment]::GetEnvironmentVariable($name,'Process')){throw "STOP: private browser environment override present: $name; value not logged"}}
. (Join-Path $PSScriptRoot 'Set-PrivateConnection.ps1')
$marker=[IO.File]::Open((Join-Path $PSScriptRoot 'attempt-started.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try{$bytes=[Text.Encoding]::UTF8.GetBytes('{"provider":"MOCK_ONLY","noRetry":true,"newUsers":0,"newBooking":1,"maxSessions":16}');$marker.Write($bytes,0,$bytes.Length)}finally{$marker.Dispose()}
$secret=$null;$readonlyExit=$null;$hostExit=$null;$passed=$false;$stage='private-input'
try{
 $secret=Read-Host 'EXISTING flywithsafe_phase2_booking_test DB password privately; NOT postgres or browser-account password' -AsSecureString
 Set-PrivatePhase3Connection -Secret $secret
 & 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'verify-private-url.cjs')
 if($LASTEXITCODE -ne 0){throw 'STOP: private URL parity failed'}
 $stage='restricted-readonly-preflight'
 try{
  $ErrorActionPreference='Continue'
  & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -w -h 127.0.0.1 -p 5432 -U flywithsafe_phase2_booking_test -d flywithsafety_local_integration -v ON_ERROR_STOP=1 -P pager=off -f (Join-Path $PSScriptRoot 'preflight.readonly.sql') 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'readonly-stdout.txt')
  $readonlyExit=$LASTEXITCODE
 }finally{$ErrorActionPreference='Stop'}
 if($readonlyExit -ne 0 -or -not (Select-String -LiteralPath (Join-Path $PSScriptRoot 'readonly-stdout.txt') -SimpleMatch 'PHASE3_BROWSER_READONLY_PRESTATE_PASS' -Quiet)){throw 'STOP: read-only browser prestate failed; no host/fixture dispatch'}
 $env:PHASE3_BROWSER_OWNER_APPROVED='true';$env:PHASE3_BROWSER_ARTIFACT_DIR=$PSScriptRoot
 $stage='browser-host'
 Push-Location $root
 try{
  $ErrorActionPreference='Continue'
  & 'C:\Program Files\nodejs\node.exe' (Join-Path $root 'server/node_modules/vitest/vitest.mjs') run --config (Join-Path $root 'server/test/phase3-browser-host.pg.vitest.config.ts') --reporter=default --reporter=json --outputFile (Join-Path $PSScriptRoot 'vitest-result.json') 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'host-stdout.txt')
  $hostExit=$LASTEXITCODE
 }finally{$ErrorActionPreference='Stop';Pop-Location}
 if($hostExit -eq 0 -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'finalization.json'))){$final=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'finalization.json') -Raw | ConvertFrom-Json;$passed=$final.disconnected -and -not $final.closeFailure -and -not $final.snapshotFailure -and -not $final.disconnectFailure}
 if(-not $passed){throw 'STOP: browser host incomplete; preserve evidence/fixtures; no retry/repair/cleanup'}
}finally{
 foreach($name in $names){Remove-Item -LiteralPath ('Env:'+$name) -ErrorAction SilentlyContinue}
 if($secret){$secret.Dispose()}
 [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'caller-result.json'),(@{passed=$passed;stage=$stage;readOnlyExit=$readonlyExit;hostExit=$hostExit;provider='MOCK_ONLY';cleanup=$false;finishedUTC=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json))
 Write-Host "Phase3 browser API host exit: $hostExit; readonly exit: $readonlyExit; passed: $passed"
}
