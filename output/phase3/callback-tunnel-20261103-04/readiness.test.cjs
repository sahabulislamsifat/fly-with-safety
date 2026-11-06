'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const { waitForDns, correlatedReady, hostname } = require('./readiness.cjs');
const ok = { success: true, answers: 1, families: [4] }, bad = { success: false, code: 'ENOTFOUND' };
function clock(sequence, perLookup = 0) {
  let time = 0, count = 0;
  return { get count() { return count; }, now: () => time, wait: async ms => { time += ms; }, lookup: async (_h, timeout) => { assert.ok(timeout <= 2000); time += perLookup; return sequence[Math.min(count++, sequence.length - 1)]; } };
}
test('two consecutive DNS successes required after propagation-like fixture', async () => { const c = clock([bad, ok, ok]); const r = await waitForDns('https://synthetic-test.trycloudflare.com', c); assert.equal(r.ready, true); assert.equal(c.count, 3); });
test('isolated success resets across lookup failure', async () => { const c = clock([ok, bad, ok, ok]); assert.equal((await waitForDns('https://synthetic-test.trycloudflare.com', c)).ready, true); assert.equal(c.count, 4); });
test('persistent DNS failure stops at eight observations, no public request', async () => { const c = clock([bad]); const r = await waitForDns('https://synthetic-test.trycloudflare.com', c); assert.equal(r.ready, false); assert.equal(c.count, 8); });
test('30second deadline bounds slow DNS fixture', async () => { const c = clock([bad], 2000); const r = await waitForDns('https://synthetic-test.trycloudflare.com', c); assert.equal(r.ready, false); assert.ok(c.now() <= 30000); });
test('global remaining budget takes precedence over DNS budget', async () => { const c = clock([bad], 2000); assert.equal((await waitForDns('https://synthetic-test.trycloudflare.com', { ...c, deadline: 2500 })).ready, false); assert.equal(c.count, 1); });
test('late second success does not bypass deadline', async () => { const c = clock([ok], 2000); assert.equal((await waitForDns('https://synthetic-test.trycloudflare.com', { ...c, deadline: 5000 })).ready, false); });
test('resolver child/protocol error fails closed immediately', async () => { const c = clock([{ success: false, code: 'PRIVATE-UNKNOWN' }]); const r = await waitForDns('https://synthetic-test.trycloudflare.com', c); assert.equal(r.ready, false); assert.equal(c.count, 1); assert.equal(r.observations[0].code, 'DNS_LOOKUP_CHILD_FAILED'); });
test('aborted lookup gate performs no lookup', async () => { const c = clock([ok]), a = new AbortController(); a.abort(); await assert.rejects(waitForDns('https://synthetic-test.trycloudflare.com', { ...c, signal: a.signal }), /READINESS_ABORTED/); assert.equal(c.count, 0); });
test('empty DNS answers cannot establish readiness', async () => { const c = clock([{ success: true, answers: 0, families: [] }]); assert.equal((await waitForDns('https://synthetic-test.trycloudflare.com', c)).ready, false); });
for (const origin of ['http://synthetic.trycloudflare.com','https://localhost','https://synthetic.trycloudflare.com/path','https://synthetic.trycloudflare.com/?query=1','https://user:pass@synthetic.trycloudflare.com','https://synthetic.trycloudflare.com:5000']) test('origin rejected: ' + origin, () => assert.throws(() => hostname(origin)));
const ready = () => ({ passed: true, response: { status: 204, marker: true }, origin: { reached: true, hostClass: 'TUNNEL_MARKER', methodMatched: true, pathMatched: true, guard: 'callback', status: 204 } });
test('first callback requires matching real origin receipt', () => assert.equal(correlatedReady(ready()), true));
for (const key of ['reached','methodMatched','pathMatched']) test('missing origin ' + key + ' blocks remaining thirty', () => { const c = ready(); c.origin[key] = false; assert.equal(correlatedReady(c), false); });
test('204 forged marker without origin cannot open gate', () => { const c = ready(); delete c.origin; assert.equal(correlatedReady(c), false); });
for (const status of [401,404,530]) test('positive callback HTTP' + status + ' fails readiness', () => { const c = ready(); c.response.status = status; assert.equal(correlatedReady(c), false); });
