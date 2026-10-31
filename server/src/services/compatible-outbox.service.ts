import type { QuarantineRecord, NotificationCompatibilityStore } from '../security/notification-recovery.js';
import { quarantineIncompatible } from '../security/notification-recovery.js';
import type { RecoveryAdmission } from '../security/issuance-replay.js';
import { processProtectedNotificationJob } from './outbox.service.js';
import { renderNotificationContent, sendEmailRaw } from './notification.service.js';

export interface NotificationSnapshot extends QuarantineRecord {payload:unknown;recipient:string|null;subject:string|null;channel:string|null}
export interface OrdinaryLease {jobId:string;version:string;workerId:string}
export type DeliveryOutcome='submitted'|'suppressed'|'ambiguous';
export type WorkerOutcome=DeliveryOutcome|'denied'|'quarantined'|'failed';
export interface CompatibleOutboxStore extends NotificationCompatibilityStore {
  load(source:'ordinary'|'protected',id:string):Promise<NotificationSnapshot|null>;
  next(sources:readonly ('ordinary'|'protected')[]):Promise<Array<{source:'ordinary'|'protected';id:string}>>;
  claimOrdinary(record:QuarantineRecord,workerId:string):Promise<OrdinaryLease|null>;
  beginOrdinarySend(lease:OrdinaryLease):Promise<boolean>;
  finishOrdinary(lease:OrdinaryLease,outcome:DeliveryOutcome):Promise<boolean>;
  failBeforeSend(lease:OrdinaryLease):Promise<boolean>;
  redriveOrdinary(record:QuarantineRecord):Promise<boolean>;
}
export interface CompatibleWorkerComposition {
  store:CompatibleOutboxStore;
  recovery:RecoveryAdmission;
  authorize(actor:string,action:'ordinary'|'protected'|'redrive'):Promise<boolean>;
  protected:Omit<Parameters<typeof processProtectedNotificationJob>[0],'jobId'|'workerId'|'recovery'>;
}
const identifier=(value:string)=>/^[A-Za-z0-9_-]{1,128}$/.test(value);
/** Explicit future worker composition. Existing cron/startup/administrative routes do not select it. */
export function createCompatibleOutboxWorker(deps:CompatibleWorkerComposition){
  const {store,recovery,authorize}=deps;
  async function process(source:'ordinary'|'protected',id:string,actor:string):Promise<WorkerOutcome>{
    let lease:OrdinaryLease|null=null,intent=false;
    try{
      if(!['ordinary','protected'].includes(source)||!identifier(id)||!identifier(actor)||await authorize(actor,source)!==true||await recovery.admit('deliver')!==true)return 'denied';
      const row=await store.load(source,id);
      if(!row||row.source!==source||row.id!==id)return 'denied';
      const record=Object.freeze({source:row.source,id:row.id,version:row.version,state:row.state});
      const recipient=row.recipient,subject=row.subject,channel=row.channel;
      const payload=await quarantineIncompatible(store,record,row.payload);
      if(payload.kind==='quarantine')return 'quarantined';
      if(source==='protected'){
        if(payload.kind!=='protected')return 'denied';
        return processProtectedNotificationJob({...deps.protected,recovery,jobId:id,workerId:actor});
      }
      if(payload.kind!=='ordinary')return 'denied';
      if(channel!=='EMAIL'||typeof recipient!=='string'||recipient.length>254||!/^[^\s@<>]+@[^\s@<>]+$/.test(recipient)||
        typeof subject!=='string'||subject.length>256||/[\r\n\x00]/.test(subject)){
        return await store.quarantine(record,'MALFORMED')?'quarantined':'denied';
      }
      lease=await store.claimOrdinary(record,actor);if(!lease)return 'denied';
      let content:ReturnType<typeof renderNotificationContent>;
      try{content=renderNotificationContent(payload.template,payload.params);}catch{await store.failBeforeSend(lease);return 'failed';}
      if(await recovery.admit('deliver')!==true){await store.failBeforeSend(lease);return 'denied';}
      intent=true;if(!await store.beginOrdinarySend(lease))return 'denied';
      let outcome:DeliveryOutcome;
      try{const result=await sendEmailRaw({to:recipient,subject:subject||content.subject,html:content.html,text:content.text});outcome=result.status==='submitted'?'submitted':result.status==='suppressed'?'suppressed':'ambiguous';}
      catch{outcome='ambiguous';}
      return await store.finishOrdinary(lease,outcome)?outcome:'ambiguous';
    }catch{
      if(intent)return 'ambiguous';
      if(lease){try{await store.failBeforeSend(lease);}catch{/* Preserve exact state for review; no retry. */}}
      return 'failed';
    }
  }
  return {
    process,
    async run(actor:string){
      const stats={processed:0,submitted:0,suppressed:0,ambiguous:0,quarantined:0,denied:0,failed:0};
      if(!identifier(actor))return {...stats,denied:1};
      const allowed:Array<'ordinary'|'protected'>=[];
      for(const source of ['ordinary','protected'] as const)if(await authorize(actor,source)===true)allowed.push(source);
      if(!allowed.length||await recovery.admit('deliver')!==true)return {...stats,denied:1};
      const candidates=await store.next(allowed);
      if(candidates.length>3||candidates.some(r=>!allowed.includes(r.source))||new Set(candidates.map(r=>r.source+':'+r.id)).size!==candidates.length)throw new Error('COMPATIBLE_WORKER_SCOPE_INVALID');
      const deadline=performance.now()+20000;
      for(const ref of candidates){if(performance.now()>=deadline)break;const result=await process(ref.source,ref.id,actor);stats.processed++;stats[result]++;if(['ambiguous','failed','denied'].includes(result))break;}
      return stats;
    },
    async redrive(source:'ordinary'|'protected',id:string,version:string,actor:string):Promise<boolean>{
      try{
        if(!identifier(id)||!identifier(actor)||await authorize(actor,'redrive')!==true||await recovery.admit('deliver')!==true||source!=='ordinary')return false;
        const row=await store.load(source,id);if(!row||row.source!==source||row.id!==id||row.version!==version||row.state!=='FAILED')return false;
        const record=Object.freeze({source:row.source,id:row.id,version:row.version,state:row.state});
        if((await quarantineIncompatible(store,record,row.payload)).kind!=='ordinary')return false;
        // DB adapter permits only known pre-send failure, never a send intent or legacy ambiguous error.
        return await store.redriveOrdinary(record);
      }catch{return false;}
    },
  };
}
