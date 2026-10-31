import { types } from 'node:util';
import { parseEnvelope, type Envelope } from './protected-envelope.js';

export type OrdinaryTemplate='INQUIRY_CONFIRMATION'|'BOOKING_CONFIRMATION'|'BOOKING_STATUS'|'CONTACT_CONFIRMATION';
export type QuarantineReason='LEGACY_AUTH'|'UNKNOWN_FORMAT'|'MALFORMED'|'RESTORED'|'AMBIGUOUS_SEND';
export type CompatibleNotification={kind:'ordinary';template:OrdinaryTemplate;params:Record<string,unknown>}|
  {kind:'protected';envelope:Envelope}|{kind:'quarantine';reason:QuarantineReason};
function snapshot(value:unknown,budget={nodes:2048},depth=0):unknown {
  if(--budget.nodes<0||depth>12)throw new Error();
  if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
  if(typeof value==='string'){if(value.length>8192)throw new Error();return value;}
  if(!value||typeof value!=='object'||types.isProxy(value)||Object.getOwnPropertySymbols(value).length)throw new Error();
  if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)throw new Error();
  if(Array.isArray(value)){
    const keys=Object.getOwnPropertyNames(value).filter(k=>k!=='length');
    if(value.length>256||keys.length!==value.length||keys.some((k,i)=>k!==String(i)))throw new Error();
    return keys.map(k=>{const d=Object.getOwnPropertyDescriptor(value,k);if(!d||!('value'in d))throw new Error();return snapshot(d.value,budget,depth+1);});
  }
  const result:Record<string,unknown>=Object.create(null);
  for(const key of Object.getOwnPropertyNames(value)){
    if(key==='__proto__'||key==='constructor'||key==='prototype')throw new Error();
    const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!('value'in d))throw new Error();
    result[key]=snapshot(d.value,budget,depth+1);
  }
  return result;
}
export function readCompatibleNotification(source:'ordinary'|'protected',payload:unknown):CompatibleNotification {
  try {
    if(source==='protected')return {kind:'protected',envelope:parseEnvelope(payload)};
    if(source!=='ordinary')return {kind:'quarantine',reason:'UNKNOWN_FORMAT'};
    const r=snapshot(payload);
    const isRecord=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
    if(!isRecord(r))throw new Error();
    const data=r;
    if(data.template==='EMAIL_VERIFICATION'||data.template==='PASSWORD_RESET')return {kind:'quarantine',reason:'LEGACY_AUTH'};
    if(Object.keys(data).sort().join(',')!=='params,template')return {kind:'quarantine',reason:'UNKNOWN_FORMAT'};
    const template=data.template,params=data.params;
    if(!['INQUIRY_CONFIRMATION','BOOKING_CONFIRMATION','BOOKING_STATUS','CONTACT_CONFIRMATION'].includes(String(template))||
      !isRecord(params))return {kind:'quarantine',reason:'UNKNOWN_FORMAT'};
    // Never treat a mislabeled authentication payload as an ordinary job.
    const secretNames=new Set(['token','password','accessToken','refreshToken','verificationUrl','resetUrl','envelope']);
    const containsSecret=(value:unknown):boolean=>!!value&&typeof value==='object'&&Object.entries(value).some(([k,v])=>secretNames.has(k)||containsSecret(v));
    if(containsSecret(params))return {kind:'quarantine',reason:'LEGACY_AUTH'};
    if(template!=='INQUIRY_CONFIRMATION'&&template!=='BOOKING_CONFIRMATION'&&template!=='BOOKING_STATUS'&&template!=='CONTACT_CONFIRMATION')throw new Error();
    return {kind:'ordinary',template,params};
  } catch {return {kind:'quarantine',reason:'MALFORMED'};}
}
export interface QuarantineRecord {source:'ordinary'|'protected';id:string;version:string;state:string}
export interface NotificationQuarantineStore {
  quarantine(record:QuarantineRecord,reason:QuarantineReason):Promise<boolean>;
}
export interface NotificationCompatibilityStore extends NotificationQuarantineStore {
  quarantineReason(record:QuarantineRecord):Promise<QuarantineReason|null>;
}
function validRecord(record:QuarantineRecord):boolean {
  return ['ordinary','protected'].includes(record.source)&&/^[A-Za-z0-9_-]{1,128}$/.test(record.id)&&
    (record.source==='protected'?/^(0|[1-9]\d{0,8})$/.test(record.version):/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(record.version));
}
function recordSnapshot(value:unknown):QuarantineRecord {
  const data=snapshot(value);
  if(!data||typeof data!=='object'||Array.isArray(data)||
    Object.keys(data).sort().join(',')!=='id,source,state,version')throw new Error();
  const fields=Object.getOwnPropertyDescriptors(data);
  const source:unknown=fields.source.value,id:unknown=fields.id.value,version:unknown=fields.version.value,state:unknown=fields.state.value;
  if(source!=='ordinary'&&source!=='protected'||typeof id!=='string'||typeof version!=='string'||typeof state!=='string')throw new Error();
  const record:QuarantineRecord={source,id,version,state};
  if(!validRecord(record))throw new Error();
  return Object.freeze(record);
}
/** CAS quarantine preserves payloads; no delete, decrypt, send or automatic redrive. */
export async function quarantineIncompatible(store:NotificationCompatibilityStore,record:QuarantineRecord,payload:unknown):Promise<CompatibleNotification> {
  try {
    const stable=recordSnapshot(record);
    const result=readCompatibleNotification(stable.source,payload);
    const prior=await store.quarantineReason(stable);
    if(prior!==null)return {kind:'quarantine',reason:['LEGACY_AUTH','UNKNOWN_FORMAT','MALFORMED','RESTORED','AMBIGUOUS_SEND'].includes(prior)?prior:'MALFORMED'};
    if(result.kind==='quarantine'&&!await store.quarantine(stable,result.reason))throw new Error();
    return result;
  } catch {throw new Error('NOTIFICATION_QUARANTINE_FAILED');}
}
export async function quarantineRestoredBatch(store:NotificationQuarantineStore,records:readonly QuarantineRecord[]):Promise<number> {
  try {
    const copied=snapshot(records);
    if(!Array.isArray(copied)||copied.length>100)throw new Error();
    const stable=copied.map(recordSnapshot);
    if(new Set(stable.map(r=>r.source+':'+r.id)).size!==stable.length)throw new Error();
    let completed=0;
    for(const record of stable){
      if(!await store.quarantine(record,record.state==='SENDING'||record.state==='AMBIGUOUS'?'AMBIGUOUS_SEND':'RESTORED'))throw new Error();
      completed++;
    }
    return completed;
  } catch {throw new Error('RESTORE_QUARANTINE_INCOMPLETE');} // Partial prefix may have committed; never retry broadly.
}
