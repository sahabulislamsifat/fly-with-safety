/** One owner-approved genuine sandbox run. Never import this module from normal startup. */
import { readFileSync,writeFileSync,appendFileSync,existsSync,mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash,randomBytes } from 'node:crypto';
import { spawn,type ChildProcess } from 'node:child_process';
import express from 'express';
import {createRequire} from 'node:module';
import type {Browser,Page} from 'C:/Users/sahab/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright';
const local=createRequire(__filename);
import type { Server } from 'node:http';
import { Scope,OwnedStore,type Plan } from '../phase3-failed-uat/scope.js';
import { assertLocalURL,preflight,preserve } from '../phase3-negative-v01/preflight.js';
import {AppError} from '../../src/utils/errors.js';
import type {PrismaClient, Prisma} from '../../src/generated/prisma/client.js';
import {createIsolatedCallbackLimiter} from '../phase3-negative-v01/callback-limit.js';
import {failedCallbacks, callbackRoute, FirstStop, WireBudget} from '../phase3-failed-uat-v02/callbacks.js';
import {FailedGateway,queryDiagnostics} from '../phase3-failed-uat-v02/query-diagnostics.js';
import {verifyRetainedCloudflare} from './retained-cloudflare.js';
import {CloudflareForwarding,cloudflareAdmission,cloudflareArgs,cloudflareOriginReader} from './cloudflare.js';
import {OwnerCaseWindow} from '../phase3-negative-v01/case-window.js';
import {verifyRetained} from '../phase3-negative-v01/retained.js';
import {checkoutStopReason,failedOwnerPage,failedOwnerReady} from './owner-action.js';
const repo=resolve(__dirname,'../../..'),base=resolve(repo,'output/phase3/failed-uat-cloudflare-20261106-02');
const {stopOwned}=local('../../../output/phase3/localhost-run-smoke-v03/ssh-lifecycle.cjs');
const {waitForDns}=local('../../../output/phase3/callback-tunnel-20261103-06/readiness.cjs');
const expectedBinary='2493dbc168923bb3e59e5e7716f71deced92992eea9acd6e9d74f84ac7751343';
const save=(name:string,data:object)=>writeFileSync(resolve(base,name),JSON.stringify(data,null,2),{flag:'wx'});
const record=(e:object)=>appendFileSync(resolve(base,'ledger.jsonl'),JSON.stringify({at:new Date().toISOString(),...e})+'\n');
async function main(){
 if (!existsSync(resolve(base,'fixture-plan.json'))) throw Error('OFFLINE_DRAFT_ONLY');
 if(process.argv[2]!=='--owner-approved-failed-uat-cloudflare-v02'||process.env.PHASE3_FAILED_UAT_CLOUDFLARE_V02_APPROVED!=='true')throw Error('EXECUTION_NOT_APPROVED');
 const binary=process.argv[3];if(!binary||createHash('sha256').update(readFileSync(binary)).digest('hex')!==expectedBinary)throw Error('CLOUDFLARED_BINARY_HASH_MISMATCH');
 assertLocalURL(process.env.DATABASE_URL||'');if(process.env.DIRECT_URL!==process.env.DATABASE_URL)throw Error('URL_PARITY_REQUIRED');
 if(existsSync(resolve(base,'attempt.json')))throw Error('CONSUMED_NO_RETRY');
 const plan=JSON.parse(readFileSync(resolve(base,'fixture-plan.json'),'utf8').replace(/^\uFEFF/,'')) as Plan;
 const scope=new Scope(plan,record);
 const dotenv=local('../../node_modules/dotenv');const privateEnv=dotenv.parse(readFileSync(resolve(repo,'server/.env')));
 if(privateEnv.SSLCOMMERZ_SANDBOX!=='true'||!privateEnv.SSLCOMMERZ_STORE_ID||!privateEnv.SSLCOMMERZ_STORE_PASSWORD)throw Error('PRIVATE_SANDBOX_CONFIG_MISSING');
 Object.assign(process.env,{NODE_ENV:'development',EMAIL_DELIVERY_ENABLED:'false',SSLCOMMERZ_ENABLED:'true',SSLCOMMERZ_SANDBOX:'true',SSLCOMMERZ_SCHEMA_VERIFIED:'true',SSLCOMMERZ_REFUNDS_APPROVED:'false',SSLCOMMERZ_STORE_ID:privateEnv.SSLCOMMERZ_STORE_ID,SSLCOMMERZ_STORE_PASSWORD:privateEnv.SSLCOMMERZ_STORE_PASSWORD,SSLCOMMERZ_STORAGE_KEY:randomBytes(32).toString('base64'),SSLCOMMERZ_API_BASE_URL:'https://sandbox.sslcommerz.com'});
 save('attempt.json',{at:new Date().toISOString(),syntheticOnly:true,genuineProviderRequested:true});
 const {PrismaClient}=await import('../../src/generated/prisma/client.js'),{PrismaPg}=await import('@prisma/adapter-pg');const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000,statement_timeout:10000,query_timeout:15000,max:2})});let connector:ChildProcess|undefined,pub:Server|undefined,landing:Server|undefined,origin:string|undefined,nativeEvidence:object|undefined,browser:Browser|undefined,phase:'probe'|'financial'|'stopped'='probe',failure:object|null=null,stage='db-readonly-preflight',baseline:unknown,financialRouter:express.Router|undefined;
 const notices:Array<{case:string;source:string;signed:boolean;processed:boolean;failedStatus:boolean}>=[],returned=new Set<string>(),admittedRequests=new WeakSet<object>(),ownerReady=new Set<string>();let activeOwnerCase='',activeOwnerStage='',privateOrigin='';let returnPage:Page|undefined,replayValId:string|undefined;const ownerNonce=randomBytes(32).toString('hex');
 const cases:Array<object>=[];const tasks=new Set<Promise<unknown>>();let abort=false,connectorStopped=true,preservation=false;
 let forwarding:CloudflareForwarding|undefined, closingConnector=false, watchTimer:ReturnType<typeof setTimeout>|undefined, watchCheck:Promise<void>|undefined;
 const stop=new FirstStop(),wire=new WireBudget(plan.caps.callbacks+plan.caps.deniedRequests);let checkoutClosed=false;
 const abortTransport=new AbortController();
 const requestStop=(code:string)=>{if(!stop.set(code))return;record({kind:'stop',stage,code});abort=true;scope.closed=true;phase='stopped';clearTimeout(watchTimer);forwarding?.close();abortTransport.abort();};
 const startWatch=()=>{if(abort)return;watchTimer=setTimeout(()=>{watchCheck=forwarding!.check('CHECKOUT_WATCH').then(startWatch,()=>{});},30000);};
 const timeout=setTimeout(()=>requestStop('RUN_DEADLINE'),1980000),stopWatch=setInterval(()=>{if(existsSync(resolve(base,'stop.request')))requestStop('OWNER_STOP_FILE');},500);
 const sigint=()=>requestStop('SIGINT'),sigterm=()=>requestStop('SIGTERM');
 process.once('SIGINT',sigint);process.once('SIGTERM',sigterm);
 try{
 const retained=await readOnly(prisma,async db=>{
  save('readonly-preflight.json',await preflight(db as PrismaClient,plan,repo));
  const retained=await verifyRetained(db as PrismaClient,repo);const previous=await verifyRetainedCloudflare(db,repo);save('retained-preflight.json',{...retained.summary,priorFailedPreserved:true,...previous});
  stage='db-protected-snapshot';baseline=await preserve(db as PrismaClient,plan);JSON.stringify(baseline);
  save('preservation-ready.json',{serializable:true,protectedSnapshotInMemoryOnly:true,includesGenuineSuccess:true,oldProviderRequests:0});return retained;
 });
 scope.protectRetainedTransaction(retained.incomplete.tranId);
 const publicApp=express();publicApp.disable('x-powered-by');
 publicApp.use((req,res,next)=>{
  if(phase==='stopped')return res.status(404).end();
  const transportNonce=forwarding?.receive(req);
  if(transportNonce){res.setHeader('x-fws-uat-transport',transportNonce);req.resume();return res.status(204).end();}
  if(phase==='probe')return res.status(404).end();
  const route=callbackRoute(req.url),admitted=cloudflareAdmission(req);
  if(!wire.admit()){requestStop('CALLBACK_WIRE_CAP');return res.status(429).end();}
  if(!admitted||route==='OTHER'||route==='success'||route==='cancel'){
   try{scope.reserve('deniedRequests');}catch{requestStop('DENIED_REQUEST_CAP');return res.status(429).end();}
   record({kind:'callback-rejected',route,reason:admitted?'OUT_OF_CASE_ROUTE':'INGRESS_GUARD'});return res.status(404).end();
  }
  admittedRequests.add(req);next();
 });
 publicApp.use('/api/v1',(req,res,next)=>financialRouter?financialRouter(req,res,next):res.status(503).end());
 publicApp.use((_req,res)=>res.status(404).end());
 publicApp.use((e:unknown,req:express.Request,res:express.Response,_next:express.NextFunction)=>{void _next;record({kind:'callback-error',route:callbackRoute(req.originalUrl),reason:'FORM_OR_HANDLER_ERROR'});res.status(400).json({error:'CALLBACK_REJECTED'});});
 pub=await listen(publicApp);const port=portOf(pub);if([3000,5000].includes(port))throw Error('NORMAL_PORT_FORBIDDEN');
 stage='cloudflare-allocation';
 const profile=resolve(base,'connector-profile');mkdirSync(profile);
 const env=Object.fromEntries(['SystemRoot','WINDIR','ComSpec','TEMP','TMP'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 Object.assign(env,{USERPROFILE:profile,HOME:profile,APPDATA:profile,LOCALAPPDATA:profile});
 connector=spawn(binary,cloudflareArgs(port,resolve(base,'connector.yml')),{env,cwd:profile,windowsHide:true,stdio:['ignore','pipe','pipe']});
 const connectorState={pid:connector.pid??null,exitCode:null as number|null,signal:null as string|null};nativeEvidence=connectorState;
 save('connector-process.json',{pid:connector.pid??null,loopbackPort:port,owned:true});
 await bounded(new Promise<void>((done,reject)=>{
  const parse=cloudflareOriginReader();const onData=(chunk:Buffer)=>{try{const assigned=parse(chunk);if(!origin&&assigned){origin=assigned;forwarding=new CloudflareForwarding(origin,requestStop,record);record({kind:'cloudflare-origin-registered',https:true});done();}}catch{requestStop('CLOUDFLARE_ORIGIN_CHANGED_OR_INVALID');reject(Error('CLOUDFLARE_ORIGIN_CHANGED_OR_INVALID'));}};
  connector!.stdout!.on('data',onData);connector!.stderr!.on('data',onData);
  connector!.once('error',()=>{if(!closingConnector)requestStop('CLOUDFLARED_PROCESS_ERROR');reject(Error('CLOUDFLARED_PROCESS_ERROR'));});
  connector!.once('exit',(code,signal)=>{connectorState.exitCode=code;connectorState.signal=signal;if(!closingConnector)requestStop('CLOUDFLARED_EXIT');reject(Error('CLOUDFLARED_EXIT'));});
 }),60000);
 if(abort||!origin)throw Error('PUBLIC_ORIGIN_UNAVAILABLE');
 stage='cloudflare-dns-readiness';const dns=await waitForDns(origin,{signal:abortTransport.signal,journal:(kind:string,data:object)=>record({kind,...data})});
 if(!dns.ready)throw Error('CLOUDFLARE_DNS_NOT_READY');
 stage='forwarding-before-fixtures';await forwarding!.check('BEFORE_FIXTURES');
 save('transport-preflight.json',{passed:true,dnsReady:true,positiveChecks:1,interactiveChallenge:false});
 stage='private-landing-and-config';
 const privateApp=express();privateApp.disable('x-powered-by');privateApp.use((req,res,next)=>{if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||'')||req.get('host')!==new URL(privateOrigin||'http://127.0.0.1').host)return res.status(404).end();res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; form-action 'self'; frame-ancestors 'none'");next();});
 privateApp.use(express.urlencoded({extended:false,limit:'2kb',parameterLimit:3}));
 privateApp.get('/owner',(_req,res)=>{if(activeOwnerStage!=='initial'||activeOwnerCase!=='fail')return res.status(404).end();res.type('html').send(failedOwnerPage(ownerNonce));});
 privateApp.post('/owner/ready',(req,res)=>{if(!failedOwnerReady({peer:req.socket.remoteAddress||'',host:req.get('host')||'',origin:req.get('origin')||'',nonce:req.body?.nonce,case:req.body?.case,action:req.body?.action},{origin:privateOrigin,nonce:ownerNonce,activeCase:activeOwnerCase,stopped:abort},activeOwnerStage))return res.status(403).end();ownerReady.add(activeOwnerCase);activeOwnerStage='initiating';res.type('html').send('<title>FAILED action confirmed</title><p>Opening the FAILED-only sandbox Checkout. Press Failed on Dummy OTP once. Do not cancel.</p>');});
 privateApp.get('/payments/return',(req,res)=>{const ref=typeof req.query.booking==='string'?req.query.booking:'';const f=plan.fixtures.find(f=>f.reference===ref);if(!f)return res.status(404).end();returned.add(f.name);record({kind:'browser-return-landing',case:f.name});res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");res.type('html').send('<!doctype html><title>Sandbox return</title><p>Provider return observed. Financial status requires server validation. No supplier fulfillment.</p>');});
 landing=await listen(privateApp);privateOrigin=`http://127.0.0.1:${portOf(landing)}`;process.env.FRONTEND_URL=privateOrigin;process.env.SSLCOMMERZ_CALLBACK_BASE_URL=origin;
 const {gatewayConfig,SSLCommerzClient}=await import('../../src/payments/sslcommerz.js');const config=gatewayConfig();
 const {PrismaPaymentStore}=await import('../../src/payments/payment-store.js');const {PaymentService}=await import('../../src/payments/payment.service.js');
 const scopedDB=scope.database(prisma),gateway=new FailedGateway(new SSLCommerzClient(config,queryDiagnostics(config,scope,record)),scope,requestStop),store=new OwnedStore(new PrismaPaymentStore(scopedDB),scope),service=new PaymentService(store,gateway,config);
 financialRouter=failedCallbacks(service,config,createIsolatedCallbackLimiter(admittedRequests),{
  lookup:tranId=>[...scope.payments.values()].find(p=>p.tranId===tranId),
  reserve:()=>{try{scope.reserve('callbacks');}catch{requestStop('CALLBACK_WORK_CAP');throw Error('CALLBACK_WORK_CAP');}},
  rejected:()=>{try{scope.reserve('deniedRequests');}catch{requestStop('DENIED_REQUEST_CAP');}},
  record,track:task=>{tasks.add(task);void task.then(()=>tasks.delete(task),()=>tasks.delete(task));},
  terminal:(route,valId)=>{if(route==='fail'){checkoutClosed=true;replayValId=valId;}},
  acknowledged:route=>{notices.push({case:'fail',source:route,signed:true,failedStatus:true,processed:true});},
  stop:requestStop,
 });
 assertLocalURL(process.env.DATABASE_URL||'');if(process.env.DIRECT_URL!==process.env.DATABASE_URL)throw Error('URL_PARITY_REQUIRED');
 if(abort)throw Error('EXECUTION_DEADLINE');stage='owned-fixture-create';
 await scopedDB.$transaction(async tx=>{const clock=await tx.$queryRawUnsafe<Array<{now:Date}>>("SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now"),now=clock[0].now;
 for(const f of plan.fixtures){const owner=plan.actors.find(a=>a.id===f.customerId)!;await tx.booking.create({data:{id:f.bookingId,referenceNumber:f.reference,userId:f.customerId,status:'PENDING',customerName:'Synthetic Sandbox Traveller',customerEmail:owner.email,customerPhone:'01000000000',totalPrice:f.amount,currency:'BDT',bookingDetails:{integrationFixture:{phase:3,genuineSandbox:true,case:f.name},commercial:{version:1,revision:2,quotes:[{id:f.quoteId,amount:f.amount,currency:'BDT',description:'Synthetic sandbox, no supplier fulfillment',createdAt:now.toISOString(),acceptedAt:now.toISOString(),validUntil:new Date(+now+7200000).toISOString()}],payments:[],receipts:[]}},passengers:{create:{id:f.passengerId,firstName:'Synthetic',lastName:'Sandbox',passengerType:'adult'}},statusHistory:{create:{id:f.historyId,fromStatus:'PENDING',toStatus:'PENDING',changedBy:f.customerId,reason:'Owned genuine sandbox fixture; no supplier operation'}}}});}
 });
 if(abort)throw Error('EXECUTION_DEADLINE');phase='financial';const {chromium}=local(resolve(process.env.LOCALAPPDATA||'','npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright'));browser=await chromium.launch({channel:'chrome',headless:false,timeout:15000});if(!browser)throw Error('BROWSER_START_FAILED');
 for(const f of plan.fixtures){
 if(abort)throw Error('EXECUTION_DEADLINE');stage='genuine-'+f.name;
 activeOwnerCase=f.name;activeOwnerStage='initial';const window=new OwnerCaseWindow(Date.now),context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();record({kind:'owner-readiness-start',case:f.name,budgetSeconds:300});console.log('OWNER_READY_REQUIRED_'+f.name.toUpperCase());await page.goto(privateOrigin+'/owner',{waitUntil:'domcontentloaded',timeout:15000});await waitCondition(()=>ownerReady.has(f.name),300000,()=>abort);window.ownerReady();window.assertMayInitiate();record({kind:'owner-ready',case:f.name,action:'FAILED_ONLY_DUMMY_OTP'});
 const actor={id:f.customerId,role:'CUSTOMER' as const},input={requestId:f.requestId,address:'Synthetic sandbox address',city:'Dhaka',country:'BD'};
 if(abort)throw Error('EXECUTION_STOPPED');
 startWatch();
 const initiated=await service.initiate(f.reference,actor,input);if(!initiated.checkoutUrl)throw Error('SESSION_INITIATION_UNRESOLVED');
 const freshPayment=[...scope.payments.values()][0];if(!freshPayment||freshPayment.tranId===retained.incomplete.tranId)throw Error('FRESH_TRANSACTION_ISOLATION_FAILED');
 const before=scope.counts.initiate;await service.initiate(f.reference,actor,input);if(scope.counts.initiate!==before)throw Error('IDEMPOTENCY_DISPATCH_MISMATCH');
 await context.route('**/*',route=>checkoutClosed&&new URL(route.request().url()).origin!==privateOrigin?route.abort():route.continue());
 console.log('OWNER_SANDBOX_CHECKOUT_CASE_'+f.name.toUpperCase()+' — complete this synthetic case in the opened browser; do not enter real payment data.');
 context.on('response',response=>{
  const request=response.request();
  const url=new URL(response.url()),route=url.origin===origin?callbackRoute(url.pathname):'OTHER';
  if(request.isNavigationRequest()){
   if(route!=='OTHER')record({kind:'browser-callback-response',route,method:request.method()==='POST'?'POST':'OTHER',status:response.status()});
   const unexpected=checkoutStopReason(response.url(),origin!,request.method(),response.status());if(unexpected)requestStop(unexpected);
  }
  if(!request.isNavigationRequest()||request.method()!=='POST'||response.url()!==origin+'/api/v1/payments/sslcommerz/fail'||response.status()!==303)return;
  try{const frame=request.frame();if(frame===frame.page().mainFrame())returnPage=frame.page();}catch{return;}
 });
 context.on('requestfailed',request=>{
  const url=new URL(request.url()),route=url.origin===origin?callbackRoute(url.pathname):'OTHER';
  if(request.isNavigationRequest()&&route!=='OTHER')record({kind:'browser-callback-network-failure',route,method:request.method()==='POST'?'POST':'OTHER'});
 });
 await page.goto(initiated.checkoutUrl,{waitUntil:'domcontentloaded',timeout:25000});
 await page.locator('body').waitFor({state:'visible',timeout:15000});if(abort)throw Error('EXECUTION_STOPPED');activeOwnerStage='working';await page.bringToFront();
 window.checkoutOpened();record({kind:'checkout-open',case:f.name,deadlineUTC:new Date(Date.now()+window.budgetMs).toISOString()});const warnings=new Set<number>();try{await waitCondition(()=>{const seconds=Math.ceil(window.remaining()/1000);for(const n of [300,60,10])if(seconds<=n&&!warnings.has(n)){warnings.add(n);record({kind:'checkout-countdown',case:f.name,secondsRemaining:seconds});console.log(`CASE_${f.name.toUpperCase()}_SECONDS_REMAINING_${seconds}`);}return !!returnPage&&returned.has(f.name)&&notices.some(n=>n.case===f.name&&n.source===f.name&&n.processed)&&notices.some(n=>n.case===f.name&&n.source==='ipn'&&n.signed&&n.failedStatus&&n.processed);},window.budgetMs,()=>abort);window.finish();}catch(e){record({kind:'case-cleanup-reason',case:f.name,reason:stop.code??window.cleanupReason(),financialOutcome:'INDETERMINATE'});throw e;}
 clearTimeout(watchTimer);await watchCheck;clearTimeout(watchTimer);
 if(abort)throw Error('EXECUTION_STOPPED');
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
 }catch(e){const {preflightFailure}=await import('../phase3-db-preflight-diagnostics.js');failure={stage,...preflightFailure(e,stage),code:stop.code??(e instanceof Error&&/^[A-Z0-9_]+$/.test(e.message)?e.message:null)};}
 finally{
 abort=true;scope.closed=true;phase='stopped';clearTimeout(watchTimer);forwarding?.close();closingConnector=true;clearTimeout(timeout);clearInterval(stopWatch);process.removeListener('SIGINT',sigint);process.removeListener('SIGTERM',sigterm);connectorStopped=await stopOwned(connector);if(browser)await bounded(browser.close(),5000).catch(()=>{failure=failure||{stage:'cleanup',code:'BROWSER_SHUTDOWN_UNCONFIRMED'};});
 await bounded(Promise.allSettled([...tasks]),60000).catch(()=>{failure=failure||{stage:'cleanup',code:'CALLBACK_DRAIN_TIMEOUT'};});
 for(const server of [pub,landing])if(server){server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
 if(baseline){try{await readOnly(prisma,async db=>{
  preservation=JSON.stringify(baseline)===JSON.stringify(await preserve(db as PrismaClient,plan));
  if(!preservation)throw Error('UNRELATED_PRESERVATION_MISMATCH');
  const retained=await verifyRetained(db as PrismaClient,repo);const previous=await verifyRetainedCloudflare(db,repo);
  save('retained-postcheck.json',{...retained.summary,priorFailedPreserved:true,...previous});
  const final=await ownedFinal(db,plan,scope.counts);
  if(final.payments.some(p=>!/^FWS[a-f0-9]{26}$/.test(p.tranId)))throw Error('OWNED_MERCHANT_ID_FORMAT');
  save('owned-final.json',final);
  if(!failure&&(final.bookings.length!==1||final.bookings[0].status!=='PENDING'||final.passengers.length!==1||final.history.length!==1||final.outbox.length!==0||!Array.isArray(final.payments)||final.payments.length!==1||final.payments[0].status!=='FAILED'||final.payments[0].captured!==false))throw Error('OWNED_FINAL_STATE_MISMATCH');
 });}catch(e){const {preflightFailure}=await import('../phase3-db-preflight-diagnostics.js');failure=failure||preflightFailure(e,'final-preservation');}}
 await prisma.$disconnect().catch(()=>{});delete process.env.SSLCOMMERZ_STORAGE_KEY;delete process.env.SSLCOMMERZ_STORE_PASSWORD;
 if(!failure&&stop.code)failure={stage,code:stop.code};
 const result={passed:!failure&&cases.length===1&&preservation&&connectorStopped,stage,failure,cases,counts:{...scope.counts,wireRequests:wire.count},notices,preservation,connectorStopped,oldProviderRequests:0,normalServicesTouched:false,mainCloudAccess:false,refundsExecuted:false,fixturesRetained:true,phase3Accepted:false,nativeEvidence};save('result.json',result);console.log(JSON.stringify(result));process.exitCode=result.passed?0:1;
 }
}
function readOnly<T>(db:PrismaClient,work:(db:Prisma.TransactionClient)=>Promise<T>){
 return db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');return work(tx);},{maxWait:5000,timeout:30000});
}
async function listen(app:express.Express){return new Promise<Server>((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));s.once('error',reject);});}
function portOf(s:Server){const a=s.address();if(!a||typeof a==='string')throw Error('LOOPBACK_PORT_REQUIRED');return a.port;}
function bounded<T>(promise:Promise<T>,ms:number):Promise<T>{return new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('BOUNDED_STAGE_TIMEOUT')),ms);promise.then(v=>{clearTimeout(t);resolve(v);},e=>{clearTimeout(t);reject(e);});});}
async function eventCount(db:import('../../src/generated/prisma/client.js').PrismaClient,id:string){const r=await db.$queryRawUnsafe<Array<{count:number}>>('SELECT count(*)::int AS count FROM public."GatewayPaymentEvent" WHERE "paymentId"=$1',id);return r[0].count;}
async function ownedFinal(db:Prisma.TransactionClient,plan:Plan,counts:Record<string,number>){const ids=plan.fixtures.map(f=>f.bookingId),params=ids.map((_,i)=>'$'+(i+1)).join(',');return{counts,bookings:await db.booking.findMany({where:{id:{in:ids}},select:{id:true,referenceNumber:true,status:true}}),passengers:await db.bookingPassenger.findMany({where:{bookingId:{in:ids}},select:{id:true,bookingId:true}}),history:await db.bookingStatusHistory.findMany({where:{bookingId:{in:ids}},select:{id:true,bookingId:true,fromStatus:true,toStatus:true}}),payments:await db.$queryRawUnsafe<Array<{id:string;tranId:string;status:string;captured:boolean}>>(`SELECT id,"bookingId","tranId",status,(state->>'captured')::boolean AS captured FROM public."GatewayPayment" WHERE "bookingId" IN (${params})`,...ids),events:await db.$queryRawUnsafe(`SELECT e.id,e."paymentId",e.kind FROM public."GatewayPaymentEvent" e JOIN public."GatewayPayment" p ON p.id=e."paymentId" WHERE p."bookingId" IN (${params})`,...ids),outbox:await db.notificationOutbox.findMany({where:{OR:plan.fixtures.map(f=>({payload:{path:['params','referenceNumber'],equals:f.reference}}))},select:{id:true,idempotencyKey:true,status:true}})};}
if(require.main===module)main().catch(()=>{console.error('STOP: approved genuine run incomplete; preserve evidence; no retry');process.exitCode=1;});
async function waitCondition(predicate:()=>boolean,ms:number,stopped:()=>boolean){const end=Date.now()+ms;await new Promise<void>((resolve,reject)=>{const t=setInterval(()=>{try{if(stopped())throw Error('OWNER_STOP_OR_RUN_DEADLINE');if(predicate()){clearInterval(t);resolve();}else if(Date.now()>=end)throw Error('TIMEOUT_INDETERMINATE');}catch(e){clearInterval(t);reject(e);}},500);});}




