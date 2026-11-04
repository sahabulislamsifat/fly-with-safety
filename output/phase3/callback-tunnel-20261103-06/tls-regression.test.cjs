'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),https=require('node:https'),tls=require('node:tls');
const origin='https://intervention-captured-monitoring-installations.trycloudflare.com';
const hostname=new URL(origin).hostname;
const {plan}=require('./probe.cjs');
function loadRequest(source,onOptions){
 const wrapper={request(url,options,cb){
  const agent=new https.Agent();
  agent.createConnection=(selected,done)=>{onOptions(selected,options,url);done(Object.assign(Error('OFFLINE_ONLY'),{code:'ECONNREFUSED'}));};
  return https.request(url,{...options,agent},cb);
 }};
 const realRequire=require;
 const context={require:name=>name==='node:https'?wrapper:name.startsWith('./')?realRequire(path.join(__dirname,name)):name.startsWith('../')?realRequire(path.resolve(__dirname,name)):realRequire(name),__dirname,URL,Buffer,setTimeout,clearTimeout,console};
 vm.runInNewContext(source.slice(0,source.indexOf('async function main()'))+'\nglobalThis.probeRequest=request;',context);
 return context.probeRequest;
}
const corrected=fs.readFileSync(path.join(__dirname,'run.cjs'),'utf8');
const historical=fs.readFileSync(path.resolve(__dirname,'../callback-tunnel-20261103-05/run.cjs'),'utf8');
test('historical actual request reproducibly derives localhost SNI from forged Host without any socket',async()=>{
 let seen;
 await assert.rejects(loadRequest(historical,o=>seen=o)(origin,plan()[30],'offline-id'));
 assert.equal(seen.hostname,hostname);assert.equal(seen.servername,'localhost');assert.equal(seen.rejectUnauthorized,true);
});
test('only TLS servername changes in public request implementation',()=>{
 assert.equal(corrected,historical.replace('rejectUnauthorized: true, signal','rejectUnauthorized: true, servername: new URL(origin).hostname, signal'));
});
for(const [index,item] of plan().entries())test(`case ${index+1}: TLS identity stays public while HTTP method/path/Host remain unchanged`,async()=>{
 let seen,options,requestURL;
 await assert.rejects(loadRequest(corrected,(o,p,u)=>{seen=o;options=p;requestURL=u;})(origin,item,'offline-id'));
 assert.equal(seen.hostname,hostname);assert.equal(seen.servername,hostname);assert.equal(seen.rejectUnauthorized,true);
 assert.equal(options.method,item.method);assert.equal(requestURL.pathname+requestURL.search,item.path);
 assert.equal(options.headers.Host,item.headers?.Host);
 assert.equal(options.checkServerIdentity,undefined); // default Node verification retained
 assert.equal(options.headers['X-FWS-Probe-Id'],'offline-id');
});
test('synthetic SAN shows localhost mismatch and public match; unrelated certificate still rejected',()=>{
 const cert={subjectaltname:'DNS:*.trycloudflare.com'};
 assert.equal(tls.checkServerIdentity('localhost',cert).code,'ERR_TLS_CERT_ALTNAME_INVALID');
 assert.equal(tls.checkServerIdentity(hostname,cert),undefined);
 assert.equal(tls.checkServerIdentity(hostname,{subjectaltname:'DNS:unrelated.example'}).code,'ERR_TLS_CERT_ALTNAME_INVALID');
});
