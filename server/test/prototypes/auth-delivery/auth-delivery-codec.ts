import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { TextDecoder } from 'node:util';
import {
  AuthDeliveryError, FakeKeyFailure, type AuthDeliveryEnvelopeV2, type DeliveryContext, type Payload,
  type KeyProvider, type WorkerPolicy, type WorkerGrant, type OperationControl, type Limits, type Reason, type WrappingMetadata,
} from './contracts.js';

export const identifier = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(v);
export const purpose = (v: unknown): v is DeliveryContext['purpose'] => v === 'EMAIL_VERIFY' || v === 'PASSWORD_RESET';
export const recipient = (v: unknown): v is string => typeof v === 'string' && v.length <= 80 && /^[a-z0-9][a-z0-9._-]{0,63}@example\.invalid$/.test(v);
export function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || (Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null)) throw new AuthDeliveryError('INVALID_INPUT');
  for (const key of Reflect.ownKeys(v)) {
    if (typeof key !== 'string') throw new AuthDeliveryError('INVALID_INPUT');
    const d = Object.getOwnPropertyDescriptor(v, key);
    if (!d || !Object.hasOwn(d, 'value') || !d.enumerable) throw new AuthDeliveryError('INVALID_INPUT');
  }
  return Object.fromEntries(Object.keys(v).map(k => [k, Object.getOwnPropertyDescriptor(v,k)?.value]));
}
export function exact(o: Record<string, unknown>, fields: readonly string[]): void {
  if (Object.keys(o).length !== fields.length || fields.some(k => !Object.hasOwn(o, k))) throw new AuthDeliveryError('INVALID_INPUT');
}
export function contextSnapshot(v: unknown): DeliveryContext {
  try {
    const o = object(v); exact(o, ['environmentId','messageId','tokenRecordId','userId','purpose']);
    if (!identifier(o.environmentId) || !identifier(o.messageId) || !identifier(o.tokenRecordId) || !identifier(o.userId) || !purpose(o.purpose)) throw new Error();
    return Object.freeze({ environmentId:o.environmentId, messageId:o.messageId, tokenRecordId:o.tokenRecordId, userId:o.userId, purpose:o.purpose });
  } catch { throw new AuthDeliveryError('INVALID_INPUT'); }
}
export function bytes(v: unknown, size?: number): Buffer {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]+$/.test(v) || v.length > 22000) throw new AuthDeliveryError('INVALID_ENVELOPE');
  const b = Buffer.from(v, 'base64url');
  if (!b.length || b.toString('base64url') !== v || (size !== undefined && b.length !== size)) throw new AuthDeliveryError('INVALID_ENVELOPE');
  return b;
}
export function validToken(v: unknown): v is string {
  return typeof v === 'string' && /^SYNTHETIC_[A-Za-z0-9_-]{64}$/.test(v) && bytes(v.slice(10), 48).length === 48;
}
function date(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
}
export function payloadSnapshot(v: unknown, c: DeliveryContext): Payload {
  try {
    const o = object(v); exact(o, ['templateVersion','purpose','messageId','tokenRecordId','userId','recipient','issuedAt','expiresAt','token']);
    if (o.templateVersion !== 2 || o.purpose !== c.purpose || o.messageId !== c.messageId || o.tokenRecordId !== c.tokenRecordId || o.userId !== c.userId
      || !recipient(o.recipient) || !date(o.issuedAt) || !date(o.expiresAt) || Date.parse(o.issuedAt) >= Date.parse(o.expiresAt) || !validToken(o.token)) throw new Error();
    const p: Payload = { templateVersion:2, purpose:c.purpose, messageId:c.messageId, tokenRecordId:c.tokenRecordId, userId:c.userId,
      recipient:o.recipient, issuedAt:o.issuedAt, expiresAt:o.expiresAt, token:o.token };
    if (Buffer.byteLength(JSON.stringify(p)) > 4096) throw new Error();
    return Object.freeze(p);
  } catch { throw new AuthDeliveryError('INVALID_INPUT'); }
}
export function metadata(v: unknown): WrappingMetadata {
  const o = object(v);
  if (o.keyProvider !== 'synthetic-auth-delivery' || o.keyRef !== 'synthetic-auth-delivery-kek' || (o.keyVersion !== 'v1' && o.keyVersion !== 'v2') || o.wrapAlgorithm !== 'SYNTHETIC-A256GCM' || typeof o.wrappedDek !== 'string') throw new AuthDeliveryError('INVALID_ENVELOPE');
  bytes(o.wrappedDek,60);
  return { keyProvider:o.keyProvider, keyRef:o.keyRef, keyVersion:o.keyVersion, wrapAlgorithm:o.wrapAlgorithm, wrappedDek:o.wrappedDek };
}
export function canonicalAAD(c: DeliveryContext, m: Pick<WrappingMetadata,'keyProvider'|'keyRef'|'keyVersion'|'wrapAlgorithm'>): Buffer {
  contextSnapshot(c); metadata({...m,wrappedDek:Buffer.alloc(60).toString('base64url')});
  return Buffer.from(JSON.stringify(['FlyWithSafe','flywithsafe.auth-delivery.v2','2','1','2',c.environmentId,c.messageId,c.tokenRecordId,c.userId,c.purpose,m.keyProvider,m.keyRef,m.keyVersion,m.wrapAlgorithm]));
}
export function parseEnvelope(v: unknown): AuthDeliveryEnvelopeV2 {
  try {
    let input = v;
    if (typeof input === 'string') { if (Buffer.byteLength(input) > 16384) throw new Error(); input = JSON.parse(input); }
    const o = object(input);
    exact(o,['envelopeVersion','templateVersion','domain','algorithm','aadVersion','keyProvider','keyRef','keyVersion','wrapAlgorithm','wrappedDek','nonce','ciphertext','tag']);
    if (o.envelopeVersion !== 2 || o.templateVersion !== 2 || o.aadVersion !== 1) throw new AuthDeliveryError('UNSUPPORTED_VERSION');
    if (o.domain !== 'flywithsafe.auth-delivery.v2' || o.algorithm !== 'AES-256-GCM') throw new Error();
    const m = metadata(o);
    if (typeof o.nonce !== 'string' || typeof o.tag !== 'string' || typeof o.ciphertext !== 'string') throw new Error();
    bytes(o.nonce,12); bytes(o.tag,16); if(bytes(o.ciphertext).length > 4096) throw new Error();
    const e: AuthDeliveryEnvelopeV2 = {envelopeVersion:2,templateVersion:2,domain:o.domain,algorithm:o.algorithm,aadVersion:1,...m,nonce:o.nonce,ciphertext:o.ciphertext,tag:o.tag};
    if (Buffer.byteLength(JSON.stringify(e)) > 16384 || (typeof v === 'string' && JSON.stringify(e) !== v)) throw new Error();
    return Object.freeze(e);
  } catch (error) { if(error instanceof AuthDeliveryError && error.code === 'UNSUPPORTED_VERSION') throw error; throw new AuthDeliveryError('INVALID_ENVELOPE'); }
}
export function grantSnapshot(v: unknown, c: DeliveryContext): WorkerGrant {
  try {
    const o=object(v); exact(o,['workerId','environmentId','messageId','tokenRecordId','purpose','role','expiresAtMs']);
    if(!identifier(o.workerId)||o.role!=='AUTH_DELIVERY_WORKER'||o.environmentId!==c.environmentId||o.messageId!==c.messageId||o.tokenRecordId!==c.tokenRecordId||o.purpose!==c.purpose||typeof o.expiresAtMs!=='number'||!Number.isSafeInteger(o.expiresAtMs))throw new Error();
    return Object.freeze({workerId:o.workerId,environmentId:c.environmentId,messageId:c.messageId,tokenRecordId:c.tokenRecordId,purpose:c.purpose,role:o.role,expiresAtMs:o.expiresAtMs});
  }catch{throw new AuthDeliveryError('FORBIDDEN');}
}
export class SyntheticWorkerPolicy implements WorkerPolicy {
  constructor(private readonly now:()=>number=Date.now){}
  async assertAllowed(g:WorkerGrant,c:DeliveryContext,control:OperationControl):Promise<void>{
    const grant=grantSnapshot(g,c),now=this.now();
    if(control.signal.aborted||!Number.isFinite(now)||grant.expiresAtMs<=now)throw new AuthDeliveryError('FORBIDDEN');
  }
}
export function erase(v:unknown):void {
  try { if(v instanceof Uint8Array)v.fill(0); else if(v && typeof v==='object'){
    const d=Object.getOwnPropertyDescriptor(v,'plaintextDek');if(d&&Object.hasOwn(d,'value')&&d.value instanceof Uint8Array)d.value.fill(0);
  }}catch{/* Best effort for known owned buffers only. */}
}
interface Operation { active:boolean; deadline:number; last:number }
interface Settings {authorizationMs:number;providerMs:number;totalMs:number;retryDelaysMs:readonly[number,number];monotonicNow:()=>number;wallNow:()=>number}
function settings(v:unknown):Settings {
  try{
    const o=object(v);if(Object.keys(o).some(k=>!['authorizationMs','providerMs','totalMs','retryDelaysMs','monotonicNow','wallNow'].includes(k)))throw new Error();
    const option=(key:string,fallback:unknown)=>Object.hasOwn(o,key)?o[key]:fallback;
    const a=option('authorizationMs',250),p=option('providerMs',250),t=option('totalMs',1500),d=option('retryDelaysMs',[25,50]);
    const positive=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0&&n<=5000;
    if(!positive(a)||!positive(p)||!positive(t)||a>t||p>t||!Array.isArray(d)||d.length!==2||!positive(d[0])||!positive(d[1])||d[0]>t||d[1]>t)throw new Error();
    const mono=option('monotonicNow',()=>performance.now()),wall=option('wallNow',Date.now);
    if(typeof mono!=='function'||typeof wall!=='function')throw new Error();
    return {authorizationMs:a,providerMs:p,totalMs:t,retryDelaysMs:Object.freeze([d[0],d[1]]),monotonicNow:()=>mono(),wallNow:()=>wall()};
  }catch{throw new AuthDeliveryError('INVALID_INPUT');}
}
/** Independent offline implementation; never imports the passenger prototype or application. */
export class AuthDeliveryCodec {
  private readonly limits:Settings;
  constructor(private readonly provider:KeyProvider,private readonly policy:WorkerPolicy,options:Limits={}){this.limits=settings(options);}
  private time():number {const n:unknown=this.limits.monotonicNow();if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>Number.MAX_SAFE_INTEGER-5000)throw new AuthDeliveryError('KEY_UNAVAILABLE');return n;}
  private check(op:Operation,code:Reason='KEY_UNAVAILABLE'):number {let n:number;try{n=this.time();}catch{op.active=false;throw new AuthDeliveryError(code);}
    if(!op.active||n<op.last||n>=op.deadline){op.active=false;throw new AuthDeliveryError(code);}op.last=n;return n;}
  private live(g:WorkerGrant):void{try{const n:unknown=this.limits.wallNow();if(typeof n!=='number'||!Number.isFinite(n)||n>=g.expiresAtMs)throw new Error();}catch{throw new AuthDeliveryError('FORBIDDEN');}}
  private bounded(op:Operation,budget:number,call:(c:OperationControl)=>unknown,code:Reason,clean:(v:unknown)=>void=()=>{}):Promise<unknown>{
    const start=this.check(op,code),end=Math.min(op.deadline,start+budget),controller=new AbortController();
    return new Promise((resolve,reject)=>{
      let settled=false,timer:ReturnType<typeof setTimeout>|undefined;
      const fail=(error:unknown,timeout=false)=>{if(settled)return;settled=true;if(timer!==undefined)clearTimeout(timer);if(timeout)op.active=false;controller.abort(new AuthDeliveryError(code));reject(error);};
      const expire=()=>{try{const n=this.check(op,code);if(n<end)timer=setTimeout(expire,Math.ceil(end-n));else fail(new AuthDeliveryError(code),true);}catch{fail(new AuthDeliveryError(code),true);}};
      timer=setTimeout(expire,Math.ceil(end-start));let value:unknown;
      try{
        value=call(Object.freeze({signal:controller.signal,deadlineAtMonotonicMs:end}));
        if(!value||(typeof value!=='object'&&typeof value!=='function')||typeof Reflect.get(value,'then')!=='function'){clean(value);fail(new AuthDeliveryError(code));return;}
        void Promise.resolve(value).then(result=>{try{
          if(settled||!op.active){clean(result);return;}
          if(this.check(op,code)>=end){clean(result);fail(new AuthDeliveryError(code),true);return;}
          if(code==='FORBIDDEN'&&result!==undefined){fail(new AuthDeliveryError(code));return;}
          settled=true;if(timer!==undefined)clearTimeout(timer);resolve(result);
        }catch{clean(result);fail(new AuthDeliveryError(code),true);}},error=>{try{if(settled)return;if(this.check(op,code)>=end)fail(new AuthDeliveryError(code),true);else fail(error);}catch{fail(new AuthDeliveryError(code),true);}});
      }catch{clean(value);fail(new AuthDeliveryError(code));}
    });
  }
  private async key<T>(op:Operation,call:(c:OperationControl)=>unknown,accept:(v:unknown)=>T,g?:WorkerGrant):Promise<T>{
    for(let i=0;i<3;i++){
      this.check(op);if(g)this.live(g);
      try{const value=await this.bounded(op,this.limits.providerMs,call,'KEY_UNAVAILABLE',erase);
        try{this.check(op);if(g)this.live(g);try{return accept(value);}catch{throw new AuthDeliveryError('KEY_UNAVAILABLE');}}catch(e){erase(value);throw e;}
      }catch(e){
        if(e instanceof AuthDeliveryError)throw e;
        if(e instanceof FakeKeyFailure){
          if(e.kind==='denied')throw new AuthDeliveryError('FORBIDDEN');if(e.kind==='integrity')throw new AuthDeliveryError('INTEGRITY_FAILURE');
          if(e.kind==='unavailable'&&i<2){const remaining=op.deadline-this.check(op);await new Promise<void>(r=>setTimeout(r,Math.min(remaining,this.limits.retryDelaysMs[i])));this.check(op);continue;}
        }throw new AuthDeliveryError('KEY_UNAVAILABLE');
      }
    }throw new AuthDeliveryError('KEY_UNAVAILABLE');
  }
  async protect(input:unknown,inputContext:unknown):Promise<AuthDeliveryEnvelopeV2>{
    let op:Operation|undefined,plain:Buffer|undefined,key:Uint8Array|undefined;
    try{
      const n=this.time();op={active:true,deadline:n+this.limits.totalMs,last:n};
      const c=contextSnapshot(inputContext),p=payloadSnapshot(input,c);plain=Buffer.from(JSON.stringify(p));
      const wrapped=await this.key(op,ctl=>this.provider.createAndWrapDataKey(c,ctl),v=>{
        const o=object(v);exact(o,['keyProvider','keyRef','keyVersion','wrapAlgorithm','wrappedDek','plaintextDek']);
        const m=metadata(o);if(!(o.plaintextDek instanceof Uint8Array)||o.plaintextDek.length!==32)throw new AuthDeliveryError('KEY_UNAVAILABLE');return {...m,plaintextDek:o.plaintextDek};
      });
      key=wrapped.plaintextDek;this.check(op);
      const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce,{authTagLength:16});cipher.setAAD(canonicalAAD(c,wrapped));
      const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);
      const {plaintextDek:_,...m}=wrapped;
      const e=parseEnvelope({envelopeVersion:2,templateVersion:2,domain:'flywithsafe.auth-delivery.v2',algorithm:'AES-256-GCM',aadVersion:1,...m,nonce:nonce.toString('base64url'),ciphertext:ciphertext.toString('base64url'),tag:cipher.getAuthTag().toString('base64url')});
      this.check(op);return e;
    }catch(e){throw new AuthDeliveryError(e instanceof AuthDeliveryError?e.code:'KEY_UNAVAILABLE');}
    finally{if(op)op.active=false;erase(key);plain?.fill(0);}
  }
  async unprotect(input:unknown,inputContext:unknown,inputGrant:unknown):Promise<Payload>{
    let op:Operation|undefined,key:Uint8Array|undefined,partial:Buffer|undefined,plain:Buffer|undefined;
    try{
      const n=this.time();op={active:true,deadline:n+this.limits.totalMs,last:n};const c=contextSnapshot(inputContext),g=grantSnapshot(inputGrant,c);
      let e:AuthDeliveryEnvelopeV2|undefined,pending:unknown;try{e=parseEnvelope(input);}catch(error){pending=error;}
      try{await this.bounded(op,this.limits.authorizationMs,ctl=>this.policy.assertAllowed(g,c,ctl),'FORBIDDEN');}catch{throw new AuthDeliveryError('FORBIDDEN');}
      this.check(op,'FORBIDDEN');this.live(g);if(pending)throw pending;if(!e)throw new AuthDeliveryError('INVALID_ENVELOPE');
      const frozen=e;
      key=await this.key(op,ctl=>this.provider.unwrapDataKey(frozen,c,ctl),v=>{if(!(v instanceof Uint8Array)||v.length!==32)throw new AuthDeliveryError('KEY_UNAVAILABLE');return v;},g);
      this.check(op);this.live(g);
      const decipher=createDecipheriv('aes-256-gcm',key,bytes(e.nonce,12),{authTagLength:16});decipher.setAAD(canonicalAAD(c,e));decipher.setAuthTag(bytes(e.tag,16));
      try{partial=decipher.update(bytes(e.ciphertext));plain=Buffer.concat([partial,decipher.final()]);}catch{throw new AuthDeliveryError('INTEGRITY_FAILURE');}
      let result:Payload;try{result=payloadSnapshot(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain)),c);if(JSON.stringify(result)!==plain.toString('utf8'))throw new Error();}catch{throw new AuthDeliveryError('INVALID_ENVELOPE');}
      this.check(op);this.live(g);return result;
    }catch(e){throw new AuthDeliveryError(e instanceof AuthDeliveryError?e.code:'KEY_UNAVAILABLE');}
    finally{if(op)op.active=false;erase(key);partial?.fill(0);plain?.fill(0);}
  }
}
