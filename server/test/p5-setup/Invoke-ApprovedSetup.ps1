[CmdletBinding()]
param([switch]$OwnerApprovedSetup)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
if(-not $OwnerApprovedSetup){throw 'STOP: setup approval required'}
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
if($repo -ine 'E:\Programming\Project\fly-with-safety'){throw 'STOP: exact workspace required'}
$manifestPath=Join-Path $PSScriptRoot 'pins.json'
if((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash -cne 'A789D265E294011840E0579D6D136B0F2C54B6EAE8B7DB008011F23576F094B5'){throw 'STOP: approved package manifest mismatch'}
$manifest=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json
foreach($pin in $manifest.files){
  $target=[IO.Path]::GetFullPath((Join-Path $repo $pin.path))
  if(-not $target.StartsWith($repo+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'STOP: pin outside workspace'}
  if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: package integrity mismatch'}
}
if((Get-FileHash -LiteralPath $manifest.node.path -Algorithm SHA256).Hash -cne $manifest.node.sha256){throw 'STOP: Node runtime mismatch'}
$attempt=Join-Path $repo 'output\phase5\p5-approved-setup-20261107-01\attempt.json'
if(Test-Path -LiteralPath $attempt){throw 'STOP: existing setup attempt; no retry'}
Add-Type -Path (Join-Path $PSScriptRoot 'OwnedJob.cs')
function Read-PrivateValue([string]$label){
  $value=Read-Host $label -AsSecureString
  $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
  try{return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)}
  finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer);$value.Dispose()}
}
function Read-NewPrivateValue([string]$label){
  $first=Read-PrivateValue $label
  $second=Read-PrivateValue ('Confirm '+$label)
  try{if($first -cne $second){throw 'STOP: new private passwords do not match; setup not started'};return $first}
  finally{$second=$null;$first=$null}
}
$process=$null;$job=$null;$privateInput=$null
try{
  $maintenanceUser=Read-Host 'Local maintenance role for postgres database (Enter = postgres)'
  if([string]::IsNullOrWhiteSpace($maintenanceUser)){$maintenanceUser='postgres'}
  $privateInput=@{
    maintenanceUser=$maintenanceUser
    maintenancePassword=(Read-PrivateValue 'Existing LOCAL maintenance password only; never cloud/provider')
    ownerPassword=(Read-NewPrivateValue 'NEW distinct migrator password: 20-128 ASCII characters; upper/lower/digit/symbol')
    appPassword=(Read-NewPrivateValue 'NEW distinct app password: 20-128 ASCII characters; upper/lower/digit/symbol')
  }
  $psi=New-Object Diagnostics.ProcessStartInfo
  $psi.FileName=$manifest.node.path
  $psi.Arguments='"'+(Join-Path $PSScriptRoot 'run.cjs')+'" --owner-approved-setup'
  $psi.WorkingDirectory=Join-Path $repo 'server'
  $psi.UseShellExecute=$false;$psi.CreateNoWindow=$true
  $psi.RedirectStandardInput=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
  $psi.EnvironmentVariables.Clear()
  foreach($name in @('SystemRoot','WINDIR','ProgramData','ProgramFiles','ProgramFiles(x86)','TEMP','TMP','PATH','PATHEXT','USERPROFILE','APPDATA','LOCALAPPDATA')){
    $value=[Environment]::GetEnvironmentVariable($name)
    if($value){$psi.EnvironmentVariables[$name]=$value}
  }
  $job=New-Object FwsP5OwnedJob
  $process=New-Object Diagnostics.Process;$process.StartInfo=$psi
  if(-not $process.Start()){throw 'STOP: owned setup process not started'}
  # Child cannot connect until private stdin arrives; attach its job first.
  try{$job.Attach($process.Handle)}catch{if(-not $process.HasExited){$process.Kill()};throw 'STOP: owned process containment unavailable; no credentials sent'}
  $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
  $privateWire=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($privateInput|ConvertTo-Json -Compress)))
  $process.StandardInput.WriteLine($privateWire);$privateWire=$null
  $process.StandardInput.Close();$privateInput.Clear();$privateInput=$null
  if(-not $process.WaitForExit(345000)){$job.Dispose();throw 'STOP: setup deadline; preserve state, no retry'}
  $process.WaitForExit();$text=$stdout.Result;$null=$stderr.Result
  $lines=@($text -split '\r?\n'|Where-Object {$_})
  if($lines.Count -ne 1){throw 'STOP: sanitized setup result unavailable; preserve state, no retry'}
  try{$summary=$lines[0]|ConvertFrom-Json}catch{throw 'STOP: invalid sanitized setup result; preserve state, no retry'}
  if($null -eq $summary.passed){throw 'STOP: setup result contract failed'}
  $job.Dispose();$job=$null
  Write-Output ($summary|ConvertTo-Json -Compress -Depth 8)
  if($process.ExitCode -ne 0 -or -not $summary.passed){throw 'STOP: setup failed; preserve artifacts and resources; no retry or cleanup'}
  Write-Output 'P5_ISOLATED_SETUP_MIGRATION_PASS_NOT_INTEGRATION_ACCEPTANCE'
}finally{
  if($privateInput){$privateInput.Clear()}
  if($job){$job.Dispose()}
  if($process){$process.Dispose()}
}
