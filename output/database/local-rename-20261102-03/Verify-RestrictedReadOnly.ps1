param([switch]$ReadOnlyVerification)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
if(-not $ReadOnlyVerification){throw 'STOP: explicit read-only verification flag required; not a rename caller'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: private interactive Windows PowerShell5.1 required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: execution policy differs; no bypass'}
foreach($name in @('PGPASSWORD','PGHOSTADDR','PGOPTIONS','PGSERVICE','PGSERVICEFILE','PGPASSFILE')){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'STOP: PostgreSQL override present'}}
foreach($name in @('restricted-followup-attempt.json','restricted-followup-stdout.txt','restricted-followup-result.json')){if(Test-Path -LiteralPath (Join-Path $PSScriptRoot $name)){throw 'STOP: existing read-only follow-up attempt; preserve evidence, no retry'}}
$original=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'result.json') -Raw|ConvertFrom-Json
if($original.adminExit -ne 0 -or -not $original.renameCommitted -or -not $original.adminPostcheckPassed -or $original.sourceOID -ne 34701 -or $original.restrictedExit -ne 2){throw 'STOP: committed/admin-accepted failure state differs'}
$sql=Join-Path $PSScriptRoot 'restricted.verify.readonly.sql'
if((Get-FileHash -LiteralPath $sql -Algorithm SHA256).Hash -cne '2218BED8C13A4763A582D3F00D764C7D7EB8D59F465FDEE21C56B244F42B60FE'){throw 'STOP: unchanged reviewed read-only SQL hash mismatch'}
$stream=[IO.File]::Open((Join-Path $PSScriptRoot 'restricted-followup-attempt.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try{$bytes=[Text.Encoding]::UTF8.GetBytes((@{startedUTC=[DateTime]::UtcNow.ToString('o');action='restricted-role-readonly-postrename-followup-only';database='flywithsafety_local_integration';role='flywithsafe_phase2_booking_test';sourceOID=34701;renameExecuted=$false}|ConvertTo-Json -Compress));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
Write-Host 'READ ONLY, ONE login: EXISTING DATABASE ROLE flywithsafe_phase2_booking_test password only. NOT postgres and NOT synthetic browser-account password. No rename or other mutation.'
$output=& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -W -h 127.0.0.1 -p 5432 -U flywithsafe_phase2_booking_test -d flywithsafety_local_integration -v ON_ERROR_STOP=1 -f $sql | Tee-Object -FilePath (Join-Path $PSScriptRoot 'restricted-followup-stdout.txt')
$code=$LASTEXITCODE
$marker=@($output|Where-Object {$_ -eq 'LOCAL_DATABASE_RENAME_RESTRICTED_ROLE_READONLY_PASS'}).Count -eq 1
$passed=$code -eq 0 -and $marker
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'restricted-followup-result.json'),(@{exit=$code;passed=$passed;readOnlyMarker=$marker;renameExecuted=$false;sourceReferencePatchApplied=$false;finishedUTC=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Compress))
Write-Host ('Restricted-role read-only follow-up exit: '+$code+'; passed: '+$passed)
if(-not $passed){throw 'STOP: restricted read-only verification incomplete; preserve evidence, no retry, reset or repair'}
