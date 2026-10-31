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


const mocks=vi.hoisted(()=>({boundary:false,transaction:vi.fn(),find:vi.fn(),mail:vi.fn(),enabled:true,nodeEnv:'production',legacyRegister:vi.fn(),post:vi.fn(),create:vi.fn()}));
vi.mock('../src/lib/prisma.js',()=>{if(!mocks.boundary)throw new Error('IMPORT_BEFORE_GUARDS');return {prisma:{$transaction:mocks.transaction,idempotencyRecord:{findUnique:mocks.find,create:mocks.create}}};});
vi.mock('pg',()=>{throw new Error('PG_FORBIDDEN')});
vi.mock('@prisma/adapter-pg',()=>{throw new Error('ADAPTER_FORBIDDEN')});
vi.mock('dotenv',()=>{throw new Error('DOTENV_FORBIDDEN')});
vi.mock('nodemailer',()=>({default:{createTransport:()=>({sendMail:mocks.mail})}}));
vi.mock('../src/config/env.js',()=>({env:{get nodeEnv(){return mocks.nodeEnv;},corsOrigins:['https://synthetic.example.invalid'],frontendUrl:'https://synthetic.example.invalid',refreshTokenExpiresDays:30,accessTokenCookieMaxAgeMs:900000,jwtSecret:'SYNTHETIC-ONLY',get emailDeliveryEnabled(){return mocks.enabled;},smtpHost:'smtp.example.invalid',smtpPort:587,smtpUser:'synthetic@example.invalid',smtpPassword:'SYNTHETIC',smtpEmailFrom:'synthetic@example.invalid',smtpEmailFromName:'Synthetic'}}));
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


let origin:typeof import('../src/middleware/request-origin.js'),oauth:typeof import('../src/middleware/oauth-state.js'),paging:typeof import('../src/services/inquiry-page-query.js'),dto:typeof import('../src/utils/booking-dto.js'),states:typeof import('../src/utils/status-transitions.js'),idem:typeof import('../src/services/idempotency.service.js');
let jwt:typeof import('jsonwebtoken');
let notifications:typeof import('../src/services/notification.service.js');
beforeAll(async()=>{installGuards();[origin,oauth,paging,dto,states,idem]=await Promise.all([import('../src/middleware/request-origin.js'),import('../src/middleware/oauth-state.js'),import('../src/services/inquiry-page-query.js'),import('../src/utils/booking-dto.js'),import('../src/utils/status-transitions.js'),import('../src/services/idempotency.service.js')]);jwt=await import('jsonwebtoken');});
beforeEach(async()=>{mocks.create.mockReset().mockResolvedValue({});mocks.nodeEnv='production';mocks.enabled=true;mocks.mail.mockReset().mockResolvedValue({accepted:['synthetic@example.invalid']});notifications=await import('../src/services/notification.service.js');});
afterEach(()=>{expect(attempts).toEqual([]);vi.restoreAllMocks();vi.useRealTimers();});
afterAll(()=>{for(const undo of restore.reverse())undo();syncBuiltinESMExports();});

function req(method='POST',headers:Record<string,string|undefined>={},query:Record<string,unknown>={},cookies:Record<string,string>={}){return {method,query,cookies,get:(name:string)=>headers[name.toLowerCase()]} as unknown as Request;}
function res(){const r={locals:{} as Record<string,string>,cookie:vi.fn(),clearCookie:vi.fn(),set:vi.fn(),redirect:vi.fn()};return {value:r as unknown as Response,calls:r};}
describe('F02 direct origin middleware, no HTTP listener',()=>{
 for(const value of ['null','https://evil.example.invalid','https://synthetic.example.invalid/','https://synthetic.example.invalid/path','https://user@synthetic.example.invalid','https://synthetic.example.invalid.evil','https://synthetic.example.invalid, https://evil.invalid','http://synthetic.example.invalid'])it('denies untrusted origin '+value,()=>{const next=vi.fn();origin.protectRequestOrigin(req('POST',{origin:value}),res().value,next);expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:403}));});
 for(const headers of [{'cookie':'synthetic=1'},{'sec-fetch-site':'cross-site'},{'content-type':'text/plain'},{'content-type':'application/x-www-form-urlencoded'}])it('denies originless ambient/browser request',()=>{const next=vi.fn();origin.protectRequestOrigin(req('POST',headers),res().value,next);expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:403}));});
 it('preserves trusted cross-site frontend and explicit JSON API use',()=>{for(const headers of [{origin:'https://synthetic.example.invalid','sec-fetch-site':'cross-site'},{authorization:'Bearer SYNTHETIC','content-type':'application/json'}]){const next=vi.fn();origin.protectRequestOrigin(req('POST',headers),res().value,next);expect(next).toHaveBeenCalledWith();}});
 for(const method of ['GET','HEAD','OPTIONS'])it('retains protocol read/preflight handling '+method,()=>{const next=vi.fn();origin.protectRequestOrigin(req(method),res().value,next);expect(next).toHaveBeenCalledWith();});
});
describe('F05 actual signed OAuth state, mocked durable reservation',()=>{
 function begin(){const r=res();oauth.beginGoogleState(req('GET'),r.value,vi.fn());return {state:r.calls.locals.googleOAuthState,cookie:r.calls.cookie.mock.calls[0][1] as string,r};}
 it('sets host-only secure cookie and no-store/no-referrer headers',()=>{const a=begin(),b=begin();expect(a.state).toMatch(/^[A-Za-z0-9_-]{43}$/);expect(a.state).not.toBe(b.state);expect(a.r.calls.cookie).toHaveBeenCalledWith('__Host-google_oauth_state',expect.any(String),expect.objectContaining({httpOnly:true,secure:true,path:'/',sameSite:'lax'}));expect(a.r.calls.set).toHaveBeenCalledWith('Referrer-Policy','no-referrer');});
 it('valid callback reserves shared state before advancing',async()=>{const a=begin(),r=res(),next=vi.fn();await oauth.verifyGoogleState(req('GET',{}, {state:a.state,code:'SYNTHETIC'},{'__Host-google_oauth_state':a.cookie}),r.value,next);expect(mocks.create).toHaveBeenCalledTimes(1);expect(mocks.create.mock.calls[0][0].data).toMatchObject({operation:'oauth:google:consume',key:a.state});expect(next).toHaveBeenCalledWith();expect(r.calls.clearCookie).toHaveBeenCalled();});
 for(const kind of ['missing','mismatch','expired','wrong-audience','duplicate'])it('rejects invalid state before DB reservation '+kind,async()=>{const a=begin(),r=res(),next=vi.fn();let state:unknown=a.state,cookie=a.cookie;if(kind==='missing')cookie='';if(kind==='mismatch')state='A'.repeat(43);if(kind==='duplicate')state=[a.state,a.state];if(kind==='expired'||kind==='wrong-audience')cookie=jwt.sign({state:a.state},'SYNTHETIC-ONLY',{audience:kind==='wrong-audience'?'wrong':'flywithsafe:google-oauth-state',issuer:'flywithsafe',expiresIn:kind==='expired'?-1:300});await oauth.verifyGoogleState(req('GET',{}, {state,code:'SYNTHETIC'},{'__Host-google_oauth_state':cookie}),r.value,next);expect(mocks.create).not.toHaveBeenCalled();expect(r.calls.redirect).toHaveBeenCalledWith('https://synthetic.example.invalid?auth=failed');expect(next).not.toHaveBeenCalled();});
 it('unknown durable storage failure cannot fall back to memory or proceed',async()=>{const a=begin(),r=res(),next=vi.fn(),error=new Error('SYNTHETIC-PRIVATE');mocks.create.mockRejectedValue(error);await oauth.verifyGoogleState(req('GET',{}, {state:a.state,code:'SYNTHETIC'},{'__Host-google_oauth_state':a.cookie}),r.value,next);expect(next).toHaveBeenCalledWith(error);expect(mocks.create).toHaveBeenCalledTimes(1);});
 it('shared unique-reservation replay is denied without advancing the callback',async()=>{const {Prisma}=await import('../src/generated/prisma/client.js');const a=begin(),r=res(),next=vi.fn();mocks.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('SYNTHETIC',{code:'P2002',clientVersion:'test'}));await oauth.verifyGoogleState(req('GET',{}, {state:a.state,code:'SYNTHETIC'},{'__Host-google_oauth_state':a.cookie}),r.value,next);expect(r.calls.redirect).toHaveBeenCalledWith('https://synthetic.example.invalid?auth=failed');expect(next).not.toHaveBeenCalled();});
});
describe('F01 identity scope and F04 lifecycle security',()=>{
 it('separates authenticated and guest principals while preserving normalized guest replay',()=>{expect(idem.idempotencyPrincipal('owner','a@example.invalid')).toBe('user:owner');expect(idem.idempotencyPrincipal(undefined,' A@Example.Invalid ')).toBe(idem.idempotencyPrincipal(undefined,'a@example.invalid'));expect(idem.idempotencyPrincipal(undefined,'a@example.invalid')).not.toBe(idem.idempotencyPrincipal(undefined,'b@example.invalid'));});
 for(const type of ['booking','inquiry'])for(const state of ['COMPLETED','CANCELLED'])it('terminal '+type+' '+state+' cannot reopen',()=>{for(const to of ['PENDING','CONFIRMED','COMPLETED','CANCELLED'])expect(states.canTransitionStatus(type,state,to)).toBe(false);});
 it('legacy contact labels remain compatible without migration',()=>{expect(states.canTransitionStatus('contact','OPEN','IN_PROGRESS')).toBe(true);expect(states.canTransitionStatus('contact','CLOSED','IN_PROGRESS')).toBe(true);expect(states.canTransitionStatus('booking','unknown','CONFIRMED')).toBe(false);});
});
describe('F03 truthful transport outcome without mail/provider',()=>{
 it('disabled delivery is suppressed without constructing SMTP',async()=>{mocks.enabled=false;expect(await notifications.sendEmailRaw({to:'synthetic@example.invalid',subject:'Synthetic',html:'Synthetic'})).toMatchObject({status:'suppressed'});expect(mocks.mail).not.toHaveBeenCalled();});
 it('submission requires accepted fake SMTP outcome',async()=>{expect(await notifications.sendEmailRaw({to:'synthetic@example.invalid',subject:'Synthetic',html:'Synthetic'})).toMatchObject({status:'submitted'});expect(mocks.mail).toHaveBeenCalledTimes(1);});
});
describe('F06 bound database paging and F07 minimized legacy DTOs',()=>{
 it('does not invent an unverified support contact or forward one from legacy JSON',()=>{const details=dto.bookingDetailsDTO({supportContact:'unverified@example.invalid'});expect(details.supportContact).toBeUndefined();expect(JSON.stringify(details)).not.toContain('support@flywithsafe.com');expect(JSON.stringify(details)).not.toContain('unverified@example.invalid');});
 for(const type of [undefined,'flight','hotel','package','visa'] as const)it('binds ownership/status and deterministic ordering '+type,()=>{const attacker="synthetic' OR TRUE --",q=paging.inquiryPageQuery(attacker,{page:2,limit:5,type,status:'PENDING'});expect(q.text).not.toContain(attacker);expect(q.values.filter(x=>x===attacker)).toHaveLength(type?1:4);expect(q.text).toContain('"createdAt" DESC, "typeRank" ASC, id DESC');expect(q.text).toContain('LEFT JOIN page ON TRUE');expect(q.values.slice(-2)).toEqual([5,5]);expect(q.text).not.toMatch(/passport|customerEmail|notes/);});
 for(const audience of ['admin','customer','guest'] as const)it('never exposes raw legacy sensitive fields to '+audience,()=>{const secret='SYNTHETIC-DOCUMENT-9912',booking={id:'synthetic-booking',customerEmail:'synthetic@example.invalid',notes:'Internal',bookingDetails:{passportNumber:secret,nested:{token:secret},offerId:'synthetic-offer'},passengers:[{firstName:'Synthetic',passportNumber:secret,dateOfBirth:'1900-01-01'}],statusHistory:[{reason:'Internal',changedBy:'operator'}]};const result=dto.bookingDTO(booking,audience);expect(JSON.stringify(result)).not.toContain(secret);expect(JSON.stringify(result)).not.toContain('1900-01-01');if(audience==='admin')expect(result.passengers[0].passportNumberMasked).toBe('••••9912');else{expect(result.notes).toBeUndefined();expect(result.statusHistory[0].reason).toBeUndefined();}if(audience==='guest')expect(result.customerEmail).toBe('••••');});
});
