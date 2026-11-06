'use strict';
// ONE public transport proof only. No credentials, database or merchant traffic.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { handler, plan } = require('./probe.cjs');
const { networkFailure, summary } = require('./diagnostics.cjs');
const { describe, passes } = require('./response-evidence.cjs');
const { classify } = require('../callback-preparation-20261103-01/ingress.cjs');
const { waitForDns, correlatedReady } = require('./readiness.cjs');
const base = __dirname;
const expected = '2493dbc168923bb3e59e5e7716f71deced92992eea9acd6e9d74f84ac7751343';
const write = (name, value) => fs.writeFileSync(path.join(base, name), JSON.stringify(value, null, 2), { flag: 'wx' });
const journal = (event, data = {}) => fs.appendFileSync(path.join(base, 'journal.jsonl'), JSON.stringify({ atUTC: new Date().toISOString(), event, ...data }) + '\n');
const cleanEnv = () => Object.fromEntries(['SystemRoot', 'WINDIR', 'ComSpec', 'TEMP', 'TMP'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
function request(origin, item, correlationId, signal) {
  return new Promise((resolve, reject) => {
    let timer;
    const headers = { ...(item.body ? { 'Content-Type': item.type || 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(item.body) } : {}), ...item.headers, 'X-FWS-Probe-Id': correlationId };
    const req = https.request(new URL(item.path, origin), { method: item.method, headers, timeout: 5000, rejectUnauthorized: true, signal }, res => {
      // Inspect at most8KiB in memory for numeric CF error code; persist no raw body.
      let bytes = 0, chunks = [], settled = false;
      const finish = truncated => {
        if (settled) return; settled = true;
        clearTimeout(timer);
        resolve(describe(res.statusCode, res.headers, Buffer.concat(chunks).toString('utf8'), truncated));
        chunks = []; res.destroy();
      };
      res.on('data', chunk => { const take = chunk.subarray(0, Math.max(0, 8192 - bytes)); chunks.push(take); bytes += take.length; if (bytes >= 8192) finish(true); });
      res.on('end', () => finish(false));
      res.on('error', () => finish(true));
      res.on('aborted', () => finish(true));
    });
    req.on('timeout', () => req.destroy(Object.assign(Error('PROBE_TIMEOUT'), { code: 'PROBE_TIMEOUT' })));
    req.on('error', error => { clearTimeout(timer); reject(Object.assign(Error('PROBE_CONNECTION_FAILED'), { detail: networkFailure(error) })); });
    timer = setTimeout(() => req.destroy(Object.assign(Error('PROBE_TIMEOUT'), { code: 'PROBE_TIMEOUT' })), 5000);
    req.end(item.body);
  });
}
async function main() {
  if (process.argv[2] !== '--owner-approved-dns-gated-proof' || process.argv.length !== 4) throw Error('OWNER_APPROVAL_REQUIRED');
  const binary = process.argv[3];
  if (crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex') !== expected) throw Error('BINARY_HASH_MISMATCH');
  for (const item of JSON.parse(fs.readFileSync(path.join(base, 'pins.json'), 'utf8'))) {
    if (crypto.createHash('sha256').update(fs.readFileSync(path.resolve(base, item.path))).digest('hex') !== item.sha256) throw Error('DEPENDENCY_INTEGRITY_MISMATCH');
  }
  if (['attempt.json', 'result.json', 'checks.json', 'origin.json', 'journal.jsonl'].some(name => fs.existsSync(path.join(base, name)))) throw Error('EXISTING_ATTEMPT_NO_RETRY');
  write('attempt.json', { startedUTC: new Date().toISOString(), scope: 'PUBLIC_TRANSPORT_ONLY_NO_DATABASE' });
  let child, stage = 'bind-local-probe', passed = false, origin, fatal, shutdownFailure = null, childExit = null, dnsReady = null, callbackReady = false;
  const checks = [];
  const receipts = new Map();
  const server = http.createServer((req, res) => {
    const receipt = receipts.get(req.headers['x-fws-probe-id']);
    if (receipt) {
      receipt.reached = true;
      receipt.hostClass = req.headers.host === 'phase3-callback.invalid' ? 'TUNNEL_MARKER' : ['localhost:5000', '127.0.0.1:5000', '[::1]:5000'].includes(req.headers.host) ? 'LOCAL' : 'OTHER';
      receipt.methodMatched = req.method === receipt.method;
      receipt.pathMatched = req.url === receipt.path;
      receipt.guard = classify(req);
      receipt.media = describe(0, req.headers).media;
      receipt.transferEncodingPresent = req.headers['transfer-encoding'] !== undefined;
      journal('origin-received', { index: receipt.index, hostClass: receipt.hostClass, methodMatched: receipt.methodMatched, pathMatched: receipt.pathMatched, guard: receipt.guard, media: receipt.media, transferEncodingPresent: receipt.transferEncodingPresent });
      res.once('finish', () => { receipt.status = res.statusCode; journal('origin-response', { index: receipt.index, status: receipt.status }); });
    }
    handler(req, res);
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000; server.keepAliveTimeout = 1000;
  const publicAbort = new AbortController();
  const deadlineAt = Date.now() + 180000;
  const deadline = setTimeout(() => { fatal = Error('TOTAL_DEADLINE'); publicAbort.abort(); child?.kill(); server.closeAllConnections(); server.close(); }, 180000);
  try {
    await new Promise((resolve, reject) => { server.once('error', () => reject(Error('PORT5000_UNAVAILABLE'))); server.listen(5000, '127.0.0.1', resolve); });
    journal('listener-bound', { address: '127.0.0.1', port: 5000 });
    stage = 'private-loopback-readiness';
    const localId = crypto.randomUUID(), localItem = plan()[0];
    const localReceipt = { index: 0, method: localItem.method, path: localItem.path, reached: false };
    receipts.set(localId, localReceipt);
    const localResponse = await new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port: 5000, path: localItem.path, method: 'POST', headers: { Host: 'phase3-callback.invalid', 'X-FWS-Probe-Id': localId, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(localItem.body) }, timeout: 2000, signal: publicAbort.signal }, res => { res.resume(); res.on('end', () => resolve({ status: res.statusCode, marker: res.headers['x-fws-callback-probe'] === 'callback-only-no-database' })); });
      req.on('timeout', () => req.destroy(Error('LOCAL_READINESS_TIMEOUT'))); req.on('error', () => reject(Error('LOCAL_READINESS_FAILED'))); req.end(localItem.body);
    });
    receipts.delete(localId);
    const localCheck = { passed: localResponse.status === 204 && localResponse.marker, response: localResponse, origin: localReceipt };
    write('loopback-origin-result.json', { passed: correlatedReady(localCheck), publicRequests: 0 });
    if (!correlatedReady(localCheck)) throw Error('LOCAL_READINESS_FAILED');
    stage = 'start-one-temporary-tunnel';
    const profile = path.join(base, 'connector-profile');
    fs.mkdirSync(profile); // no existing owner configuration or credentials inherited
    const env = { ...cleanEnv(), USERPROFILE: profile, HOME: profile, APPDATA: profile, LOCALAPPDATA: profile };
    child = spawn(binary, ['tunnel', '--config', path.join(base, 'connector.yml'), '--no-autoupdate', '--url', 'http://127.0.0.1:5000', '--http-host-header', 'phase3-callback.invalid', '--no-chunked-encoding', '--metrics', '127.0.0.1:0', '--loglevel', 'info', '--management-diagnostics=false'], { env, cwd: profile, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    journal('connector-started', { pid: child.pid ?? null });
    const url = new Promise((resolve, reject) => {
      let tail = ''; let settled = false; let foundOrigin; let registered = false;
      const timer = setTimeout(() => { settled = true; reject(Error('TUNNEL_ORIGIN_TIMEOUT')); }, 60000);
      const onData = chunk => {
        tail = (tail + chunk.toString('utf8')).slice(-8192);
        const match = tail.match(/https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com\b/);
        if (match && !foundOrigin) { foundOrigin = match[0]; journal('origin-discovered', { origin: foundOrigin }); }
        if (!registered && /Registered tunnel connection/.test(tail)) { registered = true; journal('connector-registered'); }
        if (!settled && foundOrigin && registered) { settled = true; clearTimeout(timer); resolve(foundOrigin); }
      };
      child.stdout.on('data', onData); child.stderr.on('data', onData);
      child.once('error', () => { clearTimeout(timer); reject(Error('TUNNEL_PROCESS_START_FAILED')); });
      child.once('exit', (code, signal) => { childExit = code; journal('connector-exit', { code, signal }); if (!settled) { settled = true; clearTimeout(timer); reject(Error('TUNNEL_EXIT_BEFORE_ORIGIN')); } });
    });
    origin = await url;
    // A printed URL is not readiness. No automatic request retry on an edge/HTTP failure.
    write('origin.json', { origin, scope: 'PROBE_ONLY_NOT_APPROVED_MERCHANT_CALLBACK', expiresWhenTunnelStops: true });
    stage = 'dns-readiness';
    dnsReady = await waitForDns(origin, { signal: publicAbort.signal, deadline: deadlineAt, journal });
    write('dns-result.json', dnsReady);
    if (!dnsReady.ready) throw Error('DNS_READINESS_NOT_ESTABLISHED');
    if (fatal || childExit !== null || child.signalCode !== null) throw Error('TUNNEL_STOPPED');
    stage = 'first-correlated-callback';
    for (const [index, item] of plan().entries()) {
      if (fatal || childExit !== null) throw Error('TUNNEL_STOPPED');
      const check = { index: index + 1, method: item.method, path: item.path, expected: item.denyOnly ? 'DENIED' : item.status, observed: null, passed: false };
      checks.push(check); journal('probe-started', check);
      const correlationId = crypto.randomUUID();
      const receipt = { index: index + 1, method: item.method, path: item.path, reached: false };
      receipts.set(correlationId, receipt);
      let observed;
      try { observed = await request(origin, item, correlationId, publicAbort.signal); }
      catch (error) { check.failure = error.detail || networkFailure(error); journal('probe-connection-failed', check); throw error; }
      finally { receipts.delete(correlationId); check.origin = { reached: receipt.reached, hostClass: receipt.hostClass || null, methodMatched: receipt.methodMatched ?? null, pathMatched: receipt.pathMatched ?? null, guard: receipt.guard || null, media: receipt.media || null, transferEncodingPresent: receipt.transferEncodingPresent ?? null, status: receipt.status || null }; }
      check.observed = observed.status;
      check.response = observed;
      check.passed = passes(item, observed);
      if (index === 0) { callbackReady = correlatedReady(check); check.passed = check.passed && callbackReady; }
      journal('probe-response', check);
      if (!check.passed) throw Error('PUBLIC_BOUNDARY_MISMATCH');
      if (index === 0) { journal('callback-readiness-pass'); stage = 'remaining-public-path-checks'; }
    }
    passed = true;
  } catch (error) { fatal ??= error; }
  finally {
    clearTimeout(deadline);
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill();
      await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 5000))]);
      if (child.exitCode === null && child.signalCode === null) { passed = false; shutdownFailure = 'OWNED_TUNNEL_STOP_UNCONFIRMED'; }
    }
    server.closeAllConnections();
    if (server.listening) await new Promise(resolve => server.close(resolve));
    write('checks.json', checks);
    journal('listener-closed', { tunnelStopped: !child || child.exitCode !== null || child.signalCode !== null });
    write('result.json', { passed, stage, failure: fatal ? fatal.message : null, failureDetail: fatal?.detail || null, shutdownFailure, dnsReady: dnsReady?.ready || false, callbackReady, ...summary(checks, plan().length), firstFailedCheck: checks.find(c => !c.passed) || null, connectorPID: child?.pid ?? null, tunnelStopped: !child || child.exitCode !== null || child.signalCode !== null, listenerStopped: !server.listening, databaseAccess: false, merchantCalls: 0, credentialsRead: false, finishedUTC: new Date().toISOString() });
    console.log(passed ? 'PHASE3_PUBLIC_CALLBACK_TRANSPORT_PASS_NOT_PROVIDER_ACCEPTANCE' : 'PHASE3_PUBLIC_CALLBACK_TRANSPORT_STOP_' + stage);
    process.exitCode = passed ? 0 : 1;
  }
}
main().catch(() => { console.error('STOP: pre-execution guard failed; preserve artifacts, no retry'); process.exitCode = 1; });
