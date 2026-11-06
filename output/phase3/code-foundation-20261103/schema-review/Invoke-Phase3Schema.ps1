param([switch]$OwnerApprovedPhase3LocalSchema)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
if(-not $OwnerApprovedPhase3LocalSchema){throw 'STOP: separate owner approval required for exact Phase3 local schema scope'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: existing private interactive Windows PowerShell5.1 required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: execution policy differs; no bypass'}
foreach($name in @('PGPASSWORD','PGHOSTADDR','PGOPTIONS','PGSERVICE','PGSERVICEFILE','PGPASSFILE')){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'STOP: PostgreSQL override present'}}
foreach($name in @('attempt.json','stdout.txt','result.json')){if(Test-Path -LiteralPath (Join-Path $PSScriptRoot $name)){throw 'STOP: existing Phase3 schema attempt; no retry'}}
$manifest=Join-Path $PSScriptRoot 'pins.json'
if((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne '6522A3F16B910A0E6BF3D3B082082CF9EADA9F2A2CE8411F3E19B8A18AB6AD3C'){throw 'STOP: Phase3 schema manifest mismatch'}
foreach($pin in (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json)){if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: Phase3 source/evidence integrity mismatch'}}
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$prep=Get-Content -LiteralPath (Join-Path $root 'output/database/local-rename-preparation-20261102-01/result.json') -Raw | ConvertFrom-Json
if(-not $prep.passed -or $prep.dumpExit -ne 0 -or $prep.archiveListExit -ne 0 -or $prep.fullArchiveReadExit -ne 0 -or $prep.restoreRehearsalExecuted){throw 'STOP: accepted private backup evidence differs'}
$archive=$prep.backupArchivePath
$ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$dirAcl=Get-Acl -LiteralPath (Split-Path -Parent $archive)
$fileAcl=Get-Acl -LiteralPath $archive
if(-not $dirAcl.AreAccessRulesProtected){throw 'STOP: private backup directory protection differs'}
foreach($acl in @($dirAcl,$fileAcl)){foreach($rule in $acl.Access){if($rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin @($ownerSid,'S-1-5-18')){throw 'STOP: unexpected backup access'}}}
$stream=[IO.File]::Open($archive,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
try {
 $algorithm=[Security.Cryptography.SHA256]::Create()
 try{$hash=[BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','')}finally{$algorithm.Dispose()}
 if($hash -cne $prep.backupFileSha256 -or $stream.Length -ne $prep.backupBytes){throw 'STOP: private backup checksum/size differs'}
 $psql='C:\Program Files\PostgreSQL\18\bin\psql.exe'
 if(-not (Test-Path -LiteralPath $psql -PathType Leaf)){throw 'STOP: reviewed local PostgreSQL client missing'}
 $attempt=@{startedUTC=[DateTime]::UtcNow.ToString('o');scope='Phase3 additive local schema only';database='flywithsafety_local_integration';oid=34701;noRetry=$true} | ConvertTo-Json
 $attemptBytes=[Text.Encoding]::UTF8.GetBytes($attempt)
 $attemptStream=[IO.File]::Open((Join-Path $PSScriptRoot 'attempt.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$attemptStream.Write($attemptBytes,0,$attemptBytes.Length)}finally{$attemptStream.Dispose()}
 Write-Host 'LOCAL SCHEMA ADMIN PHASE ONLY. Enter EXISTING postgres password at the ONE native prompt. No restricted-role password, provider credential or business test is requested.'
 $exit=$null
 try {
  $ErrorActionPreference='Continue'
  & $psql -X -W -v ON_ERROR_STOP=1 -P pager=off -h 127.0.0.1 -p 5432 -U postgres -d flywithsafety_local_integration -f (Join-Path $PSScriptRoot 'apply.review.sql') 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'stdout.txt')
  $exit=$LASTEXITCODE
 } finally {$ErrorActionPreference='Stop'}
 $output=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'stdout.txt') -Raw
 $committed=$output -match 'PHASE3_ADDITIVE_SCHEMA_COMMITTED'
 $postcheck=$output -match 'PHASE3_SCHEMA_FINAL_READONLY_PRESERVATION_PASS'
 $passed=($exit -eq 0 -and $committed -and $postcheck)
 $commitState='UNVERIFIED'
 if($committed){$commitState='CONFIRMED_BY_OUTPUT'}
 @{exit=$exit;commitMarkerObserved=$committed;commitState=$commitState;postcheckPassed=$postcheck;passed=$passed;businessTestsExecuted=$false;providerCalled=$false;finishedUTC=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'result.json') -Encoding UTF8
 Write-Host "Phase3 additive local schema exit: $exit; commit marker: $committed; postcheck: $postcheck"
 if(-not $passed){throw 'STOP: Phase3 schema incomplete; preserve partial/committed state, no retry, repair or cleanup'}
} finally {$stream.Dispose()}
