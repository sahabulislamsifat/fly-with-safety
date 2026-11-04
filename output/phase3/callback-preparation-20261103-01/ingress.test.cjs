'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classify, paths, tunnelHost, ingress } = require('./ingress.cjs');
const request = (changes = {}) => ({ method: 'POST', url: paths[0], socket: { remoteAddress: '127.0.0.1' }, headers: { host: tunnelHost, 'content-type': 'application/x-www-form-urlencoded', 'content-length': '100' }, ...changes });
for (const url of paths) test('allows only intended form callback: ' + url, () => assert.equal(classify(request({ url })), 'callback'));
for (const url of ['/', '/api/v1/auth/login', '/api/v1/payments/operations', '/health', '/api/v1/bookings', paths[0] + '?x=1', paths[0] + '/', paths[0].toUpperCase(), '/api/v1/payments/sslcommerz/%69pn', '/api/v1/payments/sslcommerz/../ipn', 'https://localhost:5000' + paths[0]]) test('public path denied: ' + url, () => assert.equal(classify(request({ url })), 'deny'));
for (const method of ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']) test('public method denied: ' + method, () => assert.equal(classify(request({ method })), 'deny'));
for (const host of [undefined, 'localhost', 'attacker.invalid', 'localhost:5000.attacker.invalid', tunnelHost + ':5000']) test('unknown Host denied: ' + host, () => assert.equal(classify(request({ headers: { host, 'x-forwarded-host': 'localhost:5000' } })), 'deny'));
for (const host of ['localhost:5000', '127.0.0.1:5000', '[::1]:5000']) test('loopback local app preserved: ' + host, () => assert.equal(classify(request({ url: '/api/v1/auth/login', headers: { host } })), 'local'));
test('non-loopback peer denied even with local Host', () => assert.equal(classify(request({ socket: { remoteAddress: '192.0.2.1' }, headers: { host: 'localhost:5000' } })), 'deny'));
test('forwarded host cannot bypass public boundary', () => assert.equal(classify(request({ url: '/api/v1/auth/login', headers: { host: tunnelHost, 'x-forwarded-host': 'localhost:5000', forwarded: 'host=localhost:5000' } })), 'deny'));
for (const headers of [{ 'content-type': 'application/json' }, { 'content-length': '16385' }, { 'content-length': '-1' }, { 'transfer-encoding': 'chunked' }]) test('rejects body metadata ' + Object.keys(headers)[0] + JSON.stringify(headers), () => assert.equal(classify(request({ headers: { ...request().headers, ...headers } })), 'deny'));
test('permits maximum body length and charset for existing 16kb parser', () => assert.equal(classify(request({ headers: { ...request().headers, 'content-length': '16384', 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' } })), 'callback'));
test('rejection returns empty uncached 404 without dispatch', () => {
  const response = { setHeader(k, v) { assert.equal(k, 'Cache-Control'); assert.equal(v, 'no-store'); }, end(...args) { assert.equal(args.length, 0); } };
  ingress(request({ url: '/health' }), response, () => assert.fail('dispatch forbidden'));
  assert.equal(response.statusCode, 404);
});
