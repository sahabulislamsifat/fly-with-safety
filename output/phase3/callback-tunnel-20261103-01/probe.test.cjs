'use strict';
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const assert = require('node:assert/strict');
const { handler, plan, body } = require('./probe.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
function invoke(item, host = 'phase3-callback.invalid') {
  const req = Object.assign(new EventEmitter(), {
    socket: { remoteAddress: '127.0.0.1' }, url: item.path, method: item.method,
    headers: { host, 'content-type': item.type || 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(item.body || '')), ...Object.fromEntries(Object.entries(item.headers || {}).map(([k, v]) => [k.toLowerCase(), v])) },
    setTimeout(ms, cb) { this.timer = cb; assert.equal(ms, 3000); }, destroy() { this.destroyed = true; },
  });
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end() { this.ended = true; } };
  handler(req, res);
  if (!res.ended) { req.emit('data', Buffer.from(item.body || '')); req.emit('end'); }
  return { req, res };
}
for (const [index, item] of plan().entries()) test('transport probe plan case ' + (index + 1), () => {
  const { res } = invoke(item);
  assert.equal(res.statusCode, item.denyOnly ? 404 : item.status);
  assert.equal(res.ended, true);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  if (item.status === 204) assert.equal(res.headers['X-FWS-Callback-Probe'], 'callback-only-no-database');
  else assert.equal(res.headers['X-FWS-Callback-Probe'], undefined);
});
test('even local Host has no application/credential endpoint', () => assert.equal(invoke({ method: 'POST', path: '/api/v1/auth/login', body }, 'localhost:5000').res.statusCode, 404));
test('probe requires the fixed synthetic body; real callback data cannot be processed', () => assert.equal(invoke({ method: 'POST', path: '/api/v1/payments/sslcommerz/ipn', body: 'tran_id=never-process&status=VALID' }).res.statusCode, 400));
test('large received body fails closed before any app dispatch', () => {
  const { req, res } = invoke({ method: 'POST', path: '/api/v1/payments/sslcommerz/ipn', body: 'x'.repeat(257) });
  assert.equal(res.statusCode, 413); assert.equal(req.destroyed, true);
});
test('plan contains exactly four successful callback probes and no credentials', () => {
  assert.equal(plan().filter(item => item.status === 204).length, 4);
  assert.equal(plan().length, 31);
  assert.equal(plan().some(item => /password|store_passwd|Authorization|Cookie/i.test(JSON.stringify(item))), false);
});
test('runner without explicit approval fails before attempt creation or tunnel spawn', () => {
  const child = spawnSync(process.execPath, [path.join(__dirname, 'run.cjs')], { encoding: 'utf8', timeout: 5000 });
  assert.equal(child.status, 1);
  assert.match(child.stderr, /pre-execution guard failed/);
  for (const name of ['attempt.json', 'result.json', 'checks.json', 'origin.json', 'connector-profile']) assert.equal(fs.existsSync(path.join(__dirname, name)), false);
});
