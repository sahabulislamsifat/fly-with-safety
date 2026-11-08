'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {createRequire}=require('node:module');
const P=require('./policy.cjs');
const repo=path.resolve(__dirname,'../../..'),server=path.join(repo,'server'),out=path.join(repo,'output/phase5/p5-approved-setup-20261107-01');
const result={passed:false,stage:'private-input',database:P.database,oid:null,resourcesCreated:[],createdRoleOids:{},migrations:[],fixtureWrites:0,providerCalls:0,mainCloudAccess:false,normalServicesTouched:false,productionActivated:false};
const clients=[];let sequence=0,liveChild,deadline,asynchronousFailure,attempted=false;
const record=(stage,fields={})=>{if(asynchronousFailure)throw asynchronousFailure;result.stage=stage;fs.appendFileSync(path.join(out,'journal.jsonl'),JSON.stringify({sequence:++sequence,utc:new Date().toISOString(),stage,...fields})+'\n');};
function checkPins() {
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'pins.json'),'utf8'));
  for(const pin of manifest.files){const full=path.resolve(repo,pin.path);P.insist(full.startsWith(repo+path.sep),'PIN_PATH_REJECTED');P.insist(crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex').toUpperCase()===pin.sha256,'SOURCE_PIN_MISMATCH');}
  const expected=manifest.files.filter(pin=>/^server\/prisma\/migrations\/[^/]+\/migration.sql$/.test(pin.path)).map(pin=>pin.path.split('/')[3]).sort();
  const actual=fs.readdirSync(path.join(server,'prisma/migrations'),{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
  P.insist(expected.length===9 && JSON.stringify(expected)===JSON.stringify(actual),'MIGRATION_DIRECTORY_SET_CHANGED');
  for(const item of manifest.resolutions){const resolved=item.locator?fs.realpathSync(path.resolve(repo,item.locator)):createRequire(path.resolve(repo,item.from)).resolve(item.request);P.insist(resolved===path.resolve(repo,item.entry),'RUNTIME_RESOLUTION_CHANGED');}
  return manifest;
}
async function readInput(){let text='';for await(const chunk of process.stdin){text+=chunk;P.insist(Buffer.byteLength(text)<=4096,'PRIVATE_INPUT_TOO_LARGE');}const bytes=Buffer.from(text.trim(),'base64');P.insist(bytes.toString('base64')===text.trim(),'PRIVATE_INPUT_ENCODING');return P.credentials(JSON.parse(bytes.toString('utf8')));}
async function connect(user,password,target,timeout){const {Client}=require('../../node_modules/pg');const client=new Client(P.configuration(user,password,target,timeout));clients.push(client);let scram=false;client.connection.on('authenticationSASL',()=>{scram=true;});client.on('error',error=>{asynchronousFailure=error;});await client.connect();if([P.app,P.owner].includes(user))P.insist(scram,'PASSWORD_AUTHENTICATION_NOT_VERIFIED');return client;}
async function getIdentity(client,target,user,oid){const {rows}=await client.query(`SELECT current_database() AS database,current_user::text AS role,inet_server_addr()::text AS address,inet_server_port() AS port,(SELECT oid::int FROM pg_database WHERE datname=current_database()) AS oid`);P.insist(rows.length===1,'IDENTITY_CARDINALITY');P.identity(rows[0],target,user,oid);return rows[0];}
async function verifyRoleOids(client){const rows=(await client.query(`SELECT rolname,oid::int AS oid FROM pg_roles WHERE rolname=ANY($1::text[])`,[[P.owner,P.app]])).rows;P.insist(rows.length===2 && rows.every(row=>result.createdRoleOids[row.rolname]===row.oid),'NEW_ROLE_IDENTITY_CHANGED');}
async function roleFlags(client,name){const {rows}=await client.query(`SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=$1`,[name]);P.insist(rows.length===1,'ROLE_CARDINALITY');const row=rows[0];P.insist(row.rolcanlogin && !row.rolsuper && !row.rolcreatedb && !row.rolcreaterole && !row.rolreplication && !row.rolbypassrls && !row.rolinherit,'RESTRICTED_ROLE_FLAGS');return row;}
async function migrations(password,oid){
  const env={};for(const key of ['SystemRoot','WINDIR','ProgramData','ProgramFiles','ProgramFiles(x86)','TEMP','TMP','PATH','PATHEXT','USERPROFILE','APPDATA','LOCALAPPDATA'])if(process.env[key])env[key]=process.env[key];
  const manifest=checkPins();
  Object.assign(env,{P5_APPROVED_OWNER_URL:P.ownerUrl(password),P5_ACTUAL_OID:String(oid),P5_APPROVED_MIGRATION:'true',PRISMA_HIDE_UPDATE_MESSAGE:'1',CHECKPOINT_DISABLE:'1',PRISMA_SCHEMA_ENGINE_BINARY:path.resolve(repo,manifest.engine)});
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[path.join(server,'node_modules/prisma/build/index.js'),'migrate','deploy','--config',path.join(__dirname,'prisma.config.ts')],{cwd:server,env,windowsHide:true,stdio:['ignore','pipe','pipe']});liveChild=child;
    let code=null,bytes=0; const collect=chunk=>{bytes+=chunk.length;const match=chunk.toString().match(/\bP[0-9]{4}\b/);if(match)code=match[0];};child.stdout.on('data',collect);child.stderr.on('data',collect);
    const timer=setTimeout(()=>{child.kill();reject(Object.assign(Error('MIGRATION_DEADLINE'),{guard:'MIGRATION_DEADLINE'}));},240000);
    child.once('error',()=>{clearTimeout(timer);reject(Object.assign(Error('MIGRATION_START_FAILED'),{guard:'MIGRATION_START_FAILED'}));});
    child.once('close',exitCode=>{clearTimeout(timer);liveChild=undefined;result.migrationExit=exitCode;result.migrationOutputBytes=bytes;if(exitCode===0)resolve();else reject(Object.assign(Error('MIGRATION_FAILED'),{guard:'MIGRATION_FAILED',prismaCode:code,exitCode}));});
  });
}
async function work(input,pins){
  record('maintenance-identity');const admin=await connect(input.maintenanceUser,input.maintenancePassword,'postgres',30000);await admin.query("SET statement_timeout='5s'");await getIdentity(admin,'postgres',input.maintenanceUser);
  const audit=(await admin.query(`SELECT current_setting('pgaudit.log',true) AS audit,current_setting('server_version') AS version,coalesce(current_setting('scram_iterations',true),'4096')::int AS iterations,(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser`)).rows[0];
  P.insist(audit.superuser===true,'PRIVATE_MAINTENANCE_SUPERUSER_REQUIRED');P.insist(!audit.audit || audit.audit==='none','AUDIT_LOGGING_REQUIRES_PRIVATE_REVIEW');
  const iterations=Math.max(4096,audit.iterations);P.insist(Number.isSafeInteger(iterations) && iterations<=100000,'SCRAM_POLICY_REQUIRES_REVIEW');result.serverVersion=audit.version;result.scramIterations=iterations;
  // Session-local log suppression before credential-verifier DDL. Never changes cluster settings.
  await admin.query(`SET log_statement='none'; SET log_duration=off; SET log_min_duration_statement=-1; SET log_min_duration_sample=-1; SET log_transaction_sample_rate=0; SET log_parameter_max_length=0; SET log_parameter_max_length_on_error=0; SET log_min_error_statement='panic'`);
  record('readonly-name-conflict-check');await admin.query('BEGIN READ ONLY');
  const conflicts=(await admin.query(`SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname=$1) AS database_exists,EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$2) AS app_role_exists,EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$3) AS owner_role_exists`,[P.database,P.app,P.owner])).rows[0];
  await admin.query('ROLLBACK');result.catalog=conflicts;P.insist(Object.values(conflicts).every(value=>value===false),'EXISTING_RESOURCE_CONFLICT');
  checkPins();await admin.query("SET statement_timeout='30s'");record('create-new-roles');
  await admin.query('BEGIN');try{
    for(const [name,password]of[[P.owner,input.ownerPassword],[P.app,input.appPassword]]){
      const digest=P.verifier(password,undefined,iterations);await admin.query(`CREATE ROLE ${name} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '${digest}'`);
    }await admin.query('COMMIT');result.resourcesCreated.push(P.owner,P.app);
  }catch(error){await admin.query('ROLLBACK').catch(()=>{});throw error;}
  const createdRoles=(await admin.query(`SELECT rolname,oid::int AS oid FROM pg_roles WHERE rolname=ANY($1::text[])`,[[P.owner,P.app]])).rows;P.insist(createdRoles.length===2,'CREATED_ROLE_CARDINALITY');for(const row of createdRoles)result.createdRoleOids[row.rolname]=row.oid;
  record('create-empty-database');await admin.query(`CREATE DATABASE ${P.database} OWNER ${P.owner} TEMPLATE template0 ENCODING 'UTF8'`);result.resourcesCreated.push(P.database);
  await admin.query(`REVOKE ALL ON DATABASE ${P.database} FROM PUBLIC; GRANT CONNECT ON DATABASE ${P.database} TO ${P.app}; ALTER ROLE ${P.owner} LOGIN`);
  record('new-database-owner-and-oid');const ddlAdmin=await connect(input.maintenanceUser,input.maintenancePassword,P.database,30000);const target=await getIdentity(ddlAdmin,P.database,input.maintenanceUser);result.oid=target.oid;
  const actualOwner=(await ddlAdmin.query(`SELECT pg_get_userbyid(datdba) AS owner,datdba::int AS owner_oid FROM pg_database WHERE datname=current_database()`)).rows[0];P.insist(actualOwner.owner===P.owner && actualOwner.owner_oid===result.createdRoleOids[P.owner],'DATABASE_OWNER_MISMATCH');
  P.insist((await ddlAdmin.query(`SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')`)).rows[0].count===0,'DATABASE_NOT_EMPTY');
  await ddlAdmin.query(`ALTER SCHEMA public OWNER TO ${P.owner}; REVOKE CREATE ON SCHEMA public FROM PUBLIC`);
  const owner=await connect(P.owner,input.ownerPassword,P.database,30000);await getIdentity(owner,P.database,P.owner,result.oid);
  record('nine-pinned-migrations');await verifyRoleOids(admin);await migrations(input.ownerPassword,result.oid);await getIdentity(owner,P.database,P.owner,result.oid);
  const expected=pins.files.filter(pin=>/^server\/prisma\/migrations\/[^/]+\/migration.sql$/.test(pin.path));
  const applied=(await owner.query(`SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back,logs IS NOT NULL AS has_logs FROM public."_prisma_migrations" ORDER BY migration_name`)).rows;
  result.migrations=applied;
  P.insist(applied.length===9 && expected.length===9,'MIGRATION_COUNT_MISMATCH');
  for(const row of applied){const pin=expected.find(p=>p.path.split('/')[3]===row.migration_name);P.insist(pin && row.finished && !row.rolled_back && row.checksum.toUpperCase()===pin.sha256,'MIGRATION_IDENTITY_MISMATCH');}
  record('schema-integrity');
  const enums=(await owner.query(`SELECT t.typname,e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname IN ('UserRole','IdentityDepartment') ORDER BY t.typname,e.enumsortorder`)).rows;
  P.insist(JSON.stringify(enums.filter(x=>x.typname==='UserRole').map(x=>x.enumlabel))===JSON.stringify(['CUSTOMER','STAFF','ADMIN','SUPER_ADMIN']),'ROLE_ENUM_MISMATCH');
  P.insist(JSON.stringify(enums.filter(x=>x.typname==='IdentityDepartment').map(x=>x.enumlabel))===JSON.stringify(['FLIGHT','HOTEL','VISA','PACKAGES','FINANCE','SUPPORT']),'DEPARTMENT_ENUM_MISMATCH');
  const p5Sql=fs.readFileSync(path.join(server,'prisma/migrations/20261107000100_identity_scope/migration.sql'),'utf8');const constraints=[...p5Sql.matchAll(/CONSTRAINT\s+"?(\w+)"?/g)].map(m=>m[1]);
  const actualConstraints=(await owner.query(`SELECT conname,convalidated FROM pg_constraint WHERE connamespace='public'::regnamespace AND conname=ANY($1::text[])`,[constraints])).rows;
  P.insist(actualConstraints.length===new Set(constraints).size && actualConstraints.every(c=>c.convalidated),'IDENTITY_CONSTRAINT_MISMATCH');
  const indexes=[...p5Sql.matchAll(/CREATE (?:UNIQUE )?INDEX "(\w+)"/g)].map(m=>m[1]);const actualIndexes=(await owner.query(`SELECT c.relname,i.indisvalid FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY($1::text[])`,[indexes])).rows;
  P.insist(actualIndexes.length===indexes.length && actualIndexes.every(i=>i.indisvalid),'IDENTITY_INDEX_MISMATCH');
  const trigger=(await owner.query(`SELECT t.tgenabled::text AS enabled,p.prosecdef AS definer FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid='public."IdentityAudit"'::regclass AND t.tgname='identity_audit_immutable'`)).rows;
  P.insist(trigger.length===1 && trigger[0].enabled==='O' && !trigger[0].definer,'AUDIT_TRIGGER_MISMATCH');
  const allTables=(await owner.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).rows.map(r=>r.tablename);
  P.insist(JSON.stringify(allTables)===JSON.stringify([...P.tables,'_prisma_migrations'].sort()),'TABLE_SET_MISMATCH');
  for(const table of P.tables)P.insist((await owner.query(`SELECT count(*)::int AS count FROM public."${table}"`)).rows[0].count===0,'UNEXPECTED_APPLICATION_ROWS');
  result.schema={roles:4,departments:6,applicationTables:P.tables.length,identityConstraints:constraints.length,identityIndexes:indexes.length,auditTrigger:true,allApplicationTablesEmpty:true};
  record('least-privilege-grants');await verifyRoleOids(admin);await owner.query('BEGIN');try{
    await owner.query(`GRANT USAGE ON SCHEMA public TO ${P.app}; GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${P.app}`);
    for(const table of P.mutable)await owner.query(`GRANT INSERT,UPDATE,DELETE ON public."${table}" TO ${P.app}`);
    for(const table of P.append)await owner.query(`GRANT INSERT ON public."${table}" TO ${P.app}`);
    await owner.query(`GRANT INSERT,UPDATE ON public."GatewayPayment" TO ${P.app}`);await owner.query('COMMIT');
  }catch(error){await owner.query('ROLLBACK').catch(()=>{});throw error;}
  await verifyRoleOids(admin);await admin.query(`ALTER ROLE ${P.app} LOGIN`);record('application-login-identity-and-acls');const app=await connect(P.app,input.appPassword,P.database);await getIdentity(app,P.database,P.app,result.oid);await verifyRoleOids(app);
  result.roles={app:await roleFlags(app,P.app),migration:await roleFlags(app,P.owner)};
  const permissions=(await app.query(`SELECT c.relname AS table,pg_get_userbyid(c.relowner) AS owner,has_table_privilege(current_user,c.oid,'SELECT') AS select,has_table_privilege(current_user,c.oid,'INSERT') AS insert,has_table_privilege(current_user,c.oid,'UPDATE') AS update,has_table_privilege(current_user,c.oid,'DELETE') AS delete,has_table_privilege(current_user,c.oid,'TRUNCATE') AS truncate FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname`)).rows;
  for(const row of permissions){const m=P.mutable.includes(row.table),a=P.append.includes(row.table),payment=row.table==='GatewayPayment';P.insist(row.owner===P.owner && row.select && row.insert===(m||a||payment) && row.update===(m||payment) && row.delete===m && !row.truncate,'TABLE_GRANT_MISMATCH');}
  const isolation=(await app.query(`SELECT has_schema_privilege(current_user,'public','CREATE') AS schema_create,has_database_privilege(current_user,current_database(),'CREATE') AS database_create,has_database_privilege(current_user,current_database(),'TEMP') AS temporary,pg_has_role(current_user,$1,'MEMBER') AS owner_membership`,[P.owner])).rows[0];
  P.insist(Object.values(isolation).every(value=>value===false),'APPLICATION_PRIVILEGE_ESCAPE');
  P.insist((await app.query(`SELECT count(*)::int AS count FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=ANY($1::text[])`,[[P.app,P.owner]])).rows[0].count===0,'UNEXPECTED_ROLE_MEMBERSHIP');
  result.grants=permissions;result.isolation=isolation;result.passed=true;record('setup-and-migration-verified');
}
async function main(){
  P.insist(process.argv.length===3 && process.argv[2]==='--owner-approved-setup','APPROVED_INVOCATION_REQUIRED');const pins=checkPins();const input=await readInput();
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'attempt.json'),JSON.stringify({startedUTC:new Date().toISOString(),scope:'APPROVED_SETUP_MIGRATION_ONLY'}),{flag:'wx'});attempted=true;
  deadline=setTimeout(()=>{asynchronousFailure=Object.assign(Error('SETUP_DEADLINE'),{guard:'SETUP_DEADLINE'});result.passed=false;result.failure=P.safeFailure(asynchronousFailure);if(liveChild)liveChild.kill();finish().finally(()=>process.exit(1));},330000);
  try{await work(input,pins);}catch(error){result.passed=false;result.failure=P.safeFailure(error);}
  finally{input.maintenancePassword='';input.ownerPassword='';input.appPassword='';clearTimeout(deadline);await finish();}
}
let finishing;
function finish(){return finishing||(finishing=(async()=>{const outcomes=await Promise.allSettled(clients.map(c=>c.end()));result.connectionsClosed=outcomes.every(x=>x.status==='fulfilled');if(!result.connectionsClosed){result.passed=false;result.failure ||= {guard:'CONNECTION_CLOSE_UNCONFIRMED'};}result.currentStageOutcomeUnconfirmed=!result.passed;result.finishedUTC=new Date().toISOString();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,stage:result.stage,oid:result.oid,resourcesCreated:result.resourcesCreated,migrations:result.migrations.length,schema:result.schema,connectionsClosed:result.connectionsClosed,failure:result.failure||null,fixtureWrites:0,providerCalls:0}));process.exitCode=result.passed?0:1;})());}
main().catch(error=>{console.log(JSON.stringify({passed:false,stage:attempted?result.stage:'before-network',failure:P.safeFailure(error)}));process.exitCode=1;});
