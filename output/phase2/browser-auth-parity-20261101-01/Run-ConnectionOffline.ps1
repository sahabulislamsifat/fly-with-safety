param([ValidateSet('bundle','native')][string]$Loader)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Set-PrivatePhase2Connection.ps1')
$root=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$secret=ConvertTo-SecureString -String (' synthetic:@/%40%+# '+[char]0x03A9+' ') -AsPlainText -Force
try {
 Set-PrivatePhase2Connection -Secret $secret
 $env:PHASE2_PRIVATE_OFFLINE_TEST='synthetic-only'
 & 'C:\Program Files\nodejs\node.exe' (Join-Path $root 'server/node_modules/vitest/vitest.mjs') run --config (Join-Path $root 'server/test/phase2-browser-connection.vitest.config.ts') --configLoader $Loader --reporter=json --outputFile (Join-Path $PSScriptRoot ('offline-'+$Loader+'.json'))
 $code=$LASTEXITCODE
} finally {
 foreach($name in @('PGPASSWORD','PGSSLMODE','PHASE2_BOOKING_DATABASE_URL','PHASE2_PRIVATE_OFFLINE_TEST')){Remove-Item -LiteralPath ('Env:'+$name) -ErrorAction SilentlyContinue}
 $secret.Dispose()
}
exit $code
