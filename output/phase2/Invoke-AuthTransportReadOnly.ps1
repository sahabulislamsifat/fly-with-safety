param([switch]$OwnerApprovedStandaloneReadOnly)
$ErrorActionPreference='Stop'
if(-not $OwnerApprovedStandaloneReadOnly){throw 'STOP: one standalone two-client read-only check needs owner approval'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: existing private interactive PS5.1 required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: policy differs; no bypass'}
$helper=Join-Path $PSScriptRoot 'browser-confirmed-local-20261102-01/Set-PrivatePhase2Connection.ps1'
$sql=Join-Path $PSScriptRoot 'browser-confirmed-local-20261102-01/credential-preflight.readonly.sql'
$node=Join-Path $PSScriptRoot 'auth-transport.readonly.cjs'
if((Get-FileHash -LiteralPath $helper -Algorithm SHA256).Hash -cne 'B2EC09C829E5F6ECEA7E7B19459554F4BD292F245DC709DE07B32D4B2D715AC0'){throw 'STOP: helper changed'}
if((Get-FileHash -LiteralPath $sql -Algorithm SHA256).Hash -cne '2E09DEA9B28C774209CF67FFD77E9C926A4D16F1CC4266CB9D4BA51C1C43F1D8'){throw 'STOP: readonly SQL changed'}
if((Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash -cne '18A407F8526BB8F9F246298CE00BDA31B61FCF1FC54EA27239984E1D201ADE8B'){throw 'STOP: node probe changed'}
$result=Join-Path $PSScriptRoot 'auth-transport-readonly-result.json'
if(Test-Path -LiteralPath $result){throw 'Existing standalone diagnostic; no automatic retry'}
$names=@('DATABASE_URL','DIRECT_URL','PGPASSWORD','PGOPTIONS','PGSSLMODE','PGSSLNEGOTIATION','PGSERVICE','PGSERVICEFILE','PGHOSTADDR','PHASE2_BOOKING_DATABASE_URL')
foreach($name in $names){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'STOP: inherited credential/options must be empty'}}
. $helper
$secret=Read-Host 'EXISTING local restricted-role password ONCE for both read-only clients; no postgres/account password' -AsSecureString
$nativeExit=$null;$nodeExit=$null;$nodeResult=$null
try {
 Set-PrivatePhase2Connection -Secret $secret
 $stream=[IO.File]::Open($result,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$stream.Dispose()
 & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -w -h 127.0.0.1 -p 5432 -U flywithsafe_phase2_booking_test -d flywithsafe_phase2_booking_integration -v ON_ERROR_STOP=1 -f $sql
 $nativeExit=$LASTEXITCODE
 # One distinct client comparison, even on native rejection. This is not a retry or host launch.
 $lines=@(& 'C:\Program Files\nodejs\node.exe' $node --owner-readonly)
 $nodeExit=$LASTEXITCODE
 if($lines.Count -eq 1){$nodeResult=$lines[0]|ConvertFrom-Json}
 Write-Host ('Native psql exit: '+$nativeExit+'; Node direct-password exit: '+$nodeExit)
 if($nodeResult){Write-Host ($nodeResult|ConvertTo-Json -Compress)}
} finally {
 if(Test-Path -LiteralPath $result){[IO.File]::WriteAllText($result,(@{nativeExit=$nativeExit;nodeExit=$nodeExit;node=$nodeResult;readOnly=$true;hostDispatched=$false;finishedUTC=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 4))}
 foreach($name in $names){Remove-Item -LiteralPath ('Env:'+$name) -ErrorAction SilentlyContinue}
 $secret.Dispose()
}
