'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process'),{inspect}=require('./session-evidence.cjs');
const {authArgs}=require('./connector-args.cjs');
const base=__dirname,write=(name,value)=>fs.writeFileSync(path.join(base,name),JSON.stringify(value,null,2),{flag:'wx'});
async function main(){
 if(process.argv[2]!=='--owner-approved-auth-only'||process.argv.length!==5)throw Error('AUTH_ONLY_APPROVAL_REQUIRED');
 const binary=process.argv[3],config=process.argv[4];
 if(crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex')!=='6cca51c969e13ad038a608b015000815135a3148ce4bb6a6f63c8aa536198e16')throw Error('BINARY_MISMATCH');
 if(fs.existsSync(path.join(base,'auth-result.json')))throw Error('EXISTING_RESULT_NO_RETRY');
 const env=Object.fromEntries(['SystemRoot','WINDIR','ComSpec','TEMP','TMP'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 const profile=path.join(base,'auth-profile');fs.mkdirSync(profile);Object.assign(env,{USERPROFILE:profile,HOME:profile,APPDATA:profile,LOCALAPPDATA:profile});
 let success=false,failure=null,codes=[],stopped=false;
 const child=spawn(binary,authArgs(config,path.join(base,'agent-safety.yml')),{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 write('auth-process.json',{pid:child.pid??null,endpointRequested:false,startedUTC:new Date().toISOString()});
 try{
  const outcome=await new Promise(resolve=>{
   let done=false;const buffers=new Map(),timer=setTimeout(()=>finish({failure:'AUTH_SESSION_TIMEOUT',codes:[]}),30000);
   function finish(v){if(done)return;done=true;clearTimeout(timer);for(const s of [child.stdout,child.stderr])s.removeListener('data',onData);resolve(v);}
   function onData(chunk){const text=((buffers.get(this)||'')+chunk.toString('utf8')).slice(-16384),lines=text.split(/\r?\n/);buffers.set(this,lines.pop());for(const line of lines){const r=inspect(line);if(r){finish(r);return;}}}
   child.stdout.on('data',onData);child.stderr.on('data',onData);child.once('error',()=>finish({failure:'AUTH_PROCESS_START_FAILED',codes:[]}));child.once('exit',()=>finish({failure:'AUTH_PROCESS_EXIT_BEFORE_ACK',codes:[]}));
  });
  success=outcome.authenticatedSessionStarted===true;failure=outcome.failure||null;codes=outcome.codes||[];
 }finally{
  if(child.exitCode===null&&child.signalCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill();await Promise.race([exited,new Promise(r=>setTimeout(r,5000))]);}
  stopped=child.exitCode!==null||child.signalCode!==null;
  if(!stopped){success=false;failure='OWNED_AUTH_PROCESS_STOP_UNCONFIRMED';}
  const result={passed:success&&stopped,authenticatedSessionStarted:success,codes,failure,ownedProcessStopped:stopped,endpointRequested:false,publicURLBound:false,domainEntitlementVerified:false,policyEntitlementVerified:false,databaseAccess:false,providerCalls:0,finishedUTC:new Date().toISOString()};
  write('auth-result.json',result);console.log(JSON.stringify(result));process.exitCode=result.passed?0:1;
 }
}
main().catch(()=>{console.error('STOP: auth-only guard or artifact failure; preserve state, no retry');process.exitCode=1;});
