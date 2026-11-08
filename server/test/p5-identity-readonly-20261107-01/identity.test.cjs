'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const policy = require('../p5-setup-v05/policy.cjs');
const row = {database:'postgres',role:'postgres',address:'127.0.0.1',port:5432,oid:5};
test('original guard accepts exact identity', () => assert.doesNotThrow(() => policy.identity(row,'postgres','postgres')));
test('documented inet text netmask reproduces the exact original rejection', () => {
  assert.throws(() => policy.identity({...row,address:'127.0.0.1/32'},'postgres','postgres'), {guard:'SERVER_IDENTITY_MISMATCH'});
});
for (const [field,value] of [['database','other'],['role','other'],['address','127.0.0.2'],['address','::1'],['port',5433],['port','5432']]) {
  test(`strict ${field} rejection remains (${String(value)})`, () => assert.throws(() => policy.identity({...row,[field]:value},'postgres','postgres'), {guard:'SERVER_IDENTITY_MISMATCH'}));
}
test('OID is a separate later guard', () => assert.throws(() => policy.identity({...row,oid:34701},'postgres','postgres'), {guard:'DATABASE_OID_MISMATCH'}));
test('diagnostic only compares original and proposed SQL representations inside read-only rollback', () => {
  const sql=fs.readFileSync(path.join(__dirname,'identity.sql'),'utf8');
  assert.match(sql,/^BEGIN READ ONLY;/);
  assert.match(sql,/inet_server_addr\(\)::text/);
  assert.match(sql,/host\(inet_server_addr\(\)\)/);
  assert.match(sql,/ROLLBACK;\s*$/);
  assert.doesNotMatch(sql,/\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|COMMIT)\b/i);
});
