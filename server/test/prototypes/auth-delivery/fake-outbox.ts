import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  AuthDeliveryError, isReason, type Account, type DeliveryCodec, type DeliveryContext, type DispatchResult, type FaultPoint,
  type IssuanceReceipt, type IssuanceRequest, type Lease, type OutboxRow, type PersistentSnapshot, type Purpose, type Reason,
  type TokenRow, type Transport,
} from './contracts.js';
import { contextSnapshot, exact, grantSnapshot, identifier, object, parseEnvelope, purpose, recipient, validToken } from './auth-delivery-codec.js';

const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
function frozenClone<T>(v:T):T{
  const copy=clone(v);
  const freeze=(value:unknown):void=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}};
  freeze(copy);return copy;
}
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
export type ConsumeEffect='VERIFY_EMAIL'|'RESET_PASSWORD';
export interface OutboxOptions {
  readonly environmentId:string; readonly codec:DeliveryCodec; readonly transport:Transport; readonly now:()=>number;
  readonly leaseMs?:number; readonly maxAttempts?:number; readonly snapshot?:PersistentSnapshot;
  readonly fault?:(point:FaultPoint)=>void;
}
/** Atomicity is one synchronous clone/publish in memory, never a PostgreSQL guarantee. */
export class FakeOutbox {
  private state:PersistentSnapshot;
  private readonly leaseMs:number;
  private readonly maximum:number;
  constructor(private readonly options:OutboxOptions){
    this.options=Object.freeze({...options});
    if(!identifier(options.environmentId))throw new AuthDeliveryError('INVALID_INPUT');
    this.leaseMs=options.leaseMs??300000;this.maximum=options.maxAttempts??5;
    if(!Number.isSafeInteger(this.leaseMs)||this.leaseMs<=0||!Number.isSafeInteger(this.maximum)||this.maximum<1||this.maximum>5)throw new AuthDeliveryError('INVALID_INPUT');
    const now=options.now();if(!Number.isSafeInteger(now)||now<0)throw new AuthDeliveryError('INVALID_INPUT');
    this.state=options.snapshot?clone(options.snapshot):{environmentId:options.environmentId,lastClockMs:now,accounts:[],tokens:[],outbox:[],revisions:{},issuances:{}};
    try{if(this.state.environmentId!==options.environmentId||this.state.lastClockMs>now)throw new Error();this.validateState();}
    catch{throw new AuthDeliveryError('INVALID_INPUT');}
  }
  private validateState():void{
    // Restored state is not authority for plaintext or unknown diagnostic fields.
    exact(object(this.state),['environmentId','lastClockMs','accounts','tokens','outbox','revisions','issuances']);
    const integer=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
    if(!integer(this.state.lastClockMs)||!Array.isArray(this.state.accounts)||!Array.isArray(this.state.tokens)||!Array.isArray(this.state.outbox))throw new Error();
    const unique=(rows:{id:string}[])=>new Set(rows.map(r=>r.id)).size===rows.length;
    for(const row of this.state.outbox){
      exact(object(row),['id','tokenRecordId','userId','purpose','envelope','status','version','attempts','maxAttempts','nextAttemptAtMs','leaseOwnerId','leaseExpiresAtMs','reasonCode']);
      parseEnvelope(row.envelope);
      if(!identifier(row.id)||!identifier(row.tokenRecordId)||!identifier(row.userId)||!purpose(row.purpose)||!['PENDING','PROCESSING','DELIVERED','FAILED'].includes(row.status)
        ||!integer(row.version)||row.version<1||!integer(row.attempts)||!integer(row.maxAttempts)||row.maxAttempts<1||row.maxAttempts>5||row.attempts>row.maxAttempts
        ||!integer(row.nextAttemptAtMs)||(row.reasonCode!==null&&!isReason(row.reasonCode)))throw new Error();
      if(row.status==='PROCESSING'){if(!identifier(row.leaseOwnerId)||!integer(row.leaseExpiresAtMs))throw new Error();}
      else if(row.leaseOwnerId!==null||row.leaseExpiresAtMs!==null)throw new Error();
    }
    for(const row of this.state.tokens){
      exact(object(row),['id','userId','accountRevision','purpose','tokenHash','issuedAtMs','expiresAtMs','consumedAtMs','revokedAtMs','messageId']);
      if(!/^[a-f0-9]{64}$/.test(row.tokenHash)||!identifier(row.id)||!identifier(row.userId)||!identifier(row.messageId)||!purpose(row.purpose)||!integer(row.accountRevision)
        ||!integer(row.issuedAtMs)||!integer(row.expiresAtMs)||row.expiresAtMs<=row.issuedAtMs||(row.consumedAtMs!==null&&!integer(row.consumedAtMs))||(row.revokedAtMs!==null&&!integer(row.revokedAtMs)))throw new Error();
    }
    for(const row of this.state.accounts){
      exact(object(row),['id','recipient','revision','emailVerified','passwordEffects','sessionEffects']);
      if(!recipient(row.recipient)||!identifier(row.id)||!integer(row.revision)||row.revision<1||typeof row.emailVerified!=='boolean'||!integer(row.passwordEffects)||!integer(row.sessionEffects))throw new Error();
    }
    if(!unique(this.state.outbox)||!unique(this.state.tokens)||!unique(this.state.accounts))throw new Error();
    for(const [key,revision]of Object.entries(object(this.state.revisions))){const scope:unknown=JSON.parse(key);if(!Array.isArray(scope)||scope.length!==3||scope[0]!==this.options.environmentId||!identifier(scope[1])||!purpose(scope[2])||!integer(revision))throw new Error();}
    for(const [key,value]of Object.entries(object(this.state.issuances))){
      const o=object(value);exact(o,['digest','receipt']);if(typeof o.digest!=='string'||!/^[a-f0-9]{64}$/.test(o.digest))throw new Error();
      const r=object(o.receipt);exact(r,['issuanceId','messageId','tokenRecordId']);if(!identifier(r.issuanceId)||!identifier(r.messageId)||!identifier(r.tokenRecordId))throw new Error();
      const parts:unknown=JSON.parse(key);if(!Array.isArray(parts)||parts.length!==2||parts[1]!==r.issuanceId||typeof parts[0]!=='string')throw new Error();
      const scope:unknown=JSON.parse(parts[0]);if(!Array.isArray(scope)||scope.length!==3||scope[0]!==this.options.environmentId||!identifier(scope[1])||!purpose(scope[2]))throw new Error();
    }
  }
  private now():number {
    const n=this.options.now();if(!Number.isSafeInteger(n)||n<this.state.lastClockMs)throw new AuthDeliveryError('FORBIDDEN');
    // Persist a monotonic observed wall-clock watermark; restore with an older clock fails closed.
    this.state={...this.state,lastClockMs:n};return n;
  }
  private fault(point:FaultPoint):void{try{this.options.fault?.(point);}catch(error){if(point==='afterSubmit'&&error instanceof SimulatedCrash)throw error;throw new AuthDeliveryError('TRANSPORT_TERMINAL');}}
  snapshot():PersistentSnapshot{return frozenClone(this.state);}
  outboxSnapshot():OutboxRow[]{return frozenClone(this.state.outbox);}
  private request(input:unknown):IssuanceRequest{
    try{
      const o=object(input),keys=['issuanceId','environmentId','userId','purpose','expectedAccountRevision','expectedPurposeRevision','expiresAtMs'];
      exact(o,Object.hasOwn(o,'createAccount')?[...keys,'createAccount']:keys);
      if(!identifier(o.issuanceId)||o.environmentId!==this.options.environmentId||!identifier(o.userId)||!purpose(o.purpose)
        ||typeof o.expectedAccountRevision!=='number'||!Number.isSafeInteger(o.expectedAccountRevision)||o.expectedAccountRevision<0
        ||typeof o.expectedPurposeRevision!=='number'||!Number.isSafeInteger(o.expectedPurposeRevision)||o.expectedPurposeRevision<0
        ||typeof o.expiresAtMs!=='number'||!Number.isSafeInteger(o.expiresAtMs)||o.expiresAtMs<0||o.expiresAtMs>8640000000000000)throw new Error();
      const result:IssuanceRequest={issuanceId:o.issuanceId,environmentId:this.options.environmentId,userId:o.userId,purpose:o.purpose,
        expectedAccountRevision:o.expectedAccountRevision,expectedPurposeRevision:o.expectedPurposeRevision,expiresAtMs:o.expiresAtMs};
      if(Object.hasOwn(o,'createAccount')){const a=object(o.createAccount);exact(a,['recipient']);if(!recipient(a.recipient))throw new Error();return Object.freeze({...result,createAccount:Object.freeze({recipient:a.recipient})});}
      return Object.freeze(result);
    }catch{throw new AuthDeliveryError('INVALID_INPUT');}
  }
  private scope(userId:string,p:Purpose):string{return JSON.stringify([this.options.environmentId,userId,p]);}
  async issue(input:IssuanceRequest):Promise<IssuanceReceipt>{
    try{return await this.issueInternal(input);}catch(error){throw new AuthDeliveryError(error instanceof AuthDeliveryError?error.code:'KEY_UNAVAILABLE');}
  }
  private async issueInternal(input:IssuanceRequest):Promise<IssuanceReceipt>{
    const request=this.request(input),scope=this.scope(request.userId,request.purpose),key=JSON.stringify([scope,request.issuanceId]),digest=hash(JSON.stringify(request));
    const replay=this.state.issuances[key];if(replay){if(replay.digest!==digest)throw new AuthDeliveryError('ISSUANCE_CONFLICT');return Object.freeze({...replay.receipt});}
    if(request.expiresAtMs<=this.now())throw new AuthDeliveryError('TOKEN_EXPIRED');
    const check=()=>{
      const a=this.state.accounts.find(a=>a.id===request.userId);
      if((a?.revision??0)!==request.expectedAccountRevision||(this.state.revisions[scope]??0)!==request.expectedPurposeRevision
        ||Boolean(a)===Boolean(request.createAccount))throw new AuthDeliveryError('ISSUANCE_CONFLICT');
      return a;
    };
    const existing=check(),originalRecipient=existing?.recipient??request.createAccount?.recipient;
    if(!originalRecipient)throw new AuthDeliveryError('INVALID_INPUT');
    const issuedAtMs=this.now(),token='SYNTHETIC_'+randomBytes(48).toString('base64url'),messageId=randomUUID(),tokenRecordId=randomUUID();
    const context:DeliveryContext={environmentId:this.options.environmentId,messageId,tokenRecordId,userId:request.userId,purpose:request.purpose};
    const envelope=await this.options.codec.protect({templateVersion:2,purpose:request.purpose,messageId,tokenRecordId,userId:request.userId,
      recipient:originalRecipient,issuedAt:new Date(issuedAtMs).toISOString(),expiresAt:new Date(request.expiresAtMs).toISOString(),token},context);
    const now=this.now();if(now>=request.expiresAtMs)throw new AuthDeliveryError('TOKEN_EXPIRED');
    const concurrent=this.state.issuances[key];if(concurrent){if(concurrent.digest!==digest)throw new AuthDeliveryError('ISSUANCE_CONFLICT');return Object.freeze({...concurrent.receipt});}
    check();const staged=clone(this.state);
    let account=staged.accounts.find(a=>a.id===request.userId);
    if(!account){account={id:request.userId,recipient:originalRecipient,revision:1,emailVerified:false,passwordEffects:0,sessionEffects:0};staged.accounts.push(account);}
    this.fault('account');
    for(const row of staged.tokens)if(row.userId===request.userId&&row.purpose===request.purpose&&row.consumedAtMs===null&&row.revokedAtMs===null)row.revokedAtMs=now;
    this.fault('supersession');
    staged.tokens.push({id:tokenRecordId,userId:request.userId,accountRevision:account.revision,purpose:request.purpose,tokenHash:hash(token),issuedAtMs,
      expiresAtMs:request.expiresAtMs,consumedAtMs:null,revokedAtMs:null,messageId});this.fault('token');
    staged.outbox.push({id:messageId,tokenRecordId,userId:request.userId,purpose:request.purpose,envelope:parseEnvelope(envelope),status:'PENDING',version:1,attempts:0,maxAttempts:this.maximum,
      nextAttemptAtMs:now,leaseOwnerId:null,leaseExpiresAtMs:null,reasonCode:null});this.fault('message');
    const receipt:IssuanceReceipt={issuanceId:request.issuanceId,messageId,tokenRecordId};
    staged.issuances[key]={digest,receipt};staged.revisions[scope]=(staged.revisions[scope]??0)+1;this.fault('registry');this.fault('publish');
    this.state=staged;return Object.freeze({...receipt});
  }
  private context(row:OutboxRow):DeliveryContext{return contextSnapshot({environmentId:this.options.environmentId,messageId:row.id,tokenRecordId:row.tokenRecordId,userId:row.userId,purpose:row.purpose});}
  private valid(row:OutboxRow,now:number):TokenRow{
    const token=this.state.tokens.find(t=>t.id===row.tokenRecordId),account=this.state.accounts.find(a=>a.id===row.userId);
    if(!token||token.userId!==row.userId||token.messageId!==row.id||token.purpose!==row.purpose)throw new AuthDeliveryError('TOKEN_INVALID');
    if(token.expiresAtMs<=now)throw new AuthDeliveryError('TOKEN_EXPIRED');
    if(token.consumedAtMs!==null)throw new AuthDeliveryError('TOKEN_CONSUMED');
    if(token.revokedAtMs!==null)throw new AuthDeliveryError('TOKEN_REVOKED');
    if(!account||account.revision!==token.accountRevision)throw new AuthDeliveryError('RECIPIENT_CHANGED');return token;
  }
  claim(messageId:string,workerId:string):Lease|null{
    if(!identifier(messageId)||!identifier(workerId))throw new AuthDeliveryError('INVALID_INPUT');const now=this.now();
    const staged=clone(this.state),row=staged.outbox.find(r=>r.id===messageId);if(!row)return null;
    if(row.status==='PROCESSING'&&row.leaseExpiresAtMs!==null&&now>=row.leaseExpiresAtMs){row.status='PENDING';row.version++;row.leaseOwnerId=null;row.leaseExpiresAtMs=null;}
    if(row.status!=='PENDING'||row.nextAttemptAtMs>now)return null;
    row.status='PROCESSING';row.version++;row.leaseOwnerId=workerId;row.leaseExpiresAtMs=now+this.leaseMs;this.state=staged;
    return Object.freeze({messageId,workerId,version:row.version,expiresAtMs:row.leaseExpiresAtMs});
  }
  private owned(lease:Lease,now:number):OutboxRow{
    const o=object(lease);exact(o,['messageId','workerId','version','expiresAtMs']);
    const row=this.state.outbox.find(r=>r.id===lease.messageId);
    if(!row||row.status!=='PROCESSING'||row.version!==lease.version||row.leaseOwnerId!==lease.workerId||row.leaseExpiresAtMs!==lease.expiresAtMs||now>=lease.expiresAtMs)throw new AuthDeliveryError('LEASE_LOST');return row;
  }
  /** All acknowledgments are CAS-fenced; test harness can explicitly model a stale acknowledgment. */
  acknowledge(lease:Lease,status:StatusForAck,reasonCode:Reason|null=null):boolean{
    const now=this.now();let current:OutboxRow;try{current=this.owned(lease,now);}catch{return false;}
    if((status!=='DELIVERED'&&status!=='FAILED'&&status!=='PENDING')||(reasonCode!==null&&!isReason(reasonCode)))return false;
    const staged=clone(this.state),row=staged.outbox.find(r=>r.id===current.id);if(!row)return false;
    row.status=status;row.reasonCode=reasonCode;row.version++;row.leaseOwnerId=null;row.leaseExpiresAtMs=null;this.state=staged;return true;
  }
  private result(messageId:string):DispatchResult{const row=this.state.outbox.find(r=>r.id===messageId);return {messageId,status:row?.status??'FAILED',reasonCode:row?.reasonCode??null};}
  async dispatch(inputLease:Lease,inputGrant:unknown):Promise<DispatchResult>{
    const lease=Object.freeze({...inputLease});let row:OutboxRow;
    try{
      row=clone(this.owned(lease,this.now()));this.valid(row,this.now());const c=this.context(row),g=grantSnapshot(inputGrant,c);
      if(g.workerId!==lease.workerId)throw new AuthDeliveryError('FORBIDDEN');
      const payload=await this.options.codec.unprotect(row.envelope,c,g);
      const now=this.now(),current=this.owned(lease,now),token=this.valid(current,now),account=this.state.accounts.find(a=>a.id===row.userId);
      if(g.expiresAtMs<=now)throw new AuthDeliveryError('FORBIDDEN');
      if(!account||payload.recipient!==account.recipient)throw new AuthDeliveryError('RECIPIENT_CHANGED');
      if(payload.messageId!==row.id||payload.tokenRecordId!==token.id||payload.userId!==row.userId||payload.purpose!==row.purpose||hash(payload.token)!==token.tokenHash
        ||Date.parse(payload.expiresAt)!==token.expiresAtMs||Date.parse(payload.issuedAt)!==token.issuedAtMs)throw new AuthDeliveryError('TOKEN_INVALID');
      // Never race a pending send with a timeout/retry. No DB-like transaction spans this await.
      const outcome=await this.options.transport.submit({messageId:row.id,recipient:payload.recipient,token:payload.token,purpose:payload.purpose});
      this.fault('afterSubmit');
      if(outcome==='submitted'){this.acknowledge(lease,'DELIVERED');return this.result(row.id);}
      if(outcome==='suppressed'){this.acknowledge(lease,'FAILED','DELIVERY_DISABLED');return this.result(row.id);}
      if(outcome==='transientFailure'||outcome==='ambiguous')return this.retry(lease,outcome==='ambiguous'?'TRANSPORT_AMBIGUOUS':'TRANSPORT_TRANSIENT');
      this.acknowledge(lease,'FAILED','TRANSPORT_TERMINAL');return this.result(row.id);
    }catch(error){
      // A simulated crash after acceptance leaves PROCESSING for recovery, never a spurious ack.
      if(error instanceof SimulatedCrash)return this.result(lease.messageId);
      const code=error instanceof AuthDeliveryError?error.code:'TRANSPORT_TERMINAL';
      if(code==='KEY_UNAVAILABLE')return this.retry(lease,code);
      this.acknowledge(lease,'FAILED',code);return this.result(lease.messageId);
    }
  }
  private retry(lease:Lease,code:Reason):DispatchResult{
    const now=this.now();let current:OutboxRow;try{current=this.owned(lease,now);this.valid(current,now);}catch(e){this.acknowledge(lease,'FAILED',e instanceof AuthDeliveryError?e.code:'TOKEN_INVALID');return this.result(lease.messageId);}
    const attempts=current.attempts+1,terminal=attempts>=current.maxAttempts;
    if(!this.acknowledge(lease,terminal?'FAILED':'PENDING',code))return this.result(lease.messageId);
    const staged=clone(this.state),row=staged.outbox.find(r=>r.id===lease.messageId);if(row){row.attempts=attempts;row.nextAttemptAtMs=now+Math.min(30,2**(attempts-1))*60000;}this.state=staged;return this.result(lease.messageId);
  }
  consume(token:string,p:Purpose,effect:ConsumeEffect):boolean{
    const now=this.now();if(!validToken(token)||!purpose(p)||(effect!=='VERIFY_EMAIL'&&effect!=='RESET_PASSWORD')||(p==='EMAIL_VERIFY')!==(effect==='VERIFY_EMAIL'))return false;
    const found=this.state.tokens.find(t=>t.tokenHash===hash(token)&&t.purpose===p);if(!found)return false;
    const row=this.state.outbox.find(r=>r.id===found.messageId);if(!row)return false;try{this.valid(row,now);}catch{return false;}
    const staged=clone(this.state),t=staged.tokens.find(t=>t.id===found.id),a=staged.accounts.find(a=>a.id===found.userId);if(!t||!a)return false;
    t.consumedAtMs=now;if(effect==='VERIFY_EMAIL')a.emailVerified=true;else{a.passwordEffects++;a.sessionEffects++;}this.fault('effect');this.state=staged;return true;
  }
  revoke(tokenRecordId:string):boolean{const now=this.now(),staged=clone(this.state),t=staged.tokens.find(t=>t.id===tokenRecordId);if(!t||t.revokedAtMs!==null)return false;t.revokedAtMs=now;this.state=staged;return true;}
  changeRecipient(userId:string,value:string):boolean{this.now();if(!recipient(value))throw new AuthDeliveryError('INVALID_INPUT');const staged=clone(this.state),a=staged.accounts.find(a=>a.id===userId);if(!a)return false;a.recipient=value;a.revision++;this.state=staged;return true;}
  redrive(messageId:string,expectedVersion:number):boolean{
    const now=this.now(),current=this.state.outbox.find(r=>r.id===messageId);
    if(!current||current.status!=='FAILED'||current.version!==expectedVersion||!['DELIVERY_DISABLED','TRANSPORT_TRANSIENT','TRANSPORT_AMBIGUOUS','KEY_UNAVAILABLE'].includes(current.reasonCode??''))return false;
    try{this.valid(current,now);}catch{return false;}const staged=clone(this.state),row=staged.outbox.find(r=>r.id===messageId);if(!row)return false;
    row.status='PENDING';row.version++;row.attempts=0;row.nextAttemptAtMs=now;row.reasonCode=null;this.state=staged;return true;
  }
}
type StatusForAck='DELIVERED'|'FAILED'|'PENDING';
/** Explicit test-only interruption, never contains submitted material. */
export class SimulatedCrash extends Error{constructor(){super('SYNTHETIC_CRASH');}}
export function classifyLegacy(v:unknown):'V2'|'LEGACY_REQUIRES_REVIEW'{
  const o=object(v);if(Object.hasOwn(o,'envelopeVersion')){parseEnvelope(v);return 'V2';}
  exact(o,['template','params']);if(o.template!=='EMAIL_VERIFICATION'&&o.template!=='PASSWORD_RESET')throw new AuthDeliveryError('INVALID_ENVELOPE');object(o.params);return 'LEGACY_REQUIRES_REVIEW';
}
