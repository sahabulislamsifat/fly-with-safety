'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { describe, passes } = require('./response-evidence.cjs');
const { handler, plan } = require('./probe.cjs');
const { EventEmitter } = require('node:events');
test('saved v02 status530 remains FAIL for positive callback; body/source unknown without evidence', () => {
  const actual = describe(530);
  assert.equal(passes(plan()[0], actual), false);
  assert.equal(actual.media, 'ABSENT'); assert.equal(actual.cfBodyErrorCode, null);
  assert.equal(actual.serverIsCloudflare, false);
});
test('synthetic Cloudflare HTML preserves numeric code but no raw page or headers', () => {
  const actual = describe(530, { 'content-type': 'text/html; charset=UTF-8', server: 'cloudflare', 'cf-ray': 'not-saved', 'cf-error-type': '1033', 'cf-error-origin': 'not-saved', 'set-cookie': 'do-not-save' }, '<h1>Error code: <span>1033</span></h1><p>never-persist-this</p>');
  assert.equal(actual.cfBodyErrorCode, '1033'); assert.equal(actual.cfErrorType, '1033'); assert.equal(actual.media, 'text/html');
  assert.equal(actual.serverIsCloudflare, true); assert.equal(actual.cfRayPresent, true);
  assert.doesNotMatch(JSON.stringify(actual), /never-persist|not-saved|do-not-save/);
});
test('challenge and redirect are classified without recording Location', () => {
  const actual = describe(302, { 'cf-mitigated': 'challenge', location: 'https://private.invalid/?token=do-not-store', 'content-type': 'text/html' });
  assert.equal(actual.redirect, true); assert.equal(actual.challenge, true); assert.equal(actual.locationPresent, true);
  assert.doesNotMatch(JSON.stringify(actual), /private|token/); assert.equal(passes(plan()[0], actual), false);
});
test('JSON metadata and unknown header values do not become invented CF causes', () => {
  const actual = describe(530, { 'content-type': 'application/json', 'cf-error-type': 'unexpected-private-value' }, '{"unrelated":1033}');
  assert.equal(actual.cfErrorType, null); assert.equal(actual.cfBodyErrorCode, null); assert.equal(actual.media, 'application/json');
});
test('204 without exact marker cannot pass', () => assert.equal(passes(plan()[0], describe(204)), false));
test('530 is not quietly added as an allowed denial', () => assert.equal(passes(plan().find(p => p.denyOnly), describe(530)), false));
for (const [index, item] of plan().entries()) test('unchanged guard/handler policy ' + (index + 1), () => {
  const req = Object.assign(new EventEmitter(), { method: item.method, url: item.path, socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'phase3-callback.invalid', 'content-type': item.type || 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(item.body || '')), ...Object.fromEntries(Object.entries(item.headers || {}).map(([k, v]) => [k.toLowerCase(), v])) }, setTimeout() {}, destroy() {} });
  const res = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end() { this.ended = true; } };
  handler(req, res); if (!res.ended) { req.emit('data', Buffer.from(item.body || '')); req.emit('end'); }
  assert.equal(passes(item, describe(res.statusCode, res.headers)), true);
  assert.notEqual(res.statusCode, 530);
});
