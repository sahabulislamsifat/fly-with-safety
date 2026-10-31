import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import type { AuthTransaction, Credential, ProtectedJob, ProtectedAuthStore, AccountBinding } from '../src/security/protected-auth.js';
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
let outbox:typeof import('../src/services/outbox.service.js');
let notifications:typeof import('../src/services/notification.service.js');
let digests:typeof import('../src/security/idempotency-digest.js');
let idempotency:typeof import('../src/services/idempotency.service.js');
let Prisma:typeof import('../src/generated/prisma/client.js')['Prisma'];
beforeAll(async()=>{
 installGuards();
 [auth,outbox,notifications,digests,idempotency]=await Promise.all([
  import('../src/services/protected-auth.service.js'),import('../src/services/outbox.service.js'),import('../src/services/notification.service.js'),
  import('../src/security/idempotency-digest.js'),import('../src/services/idempotency.service.js'),
 ]);
 Prisma=(await import('../src/generated/prisma/client.js')).Prisma;
});
beforeEach(()=>{mocks.enabled=true;mocks.mail.mockReset().mockResolvedValue({accepted:['synthetic@example.invalid']});mocks.transaction.mockReset();mocks.find.mockReset();});
afterEach(()=>{expect(attempts).toEqual([]);});
afterAll(()=>{for(const undo of restore.reverse())undo();syncBuiltinESMExports();});
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

describe('protected auth application service composition — no route activation',()=>{
 it('validates, normalizes, hashes and atomically registers before returning an AuthSession',async()=>{
  const s=setup(false),result=await s.compose().register({email:'Synthetic@Example.Invalid',password:'SyntheticPassword42',name:'Synthetic'});
  expect(result.user).toMatchObject({email:'synthetic@example.invalid',role:'CUSTOMER',emailVerified:false});expect(result.accessToken).toBe('SYNTHETIC-ACCESS-TOKEN');expect(result.refreshToken).toHaveLength(64);
  expect(s.sessions).toBe(1);expect(s.credentials).toHaveLength(1);expect(s.jobs).toHaveLength(1);expect(s.events.indexOf('sign')).toBeLessThan(s.events.indexOf('create-account'));expect(s.events.at(-1)).toBe('commit');
  expect(JSON.stringify(s.jobs)).not.toContain('SyntheticPassword42');expect(JSON.stringify(s.jobs)).not.toContain('synthetic@example.invalid');expect(s.credentials[0].purpose).toBe('verification');
 });
 it('invalid registration never looks up storage or keys',async()=>{const s=setup(false);await expect(s.compose().register({email:'bad',password:'bad'})).rejects.toMatchObject({statusCode:400});expect(s.events).toEqual([]);expect(s.keys.boundary).not.toHaveBeenCalled();});
 it('existing normalized account preserves registration conflict',async()=>{const s=setup();await expect(s.compose().register({email:'Synthetic@Example.Invalid',password:'SyntheticPassword42'})).rejects.toMatchObject({statusCode:409});expect(s.jobs).toEqual([]);});
 it('signing failure occurs before writes; no orphan account/session/job',async()=>{const s=setup(false);s.fail.stage='sign';await expect(s.compose().register({email:'synthetic@example.invalid',password:'SyntheticPassword42'})).rejects.toMatchObject({statusCode:500});expect(s.credentials).toEqual([]);expect(s.jobs).toEqual([]);expect(s.sessions).toBe(0);expect(s.events).not.toContain('create-account');});
 it('job-write failure rolls back registration and never returns a session',async()=>{const s=setup(false);s.fail.stage='job';await expect(s.compose().register({email:'synthetic@example.invalid',password:'SyntheticPassword42'})).rejects.toMatchObject({statusCode:500});expect(s.credentials).toEqual([]);expect(s.jobs).toEqual([]);expect(s.sessions).toBe(0);});
 it('unknown reset/resend recipients are silent no-ops',async()=>{const s=setup(false);await s.compose().requestPasswordReset('UNKNOWN@example.invalid');await s.compose().resendVerification('UNKNOWN@example.invalid');expect(s.jobs).toEqual([]);expect(s.keys.boundary).not.toHaveBeenCalled();});
 it('already verified accounts receive no verification credential',async()=>{const s=setup();s.verified();await s.compose().resendVerification('synthetic@example.invalid');expect(s.jobs).toEqual([]);});
 it('resend and reset use distinct purposes and original 24h/1h lifetimes',async()=>{const s=setup(),start=Date.now();await s.compose().resendVerification('Synthetic@Example.Invalid');await s.compose().requestPasswordReset('synthetic@example.invalid');expect(s.credentials.map(c=>c.purpose)).toEqual(['verification','reset']);expect(s.credentials[0].expiresAt.getTime()-start).toBeGreaterThan(86399000);expect(s.credentials[1].expiresAt.getTime()-start).toBeLessThan(3601000);});
 it('verification forwards digest and purpose to actual protected consume boundary',async()=>{const s=setup(),token='s'.repeat(64);await s.compose().verifyEmail(token);expect(s.store.lookupCredential).toHaveBeenCalledWith(createHash('sha256').update(token).digest('hex'),'verification');expect(s.store.consume).toHaveBeenCalledWith('credential',expect.stringMatching(/^[a-f0-9]{64}$/),'verification',undefined);});
 it('failed conditional consume rejects safely',async()=>{const s=setup();s.store.consume.mockResolvedValue(false);await expect(s.compose().verifyEmail('s'.repeat(64))).rejects.toMatchObject({statusCode:400});});
 it('reset validates and hashes at cost12 before conditional consume',async()=>{const s=setup();await s.compose().resetPassword({token:'s'.repeat(64),password:'SyntheticPassword42'});expect(s.store.consume).toHaveBeenCalledWith('credential',expect.any(String),'reset',expect.stringMatching(/^\$2[aby]\$12\$/));});
 it('durable revocation uses shared transactional store',async()=>{const s=setup();await s.compose().requestPasswordReset('synthetic@example.invalid');await s.compose().revokeUserSessions('synthetic-user');expect(s.credentials[0].revokedAt).toBeInstanceOf(Date);expect(s.events).toContain('revoke');});
 it('storage/key failure does not fall back to plaintext or mail',async()=>{const s=setup();s.keys.boundary.mockImplementation(()=>{throw new Error('SYNTHETIC-PRIVATE');});await expect(s.compose().requestPasswordReset('synthetic@example.invalid')).rejects.toMatchObject({statusCode:500});expect(s.jobs).toEqual([]);expect(mocks.mail).not.toHaveBeenCalled();});
});

describe('fenced outbox → real notification renderer → fake SMTP',()=>{
 async function run(s:ReturnType<typeof setup>,authorize=async()=>true){return outbox.processProtectedNotificationJob({store:s.store,keys:s.keys,frontendOrigin:'https://synthetic.example.invalid',authorize,recovery:{admit:async()=>true},jobId:s.jobs[0].id,workerId:'synthetic-worker'});}
 it('decrypts only after admission, builds fixed-origin link and sends once',async()=>{const s=setup();await s.compose().requestPasswordReset('synthetic@example.invalid');expect(await run(s)).toBe('submitted');expect(s.state).toBe('submitted');expect(mocks.mail).toHaveBeenCalledTimes(1);const mail=mocks.mail.mock.calls[0][0];expect(mail.to).toBe('synthetic@example.invalid');expect(mail.html).toContain('https://synthetic.example.invalid/reset-password?token=');expect(s.events.indexOf('intent')).toBeLessThan(s.events.indexOf('finish'));expect(await run(s)).toBe('denied');expect(mocks.mail).toHaveBeenCalledTimes(1);});
 it('worker denial reaches neither decrypt nor transport',async()=>{const s=setup();await s.compose().requestPasswordReset('synthetic@example.invalid');s.keys.boundary.mockClear();expect(await run(s,async()=>false)).toBe('denied');expect(s.keys.boundary).not.toHaveBeenCalled();expect(mocks.mail).not.toHaveBeenCalled();});
 it('lease loss after decrypt prevents renderer/transport dispatch',async()=>{const s=setup();await s.compose().requestPasswordReset('synthetic@example.invalid');s.fail.stage='lease-lost';expect(await run(s)).toBe('denied');expect(mocks.mail).not.toHaveBeenCalled();});
 it('transport rejection remains ambiguous, with no ordinary-outbox fallback',async()=>{const s=setup();await s.compose().requestPasswordReset('synthetic@example.invalid');mocks.mail.mockRejectedValue(new Error('SYNTHETIC-PRIVATE'));expect(await run(s)).toBe('ambiguous');expect(s.state).toBe('ambiguous');expect(mocks.mail).toHaveBeenCalledTimes(1);});
 it('lost acknowledgment preserves SENDING and cannot resend',async()=>{const s=setup();await s.compose().requestPasswordReset('synthetic@example.invalid');s.fail.stage='finish';expect(await run(s)).toBe('ambiguous');expect(s.state).toBe('SENDING');expect(await run(s)).toBe('denied');expect(mocks.mail).toHaveBeenCalledTimes(1);});
 it('disabled mail is suppressed rather than delivered',async()=>{const s=setup();await s.compose().requestPasswordReset('synthetic@example.invalid');mocks.enabled=false;expect(await run(s)).toBe('suppressed');expect(mocks.mail).not.toHaveBeenCalled();});
 for(const origin of ['http://external.example.invalid','https://u:p@example.invalid','https://example.invalid/extra','not-a-url'])it('rejects unreviewed origin configuration '+origin.split(':')[0],()=>{expect(()=>notifications.createProtectedNotificationDelivery({frontendOrigin:origin,authorize:async()=>true})).toThrow('PROTECTED_NOTIFICATION_CONFIGURATION_INVALID');expect(mocks.mail).not.toHaveBeenCalled();});
 it('rejects malformed token and recipient before transport without raw errors',async()=>{const delivery=notifications.createProtectedNotificationDelivery({frontendOrigin:'https://synthetic.example.invalid',authorize:async()=>true});await expect(delivery.send({purpose:'reset',recipient:'bad\r\nrecipient',token:'bad'})).rejects.toThrow('PROTECTED_NOTIFICATION_TRANSPORT_FAILED');expect(mocks.mail).not.toHaveBeenCalled();});
});

describe('keyed digest in actual inquiry idempotency service',()=>{
 const scope={operation:'booking:create',principal:'user:synthetic-user'},payload={z:2,a:{c:3,b:1}};
 function policy(version='k1'){const issued:Uint8Array[]=[];return {currentVersion:version,issued,acquireKey:vi.fn((v:string)=>{if(!['k1','k2'].includes(v))throw new Error('SYNTHETIC-PRIVATE');const k=Buffer.alloc(32,v==='k1'?4:5);issued.push(k);return k;})};}
 function request(digestPolicy?:ReturnType<typeof policy>){return {operation:scope.operation,userId:'synthetic-user',email:'synthetic@example.invalid',key:'synthetic-request',payload,digestPolicy,create:vi.fn(async()=>({referenceNumber:'SYNTHETIC-REF'})),findByReference:vi.fn(async()=>({referenceNumber:'SYNTHETIC-REF'}))};}
 function transactions(){let record:{payloadHash:string;referenceNumber:string}|null=null;const create=vi.fn(async({data})=>{if(record)throw new Prisma.PrismaClientKnownRequestError('synthetic',{code:'P2002',clientVersion:'test'});record=data;return data;});mocks.transaction.mockImplementation(async work=>work({idempotencyRecord:{create}}));mocks.find.mockImplementation(async()=>record);return {get record(){return record;}};}
 it('existing callers keep exact historical SHA-256 and replay once',async()=>{const db=transactions(),input=request();expect((await idempotency.createIdempotentInquiry(input)).replayed).toBe(false);const historical=createHash('sha256').update('{"a":{"b":1,"c":3},"z":2}').digest('hex');expect(db.record?.payloadHash).toBe(historical);expect((await idempotency.createIdempotentInquiry(input)).replayed).toBe(true);});
 it('new explicit policy writes keyed logical digest and replays same logical payload',async()=>{const db=transactions(),p=policy(),input=request(p);await idempotency.createIdempotentInquiry(input);expect(db.record?.payloadHash).toMatch(/^h1:k1:[a-f0-9]{64}$/);expect((await idempotency.createIdempotentInquiry({...input,payload:{a:{b:1,c:3},z:2}})).replayed).toBe(true);expect(p.issued.every(k=>k.every(b=>b===0))).toBe(true);});
 it('rotation reads original retained key version',async()=>{transactions();const input=request(policy());await idempotency.createIdempotentInquiry(input);const next=policy('k2');expect((await idempotency.createIdempotentInquiry({...input,digestPolicy:next})).replayed).toBe(true);expect(next.acquireKey).toHaveBeenCalledWith('k1');});
 it('upgraded writer still replays historical unkeyed records',async()=>{transactions();await idempotency.createIdempotentInquiry(request());expect((await idempotency.createIdempotentInquiry(request(policy()))).replayed).toBe(true);});
 it('changed logical payload is a conflict',async()=>{transactions();const input=request(policy());await idempotency.createIdempotentInquiry(input);await expect(idempotency.createIdempotentInquiry({...input,payload:{z:3}})).rejects.toMatchObject({statusCode:409});});
 it('old reader fails closed on a keyed record instead of downgrading',async()=>{transactions();await idempotency.createIdempotentInquiry(request(policy()));await expect(idempotency.createIdempotentInquiry(request())).rejects.toMatchObject({statusCode:500});});
 it('missing current key fails before transaction',async()=>{const p=policy();p.acquireKey.mockImplementation(()=>{throw new Error('SYNTHETIC-PRIVATE');});await expect(idempotency.createIdempotentInquiry(request(p))).rejects.toMatchObject({statusCode:500});expect(mocks.transaction).not.toHaveBeenCalled();});
 it('missing retained key cannot silently use current version',async()=>{transactions();await idempotency.createIdempotentInquiry(request(policy()));const p=policy('k2');p.acquireKey.mockImplementation(v=>{if(v==='k1')throw new Error('SYNTHETIC-PRIVATE');return Buffer.alloc(32,5);});await expect(idempotency.createIdempotentInquiry(request(p))).rejects.toMatchObject({statusCode:500});});
 it('key cleanup occurs after invalid canonical payload',()=>{const p=policy();expect(()=>digests.inquiryDigest({value:undefined},scope,p)).toThrow('IDEMPOTENCY_DIGEST_UNAVAILABLE');expect(p.issued[0].every(b=>b===0)).toBe(true);});
 it('legacy comparison refuses malformed stored formats',()=>{expect(()=>digests.matchesInquiryDigest('h1:bad:short',payload,scope,policy())).toThrow('IDEMPOTENCY_DIGEST_UNAVAILABLE');});
});

