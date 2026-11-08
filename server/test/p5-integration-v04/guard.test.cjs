'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict');
const{checkIdentity}=require('./run.cjs');
const good={database:'flywithsafety_p5_identity_scope_test',role:'fws_p5_identity_app',sessionRole:'fws_p5_identity_app',oid:35402,address:'127.0.0.1',port:5432,unsafe:false};
test('exact approved runtime identity accepted',()=>assert.doesNotThrow(()=>checkIdentity(good)));
for(const[key,value]of[['database','postgres'],['role','postgres'],['sessionRole','postgres'],['oid',34701],['oid',35403],['address','127.0.0.1/32'],['address','remote.example'],['port','5432'],['port',5433],['unsafe',true]])test(`reject mismatched ${key} ${value}`,()=>assert.throws(()=>checkIdentity({...good,[key]:value}),{guard:'EXACT_RUNTIME_IDENTITY_REQUIRED'}));
