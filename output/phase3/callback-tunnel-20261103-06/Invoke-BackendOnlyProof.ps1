param([switch]$OwnerApprovedBackendOnlyDnsProof)
$ErrorActionPreference='Stop'
if(-not $OwnerApprovedBackendOnlyDnsProof){throw 'STOP: separate backend-only maintenance/public proof/restoration approval required'}
$base=$PSScriptRoot;$manifest=Join-Path $base 'pins.json'
if((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne 'FD41DC21D0CA133C909C9EAF260B321669B6DD0DFFC69CAC87C4228A14C6AEEA'){throw 'STOP: manifest mismatch'}
foreach($pin in (Get-Content -LiteralPath $manifest -Raw|ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath (Join-Path $base $pin.path) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $pin.sha256){throw 'STOP: code/evidence integrity mismatch'}
}
$binary='C:\Users\sahab\Downloads\cloudflared-windows-amd64.exe'
if((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash -cne '2493DBC168923BB3E59E5E7716F71DECED92992EEA9ACD6E9D74F84AC7751343'){throw 'STOP: connector mismatch'}
$sig=Get-AuthenticodeSignature -LiteralPath $binary
if($sig.Status -ne 'Valid' -or $sig.SignerCertificate.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName,$false) -cne 'Cloudflare, Inc.'){throw 'STOP: valid connector signature required'}
foreach($n in @('handoff-attempt.json','handoff-result.json','attempt.json','result.json','normal-restore','connector-profile','journal.jsonl','dns-result.json','loopback-origin-result.json','workflow-error.json','preflight-health.json')){
 if(Test-Path -LiteralPath (Join-Path $base $n)){throw 'STOP: existing attempt; no retry'}
}
if(@(Get-ChildItem -LiteralPath $base -Filter '*.pending').Count){throw 'STOP: partial artifact; no retry'}
& (Join-Path $base 'ownership.ps1') -BeforeHandoff
$start=New-Object System.Diagnostics.ProcessStartInfo
$start.FileName=(Get-Command node -CommandType Application).Source
$start.Arguments='"{0}" --owner-approved-backend-only-dns-proof "{1}"' -f (Join-Path $base 'handoff.cjs'),$binary
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
Write-Host ("Backend-only proof exit: {0}; proof PASS: {1}; backend5000 restored: {2}; frontend3000 preserved: {3}" -f $r.proofExitText,$r.proofPassed,$r.backendRestored,$r.frontendPreserved)
if($r.backendRestored){Write-Host ('Owned normal-backend supervisor: '+$r.supervisorPID+'; backend intentionally left running.')}
$proofFile=Join-Path $base 'result.json'
if(Test-Path -LiteralPath $proofFile){$proof=Get-Content -LiteralPath $proofFile -Raw|ConvertFrom-Json;Write-Host ("Stage: {0}; failure: {1}; DNS ready: {2}; callback ready: {3}; PASS: {4}; FAIL: {5}; unexecuted: {6}; native codes: {7}" -f $proof.stage,$proof.failure,$proof.dnsReady,$proof.callbackReady,$proof.pass,$proof.fail,$proof.unexecuted,($proof.failureDetail.codes -join ','));if($proof.firstFailedCheck){$f=$proof.firstFailedCheck;Write-Host ("HTTP: {0}; CF type: {1}; CF code: {2}; origin reached: {3}; Host: {4}" -f $f.observed,$f.response.cfErrorType,$f.response.cfBodyErrorCode,$f.origin.reached,$f.origin.hostClass)}}
$dnsFile=Join-Path $base 'dns-result.json'
if(Test-Path -LiteralPath $dnsFile){$dns=Get-Content -LiteralPath $dnsFile -Raw|ConvertFrom-Json;Write-Host ("DNS observations: {0}; last code: {1}" -f $dns.observations.Count,($dns.observations|Select-Object -Last 1).code)}
if(-not $r.backendRestored -or -not $r.frontendPreserved -or -not $r.proofPassed){throw 'STOP: workflow not fully PASS; preserve artifacts, no retry/repair'}
