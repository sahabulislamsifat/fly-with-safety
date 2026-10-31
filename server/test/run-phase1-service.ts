import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,openSync,writeSync,fsyncSync,closeSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {verifyProtectedServiceAdapters,serviceTarget,type FixtureRecord,type ServiceProofStage} from './phase1-service.integration.js';
import {exactServiceTeardown} from './phase1-service-teardown.js';

/** Dedicated explicit runner. Default is offline; never activates an application route/worker. */
async function main():Promise<void>{
 if(process.argv[2]!=='--execute'){
  console.log('PHASE1_SERVICE_RUNNER_OFFLINE_ONLY_NO_CONNECTION');return;
 }
 if(process.env.PHASE1_SERVICE_EXECUTION_APPROVED!=='true'||process.env.PHASE1_SYNTHETIC_FIXTURES_APPROVED!=='true')
  throw new Error('APPROVAL_REQUIRED');
 for(const key of Object.keys(process.env))if(key.startsWith('PG')||/^(DATABASE_URL|DIRECT_URL|INTEGRATION_TEST_DATABASE_URL|NODE_OPTIONS|NODE_DEBUG|DEBUG)$/.test(key))throw new Error('AMBIENT_OVERRIDE');
 const password=process.env.PHASE1_SERVICE_PRIVATE_PASSWORD;
 delete process.env.PHASE1_SERVICE_PRIVATE_PASSWORD;
 if(!password||!process.env.USERPROFILE)throw new Error('PRIVATE_AUTH_REQUIRED');
 const base=join(process.env.USERPROFILE,'.codex','visualizations','2026','10','21','01a15fd3-69ff-7843-bea7-539c3d6111f9','phase1-service-role-20261030-02');
 const pins=JSON.parse(readFileSync(join(base,'service-proof-pins.json'),'utf8')) as {files:Array<{path:string;sha256:string}>};
 for(const pin of pins.files)if(createHash('sha256').update(readFileSync(pin.path)).digest('hex')!==pin.sha256)throw new Error('SOURCE_INTEGRITY');
 const dir=join(base,'service-proof-01');
 if(existsSync(dir))throw new Error('EXISTING_SERVICE_ATTEMPT_NO_RETRY');
 mkdirSync(dir); // Atomic claim; never overwrite an old fixture journal.
 writeFileSync(join(dir,'attempt-started.json'),JSON.stringify({startedUtc:new Date().toISOString(),target:serviceTarget}),{flag:'wx'});
 const {Pool}=await import('pg');
 const pool=new Pool({host:serviceTarget.host,port:serviceTarget.port,database:serviceTarget.database,user:serviceTarget.role,
  password,ssl:false,max:18,connectionTimeoutMillis:5000,idleTimeoutMillis:5000,allowExitOnIdle:true,
  options:'-c statement_timeout=5000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=5000',
  application_name:'flywithsafe_phase1_service_proof'});
 let poolFailed=false,passed=false;pool.on('error',()=>{poolFailed=true;});
 const records:FixtureRecord[]=[];let scenarios:string[]=[];let stage:ServiceProofStage='preflight';
 const completedStages:ServiceProofStage[]=[];
 try{
  scenarios=await verifyProtectedServiceAdapters(pool,{approved:true,syntheticOnly:true,onStage:value=>{
   if(value!==stage){completedStages.push(stage);stage=value;}
  },record:async record=>{
   const snapshot={...record};
   // Journal must be durable before each fixture is written; contains IDs only, no token/key/password.
   const fd=openSync(join(dir,'fixture-ledger.jsonl'),'a');
   try{writeSync(fd,JSON.stringify(snapshot)+'\n');fsyncSync(fd);}finally{closeSync(fd);}
   records.push(snapshot);
  }});
  if(poolFailed)throw new Error('POOL_FAILED');
  completedStages.push(stage);passed=true;
 }finally{
  try{await pool.end();}catch{passed=false;}
  if(poolFailed)passed=false;
  if(records.length)writeFileSync(join(dir,'exact-teardown.review.sql'),exactServiceTeardown(records),{flag:'wx'});
  const groupsPassed=completedStages.filter(value=>value!=='preflight').length;
  const groupsFailed=!passed&&stage!=='preflight'&&!completedStages.includes(stage)?1:0;
  writeFileSync(join(dir,'result.json'),JSON.stringify({suitePassed:passed,scenarios,stoppedStage:stage,
   authenticationAndPermissionPreflightPassed:completedStages.includes('preflight'),
   completedStages,scenarioGroups:{passed:groupsPassed,failed:groupsFailed,skipped:0,unexecuted:6-groupsPassed-groupsFailed},fixtureRecords:records.length,
   cleanupExecuted:false,finalCleanVerified:false,wireInterruptionProved:false,lockWaiterCountProved:false,
   requiredManualAction:records.length?'Separately authorized exact-ledger administrator teardown and final clean check':'No fixtures journaled'},null,2),{flag:'wx'});
 }
 console.log(passed?'PHASE1_SERVICE_SCENARIOS_PASS_CLEANUP_PENDING':'PHASE1_SERVICE_STOPPED_PRESERVE_LEDGER');
 if(!passed)process.exitCode=1;
}
void main().catch(()=>{console.error('PHASE1_SERVICE_RUN_STOPPED_NO_RETRY_REPAIR_OR_BROAD_CLEANUP');process.exitCode=1;});
