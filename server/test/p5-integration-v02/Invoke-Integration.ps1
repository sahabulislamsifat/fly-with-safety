param([switch]$OwnerApprovedIntegration)
$ErrorActionPreference='Stop'
if(-not $OwnerApprovedIntegration){throw 'STOP: isolated integration approval required'}
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
if($repo -ine 'E:\Programming\Project\fly-with-safety'){throw 'STOP: exact workspace required'}
$manifestPath=Join-Path $PSScriptRoot 'pins.json'
if((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash -cne '65239CA26A2EF4B3F748253A7EACDC1A32249FFA327BA6FF3F0EAF5B10AD39EC'){throw 'STOP: integration manifest mismatch'}
$manifest=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json
foreach($pin in $manifest.files){
  $full=[IO.Path]::GetFullPath((Join-Path $repo $pin.path))
  if(-not $full.StartsWith($repo+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'STOP: pin outside workspace'}
  if((Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: source/runtime pin mismatch'}
}
if((Get-FileHash -LiteralPath $manifest.node.path -Algorithm SHA256).Hash -cne $manifest.node.sha256){throw 'STOP: Node pin mismatch'}
$out=Join-Path $repo 'output\phase5\p5-integration-20261107-02'
if(Test-Path -LiteralPath $out){throw 'STOP: previous integration directory; preserve, no retry'}
[void][IO.Directory]::CreateDirectory($out)
[IO.File]::WriteAllText((Join-Path $out 'caller-attempt.json'),'APPROVED_ISOLATED_INTEGRATION_PRIVATE_PROMPT')
$secure=Read-Host 'Existing fws_p5_identity_app password ONLY; not postgres/migrator/cloud' -AsSecureString
$address=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try{$private=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($address)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($address);$secure.Dispose()}
$process=$null;$job=$null
try{
  Add-Type -Path (Join-Path $repo 'server\test\p5-setup-v06\OwnedJob.cs')
  $job=New-Object FwsP5OwnedJobV06
  $psi=New-Object Diagnostics.ProcessStartInfo
  $psi.FileName=$manifest.node.path
  $psi.Arguments='"'+(Join-Path $PSScriptRoot 'run.cjs')+'" --owner-approved-integration'
  $psi.WorkingDirectory=$repo;$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true
  $psi.RedirectStandardInput=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
  $psi.EnvironmentVariables.Clear()
  foreach($name in @('SystemRoot','WINDIR','ProgramData','ProgramFiles','ProgramFiles(x86)','TEMP','TMP','PATH','PATHEXT','USERPROFILE','APPDATA','LOCALAPPDATA')){
    $value=[Environment]::GetEnvironmentVariable($name);if($value){$psi.EnvironmentVariables[$name]=$value}
  }
  $process=New-Object Diagnostics.Process;$process.StartInfo=$psi
  if(-not $process.Start()){throw 'STOP: integration child failed to start'}
  try{$job.Attach($process.Handle)}catch{if(-not $process.HasExited){$process.Kill()};throw 'STOP: containment failed; no private input sent'}
  $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
  $wire=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((@{password=$private}|ConvertTo-Json -Compress)))
  $process.StandardInput.WriteLine($wire);$process.StandardInput.Close();$private=$null;$wire=$null
  if(-not $process.WaitForExit(110000)){throw 'STOP: integration deadline; preserve evidence'}
  $null=$stderr.Result
  $summary=$stdout.Result|ConvertFrom-Json
  Write-Output ($summary|ConvertTo-Json -Depth 6 -Compress)
  if($process.ExitCode -ne 0 -or -not $summary.passed){throw 'STOP: scoped integration failed; no retry or cleanup'}
}finally{
  $private=$null;$wire=$null
  if($job){$job.Dispose()};if($process){$process.Dispose()}
}
