param([switch]$OwnerApprovedNgrokIsolationProof)
$ErrorActionPreference='Stop'
if(-not $OwnerApprovedNgrokIsolationProof){throw 'STOP: separate backend-only maintenance/public proof/restoration approval required'}
$base=$PSScriptRoot;$manifest=Join-Path $base 'pins.json'
if((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne '0DC6CBA4C1FF712990015E410E75E3A1AA5EF425C6585D6568F21D0FAD9865EB'){throw 'STOP: manifest mismatch'}
foreach($pin in (Get-Content -LiteralPath $manifest -Raw|ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath (Join-Path $base $pin.path) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $pin.sha256){throw 'STOP: code/evidence integrity mismatch'}
}
$pkg=Get-AppxPackage -Name ngrok.ngrok
if(-not $pkg -or $pkg.Version -ne '3.39.11.0' -or $pkg.SignatureKind -ne 'Store' -or $pkg.Status -ne 'Ok'){throw 'STOP: reviewed Store package changed'}
$binary=Join-Path $pkg.InstallLocation 'ngrok.exe'
if((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash -cne '6CCA51C969E13AD038A608B015000815135A3148CE4BB6A6F63C8AA536198E16'){throw 'STOP: reviewed ngrok executable mismatch'}
$auth=Join-Path $env:LOCALAPPDATA 'FlyWithSafe\ngrok-sandbox-20261103-01\ngrok-auth.yml'
if(-not(Test-Path -LiteralPath $auth -PathType Leaf)){throw 'STOP: private authentication config missing'}
$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
foreach($entry in (Get-Acl -LiteralPath $auth).Access){
 if($entry.AccessControlType -ne 'Allow' -or $entry.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -notin @($sid,'S-1-5-18')){throw 'STOP: private authentication ACL mismatch'}
}
$ErrorActionPreference='Continue'
try{$native=& $binary config check --config $auth --config (Join-Path $base 'agent-safety.yml') 2>&1; $checkExit=$LASTEXITCODE}finally{$ErrorActionPreference='Stop';$native=$null}
if($checkExit -ne 0){throw 'STOP: merged private/safety config invalid; no tunnel'}
foreach($n in @('handoff-attempt.json','handoff-result.json','attempt.json','result.json','normal-restore','connector-profile','journal.jsonl','dns-result.json','loopback-origin-result.json','binding-result.json','workflow-error.json','preflight-health.json')){
 if(Test-Path -LiteralPath (Join-Path $base $n)){throw 'STOP: existing attempt; no retry'}
}
if(@(Get-ChildItem -LiteralPath $base -Filter '*.pending').Count){throw 'STOP: partial artifact; no retry'}
& (Join-Path $base 'ownership.ps1') -BeforeHandoff
$start=New-Object System.Diagnostics.ProcessStartInfo
$start.FileName=(Get-Command node -CommandType Application).Source
$start.Arguments='"{0}" --owner-approved-backend-only-dns-proof "{1}" "{2}"' -f (Join-Path $base 'handoff.cjs'),$binary,$auth
$start.WorkingDirectory=$base;$start.UseShellExecute=$false;$start.CreateNoWindow=$true
$start.EnvironmentVariables.Clear()
foreach($key in @('SystemRoot','WINDIR','ComSpec','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','Path','PATH','PATHEXT')){
 $value=[Environment]::GetEnvironmentVariable($key,'Process');if($null -ne $value){$start.EnvironmentVariables[$key]=$value}
}
$p=New-Object System.Diagnostics.Process;$p.StartInfo=$start
if(-not $p.Start()){throw 'STOP: controlled backend handoff could not start'}
$deadline=[DateTime]::UtcNow.AddSeconds(360);$file=Join-Path $base 'handoff-result.json'
while(-not(Test-Path -LiteralPath $file)){
 if($p.HasExited -or [DateTime]::UtcNow -ge $deadline){$errorFile=Join-Path $base 'workflow-error.json';if(Test-Path -LiteralPath $errorFile){$safe=Get-Content -LiteralPath $errorFile -Raw|ConvertFrom-Json;Write-Host ("Failure: {0}; code: {1}; maintenance started: {2}" -f $safe.failure,$safe.code,$safe.maintenanceStarted)};throw 'STOP: outcome unconfirmed; preserve state, no retry/termination'}
 Start-Sleep -Milliseconds 500
}
$r=Get-Content -LiteralPath $file -Raw|ConvertFrom-Json
Write-Host ("Ngrok isolation proof exit: {0}; proof PASS: {1}; backend5000 restored: {2}; frontend3000 preserved: {3}" -f $r.proofExitText,$r.proofPassed,$r.backendRestored,$r.frontendPreserved)
if($r.backendRestored){Write-Host ('Owned normal-backend supervisor: '+$r.supervisorPID+'; backend intentionally left running.')}
$proofFile=Join-Path $base 'result.json'
if(Test-Path -LiteralPath $proofFile){$proof=Get-Content -LiteralPath $proofFile -Raw|ConvertFrom-Json;Write-Host ("Stage: {0}; failure: {1}; DNS ready: {2}; callback ready: {3}; PASS: {4}; FAIL: {5}; unexecuted: {6}; native codes: {7}" -f $proof.stage,$proof.failure,$proof.dnsReady,$proof.callbackReady,$proof.pass,$proof.fail,$proof.unexecuted,($proof.failureDetail.codes -join ','));if($proof.firstFailedCheck){$f=$proof.firstFailedCheck;Write-Host ("HTTP: {0}; CF type: {1}; CF code: {2}; origin reached: {3}; Host: {4}" -f $f.observed,$f.response.cfErrorType,$f.response.cfBodyErrorCode,$f.origin.reached,$f.origin.hostClass)}}
$dnsFile=Join-Path $base 'dns-result.json'
if(Test-Path -LiteralPath $dnsFile){$dns=Get-Content -LiteralPath $dnsFile -Raw|ConvertFrom-Json;Write-Host ("DNS observations: {0}; last code: {1}" -f $dns.observations.Count,($dns.observations|Select-Object -Last 1).code)}


$bindingFile=Join-Path $base 'binding-result.json'
if(Test-Path -LiteralPath $bindingFile){$binding=Get-Content -LiteralPath $bindingFile -Raw|ConvertFrom-Json;Write-Host ('Authenticated exact-domain binding accepted: '+$binding.bindingAccepted+'; policy runtime accepted: '+$binding.policyRuntimeAccepted)}

if(-not $r.backendRestored -or -not $r.frontendPreserved -or -not $r.proofPassed){throw 'STOP: workflow not fully PASS; preserve artifacts, no retry/repair'}
