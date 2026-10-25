import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

export const offlineBoundary = { installed: false, attempts: [] as string[] };

/** Called by the fixture setup before Vitest loads either test module. */
export function installOfflineGuards(): void {
  if (offlineBoundary.installed) return;
  const block = (label: string) => () => {
    offlineBoundary.attempts.push(label);
    throw new Error('D3_OFFLINE_BOUNDARY');
  };
  const replace = (target: object, key: string, label: string) => {
    Object.defineProperty(target, key, { configurable: true, writable: true, value: block(label) });
  };
  for (const key of ['connect', 'createConnection']) replace(net, key, `net.${key}`);
  replace(net.Socket.prototype, 'connect', 'net.Socket.connect');
  replace(tls, 'connect', 'tls.connect');
  for (const [label, target] of [['http', http], ['https', https]] as const) {
    for (const key of ['get', 'request']) replace(target, key, `${label}.${key}`);
    replace(target.Agent.prototype, 'createConnection', `${label}.Agent.createConnection`);
  }
  for (const key of Object.keys(dns)) {
    if (key === 'lookup' || key === 'lookupService' || key === 'reverse' || key.startsWith('resolve')) {
      if (typeof Reflect.get(dns, key) === 'function') replace(dns, key, `dns.${key}`);
      if (typeof Reflect.get(dns.promises, key) === 'function') replace(dns.promises, key, `dns.promises.${key}`);
    }
  }
  replace(dgram, 'createSocket', 'dgram.createSocket');
  for (const key of ['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork']) replace(childProcess, key, `child_process.${key}`);
  replace(globalThis, 'fetch', 'fetch');
  if ('WebSocket' in globalThis) replace(globalThis, 'WebSocket', 'WebSocket');
  syncBuiltinESMExports();
  offlineBoundary.installed = true;
}



// This is also the standalone config's safety setup: no tested runtime module imports.
installOfflineGuards();


export const nowMs = Date.UTC(2030,0,1);
export const context = Object.freeze({environmentId:'synthetic-offline',messageId:'synthetic-message-1',tokenRecordId:'synthetic-token-1',userId:'synthetic-user-1',purpose:'EMAIL_VERIFY' as const});
export const token = 'SYNTHETIC_' + 'Q'.repeat(64);
export const payload = Object.freeze({templateVersion:2 as const,purpose:context.purpose,messageId:context.messageId,tokenRecordId:context.tokenRecordId,userId:context.userId,recipient:'traveler@example.invalid',issuedAt:new Date(nowMs).toISOString(),expiresAt:new Date(nowMs+3600000).toISOString(),token});
export const grant = Object.freeze({workerId:'synthetic-worker',environmentId:context.environmentId,messageId:context.messageId,tokenRecordId:context.tokenRecordId,purpose:context.purpose,role:'AUTH_DELIVERY_WORKER' as const,expiresAtMs:nowMs+3600000});
export const request = Object.freeze({issuanceId:'synthetic-issuance',environmentId:context.environmentId,userId:context.userId,purpose:context.purpose,expectedAccountRevision:0,expectedPurposeRevision:0,expiresAtMs:nowMs+3600000,createAccount:Object.freeze({recipient:payload.recipient})});
export function deferred<T>() { let resolve!:(v:T)=>void; let reject!:(e:unknown)=>void; const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject}; }
export const observed = <T>(p:Promise<T>) => p.then(value=>({value}), (error:unknown)=>({error}));
export const flush = async () => { for(let i=0;i<20;i++)await Promise.resolve(); };
