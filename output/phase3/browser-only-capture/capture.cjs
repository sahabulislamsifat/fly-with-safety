'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {allowed}=require('../isolated-callback/boundary.cjs'),{inspect}=require('../isolated-callback/binding.cjs'),{classify,decision}=require('./classify.cjs');
const origin='https://russel-semisacred-elise.ngrok-free.dev',target=origin+'/api/v1/payments/sslcommerz/success';
const save=(name,value)=>fs.writeFileSync(path.join(__dirname,name),JSON.stringify(value,null,2),{flag:'wx'});
async function main(){
 if(process.argv[2]!=='--owner-approved-browser-only')throw Error('APPROVAL_REQUIRED');
 const binary=process.argv[3],config=process.argv[4],pw=process.argv[5];
 for(const p of [binary,config,pw])if(!path.isAbsolute(p)||/[\r\n,]/.test(p))throw Error('EXPLICIT_PATH_REQUIRED');
 // Resolve browser dependency before opening an endpoint; no downloads or installs.
 const {chromium}=require(pw);
 save('attempt.json',{atUTC:new Date().toISOString()});
 let server,agent,browser,context,timer,aborted=false,failure=null,observation=null,connectorStopped=true;
 const originEvents=[];let browserActive=false;const marker=crypto.randomBytes(24).toString('hex');
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{aborted=true;void context?.close().catch(()=>{});reject(Error('BUDGET_EXCEEDED'));},180000);});
 try{
 await Promise.race([(async()=>{
 server=http.createServer((req,res)=>{
 const admit=allowed(req);originEvents.push({sequence:originEvents.length+1,browserWindow:browserActive,method:req.method==='GET'?'GET':req.method==='POST'?'POST':'OTHER',exactTarget:req.url==='/api/v1/payments/sslcommerz/success',admitted:admit});
 res.setHeader('Cache-Control','no-store');res.setHeader('x-proof-marker',marker);req.resume();res.statusCode=admit?204:404;res.end();
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const port=server.address().port;if([3000,5000].includes(port))throw Error('NORMAL_PORT_FORBIDDEN');
 const profile=path.join(__dirname,'agent-profile');fs.mkdirSync(profile);const env={};
 for(const k of ['SystemRoot','WINDIR','TEMP','TMP'])if(process.env[k])env[k]=process.env[k];
 Object.assign(env,{USERPROFILE:profile,HOME:profile,APPDATA:profile,LOCALAPPDATA:profile});
 agent=spawn(binary,['http',`http://127.0.0.1:${port}`,'--url',origin,'--config',config+','+path.join(__dirname,'../isolated-callback/agent-safety.yml'),'--traffic-policy-file',path.join(__dirname,'../isolated-callback/policy.json'),'--inspect=false','--log','stdout','--log-format','json','--log-level','info'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{let settled=false;const end=(e,r)=>{if(settled)return;settled=true;e?reject(e):resolve(r);};for(const stream of [agent.stdout,agent.stderr]){let buf='';stream.on('data',b=>{buf=(buf+b).slice(-16384);const lines=buf.split(/\r?\n/);buf=lines.pop();for(const l of lines){const r=inspect(l,origin);if(!r||settled)continue;if(r.failure){save('binding.json',r);end(Error(r.failure));}else{save('binding.json',r);end(null,r);}}});}agent.once('error',()=>end(Error('AGENT_START_FAILED')));agent.once('exit',()=>{if(!settled)end(Error('AGENT_EXIT_BEFORE_BINDING'));});});
 if(aborted)throw Error('BUDGET_EXCEEDED');
 browser=await chromium.launch({channel:'chrome',headless:false});
 context=await browser.newContext({serviceWorkers:'block'}); // default UA, TLS and empty cookies
 const page=await context.newPage();let mainResponse;
 // Prevent redirects/assets from leaving the approved host or reaching unrelated routes.
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin||u.pathname!=='/api/v1/payments/sslcommerz/success'||u.search)return route.abort();return route.continue();});
 browserActive=true;
 mainResponse=await page.goto(target,{waitUntil:'load',timeout:25000});
 if(!mainResponse)throw Error('MAIN_RESPONSE_MISSING');
 const headers=await mainResponse.allHeaders(),bodyText=(await page.locator('body').innerText({timeout:5000})).slice(0,16384),c=classify(await page.title(),bodyText);
 const chain=[];for(let r=mainResponse.request();r;r=r.redirectedFrom()){const u=new URL(r.url());chain.unshift({sameApprovedOrigin:u.origin===origin,pathClass:u.pathname==='/api/v1/payments/sslcommerz/success'?'EXACT_CALLBACK':'OTHER',method:r.method()});}
 await page.screenshot({path:path.join(__dirname,'browser.png'),fullPage:false});
 const url=new URL(page.url());observation={status:mainResponse.status(),finalURL:url.origin===origin&&url.pathname==='/api/v1/payments/sslcommerz/success'&&!url.search?target:'OTHER_REDACTED',contentType:String(headers['content-type']||'').split(';')[0],serverClass:/ngrok/i.test(headers.server||'')?'NGROK':'OTHER_OR_ABSENT',cookieHeaderPresent:!!headers['set-cookie'],locationPresent:!!headers.location,originMarkerMatched:headers['x-proof-marker']===marker,classification:c,redirectChain:chain,tls:await mainResponse.securityDetails(),defaultBrowserIdentity:true,freshContext:true,warningClicked:false,browserOriginEvents:originEvents.filter(e=>e.browserWindow),decision:decision(mainResponse.status(),c,originEvents.some(e=>e.browserWindow&&e.exactTarget))};
 save('browser.json',observation);browserActive=false;
 })(),timeout]);
 }catch(e){failure=/^[A-Z0-9_]+$/.test(e.message)?e.message:'CAPTURE_INCOMPLETE';}
 finally{
 clearTimeout(timer);browserActive=false;
 await context?.close().catch(()=>{});await browser?.close().catch(()=>{});
 if(agent&&agent.exitCode===null&&agent.signalCode===null){connectorStopped=await new Promise(resolve=>{const t=setTimeout(()=>resolve(false),5000);agent.once('exit',()=>{clearTimeout(t);resolve(true);});agent.kill();});}
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 const result={captureCompleted:!!observation&&!failure&&connectorStopped,failure,connectorStopped,originEvents,normalServicesTouched:false,databaseAccess:false,providerCalls:0,paymentAcceptance:false,decision:observation?.decision||'BLOCKED_CAPTURE_INCOMPLETE'};save('result.json',result);console.log(JSON.stringify(result));process.exitCode=result.captureCompleted?0:1;
 }
}
if(require.main===module)main().catch(()=>{console.error('STOP: no retry; preserve evidence');process.exitCode=1;});
