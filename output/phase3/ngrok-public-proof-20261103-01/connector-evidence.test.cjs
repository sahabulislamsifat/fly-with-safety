'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {inspectLine,waitForConnector}=require('./connector-evidence.cjs');
const {hostname,waitForDns}=require('./readiness.cjs');
const origin='https://russel-semisacred-elise.ngrok-free.dev';
const event=changes=>JSON.stringify({msg:'started tunnel',url:origin,addr:'http://127.0.0.1:5000',...changes});
function child(){const c=new EventEmitter();c.stdout=new EventEmitter();c.stderr=new EventEmitter();return c;}
test('exact authenticated binding accepted, not inferred from config check',()=>{assert.equal(inspectLine(event(),origin).bindingAccepted,true);assert.equal(inspectLine('{"msg":"client session established"}',origin),null);});
test('alternate domain rejected',()=>assert.equal(inspectLine(event({url:'https://app.acme.com'}),origin).failure,'NGROK_EXACT_HOSTNAME_MISMATCH'));
test('non-isolated or altered upstream rejected',()=>{for(const addr of ['http://localhost:5000','http://127.0.0.1:8080','https://example.com','http://127.0.0.1:5000/admin','http://user:secret@127.0.0.1:5000'])assert.equal(inspectLine(event({addr}),origin).failure,'NGROK_UPSTREAM_MISMATCH');});
test('missing upstream evidence fails closed',()=>assert.equal(inspectLine(event({addr:null}),origin).failure,'NGROK_UPSTREAM_UNCONFIRMED'));
test('safe platform codes retained without raw secret/error text',()=>{const r=inspectLine('private-value ERR_NGROK_108 private-value',origin);assert.deepEqual(r.detail.codes,['ERR_NGROK_108']);assert.ok(!JSON.stringify(r).includes('private-value'));});
test('fragmented native JSON readiness captured without raw logging',async()=>{const c=child(),events=[];const p=waitForConnector(c,origin,(...e)=>events.push(e),1000);c.stdout.emit('data',event().slice(0,25));c.stdout.emit('data',event().slice(25)+'\n');assert.equal((await p).bindingAccepted,true);assert.equal(events.length,1);});
test('account/policy refusal rejects without public probe',async()=>{const c=child(),p=waitForConnector(c,origin,()=>{},1000);c.stderr.emit('data','ERR_NGROK_320 private-value\n');await assert.rejects(p,{message:'NGROK_START_REJECTED'});});
test('native process exit fails rather than claiming ready',async()=>{const c=child(),p=waitForConnector(c,origin,()=>{},1000);c.emit('exit',1);await assert.rejects(p,{message:'NGROK_EXIT_BEFORE_BINDING'});});
test('bounded startup timeout does not retry',async()=>{const c=child();await assert.rejects(waitForConnector(c,origin,()=>{},5),{message:'NGROK_BINDING_TIMEOUT'});assert.equal(c.stdout.listenerCount('data'),0);});
test('exact static HTTPS origin only; no cloudflare or arbitrary fallback',()=>{assert.equal(hostname(origin),'russel-semisacred-elise.ngrok-free.dev');for(const u of ['http://russel-semisacred-elise.ngrok-free.dev',origin+'/admin','https://a.trycloudflare.com','https://app.acme.com',origin+':444'])assert.throws(()=>hostname(u));});
test('DNS cap preserves fail-closed ENOTFOUND evidence',async()=>{let n=0,time=0;const r=await waitForDns(origin,{lookup:async()=>{n++;return{success:false,code:'ENOTFOUND'};},wait:async ms=>{time+=ms;},now:()=>time});assert.equal(r.ready,false);assert.equal(n,8);assert.equal(r.observations.at(-1).code,'ENOTFOUND');});
test('two consecutive real lookup successes required before callback',async()=>{let n=0;const r=await waitForDns(origin,{lookup:async()=>({success:true,answers:1,families:[4]}),wait:async()=>{n++;},now:()=>0});assert.equal(r.ready,true);assert.equal(r.observations.length,2);assert.equal(n,1);});
test('actual forged-Host request preserves ngrok SNI and default certificate verification without opening socket',async()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),https=require('node:https'),tls=require('node:tls');
 let selected,explicit;
 const wrapper={request(url,options,cb){explicit=options;const agent=new https.Agent();agent.createConnection=(o,done)=>{selected=o;done(Object.assign(Error('OFFLINE'),{code:'ECONNREFUSED'}));};return https.request(url,{...options,agent},cb);}};
 const context={require:n=>n==='node:https'?wrapper:n.startsWith('.')?require(path.resolve(__dirname,n)):require(n),__dirname,URL,Buffer,setTimeout,clearTimeout};
 const source=fs.readFileSync(path.join(__dirname,'run.cjs'),'utf8');vm.runInNewContext(source.slice(0,source.indexOf('async function main()'))+'\nglobalThis.requestFn=request;',context);
 await assert.rejects(context.requestFn(origin,require('./probe.cjs').plan()[30],'offline'));
 assert.equal(selected.servername,'russel-semisacred-elise.ngrok-free.dev');assert.equal(selected.rejectUnauthorized,true);assert.equal(explicit.headers.Host,'localhost:5000');assert.equal(explicit.checkServerIdentity,undefined);
 const cert={subjectaltname:'DNS:*.ngrok-free.dev'};assert.equal(tls.checkServerIdentity(selected.servername,cert),undefined);assert.equal(tls.checkServerIdentity('localhost',cert).code,'ERR_TLS_CERT_ALTNAME_INVALID');
});
