param([switch]$OwnerApprovedFailedUatCloudflareV03)
$ErrorActionPreference='Stop'
if(-not $OwnerApprovedFailedUatCloudflareV03){throw 'STOP: separate genuine sandbox provider/write execution approval required'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1){throw 'STOP: Windows PowerShell 5.1 required'}
$base=$PSScriptRoot
if((Get-FileHash -LiteralPath (Join-Path $base 'pins.json') -Algorithm SHA256).Hash -cne '54FADAF6032DD6D46D4E20C23FFC8183D0DAF5965A677A463D689D6B2C5EB10B'){throw 'STOP: source manifest mismatch'}
foreach($p in (Get-Content -LiteralPath (Join-Path $base 'pins.json') -Raw|ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath (Join-Path $base $p.path) -Algorithm SHA256).Hash -cne $p.sha256){throw 'STOP: source dependency mismatch'}
}
foreach($p in (Get-Content -LiteralPath (Join-Path $base 'runtime-pins.json') -Raw|ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath $p.path -Algorithm SHA256).Hash -cne $p.sha256){throw 'STOP: installed runtime mismatch'}
}
foreach($n in @('attempt.json','result.json','ledger.jsonl','assigned-origin.json','readonly-preflight.json','retained-preflight.json','retained-postcheck.json','caller-attempt.json','caller-result.json','return-fail.png','preservation-ready.json','transport-preflight.json','owned-final.json','connector-process.json','connector-profile','stop.request')){
 if(Test-Path -LiteralPath (Join-Path $base $n)){throw 'STOP: consumed/partial execution artifacts; no retry'}
}
if(@(Get-Process ngrok,cloudflared,ssh -ErrorAction SilentlyContinue).Count){throw 'STOP: existing connector/SSH process; no termination'}
$repo=[IO.Path]::GetFullPath((Join-Path $base '..\..\..'))
$node='C:\Program Files\nodejs\node.exe'
$cli=Join-Path $repo 'server\node_modules\tsx\dist\cli.mjs'
$entry=Join-Path $repo 'server\test\phase3-failed-uat-v03\final-failed-run.ts'
$binary=Join-Path $env:USERPROFILE 'Downloads\cloudflared-windows-amd64.exe'
if((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash -cne '2493DBC168923BB3E59E5E7716F71DECED92992EEA9ACD6E9D74F84AC7751343'){throw 'STOP: reviewed cloudflared binary mismatch'}
$attempt=[IO.File]::Open((Join-Path $base 'caller-attempt.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
$attempt.Dispose()
$secure=Read-Host 'EXISTING local flywithsafe_phase2_booking_test password privately; NOT postgres/cloud/SSLCommerz password' -AsSecureString
$bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$child=$null
try{
 $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
 $url='postgresql://flywithsafe_phase2_booking_test:'+ [Uri]::EscapeDataString($plain)+'@127.0.0.1:5432/flywithsafety_local_integration'
 $plain=$null
 $start=New-Object Diagnostics.ProcessStartInfo
 $start.FileName=$node
 $start.Arguments='"{0}" "{1}" --owner-approved-failed-uat-cloudflare-v03 "{2}"' -f $cli,$entry,$binary
 $start.WorkingDirectory=$repo
 $start.UseShellExecute=$false
 $start.CreateNoWindow=$true
 $start.RedirectStandardOutput=$true
 $start.RedirectStandardError=$true
 $start.EnvironmentVariables.Clear()
 foreach($k in @('SystemRoot','WINDIR','TEMP','TMP','ProgramData','LOCALAPPDATA','APPDATA','USERPROFILE','ProgramFiles','ProgramFiles(x86)','PATH')){
  $value=[Environment]::GetEnvironmentVariable($k,'Process');if($value){$start.EnvironmentVariables[$k]=$value}
 }
 $start.EnvironmentVariables['DATABASE_URL']=$url
 $start.EnvironmentVariables['DIRECT_URL']=$url
 $start.EnvironmentVariables['PHASE3_FAILED_UAT_CLOUDFLARE_V03_APPROVED']='true'
 $url=$null
 $child=New-Object Diagnostics.Process
 $child.StartInfo=$start
 if(-not $child.Start()){throw 'STOP: owned genuine runner did not start'}
 $start.EnvironmentVariables.Remove('DATABASE_URL');$start.EnvironmentVariables.Remove('DIRECT_URL')
 Write-Host 'Isolated Cloudflare Quick Tunnel FAILED sandbox runner started. Confirm FAILED ONLY on the private page before Checkout opens; choose Mobile Banking and a sandbox channel, then press Dummy OTP Failed once. Do not cancel. Never repeat SUCCESS or enter real card/customer data.'
 Write-Host 'To stop safely, create stop.request in the reviewed execution folder from a separate console; do not rerun this caller.'
 $stdout=$child.StandardOutput.ReadLineAsync();$stderr=$child.StandardError.ReadLineAsync()
 $clock=[Diagnostics.Stopwatch]::StartNew();$stderrPresent=$false
 while(-not $child.HasExited -or -not $stdout.IsCompleted -or -not $stderr.IsCompleted){
  if($clock.Elapsed.TotalSeconds -ge 2100){throw 'STOP: runner deadline exceeded; request owned shutdown and inspect evidence'}
  if($stdout.IsCompleted){$line=$stdout.Result;if($null -ne $line){Write-Host $line;$stdout=$child.StandardOutput.ReadLineAsync()}}
  if($stderr.IsCompleted){$line=$stderr.Result;if($null -ne $line){$stderrPresent=$true;$stderr=$child.StandardError.ReadLineAsync()}}
  Start-Sleep -Milliseconds 100
 }
 $child.WaitForExit()
 if($stdout.IsCompleted -and $stdout.Result){Write-Host $stdout.Result}
 if($stderr.IsCompleted -and $stderr.Result){$stderrPresent=$true}
 [IO.File]::WriteAllText((Join-Path $base 'caller-result.json'),(@{exit=$child.ExitCode;passed=($child.ExitCode -eq 0);stderrPresent=$stderrPresent}|ConvertTo-Json -Compress))
 Write-Host "Genuine SSLCommerz sandbox execution exit: $($child.ExitCode)"
 if($child.ExitCode -ne 0){throw 'STOP: genuine proof incomplete; preserve evidence, no retry or cleanup'}
}finally{
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr);$secure=$null
 if($child -and -not $child.HasExited){
  $stop=Join-Path $base 'stop.request'
  if(-not(Test-Path -LiteralPath $stop)){[IO.File]::WriteAllText($stop,'Owner-controlled caller interruption; stop owned run safely')}
  if(-not $child.WaitForExit(65000)){Write-Host "STOP: owned runner PID $($child.Id) still active; inspect saved process evidence, no retry or unrelated termination"}
 }
}


