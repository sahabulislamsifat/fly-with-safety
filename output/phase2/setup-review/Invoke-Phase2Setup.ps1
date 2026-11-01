param([switch]$OwnerAuthorized)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
if(-not $OwnerAuthorized){throw 'STOP: explicit owner approval required; this is a prepared, unexecuted setup'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: interactive PS5.1 required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: policy differs; no bypass'}
if($env:PGPASSWORD -or $env:DATABASE_URL -or $env:DIRECT_URL){throw 'STOP: credential environment must initially be empty'}
$root=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$pinFile=Join-Path $PSScriptRoot 'pins.json'
if((Get-FileHash -LiteralPath $pinFile -Algorithm SHA256).Hash -cne '348859A4342467ED05AF1ADF3A66D9D5FE5CD45F991D2D8C5D6B3294AFD4FCC2'){throw 'STOP: reviewed manifest mismatch'}
$pins=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'pins.json') -Raw | ConvertFrom-Json
foreach($pin in $pins){if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: source integrity mismatch'}}
$expectedNames='20260926202822_init,20260927082715_full_schema,20261009000000_auth_sessions_and_password_resets,20261011000000_inquiry_idempotency,20261011120000_notification_outbox,20261022000100_contact_status_new,20261022000200_booking_contact_schema'
$actualNames=((Get-ChildItem -LiteralPath (Join-Path $root 'server/prisma/migrations') -Directory | Sort-Object Name).Name -join ',')
if($actualNames -cne $expectedNames){throw 'STOP: migration directory set mismatch'}
$marker=Join-Path $PSScriptRoot 'attempt-started.json'
if(Test-Path -LiteralPath $marker){throw 'Existing Phase2 setup attempt; no retry'}
$psql='C:\Program Files\PostgreSQL\18\bin\psql.exe'
$private=Read-Host 'EXISTING postgres password (private)' -AsSecureString
$secretPtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($private)
$stage='preflight-create'
$ownsAttempt=$false
try {
 $env:PGPASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPtr)
 $stream=[IO.File]::Open($marker,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 $ownsAttempt=$true
 try{$started=@{target='flywithsafe_phase2_booking_integration';oneAttempt=$true;startedUTC=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress;$bytes=[Text.Encoding]::UTF8.GetBytes($started);$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
 & $psql -X -w -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'create-target.sql')
 if($LASTEXITCODE -ne 0){throw 'STOP: creation/preflight failed; preserve state, no retry'}
 $stage='baseline-migrations'
 $env:DIRECT_URL='postgresql://postgres:'+ [Uri]::EscapeDataString($env:PGPASSWORD)+'@127.0.0.1:5432/flywithsafe_phase2_booking_integration?schema=public'
 & 'C:\Program Files\nodejs\node.exe' (Join-Path $root 'server/node_modules/prisma/build/index.js') migrate deploy --config (Join-Path $PSScriptRoot 'prisma.config.cjs')
 if($LASTEXITCODE -ne 0){throw 'STOP: baseline deployment failed; preserve state, no retry'}
 Remove-Item Env:DIRECT_URL
 $stage='restricted-role-and-access-postcheck'
 & $psql -X -w -h 127.0.0.1 -p 5432 -U postgres -d flywithsafe_phase2_booking_integration -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'role.sql')
 if($LASTEXITCODE -ne 0){throw 'STOP: role setup failed; preserve state, no retry'}
 $result=@{passed=$true;exitCode=0;newDatabaseOnly=$true;stage=$stage;finishedUTC=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress
 [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'result.json'),$result)
 Write-Host 'Phase2 isolated setup finished. Exit code: 0'
} catch {
 if($ownsAttempt -and -not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'result.json'))){
  $result=@{passed=$false;stage=$stage;processExit=$LASTEXITCODE;finishedUTC=[DateTime]::UtcNow.ToString('o');partialStatePreserved=$true} | ConvertTo-Json -Compress
  [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'result.json'),$result)
 }
 throw 'STOP: Phase2 setup did not complete; preserve stage evidence. No retry or repair.'
} finally {
 Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
 Remove-Item Env:DIRECT_URL -ErrorAction SilentlyContinue
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPtr)
 $private.Dispose()
}
