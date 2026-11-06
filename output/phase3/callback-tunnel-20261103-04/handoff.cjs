'use strict';
const fs=require('node:fs'),path=require('node:path'),{fork,execFileSync}=require('node:child_process'),{createRequire}=require('node:module');
const {canRestore}=require('./handoff-policy.cjs');
const base=__dirname,root=path.resolve(base,'../../..'),old=path.join(root,'output/phase3/environment-restart-20261103-01');
const clean=()=>Object.fromEntries(['SystemRoot','WINDIR','ComSpec','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','Path','PATH','PATHEXT'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const save=(name,value)=>{const file=path.join(base,name);fs.writeFileSync(file+'.pending',JSON.stringify(value,null,2),{flag:'wx'});fs.renameSync(file+'.pending',file);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const inspect=phase=>JSON.parse(execFileSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(base,'ownership.ps1'),'-Phase',phase],{env:clean(),windowsHide:true,encoding:'utf8',timeout:10000,stdio:['ignore','pipe','ignore']}));
function child(script,args=[],env=clean(),cwd=base,execArgv=[]){
 const p=fork(path.join(base,script),args,{cwd,env,execArgv,windowsHide:true,silent:true});
 p.stdout.on('data',()=>{});p.stderr.on('data',()=>{});return p;
}
function completed(p,ms){return new Promise(resolve=>{const timer=setTimeout(()=>resolve({exited:false,exit:null}),ms);p.once('exit',code=>{clearTimeout(timer);resolve({exited:true,exit:code});});p.once('error',()=>{clearTimeout(timer);resolve({exited:true,exit:1});});});}
async function main(){
 if(process.argv[2]!=='--owner-approved-paired-handoff-dns-proof')throw Error('PAIRED_HANDOFF_APPROVAL_REQUIRED');
 if(['handoff-attempt.json','handoff-result.json','normal-restore','attempt.json','result.json'].some(n=>fs.existsSync(path.join(base,n)))||fs.readdirSync(base).some(n=>n.endsWith('.pending')))throw Error('EXISTING_HANDOFF_NO_RETRY');
 inspect('BeforeHandoff');
 const request=path.join(old,'stop-owned-servers.request.json');
 if(fs.existsSync(request))throw Error('OLD_STOP_REQUEST_EXISTS');
 save('handoff-attempt.json',{startedUTC:new Date().toISOString(),pairedDowntime:true});
 let originalStopped=false,proofStarted=false,proofExited=false,proofExit=null,proofResult=null,failure=null,restored=false;
 let restoredChildren=[];
 try{
  fs.writeFileSync(request,JSON.stringify({ownerApprovedPairedHandoff:'callback-tunnel-20261103-04'}),{flag:'wx'});
  const end=Date.now()+20000;
  while(Date.now()<end){try{inspect('AfterStop');originalStopped=true;break;}catch{await sleep(1000);}}
  if(!originalStopped)throw Error('ORIGINAL_GRACEFUL_SHUTDOWN_UNCONFIRMED');
  const expected=JSON.parse(fs.readFileSync(path.join(base,'expected-ownership.json'),'utf8'));
  const lifecycle=fs.readFileSync(path.join(old,'lifecycle.jsonl'),'utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
  if(!expected.filter(p=>p.role!=='supervisor').every(p=>lifecycle.some(e=>e.pid===p.pid&&e.exit===0&&!e.signal)))throw Error('ORIGINAL_STOP_NOT_GRACEFUL');
  // The probe must bind exclusively and pass its own callback before it can spawn cloudflared.
  proofStarted=true;
  const pureEnv=Object.fromEntries(['SystemRoot','WINDIR','ComSpec','TEMP','TMP'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  const probe=child('run.cjs',['--owner-approved-dns-gated-proof',process.argv[3]],pureEnv);
  const completion=await completed(probe,200000);proofExited=completion.exited;proofExit=completion.exit;
  if(fs.existsSync(path.join(base,'result.json')))proofResult=JSON.parse(fs.readFileSync(path.join(base,'result.json')));
  if(!completion.exited)throw Error('OWNED_PROBE_EXIT_UNCONFIRMED');
  if(completion.exit!==0||!proofResult?.passed)failure='PUBLIC_PROOF_FAILED_PRESERVED';
 }catch(error){failure=['ORIGINAL_GRACEFUL_SHUTDOWN_UNCONFIRMED','ORIGINAL_STOP_NOT_GRACEFUL','OWNED_PROBE_EXIT_UNCONFIRMED'].includes(error.message)?error.message:'HANDOFF_STAGE_FAILED';}
 finally{
  let tunnelAbsent=false;try{inspect('BeforeRestore');tunnelAbsent=true;}catch{/* Never attach a live connector to restored main backend. */}
  if(canRestore({originalStopped,proofStarted,proofExited,tunnelAbsent,result:proofResult})){
   fs.mkdirSync(path.join(base,'normal-restore'));
   const req=createRequire(path.join(root,'server/package.json'));
   restoredChildren=[child('restore-backend.ts',[],clean(),path.join(root,'server'),['--import',require('node:url').pathToFileURL(req.resolve('tsx')).href]),child('restore-frontend.cjs',[],clean(),path.join(root,'client'))];
   save('normal-restore/children.json',{backend:restoredChildren[0].pid,frontend:restoredChildren[1].pid,supervisor:process.pid});
   const end=Date.now()+60000;
   while(Date.now()<end){
    try{const a=await fetch('http://localhost:5000/api/v1/health',{signal:AbortSignal.timeout(2000)}),b=await fetch('http://localhost:3000/',{signal:AbortSignal.timeout(4000)}),data=await a.json();await b.body?.cancel();if(a.status===200&&data.data?.database==='up'&&b.status===200&&fs.existsSync(path.join(base,'normal-restore/backend-config.json'))&&fs.existsSync(path.join(base,'normal-restore/frontend-config.json'))){restored=true;break;}}catch{/* bounded restore-readiness polling, no process restart */}
    await sleep(1000);
   }
  }
  save('handoff-result.json',{supervisorPID:process.pid,originalStopped,proofStarted,proofExited,proofExit,proofPassed:proofResult?.passed||false,normalRestored:restored,failure,restorationBlocked:!restored,merchantCalls:0,businessMutations:false,finishedUTC:new Date().toISOString()});
  console.log('Phase3 DNS-gated proof finished. Proof PASS: '+Boolean(proofResult?.passed)+'; normal3000/5000 restored: '+restored+'; failure: '+failure);
  // Restored owned dev children intentionally remain running; operator may later stop only these.
  if(restoredChildren.length){const timer=setInterval(()=>{if(!fs.existsSync(path.join(base,'normal-restore/stop.request.json')))return;clearInterval(timer);for(const p of restoredChildren)if(p.connected)p.send({action:'stop-owned-development-server'});},1000);}
  process.exitCode=proofResult?.passed&&restored?0:1;
 }
}
if(require.main===module)main().catch(()=>{console.error('STOP: handoff preflight rejected; no retry');process.exitCode=1;});
