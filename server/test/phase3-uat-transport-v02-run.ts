import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { financialAdmission } from './phase3-negative-v01/ingress.js';
import { UatForwardingGuard, watchAllocatedConnector } from './phase3-uat-transport.js';

const repo = resolve(__dirname, '../..');
const base = resolve(repo, 'output/phase3/failed-uat-transport-20261106-02');
const route = '/api/v1/payments/sslcommerz/fail';
const local = createRequire(__filename);
const { sshArgs } = local('../../output/phase3/localhost-run-injection-v01/transport.cjs');
const { reader, trackAllocation } = local('../../output/phase3/localhost-run-smoke-v04/discovery.cjs');
const { diagnostics, stopOwned } = local('../../output/phase3/localhost-run-smoke-v03/ssh-lifecycle.cjs');
const { sshEnvironment } = local('../../output/phase3/localhost-run-smoke/ssh-environment.cjs');

function spoof(origin: string, secure: boolean, nonce: string) {
  const url = new URL(route, origin);
  if (!secure) url.protocol = 'http:';
  return new Promise<{ status: number; location: unknown; marker: unknown }>((done, reject) => {
    const request = (secure ? https : http).request(url, {
      method: 'POST', ...(secure ? { rejectUnauthorized: true, servername: url.hostname } : {}),
      signal: AbortSignal.timeout(5000), headers: { 'x-fws-uat-spoof': nonce,
        'x-forwarded-proto': secure ? 'http' : 'https', forwarded: secure ? 'proto=http' : 'proto=https',
        'content-type': 'application/x-www-form-urlencoded', 'content-length': '0' },
    }, response => {
      done({ status: response.statusCode ?? 0, location: response.headers.location, marker: response.headers['x-fws-uat-spoof'] });
      response.destroy();
    });
    request.once('error', reject);
    request.end();
  });
}

async function main() {
  if (process.argv[2] !== '--owner-approved-transport-v02' || process.env.FWS_TRANSPORT_V02_APPROVED !== 'true' ||
      !existsSync(resolve(base, 'transport-caller-attempt.json'))) throw Error('TRANSPORT_APPROVAL_REQUIRED');
  const save = (name: string, value: object) => writeFileSync(resolve(base, name), JSON.stringify(value, null, 2), { flag: 'wx' });
  const record = (value: object) => appendFileSync(resolve(base, 'transport-journal.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...value }) + '\n');
  save('transport-attempt.json', { scope: 'transport-only', at: new Date().toISOString() });
  const started = performance.now(), finalAt = started + 1_185_000;
  let origin: string | undefined, guard: UatForwardingGuard | undefined, detach: (() => void) | undefined;
  let child: ReturnType<typeof spawn> | undefined, nativeEvidence: unknown, shutdown: Promise<boolean> | undefined;
  let failure: string | undefined, spoofNonce: string | undefined, spoofObserved: boolean | undefined;
  let positive = 0, spoofPassed = 0, firstSample: number | undefined, lastSample: number | undefined, completed = false;
  const stop = (reason: string) => {
    if (failure) return;
    failure = reason;
    guard?.close();
    detach?.();
    shutdown = stopOwned(child);
    record({ kind: 'stop', reason });
  };
  const signal = () => stop('OWNER_INTERRUPTION');
  const deadline = setTimeout(() => stop('TRANSPORT_DEADLINE'), 1_191_000);
  const ownerStop = setInterval(() => { if (existsSync(resolve(base, 'transport-stop.request'))) stop('OWNER_STOP_FILE'); }, 250);
  process.once('SIGINT', signal);
  process.once('SIGTERM', signal);
  const server = http.createServer((req, res) => {
    const proof = guard?.receive(req);
    if (proof && !failure) {
      res.writeHead(204, { 'x-fws-uat-transport': proof, 'cache-control': 'no-store' }).end();
      return;
    }
    if (!failure && spoofNonce && req.headers['x-fws-uat-spoof'] === spoofNonce && req.url === route && req.method === 'POST' && req.headers['content-length'] === '0') {
      const { admitted } = financialAdmission(req, origin);
      spoofObserved = admitted;
      res.writeHead(admitted ? 200 : 404, { 'x-fws-uat-spoof': spoofNonce, 'cache-control': 'no-store' }).end();
      return;
    }
    res.writeHead(404).end();
  });
  const active = () => { if (failure) throw Error(failure); };
  const sleepUntil = async (at: number) => {
    while (performance.now() < at) { active(); await new Promise(r => setTimeout(r, Math.min(250, Math.max(1, at - performance.now())))); }
    active();
  };
  try {
    await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
    const address = server.address();
    if (!address || typeof address === 'string' || [3000, 5000].includes(address.port)) throw Error('ISOLATED_PORT_REQUIRED');
    active();
    const ssh = resolve(process.env.WINDIR || 'C:/Windows', 'System32/OpenSSH/ssh.exe');
    child = spawn(ssh, sshArgs(address.port, resolve(repo, 'output/phase3/localhost-run-smoke/known_hosts')),
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: sshEnvironment(process.env) });
    nativeEvidence = diagnostics(child);
    save('transport-ssh-process.json', { pid: child.pid, loopbackPort: address.port, owned: true });
    await new Promise<void>((done, reject) => {
      const parse = reader(), assign = trackAllocation(record);
      const timer = setTimeout(() => reject(Error('SSH_ALLOCATION_TIMEOUT')), 30_000);
      const fail = (reason: string) => { clearTimeout(timer); reject(Error(reason)); };
      child!.once('error', () => fail('SSH_START_FAILED'));
      child!.once('exit', () => fail('SSH_EXIT_BEFORE_ALLOCATION'));
      child!.stdout!.on('data', chunk => {
        try {
          for (const candidate of parse(chunk)) {
            if (failure) return;
            if (assign(candidate) === 'REPEATED') continue;
            guard = new UatForwardingGuard(candidate.origin, stop, record);
            origin = candidate.origin;
            detach = watchAllocatedConnector(child!, stop);
            clearTimeout(timer);
            record({ kind: 'assigned-origin-validated', https: true, localOnly: true });
            done();
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          const reason = ['SSH_ASSIGNED_ORIGIN_CHANGED', 'SSH_ALLOCATION_MALFORMED', 'SSH_ALLOCATION_AMBIGUOUS', 'READINESS_LINE_LIMIT'].includes(message) ? message : 'SSH_ALLOCATION_EVIDENCE_INVALID';
          if (origin) stop(reason); else fail(reason);
        }
      });
    });
    active();
    const sample = async () => {
      active();
      // Reserve the remaining HTTPS request for the adversarial probe.
      if (positive >= 40) throw Error('APPROVED_HTTPS_CHECK_CAP');
      const dispatched = performance.now();
      await guard!.check(positive === 0 ? 'BEFORE_FIXTURES' : 'CHECKOUT_WATCH');
      firstSample ??= dispatched;
      lastSample = dispatched;
      positive++;
      if (positive === 1 || positive % 10 === 0) console.log(`TRANSPORT_CORRELATED_CHECKS_${positive}`);
    };
    await sample();
    for (const secure of [true, false]) {
      active();
      spoofNonce = randomUUID();
      spoofObserved = undefined;
      const result = await spoof(origin!, secure, spoofNonce).catch(() => { throw Error('SPOOF_PROBE_TRANSPORT_FAILURE'); });
      const originDenied = spoofObserved === false && result.status === 404 && result.marker === spoofNonce;
      const safeRedirect = !secure && spoofObserved === undefined && [301, 302, 307, 308].includes(result.status) && result.location === origin + route;
      record({ kind: 'spoof-check', scheme: secure ? 'HTTPS' : 'HTTP', status: result.status, originSeen: spoofObserved !== undefined, passed: originDenied || safeRedirect });
      spoofNonce = undefined;
      if (!originDenied && !safeRedirect) throw Error(secure ? 'HTTPS_SPOOF_NOT_DENIED' : 'HTTP_SPOOF_NOT_DENIED');
      spoofPassed++;
    }
    const period = (finalAt - firstSample!) / 39;
    for (let index = 1; index < 39; index++) {
      await sleepUntil(firstSample! + index * period);
      await sample();
    }
    await sleepUntil(finalAt);
    await sample();
    active();
    completed = true;
  } catch (error) {
    stop(error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'TRANSPORT_UNCLASSIFIED');
  } finally {
    clearTimeout(deadline);
    clearInterval(ownerStop);
    process.removeListener('SIGINT', signal);
    process.removeListener('SIGTERM', signal);
    guard?.close();
    detach?.();
    const connectorStopped = await (shutdown ?? stopOwned(child));
    server.closeAllConnections();
    await new Promise<void>(done => server.close(() => done()));
    const elapsedMs = Math.round(performance.now() - started);
    const observedSpanMs = firstSample === undefined || lastSample === undefined ? 0 : Math.round(lastSample - firstSample);
    const passed = completed && !failure && connectorStopped && elapsedMs <= 1_200_000 && spoofPassed === 2 && observedSpanMs >= 1_140_000;
    const result = { passed, firstFailure: failure ?? (passed ? null : !connectorStopped ? 'CONNECTOR_SHUTDOWN_UNCONFIRMED' : 'TRANSPORT_WINDOW_UNPROVEN'),
      positiveChecks: positive, spoofPassed, elapsedMs, observedSpanMs, connectorStopped, nativeEvidence, databaseCalls: 0, paymentProviderCalls: 0 };
    save('transport-result.json', result);
    console.log(JSON.stringify(result));
    process.exitCode = passed ? 0 : 1;
  }
}

void main().catch(() => { console.error('STOP: transport-only caller did not complete'); process.exitCode = 1; });
