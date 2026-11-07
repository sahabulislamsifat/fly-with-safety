'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('./policy.cjs');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const run=read('run.cjs'),caller=read('Invoke-ApprovedSetup-v06.ps1');
const row={database:'postgres',role:'postgres',address:'127.0.0.1',port:5432,oid:5};
test('only runtime correction is inet host extraction plus output version',()=>{
  const prior=fs.readFileSync(path.join(__dirname,'../p5-setup-v05/run.cjs'),'utf8');
  assert.equal(run,prior.replaceAll('p5-approved-setup-20261107-05','p5-approved-setup-20261107-06').replace('inet_server_addr()::text AS address','host(inet_server_addr()) AS address'));
});
test('all original policy and credentials guards are byte-identical',()=>assert.equal(read('policy.cjs'),fs.readFileSync(path.join(__dirname,'../p5-setup-v05/policy.cjs'),'utf8')));
test('live diagnostic proves corrected exact identity and rollback',()=>{
  const text=fs.readFileSync(path.join(__dirname,'../../../output/phase5/p5-identity-readonly-20261107-01/identity.txt'),'utf8');
  const observed=JSON.parse(text.split(/\r?\n/).find(line=>line.startsWith('{')));
  assert.equal(observed.addressAsV05Text,'127.0.0.1/32');assert.equal(observed.addressAsHost,'127.0.0.1');
  for(const k of ['databaseMatches','roleMatches','sessionRoleMatches','hostAddressMatches','portMatches'])assert.equal(observed[k],true);
  assert.equal(observed.transactionReadOnly,'on');assert.match(text,/ROLLBACK/);
  assert.doesNotThrow(()=>P.identity({...row,address:observed.addressAsHost},'postgres','postgres'));
});
for(const [key,value]of[['database','other'],['role','other'],['address','127.0.0.1/32'],['address','127.0.0.2'],['address','::1'],['port','5432'],['port',5433]]){
  test(`identity stays strict: ${key}=${value}`,()=>assert.throws(()=>P.identity({...row,[key]:value},'postgres','postgres'),{guard:'SERVER_IDENTITY_MISMATCH'}));
}
test('protected or different OID remains rejected',()=>{for(const oid of [34701,0,null])assert.throws(()=>P.identity({...row,oid},'postgres','postgres'),{guard:'DATABASE_OID_MISMATCH'});assert.throws(()=>P.identity(row,'postgres','postgres',99),{guard:'DATABASE_OID_MISMATCH'});});
test('caller and child retain exact approval, order, containment and private wire contracts',()=>{
  assert.match(caller,/param\(\[switch\]\$OwnerApprovedSetup\)/);assert.match(caller,/run.cjs'\)\+'" --owner-approved-setup'/);
  assert.match(run,/process.argv.length===3 && process.argv\[2\]==='--owner-approved-setup'/);
  assert(caller.indexOf('$job.Attach($process.Handle)')<caller.indexOf('$process.StandardInput.WriteLine'));
  assert(caller.indexOf('Read-P5ValidatedSetupInput')<caller.indexOf('$process.Start()'));
  assert.match(caller,/FwsP5OwnedJobV06/);assert.match(caller,/APPROVED_SETUP_MIGRATION_ONLY_V06/);
  assert.match(caller,/p5-approved-setup-20261107-06/);assert.doesNotMatch(caller,/ExecutionPolicy|Unblock-File/);
});
test('conflict guard precedes all creation and migration guards remain',()=>{
  assert(run.indexOf('EXISTING_RESOURCE_CONFLICT')<run.indexOf('CREATE ROLE'));
  for(const name of ['MIGRATION_DIRECTORY_SET_CHANGED','DATABASE_NOT_EMPTY','DATABASE_OWNER_MISMATCH','MIGRATION_COUNT_MISMATCH','MIGRATION_IDENTITY_MISMATCH','RESTRICTED_ROLE_FLAGS','UNEXPECTED_ROLE_MEMBERSHIP'])assert(run.includes(name));
  assert.match(caller,/FileMode\]::CreateNew/);assert.match(caller,/WaitForExit\(345000\)/);assert.match(run,/,330000\)/);
});
