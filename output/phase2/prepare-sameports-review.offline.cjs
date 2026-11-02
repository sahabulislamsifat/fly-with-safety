const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base='output/phase2/sameports-browser-20261102-01';if(fs.existsSync(base))throw Error('NEW_REVIEW_DIRECTORY_ALREADY_EXISTS');fs.mkdirSync(base);
const old='output/phase2/browser-ui-session-20261102-01';const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
let caller=fs.readFileSync(old+'/Invoke-BrowserHost.ps1','utf8').replaceAll('RunAuthorizedBrowserJourney','OwnerApprovedSamePortTest');
const portGuard=`$probe=New-Object Net.Sockets.TcpClient
try {
 $pending=$probe.BeginConnect('localhost',5000,$null,$null)
 if(-not $pending.AsyncWaitHandle.WaitOne(2000)){throw 'STOP: backend port state inconclusive'}
 try {$probe.EndConnect($pending); $busy=$true} catch [Net.Sockets.SocketException] {if($_.Exception.SocketErrorCode -ne [Net.Sockets.SocketError]::ConnectionRefused){throw 'STOP: backend port state inconclusive'}; $busy=$false}
 if($busy){throw 'STOP: port5000 occupied; approved normal-backend interruption must happen first'}
} finally {$probe.Dispose()}
`;
caller=caller.replace("$secret=Read-Host",portGuard+"$secret=Read-Host");
caller=caller.replace(" Write-Host 'Leave this console open",` $ownership=Join-Path $root 'output/phase2/local-ownership-auth-output.txt'
 if(Test-Path -LiteralPath $ownership){throw 'STOP: ownership result already exists; review it without rerunning'}
 & 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe' -X -w -h 127.0.0.1 -p 5432 -U flywithsafe_phase2_booking_test -d flywithsafe_phase2_booking_integration -v ON_ERROR_STOP=1 -f (Join-Path $root 'output/phase2/local-ownership-auth.readonly.sql') | Tee-Object -FilePath $ownership
 $ownershipExit=$LASTEXITCODE
 if($ownershipExit -ne 0){[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'caller-result.json'),(@{stage='readonly-ownership';exit=$ownershipExit;businessAcceptance=$false}|ConvertTo-Json -Compress));throw 'STOP: read-only ownership check failed; preserve evidence, no retry'}
 Write-Host 'Leave this console open`);
caller=caller.replace("foreach($name in @('host-stdout.txt'","if(Test-Path -LiteralPath (Join-Path $root 'output/phase2/local-ownership-auth-output.txt')){throw 'STOP: ownership result already exists; agent review required before another workflow'}\nforeach($name in @('host-stdout.txt'");
fs.copyFileSync(old+'/Set-PrivatePhase2Connection.ps1',base+'/Set-PrivatePhase2Connection.ps1');
const pins=JSON.parse(fs.readFileSync(old+'/pins.json'));for(const pin of pins){if(/[/\\]\.env(?:$|\.)/.test(pin.path))throw Error('PRIVATE_ENV_PIN_FORBIDDEN');pin.sha256=digest(pin.path);}
for(const f of [base+'/Set-PrivatePhase2Connection.ps1','output/phase2/local-ownership-auth.readonly.sql','output/phase2/PHASE2-EXECUTION-SCOPE.md']){const abs=path.resolve(f);if(!pins.some(p=>p.path===abs))pins.push({path:abs,sha256:digest(f)});}
fs.writeFileSync(base+'/pins.json',JSON.stringify(pins,null,2));caller=caller.replace('7A33B3DE1B69335781F05C630A0F696F6FE6F8BA514B1F2F9DB8DCD2F1F22AF0',digest(base+'/pins.json'));fs.writeFileSync(base+'/Invoke-BrowserHost.ps1',caller);console.log(JSON.stringify({directory:base,pins:pins.length,callerHash:digest(base+'/Invoke-BrowserHost.ps1'),executed:false}));
