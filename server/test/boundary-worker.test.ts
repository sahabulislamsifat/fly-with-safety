import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Request,Response } from 'express';
import type { Pool } from 'pg';
import type { ProtectedAuthServices } from '../src/services/protected-auth.service.js';
import type { AuthSession } from '../src/services/auth.service.js';
import type { CompatibleOutboxStore,NotificationSnapshot } from '../src/services/compatible-outbox.service.js';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';


const mocks=vi.hoisted(()=>({boundary:false,transaction:vi.fn(),find:vi.fn(),mail:vi.fn(),enabled:true,nodeEnv:'production',legacyRegister:vi.fn(),post:vi.fn()}));
vi.mock('../src/lib/prisma.js',()=>{if(!mocks.boundary)throw new Error('IMPORT_BEFORE_GUARDS');return {prisma:{$transaction:mocks.transaction,idempotencyRecord:{findUnique:mocks.find}}};});
vi.mock('pg',()=>{throw new Error('PG_FORBIDDEN')});
vi.mock('@prisma/adapter-pg',()=>{throw new Error('ADAPTER_FORBIDDEN')});
vi.mock('dotenv',()=>{throw new Error('DOTENV_FORBIDDEN')});
vi.mock('nodemailer',()=>({default:{createTransport:()=>({sendMail:mocks.mail})}}));
vi.mock('../src/config/env.js',()=>({env:{get nodeEnv(){return mocks.nodeEnv;},refreshTokenExpiresDays:30,accessTokenCookieMaxAgeMs:900000,jwtSecret:'SYNTHETIC-ONLY',get emailDeliveryEnabled(){return mocks.enabled;},smtpHost:'smtp.example.invalid',smtpPort:587,smtpUser:'synthetic@example.invalid',smtpPassword:'SYNTHETIC',smtpEmailFrom:'synthetic@example.invalid',smtpEmailFromName:'Synthetic'}}));
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


vi.mock('../src/services/auth.service.js',()=>({register:mocks.legacyRegister}));

let controllers:typeof import('../src/controllers/auth.controller.js');
let workerControllers:typeof import('../src/controllers/compatible-outbox.controller.js');
let workers:typeof import('../src/services/compatible-outbox.service.js');
let pg:typeof import('../src/security/compatible-outbox.pg.js');
let clientAuth:typeof import('../../client/src/lib/api/auth.js');
let clientAttempts:typeof import('../../client/src/lib/api/auth-attempt.js');
let clientApi:typeof import('../../client/src/lib/api/client.js');
let composition:typeof import('../src/services/protected-phase1.composition.js');
let digests:typeof import('../src/security/idempotency-digest.js');
beforeAll(async()=>{installGuards();[controllers,workerControllers,workers,pg,clientAuth,clientAttempts,clientApi]=await Promise.all([
 import('../src/controllers/auth.controller.js'),import('../src/controllers/compatible-outbox.controller.js'),import('../src/services/compatible-outbox.service.js'),import('../src/security/compatible-outbox.pg.js'),
 import('../../client/src/lib/api/auth.js'),import('../../client/src/lib/api/auth-attempt.js'),import('../../client/src/lib/api/client.js'),
]);composition=await import('../src/services/protected-phase1.composition.js');digests=await import('../src/security/idempotency-digest.js');});
beforeEach(()=>{mocks.mail.mockReset().mockResolvedValue({accepted:['synthetic@example.invalid']});mocks.post.mockReset();mocks.legacyRegister.mockReset();mocks.enabled=true;mocks.nodeEnv='production';
 vi.stubEnv('NEXT_PUBLIC_API_BASE_URL','https://synthetic.example.invalid/api/v1');
 // Execute the real client API adapter against an in-memory HTTP response, never native fetch.
 vi.stubGlobal('fetch',async(url:string,init:RequestInit)=>{
  expect(url.startsWith('https://synthetic.example.invalid/api/v1/')).toBe(true);
  const headers=new Headers(init.headers),id=headers.get('Idempotency-Key');
  const data=await mocks.post(url.slice('https://synthetic.example.invalid/api/v1'.length),JSON.parse(String(init.body)),id?{'Idempotency-Key':id}:{});
  return new Response(JSON.stringify({success:true,data}),{status:200});
 });
});
afterEach(()=>{expect(attempts).toEqual([]);vi.unstubAllGlobals();vi.unstubAllEnvs();});
afterAll(()=>{for(const undo of restore.reverse())undo();syncBuiltinESMExports();});
const session:AuthSession={user:{id:'synthetic-user',email:'synthetic@example.invalid',name:'Synthetic',role:'CUSTOMER',emailVerified:false},accessToken:'SYNTHETIC-ACCESS',refreshToken:'SYNTHETIC-REFRESH'};
// Minimal Express test doubles; never native HTTP sockets or a running app.
function request(headers:Record<string,string|string[]|undefined>={},body:unknown={},params={id:'synthetic-job'}){
 return {headers,body,params,method:'GET',get:(name:string)=>headers[name.toLowerCase()]} as unknown as Request;
}
function response(){const value={set:vi.fn(),status:vi.fn(),json:vi.fn(),cookie:vi.fn(),clearCookie:vi.fn()};for(const fn of [value.set,value.status,value.json,value.cookie,value.clearCookie])fn.mockReturnValue(value);return {res:value as unknown as Response,calls:value};}
function authService(){return {
 register:vi.fn<ProtectedAuthServices['register']>(),resendVerification:vi.fn<ProtectedAuthServices['resendVerification']>(),requestPasswordReset:vi.fn<ProtectedAuthServices['requestPasswordReset']>(),
 registerRequest:vi.fn<ProtectedAuthServices['registerRequest']>(async()=>({status:'created',session})),requestPasswordResetOnce:vi.fn<ProtectedAuthServices['requestPasswordResetOnce']>(async()=>{}),resendVerificationOnce:vi.fn<ProtectedAuthServices['resendVerificationOnce']>(async()=>{}),verifyEmail:vi.fn<ProtectedAuthServices['verifyEmail']>(async()=>{}),resetPassword:vi.fn<ProtectedAuthServices['resetPassword']>(async()=>{}),revokeUserSessions:vi.fn<ProtectedAuthServices['revokeUserSessions']>(async()=>{}),
};}

describe('controller request identity and replay/cookie boundaries',()=>{
 for(const value of [undefined,'invalid',randomUUID()+','+randomUUID(),[randomUUID(),randomUUID()],'00000000-0000-0000-0000-000000000000'])it('rejects absent/invalid/duplicate request identity before service',async()=>{const service=authService(),next=vi.fn(),r=response();await controllers.createProtectedAuthController(service).register(request({'idempotency-key':value}),r.res,next);expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:400}));expect(service.registerRequest).not.toHaveBeenCalled();expect(r.calls.cookie).not.toHaveBeenCalled();});
 it('forwards body and canonical UUID; sets the existing secure cookie contract',async()=>{const service=authService(),id=randomUUID(),body={email:'synthetic@example.invalid',password:'SYNTHETIC'},r=response(),next=vi.fn();await controllers.createProtectedAuthController(service).register(request({'idempotency-key':id.toUpperCase()},body),r.res,next);expect(service.registerRequest).toHaveBeenCalledWith(body,id);expect(r.calls.status).toHaveBeenCalledWith(201);expect(r.calls.cookie).toHaveBeenNthCalledWith(1,'auth_token',session.accessToken,expect.objectContaining({httpOnly:true,secure:true,sameSite:'none',path:'/'}));expect(r.calls.cookie).toHaveBeenNthCalledWith(2,'refresh_token',session.refreshToken,expect.objectContaining({httpOnly:true,path:'/api/v1/auth'}));expect(JSON.stringify(r.calls.json.mock.calls)).not.toContain(session.refreshToken);expect(next).not.toHaveBeenCalled();});
 it('registration replay cannot set/clear cookies or fabricate a signed-in user',async()=>{const service=authService(),r=response();service.registerRequest.mockResolvedValue({status:'replayed'});await controllers.createProtectedAuthController(service).register(request({'idempotency-key':randomUUID()}),r.res,vi.fn());expect(r.calls.status).toHaveBeenCalledWith(200);expect(r.calls.json).toHaveBeenCalledWith({success:true,data:{registration:'replayed',requiresSignIn:true}});expect(r.calls.cookie).not.toHaveBeenCalled();expect(r.calls.clearCookie).not.toHaveBeenCalled();});
 for(const handler of ['resendVerification','forgotPassword'] as const)it('issuance controller delegates stable identity '+handler,async()=>{const service=authService(),id=randomUUID(),r=response();await controllers.createProtectedAuthController(service)[handler](request({'idempotency-key':id},{email:'synthetic@example.invalid'}),r.res,vi.fn());const method=handler==='forgotPassword'?service.requestPasswordResetOnce:service.resendVerificationOnce;expect(method).toHaveBeenCalledWith('synthetic@example.invalid',id);expect(r.calls.cookie).not.toHaveBeenCalled();});
 it('consume handlers retain protected service and cookie clearing',async()=>{const service=authService(),r=response(),next=vi.fn(),body={token:'SYNTHETIC',password:'SYNTHETIC'};const c=controllers.createProtectedAuthController(service);await c.resetPassword(request({},body),r.res,next);expect(service.resetPassword).toHaveBeenCalledWith(body);expect(r.calls.clearCookie).toHaveBeenCalledTimes(2);await c.verifyEmail(request({},body),r.res,next);expect(service.verifyEmail).toHaveBeenCalledWith('SYNTHETIC');});
 it('failed issuance never returns credentials or changes cookies',async()=>{const service=authService(),r=response(),next=vi.fn(),failure=new Error('SYNTHETIC-PRIVATE');service.registerRequest.mockRejectedValue(failure);await controllers.createProtectedAuthController(service).register(request({'idempotency-key':randomUUID()}),r.res,next);expect(next).toHaveBeenCalledWith(failure);expect(r.calls.cookie).not.toHaveBeenCalled();expect(r.calls.json).not.toHaveBeenCalled();});
 it('existing default register handler still delegates legacy service, not new activation',async()=>{mocks.legacyRegister.mockResolvedValue(session);const r=response();await controllers.register(request({},{}),r.res,vi.fn());expect(mocks.legacyRegister).toHaveBeenCalledTimes(1);expect(r.calls.status).toHaveBeenCalledWith(201);});
});

describe('client attempt identity lifecycle and API bridge',()=>{
 it('ambiguous/manual retry keeps ID without storing payload or browser state',()=>{const a=clientAttempts.createAuthAttempt(),first=a.begin('register')!;first.settle(false);const second=a.begin('register')!;expect(second.requestId).toBe(first.requestId);expect(JSON.stringify(a)).toBe('{}');second.settle(false);});
 it('success, edits and purpose changes create deliberate new attempts',()=>{const a=clientAttempts.createAuthAttempt(),one=a.begin('register')!;one.settle(true);const two=a.begin('register')!;expect(two.requestId).not.toBe(one.requestId);two.settle(false);a.invalidate();const three=a.begin('register')!;expect(three.requestId).not.toBe(two.requestId);three.settle(false);expect(a.begin('password-reset')!.requestId).not.toBe(three.requestId);});
 it('synchronous single-flight guard prevents double dispatch',()=>{const a=clientAttempts.createAuthAttempt(),one=a.begin('verification')!;expect(a.begin('verification')).toBeNull();one.settle(false);expect(a.begin('verification')!.requestId).toBe(one.requestId);});
 it('old completion cannot clear a new edited attempt or settle twice',()=>{const a=clientAttempts.createAuthAttempt(),one=a.begin('register')!;a.invalidate();one.settle(true);const two=a.begin('register')!;one.settle(true);expect(a.begin('register')).toBeNull();two.settle(false);expect(a.begin('register')!.requestId).toBe(two.requestId);});
 it('unavailable secure UUID never falls back to random/time IDs',()=>{vi.stubGlobal('crypto',undefined);expect(()=>clientAttempts.newAuthRequestId()).toThrow('Secure request identity unavailable');});
 it('passes the explicit request ID through registration without changing legacy response',async()=>{const id=randomUUID(),input={name:'Synthetic',email:'synthetic@example.invalid',password:'SYNTHETIC'};mocks.post.mockResolvedValue({user:session.user});expect(await clientAuth.register(input,id)).toEqual(session.user);expect(mocks.post).toHaveBeenCalledWith('/auth/register',input,{'Idempotency-Key':id});});
 it('replay response requires sign-in rather than returning undefined/fake user',async()=>{mocks.post.mockResolvedValue({registration:'replayed',requiresSignIn:true});await expect(clientAuth.register({name:'Synthetic',email:'synthetic@example.invalid',password:'SYNTHETIC'},randomUUID())).rejects.toMatchObject({code:'REGISTRATION_REPLAYED',status:200});});
 for(const method of ['resendVerification','requestPasswordReset'] as const)it('passes issuance header '+method,async()=>{mocks.post.mockResolvedValue({});const id=randomUUID();await clientAuth[method]('synthetic@example.invalid',id);expect(mocks.post.mock.calls[0][2]).toEqual({'Idempotency-Key':id});});
 it('API never automatically retries a failed transport call',async()=>{mocks.post.mockRejectedValue(new clientApi.ApiError('NETWORK_ERROR','Synthetic unavailable',0));await expect(clientAuth.requestPasswordReset('synthetic@example.invalid',randomUUID())).rejects.toMatchObject({status:0});expect(mocks.post).toHaveBeenCalledTimes(1);});
 it('rejects malformed IDs and malformed success payloads safely',async()=>{await expect(clientAuth.requestPasswordReset('synthetic@example.invalid','bad')).rejects.toMatchObject({code:'INVALID_REQUEST_ID'});expect(mocks.post).not.toHaveBeenCalled();mocks.post.mockResolvedValue({});await expect(clientAuth.register({name:'Synthetic',email:'synthetic@example.invalid',password:'SYNTHETIC'},randomUUID())).rejects.toMatchObject({code:'PARSE_ERROR'});});
 it('forms explicitly preserve unknown-outcome IDs and invalidate actual edited fields',()=>{const source=readFileSync(resolve(__dirname,'../../client/src/components/auth/AuthFlowPage.tsx'),'utf8');expect(source).toContain('ticket?.settle(false)');expect(source).toContain('isTerminalAuthFailure(cause)');expect(source).toContain('ticket!.requestId');expect(source).toContain('REGISTRATION_REPLAYED');const helper=readFileSync(resolve(__dirname,'../../client/src/lib/api/auth-attempt.ts'),'utf8');expect(helper).not.toMatch(/localStorage|sessionStorage|document\.cookie|Math\.random/);});
 for(const status of [0,408,429,500,502,503])it('real API failure retains identity for manual retry '+status,async()=>{
  const attempt=clientAttempts.createAuthAttempt(),first=attempt.begin('password-reset')!,requests:string[]=[];
  vi.stubGlobal('fetch',async(_url:string,init:RequestInit)=>{requests.push(new Headers(init.headers).get('Idempotency-Key')!);if(status===0)throw new Error('SYNTHETIC-NETWORK');return new Response(JSON.stringify({success:false,code:'SYNTHETIC_FAILURE',message:'Synthetic failure'}),{status});});
  try{await clientAuth.requestPasswordReset('synthetic@example.invalid',first.requestId);throw new Error('EXPECTED_FAILURE');}
  catch(error){expect(error).toBeInstanceOf(clientApi.ApiError);first.settle(clientAttempts.isTerminalAuthFailure(error));}
  expect(requests).toHaveLength(1);const second=attempt.begin('password-reset')!;expect(second.requestId).toBe(first.requestId);await expect(clientAuth.requestPasswordReset('synthetic@example.invalid',second.requestId)).rejects.toMatchObject({status});expect(requests).toEqual([first.requestId,first.requestId]);second.settle(false);
 });
 for(const status of [400,401,403,409,422])it('definitive response ends the identity '+status,()=>{const attempt=clientAttempts.createAuthAttempt(),first=attempt.begin('register')!;first.settle(clientAttempts.isTerminalAuthFailure(new clientApi.ApiError('REJECTED','Synthetic rejection',status)));expect(attempt.begin('register')!.requestId).not.toBe(first.requestId);});
 it('malformed success and unknown exceptions retain identity, replay completion terminates it',()=>{expect(clientAttempts.isTerminalAuthFailure(new clientApi.ApiError('PARSE_ERROR','Synthetic parse',200))).toBe(false);expect(clientAttempts.isTerminalAuthFailure(new Error('SYNTHETIC'))).toBe(false);expect(clientAttempts.isTerminalAuthFailure(new clientApi.ApiError('REGISTRATION_REPLAYED','Synthetic replay',200))).toBe(true);});
});

function workerSetup(){
 const row:NotificationSnapshot={source:'ordinary',id:'synthetic-job',version:'2026-10-29T00:00:00.000Z',state:'PENDING',payload:{template:'BOOKING_CONFIRMATION',params:{name:'Synthetic',referenceNumber:'SYNTHETIC-REF',bookingType:'FLIGHT',totalPrice:0,currency:'BDT'}},recipient:'synthetic@example.invalid',subject:'Synthetic notification',channel:'EMAIL'};
 const lease={jobId:row.id,version:'2026-10-29T00:00:00.001Z',workerId:'synthetic-worker'};
 const store={load:vi.fn<CompatibleOutboxStore['load']>(async()=>row),next:vi.fn<CompatibleOutboxStore['next']>(async()=>[{source:row.source,id:row.id}]),quarantineReason:vi.fn<CompatibleOutboxStore['quarantineReason']>(async()=>null),quarantine:vi.fn<CompatibleOutboxStore['quarantine']>(async()=>true),claimOrdinary:vi.fn<CompatibleOutboxStore['claimOrdinary']>(async()=>lease),beginOrdinarySend:vi.fn<CompatibleOutboxStore['beginOrdinarySend']>(async()=>true),finishOrdinary:vi.fn<CompatibleOutboxStore['finishOrdinary']>(async()=>true),failBeforeSend:vi.fn<CompatibleOutboxStore['failBeforeSend']>(async()=>true),redriveOrdinary:vi.fn<CompatibleOutboxStore['redriveOrdinary']>(async()=>true)};
 const recovery={admit:vi.fn(async()=>true)},authorize=vi.fn(async(_actor:string,_action:'ordinary'|'protected'|'redrive')=>true),authorizeAuth=vi.fn(async()=>false);
 const protectedStore={transaction:vi.fn(),claim:vi.fn(async()=>null),admit:vi.fn(async()=>null),beginSend:vi.fn(async()=>false),finish:vi.fn(async()=>false)};
 const deps={store,recovery,authorize,protected:{store:protectedStore,keys:{boundary:vi.fn(()=>{throw new Error('UNEXPECTED_KEY_REQUEST');})},frontendOrigin:'https://synthetic.example.invalid',authorize:authorizeAuth}};
 return {row,lease,store,recovery,authorize,authorizeAuth,protectedStore,deps,create:()=>workers.createCompatibleOutboxWorker(deps)};
}
describe('compatible worker / safe operator redrive',()=>{
 it('a second stale claim cannot send the same ordinary job twice',async()=>{const s=workerSetup();s.store.claimOrdinary.mockResolvedValueOnce(s.lease).mockResolvedValue(null);const worker=s.create();expect(await worker.process('ordinary',s.row.id,'synthetic-worker')).toBe('submitted');expect(await worker.process('ordinary',s.row.id,'synthetic-worker')).toBe('denied');expect(mocks.mail).toHaveBeenCalledTimes(1);expect(s.store.beginOrdinarySend).toHaveBeenCalledTimes(1);});
 it('admitted ordinary send creates intent before transport and fences acknowledgment',async()=>{const s=workerSetup(),events:string[]=[];s.store.beginOrdinarySend.mockImplementation(async()=>{events.push('intent');return true;});mocks.mail.mockImplementation(async()=>{events.push('smtp');return {accepted:['synthetic@example.invalid']};});expect(await s.create().process('ordinary',s.row.id,'synthetic-worker')).toBe('submitted');expect(events).toEqual(['intent','smtp']);expect(s.store.finishOrdinary).toHaveBeenCalledWith(s.lease,'submitted');});
 it('worker denial precedes data/key/transport access',async()=>{const s=workerSetup();s.authorize.mockResolvedValue(false);expect(await s.create().process('ordinary',s.row.id,'synthetic-worker')).toBe('denied');expect(s.store.load).not.toHaveBeenCalled();expect(mocks.mail).not.toHaveBeenCalled();});
 it('recovery denial prevents data access',async()=>{const s=workerSetup();s.recovery.admit.mockResolvedValue(false);expect(await s.create().process('ordinary',s.row.id,'synthetic-worker')).toBe('denied');expect(s.store.load).not.toHaveBeenCalled();});
 it('quarantined and legacy-auth jobs never render/send',async()=>{const s=workerSetup();s.store.quarantineReason.mockResolvedValue('RESTORED');expect(await s.create().process('ordinary',s.row.id,'synthetic-worker')).toBe('quarantined');expect(s.store.claimOrdinary).not.toHaveBeenCalled();s.store.quarantineReason.mockResolvedValue(null);s.row.payload={template:'PASSWORD_RESET',params:{resetUrl:'SYNTHETIC'}};expect(await s.create().process('ordinary',s.row.id,'synthetic-worker')).toBe('quarantined');expect(s.store.quarantine).toHaveBeenCalled();expect(mocks.mail).not.toHaveBeenCalled();});
 it('protected record never falls back to ordinary claim/render/send',async()=>{const s=workerSetup();s.row.source='protected';s.row.version='1';s.row.payload={version:1,keyRef:'test',nonce:Buffer.alloc(12).toString('base64url'),ciphertext:'YQ',tag:Buffer.alloc(16).toString('base64url')};expect(await s.create().process('protected',s.row.id,'synthetic-worker')).toBe('denied');expect(s.store.claimOrdinary).not.toHaveBeenCalled();expect(mocks.mail).not.toHaveBeenCalled();});
 it('metadata and payload snapshots prevent mutation during quarantine lookup',async()=>{const s=workerSetup();s.store.quarantineReason.mockImplementation(async()=>{s.row.recipient='other@example.invalid';s.row.payload={template:'PASSWORD_RESET',params:{resetUrl:'SYNTHETIC'}};return null;});expect(await s.create().process('ordinary',s.row.id,'synthetic-worker')).toBe('submitted');expect(mocks.mail.mock.calls[0][0].to).toBe('synthetic@example.invalid');});
 it('render failure is recorded before send intent, not retried',async()=>{const s=workerSetup();s.row.payload={template:'BOOKING_CONFIRMATION',params:{name:{}}};expect(await s.create().process('ordinary',s.row.id,'synthetic-worker')).toBe('failed');expect(s.store.failBeforeSend).toHaveBeenCalledWith(s.lease);expect(s.store.beginOrdinarySend).not.toHaveBeenCalled();expect(mocks.mail).not.toHaveBeenCalled();});
 it('lease loss before intent prevents send',async()=>{const s=workerSetup();s.store.beginOrdinarySend.mockResolvedValue(false);expect(await s.create().process('ordinary',s.row.id,'synthetic-worker')).toBe('denied');expect(mocks.mail).not.toHaveBeenCalled();});
 it('unknown intent commit outcome is ambiguous without repair or SMTP',async()=>{const s=workerSetup();s.store.beginOrdinarySend.mockRejectedValue(new Error('SYNTHETIC-PRIVATE'));expect(await s.create().process('ordinary',s.row.id,'synthetic-worker')).toBe('ambiguous');expect(s.store.failBeforeSend).not.toHaveBeenCalled();expect(mocks.mail).not.toHaveBeenCalled();});
 it('SMTP failure and lost acknowledgment remain ambiguous',async()=>{const s=workerSetup();mocks.mail.mockRejectedValue(new Error('SYNTHETIC-PRIVATE'));expect(await s.create().process('ordinary',s.row.id,'synthetic-worker')).toBe('ambiguous');expect(s.store.finishOrdinary).toHaveBeenCalledWith(s.lease,'ambiguous');mocks.mail.mockResolvedValue({accepted:['synthetic@example.invalid']});s.store.finishOrdinary.mockResolvedValue(false);expect(await s.create().process('ordinary',s.row.id,'synthetic-worker')).toBe('ambiguous');});
 it('disabled mail stays suppressed',async()=>{const s=workerSetup();mocks.enabled=false;expect(await s.create().process('ordinary',s.row.id,'synthetic-worker')).toBe('suppressed');expect(s.store.finishOrdinary).toHaveBeenCalledWith(s.lease,'suppressed');expect(mocks.mail).not.toHaveBeenCalled();});
 it('malformed recipients/channels require durable quarantine and never claim',async()=>{const s=workerSetup();s.row.recipient='bad\r\nrecipient';s.store.quarantine.mockResolvedValue(false);expect(await s.create().process('ordinary',s.row.id,'synthetic-worker')).toBe('denied');expect(s.store.claimOrdinary).not.toHaveBeenCalled();expect(mocks.mail).not.toHaveBeenCalled();});
 it('operator redrive needs trusted admission, current snapshot and a safe ordinary payload',async()=>{const s=workerSetup();s.row.state='FAILED';expect(await s.create().redrive('ordinary',s.row.id,s.row.version,'synthetic-operator')).toBe(true);expect(s.store.redriveOrdinary).toHaveBeenCalledWith(expect.objectContaining({id:s.row.id,version:s.row.version}));expect(mocks.mail).not.toHaveBeenCalled();});
 for(const condition of ['operator-denied','protected','stale-version','quarantined','legacy-auth','not-failed'])it('denies redrive '+condition,async()=>{const s=workerSetup();s.row.state='FAILED';if(condition==='operator-denied')s.authorize.mockResolvedValue(false);if(condition==='quarantined')s.store.quarantineReason.mockResolvedValue('RESTORED');if(condition==='legacy-auth')s.row.payload={template:'EMAIL_VERIFICATION',params:{}};if(condition==='not-failed')s.row.state='PENDING';expect(await s.create().redrive(condition==='protected'?'protected':'ordinary',s.row.id,condition==='stale-version'?'stale':s.row.version,'synthetic-operator')).toBe(false);expect(s.store.redriveOrdinary).not.toHaveBeenCalled();expect(mocks.mail).not.toHaveBeenCalled();});
 it('run obtains authorized sources before discovering jobs',async()=>{const s=workerSetup();s.authorize.mockResolvedValue(false);expect((await s.create().run('synthetic-worker')).denied).toBe(1);expect(s.store.next).not.toHaveBeenCalled();});
 it('run refuses candidates outside its admitted source scope',async()=>{const s=workerSetup();s.authorize.mockImplementation(async(_actor,action)=>action==='ordinary');s.store.next.mockResolvedValue([{source:'protected',id:'job'}]);await expect(s.create().run('synthetic-worker')).rejects.toThrow('COMPATIBLE_WORKER_SCOPE_INVALID');expect(s.store.load).not.toHaveBeenCalled();});
 it('run rejects excess or duplicate candidates and stops after ambiguity',async()=>{const s=workerSetup();s.store.next.mockResolvedValue([{source:'ordinary',id:'job'},{source:'ordinary',id:'job'}]);await expect(s.create().run('synthetic-worker')).rejects.toThrow('COMPATIBLE_WORKER_SCOPE_INVALID');s.store.next.mockResolvedValue([{source:'ordinary',id:s.row.id},{source:'ordinary',id:'second'}]);mocks.mail.mockRejectedValue(new Error('SYNTHETIC'));expect((await s.create().run('synthetic-worker')).processed).toBe(1);expect(s.store.load).toHaveBeenCalledTimes(1);});
});

describe('unmounted worker/operator controller factories',()=>{
 function setup(){const s=workerSetup(),worker=s.create(),run=vi.spyOn(worker,'run').mockResolvedValue({processed:0,submitted:0,suppressed:0,ambiguous:0,quarantined:0,denied:0,failed:0}),redrive=vi.spyOn(worker,'redrive').mockResolvedValue(true);
  const admitWorker=vi.fn(async(_req:Request):Promise<{workerId:string}|null>=>({workerId:'verified-worker'})),admitOperator=vi.fn(async(_req:Request):Promise<{operatorId:string}|null>=>({operatorId:'verified-operator'}));
  return {run,redrive,admitWorker,admitOperator,handlers:workerControllers.createCompatibleOutboxController({worker,admitWorker,admitOperator})};}
 for(const header of ['origin','sec-fetch-site'])it('browser context cannot invoke worker '+header,async()=>{const s=setup(),r=response(),next=vi.fn();await s.handlers.run(request({[header]:'synthetic'}),r.res,next);expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:403}));expect(s.admitWorker).not.toHaveBeenCalled();expect(s.run).not.toHaveBeenCalled();});
 it('worker denial precedes candidate dispatch',async()=>{const s=setup(),r=response(),next=vi.fn();s.admitWorker.mockResolvedValue(null);await s.handlers.run(request(),r.res,next);expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:401}));expect(s.run).not.toHaveBeenCalled();});
 it('uses verified actor and ignores body-supplied actors/limits',async()=>{const s=setup(),r=response();await s.handlers.run(request({},{workerId:'untrusted',limit:99999}),r.res,vi.fn());expect(s.run).toHaveBeenCalledWith('verified-worker');expect(s.run.mock.calls[0]).toHaveLength(1);});
 it('redrive uses verified operator plus exact ordinary version',async()=>{const s=setup(),r=response(),req=request({},{source:'ordinary',version:'2026-10-29T00:00:00.000Z',operatorId:'untrusted'});req.method='POST';await s.handlers.redrive(req,r.res,vi.fn());expect(s.redrive).toHaveBeenCalledWith('ordinary','synthetic-job','2026-10-29T00:00:00.000Z','verified-operator');});
 for(const body of [{source:'protected',version:'1'},{source:'ordinary',version:'stale'}])it('rejects unsafe redrive target/version',async()=>{const s=setup(),r=response(),next=vi.fn(),req=request({},body);req.method='POST';await s.handlers.redrive(req,r.res,next);expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:400}));expect(s.redrive).not.toHaveBeenCalled();});
 it('sanitizes worker faults instead of exposing raw exception text',async()=>{const s=setup(),r=response(),next=vi.fn();s.run.mockRejectedValue(new Error('SYNTHETIC-PRIVATE'));await s.handlers.run(request(),r.res,next);expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:500,message:'Internal server error'}));});
 it('rejects unsupported HTTP methods before identity resolution',async()=>{const s=setup(),r=response(),next=vi.fn(),req=request();req.method='POST';await s.handlers.run(req,r.res,next);expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:405}));expect(s.admitWorker).not.toHaveBeenCalled();});
 it('does not mount or replace existing auth/worker/admin routes',()=>{const file=readFileSync(resolve(__dirname,'../src/routes/auth.routes.ts'),'utf8');expect(file).not.toContain('createProtectedAuthController');expect(readFileSync(resolve(__dirname,'../src/routes/outbox-worker.routes.ts'),'utf8')).not.toContain('createCompatibleOutboxController');expect(readFileSync(resolve(__dirname,'../src/routes/admin.routes.ts'),'utf8')).not.toContain('createCompatibleOutboxController');});
});

describe('compatible worker PostgreSQL adapter — fake connection only',()=>{
 function fixture(){const calls:Array<{sql:string;values:unknown[]}>=[];const db={release:vi.fn(),query:vi.fn(async(sql:string,values:unknown[]=[])=>{calls.push({sql,values});return {rowCount:1,rows:sql.includes('RETURNING')?[{version:'2026-10-29T00:00:00.001Z'}]:[]};})};return {calls,db,store:new pg.PostgresCompatibleOutboxStore({connect:async()=>db} as never)};}
 it('constructor is inert; transaction has fixed bounds',async()=>{const f=fixture();expect(f.calls).toEqual([]);await f.store.next(['ordinary']);expect(f.calls[0].sql).toBe('BEGIN');expect(f.calls.some(c=>c.sql==="SET LOCAL statement_timeout='5s'")).toBe(true);expect(f.calls.at(-1)?.sql).toBe('COMMIT');});
 for(const source of ['ordinary','protected'] as const)it('discovers only its admitted table scope '+source,async()=>{const f=fixture();await f.store.next([source]);const sql=f.calls.find(c=>c.sql.startsWith('SELECT source,id'))!.sql;expect(sql).toContain('LIMIT 3');expect(sql).toContain('NotificationQuarantine');if(source==='ordinary'){expect(sql).not.toContain('ProtectedAuthJob');expect(sql).toContain('NotificationSendIntent');}else expect(sql).not.toContain('NotificationOutbox');});
 it('reclaim requires compatible lease proof, not legacy PROCESSING age alone',async()=>{const f=fixture();await f.store.next(['ordinary']);const sql=f.calls.find(c=>c.sql.startsWith('SELECT source,id'))!.sql;expect(sql).toContain('l.version=n."updatedAt"');expect(sql).toContain('l."leaseUntil"<clock_timestamp()');});
 it('ordinary claim binds version/state/actor and advances lease monotonically',async()=>{const f=fixture(),record={source:'ordinary' as const,id:'synthetic-job',version:'2026-10-29T00:00:00.000Z',state:'PENDING'};expect(await f.store.claimOrdinary(record,'synthetic-worker')).toMatchObject({workerId:'synthetic-worker'});const query=f.calls.find(c=>c.sql.startsWith('SELECT n.id'))!;expect(query.values).toEqual([record.id,record.version,record.state]);expect(query.sql).toContain('FOR UPDATE OF n');expect(f.calls.some(c=>c.sql.includes("interval '1 millisecond'"))).toBe(true);expect(f.calls.find(c=>c.sql.startsWith('INSERT INTO public."CompatibleNotificationLease"'))?.values[2]).toBe('synthetic-worker');});
 it('send admission is durable before SMTP and cannot duplicate an existing intent',async()=>{const f=fixture();await f.store.beginOrdinarySend({jobId:'job',version:'2026-10-29T00:00:00.001Z',workerId:'worker'});const index=f.calls.findIndex(c=>c.sql.startsWith('INSERT INTO public."NotificationSendIntent"'));expect(index).toBeGreaterThan(0);expect(f.calls[index].sql).toContain('ON CONFLICT DO NOTHING');expect(f.calls[index+1].sql).toContain('attempts=attempts+1');});
 it('redrive permits only safe pre-send failure; preserves attempt limit and excludes intents/quarantine',async()=>{const f=fixture();await f.store.redriveOrdinary({source:'ordinary',id:'job',version:'2026-10-29T00:00:00.000Z',state:'FAILED'});const q=f.calls.find(c=>c.sql.startsWith('UPDATE public."NotificationOutbox"'))!;expect(q.sql).toContain("n.error='SAFE_PRE_SEND_FAILURE'");expect(q.sql).toContain('n.attempts<n."maxAttempts"');expect(q.sql).toContain('NotificationSendIntent');expect(q.sql).toContain('NotificationQuarantine');expect(q.sql).not.toContain('attempts=0');});
 it('raw database errors cannot escape or trigger automatic retry',async()=>{const f=fixture();f.db.query.mockRejectedValue(new Error('SYNTHETIC-PRIVATE'));await expect(f.store.next(['ordinary'])).rejects.toThrow('COMPATIBLE_OUTBOX_STORAGE_FAILED');expect(f.calls).toHaveLength(0);expect(f.db.release).toHaveBeenCalledWith(true);});
 it('connection acquisition failure is sanitized without a retry',async()=>{const connect=vi.fn(async()=>{throw new Error('SYNTHETIC-PRIVATE');});await expect(new pg.PostgresCompatibleOutboxStore({connect} as never).next(['ordinary'])).rejects.toThrow('COMPATIBLE_OUTBOX_STORAGE_FAILED');expect(connect).toHaveBeenCalledTimes(1);});
 it('unknown commit outcome discards the connection and is never retried',async()=>{const f=fixture();f.db.query.mockImplementation(async(sql,values=[])=>{f.calls.push({sql,values});if(sql==='COMMIT')throw new Error('SYNTHETIC-PRIVATE');return {rows:[],rowCount:0};});await expect(f.store.next(['ordinary'])).rejects.toThrow('COMPATIBLE_OUTBOX_STORAGE_FAILED');expect(f.calls.filter(c=>c.sql==='COMMIT')).toHaveLength(1);expect(f.db.release).toHaveBeenCalledWith(true);});
 it('stale row blocks lease and send-intent creation',async()=>{const f=fixture();f.db.query.mockResolvedValue({rows:[],rowCount:0});expect(await f.store.claimOrdinary({source:'ordinary',id:'job',version:'2026-10-29T00:00:00.000Z',state:'PENDING'},'worker')).toBeNull();expect(await f.store.beginOrdinarySend({jobId:'job',version:'2026-10-29T00:00:00.000Z',workerId:'worker'})).toBe(false);expect(f.calls.some(c=>c.sql.startsWith('INSERT'))).toBe(false);});
});

describe('inert concrete protected auth/worker composition',()=>{
 function setup(){
  const db={query:vi.fn(async(_sql:string,_values:unknown[]=[]):Promise<{rows:Record<string,unknown>[];rowCount:number}>=>({rows:[],rowCount:0})),release:vi.fn(),on:vi.fn(),removeListener:vi.fn()};
  const connect=vi.fn(async()=>db),boundary=vi.fn(()=>{throw new Error('UNEXPECTED_KEY_ACCESS');});
  // Narrow fake query/release surface; no actual PG client is constructed in offline tests.
  const input={pool:{connect:connect as unknown as Pool['connect']},keys:{boundary},keyRef:'test-key',refreshTokenExpiresDays:30,
   recovery:{admit:vi.fn(async()=>true)},digestPolicy:{currentVersion:'test',acquireKey:()=>Buffer.alloc(32,7)},
   signAccessToken:()=> 'SYNTHETIC-ACCESS',frontendOrigin:'https://synthetic.example.invalid',
   authorizeDelivery:vi.fn(async()=>false),authorizeWorker:vi.fn(async()=>false),
   admitWorker:vi.fn(async()=>null),admitOperator:vi.fn(async()=>null)};
  return {db,connect,boundary,input,create:()=>composition.createProtectedPhase1Composition(input)};
 }
 it('assembly does not connect, acquire keys, mount routes or start a worker',()=>{const s=setup(),c=s.create();expect(c.authController.register).toBeTypeOf('function');expect(c.workerController.run).toBeTypeOf('function');expect(s.connect).not.toHaveBeenCalled();expect(s.boundary).not.toHaveBeenCalled();expect(s.input.authorizeWorker).not.toHaveBeenCalled();});
 for(const field of ['digestPolicy','recovery','authorizeDelivery','authorizeWorker','admitWorker','admitOperator'] as const)it('requires explicit dependency '+field,()=>{const s=setup();Reflect.set(s.input,field,undefined);expect(s.create).toThrow('PROTECTED_COMPOSITION_INVALID');expect(s.connect).not.toHaveBeenCalled();});
 it('compatibility issuers cannot bypass the mandatory request ledger',async()=>{const s=setup(),c=s.create();await expect(c.auth.register({})).rejects.toMatchObject({statusCode:400});await expect(c.auth.requestPasswordReset('synthetic@example.invalid')).rejects.toMatchObject({statusCode:400});expect(s.connect).not.toHaveBeenCalled();});
 it('missing request identity fails before PostgreSQL access',async()=>{const s=setup(),c=s.create(),r=response(),next=vi.fn();await c.authController.register(request(),r.res,next);expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:400}));expect(s.connect).not.toHaveBeenCalled();});
 it('worker identity denial prevents any store read',async()=>{const s=setup(),c=s.create(),r=response(),next=vi.fn();await c.workerController.run(request(),r.res,next);expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:401}));expect(s.connect).not.toHaveBeenCalled();});
 it('real controller/service/PG replay returns no session, crypto work or cookie writes',async()=>{
  const s=setup(),id=randomUUID(),body={name:'Synthetic',email:'synthetic@example.invalid',password:'Synthetic-Password-123'};
  const fingerprint=digests.inquiryDigest({operation:'register',input:body},{operation:'auth:issuance-request',principal:'auth-request'},s.input.digestPolicy);
  const receipt={operation:'register',userId:'synthetic-user',credentialId:'credential',jobId:'job',sessionId:'session'};
  s.db.query.mockImplementation(async(sql)=>({rows:sql.includes('FROM public."AuthIssuanceRequest"')?[{fingerprint,receipt}]:[],rowCount:sql.includes('FROM public."AuthIssuanceRequest"')?1:0}));
  const r=response(),next=vi.fn();await s.create().authController.register(request({'idempotency-key':id},body),r.res,next);
  expect(next).not.toHaveBeenCalled();expect(r.calls.json).toHaveBeenCalledWith({success:true,data:{registration:'replayed',requiresSignIn:true}});
  expect(r.calls.cookie).not.toHaveBeenCalled();expect(s.connect).toHaveBeenCalledTimes(1);expect(s.boundary).not.toHaveBeenCalled();expect(s.db.query.mock.calls.some(([sql])=>/INSERT|UPDATE/.test(sql))).toBe(false);
 });
});

