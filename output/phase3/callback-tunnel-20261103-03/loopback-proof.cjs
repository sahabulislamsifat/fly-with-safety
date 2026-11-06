'use strict';
// Local transport verification only; NEVER imports runner/cloudflared/app/DB/provider.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handler, plan } = require('./probe.cjs');
const { describe, passes } = require('./response-evidence.cjs');
async function main() {
  const result = path.join(__dirname, 'loopback-result.json');
  if (fs.existsSync(result)) throw Error('EXISTING_LOCAL_PROOF_PRESERVE_RESULT');
  const server = http.createServer(handler), checks = [];
  let failure = null;
  try {
    await new Promise((resolve, reject) => { server.once('error', () => reject(Error('PORT5000_UNAVAILABLE'))); server.listen(5000, '127.0.0.1', resolve); });
    for (const [index, item] of plan().entries()) {
      const observed = await new Promise((resolve, reject) => {
        const headers = { Host: 'phase3-callback.invalid', ...(item.body ? { 'Content-Type': item.type || 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(item.body) } : {}), ...item.headers };
        const req = http.request({ hostname: '127.0.0.1', port: 5000, path: item.path, method: item.method, headers, timeout: 3000 }, res => {
          const evidence = describe(res.statusCode, res.headers); res.resume(); resolve(evidence);
        });
        req.on('error', () => reject(Error('LOOPBACK_CONNECTION_FAILED'))); req.on('timeout', () => req.destroy(Error('LOOPBACK_TIMEOUT'))); req.end(item.body);
      });
      checks.push({ index: index + 1, method: item.method, path: item.path, status: observed.status, passed: passes(item, observed) });
      if (!checks.at(-1).passed) throw Error('LOOPBACK_BOUNDARY_MISMATCH');
    }
  } catch (error) { failure = error.message; }
  finally {
    server.closeAllConnections(); if (server.listening) await new Promise(resolve => server.close(resolve));
    const record = { passed: !failure && checks.length === 31, failure, pass: checks.filter(c => c.passed).length, fail: checks.filter(c => !c.passed).length, unexecuted: 31 - checks.length, listenerStopped: !server.listening, publicRequests: 0, databaseAccess: false, checks };
    fs.writeFileSync(result, JSON.stringify(record, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ ...record, checks: undefined })); process.exitCode = record.passed ? 0 : 1;
  }
}
main().catch(() => { console.error('STOP: local proof precondition failed'); process.exitCode = 1; });
