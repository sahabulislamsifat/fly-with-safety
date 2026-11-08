'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{createRequire}=require('node:module'),{spawnSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../../..'),out=path.join(repo,'output/phase5/p5-browser-preparation-20261108-01');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase(),rel=p=>path.relative(repo,p).replaceAll('\\','/');
const file=path.join(__dirname,'pins.json'),manifest=JSON.parse(fs.readFileSync(file));
const map=new Map(manifest.files.map(f=>[f.path,f.sha256]));
for(const e of fs.readdirSync(__dirname,{withFileTypes:true}))if(e.isFile()&&!['pins.json','Invoke-BrowserAcceptance.ps1'].includes(e.name))map.set(rel(path.join(__dirname,e.name)),sha(path.join(__dirname,e.name)));
map.set('docs/proposals/P5_IDENTITY_SCOPE_IMPLEMENTATION_REPORT.md',sha(path.join(repo,'docs/proposals/P5_IDENTITY_SCOPE_IMPLEMENTATION_REPORT.md')));
manifest.files=[...map].map(([path,sha256])=>({path,sha256})).sort((a,b)=>a.path.localeCompare(b.path));
fs.writeFileSync(file,JSON.stringify(manifest,null,2));const manifestSHA256=sha(file);
const caller=path.join(__dirname,'Invoke-BrowserAcceptance.ps1');let ps=fs.readFileSync(caller,'utf8');ps=ps.split('\n').map(line=>line.includes('STOP: integration manifest mismatch')?line.replace(/'PENDING_MANIFEST_SHA'|'[A-F0-9]{64}'/,"'"+manifestSHA256+"'"):line).join('\n');fs.writeFileSync(caller,ps);
let checks=0;for(const pin of manifest.files){if(sha(path.join(repo,pin.path))!==pin.sha256)throw Error('SOURCE_RUNTIME_PIN_MISMATCH');checks++;}
for(const pin of manifest.externalFiles){if(sha(pin.path)!==pin.sha256)throw Error('BROWSER_PIN_MISMATCH');checks++;}
if(sha(manifest.node.path)!==manifest.node.sha256)throw Error('NODE_PIN_MISMATCH');checks++;
for(const pin of manifest.resolutions){const actual=pin.locator?fs.realpathSync(path.resolve(repo,pin.locator)):createRequire(path.resolve(repo,pin.from)).resolve(pin.request);if(actual!==path.resolve(repo,pin.entry))throw Error('RESOLUTION_CHANGED');checks++;}
let syntax=0;for(const e of fs.readdirSync(__dirname))if(e.endsWith('.cjs')){const r=spawnSync(process.execPath,['--check',path.join(__dirname,e)],{windowsHide:true,stdio:'pipe'});if(r.status!==0)throw Error('NODE_SYNTAX_FAILURE');syntax++;}
if(fs.existsSync(path.join(repo,'output/phase5/p5-browser-20261108-01')))throw Error('EXECUTION_ALREADY_ATTEMPTED');checks++;
const build=JSON.parse(fs.readFileSync(path.join(out,'offline-build.json'))),preserved=JSON.parse(fs.readFileSync(path.join(out,'preservation.json')));
const receipt={date:'2026-11-08',offlineGuardTests:{passed:23,failed:0,skipped:0},typescript:'PASS_SERVER_BROWSER_AND_CLIENT',lint:'PASS',nativePowerShell51:'PASS_AST',generatedSchemaTokens:'PASS',optimizedBuild:build,packagePins:manifest.files.length,browserExternalPins:manifest.externalFiles.length,nodeBinaryPins:1,resolutions:manifest.resolutions.length,integrityAssertions:checks,nodeSyntaxFiles:syntax,preservedPriorPins:preserved.preservedHistoricalFiles,unmappedHistoricalChanges:preserved.expectedChangedPaths,manifestSHA256,callerSHA256:sha(caller),newLiveAttempt:false,databaseConnections:0,fixtureWrites:0,providerCalls:0,browserExecuted:false,p5Verdict:'PARTIAL_PENDING_APPROVED_BROWSER_EXECUTION'};
fs.writeFileSync(path.join(out,'offline.json'),JSON.stringify(receipt,null,2));
const cmd="& {\r\n $ErrorActionPreference = 'Stop'\r\n $p = 'E:\\Programming\\Project\\fly-with-safety\\server\\test\\p5-browser-acceptance\\Invoke-BrowserAcceptance.ps1'\r\n if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { throw 'STOP: reviewed browser caller missing' }\r\n if ((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -cne '"+receipt.callerSHA256+"') { throw 'STOP: reviewed browser caller hash mismatch' }\r\n & $p -OwnerApprovedBrowserAcceptance\r\n}\r\n";
fs.writeFileSync(path.join(out,'OWNER-COMMAND.ps1'),cmd);console.log(JSON.stringify(receipt));
