'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),https=require('node:https'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {accept,sshArgs}=require('./transport.cjs'),{keyLine,discover}=require('./trust.cjs');
const paths=require('../isolated-callback/boundary.cjs').paths;
const save=(n,v)=>fs.writeFileSync(path.join(__dirname,n),JSON.stringify(v,null,2),{flag:'wx'});
async function main(){
 if(process.argv[2]!=='--owner-approved-localhost-run-smoke')throw Error('APPROVAL_REQUIRED');
 const [ssh,scan,keygen,pw]=process.argv.slice(3);for(const p of [ssh,scan,keygen,pw])if(!path.isAbsolute(p))throw Error('ABSOLUTE_DEPENDENCIES_REQUIRED');
 const {chromium}=require(pw);
 save('attempt.json',{at:new Date().toISOString(),trust:'OWNER_APPROVED_TOFU_SYNTHETIC_ONLY'});
 let connector,server,browser,context,activeRequest,origin=null,timer,aborted=false,failure=null,stopped=true;const checks=[],receipts=[];const marker=crypto.randomBytes(24).toString('hex');
 async function native(exe,args){return new Promise((resolve,reject)=>{const c=spawn(exe,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='';const t=setTimeout(()=>{c.kill();reject(Error('NATIVE_TIMEOUT'));},15000);c.stdout.on('data',b=>{out=(out+b).slice(0,16384);});c.stderr.on('data',b=>{err=(err+b).slice(0,2048);});c.once('error',()=>{clearTimeout(t);reject(Error('NATIVE_START_FAILED'));});c.once('exit',code=>{clearTimeout(t);code===0?resolve(out):reject(Error('NATIVE_REJECTED'));});});}
 const budget=new Promise((_,reject)=>{timer=setTimeout(()=>{aborted=true;activeRequest?.destroy();void context?.close().catch(()=>{});reject(Error('PUBLIC_BUDGET_EXCEEDED'));},180000);});
 try{await Promise.race([(async()=>{
 // Keyscan is TOFU acquisition only, not independently authenticated identity.
 const known=path.join(__dirname,'known_hosts');if(fs.existsSync(known))throw Error('EXISTING_TRUST_NO_REPLACE');
 const key=keyLine(await native(scan,['-T','10','-t','ed25519','localhost.run']));fs.writeFileSync(known,key,{flag:'wx'});
 const fp=await native(keygen,['-lf',known,'-E','sha256']);const fingerprint=fp.match(/SHA256:[A-Za-z0-9+/]+/);if(!fingerprint)throw Error('HOST_FINGERPRINT_MISSING');
 save('trust.json',{trust:'TOFU_NOT_INDEPENDENTLY_AUTHENTICATED',fingerprint:fingerprint[0],syntheticOnly:true});
 server=http.createServer((req,res)=>{
 const admitted=accept(req,origin),id=req.headers['x-proof-id'];receipts.push({pathMatched:paths.includes(req.url),method:req.method==='POST'?'POST':'OTHER',admitted,id:typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id)?id:null});
 req.resume();res.setHeader('Cache-Control','no-store');res.setHeader('x-proof-marker',marker);
 if(!admitted){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; frame-ancestors 'none'"});res.end('<!doctype html><title>Synthetic callback proof</title><p>Callback received. No payment processed.</p>');
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const port=server.address().port;const args=sshArgs(port,known);
 if(aborted)throw Error('PUBLIC_BUDGET_EXCEEDED');
 connector=spawn(ssh,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,TEMP:process.env.TEMP,TMP:process.env.TMP}});
 await new Promise((resolve,reject)=>{let buffer='';for(const stream of [connector.stdout,connector.stderr])stream.on('data',chunk=>{buffer=(buffer+chunk).slice(-16384);const found=discover(buffer);if(found&&!origin){origin=found;save('assigned-origin.json',{origin});resolve();}});connector.once('error',()=>reject(Error('SSH_START_FAILED')));connector.once('exit',()=>reject(Error('SSH_EXIT_BEFORE_READINESS')));});
 for(const [method,p,status] of [...paths.map(p=>['POST',p,200]),['POST','/api/v1/auth/login',404],['GET',paths[0],404]]){
 if(aborted)throw Error('PUBLIC_BUDGET_EXCEEDED');const id=crypto.randomUUID();
 const r=await new Promise((resolve,reject)=>{const q=https.request(origin+p,{method,rejectUnauthorized:true,servername:new URL(origin).hostname,headers:{'content-type':'application/x-www-form-urlencoded','content-length':'3','x-proof-id':id}},r=>{r.resume();r.once('end',()=>resolve({status:r.statusCode,marker:r.headers['x-proof-marker']===marker}));});activeRequest=q;q.setTimeout(10000,()=>q.destroy(Error('REQUEST_TIMEOUT')));q.once('error',()=>reject(Error('HTTPS_REQUEST_FAILED')));q.end('x=1');});
 const own=receipts.find(x=>x.id===id);const ok=r.status===status&&r.marker&&!!own&&own.admitted===(status===200);checks.push({method,path:p,...r,originMatched:!!own,passed:ok});if(!ok)throw Error('PUBLIC_BOUNDARY_MISMATCH');
 }
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
 if(connector&&connector.exitCode===null&&connector.signalCode===null)stopped=await new Promise(resolve=>{const t=setTimeout(()=>resolve(false),5000);connector.once('exit',()=>{clearTimeout(t);resolve(true);});connector.kill();});
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 const result={passed:!failure&&stopped&&checks.length===7&&checks.every(c=>c.passed),failure,checks,pass:checks.filter(c=>c.passed).length,fail:checks.filter(c=>!c.passed).length,unexecuted:7-checks.length,connectorStopped:stopped,trust:'TOFU_SYNTHETIC_ONLY',normalServicesTouched:false,databaseAccess:false,providerCalls:0,paymentAcceptance:false};save('result.json',result);console.log(JSON.stringify(result));process.exitCode=result.passed?0:1;
 }
}
if(require.main===module)main().catch(()=>{console.error('STOP: preserve evidence, no retry');process.exitCode=1;});
