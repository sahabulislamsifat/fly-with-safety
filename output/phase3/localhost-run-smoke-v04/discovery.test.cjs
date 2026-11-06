'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inspectLine, reader, trackAllocation } = require('./discovery.cjs');

const address = 'one.lhr.life';
const allocation = (fields = {}) => JSON.stringify({ event: 'tcpip-forward', status: 'success', tls_termination: true, address, ...fields });

test('accepts a typed TLS allocation from split stdout chunks', () => {
  const read = reader(), line = allocation();
  assert.deepEqual(read(line.slice(0, 23)), []);
  assert.deepEqual(read(line.slice(23) + '\r\n'), [{ origin: 'https://one.lhr.life', eventType: 'tcpip-forward', source: 'SSH_STDOUT_JSON' }]);
});

test('retains the exact reviewed TLS text format', () => {
  assert.deepEqual(inspectLine('one.lhr.life tunneled with tls termination, https://one.lhr.life'),
    { origin: 'https://one.lhr.life', eventType: 'tls-termination', source: 'SSH_STDOUT_EXACT_TEXT' });
});

test('same-origin repeat keeps the original fingerprint, new allocation stops', () => {
  const records = [], assign = trackAllocation(record => records.push(record));
  assert.equal(assign(inspectLine(allocation())), 'INITIAL');
  assert.equal(assign(inspectLine(allocation({ address: 'https://one.lhr.life' }))), 'REPEATED');
  assert.throws(() => assign(inspectLine(allocation({ address: 'other.lhr.life' }))), /SSH_ASSIGNED_ORIGIN_CHANGED/);
  assert.equal(records[1].hostFingerprint, records[0].hostFingerprint);
  assert.equal(records[2].pinnedHostFingerprint, records[0].hostFingerprint);
  assert.notEqual(records[2].hostFingerprint, records[0].hostFingerprint);
  assert.equal(records[2].eventType, 'tcpip-forward');
  assert.equal(records[2].source, 'SSH_STDOUT_JSON');
  assert.doesNotMatch(JSON.stringify(records), /lhr\.life/);
});

test('heartbeat and diagnostic URLs cannot become allocations', () => {
  for (const line of [
    JSON.stringify({ type: 'tunnel heartbeat', url: 'https://other.lhr.life' }),
    JSON.stringify({ event: 'heartbeat', message: 'other.lhr.life tunneled with tls termination, https://other.lhr.life' }),
    'diagnostic: other.lhr.life tunneled with tls termination, https://other.lhr.life',
    'tunnel ready https://other.lhr.life',
    JSON.stringify({ event: 'tunnel allocated', url: 'https://other.lhr.life' }),
  ]) assert.equal(inspectLine(line), null);
});

test('rejects malformed, non-TLS and unsafe allocation forms', () => {
  for (const line of [
    allocation({ status: 'failure' }), allocation({ tls_termination: false }), allocation({ tls_termination: 'true' }),
    allocation({ address: null }), allocation({ address: 'http://one.lhr.life' }), allocation({ address: 'admin.localhost.run' }), allocation({ address: '-bad.lhr.life' }),
    allocation({ address: 'https://one.lhr.life/path' }), '{"event":"tcpip-forward",',
    'one.lhr.life tunneled with tls termination, https://one.lhr.life/path',
  ]) assert.throws(() => inspectLine(line), /SSH_ALLOCATION_MALFORMED/);
});

test('rejects contradictory and duplicate allocation identities', () => {
  for (const line of [
    allocation({ url: 'https://other.lhr.life' }), allocation().replace(/}$/, ',"address":"other.lhr.life"}'),
    allocation().replace(/}$/, ',"\\u0061ddress":"other.lhr.life"}'),
    'one.lhr.life tunneled with tls termination, https://other.lhr.life',
  ]) assert.throws(() => inspectLine(line), /SSH_ALLOCATION_AMBIGUOUS/);
});
