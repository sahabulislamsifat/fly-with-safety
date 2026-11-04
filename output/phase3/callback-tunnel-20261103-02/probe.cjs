'use strict';
// Transport-only probe. Deliberately has NO app/Prisma/provider imports.
const { classify } = require('../callback-preparation-20261103-01/ingress.cjs');
const body = 'probe=phase3_callback_transport_only';
function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  // Even local requests cannot reach an application: this process has none.
  if (classify(req) !== 'callback') { res.statusCode = 404; res.end(); return; }
  let text = '', ended = false;
  const finish = status => { if (!ended) { ended = true; res.statusCode = status; res.end(); } };
  req.setTimeout(3000, () => { finish(408); req.destroy(); });
  req.on('data', chunk => {
    text += chunk.toString('utf8');
    if (Buffer.byteLength(text) > 256) { finish(413); req.destroy(); }
  });
  req.on('error', () => finish(400));
  req.on('end', () => {
    if (text === body) {
      res.setHeader('X-FWS-Callback-Probe', 'callback-only-no-database');
      finish(204);
    } else finish(400);
  });
}
function plan() {
  const { paths } = require('../callback-preparation-20261103-01/ingress.cjs');
  return [
    ...paths.map(path => ({ method: 'POST', path, status: 204, body })),
    ...paths.map(path => ({ method: 'GET', path, status: 404 })),
    ...['/', '/health', '/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/admin', '/api/v1/bookings', '/api/v1/payments/operations', '/account'].flatMap(path => ['GET', 'POST'].map(method => ({ method, path, status: 404 }))),
    ...[paths[0] + '?x=1', paths[0] + '/', paths[0].toUpperCase()].map(path => ({ method: 'POST', path, body, status: 404 })),
    { method: 'POST', path: paths[0], body: '{}', type: 'application/json', status: 404 },
    { method: 'POST', path: paths[0], body: 'not_the_probe', status: 400 },
    { method: 'POST', path: '/api/v1/auth/login', body, headers: { 'X-Forwarded-Host': 'localhost:5000', Forwarded: 'host=localhost:5000', 'X-Original-URL': paths[0] }, status: 404 },
    { method: 'GET', path: '/api/v1/bookings', headers: { Host: 'localhost:5000', 'X-Forwarded-Host': 'localhost:5000' }, denyOnly: true },
  ];
}
module.exports = { handler, body, plan };
