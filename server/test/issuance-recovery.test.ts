import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID, generateKeyPairSync, sign } from 'node:crypto';
import type { AuthTransaction, Credential, ProtectedJob, AccountBinding } from '../src/security/protected-auth.js';
import type { IssuanceStore, IssuanceRecord, IssuanceTransaction, IssuanceReceipt } from '../src/security/issuance-replay.js';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';


const mocks=vi.hoisted(()=>({boundary:false,transaction:vi.fn(),find:vi.fn(),mail:vi.fn(),enabled:true}));
vi.mock('../src/lib/prisma.js',()=>{if(!mocks.boundary)throw new Error('IMPORT_BEFORE_GUARDS');return {prisma:{$transaction:mocks.transaction,idempotencyRecord:{findUnique:mocks.find}}};});
vi.mock('pg',()=>{throw new Error('PG_FORBIDDEN')});
vi.mock('@prisma/adapter-pg',()=>{throw new Error('ADAPTER_FORBIDDEN')});
vi.mock('dotenv',()=>{throw new Error('DOTENV_FORBIDDEN')});
vi.mock('nodemailer',()=>({default:{createTransport:()=>({sendMail:mocks.mail})}}));
vi.mock('../src/config/env.js',()=>({env:{get emailDeliveryEnabled(){return mocks.enabled;},smtpHost:'smtp.example.invalid',smtpPort:587,smtpUser:'synthetic@example.invalid',smtpPassword:'SYNTHETIC',smtpEmailFrom:'synthetic@example.invalid',smtpEmailFromName:'Synthetic'}}));
const attempts: string[] = [];
const restore: Array<() => void> = [];
function installGuards(): void {
  const replace = (target: object, key: string, label: string) => {
    const original = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, writable: true, value: () => {
      attempts.push(label); throw new Error('OUT04_OFFLINE_BOUNDARY');
    } });
    restore.push(() => {
      if (original) Object.defineProperty(target, key, original);
      else Reflect.deleteProperty(target, key);
    });
  };
  for (const key of ['connect', 'createConnection']) replace(net, key, `net.${key}`);
  replace(net.Socket.prototype, 'connect', 'socket.connect');
  replace(tls, 'connect', 'tls.connect');
  for (const [name, target] of [['http', http], ['https', https]] as const) {
    for (const key of ['get', 'request']) replace(target, key, `${name}.${key}`);
    replace(target.Agent.prototype, 'createConnection', `${name}.agent`);
  }
  for (const target of [dns, dns.promises, dns.Resolver.prototype, dns.promises.Resolver.prototype]) {
    for (const key of Object.getOwnPropertyNames(target)) {
      if ((key === 'lookup' || key === 'lookupService' || key === 'reverse' || key.startsWith('resolve')) &&
          typeof Reflect.get(target, key) === 'function') replace(target, key, `dns.${key}`);
    }
  }
  replace(dgram, 'createSocket', 'udp');
  for (const key of ['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork']) {
    replace(childProcess, key, `process.${key}`);
  }
  replace(globalThis, 'fetch', 'fetch');
  if ('WebSocket' in globalThis) replace(globalThis, 'WebSocket', 'websocket');
  syncBuiltinESMExports();
  mocks.boundary = true;

}


let auth:typeof import('../src/services/protected-auth.service.js');
let replay:typeof import('../src/security/issuance-replay.js');
let recovery:typeof import('../src/security/notification-recovery.js');
let pg:typeof import('../src/security/protected-auth.pg.js');
let quarantinePg:typeof import('../src/security/notification-recovery.pg.js');
let outbox:typeof import('../src/services/outbox.service.js');
let epoch:typeof import('../src/security/recovery-epoch.js');
beforeAll(async()=>{installGuards();[auth,replay,recovery,pg,quarantinePg,outbox,epoch]=await Promise.all([import('../src/services/protected-auth.service.js'),import('../src/security/issuance-replay.js'),import('../src/security/notification-recovery.js'),import('../src/security/protected-auth.pg.js'),import('../src/security/notification-recovery.pg.js'),import('../src/services/outbox.service.js'),import('../src/security/recovery-epoch.js')]);});
beforeEach(()=>{mocks.mail.mockClear();});
afterEach(()=>{expect(attempts).toEqual([]);});afterAll(()=>{for(const undo of restore.reverse())undo();syncBuiltinESMExports();});
function setup(existing=true){
 let account:(AccountBinding&{emailVerified:boolean})|null=existing?{userId:'synthetic-user',recipient:'synthetic@example.invalid',generation:2,emailVerified:false}:null;
 let credentials:Credential[]=[],jobs:ProtectedJob[]=[],sessions=0,state='PENDING';const events:string[]=[],fail={stage:''};
 const step=(name:string)=>{events.push(name);if(fail.stage===name)throw new Error('SYNTHETIC-PRIVATE');};
 const store={
  async lookupAccount(email:string){step('lookup');return account?.recipient===email?account:null;},
  lookupCredential:vi.fn(async(_digest:string,_purpose:'reset'|'verification')=>({id:'credential'})),
  consume:vi.fn(async()=>true),
  async transaction<T>(work:(tx:AuthTransaction)=>Promise<T>):Promise<T>{
   const saved={account,credentials:credentials.slice(),jobs:jobs.slice(),sessions};
   try{const result=await work({
    async createAccount(input){step('create-account');account={userId:input.id,recipient:input.email,generation:0,emailVerified:false};},
    async createSession(){step('create-session');sessions++;},async account(){step('account');return account;},
    async supersede(){step('supersede');credentials=credentials.map(c=>({...c,revokedAt:new Date()}));},
    async insertCredential(c){step('credential');credentials.push(c);},async insertJob(j){step('job');jobs.push(j);},
    async revoke(){step('revoke');if(account)account={...account,generation:account.generation+1};credentials=credentials.map(c=>({...c,revokedAt:new Date()}));},
   });step('commit');return result;}catch(error){({account,credentials,jobs,sessions}=saved);throw error;}
  },
  async claim(jobId:string,workerId:string){step('claim');if(state!=='PENDING')return null;state='LEASED';return {jobId,workerId,version:1};},
  async admit(){step('admit');const c=credentials.at(-1),j=jobs.at(-1);return c&&j&&account?.generation===c.generation&&!c.revokedAt?{credential:c,job:j}:null;},
  async beginSend(){step('intent');if(fail.stage==='lease-lost')return false;state='SENDING';return true;},
  async finish(_lease:unknown,outcome:string){step('finish');state=outcome;return true;},
 };
 const keys={boundary:vi.fn((ref:string)=>{if(ref!=='test-key')throw new Error('SYNTHETIC-PRIVATE');return {authorize:async()=>true,acquireDataKey:async()=>Buffer.alloc(32,4)};})};
 const sign=vi.fn((user:unknown)=>{expect(Object.isFrozen(user)).toBe(true);step('sign');return 'SYNTHETIC-ACCESS-TOKEN';});
 const compose=()=>auth.createProtectedAuthServices({store,keys,keyRef:'test-key',refreshTokenExpiresDays:30,signAccessToken:sign,recovery:{admit:async()=>true}});
 return {store,keys,compose,events,fail,sign,get credentials(){return credentials;},get jobs(){return jobs;},get sessions(){return sessions;},get state(){return state;},
  verified:()=>{if(account)account={...account,emailVerified:true};}};
}

const admission={admit:vi.fn(async()=>true)};
const policy=(version='v1')=>({currentVersion:version,acquireKey:vi.fn((v:string)=>{if(!['v1','v2'].includes(v))throw new Error('SYNTHETIC-PRIVATE');return Buffer.alloc(32,v==='v1'?3:4);})});
const empty=(operation:'register'|'reset'|'verification'='reset'):IssuanceReceipt=>({operation,userId:null,credentialId:null,jobId:null,sessionId:null});
function ledger(base:ReturnType<typeof setup>){
 let rows=new Map<string,IssuanceRecord>(),tail=Promise.resolve();const controls={failComplete:false,loseAck:false},calls={prepares:0,reservations:0,completions:0};
 const store:IssuanceStore={
  lookupRequest:vi.fn(async key=>rows.get(key)??null),
  async issuanceTransaction(work){let unlock=()=>{};const before=tail;tail=new Promise<void>(r=>{unlock=r;});await before;
   const saved=new Map(rows);let committed=false;
   try{const value=await base.store.transaction(async tx=>{const result=await work({...tx,
    async reserveRequest(keyHash,fingerprint){calls.reservations++;const old=rows.get(keyHash);return old?{created:false,record:old}:{created:true,record:null};},
    async completeRequest(keyHash,receipt){calls.completions++;if(controls.failComplete)throw new Error('SYNTHETIC-PRIVATE');
     // Capture the fingerprint from the current test request, as INSERT reservation would do.
     rows.set(keyHash,{fingerprint:pendingFingerprint,receipt:{...receipt}});},
   });return result;});committed=true;if(controls.loseAck)throw new Error('SYNTHETIC-PRIVATE');return value;
   }catch(error){if(!committed)rows=saved;throw error;}finally{unlock();}
  },
 };
 // Preserve exact candidate fingerprint without exposing it to the test's prepare callback.
 let pendingFingerprint='';const original=store.issuanceTransaction.bind(store);
 store.issuanceTransaction=work=>original(tx=>work({...tx,reserveRequest:async(k,f)=>{pendingFingerprint=f;return tx.reserveRequest(k,f);}}));
 return {store,controls,calls,get rows(){return rows;}};
}
function composed(base:ReturnType<typeof setup>,l:ReturnType<typeof ledger>,p=policy(),gate=admission){return auth.createProtectedAuthServices({store:base.store,keys:base.keys,keyRef:'test-key',refreshTokenExpiresDays:30,signAccessToken:base.sign,recovery:gate,requests:{store:l.store,policy:p}});}

describe('durable issuance request execution and service integration',()=>{
 beforeEach(()=>admission.admit.mockReset().mockResolvedValue(true));
 it('reset replay never regenerates a credential, encrypts or supersedes',async()=>{const b=setup(),l=ledger(b),service=composed(b,l),id=randomUUID();await service.requestPasswordResetOnce('synthetic@example.invalid',id);const count=b.keys.boundary.mock.calls.length,events=b.events.slice();await service.requestPasswordResetOnce('Synthetic@Example.Invalid',id);expect(b.credentials).toHaveLength(1);expect(b.jobs).toHaveLength(1);expect(b.events).toEqual(events);expect(b.keys.boundary).toHaveBeenCalledTimes(count);expect(l.rows.size).toBe(1);});
 it('verification replay is not a deliberate superseding issuance',async()=>{const b=setup(),l=ledger(b),s=composed(b,l),id=randomUUID();await s.resendVerificationOnce('synthetic@example.invalid',id);await s.resendVerificationOnce('synthetic@example.invalid',id);expect(b.credentials).toHaveLength(1);expect(b.credentials[0].revokedAt).toBeNull();await s.resendVerificationOnce('synthetic@example.invalid',randomUUID());expect(b.credentials).toHaveLength(2);expect(b.credentials[0].revokedAt).toBeInstanceOf(Date);});
 it('registration replay returns no refresh/access secret or replacement session',async()=>{const b=setup(false),l=ledger(b),s=composed(b,l),id=randomUUID(),input={email:'synthetic@example.invalid',password:'SyntheticPassword42'};const first=await s.registerRequest(input,id);expect(first.status).toBe('created');const calls=b.sign.mock.calls.length;expect(await s.registerRequest(input,id)).toEqual({status:'replayed'});expect(b.sessions).toBe(1);expect(b.sign).toHaveBeenCalledTimes(calls);expect(b.jobs).toHaveLength(1);expect(JSON.stringify([...l.rows.values()])).not.toContain(input.password);expect(JSON.stringify([...l.rows.values()])).not.toContain('SYNTHETIC-ACCESS');await expect(s.registerRequest({...input,password:'DifferentPassword43'},id)).rejects.toMatchObject({statusCode:409});expect(b.sessions).toBe(1);});
 it('same request ID with changed recipient or purpose fails without mutation',async()=>{const b=setup(),l=ledger(b),s=composed(b,l),id=randomUUID();await s.requestPasswordResetOnce('synthetic@example.invalid',id);const before=b.events.slice();await expect(s.requestPasswordResetOnce('other@example.invalid',id)).rejects.toMatchObject({statusCode:409});await expect(s.resendVerificationOnce('synthetic@example.invalid',id)).rejects.toMatchObject({statusCode:409});expect(b.events).toEqual(before);});
 it('ledger-enabled composition cannot bypass replay through compatibility issuers',async()=>{const b=setup(),l=ledger(b),s=composed(b,l);await expect(s.requestPasswordReset('synthetic@example.invalid')).rejects.toMatchObject({statusCode:400});await expect(s.resendVerification('synthetic@example.invalid')).rejects.toMatchObject({statusCode:400});await expect(s.register({email:'synthetic@example.invalid',password:'SyntheticPassword42'})).rejects.toMatchObject({statusCode:400});expect(b.events).toEqual([]);});
 it('unknown-account no-op is durable if the account appears later',async()=>{const b=setup(false),l=ledger(b),s=composed(b,l),id=randomUUID();await s.requestPasswordResetOnce('synthetic@example.invalid',id);await b.store.transaction(tx=>tx.createAccount({id:'new-user',email:'synthetic@example.invalid',passwordHash:'synthetic',name:null}));await s.requestPasswordResetOnce('synthetic@example.invalid',id);expect(b.jobs).toEqual([]);expect(l.rows.size).toBe(1);});
 it('concurrent same-ID requests prepare but only one applies/commits',async()=>{const b=setup(),l=ledger(b),s=composed(b,l),id=randomUUID();await Promise.all([s.requestPasswordResetOnce('synthetic@example.invalid',id),s.requestPasswordResetOnce('synthetic@example.invalid',id)]);expect(b.credentials).toHaveLength(1);expect(b.jobs).toHaveLength(1);expect(l.calls.completions).toBe(1);});
 it('request receipt and all issuance effects roll back together',async()=>{const b=setup(),l=ledger(b),s=composed(b,l);l.controls.failComplete=true;await expect(s.requestPasswordResetOnce('synthetic@example.invalid',randomUUID())).rejects.toMatchObject({statusCode:500});expect(l.rows.size).toBe(0);expect(b.credentials).toEqual([]);expect(b.jobs).toEqual([]);});
 it('lost commit acknowledgment is not auto-retried; later lookup safely replays',async()=>{const b=setup(),l=ledger(b),s=composed(b,l),id=randomUUID();l.controls.loseAck=true;await expect(s.requestPasswordResetOnce('synthetic@example.invalid',id)).rejects.toMatchObject({statusCode:500});expect(b.credentials).toHaveLength(1);const count=b.keys.boundary.mock.calls.length;await s.requestPasswordResetOnce('synthetic@example.invalid',id);expect(b.credentials).toHaveLength(1);expect(b.keys.boundary).toHaveBeenCalledTimes(count);});
 it('replay reads retained digest-key version after rotation',async()=>{const b=setup(),l=ledger(b),id=randomUUID();await composed(b,l).requestPasswordResetOnce('synthetic@example.invalid',id);const p=policy('v2');await composed(b,l,p).requestPasswordResetOnce('synthetic@example.invalid',id);expect(p.acquireKey).toHaveBeenCalledWith('v1');expect(b.credentials).toHaveLength(1);});
 it('UUID normalization preserves the same request identity',async()=>{const b=setup(),l=ledger(b),s=composed(b,l),id=randomUUID();await s.requestPasswordResetOnce('synthetic@example.invalid',id);await s.requestPasswordResetOnce('synthetic@example.invalid',id.toUpperCase());expect(b.credentials).toHaveLength(1);});
 it('logical input is snapshotted before asynchronous admission',async()=>{const b=setup(),l=ledger(b),id=randomUUID(),logical={email:'original@example.invalid'};let prepares=0;
  const gate={admit:async()=>{logical.email='mutated@example.invalid';return true;}};
  const prepare=async()=>{prepares++;return {receipt:empty(),value:undefined,apply:async()=>{}};};
  await replay.executeIssuanceRequest(l.store,policy(),gate,id,'reset',logical,prepare);
  expect((await replay.executeIssuanceRequest(l.store,policy(),admission,id,'reset',{email:'original@example.invalid'},prepare)).replayed).toBe(true);expect(prepares).toBe(1);
 });
 it('malformed stored receipts cannot return extra secrets or regenerate work',async()=>{const b=setup(),l=ledger(b),s=composed(b,l),id=randomUUID();await s.requestPasswordResetOnce('synthetic@example.invalid',id);const row=[...l.rows.values()][0];Object.assign(row.receipt,{token:'SYNTHETIC-PRIVATE'});await expect(s.requestPasswordResetOnce('synthetic@example.invalid',id)).rejects.toMatchObject({statusCode:500});expect(b.jobs).toHaveLength(1);Reflect.deleteProperty(row.receipt,'token');let reads=0;Object.setPrototypeOf(row.receipt,{toJSON(){reads++;return 'SYNTHETIC-PRIVATE';}});await expect(s.requestPasswordResetOnce('synthetic@example.invalid',id)).rejects.toMatchObject({statusCode:500});expect(reads).toBe(0);});
 it('missing retained key does not issue again',async()=>{const b=setup(),l=ledger(b),id=randomUUID();await composed(b,l).requestPasswordResetOnce('synthetic@example.invalid',id);const p=policy('v2');p.acquireKey.mockImplementation(()=>{throw new Error('SYNTHETIC-PRIVATE');});await expect(composed(b,l,p).requestPasswordResetOnce('synthetic@example.invalid',id)).rejects.toMatchObject({statusCode:500});expect(b.credentials).toHaveLength(1);});
 it('revoked credential replay cannot resurrect/requeue it',async()=>{const b=setup(),l=ledger(b),s=composed(b,l),id=randomUUID();await s.requestPasswordResetOnce('synthetic@example.invalid',id);await s.revokeUserSessions('synthetic-user');await s.requestPasswordResetOnce('synthetic@example.invalid',id);expect(b.credentials).toHaveLength(1);expect(b.credentials[0].revokedAt).toBeInstanceOf(Date);});
 it('denied recovery epoch touches no ledger/store/key',async()=>{const b=setup(),l=ledger(b);admission.admit.mockResolvedValue(false);await expect(composed(b,l).requestPasswordResetOnce('synthetic@example.invalid',randomUUID())).rejects.toMatchObject({statusCode:500});expect(b.events).toEqual([]);expect(l.store.lookupRequest).not.toHaveBeenCalled();expect(b.keys.boundary).not.toHaveBeenCalled();});
 it('recovery denial after preparation prevents transaction entry',async()=>{const b=setup(),l=ledger(b);admission.admit.mockResolvedValueOnce(true).mockResolvedValueOnce(false);await expect(composed(b,l).requestPasswordResetOnce('synthetic@example.invalid',randomUUID())).rejects.toMatchObject({statusCode:500});expect(l.calls.reservations).toBe(0);expect(b.jobs).toEqual([]);});
 it('consume path is denied during restoration before credential lookup',async()=>{const b=setup(),l=ledger(b);admission.admit.mockResolvedValue(false);await expect(composed(b,l).verifyEmail('s'.repeat(64))).rejects.toMatchObject({statusCode:500});expect(b.store.lookupCredential).not.toHaveBeenCalled();});
 it('restoration denial prevents worker admission, decrypt and transport',async()=>{const b=setup(),authorize=vi.fn(async()=>true);expect(await outbox.processProtectedNotificationJob({store:b.store,keys:b.keys,frontendOrigin:'https://synthetic.example.invalid',authorize,recovery:{admit:async()=>false},jobId:'synthetic-job',workerId:'synthetic-worker'})).toBe('denied');expect(authorize).not.toHaveBeenCalled();expect(b.keys.boundary).not.toHaveBeenCalled();expect(b.events).toEqual([]);expect(mocks.mail).not.toHaveBeenCalled();});
 it('missing ledger composition never silently uses the non-replay issuer',async()=>{const b=setup(false);await expect(b.compose().registerRequest({email:'synthetic@example.invalid',password:'SyntheticPassword42'},randomUUID())).rejects.toMatchObject({statusCode:500});expect(b.events).toEqual([]);});
 for(const id of ['short','00000000-0000-0000-0000-000000000000','bad\nrequest'])it('invalid request key fails before any work '+id.length,async()=>{const b=setup(),l=ledger(b);await expect(composed(b,l).requestPasswordResetOnce('synthetic@example.invalid',id)).rejects.toMatchObject({statusCode:500});expect(b.events).toEqual([]);});
});

describe('strict compatible notification reader',()=>{
 for(const template of ['INQUIRY_CONFIRMATION','BOOKING_CONFIRMATION','BOOKING_STATUS','CONTACT_CONFIRMATION'])it('reads ordinary '+template,()=>{const payload={template,params:{name:'Synthetic',items:[{n:1}]}};const value=recovery.readCompatibleNotification('ordinary',payload);expect(value.kind).toBe('ordinary');if(value.kind==='ordinary'){expect(value.params).toEqual(payload.params);expect(value.params).not.toBe(payload.params);}});
 for(const template of ['EMAIL_VERIFICATION','PASSWORD_RESET'])it('quarantines retained auth '+template,()=>{expect(recovery.readCompatibleNotification('ordinary',{template,params:{token:'SYNTHETIC'}})).toEqual({kind:'quarantine',reason:'LEGACY_AUTH'});});
 it('rejects credentials hidden beneath an ordinary template',()=>{expect(recovery.readCompatibleNotification('ordinary',{template:'BOOKING_CONFIRMATION',params:{nested:{resetUrl:'SYNTHETIC'}}})).toEqual({kind:'quarantine',reason:'LEGACY_AUTH'});});
 it('does not downgrade an encrypted/mixed payload to ordinary',()=>{expect(recovery.readCompatibleNotification('ordinary',{template:'BOOKING_CONFIRMATION',params:{},envelope:{version:1}}).kind).toBe('quarantine');});
 it('accepts only exact protected format without decrypting',()=>{expect(recovery.readCompatibleNotification('protected',{version:1,keyRef:'key',nonce:Buffer.alloc(12).toString('base64url'),ciphertext:Buffer.from('SYNTHETIC').toString('base64url'),tag:Buffer.alloc(16).toString('base64url')}).kind).toBe('protected');});
 for(const payload of [null,[],{template:'UNKNOWN',params:{}},{template:'BOOKING_STATUS',params:null},{version:2},{template:'BOOKING_STATUS',params:{number:Infinity}}])it('quarantines malformed/unknown without raw output',()=>{expect(recovery.readCompatibleNotification('ordinary',payload).kind).toBe('quarantine');});
 it('does not execute getters/proxy hooks or serialize exceptions',()=>{let calls=0;for(const payload of [{get template(){calls++;throw new Error('SYNTHETIC-PRIVATE');}},new Proxy({},{ownKeys(){calls++;throw new Error();}})])expect(recovery.readCompatibleNotification('ordinary',payload)).toEqual({kind:'quarantine',reason:'MALFORMED'});expect(calls).toBe(0);});
 it('rejects cycles, sparse arrays, oversized strings and prototype keys',()=>{const cycle:Record<string,unknown>={};cycle.cycle=cycle;for(const params of [cycle,{a:[,1]},{a:'x'.repeat(8193)},JSON.parse('{"__proto__":{}}')])expect(recovery.readCompatibleNotification('ordinary',{template:'BOOKING_STATUS',params}).kind).toBe('quarantine');});
});

describe('exact-record quarantine and restoration',()=>{
 const record=()=>({source:'protected' as const,id:'synthetic-job',version:'1',state:'PENDING'});
 it('ordinary compatible payload does not mutate storage',async()=>{const store={quarantineReason:async()=>null,quarantine:vi.fn(async()=>true)};expect((await recovery.quarantineIncompatible(store,record(),{version:1,keyRef:'key',nonce:Buffer.alloc(12).toString('base64url'),ciphertext:'YQ',tag:Buffer.alloc(16).toString('base64url')})).kind).toBe('protected');expect(store.quarantine).not.toHaveBeenCalled();});
 it('incompatible payload is durably quarantined with fixed reason',async()=>{const store={quarantineReason:async()=>null,quarantine:vi.fn(async()=>true)},r=record();expect(await recovery.quarantineIncompatible(store,r,{version:9})).toEqual({kind:'quarantine',reason:'MALFORMED'});expect(store.quarantine).toHaveBeenCalledWith(r,'MALFORMED');});
 it('quarantine CAS failure stops rather than claiming success',async()=>{await expect(recovery.quarantineIncompatible({quarantineReason:async()=>null,quarantine:async()=>false},record(),{})).rejects.toThrow('NOTIFICATION_QUARANTINE_FAILED');});
 it('restored SENDING/AMBIGUOUS records retain ambiguous-send disposition',async()=>{const store={quarantineReason:async()=>null,quarantine:vi.fn(async()=>true)},a={...record(),state:'SENDING'},b={...record(),id:'synthetic-second',state:'AMBIGUOUS'};expect(await recovery.quarantineRestoredBatch(store,[a,b])).toBe(2);expect(store.quarantine).toHaveBeenNthCalledWith(1,a,'AMBIGUOUS_SEND');expect(store.quarantine).toHaveBeenNthCalledWith(2,b,'AMBIGUOUS_SEND');});
 it('stops on a failed exact record after preserving the committed prefix',async()=>{const store={quarantineReason:async()=>null,quarantine:vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)};await expect(recovery.quarantineRestoredBatch(store,[record(),{...record(),id:'second'},{...record(),id:'third'}])).rejects.toThrow('RESTORE_QUARANTINE_INCOMPLETE');expect(store.quarantine).toHaveBeenCalledTimes(2);});
 it('validates the complete manifest before mutating any record',async()=>{const store={quarantineReason:async()=>null,quarantine:vi.fn(async()=>true)};for(const records of [[record(),record()],[record(),{...record(),version:'bad'}],Array.from({length:101},(_,i)=>({...record(),id:'job-'+i}))])await expect(recovery.quarantineRestoredBatch(store,records)).rejects.toThrow('RESTORE_QUARANTINE_INCOMPLETE');expect(store.quarantine).not.toHaveBeenCalled();});
 it('existing quarantine cannot be bypassed by an otherwise ordinary payload',async()=>{const store={quarantineReason:async()=>'RESTORED' as const,quarantine:vi.fn(async()=>true)};expect(await recovery.quarantineIncompatible(store,{source:'ordinary',id:'synthetic-job',version:'2026-10-29T00:00:00.000Z',state:'FAILED'},{template:'BOOKING_CONFIRMATION',params:{}})).toEqual({kind:'quarantine',reason:'RESTORED'});expect(store.quarantine).not.toHaveBeenCalled();});
 it('restore manifest is snapshotted before any awaited write',async()=>{const second={...record(),id:'second'};const store={quarantine:vi.fn(async(_record:unknown,_reason:unknown)=>{second.id='changed-after-admission';return true;})};await recovery.quarantineRestoredBatch(store,[record(),second]);expect(store.quarantine.mock.calls[1][0]).toMatchObject({id:'second'});});
});

describe('real PostgreSQL protocol against fake owned connection',()=>{
 function fake(){const calls:Array<{sql:string;values:unknown[]}>=[];const connection={on:vi.fn(),removeListener:vi.fn(),release:vi.fn(),query:vi.fn(async(sql:string,values:unknown[]=[])=>{calls.push({sql,values});return {rows:[],rowCount:sql.startsWith('SELECT')?1:1};})};return {calls,connection,pool:{connect:async()=>connection}};}
 it('ledger refuses COMMIT with unfinished reservation',async()=>{const f=fake(),s=new pg.PostgresProtectedAuthStore(f.pool as never);await expect(s.issuanceTransaction(async tx=>{await tx.reserveRequest('a'.repeat(64),'h1:v1:'+'a'.repeat(64));})).rejects.toThrow('PROTECTED_STORAGE_FAILED');expect(f.calls.map(c=>c.sql)).not.toContain('COMMIT');expect(f.calls.at(-1)?.sql).toBe('ROLLBACK');});
 it('request receipt completes in same transaction with explicit subject bindings',async()=>{const f=fake(),s=new pg.PostgresProtectedAuthStore(f.pool as never);await s.issuanceTransaction(async tx=>{await tx.reserveRequest('a'.repeat(64),'h1:v1:'+'a'.repeat(64));await tx.completeRequest('a'.repeat(64),empty());});expect(f.calls.at(-1)?.sql).toBe('COMMIT');const q=f.calls.find(c=>c.sql.startsWith('UPDATE public."AuthIssuanceRequest"'));expect(q?.values.slice(2)).toEqual([null,null,null,null]);});
 for(const state of ['SENDING','AMBIGUOUS','SUBMITTED','SUPPRESSED'])it('quarantine never requeues/rewrites protected '+state,async()=>{const f=fake(),s=new quarantinePg.PostgresNotificationQuarantineStore(f.pool as never);expect(await s.quarantine({source:'protected',id:'synthetic-job',version:'1',state},'RESTORED')).toBe(true);expect(f.calls.some(c=>c.sql.startsWith('UPDATE public."ProtectedAuthJob"'))).toBe(false);expect(f.calls.some(c=>c.sql.includes('INSERT INTO public."NotificationQuarantine"'))).toBe(true);});
 it('quarantines pending protected job with monotonic fencing and retained payload',async()=>{const f=fake(),s=new quarantinePg.PostgresNotificationQuarantineStore(f.pool as never);await s.quarantine({source:'protected',id:'synthetic-job',version:'1',state:'PENDING'},'RESTORED');const sql=f.calls.map(c=>c.sql).join('\n');expect(sql).toContain('version=version+1');expect(sql).not.toMatch(/DELETE|TRUNCATE|SET envelope/);});
 it('parameterizes source record/version and sanitizes failures',async()=>{const f=fake();f.connection.query.mockRejectedValue(new Error('SYNTHETIC-PRIVATE'));const s=new quarantinePg.PostgresNotificationQuarantineStore(f.pool as never);await expect(s.quarantine({source:'protected',id:'synthetic-job',version:'1',state:'PENDING'},'RESTORED')).rejects.toThrow('NOTIFICATION_QUARANTINE_STORAGE_FAILED');expect(f.connection.release).toHaveBeenCalledWith(true);});
});

describe('concrete signed external recovery epoch admission — synthetic authority',()=>{
 const keys=generateKeyPairSync('ed25519'),scope='synthetic-local-auth',expected='synthetic-epoch-0001';
 const attestation=(nonce:string,action:string,patch:Record<number,unknown>={})=>{
  const value:unknown[]=['fws-recovery-epoch',1,scope,expected,nonce,action,true,Date.now()-1,Date.now()+1000];
  for(const [index,replacement] of Object.entries(patch))value[Number(index)]=replacement;
  const statement=JSON.stringify(value);return {statement,signature:sign(null,Buffer.from(statement),keys.privateKey).toString('base64url')};
 };
 it('admits a genuine fresh signed statement for each exact action',async()=>{const authority={attest:vi.fn(async(nonce:string,action:string)=>attestation(nonce,action))};const gate=new epoch.SignedRecoveryAdmission({publicKey:keys.publicKey,scope,epoch:expected,authority});for(const action of ['issue','consume','deliver'] as const)expect(await gate.admit(action)).toBe(true);expect(authority.attest).toHaveBeenCalledTimes(3);});
 for(const [index,value] of [[2,'other-scope'],[3,'different-epoch'],[4,'stale-nonce'],[5,'other-action'],[6,false],[7,Date.now()+60000],[8,0]] as const)it('rejects wrong/expired signed field '+index,async()=>{const gate=new epoch.SignedRecoveryAdmission({publicKey:keys.publicKey,scope,epoch:expected,authority:{attest:async(nonce,action)=>attestation(nonce,action,{[index]:value})}});expect(await gate.admit('issue')).toBe(false);});
 it('rejects an unsigned/mutated statement',async()=>{const gate=new epoch.SignedRecoveryAdmission({publicKey:keys.publicKey,scope,epoch:expected,authority:{attest:async(nonce,action)=>({...attestation(nonce,action),signature:Buffer.alloc(64).toString('base64url')})}});expect(await gate.admit('deliver')).toBe(false);});
 it('does not cache a previously signed readiness statement across calls',async()=>{let first:ReturnType<typeof attestation>|undefined;const gate=new epoch.SignedRecoveryAdmission({publicKey:keys.publicKey,scope,epoch:expected,authority:{attest:async(nonce,action)=>{first??=attestation(nonce,action);return first;}}});expect(await gate.admit('issue')).toBe(true);expect(await gate.admit('issue')).toBe(false);});
 it('times out without retrying the authority or logging its error',async()=>{const attest=vi.fn(async()=>{throw new Error('SYNTHETIC-PRIVATE');});const gate=new epoch.SignedRecoveryAdmission({publicKey:keys.publicKey,scope,epoch:expected,authority:{attest}});expect(await gate.admit('issue')).toBe(false);expect(attest).toHaveBeenCalledTimes(1);});
 it('bounds a hung authority and aborts its request',async()=>{let signal:AbortSignal|undefined;const gate=new epoch.SignedRecoveryAdmission({publicKey:keys.publicKey,scope,epoch:expected,authority:{attest:async(_n,_a,s)=>{signal=s;return new Promise(()=>{});}}});expect(await gate.admit('consume')).toBe(false);expect(signal?.aborted).toBe(true);});
 it('rejects accessor responses without invoking the getter',async()=>{let reads=0;const gate=new epoch.SignedRecoveryAdmission({publicKey:keys.publicKey,scope,epoch:expected,authority:{attest:async()=>({get statement(){reads++;return 'SYNTHETIC-PRIVATE';},signature:'a'.repeat(86)})}});expect(await gate.admit('issue')).toBe(false);expect(reads).toBe(0);});
});


