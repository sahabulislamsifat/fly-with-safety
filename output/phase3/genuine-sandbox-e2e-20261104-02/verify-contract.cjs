'use strict';
// OFFLINE only. Never starts main, SSH, browser, DB or provider.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const base=__dirname,repo=path.resolve(base,'../../..'),read=p=>fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
const ps=read(path.join(base,'Invoke-GenuineSandbox.ps1')),main=read(path.join(repo,'server/test/phase3-genuine-v02/main.ts')),plan=JSON.parse(read(path.join(base,'fixture-plan.json')));
const old=path.join(repo,'output/phase3/genuine-sandbox-e2e-20261104-01'),readonly=path.join(repo,'output/phase3/db-preflight-readonly-20261104-01');
const ro=JSON.parse(read(path.join(readonly,'result.json'))),callerResult=JSON.parse(read(path.join(readonly,'caller-result.json')));
check(ro.passed&&ro.snapshotSerializable&&ro.controlledRollback&&ro.correctedCatalogRows===340&&ro.guards.migrations===8&&ro.guards.actors===4&&ro.guards.staffRecipients===2&&ro.guards.fixtureAbsent&&ro.nativeOriginalCatalogCharOID18&&callerResult.exit===0&&callerResult.passed,'saved corrected read-only execution actually passed');
for(const n of ['financialWrites','providerCalls','publicConnections'])check(ro[n]===0,'read-only '+n);
const provenPins=JSON.parse(read(path.join(readonly,'pins.json'))),provenHelper=provenPins.find(p=>p.path.endsWith('phase3-db-preflight-v02.ts'));
check(hash(path.join(repo,'server/test/phase3-db-preflight-v02.ts'))===provenHelper.sha256,'exact live-verified helper unchanged');
check(read(path.join(repo,'server/test/phase3-genuine-v02/preflight.ts')).includes("from '../phase3-db-preflight-v02.js'"),'real runner reuses corrected helper');
check(main.includes("JSON.stringify(baseline);save('preservation-ready.json'")&&main.indexOf('JSON.stringify(baseline)')<main.indexOf('connector=spawn('),'snapshot serialization verified before public/provider');
for(const n of ['scope.ts','ingress.ts'])check(hash(path.join(repo,'server/test/phase3-genuine-v02',n))===hash(path.join(repo,'server/test/phase3-genuine',n)),'unchanged caps/security '+n);
check(hash(path.join(base,'fixture-plan.json'))===hash(path.join(old,'fixture-plan.json')),'same exact fixture IDs and caps');
check(ps.includes('param([switch]$OwnerApprovedGenuineSandbox)'),'caller approval switch');
check(ps.includes('--owner-approved-genuine-sandbox-v02')&&main.includes("process.argv[2]!=='--owner-approved-genuine-sandbox-v02'"),'CLI flag/order');
check(ps.includes("['PHASE3_GENUINE_APPROVED']='true'")&&main.includes("process.env.PHASE3_GENUINE_APPROVED!=='true'"),'independent child gate');
check(ps.includes("server\\test\\phase3-genuine-v02\\main.ts")&&ps.includes("server\\node_modules\\tsx\\dist\\cli.mjs"),'installed entry paths');
check(ps.includes('-AsSecureString')&&ps.includes('SecureStringToBSTR')&&ps.includes('ZeroFreeBSTR')&&!ps.includes('add-authtoken'),'private prompt');
check(ps.includes('$start.EnvironmentVariables.Clear()')&&ps.includes("'ProgramData'"),'clean Windows child environment');
check(ps.includes("['DATABASE_URL']=$url")&&ps.includes("['DIRECT_URL']=$url"),'private URL parity');
check(!/Stop-Process|taskkill|\.Kill\(/i.test(ps),'no unrelated termination');
check(main.indexOf("await preflight(prisma")<main.indexOf('connector=spawn('),'identity before public');
check(main.indexOf("save('transport-preflight.json'")<main.indexOf("stage='owned-fixture-create'"),'spoof gate before writes');
check(main.indexOf("stage='owned-fixture-create'")<main.indexOf('await service.initiate('),'fixture ownership before provider');
check(main.includes("['https','http']")&&main.includes('PROXY_SPOOF_PREFLIGHT_FAILED'),'both new spoof cases');
check(main.includes('SSLCOMMERZ_STORAGE_KEY:randomBytes(32)')&&!main.includes('writeFileSync(config.storageKey'),'process-only key');
check(main.includes("SSLCOMMERZ_REFUNDS_APPROVED:'false'")&&main.includes("EMAIL_DELIVERY_ENABLED:'false'"),'refund/SMTP disabled');
check(main.includes('financialRouter=createPaymentCallbacks(()=>service,()=>config)'),'real callback factory receives bounded service');
check(main.includes('new PrismaPaymentStore(scopedDB)')&&main.includes('new LimitedGateway(new SSLCommerzClient(config),scope)'),'actual store/provider budget injection');
check(main.includes("n.source==='ipn'&&n.signed&&n.processed"),'genuine signed IPN success gate');
check(main.includes("const expected=f.name==='success'?'VERIFIED':f.name==='fail'?'FAILED':'CANCELLED'"),'three genuine outcomes');
check(main.includes("if(booking.status!=='PENDING')")&&main.includes('PAID_FULFILLED_BOUNDARY_BROKEN'),'fulfillment separation');
check(main.includes('scope.closed=true')&&main.includes('1800000')&&main.includes('60000'),'deadline and drain caps');
check(main.includes('phase3Accepted:false')&&main.includes('manualReplayNotProviderEvidence:true'),'honest evidence boundaries');
check(plan.fixtures.length===3&&new Set(plan.fixtures.map(f=>f.name)).size===3,'three cases');
for(const f of plan.fixtures){for(const key of ['bookingId','passengerId','historyId','quoteId','requestId'])check(/^[a-f0-9-]{36}$/.test(f[key]),'exact '+key);check(f.amount===12000&&f.customerId===plan.actors[0].id,'owned amount/actor');}
check(JSON.stringify(plan.caps)===JSON.stringify({transactions:100,bookings:3,passengers:3,initialHistory:3,payments:3,saves:90,events:36,bookingUpdates:6,financialHistory:6,outbox:18,initiate:3,query:12,validate:6,callbacks:12,deniedRequests:24}),'exact reviewed caps');
for(const n of ['attempt.json','result.json','ledger.jsonl','assigned-origin.json','readonly-preflight.json','preservation-ready.json','transport-preflight.json','owned-final.json','ssh-process.json','stop.request'])check(!fs.existsSync(path.join(base,n)),'no consumed '+n);
const {sshArgs}=require('../localhost-run-injection-v01/transport.cjs'),known=path.join(repo,'output/phase3/localhost-run-smoke/known_hosts'),args=sshArgs(45678,known);
check(args.at(-1)==='--inject-http-proxy-headers'&&args.indexOf('nokey@localhost.run')<args.indexOf('--output'),'SSH CLI contract');
for(const v of ['StrictHostKeyChecking=yes',`UserKnownHostsFile=${known}`,'IdentityAgent=none','IdentityFile=none','80:127.0.0.1:45678'])check(args.includes(v),'SSH '+v);
for(const n of ['pins.json','runtime-pins.json']){const entries=JSON.parse(read(path.join(base,n)));check(entries.length>0,n);for(const p of entries){const filename=path.isAbsolute(p.path)?p.path:path.resolve(base,p.path);check(hash(filename)===p.sha256,'pin '+p.path);}}
check(ps.includes(hash(path.join(base,'pins.json'))),'manifest hash wired');
// Historical accepted transport pins must remain unchanged; no historical caller is run.
const historic=JSON.parse(read(path.join(repo,'output/phase3/localhost-run-injection-v01/pins.json')));for(const p of historic)check(hash(path.resolve(repo,'output/phase3/localhost-run-injection-v01',p.path))===p.sha256,'historic pin '+p.path);
const result={passed:true,checks,sourcePins:JSON.parse(read(path.join(base,'pins.json'))).length,runtimePins:JSON.parse(read(path.join(base,'runtime-pins.json'))).length,attemptAbsent:true,publicExecution:false,databaseAccess:false,providerCalls:0,callerSHA256:hash(path.join(base,'Invoke-GenuineSandbox.ps1'))};
fs.writeFileSync(path.join(base,'contract-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));

