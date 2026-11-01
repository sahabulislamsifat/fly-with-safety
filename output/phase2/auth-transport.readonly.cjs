const fs = require('node:fs'), path = require('node:path'), { createRequire } = require('node:module');
async function probe(factory, password) {
  let client, stage = 'connect', passed = false, failure = null, disconnectFailed = false;
  try {
    if (!password) throw new Error('PRIVATE_INPUT_MISSING');
    client = factory({ host: '127.0.0.1', port: 5432, database: 'flywithsafe_phase2_booking_integration', user: 'flywithsafe_phase2_booking_test',
      password, ssl: false, connectionTimeoutMillis: 5000, query_timeout: 5000 });
    client.on('error', () => {});
    await client.connect(); stage = 'readonly'; await client.query('BEGIN READ ONLY');
    stage = 'identity';
    const { rows } = await client.query("SELECT current_database() AS db,current_user AS role,session_user AS session,host(inet_server_addr()) AS host,inet_server_port() AS port,current_setting('transaction_read_only') AS ro");
    const row = rows.length === 1 ? rows[0] : null;
    if (!row || row.db !== 'flywithsafe_phase2_booking_integration' || row.role !== 'flywithsafe_phase2_booking_test' || row.session !== row.role || row.host !== '127.0.0.1' || row.port !== 5432 || row.ro !== 'on') throw new Error('IDENTITY_MISMATCH');
    stage = 'rollback'; await client.query('ROLLBACK'); passed = true;
  } catch (error) {
    const code = Object.getOwnPropertyDescriptor(error || {}, 'code')?.value;
    failure = ['28P01','28000','42501','ECONNREFUSED','ECONNRESET','ETIMEDOUT'].includes(code) ? code : 'UNCLASSIFIED';
  } finally {
    try { await client?.end(); } catch { disconnectFailed = true; }
  }
  return { passed: passed && !disconnectFailed, stage, failure, disconnectFailed, readOnly: true };
}
async function offline() {
  const assert = require('node:assert/strict'); let passed = 0;
  for (const mode of ['success','authentication','identity','query']) {
    const calls = [], reference = 'synthetic-only:@/%';
    const result = await probe(config => {
      assert.equal(config.password === reference, true); assert.equal(config.ssl, false);
      return { on() {}, async connect() { if (mode === 'authentication') throw Object.assign(new Error('private'), {code:'28P01'}); },
        async query(sql) { calls.push(sql); if (mode === 'query') throw new Error('private'); return {rows:[{db:mode === 'identity'?'wrong':'flywithsafe_phase2_booking_integration',role:'flywithsafe_phase2_booking_test',session:'flywithsafe_phase2_booking_test',host:'127.0.0.1',port:5432,ro:'on'}]}; }, async end() {calls.push('END');} };
    }, reference);
    assert.equal(result.passed, mode === 'success'); assert.equal(calls.at(-1), 'END');
    if (mode === 'success') assert.equal(calls.at(-2), 'ROLLBACK');
    if (mode === 'authentication') assert.equal(result.failure, '28P01');
    assert.ok(!JSON.stringify(result).includes(reference)); passed++;
  }
  console.log(JSON.stringify({passed,failed:0,skipped:0,databaseExecuted:false}));
}
if (process.argv[2] === '--offline') offline().catch(() => {console.error('OFFLINE_TRANSPORT_STOP');process.exitCode=1;});
else if (process.argv[2] === '--owner-readonly') {
  const local = createRequire(path.resolve(__dirname, '../../server/package.json'));
  const { Client } = local('pg');
  probe(config => new Client(config), process.env.PGPASSWORD).then(result => {console.log(JSON.stringify(result));process.exitCode=result.passed?0:1;}).catch(() => {console.error('READONLY_TRANSPORT_STOP');process.exitCode=1;});
} else { console.error('EXPLICIT_READONLY_MODE_REQUIRED');process.exitCode=1; }
