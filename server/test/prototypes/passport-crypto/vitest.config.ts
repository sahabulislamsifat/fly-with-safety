import { defineConfig } from 'vitest/config';
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

export default defineConfig({
  root: __dirname,
  envDir: false,
  test: {
    include: ['passport-crypto.test.ts', 'boundaries.test.ts'],
    setupFiles: ['./fixtures.ts'],
    globalSetup: [],
    environment: 'node',
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
    isolate: true,
    watch: false,
    cache: false,
    coverage: { enabled: false },
    testTimeout: 5000,
    hookTimeout: 5000,
  },
});
