'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { observation } = require('./allocation-observation.cjs');

test('retains known event shape and acceptance while omitting raw values', () => {
  const log = observation(), value = { event: 'tcpip-forward', status: 'success', tls_termination: true, address: 'private-fixture.lhr.life', message: 'private message' };
  const chunk = JSON.stringify(value);
  assert.deepEqual(log.stdout(chunk.slice(0, 17)), []);
  const [allocation] = log.stdout(chunk.slice(17) + '\r\n');
  assert.equal(allocation.origin, 'https://private-fixture.lhr.life');
  const [row] = log.summary().stdoutShapes;
  assert.equal(row.classification, 'STRICT_ALLOCATION');
  assert.equal(row.event, 'tcpip-forward');
  assert.equal(row.fieldTypes.address, 'string');
  assert.doesNotMatch(JSON.stringify(log.summary()), /private-fixture|private message/);
});

test('unknown events and incomplete lines supply no authority, while malformed allocation preserves the strict error', () => {
  const log = observation();
  assert.deepEqual(log.stdout('{"event":"unverified-schema","address":"candidate.lhr.life"}\n{"unfinished":'), []);
  assert.equal(log.summary().incompleteStdoutLine, true);
  const [row] = log.summary().stdoutShapes;
  assert.equal(row.classification, 'IGNORED');
  assert.equal(row.event, 'OTHER');
  assert.match(row.eventFingerprint, /^[a-f0-9]{16}$/);
  assert.throws(() => log.stdout('false}\n{"event":"tcpip-forward","status":"success","tls_termination":false}\n'), /SSH_ALLOCATION_MALFORMED/);
  assert.equal(log.summary().stdoutShapes.at(-1).classification, 'MALFORMED');
});

test('distinguishes a permission banner from a native rejection-shaped line', () => {
  const log = observation();
  log.stderr('If you see Permission denied, read the help page.\n');
  assert.deepEqual(log.summary().stderrCategories, ['AUTH_TEXT_OBSERVED']);
  log.stderr('nokey@localhost.run: Permission denied (publickey).\r\n');
  assert.ok(log.summary().stderrCategories.includes('SSH_PERMISSION_DENIED_TEXT'));
  assert.doesNotMatch(JSON.stringify(log.summary()), /publickey|nokey@/);
});

test('bounds distinct observations and preserves repeat counts', () => {
  const log = observation();
  for (let i = 0; i < 30; i++) log.stdout(JSON.stringify({ event: `unknown-${i}` }) + '\n');
  log.stdout('{"event":"unknown-0"}\n');
  assert.equal(log.summary().stdoutShapes.length, 24);
  assert.equal(log.summary().stdoutShapes[0].count, 2);
  assert.equal(log.summary().omittedShapes, 6);
});
