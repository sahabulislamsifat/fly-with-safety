'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {boundary,paths}=require('./boundary.cjs');
test('real loopback only routes four callbacks; other paths never reach handler',async()=>{
 let delivered=0;const server=http.createServer((req,res)=>boundary(req,res,()=>{delivered++;req.resume();req.on('end',()=>{res.writeHead(204);res.end();});}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const port=server.address().port;assert.notEqual(port,5000);assert.notEqual(port,3000);
 for(const [method,path,status] of [...paths.map(p=>['POST',p,204]),['GET',paths[0],404],['POST','/api/v1/auth/login',404],['GET','/api/v1/admin',404],['POST','/api/v1/bookings',404],['POST',paths[0]+'?x=1',404]]){
 const actual=await new Promise((resolve,reject)=>{const r=http.request({hostname:'127.0.0.1',port,path,method,headers:{host:'phase3-callback.invalid','content-type':'application/x-www-form-urlencoded','content-length':3}},s=>{s.resume();s.on('end',()=>resolve(s.statusCode));});r.on('error',reject);r.end('x=1');});assert.equal(actual,status);
 }assert.equal(delivered,4);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
