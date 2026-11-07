'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('./policy.cjs'),vectors=require('./password-vectors.json');
const base=()=>({maintenanceUser:'postgres',maintenancePassword:'x',appPassword:'Synthetic-App-Only-Password-42!',ownerPassword:'Synthetic-Owner-Only-Password-73!'});
for(const field of ['APP','MIGRATOR'])for(const item of vectors)test(field+': '+item.name,()=>{
  if(item.reason)assert.throws(()=>P.newPassword(item.value,field),error=>error.guard==='NEW_'+field+'_PASSWORD_'+item.reason);
  else assert.doesNotThrow(()=>P.newPassword(item.value,field));
});
test('existing maintenance password does not inherit new password policy',()=>{
  for(const value of ['x','123','existing maintenance with spaces','পুরোনো'])assert.doesNotThrow(()=>P.credentials({...base(),maintenancePassword:value}));
});
test('existing maintenance password keeps its separate input guard',()=>{
  for(const value of ['',null,'x'.repeat(513)])assert.throws(()=>P.credentials({...base(),maintenancePassword:value}),error=>error.guard==='MAINTENANCE_PASSWORD_REQUIRED');
});
test('backend diagnostic names only the failing new field and predicate',()=>{
  for(const [key,field] of [['appPassword','APP'],['ownerPassword','MIGRATOR']])assert.throws(()=>P.credentials({...base(),[key]:'short'}),error=>{
    const safe=P.safeFailure(error);assert.equal(safe.guard,'NEW_'+field+'_PASSWORD_SIZE_POLICY');assert(!JSON.stringify(safe).includes('short'));assert(!JSON.stringify(safe).includes('length'));return true;
  });
});
test('distinct private credentials remain mandatory',()=>{const value=base();assert.throws(()=>P.credentials({...value,ownerPassword:value.appPassword}),error=>error.guard==='DISTINCT_PRIVATE_PASSWORDS_REQUIRED');});
