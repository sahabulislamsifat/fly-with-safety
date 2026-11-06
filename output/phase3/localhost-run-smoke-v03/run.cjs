'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),https=require('node:https'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {accept,sshArgs}=require('../localhost-run-smoke/transport.cjs'),{keyLine}=require('../localhost-run-smoke/trust.cjs');
const {reader}=require('./discovery.cjs');
const {sshEnvironment}=require('../localhost-run-smoke/ssh-environment.cjs');
const {diagnostics,stopOwned}=require('./ssh-lifecycle.cjs');
const paths=require('../isolated-callback/boundary.cjs').paths;
const save=(n,v)=>fs.writeFileSync(path.join(__dirname,n),JSON.stringify(v,null,2),{flag:'wx'});
async function main(){
 if(process.argv[2]!=='--owner-approved-localhost-run-smoke-v03')throw Error('APPROVAL_REQUIRED');
 const [ssh,scan,keygen,pw]=process.argv.slice(3);for(const p of [ssh,scan,keygen,pw])if(!path.isAbsolute(p))throw Error('ABSOLUTE_DEPENDENCIES_REQUIRED');
 const {chromium}=require(pw);
 save('attempt.json',{at:new Date().toISOString(),trust:'OWNER_APPROVED_TOFU_SYNTHETIC_ONLY'});
 let nativeEvidence=null,stage='read-only-pinned-trust',connector,server,browser,context,activeRequest,origin=null,timer,aborted=false,failure=null,stopped=true;const checks=[],receipts=[];const marker=crypto.randomBytes(24).toString('hex');
 const budget=new Promise((_,reject)=>{timer=setTimeout(()=>{aborted=true;activeRequest?.destroy();void context?.close().catch(()=>{});reject(Error('PUBLIC_BUDGET_EXCEEDED'));},180000);});
 try{await Promise.race([(async()=>{
 const known=path.resolve(__dirname,'../localhost-run-smoke/known_hosts');keyLine(fs.readFileSync(known,'utf8'));
 save('trust.json',{trust:'EXISTING_TOFU_PIN_REUSED_READONLY',syntheticOnly:true});
 stage='listener-start';
 server=http.createServer((req,res)=>{
 const admitted=accept(req,origin),id=req.headers['x-proof-id'];receipts.push({pathMatched:paths.includes(req.url),method:req.method==='POST'?'POST':'OTHER',admitted,id:typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id)?id:null});
 req.resume();res.setHeader('Cache-Control','no-store');res.setHeader('x-proof-marker',marker);
 if(!admitted){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; frame-ancestors 'none'"});res.end('<!doctype html><title>Synthetic callback proof</title><p>Callback received. No payment processed.</p>');
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const port=server.address().port;const args=sshArgs(port,known);
 if(aborted)throw Error('PUBLIC_BUDGET_EXCEEDED');
 stage='ssh-startup-and-readiness';
 connector=spawn(ssh,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],env:sshEnvironment(process.env)});
 nativeEvidence=diagnostics(connector);
 await new Promise((resolve,reject)=>{const consume=reader();connector.stdout.on('data',chunk=>{try{for(const found of consume(chunk)){if(!origin){origin=found;save('assigned-origin.json',{origin,source:'ALLOCATION_LABELLED_STDOUT',originVerified:false});resolve();}}}catch(e){reject(e);}});connector.once('error',()=>reject(Error('SSH_START_FAILED')));connector.once('exit',()=>reject(Error('SSH_EXIT_BEFORE_READINESS')));});
 stage='public-callback-and-deny-checks';
 for(const [method,p,status] of [...paths.map(p=>['POST',p,200]),['POST','/api/v1/auth/login',404],['GET',paths[0],404]]){
 if(aborted)throw Error('PUBLIC_BUDGET_EXCEEDED');const id=crypto.randomUUID();
 const r=await new Promise((resolve,reject)=>{const q=https.request(origin+p,{method,rejectUnauthorized:true,servername:new URL(origin).hostname,headers:{'content-type':'application/x-www-form-urlencoded','content-length':'3','x-proof-id':id}},r=>{r.resume();r.once('end',()=>resolve({status:r.statusCode,marker:r.headers['x-proof-marker']===marker}));});activeRequest=q;q.setTimeout(10000,()=>q.destroy(Error('REQUEST_TIMEOUT')));q.once('error',()=>reject(Error('HTTPS_REQUEST_FAILED')));q.end('x=1');});
 const own=receipts.find(x=>x.id===id);const ok=r.status===status&&r.marker&&!!own&&own.admitted===(status===200);checks.push({method,path:p,...r,originMatched:!!own,passed:ok});if(!ok)throw Error('PUBLIC_BOUNDARY_MISMATCH');
 }
 stage='browser-form-post';
 browser=await chromium.launch({channel:'chrome',headless:false,timeout:15000});if(aborted)throw Error('PUBLIC_BUDGET_EXCEEDED');context=await browser.newContext({serviceWorkers:'block'});const page=await context.newPage();
 await page.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===origin&&u.pathname===paths[0]&&!u.search?route.continue():route.abort();});
 await page.setContent('<form method="post"><input name="x" value="1"></form>');await page.locator('form').evaluate((form,url)=>form.action=url,origin+paths[0]);
 const before=receipts.length;
 const [response]=await Promise.all([page.waitForNavigation({waitUntil:'load',timeout:20000}),page.locator('form').evaluate(form=>form.submit())]);
 const headers=response?await response.allHeaders():{};const observed=receipts.slice(before).some(r=>r.admitted&&r.method==='POST'&&r.pathMatched);
 const body=await page.locator('body').innerText();const ok=response?.status()===200&&response.request().method()==='POST'&&headers['x-proof-marker']===marker&&observed&&body.includes('No payment processed.');
 await page.screenshot({path:path.join(__dirname,'browser.png'),fullPage:false});checks.push({method:'BROWSER_FORM_POST',status:response?.status(),originMatched:observed,marker:headers['x-proof-marker']===marker,rendered:body.includes('No payment processed.'),passed:ok});if(!ok)throw Error('BROWSER_POST_BLOCKED');
 })(),budget]);}catch(e){failure=/^[A-Z0-9_]+$/.test(e.message)?e.message:'PROOF_INCOMPLETE';}
 finally{aborted=true;clearTimeout(timer);activeRequest?.destroy();await context?.close().catch(()=>{});await browser?.close().catch(()=>{});
 nativeEvidence&&(nativeEvidence.cleanupRequested=!!connector&&connector.exitCode===null&&connector.signalCode===null);
 stopped=await stopOwned(connector);
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 const result={passed:!failure&&stopped&&checks.length===7&&checks.every(c=>c.passed),failure,stage,nativeEvidence,checks,pass:checks.filter(c=>c.passed).length,fail:checks.filter(c=>!c.passed).length,unexecuted:7-checks.length,connectorStopped:stopped,trust:'TOFU_SYNTHETIC_ONLY',normalServicesTouched:false,databaseAccess:false,providerCalls:0,paymentAcceptance:false};save('result.json',result);console.log(JSON.stringify(result));process.exitCode=result.passed?0:1;
 }
}
if(require.main===module)main().catch(()=>{console.error('STOP: preserve evidence, no retry');process.exitCode=1;});
