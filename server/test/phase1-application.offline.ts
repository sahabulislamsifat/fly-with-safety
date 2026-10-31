import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadSyntheticApplication} from './phase1-application.integration.js';
import {AppError} from '../src/utils/errors.js';
import type {ProtectedAuthServices} from '../src/services/protected-auth.service.js';
import type {SyntheticWorkerComposition} from './phase1-application.integration.js';
import {registerSchema} from '../src/validators/auth.schemas.js';

/** Isolated offline child: actual app factories, doubled leaf persistence. No pg,
 * dotenv discovery, actual SMTP, fixture writes or production server startup. */
let stage='module-check';
async function main(){
  const local=createRequire(__filename),envId=local.resolve('../src/config/env.js'),prismaId=local.resolve('../src/lib/prisma.js');
  assert(!local.cache[envId]&&!local.cache[prismaId]);
  assert.throws(()=>loadSyntheticApplication(false),/APPROVAL_REQUIRED/);
  assert(!local.cache[envId]&&!local.cache[prismaId]);
  stage='load';const app=loadSyntheticApplication(true),results:Record<string,boolean>={approval:true};
  try{
    assert.throws(()=>loadSyntheticApplication(true),/ALREADY_LOADED/);results.exclusiveProcess=true;
    const input={email:'synthetic@example.invalid',password:'SyntheticProof12!',name:null},id='00000000-0000-4000-8000-000000000001';
    let calls=0;
    stage='http-replay';await app.replay({registerRequest:async(data:unknown,key:string)=>{
      calls++;assert.equal(key,id);const parsed=registerSchema.parse(data);assert.equal(parsed.name??null,input.name);
      if(parsed.password!==input.password)throw AppError.conflict('Synthetic conflict');return {status:'replayed'};
    }} as ProtectedAuthServices,input,id);
    assert.equal(calls,2);results.actualHttpReplayConflictAndOrigin=true;results.realRegistrationValidatorCompatibility=true;
    let loads=0,sends=0,state='PENDING';
    const composition={store:{
      load:async()=>{loads++;return {source:'ordinary',id,version:'2026-10-31T00:00:00.000Z',state,channel:'EMAIL',recipient:input.email,subject:'Synthetic',
        payload:{template:'CONTACT_CONFIRMATION',params:{firstName:'Synthetic',referenceNumber:'SYNTHETIC'}}};},
      quarantineReason:async()=>null,claimOrdinary:async()=>state==='PENDING'?{jobId:id,version:'2026-10-31T00:00:00.000Z',workerId:'worker'}:null,
      beginOrdinarySend:async()=>{sends++;return true;},finishOrdinary:async(_lease:unknown,outcome:unknown)=>{assert.equal(outcome,'suppressed');state='FAILED';return true;},
      failBeforeSend:async()=>{throw new Error('UNEXPECTED_PRE_SEND_FAILURE');},redriveOrdinary:async()=>{throw new Error('UNSAFE_REDRIVE');}},
      authorize:async(actor:string,action:string)=>actor==='worker'&&action==='ordinary',recovery:{admit:async()=>true},
      protected:{keys:{boundary(){throw new Error('UNEXPECTED_KEY_ACCESS');}},authorize:async()=>false,frontendOrigin:'http://127.0.0.1'},
    } as unknown as SyntheticWorkerComposition;
    stage='worker';const worker=app.worker(composition);
    assert.equal(await worker.process('ordinary',id,'untrusted'),'denied');assert.equal(loads,0);results.authorizationBeforePersistence=true;
    assert.equal(await worker.process('ordinary',id,'worker'),'suppressed');assert.equal(sends,1);results.actualSuppressedTransport=true;
    assert.equal(await worker.process('ordinary',id,'worker'),'denied');assert.equal(sends,1);results.duplicateDenial=true;
    assert.equal(await worker.redrive('ordinary',id,'2026-10-31T00:00:00.000Z','worker'),false);
    assert.equal(await worker.process('protected',id,'worker'),'denied');results.protectedAndRedriveDenial=true;
  }finally{app.close();app.close();}
  stage='restore';assert(!local.cache[envId]&&!local.cache[prismaId]);results.ownedModuleRestoration=true;
  console.log(JSON.stringify({offline:true,liveDatabase:false,smtp:false,results}));
}
void main().catch(()=>{console.error('PHASE1_APPLICATION_OFFLINE_FAILED stage='+stage);process.exitCode=1;});
