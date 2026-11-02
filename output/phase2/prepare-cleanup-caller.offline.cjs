const fs=require('fs'),path=require('path'),c=require('crypto'),b='output/phase2/exact-cleanup-20261102-01',hash=f=>c.createHash('sha256').update(fs.readFileSync(f)).digest('hex').toUpperCase();
const files=[b+'/cleanup.review.sql',b+'/exact-ledger.json','output/phase2/sameports-browser-20261102-02/retained-records.json','output/phase2/sameports-browser-20261102-02/caller-result.json','output/phase2/sameports-browser-20261102-02/finalization.json','output/phase2/sameports-browser-20261102-02/host-result.json','output/phase2/sameports-browser-20261102-02/ready.json','output/phase2/integration-recovery-20261101-01/fixture-ledger.jsonl','output/phase2/final-evidence-acceptance-20261101-01/accepted-evidence.json','server/prisma/schema.prisma','output/phase2/setup-review/role.sql','C:/Program Files/PostgreSQL/18/bin/psql.exe'];
for(const d of fs.readdirSync('server/prisma/migrations',{withFileTypes:true}))if(d.isDirectory())files.push('server/prisma/migrations/'+d.name+'/migration.sql');
fs.writeFileSync(b+'/pins.json',JSON.stringify(files.map(f=>({path:path.resolve(f),sha256:hash(f)})),null,2));
const caller=`param([switch]$OwnerApprovedExactCleanup)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\\Microsoft.PowerShell.Utility\\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
if(-not $OwnerApprovedExactCleanup){throw 'STOP: exact33-row cleanup requires explicit owner approval'}
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or $Host.Name -ne 'ConsoleHost' -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'STOP: existing private interactive Windows PowerShell5.1 console required'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'STOP: execution policy differs; no bypass'}
foreach($file in @('attempt-started.json','result.json','stdout.txt')){if(Test-Path -LiteralPath (Join-Path $PSScriptRoot $file)){throw 'STOP: existing cleanup attempt; preserve evidence, no retry'}}
foreach($name in @('PGPASSWORD','PGHOSTADDR','PGOPTIONS','PGSERVICE','PGSERVICEFILE')){if([Environment]::GetEnvironmentVariable($name,'Process')){throw 'STOP: PostgreSQL override present'}}
$manifest=Join-Path $PSScriptRoot 'pins.json'
if((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -cne '${hash(b+'/pins.json')}'){throw 'STOP: cleanup manifest integrity mismatch'}
foreach($pin in (Get-Content -LiteralPath $manifest -Raw|ConvertFrom-Json)){if((Get-FileHash -LiteralPath $pin.path -Algorithm SHA256).Hash -cne $pin.sha256){throw 'STOP: cleanup source integrity mismatch'}}
$root=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$closed=Get-Content -LiteralPath (Join-Path $root 'output/phase2/sameports-browser-20261102-02/caller-result.json') -Raw|ConvertFrom-Json
$final=Get-Content -LiteralPath (Join-Path $root 'output/phase2/sameports-browser-20261102-02/finalization.json') -Raw|ConvertFrom-Json
if($closed.hostExit -ne 0 -or $final.snapshotSkipped -or $final.closeFailure -or $final.snapshotFailure -or $final.disconnectFailure){throw 'STOP: completed browser-host ledger not verified'}
$stream=[IO.File]::Open((Join-Path $PSScriptRoot 'attempt-started.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try{$data=@{startedUTC=[DateTime]::UtcNow.ToString('o');target='flywithsafe_phase2_booking_integration';expectedRows=33;action='exact-owned-cleanup'}|ConvertTo-Json -Compress;$bytes=[Text.Encoding]::UTF8.GetBytes($data);$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
Write-Host 'EXISTING local postgres administrator password only at psql private prompt; no application credentials are requested.'
$output=& 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe' -X -W -h 127.0.0.1 -p 5432 -U postgres -d flywithsafe_phase2_booking_integration -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'cleanup.review.sql') | Tee-Object -FilePath (Join-Path $PSScriptRoot 'stdout.txt')
$code=$LASTEXITCODE
$committed=@($output|Where-Object {$_ -eq 'PHASE2_EXACT_OWNED_CLEANUP_COMMITTED_33_ROWS'}).Count -eq 1
$checked=@($output|Where-Object {$_ -eq 'PHASE2_CLEANUP_CATALOG_ACCESS_AND_FINAL_READONLY_PASS'}).Count -eq 1
$passed=$code -eq 0 -and $committed -and $checked
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'result.json'),(@{exit=$code;committedMarker=$committed;finalReadOnlyPassed=$checked;passed=$passed;expectedRows=33;finishedUTC=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Compress))
Write-Host ('Phase2 exact-owned cleanup exit: '+$code)
if(-not $passed){throw 'STOP: cleanup incomplete; preserve actual state, no retry or repair'}
`;
fs.writeFileSync(b+'/Invoke-ExactCleanup.ps1',caller);console.log(JSON.stringify({pins:files.length,sqlHash:hash(b+'/cleanup.review.sql'),callerHash:hash(b+'/Invoke-ExactCleanup.ps1'),manifestHash:hash(b+'/pins.json'),executed:false}));
