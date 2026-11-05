param([switch]$OwnerApprovedBrowserOnlyCapture)
$ErrorActionPreference='Stop'
if(-not $OwnerApprovedBrowserOnlyCapture){throw 'STOP: separate public approval required'}
$base=$PSScriptRoot
if((Get-FileHash -LiteralPath (Join-Path $base 'pins.json') -Algorithm SHA256).Hash -cne '184AF6B16AF22A4121C4BC8F61E123FE52FF3B400986C469E8E82E12EED44524'){throw 'STOP: manifest mismatch'}
foreach($p in (Get-Content -LiteralPath (Join-Path $base 'pins.json') -Raw|ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath (Join-Path $base $p.path) -Algorithm SHA256).Hash -cne $p.sha256){throw 'STOP: source integrity mismatch'}
}
if(Test-Path -LiteralPath (Join-Path $base 'attempt.json')){throw 'STOP: consumed; no retry'}
$binary='C:\Program Files\WindowsApps\ngrok.ngrok_3.39.11.0_x64__1g87z0zv29zzc\ngrok.exe'
if((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash -cne '6CCA51C969E13AD038A608B015000815135A3148CE4BB6A6F63C8AA536198E16'){throw 'STOP: agent mismatch'}
$config=Join-Path $env:LOCALAPPDATA 'FlyWithSafe\ngrok-rotated-config-20261104-01\ngrok-auth.yml'
if(-not(Test-Path -LiteralPath $config -PathType Leaf)){throw 'STOP: private config missing'}
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$acl=Get-Acl -LiteralPath $config
foreach($entry in $acl.Access){if($entry.AccessControlType -eq 'Allow' -and $entry.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin @($sid,'S-1-5-18')){throw 'STOP: private config ACL mismatch'}}
if(@(Get-Process ngrok,cloudflared -ErrorAction SilentlyContinue).Count){throw 'STOP: existing connector; do not terminate'}
$pw='C:\Users\sahab\AppData\Local\npm-cache\_npx\31e32ef8478fbf80\node_modules\playwright'
if(-not(Test-Path -LiteralPath (Join-Path $pw 'package.json'))){throw 'STOP: existing browser dependency missing; no install'}
& node (Join-Path $base 'capture.cjs') --owner-approved-browser-only $binary $config $pw
$code=$LASTEXITCODE
Write-Host "Browser-only capture exit: $code"
if($code -ne 0){throw 'STOP: preserve evidence; no retry or repair'}
