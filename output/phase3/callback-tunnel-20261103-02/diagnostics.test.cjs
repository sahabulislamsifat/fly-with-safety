'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { networkFailure, summary } = require('./diagnostics.cjs');
for (const [code, classification] of [['ENOTFOUND', 'DNS'], ['EAI_AGAIN', 'DNS'], ['EACCES', 'PERMISSION'], ['EPERM', 'PERMISSION'], ['ECONNRESET', 'TCP'], ['ECONNREFUSED', 'TCP'], ['ENETUNREACH', 'TCP'], ['ETIMEDOUT', 'TIMEOUT'], ['PROBE_TIMEOUT', 'TIMEOUT'], ['ERR_TLS_CERT_ALTNAME_INVALID', 'TLS'], ['UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'TLS'], ['CERT_HAS_EXPIRED', 'TLS']]) test('preserves allowlisted ' + code, () => {
  assert.deepEqual(networkFailure({ code, message: 'never-log-this', stack: 'never-log-stack' }), { classification, codes: [code] });
});
test('unknown strings and private error metadata are never serialized', () => {
  const e = { code: 'secret-like-string', message: 'private-connection-url', hostname: 'private-host', path: 'private-query', cause: { code: 'another-secret' } };
  assert.deepEqual(networkFailure(e), { classification: 'NETWORK_UNCLASSIFIED', codes: [] });
});
test('nested native AggregateError codes preserved without raw messages', () => assert.deepEqual(networkFailure({ cause: { code: 'ECONNRESET' }, errors: [{ code: 'ETIMEDOUT' }, { code: 'ECONNRESET' }] }), { classification: 'TCP', codes: ['ECONNRESET', 'ETIMEDOUT'] }));
test('one failed connection is one failed attempted probe and thirty untouched', () => assert.deepEqual(summary([{ observed: null, passed: false }], 31), { attempted: 1, completedHttp: 0, pass: 0, fail: 1, unexecuted: 30 }));
test('HTTP mismatch is recorded distinctly from a connection failure', () => assert.deepEqual(summary([{ observed: 502, passed: false }], 31), { attempted: 1, completedHttp: 1, pass: 0, fail: 1, unexecuted: 30 }));
test('all passing responses preserve the original 31 requirement', () => assert.deepEqual(summary(Array.from({ length: 31 }, () => ({ observed: 204, passed: true })), 31), { attempted: 31, completedHttp: 31, pass: 31, fail: 0, unexecuted: 0 }));
