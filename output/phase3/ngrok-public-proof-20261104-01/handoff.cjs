'use strict';
const fs=require('node:fs'),path=require('node:path'),{fork,execFileSync}=require('node:child_process'),{createRequire}=require('node:module');
const {canRestore,proofExitText,failureLabel}=require('./backend-policy.cjs');
const base=__dirname,root=path.resolve(base,'../../..'),old=path.join(root,'output/phase3/ngrok-public-proof-20261103-02/normal-restore');
const clean=()=>Object.fromEntries(['SystemRoot','WINDIR','ComSpec','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','Path','PATH','PATHEXT'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const save=(name,value)=>{const file=path.join(base,name);fs.writeFileSync(file+'.pending',JSON.stringify(value,null,2),{flag:'wx'});fs.renameSync(file+'.pending',file);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const inspect=before=>JSON.parse(execFileSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(base,'ownership.ps1'),...(before?['-BeforeHandoff']:[])],{env:clean(),windowsHide:true,encoding:'utf8',timeout:10000,stdio:['ignore','pipe','ignore']}));
function child(script,args=[],env=clean(),cwd=base,execArgv=[]){const p=fork(path.join(base,script),args,{cwd,env,execArgv,windowsHide:true,silent:true});p.stdout.on('data',()=>{});p.stderr.on('data',()=>{});p.on('error',()=>{p.spawnFailed=true;});p.on('exit',(code,signal)=>{fs.appendFileSync(path.join(base,'child-exits.jsonl'),JSON.stringify({role:script,pid:p.pid,code,signal})+'\n');});return p;}
function completed(p,ms){return new Promise(resolve=>{const timer=setTimeout(()=>resolve({exited:false,exit:null}),ms);p.once('exit',code=>{clearTimeout(timer);resolve({exited:true,exit:code});});p.once('error',()=>{clearTimeout(timer);resolve({exited:true,exit:1});});});}
async function health(){return require('./health.cjs').checkHealth({fetchFn:fetch});}
async function main(){
 if(process.argv[2]!=='--owner-approved-backend-only-dns-proof'||process.argv.length!==5)throw Error('BACKEND_ONLY_APPROVAL_REQUIRED');
 if(['workflow-attempt.json','auth-process.json','auth-result.json','auth-profile','handoff-attempt.json','handoff-result.json','normal-restore','attempt.json','result.json','workflow-error.json','preflight-health.json'].some(n=>fs.existsSync(path.join(base,n)))||fs.readdirSync(base).some(n=>n.endsWith('.pending')))throw Error('EXISTING_ATTEMPT_NO_RETRY');
 inspect(true);const before=await health();if(!before.backend||!before.frontend){save('preflight-health.json',before);throw Error('NORMAL_SERVICES_NOT_HEALTHY');}
 const request=path.join(old,'stop-backend.request.json'),exitFile=path.join(root,'output/phase3/ngrok-public-proof-20261103-02/child-exits.jsonl');
 if(fs.existsSync(request)||fs.existsSync(path.join(old,'stop-frontend.request.json')))throw Error('EXISTING_CONTROL_STATE_INSPECT_FIRST');
 save('workflow-attempt.json',{startedUTC:new Date().toISOString(),scope:'ROTATED_AUTH_FIRST_THEN_BACKEND_ONLY',frontendStopRequested:false});
 const auth=child('auth-only.cjs',['--owner-approved-auth-only',process.argv[3],process.argv[4]]);
 const authOutcome=await completed(auth,40000);
 const authFile=path.join(base,'auth-result.json');
 const authResult=fs.existsSync(authFile)?JSON.parse(fs.readFileSync(authFile,'utf8')):null;
 if(!authOutcome.exited||authOutcome.exit!==0||authResult?.passed!==true||authResult.ownedProcessStopped!==true||authResult.publicURLBound!==false)throw Error('ROTATED_AUTH_GATE_INCOMPLETE');
 inspect(true); // independently require auth connector gone before any handoff
 save('handoff-attempt.json',{startedUTC:new Date().toISOString(),scope:'BACKEND_ONLY',frontendStopRequested:false});
 let backendStopped=false,proofStarted=false,proofExited=false,proofExit=null,result=null,failure=null,backendRestored=false,frontendPreserved=true,state=null,restorer=null;
 try{
  fs.writeFileSync(request,JSON.stringify({ownerApprovedBackendOnly:'ngrok-public-proof-20261104-01'}),{flag:'wx'});
  const stopEnd=Date.now()+20000;
  while(Date.now()<stopEnd){state=inspect(false);if(state.backendChanged)throw Error('BACKEND_IDENTITY_CHANGED');if(state.backendAbsent){backendStopped=true;break;}await sleep(1000);}
  if(!backendStopped)throw Error('BACKEND_SHUTDOWN_UNCONFIRMED');
  const expected=JSON.parse(fs.readFileSync(path.join(base,'expected-ownership.json'),'utf8')).find(p=>p.role==='backend');
  const exit=fs.readFileSync(exitFile,'utf8').trim().split(/\r?\n/).map(line=>JSON.parse(line)).find(row=>row.role==='restore-backend.ts'&&row.pid===expected.pid);
  if(!exit||exit.pid!==expected.pid||exit.code!==0||exit.signal)throw Error('BACKEND_STOP_NOT_GRACEFUL');
  frontendPreserved=state.frontendPreserved;if(!frontendPreserved)throw Error('FRONTEND_CHANGED_NO_PUBLIC_PROOF');if(!state.connectorsAbsent)throw Error('UNEXPECTED_CONNECTOR_NO_PUBLIC_PROOF');
  proofStarted=true;
  const pure=Object.fromEntries(['SystemRoot','WINDIR','ComSpec','TEMP','TMP'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  const probe=child('run.cjs',['--owner-approved-dns-gated-proof',process.argv[3],process.argv[4]],pure);
  const outcome=await completed(probe,200000);proofExited=outcome.exited;proofExit=outcome.exit;
  if(fs.existsSync(path.join(base,'result.json')))result=JSON.parse(fs.readFileSync(path.join(base,'result.json'),'utf8'));
  if(!proofExited)throw Error('PROBE_EXIT_UNCONFIRMED');if(proofExit!==0||!result?.passed)failure='PUBLIC_PROOF_FAILED_PRESERVED';
 }catch(error){const allowed=['BACKEND_IDENTITY_CHANGED','BACKEND_SHUTDOWN_UNCONFIRMED','BACKEND_STOP_NOT_GRACEFUL','FRONTEND_CHANGED_NO_PUBLIC_PROOF','UNEXPECTED_CONNECTOR_NO_PUBLIC_PROOF','PROBE_EXIT_UNCONFIRMED'];failure=allowed.includes(error.message)?error.message:'HANDOFF_STAGE_FAILED';}
 finally{
  state=null;try{state=inspect(false);}catch{/* Unknown connector state must not expose main5000. */}
  if(canRestore({backendStopped,proofStarted,proofExited,state,result})){
   fs.mkdirSync(path.join(base,'normal-restore'));const req=createRequire(path.join(root,'server/package.json'));
   restorer=child('restore-backend.ts',[],clean(),path.join(root,'server'),['--import',require('node:url').pathToFileURL(req.resolve('tsx')).href]);
   save('normal-restore/children.json',{backend:restorer.pid,supervisor:process.pid,frontendStarted:false});
   const end=Date.now()+60000;
   while(Date.now()<end){
    try{const h=await health(),file=path.join(base,'normal-restore/backend-config.json');if(h.backend&&fs.existsSync(file)){const config=JSON.parse(fs.readFileSync(file,'utf8'));if(config.pid===restorer.pid&&config.readonlyIdentityPass===true&&restorer.exitCode===null&&restorer.signalCode===null){backendRestored=true;frontendPreserved=frontendPreserved&&h.frontend;break;}}}catch{/* bounded health polling, no process restart */}
    if(restorer.spawnFailed||restorer.exitCode!==null||restorer.signalCode!==null)break;await sleep(1000);
   }
  }
  let finalFront=false;try{finalFront=inspect(false).frontendPreserved;}catch{}
  frontendPreserved=frontendPreserved&&finalFront;
  save('handoff-result.json',{supervisorPID:process.pid,backendStopped,proofStarted,proofExited,proofExit,proofExitText:proofExitText(proofStarted,proofExit),proofPassed:result?.passed||false,backendRestored,frontendPreserved,frontendStopRequested:false,frontendStarted:false,failure,restorationBlocked:!backendRestored,merchantCalls:0,businessMutations:false,finishedUTC:new Date().toISOString()});
  console.log('Backend-only proof '+proofExitText(proofStarted,proofExit)+'; backend restored: '+backendRestored+'; frontend preserved: '+frontendPreserved);
  if(restorer){const timer=setInterval(()=>{if(!fs.existsSync(path.join(base,'normal-restore/stop-backend.request.json')))return;clearInterval(timer);if(restorer.connected)restorer.send({action:'stop-owned-development-server'});},1000);}
  process.exitCode=result?.passed&&backendRestored&&frontendPreserved?0:1;
 }
}
if(require.main===module)main().catch(error=>{const file=path.join(base,'workflow-error.json');if(!fs.existsSync(file))save('workflow-error.json',{failure:failureLabel(error),code:['EACCES','EPERM','ENOENT','ETIMEDOUT'].includes(error.code)?error.code:null,maintenanceStarted:fs.existsSync(path.join(base,'handoff-attempt.json'))});console.error('STOP: '+failureLabel(error)+'; preserve evidence, no retry');process.exitCode=1;});
