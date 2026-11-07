'use strict';
// Approved local integration only. No environment-file or credential discovery.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const repo=path.resolve(__dirname,'../../..'),out=path.join(repo,'output/phase5/p5-integration-20261107-01');
const expected={database:'flywithsafety_p5_identity_scope_test',role:'fws_p5_identity_app',oid:35402,address:'127.0.0.1',port:5432};
const state={passed:false,stage:'private-input',identity:null,migrations:0,postgres:null,rollbackPreservation:false,providerCalls:0,cloudAccess:false,browserExecuted:false};
let client,child,timer;
function insist(value,guard){if(!value)throw Object.assign(Error(guard),{guard});}
function checkIdentity(row){insist(row&&row.database===expected.database&&row.role===expected.role&&row.oid===expected.oid&&row.address===expected.address&&row.port===expected.port&&row.sessionRole===expected.role&&!row.unsafe,'EXACT_RUNTIME_IDENTITY_REQUIRED');}
const identitySql=`SELECT current_database() AS database,current_user::text AS role,session_user::text AS "sessionRole",host(inet_server_addr()) AS address,inet_server_port() AS port,(SELECT oid::int FROM pg_database WHERE datname=current_database()) AS oid,(SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS unsafe`;
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
function verifyPins(){const pins=JSON.parse(fs.readFileSync(path.join(__dirname,'pins.json')));for(const item of pins.files)insist(sha(path.join(repo,item.path))===item.sha256,'INTEGRATION_PIN_MISMATCH');insist(sha(pins.node.path)===pins.node.sha256,'NODE_PIN_MISMATCH');return pins;}
async function connect(password){const{Client}=require('../../node_modules/pg');client=new Client({host:'127.0.0.1',port:5432,database:expected.database,user:expected.role,password,connectionTimeoutMillis:5000,statement_timeout:5000,query_timeout:6000,application_name:'FWS_P5_APPROVED_INTEGRATION',options:'-c default_transaction_read_only=on -c search_path=pg_catalog,public -c lock_timeout=2000'});client.on('error',()=>{});await client.connect();}
async function observe(password,initial){await connect(password);try{
  await client.query('BEGIN READ ONLY');
  const row=(await client.query(identitySql)).rows[0];checkIdentity(row);state.identity=row;
  const migrations=(await client.query(`SELECT migration_name,checksum FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`)).rows;
  const expectedMigrations=fs.readdirSync(path.join(repo,'server/prisma/migrations'),{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>({migration_name:x.name,checksum:sha(path.join(repo,'server/prisma/migrations',x.name,'migration.sql')).toLowerCase()})).sort((a,b)=>a.migration_name.localeCompare(b.migration_name));
  insist(expectedMigrations.length===9&&JSON.stringify(migrations)===JSON.stringify(expectedMigrations),'MIGRATION_SET_OR_CHECKSUM_MISMATCH');state.migrations=migrations.length;
  const baseline=JSON.parse(fs.readFileSync(path.join(repo,'output/phase5/p5-approved-setup-20261107-06/result.json')));
  insist(baseline.passed&&baseline.oid===35402,'SETUP_RECEIPT_REQUIRED');
  const grants=(await client.query(`SELECT c.relname AS table,pg_get_userbyid(c.relowner) AS owner,has_table_privilege(current_user,c.oid,'SELECT') AS select,has_table_privilege(current_user,c.oid,'INSERT') AS insert,has_table_privilege(current_user,c.oid,'UPDATE') AS update,has_table_privilege(current_user,c.oid,'DELETE') AS delete,has_table_privilege(current_user,c.oid,'TRUNCATE') AS truncate FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname`)).rows;
  insist(JSON.stringify(grants)===JSON.stringify(baseline.grants),'RUNTIME_ACL_CHANGED');
  const {tables}=require('../p5-setup-v06/policy.cjs');
  for(const table of tables){insist(/^[A-Za-z]+$/.test(table),'TABLE_IDENTIFIER_REJECTED');const count=(await client.query(`SELECT count(*)::int AS count FROM public."${table}"`)).rows[0].count;insist(count===0,initial?'TARGET_NOT_EMPTY_STOP_WITHOUT_ADOPTION':'ROLLBACK_PRESERVATION_FAILED');}
  await client.query('ROLLBACK');if(!initial)state.rollbackPreservation=true;
}finally{await client.end();client=undefined;}}
async function execute(password,pins){
  const url=new URL('postgresql://127.0.0.1:5432/'+expected.database);url.username=expected.role;url.password=password;
  const env={};for(const name of ['SystemRoot','WINDIR','ProgramData','ProgramFiles','ProgramFiles(x86)','TEMP','TMP','PATH','PATHEXT','USERPROFILE','APPDATA','LOCALAPPDATA'])if(process.env[name])env[name]=process.env[name];
  Object.assign(env,{NODE_ENV:'test',P5_DISPOSABLE_EXECUTION_APPROVED:'true',P5_DISPOSABLE_DATABASE_URL:url.href,P5_EXPECTED_DATABASE:expected.database,P5_EXPECTED_ROLE:expected.role,P5_EXPECTED_OID:'35402',CHECKPOINT_DISABLE:'1'});
  const parsed=await new Promise((resolve,reject)=>{
    child=spawn(pins.node.path,[path.join(repo,'server/node_modules/vitest/vitest.mjs'),'run','--config','test/p5-postgres.vitest.config.ts','--reporter=json'],{cwd:path.join(repo,'server'),env,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let stdout='',bytes=0;child.stdout.on('data',b=>{bytes+=b.length;if(bytes>2000000){child.kill();reject(Object.assign(Error('OUTPUT_CAP'),{guard:'OUTPUT_CAP'}));}else stdout+=b;});child.stderr.resume();
    child.once('error',()=>reject(Object.assign(Error('TEST_START_FAILED'),{guard:'TEST_START_FAILED'})));
    child.once('close',code=>{child=undefined;try{const r=JSON.parse(stdout);resolve({exitCode:code,passed:r.numPassedTests,failed:r.numFailedTests,skipped:r.numPendingTests,total:r.numTotalTests,success:r.success});}catch{reject(Object.assign(Error('SANITIZED_TEST_RESULT_UNAVAILABLE'),{guard:'SANITIZED_TEST_RESULT_UNAVAILABLE'}));}});
  });state.postgres=parsed;
}
async function main(){
  insist(process.argv.length===3&&process.argv[2]==='--owner-approved-integration','APPROVED_INVOCATION_REQUIRED');const pins=verifyPins();
  let wire='';for await(const chunk of process.stdin){wire+=chunk;insist(wire.length<=4096,'PRIVATE_INPUT_TOO_LARGE');}const input=JSON.parse(Buffer.from(wire.trim(),'base64').toString('utf8'));wire='';insist(typeof input.password==='string'&&input.password.length>0&&input.password.length<=512,'EXISTING_RUNTIME_PASSWORD_REQUIRED');
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'attempt.json'),JSON.stringify({utc:new Date().toISOString(),scope:'APPROVED_PREFLIGHT_AND_EXISTING_ROLLBACK_TEST'}),{flag:'wx'});
  timer=setTimeout(()=>{if(child)child.kill();state.failure={guard:'INTEGRATION_DEADLINE'};fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(state,null,2));process.exit(1);},100000);
  try{state.stage='readonly-target-preflight';await observe(input.password,true);state.stage='existing-postgres-rollback-test';await execute(input.password,pins);state.stage='readonly-final-preservation';await observe(input.password,false);insist(state.postgres.exitCode===0&&state.postgres.total===1&&state.postgres.passed===1&&state.postgres.failed===0&&state.postgres.skipped===0,'POSTGRES_TEST_NOT_PASS');state.passed=true;state.stage='SCOPED_POSTGRES_PASS_NOT_FULL_P5_ACCEPTANCE';}
  catch(error){state.failure={guard:error.guard||'LOCAL_OPERATION_FAILED',sqlState:/^[0-9A-Z]{5}$/.test(error.code||'')?error.code:null};}
  finally{input.password='';clearTimeout(timer);if(client)await client.end().catch(()=>{});fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(state,null,2));console.log(JSON.stringify(state));process.exitCode=state.passed?0:1;}
}
module.exports={checkIdentity,identitySql};
if(require.main===module)main().catch(()=>{console.log('{"passed":false,"stage":"before-test","failure":{"guard":"PREPARATION_OR_INPUT_GUARD"}}');process.exitCode=1;});
