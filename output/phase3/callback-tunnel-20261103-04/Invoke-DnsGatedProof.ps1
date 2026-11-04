param([switch]$OwnerApprovedPairedHandoffDnsProof)
$ErrorActionPreference='Stop'
if(-not $OwnerApprovedPairedHandoffDnsProof){throw 'STOP: explicit paired maintenance/public proof/restoration approval required'}
$base=$PSScriptRoot
$manifest=Join-Path $base 'pins.json'
if((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne 'D9A4F795FBD099B34AB5CD87F316315EEA94458956391AE29CF19F55D41CC4A3'){throw 'STOP: manifest mismatch'}
foreach($pin in (Get-Content -LiteralPath $manifest -Raw|ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath (Join-Path $base $pin.path) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $pin.sha256){throw 'STOP: source/evidence integrity mismatch'}
}
$binary='C:\Users\sahab\Downloads\cloudflared-windows-amd64.exe'
if((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash -cne '2493DBC168923BB3E59E5E7716F71DECED92992EEA9ACD6E9D74F84AC7751343'){throw 'STOP: connector mismatch'}
$sig=Get-AuthenticodeSignature -LiteralPath $binary
if($sig.Status -ne 'Valid' -or $sig.SignerCertificate.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName,$false) -cne 'Cloudflare, Inc.'){throw 'STOP: valid connector signature required'}
foreach($name in @('handoff-attempt.json','handoff-result.json','attempt.json','result.json','normal-restore','journal.jsonl','dns-result.json','loopback-origin-result.json','connector-profile')){
 if(Test-Path -LiteralPath (Join-Path $base $name)){throw 'STOP: existing attempt; no retry'}
}
if(@(Get-ChildItem -LiteralPath $base -Filter '*.pending').Count){throw 'STOP: partial artifact exists; inspect, no retry'}
& (Join-Path $base 'ownership.ps1') -Phase BeforeHandoff
$start=New-Object System.Diagnostics.ProcessStartInfo
$start.FileName=(Get-Command node -CommandType Application).Source
$start.Arguments='"{0}" --owner-approved-paired-handoff-dns-proof "{1}"' -f (Join-Path $base 'handoff.cjs'),$binary
$start.WorkingDirectory=$base;$start.UseShellExecute=$false;$start.CreateNoWindow=$true
$start.EnvironmentVariables.Clear()
foreach($key in @('SystemRoot','WINDIR','ComSpec','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','Path','PATH','PATHEXT')){
 $value=[Environment]::GetEnvironmentVariable($key,'Process');if($null -ne $value){$start.EnvironmentVariables[$key]=$value}
}
$p=New-Object System.Diagnostics.Process;$p.StartInfo=$start
if(-not $p.Start()){throw 'STOP: handoff process failed to start'}
$deadline=[DateTime]::UtcNow.AddSeconds(360)
$file=Join-Path $base 'handoff-result.json'
while(-not(Test-Path -LiteralPath $file)){
 if($p.HasExited -or [DateTime]::UtcNow -ge $deadline){throw 'STOP: handoff outcome unconfirmed; inspect owned state, no retry/termination'}
 Start-Sleep -Milliseconds 500
}
$r=Get-Content -LiteralPath $file -Raw|ConvertFrom-Json
Write-Host ("Phase3 DNS-gated public proof exit: {0}; proof PASS: {1}; normal3000/5000 restored: {2}" -f $r.proofExit,$r.proofPassed,$r.normalRestored)
$proofFile=Join-Path $base 'result.json'
if(Test-Path -LiteralPath $proofFile){
 $proof=Get-Content -LiteralPath $proofFile -Raw|ConvertFrom-Json
 Write-Host ("Stage: {0}; failure: {1}; DNS ready: {2}; callback ready: {3}; PASS: {4}; FAIL: {5}; unexecuted: {6}; native codes: {7}" -f $proof.stage,$proof.failure,$proof.dnsReady,$proof.callbackReady,$proof.pass,$proof.fail,$proof.unexecuted,($proof.failureDetail.codes -join ','))
 if($proof.firstFailedCheck){$first=$proof.firstFailedCheck;Write-Host ("First mismatch HTTP: {0}; CF type: {1}; CF body code: {2}; origin reached: {3}; Host class: {4}" -f $first.observed,$first.response.cfErrorType,$first.response.cfBodyErrorCode,$first.origin.reached,$first.origin.hostClass)}
}
$dnsFile=Join-Path $base 'dns-result.json'
if(Test-Path -LiteralPath $dnsFile){$dns=Get-Content -LiteralPath $dnsFile -Raw|ConvertFrom-Json;Write-Host ("DNS observations: {0}; last code: {1}" -f $dns.observations.Count,($dns.observations|Select-Object -Last 1).code)}
Write-Host ('Owned normal-dev supervisor PID: '+$r.supervisorPID+' remains running when restored; this is intentional.')
if(-not $r.normalRestored -or -not $r.proofPassed){throw 'STOP: proof/restoration not fully PASS; preserve evidence, no retry/repair'}
