param([switch]$OwnerApprovedSyntheticPaymentProof)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
if(-not $OwnerApprovedSyntheticPaymentProof){throw 'STOP: explicit bounded synthetic fixture proof approval required'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: private interactive Windows PowerShell5.1 required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: execution policy differs; no bypass'}
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
foreach($name in @('attempt-started.json','readonly-stdout.txt','vitest-result.json','proof-attempt.json','ledger.jsonl','proof-result.json','caller-result.json','proof-stdout.txt')){if(Test-Path -LiteralPath (Join-Path $PSScriptRoot $name)){throw 'STOP: existing proof artifact; preserve evidence, no retry'}}
$manifest=Join-Path $PSScriptRoot 'pins.json'
if((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne 'D79720E8CC35E6C341974E30B5600CF3921E64E396FE37B1AB75B03CC290CD14'){throw 'STOP: payment proof manifest mismatch'}
foreach($pin in (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json)){if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: payment proof source/evidence pin mismatch'}}
$schema=Get-Content -LiteralPath (Join-Path $root 'output/phase3/code-foundation-20261103/schema-review/result.json') -Raw | ConvertFrom-Json
if(-not $schema.passed -or $schema.exit -ne 0 -or -not $schema.commitMarkerObserved -or -not $schema.postcheckPassed -or $schema.providerCalled -or $schema.businessTestsExecuted){throw 'STOP: actual accepted schema evidence missing'}
$names=@('DATABASE_URL','DIRECT_URL','PGPASSWORD','PGOPTIONS','PGSSLMODE','PGSSLNEGOTIATION','PGSERVICE','PGSERVICEFILE','PGPASSFILE','PGHOSTADDR','PHASE3_LEDGER_OWNER_APPROVED','PHASE3_SCHEMA_APPROVED','PHASE3_LEDGER_EVIDENCE_DIR','PHASE3_SYNTHETIC_PASSWORD','NODE_ENV','EMAIL_DELIVERY_ENABLED','DEBUG','NODE_DEBUG','NODE_OPTIONS','PRISMA_LOG_LEVEL')
foreach($name in $names){if([Environment]::GetEnvironmentVariable($name,'Process')){throw "STOP: private proof environment override present: $name; values are not logged; do not overwrite normal configuration"}}
. (Join-Path $PSScriptRoot 'Set-PrivateConnection.ps1')
$marker=[IO.File]::Open((Join-Path $PSScriptRoot 'attempt-started.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try{$bytes=[Text.Encoding]::UTF8.GetBytes((@{startedUTC=[DateTime]::UtcNow.ToString('o');provider='MOCK_ONLY';scope='4 synthetic users,2 bookings,2 passengers;bounded payment proof;no cleanup';noRetry=$true}|ConvertTo-Json -Compress));$marker.Write($bytes,0,$bytes.Length)}finally{$marker.Dispose()}
$dbSecret=$null;$actorSecret=$null;$stage='private-input';$readonlyExit=$null;$proofExit=$null;$passed=$false
try {
 $dbSecret=Read-Host 'EXISTING flywithsafe_phase2_booking_test password privately; NOT postgres' -AsSecureString
 Set-PrivatePhase3Connection -Secret $dbSecret
 & 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'verify-private-url.cjs')
 if($LASTEXITCODE -ne 0){throw 'STOP: private URL equivalence guard failed'}
 $stage='restricted-readonly-preflight'
 try {
  $ErrorActionPreference='Continue'
  & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -w -v ON_ERROR_STOP=1 -P pager=off -h 127.0.0.1 -p 5432 -U flywithsafe_phase2_booking_test -d flywithsafety_local_integration -f (Join-Path $PSScriptRoot 'preflight.readonly.sql') 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'readonly-stdout.txt')
  $readonlyExit=$LASTEXITCODE
 }finally{$ErrorActionPreference='Stop'}
 if($readonlyExit -ne 0){throw 'STOP: restricted read-only preflight failed; no business dispatch'}
 if(-not ((Get-Content -LiteralPath (Join-Path $PSScriptRoot 'readonly-stdout.txt') -Raw) -match 'PHASE3_RESTRICTED_READONLY_SCHEMA_ACCESS_PASS')){throw 'STOP: read-only marker missing; no business dispatch'}
 $actorSecret=Read-Host 'NEW development-only password for FOUR synthetic browser actors, at least16characters; remember privately, NOT database password' -AsSecureString
 if($actorSecret.Length -lt 16){throw 'STOP: synthetic actor password too short; no business dispatch'}
 $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($actorSecret)
 try{
  $actorPlain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  if($actorPlain.IndexOf([char]0) -ge 0 -or [Text.Encoding]::UTF8.GetByteCount($actorPlain) -gt 72){throw 'STOP: synthetic password must fit bcrypt72byte boundary; no business dispatch'}
  $env:PHASE3_SYNTHETIC_PASSWORD=$actorPlain
 }finally{$actorPlain=$null;[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
 $env:PHASE3_LEDGER_OWNER_APPROVED='true';$env:PHASE3_SCHEMA_APPROVED='true';$env:PHASE3_LEDGER_EVIDENCE_DIR=$PSScriptRoot;$env:NODE_ENV='test';$env:EMAIL_DELIVERY_ENABLED='false'
 $stage='restricted-payment-business-proof'
 Push-Location $root
 try {
  $ErrorActionPreference='Continue'
  & 'C:\Program Files\nodejs\node.exe' (Join-Path $root 'server/node_modules/vitest/vitest.mjs') run --config (Join-Path $root 'server/test/phase3-ledger.pg.vitest.config.ts') --reporter=default --reporter=json --outputFile (Join-Path $PSScriptRoot 'vitest-result.json') 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'proof-stdout.txt')
  $proofExit=$LASTEXITCODE
 }finally{$ErrorActionPreference='Stop';Pop-Location}
 $r=$null
 if(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'proof-result.json')){
  $r=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'proof-result.json') -Raw | ConvertFrom-Json
  Write-Host ('Payment proof checks: PASS='+$r.checksPassed+'; FAIL='+$r.checksFailed+'; UNEXECUTED='+$r.unexecutedChecks)
 }
 if($proofExit -ne 0 -or $null -eq $r){throw 'STOP: payment proof incomplete; preserve fixtures and evidence'}
 $passed=($r.passed -eq $true -and $r.snapshotPassed -eq $true -and $r.disconnected -eq $true -and $r.checksFailed -eq 0 -and $r.unexecutedChecks -eq 0 -and $r.provider -eq 'MOCK_ONLY')
 if(-not $passed){throw 'STOP: proof/final-owned-ledger checks incomplete'}
 Write-Host 'PHASE3_RESTRICTED_POSTGRES_PAYMENT_PROOF_PASS_NOT_PROVIDER_ACCEPTANCE'
}finally {
 foreach($name in $names){Remove-Item -LiteralPath ('Env:'+$name) -ErrorAction SilentlyContinue}
 if($dbSecret){$dbSecret.Dispose()};if($actorSecret){$actorSecret.Dispose()}
 [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'caller-result.json'),(@{passed=$passed;stage=$stage;readOnlyExit=$readonlyExit;proofExit=$proofExit;provider='MOCK_ONLY';cleanupExecuted=$false;finishedUTC=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json))
 Write-Host "Phase3 restricted PostgreSQL proof exit: $proofExit; readonly exit: $readonlyExit; passed: $passed"
}
