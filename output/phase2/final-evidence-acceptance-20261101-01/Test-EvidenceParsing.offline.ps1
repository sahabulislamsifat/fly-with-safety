$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Read-FinalInvariantEvidence.ps1')
$source=Join-Path $PSScriptRoot '..\final-invariants-review-20261101-01'
$lines=@(Get-Content -LiteralPath (Join-Path $source 'readonly-output.txt'))
$names=@([regex]::Matches([IO.File]::ReadAllText((Join-Path $source 'verify-final.readonly.sql')), '(?m)^\(''([A-Za-z_]+)'',')|ForEach-Object {$_.Groups[1].Value})
$json=@($lines|Where-Object {$_ -match '^\s*\['})[0]
$old=@($json|ConvertFrom-Json)
if($PSVersionTable.PSVersion.Major -eq 5 -and ($old.Count -ne 1 -or $old[0].Count -ne 39)){throw 'OLD_FAILURE_NOT_REPRODUCED'}
$good=Read-FinalInvariantEvidence -Lines $lines -QueryExit 0 -ExpectedNames $names
if($good.checkedInvariants -ne 39){throw 'SAVED_EVIDENCE_NOT_ACCEPTED'}
$tests=1
function Expect-Rejected([string[]]$candidate,[int]$exitCode=0){
 $rejected=$false
 try{[void](Read-FinalInvariantEvidence -Lines $candidate -QueryExit $exitCode -ExpectedNames $names)}catch{$rejected=$true}
 if(-not $rejected){throw 'INVALID_EVIDENCE_ACCEPTED'}
 $script:tests++
}
Expect-Rejected $lines 1
Expect-Rejected @($lines|Where-Object {$_ -ne 'PHASE2_FINAL_STATE_READONLY_VERIFIED_PASS'})
Expect-Rejected @($lines|Where-Object {$_ -ne 'ROLLBACK'})
function Replace-Items($items){@(($items|ConvertTo-Json -Depth 6 -Compress),'ROLLBACK','PHASE2_FINAL_STATE_READONLY_VERIFIED_PASS')}
$items=@(($json|ConvertFrom-Json));Expect-Rejected (Replace-Items @($items|Select-Object -First 38))
$items=@(($json|ConvertFrom-Json));$items[1].invariant=$items[0].invariant;Expect-Rejected (Replace-Items $items)
$items=@(($json|ConvertFrom-Json));$items[0].matched=$false;Expect-Rejected (Replace-Items $items)
$items=@(($json|ConvertFrom-Json));$items[0].observed=$false;Expect-Rejected (Replace-Items $items)
$items=@(($json|ConvertFrom-Json));$items[0].expected='arbitrary-secret';$items[0].observed='arbitrary-secret';Expect-Rejected (Replace-Items $items)
Expect-Rejected @($lines+$json)
@{passed=$tests;failed=0;skipped=0;version=$PSVersionTable.PSVersion.ToString();originalOuterCount=$old.Count;fixedCount=$good.checkedInvariants;databaseExecuted=$false}|ConvertTo-Json -Compress
