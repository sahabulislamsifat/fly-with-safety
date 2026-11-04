'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const source=fs.readFileSync(path.join(__dirname,'auth-only.cjs'),'utf8').split('main().catch')[0];
async function simulate(mode){
 const writes=new Map(),calls=[];let child;
 const fakefs={existsSync:()=>false,readFileSync:()=>Buffer.from('synthetic'),writeFileSync(p,v,opt){assert.equal(opt.flag,'wx');assert.ok(!writes.has(p));writes.set(p,v);}};
 const spawn=(_binary,args,options)=>{calls.push({args,options});child=new EventEmitter();child.pid=999;child.exitCode=null;child.signalCode=null;child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{child.signalCode='SIGTERM';queueMicrotask(()=>child.emit('exit',null,'SIGTERM'));};queueMicrotask(()=>{
  if(mode==='pass')child.stdout.emit('data','{"msg":"tunnel session started","lvl":"info"}\n');
  if(mode==='reject')child.stderr.emit('data','private ERR_NGROK_105 private\n');
  if(mode==='endpoint')child.stdout.emit('data','{"msg":"started tunnel"}\n');
  if(mode==='warn')child.stderr.emit('data','{"lvl":"warn","msg":"private"}\n');
  if(mode==='exit'){child.exitCode=1;child.emit('exit',1,null);}
 });return child;};
 const context={require:n=>n==='node:fs'?fakefs:n==='node:path'?path:n==='node:crypto'?{createHash:()=>({update:()=>({digest:()=> '6cca51c969e13ad038a608b015000815135a3148ce4bb6a6f63c8aa536198e16'})})}:n==='node:child_process'?{spawn}:n==='./session-evidence.cjs'?require('./session-evidence.cjs'):(()=>{throw Error('Unapproved import');})(),__dirname,Buffer,process:{argv:['node','auth-only','--owner-approved-auth-only','binary','private-config'],env:{SystemRoot:'Windows',NGROK_AUTHTOKEN:'must-not-inherit',DATABASE_URL:'must-not-inherit'},exitCode:null},console:{log(){},error(){}},setTimeout:(fn,ms)=>setTimeout(fn,ms===30000?5:1),clearTimeout};
 vm.runInNewContext(source+'\nglobalThis.done=main();',context);await context.done;
 const result=JSON.parse(writes.get(path.join(__dirname,'auth-result.json')));return{result,calls};
}
test('auth-only command requests no endpoints/upstream and excludes credential environment overrides',async()=>{const {result,calls}=await simulate('pass');assert.equal(result.passed,true);assert.equal(calls.length,1);assert.deepEqual(Array.from(calls[0].args).slice(0,2),['start','--none']);assert.ok(!calls[0].args.some(x=>/https?:|--all|--url|5000|8080/.test(x)));assert.equal(calls[0].options.env.NGROK_AUTHTOKEN,undefined);assert.equal(calls[0].options.env.DATABASE_URL,undefined);assert.equal(result.ownedProcessStopped,true);});
for(const mode of ['reject','endpoint','warn','exit','timeout'])test(`${mode} fails, preserves evidence, stops owned session and never retries`,async()=>{const{result,calls}=await simulate(mode);assert.equal(result.passed,false);assert.equal(result.publicURLBound,false);assert.equal(calls.length,1);assert.equal(result.ownedProcessStopped,true);if(mode==='reject')assert.deepEqual(result.codes,['ERR_NGROK_105']);});
