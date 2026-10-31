import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Pool, QueryResultRow } from 'pg';
import { PostgresProtectedAuthStore } from '../src/security/protected-auth.pg.js';
import { executeIssuanceRequest } from '../src/security/issuance-replay.js';
import { prepareProtectedIssuance, revokeProtectedCredentials } from '../src/security/protected-auth.js';
import type { EnvelopeKeys } from '../src/security/protected-envelope.js';

export const serviceTarget={host:'127.0.0.1',port:5432,database:'flywithsafe_phase1_schema_integration',role:'flywithsafe_phase1_service_test'} as const;
export interface FixtureRecord {userId:string;credentialId:string;jobId:string;sessionId:string;requestHash:string}
export type ServiceProofStage='preflight'|'concurrent-issuance'|'durable-replay'|'consumption'|'lease-fencing'|'revocation'|'rollback';
export interface ServiceProofApproval {approved:boolean;syntheticOnly:boolean;record:(record:FixtureRecord)=>Promise<void>;onStage?:(stage:ServiceProofStage)=>void}
/** Inert real-adapter proof. No Pool/env discovery, execution on import or cleanup.
 * Separate role/fixture/teardown authorization required. Does not close C16 lock-wait or wire evidence.
 */
export async function verifyProtectedServiceAdapters(pool:Pick<Pool,'connect'>,approval:ServiceProofApproval):Promise<string[]>{
 if(approval?.approved!==true||approval.syntheticOnly!==true||typeof approval.record!=='function')throw new Error('PHASE1_SERVICE_APPROVAL_REQUIRED');
 approval.onStage?.('preflight');
 const check=(ok:unknown,label:string)=>{if(!ok)throw new Error(label);};
 const db=await pool.connect().catch(()=>{throw new Error('PHASE1_SERVICE_CONNECTION_FAILED');});
 try{
  await db.query('BEGIN READ ONLY');
  await db.query("SET LOCAL statement_timeout='5s'");
  const {rows}=await db.query<{ok:boolean}>([
   'SELECT current_database()=$1 AND current_user=$2 AND session_user=$2',
   "AND host(inet_server_addr())='127.0.0.1' AND inet_server_port()=5432",
   'AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolinherit',
   'AND NOT r.rolreplication AND NOT r.rolbypassrls AND r.rolconnlimit=20',
   'AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid OR roleid=r.oid)',
   "AND NOT has_database_privilege(current_user,current_database(),'CREATE')",
   "AND NOT has_database_privilege(current_user,current_database(),'TEMP')",
   "AND NOT has_schema_privilege(current_user,'public','CREATE')",
   "AND has_function_privilege(current_user,'public.protected_envelope_shape(jsonb)','EXECUTE')",
   "AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['User','AuthSecurityState','ProtectedCredential','ProtectedAuthJob','Session','AuthIssuanceRequest']) needed(name)",
   "WHERE NOT has_table_privilege(current_user,format('public.%I',needed.name),'SELECT')",
   "OR NOT has_table_privilege(current_user,format('public.%I',needed.name),'INSERT')",
   "OR NOT has_table_privilege(current_user,format('public.%I',needed.name),'UPDATE'))",
   "AND NOT has_any_column_privilege(current_user,'public.\"NotificationQuarantine\"','INSERT,UPDATE,REFERENCES')",
   "AND NOT EXISTS(SELECT 1 FROM pg_class rel WHERE rel.relnamespace='public'::regnamespace AND rel.relkind IN('r','p')",
   "AND (rel.relowner=r.oid OR has_table_privilege(current_user,rel.oid,'DELETE,TRUNCATE,REFERENCES,TRIGGER')",
   "OR (rel.relname<>ALL(ARRAY['User','AuthSecurityState','ProtectedCredential','ProtectedAuthJob','Session','AuthIssuanceRequest','NotificationQuarantine'])",
   "AND has_any_column_privilege(current_user,rel.oid,'SELECT,INSERT,UPDATE,REFERENCES'))))",
   'AND NOT EXISTS(SELECT 1 FROM public."User")',
   'AND NOT EXISTS(SELECT 1 FROM public."ProtectedCredential")',
   'AND NOT EXISTS(SELECT 1 FROM public."ProtectedAuthJob")',
   'AND NOT EXISTS(SELECT 1 FROM public."Session")',
   'AND NOT EXISTS(SELECT 1 FROM public."AuthIssuanceRequest") AS ok',
   'FROM pg_roles r WHERE r.rolname=current_user',
  ].join(' '),[serviceTarget.database,serviceTarget.role]);
  check(rows.length===1&&rows[0].ok===true,'PHASE1_SERVICE_IDENTITY_OR_STATE_FAILED');
  await db.query('ROLLBACK');
 }catch{try{await db.query('ROLLBACK');}catch{/* No repair. */}throw new Error('PHASE1_SERVICE_PREFLIGHT_FAILED');}
 finally{db.release();}
 const dek=randomBytes(32),digestKey=randomBytes(32),store=new PostgresProtectedAuthStore(pool),passed:string[]=[];
 const keys:EnvelopeKeys={boundary(ref){if(ref!=='local-proof')throw new Error('PHASE1_KEY_REFERENCE');return{
  authorize:async(_action,context)=>context.purpose==='auth-notification',acquireDataKey:async()=>Buffer.from(dek),
 };}};
 const policy={currentVersion:'local-proof',acquireKey(version:string){check(version==='local-proof','PHASE1_DIGEST_VERSION');return Buffer.from(digestKey);}};
 const recovery={admit:async()=>true}; // Synthetic proof authority; never an application default.
 const settle=async<T>(operations:Promise<T>[]):Promise<T[]>=>{
  const results=await Promise.allSettled(operations);
  if(results.some(r=>r.status==='rejected'))throw new Error('PHASE1_GROUP_FAILED_AFTER_ALL_SETTLED');
  return results.map(r=>{if(r.status!=='fulfilled')throw new Error('PHASE1_GROUP_FAILED');return r.value;});
 };
 const query=async<T extends QueryResultRow>(sql:string,args:unknown[])=>{const c=await pool.connect();try{return await c.query<T>(sql,args);}finally{c.release();}};
 async function register(concurrentFirst=false){
  const userId=randomUUID(),sessionId=randomUUID(),requestId=randomUUID(),email=userId+'@example.invalid';
  const prepared=await prepareProtectedIssuance(keys,'local-proof',{userId,generation:0,recipient:email},'verification',new Date(Date.now()+600000),
   {passwordHash:'$2b$12$'+'.'.repeat(53),name:null,sessionId,sessionDigest:randomBytes(32).toString('hex'),sessionExpiresAt:new Date(Date.now()+600000)});
  const receipt={operation:'register' as const,userId,credentialId:prepared.credentialId,jobId:prepared.jobId,sessionId};
  const logical={email,name:null};
  await approval.record({userId,sessionId,credentialId:prepared.credentialId,jobId:prepared.jobId,requestHash:createHash('sha256').update(requestId).digest('hex')});
  const run=()=>executeIssuanceRequest(store,policy,recovery,requestId,'register',logical,async()=>({receipt,value:true,apply:prepared.apply}));
  if(concurrentFirst){
   const initial=await settle(Array.from({length:16},()=>run()));
   check(initial.filter(r=>!r.replayed).length===1,'PHASE1_FIRST_ISSUANCE_WINNER_FAILED');
  }else await run();
  return {receipt,run};
 }
 try{
  approval.onStage?.('concurrent-issuance');
  const first=await register(true);passed.push('CONCURRENT_FIRST_ISSUANCE_ONE_RECEIPT');
  approval.onStage?.('durable-replay');
  const replay=await settle(Array.from({length:16},()=>first.run()));
  check(replay.every(r=>r.replayed),'PHASE1_FAST_REPLAY_FAILED');
  check((await query<{n:number}>('SELECT count(*)::int AS n FROM public."Session" WHERE "userId"=$1',[first.receipt.userId])).rows[0].n===1,'PHASE1_REPLAY_SESSION_DUPLICATE');
  passed.push('DURABLE_REPLAY_NO_NEW_SESSION');
  approval.onStage?.('consumption');
  const c=await query<{digest:string}>('SELECT digest FROM public."ProtectedCredential" WHERE id=$1',[first.receipt.credentialId]);
  const consumed=await settle(Array.from({length:16},()=>store.consume(first.receipt.credentialId,c.rows[0].digest,'verification')));
  check(consumed.filter(Boolean).length===1,'PHASE1_CONSUMPTION_WINNER_FAILED');
  check((await query<{emailVerified:boolean}>('SELECT "emailVerified" FROM public."User" WHERE id=$1',[first.receipt.userId])).rows[0].emailVerified,'PHASE1_CONSUMPTION_NOT_PERSISTED');
  passed.push('SIXTEEN_CONTENDERS_ONE_PERSISTED_CONSUMPTION');
  approval.onStage?.('lease-fencing');
  const second=await register();
  const claims=await settle(Array.from({length:16},(_,i)=>store.claim(second.receipt.jobId,'proof_'+i)));
  const winners=claims.filter(x=>x!==null);check(winners.length===1,'PHASE1_LEASE_WINNER_FAILED');
  const lease=winners[0];check(lease!==null,'PHASE1_LEASE_MISSING');
  check(!await store.beginSend({...lease,version:lease.version+1}),'PHASE1_STALE_LEASE_ADMITTED');
  check(await store.beginSend(lease),'PHASE1_SEND_ADMISSION_FAILED');
  check(await store.finish(lease,'ambiguous'),'PHASE1_AMBIGUOUS_STATE_FAILED');
  check(await store.claim(lease.jobId,'retry')===null&&!await store.beginSend(lease),'PHASE1_AMBIGUOUS_RESEND');
  passed.push('LEASE_CAS_STALE_DENIAL_AMBIGUOUS_NO_RESEND');
  approval.onStage?.('revocation');
  const third=await register();await revokeProtectedCredentials(store,third.receipt.userId);
  const revoked=await query<{digest:string}>('SELECT digest FROM public."ProtectedCredential" WHERE id=$1',[third.receipt.credentialId]);
  check(!await store.consume(third.receipt.credentialId,revoked.rows[0].digest,'verification'),'PHASE1_REVOKED_CONSUMED');
  passed.push('DURABLE_REVOCATION_DENIAL');
  approval.onStage?.('rollback');
  const rollbackId=randomUUID();await approval.record({userId:rollbackId,credentialId:'',jobId:'',sessionId:'',requestHash:''});
  let failed=false;try{await store.transaction(async tx=>{await tx.createAccount({id:rollbackId,email:rollbackId+'@example.invalid',passwordHash:'synthetic-not-login',name:null});throw new Error('EXPECTED_SYNTHETIC_ROLLBACK');});}catch{failed=true;}
  check(failed&&(await query<{n:number}>('SELECT count(*)::int AS n FROM public."User" WHERE id=$1',[rollbackId])).rows[0].n===0,'PHASE1_ACCOUNT_ROLLBACK_FAILED');
  passed.push('ACCOUNT_AND_TRIGGER_ROLLBACK');return passed;
 }catch{throw new Error('PHASE1_SERVICE_PROOF_STOPPED_PRESERVE_LEDGER');}
 finally{dek.fill(0);digestKey.fill(0);}
}
