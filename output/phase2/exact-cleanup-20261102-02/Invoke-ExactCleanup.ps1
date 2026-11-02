param([switch]$OwnerApprovedCorrectedExactCleanup)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
if(-not $OwnerApprovedCorrectedExactCleanup){throw 'STOP: exact33-row cleanup requires explicit owner approval'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: existing private interactive Windows PowerShell5.1 console required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: execution policy differs; no bypass'}
foreach($file in @('attempt-started.json','result.json','stdout.txt')){if(Test-Path -LiteralPath (Join-Path $PSScriptRoot $file)){throw 'STOP: existing cleanup attempt; preserve evidence, no retry'}}
foreach($name in @('PGPASSWORD','PGHOSTADDR','PGOPTIONS','PGSERVICE','PGSERVICEFILE')){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'STOP: PostgreSQL override present'}}
$manifest=Join-Path $PSScriptRoot 'pins.json'
if((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne '4D3E0971806D221FB9A78F4523D4FDBE263CA11B2AD3ABE2E67A319A3E76B001'){throw 'STOP: cleanup manifest integrity mismatch'}
foreach($pin in (Get-Content -LiteralPath $manifest -Raw|ConvertFrom-Json)){if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: cleanup source integrity mismatch'}}
$original=Join-Path $PSScriptRoot '../exact-cleanup-20261102-01'
foreach($file in @('attempt-started.json','result.json','stdout.txt')){if(Test-Path -LiteralPath (Join-Path $original $file)){throw 'STOP: original cleanup evidence exists; no replay'}}
$reconciled=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'reconcile-readonly-result.json') -Raw|ConvertFrom-Json
if($reconciled.exit -ne 0 -or -not $reconciled.all33PresentAndPreconditionsPass -or $reconciled.all33Absent -or -not $reconciled.readOnlyFinished -or $reconciled.cleanupExecutedByThisReview){throw 'STOP: corrected read-only Case A not accepted'}
$root=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$closed=Get-Content -LiteralPath (Join-Path $root 'output/phase2/sameports-browser-20261102-02/caller-result.json') -Raw|ConvertFrom-Json
$final=Get-Content -LiteralPath (Join-Path $root 'output/phase2/sameports-browser-20261102-02/finalization.json') -Raw|ConvertFrom-Json
if($closed.hostExit -ne 0 -or $final.snapshotSkipped -or $final.closeFailure -or $final.snapshotFailure -or $final.disconnectFailure){throw 'STOP: completed browser-host ledger not verified'}
$stream=[IO.File]::Open((Join-Path $PSScriptRoot 'attempt-started.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try{$data=@{startedUTC=[DateTime]::UtcNow.ToString('o');target='flywithsafe_phase2_booking_integration';expectedRows=33;action='payload-corrected-exact-owned-cleanup'}|ConvertTo-Json -Compress;$bytes=[Text.Encoding]::UTF8.GetBytes($data);$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
Write-Host 'EXISTING local postgres administrator password only at psql private prompt; no application credentials are requested.'
$output=& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -W -h 127.0.0.1 -p 5432 -U postgres -d flywithsafe_phase2_booking_integration -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'cleanup.review.sql') | Tee-Object -FilePath (Join-Path $PSScriptRoot 'stdout.txt')
$code=$LASTEXITCODE
$committed=@($output|Where-Object {$_ -eq 'PHASE2_EXACT_OWNED_CLEANUP_COMMITTED_33_ROWS'}).Count -eq 1
$checked=@($output|Where-Object {$_ -eq 'PHASE2_CLEANUP_CATALOG_ACCESS_AND_FINAL_READONLY_PASS'}).Count -eq 1
$passed=$code -eq 0 -and $committed -and $checked
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'result.json'),(@{exit=$code;committedMarker=$committed;finalReadOnlyPassed=$checked;passed=$passed;expectedRows=33;finishedUTC=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Compress))
Write-Host ('Phase2 exact-owned cleanup exit: '+$code)
if(-not $passed){throw 'STOP: cleanup incomplete; preserve actual state, no retry or repair'}
