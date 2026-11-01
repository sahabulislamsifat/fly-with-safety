param([switch]$UseApprovedIsolatedLocalhost)
$ErrorActionPreference='Stop'
if(-not $UseApprovedIsolatedLocalhost){throw 'STOP: explicit isolated localhost scope required'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: private PS5.1 console required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: no policy bypass'}
$root=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$helper=Join-Path $PSScriptRoot 'browser-auth-parity-20261101-01/Set-PrivatePhase2Connection.ps1'
if((Get-FileHash -LiteralPath $helper -Algorithm SHA256).Hash -cne 'B2EC09C829E5F6ECEA7E7B19459554F4BD292F245DC709DE07B32D4B2D715AC0'){throw 'STOP: helper changed'}
if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'localhost-api.ts') -Algorithm SHA256).Hash -cne '0FB71C3B55F49FCF12905E7B188CA5810AECC41DFF2443470EC640BDD41C618A'){throw 'STOP: runtime changed'}
if(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'localhost-runtime-20261102-01/attempt.json')){throw 'Existing local runtime attempt; no retry'}
$probe=New-Object Net.Sockets.TcpClient
try{$probe.Connect('localhost',5000);throw 'STOP: stop ONLY the identified FlyWithSafe backend in its original terminal first'}catch{if($probe.Connected){throw}}finally{$probe.Dispose()}
. $helper
$secret=Read-Host 'NEW synchronized flywithsafe_phase2_booking_test password privately; no account/postgres password' -AsSecureString
try {
 Set-PrivatePhase2Connection -Secret $secret
 Remove-Item -LiteralPath Env:PGPASSWORD -ErrorAction SilentlyContinue
 Push-Location $root
 try{& 'C:\Program Files\nodejs\node.exe' (Join-Path $root 'server/node_modules/tsx/dist/cli.mjs') (Join-Path $PSScriptRoot 'localhost-api.ts');$code=$LASTEXITCODE;Write-Host ('Phase2 localhost runtime exit: '+$code)}finally{Pop-Location}
} finally {
 foreach($name in @('PGPASSWORD','PGSSLMODE','PHASE2_BOOKING_DATABASE_URL')){Remove-Item -LiteralPath ('Env:'+$name) -ErrorAction SilentlyContinue}
 $secret.Dispose()
}
