param([switch]$OwnerApprovedCheckoutInspection)
$ErrorActionPreference = 'Stop'
if (-not $OwnerApprovedCheckoutInspection) { throw 'STOP: separate one-session inspection approval required' }
$base = $PSScriptRoot
$manifest = Join-Path $base 'pins.json'
if ((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne '908519EFA3C25AB64D1E76E6AF9488716C3BCB7B8A7817091244ABBBF54B1649') { throw 'STOP: inspection manifest mismatch' }
foreach ($pin in (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json)) {
    $file = if ([IO.Path]::IsPathRooted($pin.path)) { $pin.path } else { Join-Path $base $pin.path }
    if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -cne $pin.sha256) { throw 'STOP: inspection source/runtime mismatch' }
}
foreach ($name in @('caller-attempt.json', 'attempt.json', 'result.json', 'caller-result.json')) {
    if (Test-Path -LiteralPath (Join-Path $base $name)) { throw 'STOP: consumed inspection' }
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
    $start.Arguments = '"{0}" "{1}" --owner-approved-checkout-inspection-v01' -f (Join-Path $repo 'server\node_modules\tsx\dist\cli.mjs'), (Join-Path $repo 'server\test\phase3-checkout-inspection\main.ts')
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
    $start.EnvironmentVariables['PHASE3_CHECKOUT_INSPECTION_APPROVED'] = 'true'
    $url = $null
    $child = New-Object Diagnostics.Process
    $child.StartInfo = $start
    if (-not $child.Start()) { throw 'STOP: inspection child did not start' }
    $start.EnvironmentVariables.Remove('DATABASE_URL')
    $start.EnvironmentVariables.Remove('DIRECT_URL')
    $stdout = $child.StandardOutput.ReadToEndAsync()
    $stderr = $child.StandardError.ReadToEndAsync()
    if (-not $child.WaitForExit(110000)) {
        if (-not $child.HasExited) { $child.Kill() }
        $stopped = $child.WaitForExit(5000)
        @{ passed = $false; reason = 'DEADLINE'; childStopped = $stopped; preservation = $null } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $base 'caller-result.json') -Encoding UTF8
        throw 'STOP: inspection deadline; preserve evidence'
    }
    $passed = $false
    if (Test-Path -LiteralPath (Join-Path $base 'result.json')) {
        $result = Get-Content -LiteralPath (Join-Path $base 'result.json') -Raw | ConvertFrom-Json
        $passed = $child.ExitCode -eq 0 -and $result.passed -and $result.preservation -and $result.providerRequests -eq 2 -and $result.databaseWrites -eq 0 -and $result.publicExposure -eq 0
        $result | ConvertTo-Json -Depth 5 | Write-Host
    }
    @{ exit = $child.ExitCode; passed = $passed; stderrPresent = [bool]$stderr.Result; providerCap = 2; publicExposure = 0 } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $base 'caller-result.json') -Encoding UTF8
    Write-Host "Phase3 checkout inspection exit: $($child.ExitCode); passed: $passed"
    if (-not $passed) { throw 'STOP: inspection incomplete; preserve evidence' }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $secure.Dispose()
}
