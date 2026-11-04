'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const policy=JSON.parse(fs.readFileSync(path.join(__dirname,'policy.json'),'utf8'));
const {plan}=require('./probe.cjs');
const {paths,classify}=require('../callback-preparation-20261103-01/ingress.cjs');
const host='russel-semisacred-elise.ngrok-free.dev';
// Evaluate only this generated finite allow expression in a local JS VM equivalent.
// This is not an ngrok CEL runtime or account-entitlement validator.
function edgeAllows(item,domain=host,scheme='https'){
 const u=new URL(item.path,`https://${host}`);
 const url={scheme,host:domain,raw_path:u.pathname,query:u.search.slice(1)};
 const req={url,method:item.method};
 const deny=policy.on_http_request[0].expressions[0];
 const literal=JSON.stringify(paths).replaceAll('"',"'");
 assert.ok(deny.includes('req.url.raw_path in '+literal.replaceAll(',',', ')));
 const js=deny.replace(/req\.url\.raw_path in (\[[^\]]+\])/,'$1.includes(req.url.raw_path)');
 return !Function('req',`return (${js});`)(req);
}
for(const [i,item]of plan().entries())test(`case${i+1}: edge deny or unchanged origin guard denies unrelated route`,()=>{
 const allowed=edgeAllows(item,item.headers?.Host||host);
 if(!allowed){assert.notEqual(item.status,204);return;}
 const req={method:item.method,url:item.path,socket:{remoteAddress:'127.0.0.1'},headers:{host:'phase3-callback.invalid','content-type':item.type||'application/x-www-form-urlencoded','content-length':String(Buffer.byteLength(item.body||''))}};
 assert.equal(classify(req),item.status===204||item.status===400?'callback':'deny');
});
test('all four exact POST paths allowed but wrong domain/scheme/encoded path rejected',()=>{
 for(const p of paths){assert.equal(edgeAllows({method:'POST',path:p}),true);assert.equal(edgeAllows({method:'POST',path:p},'app.acme.com'),false);assert.equal(edgeAllows({method:'POST',path:p},host,'http'),false);assert.equal(edgeAllows({method:'POST',path:p.replace('success','%73uccess')+'/'}),false);}
});
test('no OAuth/basic auth/provider signature fiction; deny precedes Host override',()=>{
 assert.equal(policy.on_http_request.length,2);
 assert.equal(policy.on_http_request[0].actions[0].type,'custom-response');
 assert.equal(policy.on_http_request[0].actions[0].config.status_code,404);
 assert.deepEqual(policy.on_http_request[1].actions.map(a=>a.type),['remove-headers','add-headers']);
 assert.equal(policy.on_http_request[1].actions[1].config.headers.host,'phase3-callback.invalid');
 assert.doesNotMatch(JSON.stringify(policy),/oauth|basic-auth|verify-webhook|skip-browser-warning/);
});
