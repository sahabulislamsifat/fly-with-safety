import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SecretBoundary, SecretContext } from '../src/security/secret-data-plane.js';
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




const secret='SYNTHETIC-DATA-PLANE-SECRET-6629';
let crypto:typeof import('../src/security/secret-data-plane.js');
const context=():SecretContext=>({purpose:'passenger-document',aad:Buffer.from('synthetic-env/booking/passenger/immutable-id')});
function boundary(){
 const issued:Uint8Array[]=[],authorize=vi.fn<SecretBoundary['authorize']>(async()=>true);
 const acquireDataKey=vi.fn<SecretBoundary['acquireDataKey']>(async()=>{const key=Buffer.alloc(32,7);issued.push(key);return key;});
 return {issued,authorize,acquireDataKey};
}
beforeAll(async()=>{installGuards();expect(()=>net.connect(1,'127.0.0.1')).toThrow('OUT04_OFFLINE_BOUNDARY');attempts.length=0;crypto=await import('../src/security/secret-data-plane.js');});
afterEach(()=>{expect(attempts).toEqual([]);vi.useRealTimers();vi.restoreAllMocks();});
afterAll(()=>{for(const undo of restore.reverse())undo();syncBuiltinESMExports();});
describe('provider-independent secret data plane — no live KMS',()=>{
 it.each(['passenger-document','auth-notification'] as const)('round-trips %s using fresh owned keys and awaited authorization',async purpose=>{
  const b=boundary(),ctx={...context(),purpose},plain=Buffer.from(secret);
  const sealed=await crypto.sealSecret(plain,ctx,b);const opened=await crypto.openSecret(sealed,ctx,b);
  expect(Buffer.from(opened).toString()).toBe(secret);expect(sealed.nonce.byteLength).toBe(12);expect(sealed.tag.byteLength).toBe(16);
  expect(Object.keys(sealed).sort()).toEqual(['ciphertext','nonce','tag']);expect(Buffer.from(sealed.ciphertext).equals(plain)).toBe(false);
  expect(b.authorize).toHaveBeenCalledTimes(2);expect(b.acquireDataKey).toHaveBeenCalledTimes(2);expect(b.issued.every(key=>key.every(byte=>byte===0))).toBe(true);
  opened.fill(0);expect(plain.toString()).toBe(secret);
 });
 it('denies before any key acquisition without trusting truthy values',async()=>{
  for(const allowed of [false,'true',{},1]){
   const b={authorize:vi.fn(async()=>allowed),acquireDataKey:vi.fn(async()=>Buffer.alloc(32))};
   await expect(Reflect.apply(crypto.sealSecret,undefined,[Buffer.from(secret),context(),b])).rejects.toMatchObject({code:'FORBIDDEN'});
   expect(b.acquireDataKey).not.toHaveBeenCalled();
  }
 });
 it('actually awaits async authorization before accessing a key',async()=>{
  const b=boundary();let allow:(value:boolean)=>void=()=>{};
  b.authorize.mockImplementation(()=>new Promise(resolve=>{allow=resolve;}));
  const pending=crypto.sealSecret(Buffer.from(secret),context(),b);await Promise.resolve();await Promise.resolve();
  expect(b.acquireDataKey).not.toHaveBeenCalled();allow(true);await pending;expect(b.acquireDataKey).toHaveBeenCalledTimes(1);
 });
 it('bounds denied, throwing and late authorization without a key request',async()=>{
  vi.useFakeTimers();let allow:(value:boolean)=>void=()=>{};const b=boundary();
  b.authorize.mockImplementation(()=>new Promise(resolve=>{allow=resolve;}));
  const pending=crypto.sealSecret(Buffer.from(secret),context(),b).catch(error=>error);
  await vi.advanceTimersByTimeAsync(251);expect(await pending).toMatchObject({code:'FORBIDDEN'});allow(true);await Promise.resolve();
  expect(b.acquireDataKey).not.toHaveBeenCalled();
 });
 it('erases a late key even when the provider ignores cancellation',async()=>{
  vi.useFakeTimers();const b=boundary();let provide:(key:Uint8Array)=>void=()=>{};
  b.acquireDataKey.mockImplementation(()=>new Promise(resolve=>{provide=resolve;}));
  const pending=crypto.sealSecret(Buffer.from(secret),context(),b).catch(error=>error);
  await vi.advanceTimersByTimeAsync(501);expect(await pending).toMatchObject({code:'UNAVAILABLE'});
  const late=Buffer.alloc(32,9);provide(late);await Promise.resolve();await Promise.resolve();expect(late.every(value=>value===0)).toBe(true);
 });
 it('does not retry failed key access and discards provider messages',async()=>{
  const b=boundary();b.acquireDataKey.mockRejectedValue(new Error(secret));
  const error=await crypto.sealSecret(Buffer.from(secret),context(),b).catch(error=>error);
  expect(error).toMatchObject({code:'UNAVAILABLE'});expect(error.message).toBe('UNAVAILABLE');expect('cause' in error).toBe(false);
  expect(JSON.stringify(error)).not.toContain(secret);expect(b.acquireDataKey).toHaveBeenCalledTimes(1);
 });
 it.each([0,1,31,33])('rejects invalid owned key length %s and clears it',async length=>{
  const key=Buffer.alloc(length,9),b=boundary();b.acquireDataKey.mockResolvedValue(key);
  await expect(crypto.sealSecret(Buffer.from(secret),context(),b)).rejects.toMatchObject({code:'UNAVAILABLE'});expect(key.every(value=>value===0)).toBe(true);
 });
 it.each(['ciphertext','nonce','tag'] as const)('rejects tampered %s with no unauthenticated plaintext',async field=>{
  const b=boundary(),ctx=context(),sealed=await crypto.sealSecret(Buffer.from(secret),ctx,b);
  sealed[field][0]^=1;await expect(crypto.openSecret(sealed,ctx,b)).rejects.toMatchObject({code:'INTEGRITY_FAILURE'});
  expect(b.issued.every(key=>key.every(value=>value===0))).toBe(true);
 });
 it('binds purpose and immutable-context bytes cryptographically',async()=>{
  const b=boundary(),sealed=await crypto.sealSecret(Buffer.from(secret),context(),b);
  await expect(crypto.openSecret(sealed,{...context(),purpose:'auth-notification'},b)).rejects.toMatchObject({code:'INTEGRITY_FAILURE'});
  await expect(crypto.openSecret(sealed,{...context(),aad:Buffer.from('wrong-passenger')},b)).rejects.toMatchObject({code:'INTEGRITY_FAILURE'});
 });
 it('rejects authorization-context mutation before key access',async()=>{
  const b:SecretBoundary={authorize:vi.fn(async(_action,ctx)=>{ctx.aad[0]^=1;return true;}),acquireDataKey:vi.fn(async()=>Buffer.alloc(32))};
  await expect(crypto.sealSecret(Buffer.from(secret),context(),b)).rejects.toMatchObject({code:'FORBIDDEN'});expect(b.acquireDataKey).not.toHaveBeenCalled();
 });
 it('rejects provider-context mutation and erases its key',async()=>{
  const key=Buffer.alloc(32,7),b:SecretBoundary={authorize:async()=>true,acquireDataKey:async(_action,ctx)=>{ctx.aad[0]^=1;return key;}};
  await expect(crypto.sealSecret(Buffer.from(secret),context(),b)).rejects.toMatchObject({code:'UNAVAILABLE'});expect(key.every(value=>value===0)).toBe(true);
 });
 it('snapshots caller bytes before asynchronous policy/key work',async()=>{
  const b=boundary(),ctx=context(),plain=Buffer.from(secret);
  const pending=crypto.sealSecret(plain,ctx,b);plain.fill(0);ctx.aad.fill(0);
  const sealed=await pending;const opened=await crypto.openSecret(sealed,context(),b);expect(Buffer.from(opened).toString()).toBe(secret);opened.fill(0);
 });
 it.each([0,4097])('bounds plaintext length %s before authorization/key access',async length=>{
  const b=boundary();await expect(crypto.sealSecret(Buffer.alloc(length),context(),b)).rejects.toMatchObject({code:'INVALID_INPUT'});expect(b.authorize).not.toHaveBeenCalled();expect(b.acquireDataKey).not.toHaveBeenCalled();
 });
 it('fails closed with no configured boundary; has no synthetic fallback',async()=>{
  await expect(Reflect.apply(crypto.sealSecret,undefined,[Buffer.from(secret),context(),undefined])).rejects.toMatchObject({code:'UNAVAILABLE'});
 });
 it('rejects hostile context/record accessors and proxies without invoking traps',async()=>{
  let reads=0;const hostile=Object.defineProperty({purpose:'passenger-document'},'aad',{get(){reads++;throw new Error(secret);}});
  await expect(Reflect.apply(crypto.sealSecret,undefined,[Buffer.from(secret),hostile,boundary()])).rejects.toMatchObject({code:'INVALID_INPUT'});
  const proxy=new Proxy({},{get(){reads++;throw new Error(secret);},ownKeys(){reads++;throw new Error(secret);}});
  await expect(Reflect.apply(crypto.openSecret,undefined,[proxy,context(),boundary()])).rejects.toMatchObject({code:'INVALID_INPUT'});expect(reads).toBe(0);
 });
 it('does not cache key material across requests and generates fresh nonces',async()=>{
  const b=boundary(),a=await crypto.sealSecret(Buffer.from(secret),context(),b),other=await crypto.sealSecret(Buffer.from(secret),context(),b);
  expect(Buffer.from(a.nonce).equals(Buffer.from(other.nonce))).toBe(false);expect(b.acquireDataKey).toHaveBeenCalledTimes(2);expect(b.issued.every(k=>k.every(v=>v===0))).toBe(true);
 });
});
