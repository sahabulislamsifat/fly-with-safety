const {test}=require('node:test'),a=require('node:assert/strict'),{publicOrigin,accept,sshArgs}=require('./transport.cjs');
const origin='https://sample.lhr.life';
const req=()=>({method:'POST',url:'/api/v1/payments/sslcommerz/success',socket:{remoteAddress:'127.0.0.1'},headers:{host:'sample.lhr.life','x-forwarded-proto':'https','content-type':'application/x-www-form-urlencoded','content-length':'3'}});
test('only assigned free-service origin patterns',()=>{a.equal(publicOrigin(origin),origin);for(const u of ['http://sample.lhr.life','https://evil.invalid','https://sample.lhr.life.evil.invalid','https://a:b@sample.lhr.life','https://sample.lhr.life/?secret=x'])a.throws(()=>publicOrigin(u));});
for(const name of ['success','fail','cancel','ipn'])test('callback '+name,()=>{const r=req();r.url='/api/v1/payments/sslcommerz/'+name;a.equal(accept(r,origin),true);});
for(const url of ['/api/v1/auth/login','/api/v1/admin','/api/v1/bookings','/api/v1/account','/api/v1/payments/sslcommerz/success?x=1'])test('deny '+url,()=>{const r=req();r.url=url;a.equal(accept(r,origin),false);});
test('deny GET, HTTP and wrong host',()=>{for(const change of [r=>r.method='GET',r=>r.headers['x-forwarded-proto']='http',r=>r.headers.host='localhost:5000']){const r=req();change(r);a.equal(accept(r,origin),false);}});
test('no forwarding before hostname known',()=>a.equal(accept(req(),null),false));
test('strict trust and no user credential/agent inheritance',()=>{const args=sshArgs(54321,'C:/private/known_hosts');a.ok(args.includes('StrictHostKeyChecking=yes'));a.ok(args.includes('IdentityAgent=none'));a.ok(args.includes('nokey@localhost.run'));a.ok(!args.includes('StrictHostKeyChecking=no'));a.throws(()=>sshArgs(5000,'x'));a.throws(()=>sshArgs(3000,'x'));});
