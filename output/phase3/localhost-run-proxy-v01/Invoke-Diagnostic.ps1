param([switch]$OwnerApprovedProxyMetadataDiagnostic)
$ErrorActionPreference='Stop'
if(-not $OwnerApprovedProxyMetadataDiagnostic){throw 'STOP: separate public execution approval required'}
$base=$PSScriptRoot
if((Get-FileHash -LiteralPath (Join-Path $base 'pins.json') -Algorithm SHA256).Hash -cne '07079A4FA2F1B0C4CDD0E93BBE7A41A841978194B4AA666320EE28E94C483697'){throw 'STOP: manifest mismatch'}
foreach($p in (Get-Content -LiteralPath (Join-Path $base 'pins.json') -Raw|ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath (Join-Path $base $p.path) -Algorithm SHA256).Hash -cne $p.sha256){throw 'STOP: source pin mismatch'}
}
foreach($d in (Get-Content -LiteralPath (Join-Path $base 'runtime-pins.json') -Raw|ConvertFrom-Json)){
 if((Get-FileHash -LiteralPath $d.path -Algorithm SHA256).Hash -cne $d.sha256){throw 'STOP: installed runtime mismatch'}
}
foreach($n in @('attempt.json','result.json','known_hosts','trust.json','assigned-origin.json','browser.png','origin-guards.jsonl')){if(Test-Path -LiteralPath (Join-Path $base $n)){throw 'STOP: existing artifact; no retry or trust replacement'}}
$ssh=Join-Path $env:WINDIR 'System32\OpenSSH\ssh.exe'
$scan=Join-Path $env:WINDIR 'System32\OpenSSH\ssh-keyscan.exe'
$keygen=Join-Path $env:WINDIR 'System32\OpenSSH\ssh-keygen.exe'
$pw='C:\Users\sahab\AppData\Local\npm-cache\_npx\31e32ef8478fbf80\node_modules\playwright'
foreach($f in @($ssh,$scan,$keygen,(Join-Path $pw 'package.json'))){if(-not(Test-Path -LiteralPath $f -PathType Leaf)){throw 'STOP: installed dependency missing; no install'}}
if(@(Get-Process ngrok,cloudflared -ErrorAction SilentlyContinue).Count){throw 'STOP: another public connector exists; no termination'}
$node='C:\Program Files\nodejs\node.exe'
& $node (Join-Path $base 'run.cjs') --owner-approved-proxy-metadata-v01 $ssh $scan $keygen $pw
$code=$LASTEXITCODE
Write-Host "Proxy metadata diagnostic exit: $code"
if($code -ne 0){throw 'STOP: preserve evidence; no retry or repair'}
