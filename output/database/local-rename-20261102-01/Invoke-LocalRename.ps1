param([switch]$OwnerApprovedInPlaceLocalRename)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
if(-not $OwnerApprovedInPlaceLocalRename){throw 'STOP: separate explicit in-place local rename approval required'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: private interactive Windows PowerShell5.1 required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: execution policy differs; no bypass'}
foreach($name in @('PGPASSWORD','PGHOSTADDR','PGOPTIONS','PGSERVICE','PGSERVICEFILE','PGPASSFILE')){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'STOP: PostgreSQL override present'}}
foreach($name in @('attempt.json','admin-stdout.txt','restricted-stdout.txt','result.json')){if(Test-Path -LiteralPath (Join-Path $PSScriptRoot $name)){throw 'STOP: existing rename attempt; preserve evidence, no retry'}}
$manifest=Join-Path $PSScriptRoot 'pins.json'
if((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne 'AB122A39C4A2193037F5C817AD5703FBD4E8287F2FB8510814FDC144CD7CE55F'){throw 'STOP: rename manifest mismatch'}
foreach($pin in (Get-Content -LiteralPath $manifest -Raw|ConvertFrom-Json)){if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: rename source or evidence changed'}}
$prep=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../local-rename-preparation-20261102-01/result.json') -Raw|ConvertFrom-Json
if(-not $prep.passed -or $prep.preflightExit -ne 0 -or $prep.dumpExit -ne 0 -or $prep.archiveListExit -ne 0 -or $prep.fullArchiveReadExit -ne 0 -or $prep.renameExecuted -or $prep.restoreRehearsalExecuted){throw 'STOP: accepted preparation evidence differs'}
$archive=$prep.backupArchivePath
$ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$dirAcl=Get-Acl -LiteralPath (Split-Path -Parent $archive)
$fileAcl=Get-Acl -LiteralPath $archive
if(-not $dirAcl.AreAccessRulesProtected){throw 'STOP: private backup directory no longer protected'}
foreach($acl in @($dirAcl,$fileAcl)){foreach($rule in $acl.Access){if($rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin @($ownerSid,'S-1-5-18')){throw 'STOP: unexpected backup access'}}}
$backupStream=[IO.File]::Open($archive,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
$algorithm=[Security.Cryptography.SHA256]::Create()
try{$backupHash=[BitConverter]::ToString($algorithm.ComputeHash($backupStream)).Replace('-','')}catch{$backupStream.Dispose();throw}finally{$algorithm.Dispose()}
if($backupStream.Length -ne $prep.backupBytes -or $backupHash -cne $prep.backupFileSha256){$backupStream.Dispose();throw 'STOP: verified backup archive changed'}
$stage='attempt-marker'
$result=@{passed=$false;renameCommitted=$false;adminExit=$null;adminPostcheckPassed=$false;restrictedExit=$null;restrictedPostcheckPassed=$false;sourceOID=34701;sourceName='flywithsafe_phase2_booking_integration';destinationName='flywithsafety_local_integration';referencePatchApplied=$false;restoreRehearsalExecuted=$false}
try {
 $stream=[IO.File]::Open((Join-Path $PSScriptRoot 'attempt.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$bytes=[Text.Encoding]::UTF8.GetBytes((@{startedUTC=[DateTime]::UtcNow.ToString('o');action='single-in-place-local-database-rename';sourceOID=34701;source='flywithsafe_phase2_booking_integration';destination='flywithsafety_local_integration';backupProtectedAndChecksumVerified=$true}|ConvertTo-Json -Compress));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
 $stage='guarded-admin-rename-and-postcheck'
 Write-Host 'EXISTING local postgres administrator password only at native private prompt. This is the separately approved in-place LOCAL rename.'
 $output=& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -W -h 127.0.0.1 -p 5432 -U postgres -d flywithsafe_phase2_booking_integration -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'rename.review.sql') | Tee-Object -FilePath (Join-Path $PSScriptRoot 'admin-stdout.txt')
 $result.adminExit=$LASTEXITCODE
 $result.renameCommitted=@($output|Where-Object {$_ -eq 'LOCAL_DATABASE_RENAME_COMMITTED_OID_34701'}).Count -eq 1
 $result.adminPostcheckPassed=@($output|Where-Object {$_ -eq 'LOCAL_DATABASE_RENAME_ADMIN_PRESERVATION_PASS'}).Count -eq 1
 if($result.adminExit -ne 0 -or -not $result.renameCommitted -or -not $result.adminPostcheckPassed){throw 'STOP: rename/admin verification incomplete; preserve actual state, no retry, reverse rename or repair'}
 $stage='restricted-role-readonly-postcheck'
 Write-Host 'Now enter EXISTING flywithsafe_phase2_booking_test password at the native private prompt; NOT the postgres password.'
 $output=& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -W -h 127.0.0.1 -p 5432 -U postgres -d flywithsafety_local_integration -U flywithsafe_phase2_booking_test -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'restricted.verify.readonly.sql') | Tee-Object -FilePath (Join-Path $PSScriptRoot 'restricted-stdout.txt')
 $result.restrictedExit=$LASTEXITCODE
 $result.restrictedPostcheckPassed=@($output|Where-Object {$_ -eq 'LOCAL_DATABASE_RENAME_RESTRICTED_ROLE_READONLY_PASS'}).Count -eq 1
 if($result.restrictedExit -ne 0 -or -not $result.restrictedPostcheckPassed){throw 'STOP: rename committed but restricted-role proof incomplete; no retry or repair'}
 $result.passed=$true
 Write-Host 'LOCAL_DATABASE_RENAME_AND_RESTRICTED_POSTCHECK_PASS'
} finally {
 $result.lastStage=$stage
 $result.finishedUTC=[DateTime]::UtcNow.ToString('o')
 try{[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'result.json'),($result|ConvertTo-Json -Compress))}finally{$backupStream.Dispose()}
 Write-Host ('Local database rename finished. Admin exit: '+$result.adminExit+'; restricted exit: '+$result.restrictedExit+'; passed: '+$result.passed)
}
