import type { Pool } from 'pg';
import { createProtectedAuthController } from '../controllers/auth.controller.js';
import { createCompatibleOutboxController } from '../controllers/compatible-outbox.controller.js';
import { PostgresProtectedAuthStore } from '../security/protected-auth.pg.js';
import { PostgresCompatibleOutboxStore } from '../security/compatible-outbox.pg.js';
import type { LogicalDigestPolicy } from '../security/idempotency-digest.js';
import { createProtectedAuthServices, type ProtectedAuthComposition } from './protected-auth.service.js';
import { createCompatibleOutboxWorker, type CompatibleWorkerComposition } from './compatible-outbox.service.js';
import { CutoverAdmission, type CutoverProbe } from '../security/enrollment-cutover.js';

export type ProtectedPhase1Composition = Omit<ProtectedAuthComposition,'store'|'requests'> & {
  pool:Pick<Pool,'connect'>;
  digestPolicy:LogicalDigestPolicy;
  frontendOrigin:string;
  authorizeDelivery:CompatibleWorkerComposition['protected']['authorize'];
  authorizeWorker:CompatibleWorkerComposition['authorize'];
  admitWorker:Parameters<typeof createCompatibleOutboxController>[0]['admitWorker'];
  admitOperator:Parameters<typeof createCompatibleOutboxController>[0]['admitOperator'];
};

/** Inert assembly only. No env discovery, Pool creation, routes, timers or startup activation.
 * Requires reviewed additive schema, identity/key/recovery contracts and separate live proof before mounting.
 */
export function createProtectedPhase1Composition(input:ProtectedPhase1Composition){
  if(!input?.pool||typeof input.pool.connect!=='function'||!input.digestPolicy||
    typeof input.digestPolicy.acquireKey!=='function'||!input.keys||!input.recovery||
    typeof input.recovery.admit!=='function'||typeof input.authorizeDelivery!=='function'||
    typeof input.authorizeWorker!=='function'||typeof input.admitWorker!=='function'||typeof input.admitOperator!=='function'){
    throw new Error('PROTECTED_COMPOSITION_INVALID');
  }
  const store=new PostgresProtectedAuthStore(input.pool);
  const notifications=new PostgresCompatibleOutboxStore(input.pool);
  const auth=createProtectedAuthServices({...input,store,requests:{store,policy:input.digestPolicy}});
  const worker=createCompatibleOutboxWorker({store:notifications,recovery:input.recovery,authorize:input.authorizeWorker,
    protected:{store,keys:input.keys,frontendOrigin:input.frontendOrigin,authorize:input.authorizeDelivery}});
  return {auth,worker,authController:createProtectedAuthController(auth),
    workerController:createCompatibleOutboxController({worker,admitWorker:input.admitWorker,admitOperator:input.admitOperator})};
}

/** Future reviewed rollout entry: still inert, with both cutover and external-epoch admission. */
export function createCutoverPhase1Composition(input:ProtectedPhase1Composition & {cutover:{probe:CutoverProbe;schemaHash:string}}){
  if(!input?.cutover)throw new Error('CUTOVER_CONFIGURATION_INVALID');
  return createProtectedPhase1Composition({...input,recovery:new CutoverAdmission(input.recovery,input.cutover.probe,input.cutover.schemaHash)});
}
