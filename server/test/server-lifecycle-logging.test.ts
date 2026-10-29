import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const mocks=vi.hoisted(()=>({
 boundary:false, env:{nodeEnv:'development',port:3000,corsOrigin:'https://example.invalid'},
 validate:vi.fn(), listen:vi.fn(), close:vi.fn(), disconnect:vi.fn(),
 start:vi.fn(), stop:vi.fn(), oauth:vi.fn(()=>false),
}));
function admitted(){if(!mocks.boundary)throw new Error('IMPORT_BEFORE_GUARDS')}
vi.mock('../src/config/env.js',()=>{admitted();return {env:mocks.env,validateEnv:mocks.validate}});
vi.mock('../src/app.js',()=>{admitted();return {default:{listen:mocks.listen}}});
vi.mock('../src/lib/prisma.js',()=>{admitted();return {prisma:{$disconnect:mocks.disconnect}}});
vi.mock('../src/services/outbox.service.js',()=>{admitted();return {startOutboxWorker:mocks.start,stopOutboxWorker:mocks.stop}});
vi.mock('../src/config/passport.js',()=>{admitted();return {isGoogleStrategyConfigured:mocks.oauth}});
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


const secret='SYNTHETIC-OUT04-SECRET-9912';
let listeners:Record<string,(...args:unknown[])=>unknown>={};
let lines:unknown[][]=[];
let exits:number[]=[];
let lastRead=0;
const originalVercel=process.env.VERCEL;
beforeAll(()=>{installGuards();expect(()=>net.connect(1,'127.0.0.1')).toThrow('OUT04_OFFLINE_BOUNDARY');attempts.length=0});
beforeEach(()=>{
 vi.resetModules();vi.useFakeTimers();vi.clearAllMocks();
 listeners={};lines=[];exits=[];lastRead=0;
 delete process.env.VERCEL;
 mocks.env.nodeEnv='development';
 mocks.validate.mockReset();mocks.disconnect.mockReset().mockResolvedValue(undefined);
 mocks.close.mockReset().mockImplementation((done:()=>void)=>{void done()});
 mocks.listen.mockReset().mockImplementation((_port:number,done:()=>void)=>{done();return {close:mocks.close}});
 vi.spyOn(console,'error').mockImplementation((...args)=>{lines.push(args)});
 vi.spyOn(console,'log').mockImplementation(()=>{});
 vi.spyOn(process,'on').mockImplementation(((event:string,fn:(...a:unknown[])=>unknown)=>{listeners[event]=fn;return process}) as typeof process.on);
 // Capture exit requests without terminating the Vitest process. Production call sites remain unchanged.
 vi.spyOn(process,'exit').mockImplementation(((code?:number)=>{exits.push(code??0);return undefined}) as typeof process.exit);
});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();if(originalVercel===undefined)delete process.env.VERCEL;else process.env.VERCEL=originalVercel});
afterAll(()=>{for(const undo of restore.reverse())undo();syncBuiltinESMExports()});
async function boot(){await import('../src/server.js');await Promise.resolve()}
async function settle(){await Promise.resolve();await Promise.resolve()}
function clean(expected:string){
 expect(lines).toHaveLength(1);
 expect(JSON.stringify(lines)).toContain(expected);
 expect(JSON.stringify(lines)).not.toContain(secret);
 expect(JSON.stringify(lines)).not.toContain('passport');
 expect(lastRead).toBe(0);
}
const hostile=()=>Object.defineProperties({},{
 message:{get(){lastRead++;throw new Error(secret)}},
 stack:{get(){lastRead++;throw new Error(secret)}},
 code:{get(){lastRead++;throw new Error(secret)}},
 toString:{get(){lastRead++;throw new Error(secret)}},
});
describe('OUT-04-A lifecycle boundaries',()=>{
 it('guards precede application imports and reject network',async()=>{await boot();expect(mocks.boundary).toBe(true);expect(attempts).toEqual([]);expect(mocks.listen).toHaveBeenCalledTimes(1)});
 it('environment validation logs a fixed message and requests exit1',async()=>{mocks.validate.mockImplementation(()=>{throw new Error(secret)});await boot();clean('Environment validation failed');expect(exits).toContain(1)});
 it('validation never inspects hostile exceptions',async()=>{mocks.validate.mockImplementation(()=>{throw hostile()});await boot();clean('Environment validation failed')});
 it('disconnect failure stays sanitized and retains exit0',async()=>{mocks.disconnect.mockRejectedValue(new Error(secret));await boot();listeners.SIGTERM();await settle();clean('Error closing database connection');expect(exits).toEqual([0])});
 it('disconnect does not read error getters',async()=>{mocks.disconnect.mockRejectedValue(hostile());await boot();listeners.SIGINT();await settle();clean('Error closing database connection')});
 it('uncaught exception logs safely and initiates shutdown',async()=>{await boot();listeners.uncaughtException(new Error(secret,{cause:{passport:secret}}));await settle();clean('Uncaught Exception');expect(mocks.stop).toHaveBeenCalledTimes(1);expect(mocks.close).toHaveBeenCalledTimes(1)});
 it('uncaught hostile object is never inspected',async()=>{await boot();listeners.uncaughtException(hostile());await settle();clean('Uncaught Exception')});
 it.each([secret,{passport:secret},new Error(secret),null])('arbitrary rejection is sanitized without shutdown: %s',async(reason)=>{await boot();listeners.unhandledRejection(reason);clean('Unhandled Rejection');expect(mocks.stop).not.toHaveBeenCalled();expect(exits).toEqual([])});
 it('rejection getter cannot execute',async()=>{await boot();listeners.unhandledRejection(hostile());clean('Unhandled Rejection')});
 it('development worker retains15s polling',async()=>{await boot();expect(mocks.start).toHaveBeenCalledWith(15000)});
 it.each(['production','test'])('nondevelopment does not start worker: %s',async(mode)=>{mocks.env.nodeEnv=mode;await boot();expect(mocks.start).not.toHaveBeenCalled()});
 it('Vercel does not poll even in development',async()=>{process.env.VERCEL='1';await boot();expect(mocks.start).not.toHaveBeenCalled()});
 it.each(['SIGINT','SIGTERM'])('normal shutdown preserves close/disconnect/exit: %s',async(signal)=>{await boot();listeners[signal]();await settle();expect(mocks.stop).toHaveBeenCalledTimes(1);expect(mocks.disconnect).toHaveBeenCalledTimes(1);expect(exits).toEqual([0])});
 it('forced shutdown retains10s deadline and exit1',async()=>{mocks.close.mockImplementation(()=>{});await boot();listeners.SIGTERM();await vi.advanceTimersByTimeAsync(9999);expect(exits).toEqual([]);await vi.advanceTimersByTimeAsync(1);expect(exits).toEqual([1])});
 it('registers exactly original four lifecycle handlers',async()=>{await boot();expect(Object.keys(listeners).sort()).toEqual(['SIGINT','SIGTERM','uncaughtException','unhandledRejection'].sort())});
 it('entrypoint has only four fixed logging replacements',()=>{const source=readFileSync(resolve(__dirname,'../src/server.ts'),'utf8');expect(source.match(/logger.error\('/g)).toHaveLength(4);expect(source).not.toMatch(/console.error\([^\n]*,\s*(err|error|reason)\)/);expect(source).toContain('void startServer();')});
});
