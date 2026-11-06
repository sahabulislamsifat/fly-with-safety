param([switch]$OwnerApprovedNegativePostgres)
$ErrorActionPreference = 'Stop'
if (-not $OwnerApprovedNegativePostgres) { throw 'STOP: separate local negative PostgreSQL approval required' }
$base = $PSScriptRoot
$manifest = Join-Path $base 'pins.json'
if ((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne 'BDBBD54268D852E88BEACD623A5D1E662A8A64A8690FC8606AAA212F6CCE528A') { throw 'STOP: negative PostgreSQL manifest mismatch' }
foreach ($pin in (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json)) {
    $file = if ([IO.Path]::IsPathRooted($pin.path)) { $pin.path } else { Join-Path $base $pin.path }
    if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -cne $pin.sha256) { throw 'STOP: negative PostgreSQL source/runtime mismatch' }
}
foreach ($name in @('caller-attempt.json', 'attempt.json', 'result.json', 'caller-result.json', 'journal.jsonl')) {
    if (Test-Path -LiteralPath (Join-Path $base $name)) { throw 'STOP: consumed negative PostgreSQL proof' }
}
$marker = [IO.File]::Open((Join-Path $base 'caller-attempt.json'), [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
$marker.Dispose()
$repo = [IO.Path]::GetFullPath((Join-Path $base '..\..\..'))
$secure = Read-Host 'Existing restricted local DB password' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $url = 'postgresql://flywithsafe_phase2_booking_test:' + [Uri]::EscapeDataString([Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)) + '@127.0.0.1:5432/flywithsafety_local_integration'
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = 'C:\Program Files\nodejs\node.exe'
    $start.Arguments = '"{0}" "{1}" --owner-approved-negative-postgres-v01' -f (Join-Path $repo 'server\node_modules\tsx\dist\cli.mjs'), (Join-Path $repo 'server\test\phase3-negative-pg\main.ts')
    $start.WorkingDirectory = $repo
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.EnvironmentVariables.Clear()
    foreach ($key in @('SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'ProgramData')) {
        $value = [Environment]::GetEnvironmentVariable($key, 'Process')
        if ($value) { $start.EnvironmentVariables[$key] = $value }
    }
    $start.EnvironmentVariables['DATABASE_URL'] = $url
    $start.EnvironmentVariables['DIRECT_URL'] = $url
    $start.EnvironmentVariables['PHASE3_NEGATIVE_POSTGRES_APPROVED'] = 'true'
    $url = $null
    $child = New-Object Diagnostics.Process
    $child.StartInfo = $start
    if (-not $child.Start()) { throw 'STOP: negative PostgreSQL child did not start' }
    $start.EnvironmentVariables.Remove('DATABASE_URL')
    $start.EnvironmentVariables.Remove('DIRECT_URL')
    $stdout = $child.StandardOutput.ReadToEndAsync()
    $stderr = $child.StandardError.ReadToEndAsync()
    if (-not $child.WaitForExit(95000)) {
        if (-not $child.HasExited) { $child.Kill() }
        $stopped = $child.WaitForExit(5000)
        @{ passed = $false; reason = 'DEADLINE'; childStopped = $stopped; preservation = $null } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $base 'caller-result.json') -Encoding UTF8
        throw 'STOP: negative PostgreSQL deadline; preserve evidence'
    }
    $passed = $false
    if (Test-Path -LiteralPath (Join-Path $base 'result.json')) {
        $result = Get-Content -LiteralPath (Join-Path $base 'result.json') -Raw | ConvertFrom-Json
        $passed = $child.ExitCode -eq 0 -and $result.passed -and $result.preservation -and $result.realPostgres -and $result.provider -ceq 'MOCK_ONLY' -and $result.providerNetworkCalls -eq 0 -and $result.publicConnections -eq 0
        $result | ConvertTo-Json -Depth 5 | Write-Host
    }
    @{ exit = $child.ExitCode; passed = $passed; stderrPresent = [bool]$stderr.Result; provider = 'MOCK_ONLY'; providerNetworkCalls = 0; publicConnections = 0 } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $base 'caller-result.json') -Encoding UTF8
    Write-Host "Phase3 negative PostgreSQL exit: $($child.ExitCode); passed: $passed"
    if (-not $passed) { throw 'STOP: negative PostgreSQL proof incomplete; preserve evidence' }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $secure.Dispose()
}
