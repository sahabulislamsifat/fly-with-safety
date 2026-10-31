import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import type { AccountBinding, AuthTransaction, Credential, ProtectedJob, ProtectedAuthStore, Lease } from '../src/security/protected-auth.js';
import type { PassengerSecretRecord } from '../src/security/passenger-secrets.js';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';


const mocks=vi.hoisted(()=>({boundary:false}));
vi.mock('../src/lib/prisma.js',()=>{throw new Error('OUT04_DATABASE_IMPORT_FORBIDDEN')});
vi.mock('pg',()=>{throw new Error('PG_FORBIDDEN')});
vi.mock('@prisma/adapter-pg',()=>{throw new Error('ADAPTER_FORBIDDEN')});
vi.mock('dotenv',()=>{throw new Error('DOTENV_FORBIDDEN')});
vi.mock('nodemailer',()=>{throw new Error('SMTP_FORBIDDEN')});
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

let auth: typeof import('../src/security/protected-auth.js');
let codec: typeof import('../src/security/protected-envelope.js');
let digests: typeof import('../src/security/logical-digest.js');
let passenger: typeof import('../src/security/passenger-secrets.js');
let pgStore: typeof import('../src/security/protected-auth.pg.js');
beforeAll(async () => {
 installGuards();
 [auth,codec,digests,passenger,pgStore] = await Promise.all([
  import('../src/security/protected-auth.js'),import('../src/security/protected-envelope.js'),
  import('../src/security/logical-digest.js'),import('../src/security/passenger-secrets.js'),import('../src/security/protected-auth.pg.js'),
 ]);
});
afterEach(() => { expect(attempts).toEqual([]); vi.useRealTimers(); });
afterAll(() => { for(const undo of restore.reverse())undo();syncBuiltinESMExports(); });
const binding = (): AccountBinding => ({userId:'synthetic-user',generation:3,recipient:'synthetic@example.invalid'});
const expiry = () => new Date(Date.now()+60000);
function keys() {
 const boundary={authorize:vi.fn(async()=>true),acquireDataKey:vi.fn(async()=>Buffer.alloc(32,9))};
 return {boundary:vi.fn((keyRef:string)=>{if(keyRef!=='synthetic-key')throw new Error('SYNTHETIC-SECRET');return boundary;}),policy:boundary};
}
function memory() {
 let account:AccountBinding|null=binding(),credentials:Credential[]=[],jobs:ProtectedJob[]=[],sessions=0,state='PENDING';
 const history:string[]=[], fail={at:''};
 const step=(name:string)=>{history.push(name);if(fail.at===name)throw new Error('SYNTHETIC-SECRET');};
 const store:ProtectedAuthStore={
  async transaction(work){const saved={account,credentials:credentials.slice(),jobs:jobs.slice(),sessions};try{
   const tx:AuthTransaction={
    async createAccount(input){step('account-create');if(account)throw new Error();account={userId:input.id,recipient:input.email,generation:0};},
    async createSession(){step('session-create');sessions++;},
    async account(){step('account');return account;},
    async supersede(userId,purpose){step('supersede');credentials=credentials.map(c=>c.userId===userId&&c.purpose===purpose?{...c,revokedAt:new Date()}:c);},
    async insertCredential(c){step('credential');credentials.push(c);},
    async insertJob(j){step('job');jobs.push(j);},
    async revoke(){step('revoke');if(account)account={...account,generation:account.generation+1};credentials=credentials.map(c=>({...c,revokedAt:new Date()}));},
   };
   const result=await work(tx);step('commit');return result;
  }catch(error){({account,credentials,jobs,sessions}=saved);throw error;}},
  async claim(jobId,workerId){step('claim');if(state!=='PENDING')return null;state='LEASED';return {jobId,version:1,workerId};},
  async admit(){step('admit');const credential=credentials[credentials.length-1],job=jobs[jobs.length-1];
   return credential&&job&&account?.generation===credential.generation&&!credential.revokedAt&&!credential.consumedAt&&credential.expiresAt>new Date()?{credential,job}:null;},
  async beginSend(){step('begin');if(fail.at==='begin-deny')return false;state='SENDING';return true;},
  async finish(_lease,outcome){step('finish');state=outcome;return true;},
 };
 return {store,history,fail,get credentials(){return credentials;},get jobs(){return jobs;},get sessions(){return sessions;},get state(){return state;},
  account:(value:AccountBinding|null)=>{account=value;}};
}
async function issued(){const db=memory(),key=keys();const ids=await auth.issueProtectedCredential(db.store,key,'synthetic-key',binding(),'reset',expiry());return {db,key,ids};}

describe('atomic protected issuance / lifecycle',()=>{
 it('persists only digest and encrypted recipient/token with reciprocal IDs',async()=>{
  const {db,key,ids}=await issued();expect(db.history).toEqual(['account','supersede','credential','job','commit']);
  expect(JSON.stringify(db.jobs)).not.toContain(binding().recipient);expect(db.credentials[0].digest).toMatch(/^[a-f0-9]{64}$/);
  const c=db.credentials[0],bytes=await codec.openEnvelope(db.jobs[0].envelope,'auth-notification',codec.protectedContext('auth-delivery','auth-notification',c.userId,c.generation,c.purpose,c.id,c.jobId),key);
  const payload=JSON.parse(Buffer.from(bytes).toString());expect(createHash('sha256').update(payload.token).digest('hex')).toBe(c.digest);
  expect(payload.recipient).toBe(binding().recipient);expect(ids.jobId).toBe(db.jobs[0].id);bytes.fill(0);
 });
 for(const stage of ['account','supersede','credential','job','commit'])it(`rolls back entire issuance on ${stage} failure`,async()=>{
  const db=memory();db.fail.at=stage;await expect(auth.issueProtectedCredential(db.store,keys(),'synthetic-key',binding(),'reset',expiry())).rejects.toThrow('PROTECTED_AUTH_FAILED');
  expect(db.credentials).toEqual([]);expect(db.jobs).toEqual([]);
 });
 for(const field of ['recipient','generation'] as const)it(`rechecks ${field} after encryption`,async()=>{
  const db=memory(),key=keys();key.policy.authorize.mockImplementation(async()=>{db.account({...binding(),[field]:field==='recipient'?'changed@example.invalid':4});return true;});
  await expect(auth.issueProtectedCredential(db.store,key,'synthetic-key',binding(),'reset',expiry())).rejects.toThrow('PROTECTED_AUTH_FAILED');expect(db.jobs).toEqual([]);
 });
 it('never writes when key authorization denies',async()=>{const db=memory(),k=keys();k.policy.authorize.mockResolvedValue(false);
  await expect(auth.issueProtectedCredential(db.store,k,'synthetic-key',binding(),'reset',expiry())).rejects.toThrow('PROTECTED_AUTH_FAILED');expect(db.history).toEqual([]);expect(k.policy.acquireDataKey).not.toHaveBeenCalled();});
 it('serial issuance durably revokes the prior credential',async()=>{const {db,key}=await issued();await auth.issueProtectedCredential(db.store,key,'synthetic-key',binding(),'reset',expiry());expect(db.credentials[0].revokedAt).toBeInstanceOf(Date);expect(db.credentials[1].revokedAt).toBeNull();});
 it('revocation increments generation and blocks pending delivery',async()=>{const {db,key,ids}=await issued();await auth.revokeProtectedCredentials(db.store,binding().userId);
  const send=vi.fn();expect(await auth.deliverProtectedCredential(db.store,key,{authorize:async()=>true,send},ids.jobId,'worker')).toBe('denied');expect(send).not.toHaveBeenCalled();});
 for(const stage of ['account-create','credential','job','session-create','commit'])it(`registration has no account/session orphan on ${stage}`,async()=>{
  const db=memory();db.account(null);db.fail.at=stage;
  await expect(auth.registerProtectedAccount(db.store,keys(),'synthetic-key',{userId:'new-user',recipient:binding().recipient,passwordHash:'$2b$12$'+'a'.repeat(53),name:null,verificationExpiresAt:expiry(),sessionExpiresAt:expiry()})).rejects.toThrow('PROTECTED_AUTH_FAILED');
  expect(db.credentials).toEqual([]);expect(db.jobs).toEqual([]);expect(db.sessions).toBe(0);
 });
 it('registration returns a session only after atomic commit',async()=>{const db=memory();db.account(null);
  const result=await auth.registerProtectedAccount(db.store,keys(),'synthetic-key',{userId:'new-user',recipient:binding().recipient,passwordHash:'$2b$12$'+'a'.repeat(53),name:null,verificationExpiresAt:expiry(),sessionExpiresAt:expiry()});
  expect(db.history.at(-1)).toBe('commit');expect(db.sessions).toBe(1);expect(result.refreshToken).toHaveLength(64);expect(db.credentials[0].purpose).toBe('verification');});
 it('rejects expired issuance without touching storage',async()=>{const db=memory();await expect(auth.issueProtectedCredential(db.store,keys(),'synthetic-key',binding(),'reset',new Date(0))).rejects.toThrow('PROTECTED_AUTH_FAILED');expect(db.history).toEqual([]);});
});

describe('protected worker admission / truthful terminal states',()=>{
 it('denies untrusted workers before key/storage access',async()=>{const {db,key,ids}=await issued();db.history.length=0;key.boundary.mockClear();const send=vi.fn();
  expect(await auth.deliverProtectedCredential(db.store,key,{authorize:async()=>false,send},ids.jobId,'worker')).toBe('denied');expect(db.history).toEqual([]);expect(key.boundary).not.toHaveBeenCalled();expect(send).not.toHaveBeenCalled();});
 for(const state of ['consumed','revoked','expired','purpose-mismatch','job-mismatch','recipient-mismatch','digest-mismatch'] as const)it(`denies ${state} without sending`,async()=>{
  const {db,key,ids}=await issued(),c=db.credentials[0];
  if(state==='consumed')c.consumedAt=new Date();if(state==='revoked')c.revokedAt=new Date();if(state==='expired')c.expiresAt=new Date(0);
  if(state==='purpose-mismatch')c.purpose='verification';if(state==='job-mismatch')c.jobId='wrong';if(state==='recipient-mismatch')c.recipient='wrong@example.invalid';if(state==='digest-mismatch')c.digest='a'.repeat(64);
  const send=vi.fn();expect(await auth.deliverProtectedCredential(db.store,key,{authorize:async()=>true,send},ids.jobId,'worker')).toBe('denied');expect(send).not.toHaveBeenCalled();
 });
 it('checks purpose-specific admission before decrypt',async()=>{const {db,key,ids}=await issued();key.boundary.mockClear();
  expect(await auth.deliverProtectedCredential(db.store,key,{authorize:async(_w,p)=>p==='verification',send:vi.fn()},ids.jobId,'worker')).toBe('denied');expect(key.boundary).not.toHaveBeenCalled();});
 for(const outcome of ['submitted','suppressed'] as const)it(`records actual ${outcome} once`,async()=>{const {db,key,ids}=await issued();const send=vi.fn(async()=>outcome);
  expect(await auth.deliverProtectedCredential(db.store,key,{authorize:async()=>true,send},ids.jobId,'worker')).toBe(outcome);expect(db.state).toBe(outcome);
  expect(await auth.deliverProtectedCredential(db.store,key,{authorize:async()=>true,send},ids.jobId,'worker')).toBe('denied');expect(send).toHaveBeenCalledTimes(1);
 });
 it('transport exception becomes ambiguous with no automatic resend',async()=>{const {db,key,ids}=await issued();const send=vi.fn(async()=>{throw new Error('SYNTHETIC-SECRET');});
  expect(await auth.deliverProtectedCredential(db.store,key,{authorize:async()=>true,send},ids.jobId,'worker')).toBe('ambiguous');expect(db.state).toBe('ambiguous');expect(send).toHaveBeenCalledTimes(1);});
 it('lost acknowledgment leaves SENDING, never a retryable failed job',async()=>{const {db,key,ids}=await issued();db.fail.at='finish';const send=vi.fn(async()=>'submitted' as const);
  expect(await auth.deliverProtectedCredential(db.store,key,{authorize:async()=>true,send},ids.jobId,'worker')).toBe('ambiguous');expect(db.state).toBe('SENDING');expect(send).toHaveBeenCalledTimes(1);});
 it('lease/generation loss after decrypt prevents send intent',async()=>{const {db,key,ids}=await issued();db.fail.at='begin-deny';const send=vi.fn();expect(await auth.deliverProtectedCredential(db.store,key,{authorize:async()=>true,send},ids.jobId,'worker')).toBe('denied');expect(send).not.toHaveBeenCalled();});
});

describe('strict versioned reader, AAD isolation, retained legacy disposition',()=>{
 for(const template of ['EMAIL_VERIFICATION','PASSWORD_RESET','UNKNOWN',undefined])it(`quarantines legacy ${template}`,()=>{expect(codec.legacyDisposition({template,params:{token:'SYNTHETIC'}})).toBe('quarantine');});
 for(const template of ['INQUIRY_CONFIRMATION','BOOKING_CONFIRMATION','BOOKING_STATUS','CONTACT_CONFIRMATION'])it(`preserves ordinary ${template}`,()=>{expect(codec.legacyDisposition({template})).toBe('ordinary');});
 it('does not execute accessors/proxy traps while classifying',()=>{let calls=0;expect(codec.legacyDisposition({get template(){calls++;throw new Error();}})).toBe('quarantine');expect(codec.legacyDisposition(new Proxy({},{ownKeys(){calls++;throw new Error();}}))).toBe('quarantine');expect(calls).toBe(0);});
 it('binds key reference and immutable record context',async()=>{const k=keys(),aad=Buffer.from('record-one');const e=await codec.sealEnvelope(Buffer.from('SYNTHETIC'),'auth-notification',aad,'synthetic-key',k);
  await expect(codec.openEnvelope(e,'auth-notification',Buffer.from('record-two'),k)).rejects.toThrow('PROTECTED_OPEN_FAILED');
  await expect(codec.openEnvelope({...e,keyRef:'unknown'},'auth-notification',aad,k)).rejects.toThrow('PROTECTED_OPEN_FAILED');});
 for(const mutation of ['version','extra','encoding','size'])it(`rejects ${mutation} without key acquisition`,async()=>{const k=keys();const e=await codec.sealEnvelope(Buffer.from('SYNTHETIC'),'auth-notification',Buffer.from('a'),'synthetic-key',k);k.boundary.mockClear();
  const bad=mutation==='version'?{...e,version:2}:mutation==='extra'?{...e,token:'SYNTHETIC'}:mutation==='encoding'?{...e,nonce:e.nonce+'='}:{...e,ciphertext:'a'.repeat(6000)};
  await expect(codec.openEnvelope(bad,'auth-notification',Buffer.from('a'),k)).rejects.toThrow('PROTECTED_OPEN_FAILED');expect(k.boundary).not.toHaveBeenCalled();});
});

describe('canonical keyed logical digest',()=>{
 const key=Buffer.alloc(32,7);
 it('sorts object keys recursively without reordering arrays',()=>{expect(digests.logicalDigest(key,'k1','booking:create','user:1',{b:2,a:{d:4,c:3}})).toBe(digests.logicalDigest(key,'k1','booking:create','user:1',{a:{c:3,d:4},b:2}));expect(digests.logicalDigest(key,'k1','booking:create','user:1',[1,2])).not.toBe(digests.logicalDigest(key,'k1','booking:create','user:1',[2,1]));});
 it('binds operation, principal, key and version',()=>{const base=digests.logicalDigest(key,'k1','booking:create','user:1',{a:1});for(const changed of [digests.logicalDigest(key,'k1','booking:update','user:1',{a:1}),digests.logicalDigest(key,'k1','booking:create','user:2',{a:1}),digests.logicalDigest(Buffer.alloc(32,8),'k1','booking:create','user:1',{a:1}),digests.logicalDigest(key,'k2','booking:create','user:1',{a:1})])expect(digests.sameLogicalDigest(base,changed)).toBe(false);expect(digests.sameLogicalDigest(base,base)).toBe(true);expect(digests.sameLogicalDigest(base,'legacy')).toBe(false);});
 for(const bad of [undefined,NaN,Infinity,new Date(),{a:undefined},[,1],()=>{},new Map()])it(`rejects non-canonical value ${typeof bad}`,()=>{expect(()=>digests.logicalDigest(key,'k1','booking:create','user:1',bad)).toThrow('DIGEST_INPUT_INVALID');});
 it('rejects cycles, accessors and proxies without invoking them',()=>{const cycle:Record<string,unknown>={};cycle.self=cycle;let calls=0;for(const v of [cycle,{get value(){calls++;return 'SYNTHETIC';}},new Proxy({},{ownKeys(){calls++;return [];}})])expect(()=>digests.logicalDigest(key,'k1','booking:create','user:1',v)).toThrow();expect(calls).toBe(0);});
});

describe('passenger protected persistence interfaces',()=>{
 const fields={passportNumber:'SYNTHETIC-NOT-REAL',passportExpiry:'2030-01-01',dateOfBirth:'2000-01-01',nationality:'SYNTHETIC'};
 function storage(){let value:PassengerSecretRecord|null=null;return {load:vi.fn(async()=>value),compareAndSet:vi.fn(async(r:PassengerSecretRecord,expected:number)=>{if((value?.revision??0)!==expected)return false;value=r;return true;}),get value(){return value;}};}
 it('stores ciphertext only and returns plaintext only after explicit authorization',async()=>{const s=storage(),k=keys(),access={authorize:vi.fn(async()=>true)};
  expect(await passenger.writePassengerSecret(s,access,k,'synthetic-key','booking','passenger',0,fields)).toBe(1);
  expect(JSON.stringify(s.value)).not.toContain(fields.passportNumber);expect(await passenger.readPassengerSecret(s,access,k,'booking','passenger')).toEqual(fields);
 });
 it('denies guests before load or key access',async()=>{const s=storage(),k=keys();await expect(passenger.readPassengerSecret(s,{authorize:async()=>false},k,'booking','passenger')).rejects.toThrow('PASSENGER_SECRET_FAILED');expect(s.load).not.toHaveBeenCalled();expect(k.boundary).not.toHaveBeenCalled();});
 it('CAS rejects stale revision without overwriting encrypted data',async()=>{const s=storage(),k=keys(),access={authorize:async()=>true};await passenger.writePassengerSecret(s,access,k,'synthetic-key','booking','passenger',0,fields);const before=s.value;await expect(passenger.writePassengerSecret(s,access,k,'synthetic-key','booking','passenger',0,{...fields,nationality:'other'})).rejects.toThrow('PASSENGER_SECRET_FAILED');expect(s.value).toBe(before);});
 it('denies wrong booking/passenger even if storage returns a record',async()=>{const s=storage(),k=keys(),access={authorize:async()=>true};await passenger.writePassengerSecret(s,access,k,'synthetic-key','booking','passenger',0,fields);await expect(passenger.readPassengerSecret(s,access,k,'other','passenger')).rejects.toThrow('PASSENGER_SECRET_FAILED');});
 it('denies altered revision by authenticated context',async()=>{const s=storage(),k=keys(),access={authorize:async()=>true};await passenger.writePassengerSecret(s,access,k,'synthetic-key','booking','passenger',0,fields);s.value!.revision=2;await expect(passenger.readPassengerSecret(s,access,k,'booking','passenger')).rejects.toThrow('PASSENGER_SECRET_FAILED');});
});

describe('concrete PostgreSQL adapter protocol — fake connection only',()=>{
 function fake(){const calls:Array<{sql:string;params:unknown[]}>=[];let fail='';const client={release:vi.fn(),on:vi.fn(),removeListener:vi.fn(),query:vi.fn(async(sql:string,params:unknown[]=[])=>{calls.push({sql,params});if(fail&&sql.startsWith(fail))throw new Error('SYNTHETIC-SECRET');return {rows:[],rowCount:0};})};return {calls,client,fail:(value:string)=>{fail=value;},pool:{connect:async()=>client}};}
 it('constructor is inert and every unit uses bounded transaction settings',async()=>{const f=fake(),s=new pgStore.PostgresProtectedAuthStore(f.pool as never);expect(f.calls).toEqual([]);await s.claim('job','worker');expect(f.calls.slice(0,3).map(c=>c.sql)).toEqual(['BEGIN',"SET LOCAL statement_timeout='5s'","SET LOCAL lock_timeout='5s'"]);expect(f.calls.at(-1)?.sql).toBe('COMMIT');expect(f.client.release).toHaveBeenCalledWith(false);});
 it('failed COMMIT is sanitized and never retries',async()=>{const f=fake();f.fail('COMMIT');const s=new pgStore.PostgresProtectedAuthStore(f.pool as never);await expect(s.claim('job','worker')).rejects.toThrow('PROTECTED_STORAGE_FAILED');expect(f.calls.filter(c=>c.sql==='BEGIN')).toHaveLength(1);expect(f.calls.at(-1)?.sql).toBe('ROLLBACK');});
 it('rollback failure discards the owned connection',async()=>{const f=fake();f.client.query.mockImplementation(async(sql:string,params:unknown[]=[])=>{f.calls.push({sql,params});throw new Error('SYNTHETIC');});const s=new pgStore.PostgresProtectedAuthStore(f.pool as never);await expect(s.claim('job','worker')).rejects.toThrow('PROTECTED_STORAGE_FAILED');expect(f.client.release).toHaveBeenCalledWith(true);});
 it('query parameters never interpolate identifiers or secrets into SQL',async()=>{const f=fake(),s=new pgStore.PostgresProtectedAuthStore(f.pool as never);await s.claim("synthetic';DROP",'worker');const q=f.calls.find(c=>c.sql.startsWith('UPDATE'));expect(q?.sql).not.toContain('synthetic');expect(q?.params).toEqual(["synthetic';DROP",'worker']);expect(q?.sql).not.toContain("state='SENDING' OR");});
 it('consume rejects malformed input without connection',async()=>{const f=fake(),s=new pgStore.PostgresProtectedAuthStore(f.pool as never);expect(await s.consume('id','bad','reset')).toBe(false);expect(f.calls).toEqual([]);});
 it('consume locks first and checks wall-clock expiry in a later statement',async()=>{const f=fake(),s=new pgStore.PostgresProtectedAuthStore(f.pool as never);expect(await s.consume('id','a'.repeat(64),'verification')).toBe(false);const lock=f.calls.findIndex(c=>c.sql==='SELECT id FROM public."ProtectedCredential" WHERE id=$1 FOR UPDATE'),update=f.calls.findIndex(c=>c.sql.includes('SET "consumedAt"'));expect(lock).toBeGreaterThan(0);expect(update).toBeGreaterThan(lock);expect(f.calls[update].sql).toContain('"expiresAt">clock_timestamp()');expect(f.calls[update].sql).toContain('s.generation=c.generation');});
});





