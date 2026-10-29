import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';



const mocks=vi.hoisted(()=>({boundary:false,probe:vi.fn(),create:vi.fn(),findUnique:vi.fn(),updateMany:vi.fn(),findMany:vi.fn(),send:vi.fn(()=>{throw new Error('SMTP_FORBIDDEN')}),render:vi.fn(()=>{throw new Error('RENDER_FORBIDDEN')})}));
vi.mock('../src/lib/prisma.js',()=>{if(!mocks.boundary)throw new Error('IMPORT_BEFORE_GUARDS');return {prisma:{$queryRawUnsafe:mocks.probe,notificationOutbox:{create:mocks.create,findUnique:mocks.findUnique,updateMany:mocks.updateMany,findMany:mocks.findMany}}}});
vi.mock('../src/services/notification.service.js',()=>{if(!mocks.boundary)throw new Error('IMPORT_BEFORE_GUARDS');return {sendEmailRaw:mocks.send,renderNotificationContent:mocks.render}});
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




const secret='SYNTHETIC-OUTBOX-CLASSIFICATION-991';
let outbox:typeof import('../src/services/outbox.service.js');
let logging:typeof import('../src/lib/logger.js');
beforeAll(async()=>{installGuards();expect(()=>net.connect(1,'127.0.0.1')).toThrow('OUT04_OFFLINE_BOUNDARY');attempts.length=0;outbox=await import('../src/services/outbox.service.js');logging=await import('../src/lib/logger.js');});
beforeEach(()=>{
 vi.useFakeTimers();vi.clearAllMocks();outbox.setOutboxTableAvailable(null);
 mocks.probe.mockReset().mockResolvedValue([]);mocks.create.mockReset();mocks.findUnique.mockReset();mocks.findMany.mockReset();mocks.updateMany.mockReset();
 vi.spyOn(logging.logger,'warn').mockImplementation(()=>{});vi.spyOn(logging.logger,'error').mockImplementation(()=>{});
});
afterEach(()=>{expect(attempts).toEqual([]);expect(mocks.send).not.toHaveBeenCalled();expect(mocks.render).not.toHaveBeenCalled();vi.useRealTimers();vi.restoreAllMocks();outbox.setOutboxTableAvailable(null);});
afterAll(()=>{for(const undo of restore.reverse())undo();syncBuiltinESMExports();});
const empty={processed:0,delivered:0,failed:0,recovered:0};
describe('OUT error classification and storage admission — mocks only',()=>{
 it('retains a healthy storage probe and positive cache',async()=>{
  expect(await outbox.isOutboxTableAvailable()).toBe(true);expect(await outbox.isOutboxTableAvailable()).toBe(true);expect(mocks.probe).toHaveBeenCalledTimes(1);
 });
 it.each([{code:'42P01'},{code:'P2010',meta:{code:'42P01'}}])('recognizes typed missing-table evidence %# and bounded negative cache',async error=>{
  mocks.probe.mockRejectedValueOnce(error);
  expect(await outbox.isOutboxTableAvailable()).toBe(false);expect(await outbox.isOutboxTableAvailable()).toBe(false);expect(mocks.probe).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(30001);expect(await outbox.isOutboxTableAvailable()).toBe(true);expect(mocks.probe).toHaveBeenCalledTimes(2);
 });
 it.each([new Error('does not exist '+secret),{code:'P1001'},{code:'P2010',meta:{code:'42501'}}])('does not classify arbitrary text/permission/connect errors as absent storage %#',async error=>{
  mocks.probe.mockRejectedValueOnce(error);await expect(outbox.isOutboxTableAvailable()).rejects.toBe(error);
  expect(await outbox.isOutboxTableAvailable()).toBe(true);expect(mocks.probe).toHaveBeenCalledTimes(2);
 });
 it('never invokes unknown code/meta getters or Proxy traps during probing',async()=>{
  let reads=0;const fail=()=>{reads++;throw new Error(secret);};
  const own=Object.defineProperties({},{code:{get:fail},meta:{get:fail}});
  const nested={meta:Object.defineProperty({},'code',{get:fail})};
  const proxy=new Proxy({},{get:fail,has:fail,getOwnPropertyDescriptor:fail});
  for(const error of [own,nested,proxy]){outbox.setOutboxTableAvailable(null);mocks.probe.mockRejectedValueOnce(error);await expect(outbox.isOutboxTableAvailable()).rejects.toBe(error);}
  expect(reads).toBe(0);
 });
 it('preserves duplicate-key lookup and transactional return without non-durable send',async()=>{
  outbox.setOutboxTableAvailable(true);const record={id:'synthetic-job',status:'PENDING'};
  mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(record);mocks.create.mockRejectedValueOnce({code:'P2002'});
  const tx={notificationOutbox:{create:mocks.create,findUnique:mocks.findUnique}};
  expect(await outbox.enqueueNotification(tx,{recipient:'synthetic@example.invalid',subject:'synthetic',template:'CONTACT_CONFIRMATION',params:{},idempotencyKey:'synthetic-key'})).toBe(record);
  expect(mocks.findUnique).toHaveBeenCalledTimes(2);expect(mocks.create).toHaveBeenCalledTimes(1);
 });
 it('rethrows a transactional enqueue failure without getter invocation or fallback',async()=>{
  outbox.setOutboxTableAvailable(true);let reads=0;const error=Object.defineProperty({},'code',{get(){reads++;throw new Error(secret);}});
  mocks.findUnique.mockResolvedValueOnce(null);mocks.create.mockRejectedValueOnce(error);
  const tx={notificationOutbox:{create:mocks.create,findUnique:mocks.findUnique}};
  await expect(outbox.enqueueNotification(tx,{recipient:'synthetic@example.invalid',subject:'synthetic',template:'CONTACT_CONFIRMATION',params:{},idempotencyKey:'synthetic-key'})).rejects.toBe(error);
  expect(reads).toBe(0);expect(logging.logger.error).toHaveBeenCalledWith('outbox_transactional_enqueue_failed',{name:'OperationError'});
 });
 it.each([{code:'P2021'},{code:'42P01'},{meta:{code:'42P01'}}])('retains typed batch missing-storage handling %#',async error=>{
  outbox.setOutboxTableAvailable(true);mocks.updateMany.mockRejectedValueOnce(error);
  expect(await outbox.processOutboxBatch()).toEqual(empty);expect(logging.logger.warn).not.toHaveBeenCalled();
 });
 it('does not inspect raw message/accessor metadata in batch failure classification',async()=>{
  outbox.setOutboxTableAvailable(true);let reads=0;const error=Object.defineProperties({},{code:{get(){reads++;throw new Error(secret);}},message:{get(){reads++;throw new Error(secret);}}});
  mocks.updateMany.mockRejectedValueOnce(error);expect(await outbox.processOutboxBatch()).toEqual(empty);
  expect(reads).toBe(0);expect(logging.logger.warn).toHaveBeenCalledWith('outbox_batch_processing_error',{name:'OperationError'});
 });
 it('keeps explicit throwOnError failure semantics instead of concealing a batch error',async()=>{
  outbox.setOutboxTableAvailable(true);const error={code:'P2021'};mocks.updateMany.mockRejectedValueOnce(error);
  await expect(outbox.processOutboxBatch(3,{throwOnError:true})).rejects.toBe(error);
 });
});
