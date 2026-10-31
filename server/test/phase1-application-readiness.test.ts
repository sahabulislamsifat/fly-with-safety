import {beforeAll,describe,expect,it} from 'vitest';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
let outcome:{offline:boolean;liveDatabase:boolean;smtp:boolean;results:Record<string,boolean>};
beforeAll(()=>{
  const child=spawnSync(process.execPath,['--import','tsx',resolve(__dirname,'phase1-application.offline.ts')],{
    cwd:resolve(__dirname,'..'),env:{...process.env,NODE_ENV:'test'},encoding:'utf8',timeout:8000,windowsHide:true,
  });
  // Raw child errors may contain absolute paths; never forward unrestricted text.
  if(child.error||child.status!==0)throw new Error('PHASE1_APPLICATION_OFFLINE_CHILD_FAILED');
  outcome=JSON.parse(child.stdout.trim());
  expect(outcome.offline).toBe(true);expect(outcome.liveDatabase).toBe(false);expect(outcome.smtp).toBe(false);
});
describe('actual app factories with explicit synthetic environment and doubled leaf persistence — OFFLINE',()=>{
  for(const name of ['approval','exclusiveProcess','actualHttpReplayConflictAndOrigin','authorizationBeforePersistence',
    'actualSuppressedTransport','duplicateDenial','protectedAndRedriveDenial','ownedModuleRestoration','realRegistrationValidatorCompatibility'])it(name,()=>expect(outcome.results[name]).toBe(true));
});
