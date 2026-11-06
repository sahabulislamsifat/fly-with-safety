import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import pg from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../src/generated/prisma/client.js';
import {assertLocalURL,preflight,preserve,originalCatalogSQL,catalogSQL} from './phase3-db-preflight-v02.js';
import {preflightFailure} from './phase3-db-preflight-diagnostics.js';
import {errorDataField} from '../src/utils/error-fields.js';
import type {Plan} from './phase3-genuine/scope.js';
const repo=resolve(__dirname,'../..'),base=resolve(repo,'output/phase3/db-preflight-readonly-20261104-01');
async function main(){
 if(process.argv[2]!=='--owner-approved-readonly-preflight'||process.env.PHASE3_READONLY_APPROVED!=='true')throw Error('READONLY_APPROVAL_REQUIRED');
 assertLocalURL(process.env.DATABASE_URL||'');if(process.env.DIRECT_URL!==process.env.DATABASE_URL)throw Error('URL_PARITY_REQUIRED');
 if(existsSync(resolve(base,'attempt.json'))||existsSync(resolve(base,'result.json')))throw Error('CONSUMED_NO_RETRY');
 const plan=JSON.parse(readFileSync(resolve(repo,'output/phase3/genuine-sandbox-e2e-20261104-01/fixture-plan.json'),'utf8').replace(/^\uFEFF/,'')) as Plan;
 writeFileSync(resolve(base,'attempt.json'),JSON.stringify({at:new Date().toISOString(),readOnly:true}),{flag:'wx'});
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000,statement_timeout:10000,query_timeout:15000,options:'-c default_transaction_read_only=on'}),db=new PrismaClient({adapter:new PrismaPg(pool)});
 let operation='native-readonly-identity',failure:object|null=null,identity=false,nativeChar=false,catalogRows=0,snapshotSerializable=false,rollback=false,guards:object|null=null;
 const completed:string[]=[],rollbackSentinel=Error('CONTROLLED_READONLY_ROLLBACK');
 const timeout=setTimeout(()=>{process.stderr.write('STOP: read-only verification deadline; preserve evidence\n');void pool.end();},90000);
 try{
 const r=await pool.query("SELECT current_database() AS db,current_user AS role,(SELECT oid::int FROM pg_database WHERE datname=current_database()) AS oid,host(inet_server_addr()) AS host,inet_server_port() AS port,current_setting('transaction_read_only') AS ro");
 const v=r.rows[0];if(r.rows.length!==1||v.db!=='flywithsafety_local_integration'||v.role!=='flywithsafe_phase2_booking_test'||v.oid!==34701||v.host!=='127.0.0.1'||v.port!==5432||v.ro!=='on')throw Error('NATIVE_READONLY_IDENTITY_MISMATCH');identity=true;completed.push(operation);
 operation='native-original-catalog';const original=await pool.query(originalCatalogSQL);nativeChar=original.fields.some(f=>f.name==='relkind'&&f.dataTypeID===18);if(!nativeChar||!original.rowCount)throw Error('CATALOG_TYPE_EXPECTATION_MISMATCH');completed.push(operation);
 await db.$transaction(async tx=>{
 operation='transaction-readonly-guard';await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');const ro=await tx.$queryRawUnsafe<Array<{ro:string}>>("SELECT current_setting('transaction_read_only') AS ro");if(ro[0]?.ro!=='on')throw Error('READONLY_NOT_ACTIVE');
 // Only read delegates/raw SELECTs used by the unchanged guards/snapshot helpers.
 const observed=new Proxy(tx,{get(target,key){const value=Reflect.get(target,key);if(key==='$queryRawUnsafe')return(sql:string,...args:unknown[])=>{operation=sql===catalogSQL?'prisma-corrected-catalog':sql.includes('pg_roles')?'prisma-role-or-permission':sql.includes('_prisma_migrations')?'prisma-migrations':sql.includes('current_database')?'prisma-identity':sql.includes('pg_trigger')?'prisma-payment-permissions':'prisma-protected-row-select';return Promise.resolve(Reflect.apply(value,target,[sql,...args])).then((r:unknown)=>{completed.push(operation);return r;});};if(typeof key==='string'&&!key.startsWith('$')&&value&&typeof value==='object')return new Proxy(value,{get(delegate,method){const fn=Reflect.get(delegate,method);if(typeof fn!=='function')return fn;return(...args:unknown[])=>{if(!['findMany','count'].includes(String(method)))throw Error('READONLY_DELEGATE_REQUIRED');operation=`read-${key}-${String(method)}`;return Reflect.apply(fn,delegate,args);};}});if(typeof value==='function')return()=>{throw Error('READONLY_METHOD_REQUIRED');};return value;}});
 guards=await preflight(observed as unknown as PrismaClient,plan,repo);
 const snapshot=await preserve(observed as unknown as PrismaClient,plan);catalogRows=(snapshot.catalog as unknown[]).length;JSON.stringify(snapshot);snapshotSerializable=true;completed.push('protected-snapshot-json-serializable');throw rollbackSentinel;
 },{maxWait:5000,timeout:60000});
 }catch(e){if(e===rollbackSentinel){rollback=true;}else{const message=errorDataField(e,'message');failure={...preflightFailure(e,operation),guard:typeof message==='string'&&['NATIVE_READONLY_IDENTITY_MISMATCH','CATALOG_TYPE_EXPECTATION_MISMATCH','READONLY_NOT_ACTIVE','READONLY_DELEGATE_REQUIRED','READONLY_METHOD_REQUIRED','LIVE_IDENTITY_MISMATCH','MIGRATION_HISTORY_MISMATCH','EXACT_ACTORS_REQUIRED','UNLISTED_NOTIFICATION_RECIPIENT','FIXTURE_PREEXISTS_NO_RETRY','RESTRICTED_PERMISSIONS_MISMATCH','PAYMENT_ACCESS_OR_TRIGGER_MISMATCH'].includes(message)?message:null};}}
 finally{clearTimeout(timeout);await db.$disconnect().catch(()=>{});await pool.end().catch(()=>{});}
 const result={passed:!failure&&identity&&nativeChar&&snapshotSerializable&&rollback,failure,identityVerified:identity,nativeOriginalCatalogCharOID18:nativeChar,correctedCatalogRows:catalogRows,snapshotSerializable,controlledRollback:rollback,guards,completed,financialWrites:0,providerCalls:0,publicConnections:0,mainCloudAccess:false,normalServicesTouched:false};writeFileSync(resolve(base,'result.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));process.exitCode=result.passed?0:1;
}
if(require.main===module)main().catch(()=>{console.error('STOP: read-only preflight incomplete; preserve evidence; no retry');process.exitCode=1;});

