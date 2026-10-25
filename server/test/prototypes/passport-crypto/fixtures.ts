import type { EncryptionContext, SyntheticGrant, SyntheticPassengerDocumentV1 } from './contracts.js';
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
    throw new Error('D1_OFFLINE_BOUNDARY');
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

export const context: EncryptionContext = Object.freeze({ environmentId: 'synthetic-offline', bookingId: 'synthetic-booking-1', passengerId: 'synthetic-passenger-1' });
export const document: SyntheticPassengerDocumentV1 = Object.freeze({ passportNumber: 'SYNTHETIC-NOT-A-PASSPORT-9912', passportExpiry: '2032-02-29', dateOfBirth: '2000-02-29' });
export const nowMs = Date.UTC(2030, 0, 1);
export const grant: SyntheticGrant = Object.freeze({ actorId: 'synthetic-operator', role: 'FULFILLMENT',
  ...context, purpose: 'synthetic-fulfillment', expiresAtMs: nowMs + 60_000, stepUpVerified: true });

export const sensitiveSentinels = Object.freeze([document.passportNumber!, document.dateOfBirth!, document.passportExpiry!, 'SYNTHETIC-KEY-SENTINEL', 'SYNTHETIC-TOKEN-SENTINEL']);
