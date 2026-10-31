import type {FixtureRecord} from './phase1-service.integration.js';
/** Builds reviewed exact-ledger SQL only. Never executes it or discovers credentials. */
export function exactServiceTeardown(records:readonly FixtureRecord[]):string{
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
 if(!Array.isArray(records)||records.length<1||records.length>4||new Set(records.map(r=>r.userId)).size!==records.length)throw new Error('PHASE1_LEDGER_INVALID');
 for(const r of records)if(!uuid.test(r.userId)||[r.credentialId,r.jobId,r.sessionId].some(id=>id!==''&&!uuid.test(id))||r.requestHash!==''&&!/^[a-f0-9]{64}$/.test(r.requestHash)||
  !([r.credentialId,r.jobId,r.sessionId,r.requestHash].every(Boolean)||[r.credentialId,r.jobId,r.sessionId,r.requestHash].every(x=>x==='')))throw new Error('PHASE1_LEDGER_INVALID');
 const array=(values:string[])=>"ARRAY["+values.filter(Boolean).map(v=>"'"+v+"'").join(',')+"]::text[]";
 const users=array(records.map(r=>r.userId)),jobs=array(records.map(r=>r.jobId)),credentials=array(records.map(r=>r.credentialId)),sessions=array(records.map(r=>r.sessionId)),requests=array(records.map(r=>r.requestHash));
 return [
  '\\set ON_ERROR_STOP on','BEGIN;',"SET LOCAL statement_timeout='5s';","SET LOCAL lock_timeout='5s';",
  'DO $guard$ BEGIN',
  "IF current_database()<>'flywithsafe_phase1_schema_integration' OR current_user<>'postgres' OR session_user<>'postgres' OR host(inet_server_addr()) IS DISTINCT FROM '127.0.0.1' OR inet_server_port()<>5432 OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()) THEN RAISE EXCEPTION 'EXACT_TEARDOWN_TARGET'; END IF;",
  'IF EXISTS(SELECT 1 FROM public."User" WHERE id=ANY('+users+') AND email<>id||\'@example.invalid\') THEN RAISE EXCEPTION \'EXACT_TEARDOWN_IDENTITY\'; END IF;',
  'IF EXISTS(SELECT 1 FROM public."EmailVerificationToken" WHERE "userId"=ANY('+users+')) OR EXISTS(SELECT 1 FROM public."PasswordResetToken" WHERE "userId"=ANY('+users+')) THEN RAISE EXCEPTION \'UNEXPECTED_LEGACY_RECORDS\'; END IF;',
  'END $guard$;','SET CONSTRAINTS ALL DEFERRED;',
  'DELETE FROM public."AuthIssuanceRequest" WHERE "keyHash"=ANY('+requests+') AND "userId"=ANY('+users+');',
  'DELETE FROM public."Session" WHERE id=ANY('+sessions+') AND "userId"=ANY('+users+');',
  'DELETE FROM public."ProtectedAuthJob" WHERE id=ANY('+jobs+') AND "credentialId"=ANY('+credentials+');',
  'DELETE FROM public."ProtectedCredential" WHERE id=ANY('+credentials+') AND "userId"=ANY('+users+');',
  'DELETE FROM public."AuthSecurityState" WHERE "userId"=ANY('+users+');',
  'DELETE FROM public."User" WHERE id=ANY('+users+');',
  'SET CONSTRAINTS ALL IMMEDIATE;','COMMIT;',
 ].join('\n');
}
