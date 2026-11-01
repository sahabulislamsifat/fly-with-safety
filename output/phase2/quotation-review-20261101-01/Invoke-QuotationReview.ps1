param([switch]$ReadOnlyReviewAuthorized)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
if(-not $ReadOnlyReviewAuthorized){throw 'STOP: read-only review authorization required'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: private interactive PS5.1 required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: policy differs; no bypass'}
$sql=Join-Path $PSScriptRoot 'reconcile.readonly.sql'
$root=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$ledger=Join-Path $root 'output/phase2/integration-recovery-20261101-01/fixture-ledger.jsonl'
if((Get-FileHash -LiteralPath $sql -Algorithm SHA256).Hash -cne 'CDB1FC4C76AB0C586F2C7ABF2A7B6894F159FE40F8AF782CA969AC1D2A373A6A'){throw 'STOP: read-only SQL mismatch'}
if((Get-FileHash -LiteralPath $ledger -Algorithm SHA256).Hash -cne '2F688CF6A9D7994DE2929C14F55BEA8063E2905D6A95A949EEC754B2B045D8C3'){throw 'STOP: original fixture evidence changed'}
foreach($name in @('PGPASSWORD','DATABASE_URL','DIRECT_URL','PGOPTIONS','PGSERVICE','PGSERVICEFILE')){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'STOP: credential/options environment must be empty'}}
$marker=Join-Path $PSScriptRoot 'readonly-attempt-started.json'
$result=Join-Path $PSScriptRoot 'readonly-result.json'
$output=Join-Path $PSScriptRoot 'readonly-output.txt'
foreach($path in @($marker,$result,$output)){if(Test-Path -LiteralPath $path){throw 'Existing quotation read-only review; no retry'}}
$stream=[IO.File]::Open($marker,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try{$bytes=[Text.Encoding]::UTF8.GetBytes((@{startedUTC=[DateTime]::UtcNow.ToString('o');readOnly=$true;target='flywithsafe_phase2_booking_integration';role='flywithsafe_phase2_booking_test'} | ConvertTo-Json -Compress));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
$exitCode=$null
try {
 & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -W -h 127.0.0.1 -p 5432 -U flywithsafe_phase2_booking_test -d flywithsafe_phase2_booking_integration -v ON_ERROR_STOP=1 -f $sql | Tee-Object -FilePath $output
 $exitCode=$LASTEXITCODE
 if($exitCode -ne 0){throw 'STOP: read-only review failed; preserve evidence, no retry'}
} finally {
 [IO.File]::WriteAllText($result,(@{queryExit=$exitCode;readOnly=$true;inventoryAccepted=$false;requiresActualOutputReview=$true;finishedUTC=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress))
 Write-Host ('Phase2 quotation read-only review exit: '+$exitCode)
}
