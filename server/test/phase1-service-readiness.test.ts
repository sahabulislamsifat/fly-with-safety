import {describe,it,expect,vi} from 'vitest';
import type {Pool} from 'pg';
import {verifyProtectedServiceAdapters,type ServiceProofApproval} from './phase1-service.integration.js';
import {exactServiceTeardown} from './phase1-service-teardown.js';
vi.mock('pg',()=>{throw new Error('LIVE_DRIVER_FORBIDDEN');});
vi.mock('dotenv',()=>{throw new Error('ENV_DISCOVERY_FORBIDDEN');});
const approval=():ServiceProofApproval=>({approved:true,syntheticOnly:true,record:async()=>{}});
describe('inert service-proof admission — OFFLINE, no PostgreSQL',()=>{
 it('rejects empty or injected teardown ledgers before SQL generation',()=>{
  expect(()=>exactServiceTeardown([])).toThrow('PHASE1_LEDGER_INVALID');
  expect(()=>exactServiceTeardown([{userId:"x';DELETE",credentialId:'',jobId:'',sessionId:'',requestHash:''}])).toThrow('PHASE1_LEDGER_INVALID');
 });
 it('generates only exact-ID teardown with transactional deferred cycle handling',()=>{
  const sql=exactServiceTeardown([{userId:'00000000-0000-4000-8000-000000000001',credentialId:'',jobId:'',sessionId:'',requestHash:''}]);
  expect(sql).toContain('SET CONSTRAINTS ALL DEFERRED');
  expect(sql).not.toMatch(/TRUNCATE|DROP|LIKE/);
  for(const line of sql.split('\n').filter(x=>x.startsWith('DELETE')))expect(line).toContain('WHERE');
 });
 for(const field of ['approved','syntheticOnly'] as const)it('requires explicit '+field,async()=>{
  const connect=vi.fn();const a=approval();a[field]=false;
  await expect(verifyProtectedServiceAdapters({connect} as never,a)).rejects.toThrow('PHASE1_SERVICE_APPROVAL_REQUIRED');
  expect(connect).not.toHaveBeenCalled();
 });
 it('requires durable fixture journal before connecting',async()=>{
  const connect=vi.fn();await expect(verifyProtectedServiceAdapters({connect} as never,{...approval(),record:undefined} as never)).rejects.toThrow('PHASE1_SERVICE_APPROVAL_REQUIRED');expect(connect).not.toHaveBeenCalled();
 });
 it('redacts driver connection errors',async()=>{
  await expect(verifyProtectedServiceAdapters({connect:async()=>{throw new Error('SYNTHETIC_SECRET');}} as never,approval())).rejects.toThrow('PHASE1_SERVICE_CONNECTION_FAILED');
 });
 it('rejects identity/privilege/state mismatch and releases without writes',async()=>{
  const query=vi.fn(async(_sql:string)=>({rows:[{ok:false}]})),release=vi.fn();
  const pool={connect:async()=>({query,release})} as unknown as Pick<Pool,'connect'>;
  await expect(verifyProtectedServiceAdapters(pool,approval())).rejects.toThrow('PHASE1_SERVICE_PREFLIGHT_FAILED');
  expect(query.mock.calls.map(c=>String(c[0]).trim().split(/\s+/)[0])).toEqual(['BEGIN','SET','SELECT','ROLLBACK']);expect(release).toHaveBeenCalledTimes(1);
 });
 it('journal failure blocks all fixture writes, after readonly admission',async()=>{
  const calls:string[]=[];const query=async(sql:string)=>{calls.push(sql);return {rows:[{ok:true}]}};
  const pool={connect:async()=>({query,release:()=>{}})} as unknown as Pick<Pool,'connect'>;
  await expect(verifyProtectedServiceAdapters(pool,{...approval(),record:async()=>{throw new Error('JOURNAL_FAILED');}})).rejects.toThrow('PHASE1_SERVICE_PROOF_STOPPED_PRESERVE_LEDGER');
  expect(calls.map(s=>s.trim().split(/\s+/)[0])).toEqual(['BEGIN','SET','SELECT','ROLLBACK']);
 });
});
