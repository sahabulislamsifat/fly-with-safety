/** One owner-approved genuine sandbox run. Never import this module from normal startup. */
import { readFileSync,writeFileSync,appendFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes,randomUUID } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { spawn,type ChildProcess } from 'node:child_process';
import express from 'express';
import {createRequire} from 'node:module';
import type {Browser,Page} from 'C:/Users/sahab/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright';
const local=createRequire(__filename);
import type { Server } from 'node:http';
import { Scope,OwnedStore,LimitedGateway,type Plan } from './scope.js';
import { assertLocalURL,preflight,preserve } from '../phase3-negative-v01/preflight.js';
import {financialAdmission} from '../phase3-negative-v01/ingress.js';
import {failedInstruction} from './procedure.js';
import {AppError} from '../../src/utils/errors.js';
import type {PrismaClient, Prisma} from '../../src/generated/prisma/client.js';
import {createIsolatedCallbackLimiter} from '../phase3-negative-v01/callback-limit.js';
import {failedCallbacks} from './callbacks.js';
import {OwnerCaseWindow} from '../phase3-negative-v01/case-window.js';
import {verifyRetained} from '../phase3-negative-v01/retained.js';
import {ownerReadyAllowed} from '../phase3-negative-v01/owner.js';
const repo=resolve(__dirname,'../../..'),base=resolve(repo,'output/phase3/failed-uat-20261105-01');
const {sshArgs}=local('../../../output/phase3/localhost-run-injection-v01/transport.cjs');
const {reader}=local('../../../output/phase3/localhost-run-smoke-v03/discovery.cjs');
const {diagnostics,stopOwned}=local('../../../output/phase3/localhost-run-smoke-v03/ssh-lifecycle.cjs');
const {sshEnvironment}=local('../../../output/phase3/localhost-run-smoke/ssh-environment.cjs');
const paths:string[]=local('../../../output/phase3/isolated-callback/boundary.cjs').paths;
const save=(name:string,data:object)=>writeFileSync(resolve(base,name),JSON.stringify(data,null,2),{flag:'wx'});
const record=(e:object)=>appendFileSync(resolve(base,'ledger.jsonl'),JSON.stringify({at:new Date().toISOString(),...e})+'\n');
async function main(){
 if(process.argv[2]!=='--owner-approved-failed-uat'||process.env.PHASE3_FAILED_UAT_APPROVED!=='true')throw Error('EXECUTION_NOT_APPROVED');
 assertLocalURL(process.env.DATABASE_URL||'');if(process.env.DIRECT_URL!==process.env.DATABASE_URL)throw Error('URL_PARITY_REQUIRED');
 if(existsSync(resolve(base,'attempt.json')))throw Error('CONSUMED_NO_RETRY');
 const plan=JSON.parse(readFileSync(resolve(base,'fixture-plan.json'),'utf8').replace(/^\uFEFF/,'')) as Plan;
 const scope=new Scope(plan,record);
 const dotenv=local('../../node_modules/dotenv');const privateEnv=dotenv.parse(readFileSync(resolve(repo,'server/.env')));
 if(privateEnv.SSLCOMMERZ_SANDBOX!=='true'||!privateEnv.SSLCOMMERZ_STORE_ID||!privateEnv.SSLCOMMERZ_STORE_PASSWORD)throw Error('PRIVATE_SANDBOX_CONFIG_MISSING');
 Object.assign(process.env,{NODE_ENV:'development',EMAIL_DELIVERY_ENABLED:'false',SSLCOMMERZ_ENABLED:'true',SSLCOMMERZ_SANDBOX:'true',SSLCOMMERZ_SCHEMA_VERIFIED:'true',SSLCOMMERZ_REFUNDS_APPROVED:'false',SSLCOMMERZ_STORE_ID:privateEnv.SSLCOMMERZ_STORE_ID,SSLCOMMERZ_STORE_PASSWORD:privateEnv.SSLCOMMERZ_STORE_PASSWORD,SSLCOMMERZ_STORAGE_KEY:randomBytes(32).toString('base64'),SSLCOMMERZ_API_BASE_URL:'https://sandbox.sslcommerz.com'});
 save('attempt.json',{at:new Date().toISOString(),syntheticOnly:true,genuineProviderRequested:true});
 const {PrismaClient}=await import('../../src/generated/prisma/client.js'),{PrismaPg}=await import('@prisma/adapter-pg');const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000,statement_timeout:10000,query_timeout:15000,max:2})});let connector:ChildProcess|undefined,pub:Server|undefined,landing:Server|undefined,origin:string|undefined,nativeEvidence:object|undefined,browser:Browser|undefined,phase:'probe'|'financial'|'stopped'='probe',failure:object|null=null,stage='db-readonly-preflight',baseline:unknown,financialRouter:express.Router|undefined;
 const receipts:Array<{id:string|null;admitted:boolean;proxy:Record<string,unknown>}>=[], notices:Array<{case:string;source:string;signed:boolean;processed:boolean;failedStatus:boolean}>=[],returned=new Set<string>(),admittedRequests=new WeakSet<object>(),ownerReady=new Set<string>(),checkoutConfirmed=new Set<string>();let activeOwnerCase='',activeOwnerStage='',privateOrigin='';let returnPage:Page|undefined,replayValId:string|undefined;const ownerNonce=randomBytes(32).toString('hex');
 const cases:Array<object>=[];const marker=randomBytes(24).toString('hex');const tasks=new Set<Promise<unknown>>();let abort=false,connectorStopped=true,preservation=false;
 const requestStop=()=>{abort=true;scope.closed=true;phase='stopped';void stopOwned(connector);void browser?.close().catch(()=>{});};
 const timeout=setTimeout(requestStop,1980000),stopWatch=setInterval(()=>{if(existsSync(resolve(base,'stop.request')))requestStop();},500);
 process.once('SIGINT',requestStop);process.once('SIGTERM',requestStop);
 try{
 const retained=await readOnly(prisma,async db=>{
  save('readonly-preflight.json',await preflight(db as PrismaClient,plan,repo));
  const retained=await verifyRetained(db as PrismaClient,repo);save('retained-preflight.json',retained.summary);
  stage='db-protected-snapshot';baseline=await preserve(db as PrismaClient,plan);JSON.stringify(baseline);
  save('preservation-ready.json',{serializable:true,protectedSnapshotInMemoryOnly:true,includesGenuineSuccess:true,oldProviderRequests:0});return retained;
 });
 scope.protectRetainedTransaction(retained.incomplete.tranId);
 const publicApp=express();publicApp.disable('x-powered-by');publicApp.use((req,res,next)=>{
 if(phase==='stopped')return res.status(404).end();
 if(phase==='probe'&&receipts.length>=8){failure={stage,code:'PROBE_CAP'};requestStop();return res.status(429).end();}
 const {meta,admitted}=financialAdmission(req,origin);
 record({kind:'origin-admission',phase,admitted,proxy:meta,callbackPath:paths.includes(req.path),methodPOST:req.method==='POST'});
 const id=req.get('x-proof-id');receipts.push({id:id&&/^[a-f0-9-]{36}$/.test(id)?id:null,admitted,proxy:meta});
 if(phase==='probe'){res.setHeader('x-proof-marker',marker);req.resume();res.status(admitted?200:404).end();return;}
 if(phase!=='financial'||!admitted){if(phase==='financial'){try{scope.reserve('deniedRequests');}catch{failure={stage,code:'DENIED_REQUEST_CAP'};requestStop();}}return res.status(404).end();}
 try{scope.reserve('callbacks');}catch{failure={stage,code:'CALLBACK_CAP'};requestStop();return res.status(429).end();}admittedRequests.add(req);next();
 });
 publicApp.use(express.urlencoded({extended:false,limit:'16kb',parameterLimit:40}));
 publicApp.use((req,res,next)=>{if(phase!=='financial')return res.status(404).end();const owned=[...scope.payments.values()].find(p=>p.tranId===req.body?.tran_id);if(!owned)return res.status(404).end();
 const source=paths.includes(req.path)?req.path.split('/').at(-1)!:'';let signed=false;
 try{const {verifyNotification}=local('../../src/payments/sslcommerz.js');signed=verifyNotification(req.body,process.env.SSLCOMMERZ_STORE_PASSWORD)==='verified';}catch{return res.status(400).end();}
 const failedStatus=req.body.status==='FAILED';
 if(source==='ipn'&&(!signed||!failedStatus))return res.status(400).end();
 if(!['fail','ipn'].includes(source))return res.status(404).end();
 const notice={case:owned.fixture.name,source,signed,processed:false,failedStatus};notices.push(notice);
 const finished=new Promise<void>(resolve=>res.once('finish',()=>{notice.processed=res.statusCode<400;if(notice.processed&&source==='fail')replayValId=typeof req.body.val_id==='string'&&req.body.val_id?req.body.val_id:undefined;record({kind:'callback',case:notice.case,source,signed,failedStatus,processed:notice.processed,status:res.statusCode});resolve();}));tasks.add(finished);void finished.finally(()=>tasks.delete(finished));next();
 });
 publicApp.use('/api/v1',(req,res,next)=>financialRouter?financialRouter(req,res,next):res.status(503).end());
 publicApp.use((_req,res)=>res.status(404).end());
 publicApp.use((e:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{void _next;record({kind:'callback-error',code:e instanceof Error&&/^[A-Z0-9_]+$/.test(e.message)?e.message:'CALLBACK_REJECTED'});res.status(400).json({error:'CALLBACK_REJECTED'});});
 pub=await listen(publicApp);const port=portOf(pub);if([3000,5000].includes(port))throw Error('NORMAL_PORT_FORBIDDEN');
 stage='ssh-allocation';const ssh=resolve(process.env.WINDIR||'C:/Windows','System32/OpenSSH/ssh.exe'),known=resolve(repo,'output/phase3/localhost-run-smoke/known_hosts');
 connector=spawn(ssh,sshArgs(port,known),{windowsHide:true,stdio:['ignore','pipe','pipe'],env:sshEnvironment(process.env)});save('ssh-process.json',{pid:connector.pid,loopbackPort:port,owned:true});nativeEvidence=diagnostics(connector);
 await bounded(new Promise<void>((resolve,reject)=>{const parse=reader();connector!.stdout!.on('data',b=>{try{for(const value of parse(b)){if(!origin){origin=value;save('assigned-origin.json',{origin});resolve();}}}catch(e){reject(e);}});connector!.once('error',()=>reject(Error('SSH_START_FAILED')));connector!.once('exit',()=>reject(Error('SSH_EXIT_BEFORE_ALLOCATION')));}),30000);
 if(abort||!origin)throw Error('PUBLIC_ORIGIN_UNAVAILABLE');
 stage='financial-proxy-preflight';
 const preflightChecks=[];
 // New malicious-header cases only; do not repeat accepted7 smoke cases.
 for(const scheme of ['https','http'] as const){
 const id=randomUUID(),before=receipts.length;const response=await request(scheme==='https'?origin:origin.replace('https:','http:'),paths[0],{ 'x-proof-id':id,'x-forwarded-proto':scheme==='https'?'http':'https',forwarded:scheme==='https'?'proto=http':'proto=https' });
 const receipt=receipts.slice(before).find(r=>r.id===id),redirect=scheme==='http'&&[301,302,307,308].includes(response.status)&&response.location===origin+paths[0];
 const ok=scheme==='https'?!!receipt&&(receipt.admitted?response.status===200&&response.marker===marker:response.status===404&&response.marker===marker):!!receipt&&!receipt.admitted&&response.status===404&&response.marker===marker||redirect;
 preflightChecks.push({scheme,status:response.status,originSeen:!!receipt,admitted:receipt?.admitted??false,proxy:receipt?.proxy||null,passed:ok});if(!ok)throw Error('PROXY_SPOOF_PREFLIGHT_FAILED');
 }
 save('transport-preflight.json',{checks:preflightChecks,passed:true,acceptedSmokeReplayed:false});
 stage='private-landing-and-config';
 const privateApp=express();privateApp.disable('x-powered-by');privateApp.use((req,res,next)=>{if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||'')||req.get('host')!==new URL(privateOrigin||'http://127.0.0.1').host)return res.status(404).end();res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; form-action 'self'; frame-ancestors 'none'");next();});
 privateApp.use(express.urlencoded({extended:false,limit:'2kb',parameterLimit:3}));
 privateApp.get('/owner',(req,res)=>{if(!activeOwnerCase)return res.status(404).end();const name='fail';res.type('html').send(`<title>Sandbox owner readiness</title><h1>Case: ${name.toUpperCase()}</h1><p>${escapeHTML(failedInstruction)}</p><p>Use only provider-documented sandbox data. Do not close the browser to claim cancellation. After READY, checkout has a 20-minute deadline.</p><form method="post" action="/owner/ready"><input type="hidden" name="nonce" value="${ownerNonce}"><input type="hidden" name="case" value="${name}"><button>Ready to open this sandbox case</button></form>`);});
 privateApp.post('/owner/ready',(req,res)=>{if(activeOwnerStage!=='initial'||!ownerReadyAllowed({peer:req.socket.remoteAddress||'',host:req.get('host')||'',origin:req.get('origin')||'',nonce:req.body?.nonce,case:req.body?.case},{origin:privateOrigin,nonce:ownerNonce,activeCase:activeOwnerCase,stopped:abort}))return res.status(403).end();ownerReady.add(activeOwnerCase);activeOwnerStage='initiating';res.type('html').send('<title>Ready</title><p>Readiness received. The owned runner will open Hosted Checkout.</p>');});
 privateApp.get('/owner/confirm',(req,res)=>{if(activeOwnerStage!=='checkout')return res.status(404).end();res.type('html').send(`<title>Confirm visible checkout</title><p>Inspect the Hosted Checkout tab. Confirm it is visible and you understand the official ${escapeHTML(activeOwnerCase)} action before the 20-minute timer starts. Do not submit an unsupported action.</p><form method="post" action="/owner/checkout-ready"><input type="hidden" name="nonce" value="${ownerNonce}"><input type="hidden" name="case" value="${activeOwnerCase}"><button>Checkout is visible; start case timer</button></form>`);});
 privateApp.post('/owner/checkout-ready',(req,res)=>{if(activeOwnerStage!=='checkout'||!ownerReadyAllowed({peer:req.socket.remoteAddress||'',host:req.get('host')||'',origin:req.get('origin')||'',nonce:req.body?.nonce,case:req.body?.case},{origin:privateOrigin,nonce:ownerNonce,activeCase:activeOwnerCase,stopped:abort}))return res.status(403).end();checkoutConfirmed.add(activeOwnerCase);activeOwnerStage='working';res.type('html').send('<title>Checkout confirmed</title><p>The case timer is starting. Return to the Hosted Checkout tab.</p>');});
 privateApp.get('/payments/return',(req,res)=>{const ref=typeof req.query.booking==='string'?req.query.booking:'';const f=plan.fixtures.find(f=>f.reference===ref);if(!f)return res.status(404).end();returned.add(f.name);record({kind:'browser-return-landing',case:f.name});res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");res.type('html').send('<!doctype html><title>Sandbox return</title><p>Provider return observed. Financial status requires server validation. No supplier fulfillment.</p>');});
 landing=await listen(privateApp);privateOrigin=`http://127.0.0.1:${portOf(landing)}`;process.env.FRONTEND_URL=privateOrigin;process.env.SSLCOMMERZ_CALLBACK_BASE_URL=origin;
 const {gatewayConfig,SSLCommerzClient}=await import('../../src/payments/sslcommerz.js');const config=gatewayConfig();
 const {PrismaPaymentStore}=await import('../../src/payments/payment-store.js');const {PaymentService}=await import('../../src/payments/payment.service.js');
 const scopedDB=scope.database(prisma),gateway=new LimitedGateway(new SSLCommerzClient(config),scope,requestStop),store=new OwnedStore(new PrismaPaymentStore(scopedDB),scope),service=new PaymentService(store,gateway,config);
 financialRouter=failedCallbacks(service,config,createIsolatedCallbackLimiter(admittedRequests));
 assertLocalURL(process.env.DATABASE_URL||'');if(process.env.DIRECT_URL!==process.env.DATABASE_URL)throw Error('URL_PARITY_REQUIRED');
 if(abort)throw Error('EXECUTION_DEADLINE');stage='owned-fixture-create';
 await scopedDB.$transaction(async tx=>{const clock=await tx.$queryRawUnsafe<Array<{now:Date}>>("SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now"),now=clock[0].now;
 for(const f of plan.fixtures){const owner=plan.actors.find(a=>a.id===f.customerId)!;await tx.booking.create({data:{id:f.bookingId,referenceNumber:f.reference,userId:f.customerId,status:'PENDING',customerName:'Synthetic Sandbox Traveller',customerEmail:owner.email,customerPhone:'01000000000',totalPrice:f.amount,currency:'BDT',bookingDetails:{integrationFixture:{phase:3,genuineSandbox:true,case:f.name},commercial:{version:1,revision:2,quotes:[{id:f.quoteId,amount:f.amount,currency:'BDT',description:'Synthetic sandbox, no supplier fulfillment',createdAt:now.toISOString(),acceptedAt:now.toISOString(),validUntil:new Date(+now+7200000).toISOString()}],payments:[],receipts:[]}},passengers:{create:{id:f.passengerId,firstName:'Synthetic',lastName:'Sandbox',passengerType:'adult'}},statusHistory:{create:{id:f.historyId,fromStatus:'PENDING',toStatus:'PENDING',changedBy:f.customerId,reason:'Owned genuine sandbox fixture; no supplier operation'}}}});}
 });
 if(abort)throw Error('EXECUTION_DEADLINE');phase='financial';const {chromium}=local(resolve(process.env.LOCALAPPDATA||'','npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright'));browser=await chromium.launch({channel:'chrome',headless:false,timeout:15000});if(!browser)throw Error('BROWSER_START_FAILED');
 for(const f of plan.fixtures){
 if(abort)throw Error('EXECUTION_DEADLINE');stage='genuine-'+f.name;
 activeOwnerCase=f.name;activeOwnerStage='initial';const window=new OwnerCaseWindow(Date.now),context=await browser.newContext(),page=await context.newPage();record({kind:'owner-readiness-start',case:f.name,budgetSeconds:300});console.log('OWNER_READY_REQUIRED_'+f.name.toUpperCase());await page.goto(privateOrigin+'/owner',{waitUntil:'domcontentloaded',timeout:15000});await waitCondition(()=>ownerReady.has(f.name),300000,()=>abort);window.ownerReady();window.assertMayInitiate();record({kind:'owner-ready',case:f.name});
 const actor={id:f.customerId,role:'CUSTOMER' as const},input={requestId:f.requestId,address:'Synthetic sandbox address',city:'Dhaka',country:'BD'};
 const initiated=await service.initiate(f.reference,actor,input);if(!initiated.checkoutUrl)throw Error('SESSION_INITIATION_UNRESOLVED');
 const freshPayment=[...scope.payments.values()][0];if(!freshPayment||freshPayment.tranId===retained.incomplete.tranId)throw Error('FRESH_TRANSACTION_ISOLATION_FAILED');
 const before=scope.counts.initiate;await service.initiate(f.reference,actor,input);if(scope.counts.initiate!==before)throw Error('IDEMPOTENCY_DISPATCH_MISMATCH');
 console.log('OWNER_SANDBOX_CHECKOUT_CASE_'+f.name.toUpperCase()+' — complete this synthetic case in the opened browser; do not enter real payment data.');
 context.on('response',response=>{
  const request=response.request();
  if(!request.isNavigationRequest()||request.method()!=='POST'||response.url()!==origin+'/api/v1/payments/sslcommerz/fail'||response.status()!==303)return;
  try{const frame=request.frame();if(frame===frame.page().mainFrame())returnPage=frame.page();}catch{return;}
 });
 await page.goto(initiated.checkoutUrl,{waitUntil:'domcontentloaded',timeout:25000});
 await page.locator('body').waitFor({state:'visible',timeout:15000});activeOwnerStage='checkout';const confirmation=await context.newPage();await confirmation.goto(privateOrigin+'/owner/confirm',{waitUntil:'domcontentloaded',timeout:15000});record({kind:'checkout-visible-awaiting-confirmation',case:f.name,budgetSeconds:300});await waitCondition(()=>checkoutConfirmed.has(f.name),300000,()=>abort);record({kind:'checkout-owner-confirmed',case:f.name});await confirmation.close();await page.bringToFront();
 window.checkoutOpened();record({kind:'checkout-open',case:f.name,deadlineUTC:new Date(Date.now()+window.budgetMs).toISOString()});const warnings=new Set<number>();try{await waitCondition(()=>{const seconds=Math.ceil(window.remaining()/1000);for(const n of [300,60,10])if(seconds<=n&&!warnings.has(n)){warnings.add(n);record({kind:'checkout-countdown',case:f.name,secondsRemaining:seconds});console.log(`CASE_${f.name.toUpperCase()}_SECONDS_REMAINING_${seconds}`);}return !!returnPage&&returned.has(f.name)&&notices.some(n=>n.case===f.name&&n.source===f.name&&n.processed)&&notices.some(n=>n.case===f.name&&n.source==='ipn'&&n.signed&&n.failedStatus&&n.processed);},window.budgetMs,()=>abort);window.finish();}catch(e){record({kind:'case-cleanup-reason',case:f.name,reason:window.cleanupReason(),financialOutcome:'INDETERMINATE'});throw e;}
 if(!returnPage)throw Error('BROWSER_RETURN_NOT_OBSERVED');
 await returnPage.waitForURL(u=>u.origin===privateOrigin&&u.pathname==='/payments/return'&&u.searchParams.get('booking')===f.reference,{waitUntil:'domcontentloaded',timeout:15000});
 await returnPage.screenshot({path:resolve(base,'return-fail.png')});record({kind:'browser-render',case:f.name,title:await returnPage.title(),privateLanding:true});
 const status=async()=>{
  const rows=await prisma.$queryRawUnsafe<Array<{state:{id:string;status:string;captured:boolean}}>>('SELECT state FROM public."GatewayPayment" WHERE "bookingId"=$1',f.bookingId);
  if(rows.length!==1)throw Error('EXACT_PAYMENT_REQUIRED');return rows[0].state;
 };
 let a=await status();
 if(a.status!=='FAILED'&&a.captured===false&&gateway.failedEvidenceSeen){
  const staff=plan.actors.find(u=>u.role==='STAFF')!;
  record({kind:'one-owned-reconciliation-after-confirmed-provider-failure'});
  await service.reconcile(f.reference,{id:staff.id,role:'STAFF'},freshPayment.tranId);a=await status();
 }
 const expected='FAILED';record({kind:'outcome-assertion',case:f.name,expected,observed:a?.status||null,captured:a?.captured??null});if(a?.status!==expected||a.captured!==false)throw Error('GENUINE_OUTCOME_MISMATCH');
 const views=[];for(const role of ['CUSTOMER','STAFF','ADMIN'] as const){const user=role==='CUSTOMER'?plan.actors[0]:plan.actors.find(u=>u.role===role)!;const v=await service.list(f.reference,{id:user.id,role});views.push(v.payments.find(p=>p.id===a.id)?.financialState);}
 if(views.some(v=>v!==expected))throw Error('ROLE_STATE_MISMATCH');
 let isolated=false;try{await service.list(f.reference,{id:plan.actors[1].id,role:'CUSTOMER'});}catch(e){if(!(e instanceof AppError)||e.statusCode!==404)throw e;isolated=true;}if(!isolated)throw Error('OWNERSHIP_ISOLATION_FAILED');
 const booking=await prisma.booking.findUniqueOrThrow({where:{id:f.bookingId},select:{status:true,bookingDetails:true}});if(booking.status!=='PENDING')throw Error('PAID_FULFILLED_BOUNDARY_BROKEN');
 // Repeated notice from the owner harness is replay evidence, never labelled genuine provider IPN.
 const p=[...scope.payments.values()].find(p=>p.fixture===f)!;const eventBefore=await eventCount(prisma,p.id);
 const beforeReplay=scope.counts.query;
 await service.notify(p.tranId,replayValId,f.name);await service.notify(p.tranId,replayValId,f.name);
 const eventAfter=await eventCount(prisma,p.id);if(eventAfter!==eventBefore||scope.counts.query!==beforeReplay)throw Error('DUPLICATE_NOTICE_EFFECT');
 cases.push({case:f.name,status:a.status,captured:a.captured,actualReturn:true,signedIPN:notices.some(n=>n.case===f.name&&n.source==='ipn'&&n.signed&&n.processed),roleConsistency:true,ownershipIsolation:true,bookingStillPending:true,manualReplayNotProviderEvidence:true});record({kind:'case-adjudicated',case:f.name,status:a.status});record({kind:'case-cleanup-reason',case:f.name,reason:window.cleanupReason()});activeOwnerCase='';activeOwnerStage='';await context.close();
 }
 stage='final-fixture-reconciliation';
 }catch(e){const {preflightFailure}=await import('../phase3-db-preflight-diagnostics.js');failure={stage,...preflightFailure(e,stage),code:e instanceof Error&&/^[A-Z0-9_]+$/.test(e.message)?e.message:null};}
 finally{
 abort=true;scope.closed=true;phase='stopped';clearTimeout(timeout);clearInterval(stopWatch);process.removeListener('SIGINT',requestStop);process.removeListener('SIGTERM',requestStop);connectorStopped=await stopOwned(connector);if(browser)await bounded(browser.close(),5000).catch(()=>{failure=failure||{stage:'cleanup',code:'BROWSER_SHUTDOWN_UNCONFIRMED'};});
 await bounded(Promise.allSettled([...tasks]),60000).catch(()=>{failure=failure||{stage:'cleanup',code:'CALLBACK_DRAIN_TIMEOUT'};});
 for(const server of [pub,landing])if(server){server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
 if(baseline){try{await readOnly(prisma,async db=>{
  preservation=JSON.stringify(baseline)===JSON.stringify(await preserve(db as PrismaClient,plan));
  if(!preservation)throw Error('UNRELATED_PRESERVATION_MISMATCH');
  save('retained-postcheck.json',(await verifyRetained(db as PrismaClient,repo)).summary);
  const final=await ownedFinal(db,plan,scope.counts);save('owned-final.json',final);
  if(!failure&&(final.bookings.length!==1||final.bookings[0].status!=='PENDING'||final.passengers.length!==1||final.history.length!==1||final.outbox.length!==0||!Array.isArray(final.payments)||final.payments.length!==1||final.payments[0].status!=='FAILED'||final.payments[0].captured!==false))throw Error('OWNED_FINAL_STATE_MISMATCH');
 });}catch(e){const {preflightFailure}=await import('../phase3-db-preflight-diagnostics.js');failure=failure||preflightFailure(e,'final-preservation');}}
 await prisma.$disconnect().catch(()=>{});delete process.env.SSLCOMMERZ_STORAGE_KEY;delete process.env.SSLCOMMERZ_STORE_PASSWORD;
 const result={passed:!failure&&cases.length===1&&preservation&&connectorStopped,stage,failure,cases,counts:scope.counts,notices,preservation,connectorStopped,oldProviderRequests:0,normalServicesTouched:false,mainCloudAccess:false,refundsExecuted:false,fixturesRetained:true,phase3Accepted:false,nativeEvidence};save('result.json',result);console.log(JSON.stringify(result));process.exitCode=result.passed?0:1;
 }
}
function readOnly<T>(db:PrismaClient,work:(db:Prisma.TransactionClient)=>Promise<T>){
 return db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');return work(tx);},{maxWait:5000,timeout:30000});
}
async function listen(app:express.Express){return new Promise<Server>((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));s.once('error',reject);});}
function portOf(s:Server){const a=s.address();if(!a||typeof a==='string')throw Error('LOOPBACK_PORT_REQUIRED');return a.port;}
function bounded<T>(promise:Promise<T>,ms:number):Promise<T>{return new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('BOUNDED_STAGE_TIMEOUT')),ms);promise.then(v=>{clearTimeout(t);resolve(v);},e=>{clearTimeout(t);reject(e);});});}
async function request(origin:string,path:string,headers:Record<string,string>,body='x=1'){const u=new URL(origin);return new Promise<{status:number;marker:string|undefined;location:string|undefined}>((resolve,reject)=>{const q=(u.protocol==='https:'?https:http).request(origin+path,{method:'POST',...(u.protocol==='https:'?{rejectUnauthorized:true,servername:u.hostname}:{}),headers:{...headers,'content-type':'application/x-www-form-urlencoded','content-length':String(Buffer.byteLength(body))}},r=>{r.resume();r.once('end',()=>resolve({status:r.statusCode||0,marker:typeof r.headers['x-proof-marker']==='string'?r.headers['x-proof-marker']:undefined,location:r.headers.location}));});q.setTimeout(10000,()=>q.destroy(Error('TRANSPORT_TIMEOUT')));q.once('error',()=>reject(Error('TRANSPORT_PREFLIGHT_FAILED')));q.end(body);});}
async function eventCount(db:import('../../src/generated/prisma/client.js').PrismaClient,id:string){const r=await db.$queryRawUnsafe<Array<{count:number}>>('SELECT count(*)::int AS count FROM public."GatewayPaymentEvent" WHERE "paymentId"=$1',id);return r[0].count;}
async function ownedFinal(db:Prisma.TransactionClient,plan:Plan,counts:Record<string,number>){const ids=plan.fixtures.map(f=>f.bookingId),params=ids.map((_,i)=>'$'+(i+1)).join(',');return{counts,bookings:await db.booking.findMany({where:{id:{in:ids}},select:{id:true,referenceNumber:true,status:true}}),passengers:await db.bookingPassenger.findMany({where:{bookingId:{in:ids}},select:{id:true,bookingId:true}}),history:await db.bookingStatusHistory.findMany({where:{bookingId:{in:ids}},select:{id:true,bookingId:true,fromStatus:true,toStatus:true}}),payments:await db.$queryRawUnsafe<Array<{id:string;status:string;captured:boolean}>>(`SELECT id,"bookingId",status,(state->>'captured')::boolean AS captured FROM public."GatewayPayment" WHERE "bookingId" IN (${params})`,...ids),events:await db.$queryRawUnsafe(`SELECT e.id,e."paymentId",e.kind FROM public."GatewayPaymentEvent" e JOIN public."GatewayPayment" p ON p.id=e."paymentId" WHERE p."bookingId" IN (${params})`,...ids),outbox:await db.notificationOutbox.findMany({where:{OR:plan.fixtures.map(f=>({payload:{path:['params','referenceNumber'],equals:f.reference}}))},select:{id:true,idempotencyKey:true,status:true}})};}
if(require.main===module)main().catch(()=>{console.error('STOP: approved genuine run incomplete; preserve evidence; no retry');process.exitCode=1;});
function escapeHTML(s:string){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
async function waitCondition(predicate:()=>boolean,ms:number,stopped:()=>boolean){const end=Date.now()+ms;await new Promise<void>((resolve,reject)=>{const t=setInterval(()=>{try{if(stopped())throw Error('OWNER_STOP_OR_RUN_DEADLINE');if(predicate()){clearInterval(t);resolve();}else if(Date.now()>=end)throw Error('TIMEOUT_INDETERMINATE');}catch(e){clearInterval(t);reject(e);}},500);});}




