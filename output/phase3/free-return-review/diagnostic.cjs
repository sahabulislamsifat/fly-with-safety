'use strict';
const http=require('node:http'),https=require('node:https'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {boundary,paths}=require('../isolated-callback/boundary.cjs'),{inspect}=require('../isolated-callback/binding.cjs');
const origin='https://russel-semisacred-elise.ngrok-free.dev';
async function main(){
 if(process.argv[2]!=='--owner-approved-free-return-review')throw Error('APPROVAL_REQUIRED');
 const binary=process.argv[3],config=process.argv[4];
 if(!path.isAbsolute(binary)||!path.isAbsolute(config)||/[\r\n,]/.test(config))throw Error('PRIVATE_PATH_REQUIRED');
 fs.writeFileSync(path.join(__dirname,'smoke-attempt.json'),JSON.stringify({at:new Date().toISOString()}),{flag:'wx'});
 let child,server,deadline,passed=false,failure=null,stopped=true,aborted=false,activeRequest;const checks=[],receipts=new Set();let ack=false;
 const nonce=crypto.randomBytes(24).toString('hex');
 const save=(name,value)=>fs.writeFileSync(path.join(__dirname,name),JSON.stringify(value,null,2),{flag:'wx'});
 try{
 server=http.createServer((req,res)=>boundary(req,res,()=>{let length=0;req.on('data',b=>{length+=b.length;if(length>16384)req.destroy();});req.on('end',()=>{const id=req.headers['x-proof-id'];if(typeof id==='string')receipts.add(id);res.writeHead(204,{'x-proof-marker':nonce,'cache-control':'no-store'});res.end();});}));
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const port=server.address().port;if([3000,5000].includes(port))throw Error('NORMAL_PORT_FORBIDDEN');
 const profile=path.join(__dirname,'smoke-profile');fs.mkdirSync(profile);
 const env={};for(const k of ['SystemRoot','WINDIR','TEMP','TMP'])if(process.env[k])env[k]=process.env[k];
 Object.assign(env,{USERPROFILE:profile,HOME:profile,APPDATA:profile,LOCALAPPDATA:profile});
 const args=['http',`http://127.0.0.1:${port}`,'--url',origin,'--config',config+','+path.join(__dirname,'../isolated-callback/agent-safety.yml'),'--traffic-policy-file',path.join(__dirname,'../isolated-callback/policy.json'),'--inspect=false','--log','stdout','--log-format','json','--log-level','info'];
 child=spawn(binary,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 const binding=new Promise((resolve,reject)=>{for(const stream of [child.stdout,child.stderr]){let buffer='';stream.on('data',chunk=>{buffer=(buffer+chunk).slice(-16384);const lines=buffer.split(/\r?\n/);buffer=lines.pop();for(const line of lines){const r=inspect(line,origin);if(!r)continue;if(r.failure){save('binding.json',r);reject(Error(r.failure));return;}if(!ack){ack=true;save('binding.json',r);resolve();}}});}child.once('error',()=>reject(Error('AGENT_START_FAILED')));child.once('exit',()=>reject(Error('AGENT_EXIT')));});
 const timeout=new Promise((_,reject)=>{deadline=setTimeout(()=>{aborted=true;activeRequest?.destroy();reject(Error('PUBLIC_BUDGET_EXCEEDED'));},180000);});
 const proof=async()=>{
 await binding;
 const cases=[['GET',paths[0],404],['POST','/api/v1/auth/login',404]];
 for(let i=0;i<cases.length;i++){
 if(aborted)throw Error('PUBLIC_BUDGET_EXCEEDED');
 const [method,p,expected]=cases[i],id=crypto.randomUUID();
 const observed=await new Promise((resolve,reject)=>{const req=https.request(origin+p,{method,servername:new URL(origin).hostname,rejectUnauthorized:true,headers:{'content-type':'application/x-www-form-urlencoded','content-length':'3','x-proof-id':id,'accept':'*/*'}},res=>{let body='';res.on('data',b=>{if(body.length<8192)body+=b.toString('utf8').slice(0,8192-body.length);});res.once('end',()=>resolve({...require('./response.cjs').metadata(res.statusCode,res.headers,body),marker:res.headers['x-proof-marker']===nonce}));});activeRequest=req;req.setTimeout(10000,()=>req.destroy(Object.assign(Error('TIMEOUT'),{code:'ETIMEDOUT'})));req.once('error',e=>reject(Error(/^[A-Z0-9_]+$/.test(e.code||'')?e.code:'HTTPS_FAILED')));req.end('x=1');});
 const reached=receipts.has(id),ok=observed.status===expected&&(expected===204?observed.marker&&reached:!reached);
 checks.push({index:i,method,path:p,expected,...observed,originReached:reached,passed:ok});if(reached)throw Error('FORBIDDEN_ORIGIN_DELIVERY');
 }
 };
 await Promise.race([proof(),timeout]);console.log('FREE_RETURN_DIAGNOSTIC_READY_NOT_ACCEPTANCE');await Promise.race([new Promise(resolve=>{const timer=setInterval(()=>{if(fs.existsSync(path.join(__dirname,'stop.request'))){clearInterval(timer);resolve();}},250);setTimeout(()=>{clearInterval(timer);resolve();},120000);}),timeout]);passed=true;
 }catch(e){failure=/^[A-Z0-9_]+$/.test(e.message)?e.message:'SMOKE_FAILED';}
 finally{
 aborted=true;activeRequest?.destroy();clearTimeout(deadline);
 if(child&&child.exitCode===null&&child.signalCode===null){stopped=await new Promise(resolve=>{const t=setTimeout(()=>resolve(false),5000);child.once('exit',()=>{clearTimeout(t);resolve(true);});child.kill();});}
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 const result={diagnosticCompleted:passed&&stopped,boundaryAccepted:false,failure,checks,pass:checks.filter(x=>x.passed).length,fail:checks.filter(x=>!x.passed).length,unexecuted:2-checks.length,ownedConnectorStopped:stopped,normalServicesTouched:false,databaseAccess:false,providerCalls:0};save('smoke-result.json',result);console.log(JSON.stringify(result));process.exitCode=result.diagnosticCompleted?0:1;
 }
}
if(require.main===module)main().catch(()=>{console.error('STOP: smoke not completed; preserve evidence; no retry');process.exitCode=1;});
