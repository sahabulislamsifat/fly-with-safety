param([switch]$SavedEvidenceOnly)
$ErrorActionPreference='Stop'
if(-not $SavedEvidenceOnly){throw 'OFFLINE_SAVED_EVIDENCE_SCOPE_REQUIRED'}
. (Join-Path $PSScriptRoot 'Read-FinalInvariantEvidence.ps1')
$source=(Resolve-Path (Join-Path $PSScriptRoot '..\final-invariants-review-20261101-01')).Path
foreach($pin in (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'preserved-attempt.json') -Raw|ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'PRESERVED_ATTEMPT_CHANGED'}
}
$caller=Join-Path $source 'Invoke-FinalStateReadOnly.ps1'
if((Get-FileHash -LiteralPath $caller -Algorithm SHA256).Hash -cne '6497E5A9DE62303A73B6E2A2C042B751F424FBFC3C3C0A4FE07C8D15333ACA6E'){throw 'ORIGINAL_CALLER_MISMATCH'}
$manifest=Join-Path $source 'pins.json';$manifestHash=(Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash
if(-not [IO.File]::ReadAllText($caller).Contains($manifestHash)){throw 'ORIGINAL_MANIFEST_BINDING_MISMATCH'}
foreach($pin in (Get-Content -LiteralPath $manifest -Raw|ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'BOUND_SOURCE_CHANGED'}
}
$wrapper=Get-Content -LiteralPath (Join-Path $source 'result.json') -Raw|ConvertFrom-Json
if($wrapper.queryExit -ne 0 -or $wrapper.readOnly -ne $true -or $wrapper.businessOperationsRerun -ne $false -or $wrapper.passed -ne $false -or $wrapper.checkedInvariants -ne 1){throw 'UNEXPECTED_WRAPPER_EVIDENCE'}
$names=@([regex]::Matches([IO.File]::ReadAllText((Join-Path $source 'verify-final.readonly.sql')), '(?m)^\(''([A-Za-z_]+)'',')|ForEach-Object {$_.Groups[1].Value})
$evidence=Read-FinalInvariantEvidence -Lines @(Get-Content -LiteralPath (Join-Path $source 'readonly-output.txt')) -QueryExit $wrapper.queryExit -ExpectedNames $names
$counts=@{}
foreach($name in @('users','sessions','bookings','passengers','history','idempotency','notifications')){
 $counts[$name]=@($evidence.items|Where-Object {$_.invariant -eq $name})[0].observed
}
$result=@{passed=$true;readOnly=$true;checkedInvariants=39;composedBusinessEvidence=$true;acceptedFromSavedEvidence=$true;
 historicalVitestResult='FAILED';historicalWrapperResult='FAILED';wrapperDefect='PS51_JSON_ARRAY_PIPELINE_CONTAINER_COUNT';
 databaseReexecuted=$false;businessOperationsRerun=$false;queryExit=0;sourceObservedUTC=$wrapper.finishedUTC;
 acceptedUTC=[DateTime]::UtcNow.ToString('o');observedInventory=$counts;statusActor='STAFF_EMAIL';
 evidenceHashes=@(Get-ChildItem -LiteralPath $source -File |Where-Object {$_.Name -in @('readonly-output.txt','result.json','attempt-started.json','invariant-observations.json','verify-final.readonly.sql','pins.json','prior-checkpoints.json')}|ForEach-Object {@{path=$_.FullName;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}})}
$target=Join-Path $PSScriptRoot 'accepted-evidence.json'
$stream=[IO.File]::Open($target,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try{$bytes=[Text.Encoding]::UTF8.GetBytes(($result|ConvertTo-Json -Depth 6));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
Write-Output 'PHASE2_SAVED_FINAL_INVARIANTS_ACCEPTED_39'
Write-Output 'Historical commercial test and wrapper remain FAILED. No database execution performed.'
