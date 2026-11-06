param([switch]$OwnerApprovedRetainedQuery)
$ErrorActionPreference='Stop'
if(-not $OwnerApprovedRetainedQuery){throw 'STOP: separate one-query local/provider read-only approval required'}
$base=$PSScriptRoot
if((Get-FileHash -LiteralPath (Join-Path $base 'pins.json') -Algorithm SHA256).Hash -cne '966994F62F04AAED36D7552474CA3EAC11B902448FB783395912943EEF7AA8D6'){throw 'STOP: reviewed manifest mismatch'}
foreach($pin in (Get-Content -LiteralPath (Join-Path $base 'pins.json') -Raw|ConvertFrom-Json)){
 $filename=if([IO.Path]::IsPathRooted($pin.path)){$pin.path}else{Join-Path $base $pin.path}
 if((Get-FileHash -LiteralPath $filename -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: reviewed source/runtime mismatch'}
}
foreach($name in @('caller-attempt.json','attempt.json','result.json','caller-result.json')){if(Test-Path -LiteralPath (Join-Path $base $name)){throw 'STOP: consumed/partial read-only attempt; no retry'}}
$marker=[IO.File]::Open((Join-Path $base 'caller-attempt.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$marker.Dispose()
$repo=[IO.Path]::GetFullPath((Join-Path $base '..\..\..'))
$secure=Read-Host 'EXISTING local flywithsafe_phase2_booking_test password only; NOT postgres/cloud/provider password' -AsSecureString
$bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try{
 $privateText=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
 $url='postgresql://flywithsafe_phase2_booking_test:'+ [Uri]::EscapeDataString($privateText)+'@127.0.0.1:5432/flywithsafety_local_integration';$privateText=$null
 $start=New-Object Diagnostics.ProcessStartInfo
 $start.FileName='C:\Program Files\nodejs\node.exe'
 $start.Arguments='"{0}" "{1}" --owner-approved-status-readback-v01' -f (Join-Path $repo 'server\node_modules\tsx\dist\cli.mjs'),(Join-Path $repo 'server\test\phase3-status-readback\main.ts')
 $start.WorkingDirectory=$repo;$start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
 $start.EnvironmentVariables.Clear()
 foreach($key in @('SystemRoot','WINDIR','TEMP','TMP','ProgramData')){$value=[Environment]::GetEnvironmentVariable($key,'Process');if($value){$start.EnvironmentVariables[$key]=$value}}
 $start.EnvironmentVariables['DATABASE_URL']=$url;$start.EnvironmentVariables['DIRECT_URL']=$url;$start.EnvironmentVariables['PHASE3_RETAINED_QUERY_APPROVED']='true';$url=$null
 $child=New-Object Diagnostics.Process;$child.StartInfo=$start
 if(-not $child.Start()){throw 'STOP: read-only child did not start'}
 $start.EnvironmentVariables.Remove('DATABASE_URL');$start.EnvironmentVariables.Remove('DIRECT_URL')
 $stdout=$child.StandardOutput.ReadToEndAsync();$stderr=$child.StandardError.ReadToEndAsync()
 if(-not $child.WaitForExit(110000)){Write-Host "STOP: owned read-only child PID $($child.Id) outcome pending; preserve state, no retry";throw 'STOP: read-only deadline; no payment or repair'}
 $child.WaitForExit()
 if($stdout.Result){Write-Host $stdout.Result}
 $nativeDiagnostic=if($stderr.Result){'SANITIZED_NATIVE_STDERR_PRESENT'}else{$null}
 $passed=$false
 if(Test-Path -LiteralPath (Join-Path $base 'result.json')){$result=Get-Content -LiteralPath (Join-Path $base 'result.json') -Raw|ConvertFrom-Json;$passed=($child.ExitCode -eq 0 -and $result.passed -and $result.controlledRollbacks -eq 2 -and $result.preservation)}
 @{exit=$child.ExitCode;passed=$passed;stderrClassification=$nativeDiagnostic;readOnly=$true;financialWrites=0;providerQueryCap=1;publicConnections=0}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $base 'caller-result.json') -Encoding UTF8
 Write-Host "Phase3 retained transaction query exit: $($child.ExitCode); passed: $passed"
 if(-not $passed){throw 'STOP: read-only result inconclusive; preserve artifacts, no retry or repair'}
}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr);$secure=$null}



