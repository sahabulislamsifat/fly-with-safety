param([switch]$OwnerApprovedReadOnlyBackupPreparation)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
if(-not $OwnerApprovedReadOnlyBackupPreparation){throw 'STOP: one read-only/private-backup preparation approval required; this does NOT approve rename'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: private interactive Windows PowerShell5.1 required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: execution policy differs; no bypass'}
foreach($name in @('PGPASSWORD','PGHOSTADDR','PGOPTIONS','PGSERVICE','PGSERVICEFILE','PGPASSFILE')){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'STOP: PostgreSQL override present'}}
foreach($name in @('attempt.json','stdout.txt','result.json')){if(Test-Path -LiteralPath (Join-Path $PSScriptRoot $name)){throw 'STOP: existing preparation attempt; preserve it, no retry'}}
$manifest=Join-Path $PSScriptRoot 'pins.json'
if((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne 'B7F94F1E58496533AB87A5143314612149EC268DB70280D28618C4C192AF7E36'){throw 'STOP: preparation manifest mismatch'}
foreach($pin in (Get-Content -LiteralPath $manifest -Raw|ConvertFrom-Json)){if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: preparation pin mismatch'}}
$acceptance=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../../phase2/phase2-formal-acceptance-20261102.json') -Raw|ConvertFrom-Json
if($acceptance.acceptedIds.Count -ne 14 -or $acceptance.cleanup.exit -ne 0 -or -not $acceptance.cleanup.readOnlyPostcheckPassed){throw 'STOP: formal Phase2 acceptance not verified'}
$backupRoot=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'FlyWithSafe\Backups'))
$backupDir=[IO.Path]::GetFullPath((Join-Path $backupRoot 'local-rename-20261102-01'))
if(-not $backupDir.StartsWith($backupRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $backupDir)){throw 'STOP: private backup path mismatch or already exists'}
$stream=[IO.File]::Open((Join-Path $PSScriptRoot 'attempt.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try{$bytes=[Text.Encoding]::UTF8.GetBytes((@{startedUTC=[DateTime]::UtcNow.ToString('o');action='readonly-preflight-and-private-backup-only';target='127.0.0.1:5432/flywithsafe_phase2_booking_integration'}|ConvertTo-Json -Compress));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
$stage='read-only-preflight'
$result=@{passed=$false;renameExecuted=$false;preflightExit=$null;dumpExit=$null;archiveListExit=$null;fullArchiveReadExit=$null;restoreRehearsalExecuted=$false}
try {
 Write-Host 'READ ONLY preflight. Existing local postgres password only at native private prompts; no rename or application credentials.'
 $output=& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -W -h 127.0.0.1 -p 5432 -U postgres -d flywithsafe_phase2_booking_integration -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'preflight.readonly.sql') | Tee-Object -FilePath (Join-Path $PSScriptRoot 'stdout.txt')
 $result.preflightExit=$LASTEXITCODE
 if($result.preflightExit -ne 0 -or @($output|Where-Object {$_ -eq 'LOCAL_RENAME_PREFLIGHT_PASS_NO_RENAME'}).Count -ne 1){throw 'STOP: preflight failed; no backup or rename'}
 $stage='private-backup-directory'
 [IO.Directory]::CreateDirectory($backupDir)|Out-Null
 $acl=Get-Acl -LiteralPath $backupDir
 $acl.SetAccessRuleProtection($true,$false)
 $ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User
 foreach($sid in @($ownerSid,(New-Object Security.Principal.SecurityIdentifier('S-1-5-18')))){
  $rule=New-Object Security.AccessControl.FileSystemAccessRule($sid,[Security.AccessControl.FileSystemRights]::FullControl,([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit),[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow)
  $acl.AddAccessRule($rule)
 }
 Set-Acl -LiteralPath $backupDir -AclObject $acl
 $archive=Join-Path $backupDir 'integration-before-rename.dump'
 $stage='private-pg-dump'
 Write-Host 'Private full logical backup outside repository. Enter the SAME existing local postgres password at pg_dump prompt.'
 & 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' -W -h 127.0.0.1 -p 5432 -U postgres -d flywithsafe_phase2_booking_integration --format=custom --file $archive
 $result.dumpExit=$LASTEXITCODE
 if($result.dumpExit -ne 0 -or -not (Test-Path -LiteralPath $archive -PathType Leaf)){throw 'STOP: backup incomplete; preserve partial archive, no retry'}
 $stage='archive-table-of-contents'
 & 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe' --list $archive | Out-File -LiteralPath (Join-Path $backupDir 'archive-toc.txt') -Encoding utf8
 $result.archiveListExit=$LASTEXITCODE
 if($result.archiveListExit -ne 0){throw 'STOP: archive table-of-contents verification failed'}
 $stage='full-archive-read-without-database'
 & 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe' --file NUL $archive
 $result.fullArchiveReadExit=$LASTEXITCODE
 if($result.fullArchiveReadExit -ne 0){throw 'STOP: full archive read failed'}
 $result.backupArchivePath=$archive
 $result.backupBytes=(Get-Item -LiteralPath $archive).Length
 $result.backupFileSha256=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
 $result.passed=$true
 Write-Host 'LOCAL_RENAME_PREPARATION_PASS_NO_RENAME'
 Write-Host 'Archive fully read/decompressed to NUL; no database restore rehearsal or rename occurred. Keep backup private; do not upload or commit it.'
} finally {
 $result.lastStage=$stage
 $result.finishedUTC=[DateTime]::UtcNow.ToString('o')
 [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'result.json'),($result|ConvertTo-Json -Compress))
 Write-Host ('Local rename preparation passed: '+$result.passed+'; rename executed: False')
}
