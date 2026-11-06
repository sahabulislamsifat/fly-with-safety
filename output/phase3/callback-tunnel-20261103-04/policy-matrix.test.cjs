'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {handler,plan}=require('./probe.cjs'),{describe,passes}=require('./response-evidence.cjs');
for(const [i,item]of plan().entries())test('unchanged allow/deny case '+(i+1),()=>{
 const req=Object.assign(new EventEmitter(),{method:item.method,url:item.path,socket:{remoteAddress:'127.0.0.1'},headers:{host:'phase3-callback.invalid','content-type':item.type||'application/x-www-form-urlencoded','content-length':String(Buffer.byteLength(item.body||'')),...Object.fromEntries(Object.entries(item.headers||{}).map(([k,v])=>[k.toLowerCase(),v]))},setTimeout(){},destroy(){}});
 const res={headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(){this.ended=true;}};
 handler(req,res);if(!res.ended){req.emit('data',Buffer.from(item.body||''));req.emit('end');}
 assert.equal(passes(item,describe(res.statusCode,res.headers)),true);
});
