'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const { closeFrontend } = require('./frontend-close.cjs');
test('old serial order cannot invoke Next cleanup while HTTP waits on retained connection', async () => {
  let nextCalled = false, callback;
  const server = { closeAllConnections() {}, close(cb) { callback = cb; } };
  const app = { async close() { nextCalled = true; callback(); } };
  const old = (async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); await app.close(); })();
  await Promise.resolve(); assert.equal(nextCalled, false);
  callback(); await old; // release only synthetic fixture, no process/network involved
});
test('Next cleanup may release retained connection before HTTP close completes', async () => {
  let callback; const events = [];
  const server = { close(cb) { events.push('http-close-start'); callback = cb; }, closeAllConnections() { events.push('http-drain'); } };
  const app = { async close() { events.push('next-close-start'); callback(); } };
  await closeFrontend(server, app, e => events.push(e));
  assert.ok(events.indexOf('next-close-start') < events.indexOf('http-closed'));
  assert.ok(events.indexOf('http-close-start') < events.indexOf('http-drain'));
});
test('already non-listening server still cleans Next resources', async () => {
  let nextClosed = false;
  await closeFrontend({ close(cb) { cb({ code: 'ERR_SERVER_NOT_RUNNING' }); }, closeAllConnections() {} }, { async close() { nextClosed = true; } });
  assert.equal(nextClosed, true);
});
test('hung cleanup has bounded diagnostic failure without forced process kill', async () => {
  await assert.rejects(closeFrontend({ close() {}, closeAllConnections() {} }, { close: () => new Promise(() => {}) }, () => {}, 5), /FRONTEND_DRAIN_TIMEOUT/);
});
test('private error message is not emitted by shutdown helper', async () => {
  await assert.rejects(closeFrontend({ close(cb) { cb(); }, closeAllConnections() {} }, { async close() { throw Error('private-value'); } }), /^Error: NEXT_CLOSE_FAILED$/);
});
