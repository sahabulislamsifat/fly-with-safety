param([switch]$OwnerApprovedAllocationCheck)
$ErrorActionPreference = 'Stop'
if (-not $OwnerApprovedAllocationCheck) { throw 'STOP: transport-only owner approval required' }
if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1) { throw 'STOP: Windows PowerShell 5.1 required' }
$base = $PSScriptRoot
$manifest = Join-Path $base 'transport-pins.json'
if ((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne 'CD89EF281DF036F236885E107BCB3177B91B9E2B08CB796540F6DB208C6D85AF') { throw 'STOP: transport manifest mismatch' }
foreach ($pin in (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json)) {
    $file = if ([IO.Path]::IsPathRooted($pin.path)) { $pin.path } else { Join-Path $base $pin.path }
    if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -cne $pin.sha256) { throw 'STOP: transport dependency or historical evidence mismatch' }
}
foreach ($name in @('transport-caller-attempt.json','transport-attempt.json','transport-caller-result.json','transport-result.json','transport-journal.jsonl','transport-ssh-process.json','transport-stop.request','allocation-observation.json')) {
    if (Test-Path -LiteralPath (Join-Path $base $name)) { throw 'STOP: transport scope already consumed; preserve evidence' }
}
$repo = [IO.Path]::GetFullPath((Join-Path $base '..\..\..'))
foreach ($version in @('01','02')) {
    $previous = Join-Path $repo ('output\phase3\failed-uat-20261105-' + $version)
    if (-not (Test-Path -LiteralPath (Join-Path $previous 'attempt.json') -PathType Leaf)) { throw 'STOP: prior attempt marker missing' }
    $result = Get-Content -LiteralPath (Join-Path $previous 'result.json') -Raw | ConvertFrom-Json
    if ($result.connectorStopped -ne $true) { throw 'STOP: prior connector shutdown unconfirmed' }
}
$previousTransport = Join-Path $repo 'output\phase3\failed-uat-transport-draft-20261106'
if (-not (Test-Path -LiteralPath (Join-Path $previousTransport 'transport-attempt.json') -PathType Leaf)) { throw 'STOP: previous transport attempt marker missing' }
$previousResult = Get-Content -LiteralPath (Join-Path $previousTransport 'transport-result.json') -Raw | ConvertFrom-Json
if ($previousResult.connectorStopped -ne $true) { throw 'STOP: previous transport connector shutdown unconfirmed' }
$timedOutTransport = Join-Path $repo 'output\phase3\failed-uat-transport-20261106-02'
if (-not (Test-Path -LiteralPath (Join-Path $timedOutTransport 'transport-attempt.json') -PathType Leaf)) { throw 'STOP: allocation timeout attempt marker missing' }
$timeoutResult = Get-Content -LiteralPath (Join-Path $timedOutTransport 'transport-result.json') -Raw | ConvertFrom-Json
if ($timeoutResult.firstFailure -cne 'SSH_ALLOCATION_TIMEOUT' -or $timeoutResult.connectorStopped -ne $true) { throw 'STOP: prior allocation timeout or shutdown unconfirmed' }
if (@(Get-Process ssh,ngrok,cloudflared -ErrorAction SilentlyContinue).Count) { throw 'STOP: existing connector or SSH process; inspect without terminating' }

$marker = [IO.File]::Open((Join-Path $base 'transport-caller-attempt.json'), [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
$marker.Dispose()
$start = New-Object Diagnostics.ProcessStartInfo
$start.FileName = 'C:\Program Files\nodejs\node.exe'
$start.Arguments = '"{0}" "{1}" --owner-approved-allocation-check' -f (Join-Path $repo 'server\node_modules\tsx\dist\cli.mjs'), (Join-Path $repo 'server\test\phase3-uat-allocation-check-run.ts')
$start.WorkingDirectory = $repo
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.RedirectStandardOutput = $true
$start.RedirectStandardError = $true
$start.EnvironmentVariables.Clear()
foreach ($key in @('SystemRoot','WINDIR','TEMP','TMP','ProgramData')) {
    $value = [Environment]::GetEnvironmentVariable($key, 'Process')
    if ($value) { $start.EnvironmentVariables[$key] = $value }
}
$start.EnvironmentVariables['FWS_ALLOCATION_CHECK_APPROVED'] = 'true'
$child = New-Object Diagnostics.Process
$child.StartInfo = $start
$started = $false
try {
    if (-not $child.Start()) { throw 'STOP: owned transport runner did not start' }
    $started = $true
    $stdout = $child.StandardOutput.ReadToEndAsync()
    $stderr = $child.StandardError.ReadToEndAsync()
    Write-Host 'TRANSPORT ONLY. No password prompt. Keep this console open for about 52 seconds.'
    if (-not $child.WaitForExit(52000)) { throw 'STOP: transport deadline exceeded; inspect owned shutdown evidence' }
    $result = @{ exit = $child.ExitCode; passed = ($child.ExitCode -eq 0); stderrPresent = ($stderr.Result.Length -gt 0) }
    [IO.File]::WriteAllText((Join-Path $base 'transport-caller-result.json'), ($result | ConvertTo-Json -Compress))
    Write-Host $stdout.Result
    if ($child.ExitCode -ne 0) { throw 'STOP: transport proof incomplete; preserve evidence; no retry' }
} finally {
    if ($started -and -not $child.HasExited) {
        $stopFile = Join-Path $base 'transport-stop.request'
        if (-not (Test-Path -LiteralPath $stopFile)) { [IO.File]::WriteAllText($stopFile, 'Owner-controlled transport stop') }
        if (-not $child.WaitForExit(7000)) { Write-Host "STOP: owned runner PID $($child.Id) remains; inspect shutdown evidence" }
    }
    $child.Dispose()
}
