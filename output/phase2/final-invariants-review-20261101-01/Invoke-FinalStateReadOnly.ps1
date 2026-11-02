param([switch]$OwnerApprovedReadOnlyFinalVerification)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
if(-not $OwnerApprovedReadOnlyFinalVerification){throw 'STOP: explicit approval for this new read-only final verification required'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: private interactive PS5.1 required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: policy differs; no bypass'}
$manifest=Join-Path $PSScriptRoot 'pins.json'
if((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne '68DA947DD51FFAA6D2B49E960C0309D93088F063759707A6F39E96F4CBFFE79F'){throw 'STOP: manifest mismatch'}
foreach($pin in (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: source/evidence integrity mismatch'}
}
$eligibility=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'prior-checkpoints.json') -Raw | ConvertFrom-Json
if($eligibility.allRequiredCheckpointsPassed -ne $true -or $eligibility.businessRerunRequired -ne $false){throw 'STOP: composed evidence preconditions missing'}
foreach($name in @('PGPASSWORD','DATABASE_URL','DIRECT_URL','PGOPTIONS','PGSERVICE','PGSERVICEFILE','PGHOSTADDR')){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'STOP: credential/options environment must be empty'}}
$marker=Join-Path $PSScriptRoot 'attempt-started.json'
$result=Join-Path $PSScriptRoot 'result.json'
$output=Join-Path $PSScriptRoot 'readonly-output.txt'
$observations=Join-Path $PSScriptRoot 'invariant-observations.json'
foreach($file in @($marker,$result,$output,$observations)){if(Test-Path -LiteralPath $file){throw 'Existing final read-only verification attempt; no retry'}}
$stream=[IO.File]::Open($marker,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try{$bytes=[Text.Encoding]::UTF8.GetBytes((@{startedUTC=[DateTime]::UtcNow.ToString('o');readOnly=$true;target='flywithsafe_phase2_booking_integration';role='flywithsafe_phase2_booking_test'} | ConvertTo-Json -Compress));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
$queryExit=$null;$passed=$false;$checked=0
try {
 & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -W -h 127.0.0.1 -p 5432 -U flywithsafe_phase2_booking_test -d flywithsafe_phase2_booking_integration -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'verify-final.readonly.sql') | Tee-Object -FilePath $output
 $queryExit=$LASTEXITCODE
 $lines=@(Get-Content -LiteralPath $output | Where-Object { $_ -match '^\s*\[' })
 $items=@()
 if($lines.Count -eq 1){$items=@($lines[0] | ConvertFrom-Json);$checked=$items.Count;[IO.File]::WriteAllText($observations,($items | ConvertTo-Json -Depth 5))}
 if($queryExit -ne 0){throw 'STOP: read-only invariant SQL failed; named observations preserved when available'}
 if($lines.Count -ne 1){throw 'STOP: structured invariant output missing'}
 $markers=@(Get-Content -LiteralPath $output | Where-Object { $_ -eq 'PHASE2_FINAL_STATE_READONLY_VERIFIED_PASS' })
 $passed=($checked -eq 39 -and @($items | Where-Object { $_.matched -ne $true }).Count -eq 0 -and @($items.invariant | Select-Object -Unique).Count -eq 39 -and $markers.Count -eq 1)
 if(-not $passed){throw 'STOP: final read-only invariant evidence incomplete'}
 Write-Host 'PHASE2_COMMERCIAL_COMPOSED_EVIDENCE_VERIFIED_PASS'
} finally {
 [IO.File]::WriteAllText($result,(@{passed=$passed;queryExit=$queryExit;checkedInvariants=$checked;readOnly=$true;composedBusinessEvidence=$passed;historicalVitestResultRemainsFailed=$true;businessOperationsRerun=$false;finishedUTC=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress))
 Write-Host ('Phase2 final-state read-only verification exit: '+$queryExit)
}
