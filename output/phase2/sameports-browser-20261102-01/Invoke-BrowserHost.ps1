param([switch]$OwnerApprovedSamePortTest)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
if(-not $OwnerApprovedSamePortTest){throw 'STOP: explicit synthetic browser scope required'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: private interactive PS5.1 required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: policy differs; no bypass'}
$root=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$proof=Join-Path $root 'output/phase2/final-evidence-acceptance-20261101-01/accepted-evidence.json'
if(-not (Test-Path -LiteralPath $proof)){throw 'STOP: actual restricted integration success missing'}
$accepted=Get-Content -LiteralPath $proof -Raw | ConvertFrom-Json
if($accepted.passed -ne $true -or $accepted.checkedInvariants -ne 39 -or $accepted.acceptedFromSavedEvidence -ne $true -or $accepted.composedBusinessEvidence -ne $true){throw 'STOP: accepted commercial evidence missing'}
$manifest=Join-Path $PSScriptRoot 'pins.json'
if((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne '79F6D30CF9C9E8FB5147A1C4BA7C9ED94EC8037F5B84C8DFCBA400C3A2C3D6CD'){throw 'STOP: manifest mismatch'}
foreach($pin in (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: source integrity mismatch'}
}
$marker=Join-Path $PSScriptRoot 'attempt-started.json'
if(Test-Path -LiteralPath (Join-Path $root 'output/phase2/local-ownership-auth-output.txt')){throw 'STOP: ownership result already exists; agent review required before another workflow'}
foreach($name in @('host-stdout.txt','finalization.json','retained-records.json','retained-records-unavailable.json','stop-request.json')){if(Test-Path -LiteralPath (Join-Path $PSScriptRoot $name)){throw 'Existing browser artifact; stop and preserve evidence'}}
if((Test-Path -LiteralPath (Join-Path $PSScriptRoot 'caller-result.json')) -or (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'vitest-result.json')) -or (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'host-journal.jsonl')) -or (Test-Path -LiteralPath $marker) -or (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'ready.json')) -or (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'host-result.json'))){throw 'Existing browser host session; stop and preserve evidence'}
$names=@('DATABASE_URL','DIRECT_URL','PGPASSWORD','PHASE2_BROWSER_MODE','PHASE2_BOOKING_DATABASE_URL','PHASE2_BROWSER_ARTIFACT_DIR','PGOPTIONS','PGSSLMODE','PGSSLNEGOTIATION','PGSERVICE','PGSERVICEFILE','PGHOSTADDR')
foreach($name in $names){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'STOP: runtime credential/mode environment must be empty'}}
$probe=New-Object Net.Sockets.TcpClient
try {
 $pending=$probe.BeginConnect('localhost',5000,$null,$null)
 if(-not $pending.AsyncWaitHandle.WaitOne(2000)){throw 'STOP: backend port state inconclusive'}
 try {$probe.EndConnect($pending); $busy=$true} catch [Net.Sockets.SocketException] {if($_.Exception.SocketErrorCode -ne [Net.Sockets.SocketError]::ConnectionRefused){throw 'STOP: backend port state inconclusive'}; $busy=$false}
 if($busy){throw 'STOP: port5000 occupied; approved normal-backend interruption must happen first'}
} finally {$probe.Dispose()}
$secret=Read-Host 'EXISTING flywithsafe_phase2_booking_test password privately; no postgres' -AsSecureString
. (Join-Path $PSScriptRoot 'Set-PrivatePhase2Connection.ps1')
try {
 Set-PrivatePhase2Connection -Secret $secret
 $env:PHASE2_BROWSER_MODE='owner-approved-synthetic'
 $env:PHASE2_BROWSER_ARTIFACT_DIR=$PSScriptRoot
 $stream=[IO.File]::Open($marker,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$data=@{target='flywithsafe_phase2_booking_integration';role='flywithsafe_phase2_booking_test';startedUTC=[DateTime]::UtcNow.ToString('o');businessAcceptance=$false}|ConvertTo-Json -Compress;$bytes=[Text.Encoding]::UTF8.GetBytes($data);$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
 $ownership=Join-Path $root 'output/phase2/local-ownership-auth-output.txt'
 if(Test-Path -LiteralPath $ownership){throw 'STOP: ownership result already exists; review it without rerunning'}
 & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -w -h 127.0.0.1 -p 5432 -U flywithsafe_phase2_booking_test -d flywithsafe_phase2_booking_integration -v ON_ERROR_STOP=1 -f (Join-Path $root 'output/phase2/local-ownership-auth.readonly.sql') | Tee-Object -FilePath $ownership
 $ownershipExit=$LASTEXITCODE
 if($ownershipExit -ne 0){[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'caller-result.json'),(@{stage='readonly-ownership';exit=$ownershipExit;businessAcceptance=$false}|ConvertTo-Json -Compress));throw 'STOP: read-only ownership check failed; preserve evidence, no retry'}
 Write-Host 'Leave this console open for the synthetic browser session. No passwords are logged. Host readiness is not acceptance.'
 & 'C:\Program Files\nodejs\node.exe' (Join-Path $root 'server/node_modules/vitest/vitest.mjs') run --config (Join-Path $root 'server/test/phase2-browser-host.pg.vitest.config.ts') --reporter=default --reporter=json --outputFile (Join-Path $PSScriptRoot 'vitest-result.json') | Tee-Object -FilePath (Join-Path $PSScriptRoot 'host-stdout.txt')
 $hostExit=$LASTEXITCODE
 [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'caller-result.json'),(@{hostExit=$hostExit;businessAcceptance=$false;finishedUTC=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Compress))
 Write-Host ('Phase2 browser API host exit: '+$hostExit)
 if($hostExit -ne 0){throw 'STOP: host session failed; preserve state, no automatic restart or cleanup'}
} finally {
 foreach($name in $names){Remove-Item -LiteralPath ('Env:'+ $name) -ErrorAction SilentlyContinue}
 $secret.Dispose()
}
