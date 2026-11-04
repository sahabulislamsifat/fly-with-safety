'use strict';
// ONE public transport proof only. No credentials, database or merchant traffic.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { handler, plan } = require('./probe.cjs');
const base = __dirname;
const expected = '2493dbc168923bb3e59e5e7716f71deced92992eea9acd6e9d74f84ac7751343';
const write = (name, value) => fs.writeFileSync(path.join(base, name), JSON.stringify(value, null, 2), { flag: 'wx' });
const cleanEnv = () => Object.fromEntries(['SystemRoot', 'WINDIR', 'ComSpec', 'TEMP', 'TMP'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
function request(origin, item) {
  return new Promise((resolve, reject) => {
    const headers = { ...(item.body ? { 'Content-Type': item.type || 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(item.body) } : {}), ...item.headers };
    const req = https.request(new URL(item.path, origin), { method: item.method, headers, timeout: 5000, rejectUnauthorized: true }, res => {
      // Status/header evidence only; never read or persist a public response body.
      resolve({ status: res.statusCode, marker: res.headers['x-fws-callback-probe'] === 'callback-only-no-database' });
      res.destroy();
    });
    req.on('timeout', () => req.destroy(Error('PROBE_TIMEOUT')));
    req.on('error', () => reject(Error('PROBE_CONNECTION_FAILED')));
    req.end(item.body);
  });
}
async function main() {
  if (process.argv[2] !== '--owner-approved-public-transport-only' || process.argv.length !== 4) throw Error('OWNER_APPROVAL_REQUIRED');
  const binary = process.argv[3];
  if (crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex') !== expected) throw Error('BINARY_HASH_MISMATCH');
  for (const item of JSON.parse(fs.readFileSync(path.join(base, 'pins.json'), 'utf8'))) {
    if (crypto.createHash('sha256').update(fs.readFileSync(path.resolve(base, item.path))).digest('hex') !== item.sha256) throw Error('DEPENDENCY_INTEGRITY_MISMATCH');
  }
  if (['attempt.json', 'result.json', 'checks.json', 'origin.json'].some(name => fs.existsSync(path.join(base, name)))) throw Error('EXISTING_ATTEMPT_NO_RETRY');
  write('attempt.json', { startedUTC: new Date().toISOString(), scope: 'PUBLIC_TRANSPORT_ONLY_NO_DATABASE' });
  let child, stage = 'bind-local-probe', passed = false, origin, fatal, childExit = null;
  const checks = [];
  const server = http.createServer(handler);
  server.requestTimeout = 5000; server.headersTimeout = 5000; server.keepAliveTimeout = 1000;
  const deadline = setTimeout(() => { fatal = Error('TOTAL_DEADLINE'); child?.kill(); server.closeAllConnections(); server.close(); }, 180000);
  try {
    await new Promise((resolve, reject) => { server.once('error', () => reject(Error('PORT5000_UNAVAILABLE'))); server.listen(5000, '127.0.0.1', resolve); });
    stage = 'start-one-temporary-tunnel';
    const profile = path.join(base, 'connector-profile');
    fs.mkdirSync(profile); // no existing owner configuration or credentials inherited
    const env = { ...cleanEnv(), USERPROFILE: profile, HOME: profile, APPDATA: profile, LOCALAPPDATA: profile };
    child = spawn(binary, ['tunnel', '--config', path.join(base, 'connector.yml'), '--no-autoupdate', '--url', 'http://127.0.0.1:5000', '--http-host-header', 'phase3-callback.invalid', '--no-chunked-encoding', '--metrics', '127.0.0.1:0', '--loglevel', 'info', '--management-diagnostics=false'], { env, cwd: profile, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const url = new Promise((resolve, reject) => {
      let tail = ''; let settled = false; let foundOrigin; let registered = false;
      const timer = setTimeout(() => { settled = true; reject(Error('TUNNEL_ORIGIN_TIMEOUT')); }, 60000);
      const onData = chunk => {
        tail = (tail + chunk.toString('utf8')).slice(-8192);
        const match = tail.match(/https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com\b/);
        if (match) foundOrigin = match[0];
        if (/Registered tunnel connection/.test(tail)) registered = true;
        if (!settled && foundOrigin && registered) { settled = true; clearTimeout(timer); resolve(foundOrigin); }
      };
      child.stdout.on('data', onData); child.stderr.on('data', onData);
      child.once('error', () => { clearTimeout(timer); reject(Error('TUNNEL_PROCESS_START_FAILED')); });
      child.once('exit', code => { childExit = code; if (!settled) { settled = true; clearTimeout(timer); reject(Error('TUNNEL_EXIT_BEFORE_ORIGIN')); } });
    });
    origin = await url;
    // A printed URL is not readiness. No automatic request retry on an edge/HTTP failure.
    write('origin.json', { origin, scope: 'PROBE_ONLY_NOT_APPROVED_MERCHANT_CALLBACK', expiresWhenTunnelStops: true });
    stage = 'public-path-checks';
    for (const [index, item] of plan().entries()) {
      if (fatal || childExit !== null) throw Error('TUNNEL_STOPPED');
      const observed = await request(origin, item);
      const pass = item.denyOnly ? [400, 403, 404, 421].includes(observed.status) : observed.status === item.status && (item.status !== 204 || observed.marker);
      checks.push({ index: index + 1, method: item.method, path: item.path, expected: item.denyOnly ? 'DENIED' : item.status, observed: observed.status, passed: pass });
      if (!pass) throw Error('PUBLIC_BOUNDARY_MISMATCH');
    }
    passed = true;
  } catch (error) { fatal = error; }
  finally {
    clearTimeout(deadline);
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill();
      await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 5000))]);
      if (child.exitCode === null && child.signalCode === null) { passed = false; fatal = Error('OWNED_TUNNEL_STOP_UNCONFIRMED'); }
    }
    server.closeAllConnections();
    if (server.listening) await new Promise(resolve => server.close(resolve));
    write('checks.json', checks);
    write('result.json', { passed, stage, failure: fatal ? fatal.message : null, pass: checks.filter(c => c.passed).length, fail: checks.filter(c => !c.passed).length, unexecuted: plan().length - checks.length, connectorPID: child?.pid ?? null, tunnelStopped: !child || child.exitCode !== null || child.signalCode !== null, databaseAccess: false, merchantCalls: 0, credentialsRead: false, finishedUTC: new Date().toISOString() });
    console.log(passed ? 'PHASE3_PUBLIC_CALLBACK_TRANSPORT_PASS_NOT_PROVIDER_ACCEPTANCE' : 'PHASE3_PUBLIC_CALLBACK_TRANSPORT_STOP_' + stage);
    process.exitCode = passed ? 0 : 1;
  }
}
main().catch(() => { console.error('STOP: pre-execution guard failed; preserve artifacts, no retry'); process.exitCode = 1; });
