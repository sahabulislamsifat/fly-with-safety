'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
const source=fs.readFileSync(path.join(__dirname,'handoff.cjs'),'utf8');
async function simulate({proofPass=true,proofHung=false,residual=false,stopIncomplete=false,abnormalStop=false}={}){
 const files=new Map(),events=[],children=[];let clock=0,stopped=false,nextPID=1000;
 const put=(file,value)=>files.set(path.normalize(file),value),get=file=>files.get(path.normalize(file));
 const frozen=fs.readFileSync(path.join(__dirname,'expected-ownership.json'),'utf8');put(path.join(__dirname,'expected-ownership.json'),frozen);
 const fakefs={readdirSync:()=>[],existsSync:file=>files.has(path.normalize(file)),writeFileSync(file,data,opt){if(opt?.flag==='wx'&&this.existsSync(file))throw Error('EXISTS');put(file,data);if(String(file).endsWith('stop-owned-servers.request.json')){events.push('stop-request');stopped=!stopIncomplete;put(path.join(path.dirname(file),'lifecycle.jsonl'),JSON.parse(frozen).filter(p=>p.role!=='supervisor').map(p=>JSON.stringify({pid:p.pid,exit:abnormalStop&&p.role==='backend'?1:0,signal:null})).join('\n'));}},readFileSync:get,renameSync(from,to){put(to,get(from));files.delete(path.normalize(from));},mkdirSync(dir){put(dir,'DIR');}};
 const fakeproc={pid:9000,argv:['node','handoff.cjs','--owner-approved-paired-handoff-dns-proof','synthetic-binary.exe'],env:{SystemRoot:'C:\\Windows'},exitCode:null};
 const mockcp={
  execFileSync(_exe,args){const phase=args[args.indexOf('-Phase')+1];events.push(phase);if(phase==='BeforeHandoff')return '{"ok":true}';if(!stopped||phase==='BeforeRestore'&&residual)throw Error('OWNERSHIP_GATE');return '{"ok":true}';},
  fork(script){const p=new EventEmitter();p.pid=nextPID++;p.stdout=new EventEmitter();p.stderr=new EventEmitter();p.connected=true;p.send=()=>{};children.push(path.basename(script));events.push('fork:'+path.basename(script));
   if(script.endsWith('run.cjs')){if(!proofHung)queueMicrotask(()=>{put(path.join(__dirname,'result.json'),JSON.stringify({passed:proofPass,tunnelStopped:!residual,listenerStopped:true}));p.emit('exit',proofPass?0:1);});}
   else if(script.endsWith('restore-backend.ts'))put(path.join(__dirname,'normal-restore/backend-config.json'),'{}');
   else if(script.endsWith('restore-frontend.cjs'))put(path.join(__dirname,'normal-restore/frontend-config.json'),'{}');
   return p;
  }
 };
 const fakeRequire=name=>name==='node:fs'?fakefs:name==='node:path'?path:name==='node:child_process'?mockcp:name==='node:module'?{createRequire:()=>({resolve:()=>path.join(__dirname,'synthetic-loader.mjs')})}:name==='./handoff-policy.cjs'?require('./handoff-policy.cjs'):name==='node:url'?require('node:url'):(()=>{throw Error('UNEXPECTED_IMPORT');})();
 fakeRequire.main={};
 const context={require:fakeRequire,module:{},__dirname,process:fakeproc,AbortSignal,console:{log(){},error(){}},fetch:async()=>({status:200,json:async()=>({data:{database:'up'}}),body:{cancel:async()=>{}}}),Date:class extends Date{static now(){return clock;}},setTimeout(fn,ms){const token={cancel:false};queueMicrotask(()=>{if(!token.cancel){clock+=ms;fn();}});return token;},clearTimeout(token){token.cancel=true;},setInterval(){return{};},clearInterval(){}};
 vm.runInNewContext(source+'\nglobalThis.done=main();',context);
 await context.done;
 return{result:JSON.parse(get(path.join(__dirname,'handoff-result.json'))),events,children};
}
test('one proof, then verified no-connector gate before normal restoration',async()=>{const x=await simulate();assert.equal(x.result.normalRestored,true);assert.equal(x.result.proofExit,0);assert.deepEqual(x.children,['run.cjs','restore-backend.ts','restore-frontend.cjs']);assert.ok(x.events.indexOf('BeforeRestore')<x.events.indexOf('fork:restore-backend.ts'));assert.equal(x.events.filter(e=>e==='stop-request').length,1);});
test('failed public proof restored safely without a second proof execution',async()=>{const x=await simulate({proofPass:false});assert.equal(x.result.proofExit,1);assert.equal(x.result.normalRestored,true);assert.equal(x.children.filter(c=>c==='run.cjs').length,1);});
test('residual connector blocks restoring main backend',async()=>{const x=await simulate({proofPass:false,residual:true});assert.equal(x.result.normalRestored,false);assert.deepEqual(x.children,['run.cjs']);});
test('unconfirmed proof process exit blocks restoring main backend',async()=>{const x=await simulate({proofHung:true});assert.equal(x.result.proofExited,false);assert.equal(x.result.normalRestored,false);assert.deepEqual(x.children,['run.cjs']);});
test('incomplete original shutdown prevents tunnel/proof and any forced process action',async()=>{const x=await simulate({stopIncomplete:true});assert.equal(x.result.originalStopped,false);assert.equal(x.result.proofStarted,false);assert.deepEqual(x.children,[]);});
test('nonzero normal shutdown blocks public proof but permits safe restoration',async()=>{const x=await simulate({abnormalStop:true});assert.equal(x.result.failure,'ORIGINAL_STOP_NOT_GRACEFUL');assert.equal(x.result.proofStarted,false);assert.equal(x.result.normalRestored,true);assert.deepEqual(x.children,['restore-backend.ts','restore-frontend.cjs']);});
