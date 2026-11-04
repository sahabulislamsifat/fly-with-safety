param([switch]$OwnerApprovedOnePublicBoundaryEvidence)
$ErrorActionPreference='Stop'
if (-not $OwnerApprovedOnePublicBoundaryEvidence) { throw 'STOP: separate public transport approval required' }
$base=$PSScriptRoot
$binary='C:\Users\sahab\Downloads\cloudflared-windows-amd64.exe'
$expectedBinary='2493DBC168923BB3E59E5E7716F71DECED92992EEA9ACD6E9D74F84AC7751343'
if ((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash -cne $expectedBinary) { throw 'STOP: reviewed binary hash mismatch' }
$signature=Get-AuthenticodeSignature -LiteralPath $binary
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName,$false) -cne 'Cloudflare, Inc.') { throw 'STOP: verified Cloudflare signature required' }
$manifest=Join-Path $base 'pins.json'
if ((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne '3811CD59C3CC5AE9B74A7769D6F5FA04F1C022999B4210234748103B3409AE68') { throw 'STOP: reviewed dependency manifest mismatch' }
foreach ($pin in (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json)) {
    $file=Join-Path $base $pin.path
    if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $pin.sha256) { throw 'STOP: dependency integrity mismatch' }
}
foreach ($name in @('attempt.json','result.json','checks.json','origin.json','caller-result.json','connector-profile','journal.jsonl')) {
    if (Test-Path -LiteralPath (Join-Path $base $name)) { throw 'STOP: existing attempt or artifact; no retry' }
}
if (@([System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object Port -eq 5000).Count -ne 0) { throw 'STOP: backend5000 occupied; do not interrupt existing services' }
$node=(Get-Command node -CommandType Application -ErrorAction Stop).Source
$start=New-Object System.Diagnostics.ProcessStartInfo
$start.FileName=$node
$start.Arguments='"{0}" --owner-approved-public-boundary-evidence "{1}"' -f (Join-Path $base 'run.cjs'),$binary
$start.WorkingDirectory=$base
$start.UseShellExecute=$false
$start.CreateNoWindow=$true
$start.EnvironmentVariables.Clear()
foreach ($key in @('SystemRoot','WINDIR','ComSpec','TEMP','TMP')) {
    $value=[Environment]::GetEnvironmentVariable($key,'Process')
    if ($null -ne $value) { $start.EnvironmentVariables[$key]=$value }
}
Write-Host 'PUBLIC TRANSPORT PROOF ONLY. No passwords, application, database or SSLCommerz calls. Owned tunnel stops after proof/failure.'
$process=New-Object System.Diagnostics.Process
$process.StartInfo=$start
if (-not $process.Start()) { throw 'STOP: proof process failed to start; inspect artifacts, no retry' }
if (-not $process.WaitForExit(200000)) { throw 'STOP: foreground child did not finish; preserve state and inspect result.json/PID, do not retry or terminate unrelated processes' }
$code=$process.ExitCode
$actual=$null
$resultPath=Join-Path $base 'result.json'
if (Test-Path -LiteralPath $resultPath) { $actual=Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json }
$passed=$code -eq 0 -and $actual.passed -eq $true -and $actual.pass -eq 31 -and $actual.fail -eq 0 -and $actual.unexecuted -eq 0 -and $actual.attempted -eq 31 -and $actual.completedHttp -eq 31 -and $actual.tunnelStopped -eq $true -and $actual.listenerStopped -eq $true -and $actual.databaseAccess -eq $false -and $actual.merchantCalls -eq 0 -and $actual.credentialsRead -eq $false
@{exit=$code;passed=[bool]$passed;databaseAccess=$false;merchantCalls=0}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $base 'caller-result.json') -Encoding UTF8
Write-Host "Phase3 callback transport proof exit: $code; passed: $passed"
if ($actual) { Write-Host ("Stage: {0}; failure: {1}; classification: {2}; codes: {3}; attempted: {4}; completed HTTP: {5}; PASS: {6}; FAIL: {7}; untouched: {8}; tunnel stopped: {9}" -f $actual.stage,$actual.failure,$actual.failureDetail.classification,($actual.failureDetail.codes -join ','),$actual.attempted,$actual.completedHttp,$actual.pass,$actual.fail,$actual.unexecuted,$actual.tunnelStopped) }
if ($actual.firstFailedCheck) { $first=$actual.firstFailedCheck; Write-Host ("First probe: {0}; expected: {1}; HTTP: {2}; media: {3}; CF type: {4}; CF body code: {5}; origin reached: {6}; origin Host class: {7}; origin status: {8}" -f $first.index,$first.expected,$first.observed,$first.response.media,$first.response.cfErrorType,$first.response.cfBodyErrorCode,$first.origin.reached,$first.origin.hostClass,$first.origin.status) }
if (-not $passed) { throw 'STOP: public transport proof incomplete; preserve evidence, no retry/repair' }
