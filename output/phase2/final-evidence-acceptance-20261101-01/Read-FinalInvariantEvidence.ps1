function Read-FinalInvariantEvidence {
 param([string[]]$Lines,[int]$QueryExit,[string[]]$ExpectedNames)
 if($QueryExit -ne 0){throw 'FINAL_EVIDENCE_QUERY_EXIT'}
 $jsonLines=@($Lines | Where-Object {$_ -match '^\s*\['})
 if($jsonLines.Count -ne 1){throw 'FINAL_EVIDENCE_JSON_COUNT'}
 # PS5.1 ConvertFrom-Json emits an array as ONE pipeline object. Parentheses
 # evaluate that object before @() enumerates its 39 elements; never count the pipeline container.
 $items=@(($jsonLines[0] | ConvertFrom-Json))
 if($items.Count -ne 39 -or $ExpectedNames.Count -ne 39){throw 'FINAL_EVIDENCE_ITEM_COUNT'}
 if(@($Lines|Where-Object {$_ -eq 'PHASE2_FINAL_STATE_READONLY_VERIFIED_PASS'}).Count -ne 1){throw 'FINAL_EVIDENCE_PASS_MARKER'}
 if(@($Lines|Where-Object {$_ -eq 'ROLLBACK'}).Count -ne 1){throw 'FINAL_EVIDENCE_ROLLBACK'}
 $names=@($items.invariant|Sort-Object -Unique)
 if($names.Count -ne 39 -or @(Compare-Object $names ($ExpectedNames|Sort-Object)).Count -ne 0){throw 'FINAL_EVIDENCE_NAMES'}
 foreach($item in $items){
  if($item.matched -isnot [bool] -or $item.matched -ne $true -or -not [object]::Equals($item.expected,$item.observed)){throw 'FINAL_EVIDENCE_MISMATCH'}
  foreach($value in @($item.expected,$item.observed)){
   if($value -is [bool] -or $value -is [int]){continue}
   if($value -is [string] -and $value -cin @('COMPLETED','STAFF_EMAIL')){continue}
   throw 'FINAL_EVIDENCE_UNSAFE_VALUE'
  }
 }
 [pscustomobject]@{passed=$true;checkedInvariants=$items.Count;items=$items}
}
