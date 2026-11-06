import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import pg from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../src/generated/prisma/client.js';
import {assertLocalURL,preflight,preserve} from '../phase3-db-preflight-v02.js';
import {verifyRetained} from '../phase3-negative-v01/retained.js';
import {preflightFailure} from '../phase3-db-preflight-diagnostics.js';
import {errorDataField} from '../../src/utils/error-fields.js';
import type {Plan} from '../phase3-genuine-v02/scope.js';
import {checkFinancialRows} from './checks.js';
const repo=resolve(__dirname,'../../..'),base=resolve(repo,'output/phase3/final-local-reconciliation-20261104-01');
async function main(){
 globalThis.fetch=async()=>{throw Error('PROVIDER_NETWORK_DISABLED');};
 if(process.argv[2]!=='--owner-approved-final-local-reconciliation-v01'||process.env.PHASE3_FINAL_RECONCILIATION_APPROVED!=='true')throw Error('READONLY_APPROVAL_REQUIRED');
 assertLocalURL(process.env.DATABASE_URL||'');if(process.env.DIRECT_URL!==process.env.DATABASE_URL)throw Error('URL_PARITY_REQUIRED');
 if(existsSync(resolve(base,'attempt.json'))||existsSync(resolve(base,'result.json')))throw Error('CONSUMED_NO_RETRY');
 const plan=JSON.parse(readFileSync(resolve(repo,'output/phase3/negative-continuation-20261104-01/fixture-plan.json'),'utf8').replace(/^\uFEFF/,'')) as Plan;
 writeFileSync(resolve(base,'attempt.json'),JSON.stringify({at:new Date().toISOString(),readOnly:true,maxProviderQueries:0}),{flag:'wx'});
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000,statement_timeout:10000,query_timeout:15000,options:'-c default_transaction_read_only=on'}),db=new PrismaClient({adapter:new PrismaPg(pool)});
 let stage='local-readonly-identity',failure:object|null=null,before:unknown,after:unknown,guards:object|null=null,retained:Awaited<ReturnType<typeof verifyRetained>>|undefined,rollbacks=0,postcheckAttempted=false;
 async function snapshot(first:boolean){if(!first){if(postcheckAttempted)throw Error('POSTCHECK_ALREADY_ATTEMPTED');postcheckAttempted=true;}const sentinel=Error('CONTROLLED_ROLLBACK');try{await db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');const mode=await tx.$queryRawUnsafe<Array<{ro:string}>>("SELECT current_setting('transaction_read_only') AS ro");if(mode[0]?.ro!=='on')throw Error('READONLY_NOT_ACTIVE');const ro=tx as unknown as PrismaClient;if(first){guards=await preflight(ro,plan,repo);retained=await verifyRetained(ro,repo);}else await verifyRetained(ro,repo);const financialRows=await ro.$queryRawUnsafe<Array<{id:string;bookingId:string;status:string;captured:boolean;state:{status:string;captured:boolean;valId?:string;bankId?:string;currency:string;amountMinor:string}}>>(`SELECT id,"bookingId",status,(state->>'captured')::boolean AS captured,state FROM public."GatewayPayment" WHERE "bookingId" = ANY($1::text[])`,JSON.parse(readFileSync(resolve(repo,'output/phase3/genuine-sandbox-e2e-20261104-02/fixture-plan.json'),'utf8')).fixtures.map((f:{bookingId:string})=>f.bookingId));checkFinancialRows(financialRows);const snapshot=await preserve(ro,plan);if(first)before=JSON.stringify(snapshot);else after=JSON.stringify(snapshot);throw sentinel;},{maxWait:5000,timeout:30000});}catch(e){if(e===sentinel)rollbacks++;else throw e;}}
 try{
 const identity=await pool.query("SELECT current_database() AS db,current_user AS role,(SELECT oid::int FROM pg_database WHERE datname=current_database()) AS oid,host(inet_server_addr()) AS host,inet_server_port() AS port,current_setting('transaction_read_only') AS ro");const i=identity.rows[0];if(identity.rows.length!==1||i.db!=='flywithsafety_local_integration'||i.role!=='flywithsafe_phase2_booking_test'||i.oid!==34701||i.host!=='127.0.0.1'||i.port!==5432||i.ro!=='on')throw Error('READONLY_IDENTITY_MISMATCH');
 stage='retained-ownership-and-protected-baseline';await snapshot(true);if(!retained)throw Error('RETAINED_PROOF_REQUIRED');
 stage='final-readonly-preservation';await snapshot(false);if(before!==after)throw Error('PROTECTED_SNAPSHOT_CHANGED');
 }catch(e){const message=errorDataField(e,'message'),kind=errorDataField(e,'kind'),codes=['READONLY_NOT_ACTIVE','READONLY_IDENTITY_MISMATCH','RETAINED_PROOF_REQUIRED','PROTECTED_SNAPSHOT_CHANGED','RETAINED_FINANCIAL_COLUMNS_MISMATCH','RETAINED_SUCCESS_OR_UNRESOLVED_MISMATCH','EXACT_TWO_RETAINED_PAYMENTS_REQUIRED'];failure={...preflightFailure(e,stage),guard:typeof message==='string'&&codes.includes(message)?message:null,gatewayKind:typeof kind==='string'&&['UNAVAILABLE','AUTHENTICATION','MALFORMED','MISMATCH'].includes(kind)?kind:null};}
 finally{if(before!==undefined&&!postcheckAttempted){try{await snapshot(false);}catch(e){failure={...failure,postcheck:preflightFailure(e,'final-readonly-postcheck')};}}await db.$disconnect().catch(()=>{});await pool.end().catch(()=>{});}
 const result={passed:!failure&&rollbacks===2&&before===after,failure,stage,guards,retainedSummary:retained?.summary||null,providerCalls:0,providerStateSource:'saved-readback-only',observedProviderState:'PROCESSING',providerStateRequeried:false,controlledRollbacks:rollbacks,preservation:before!==undefined&&before===after,financialWrites:0,initiations:0,validations:0,refunds:0,publicConnections:0,mainCloudAccess:false,normalServicesTouched:false,oldPaymentMutated:false,phase3Accepted:false};writeFileSync(resolve(base,'result.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));process.exitCode=result.passed?0:1;
}
if(require.main===module)main().catch(()=>{console.error('STOP: local read-only proof incomplete; preserve evidence, no retry');process.exitCode=1;});


