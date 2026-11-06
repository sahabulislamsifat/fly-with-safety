'use strict';
// Test-host-only boundary. Mount BEFORE the real app, CORS, auth and body parsers.
// cloudflared MUST overwrite Host with this marker; forwarded headers are ignored.
const tunnelHost = 'phase3-callback.invalid';
const paths = Object.freeze(['success', 'fail', 'cancel', 'ipn'].map(s => '/api/v1/payments/sslcommerz/' + s));
function classify(req) {
  const host = req.headers.host;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return 'deny';
  if (host === tunnelHost) {
    if (req.method !== 'POST' || !paths.includes(req.url)) return 'deny';
    if (!/^application\/x-www-form-urlencoded(?:\s*;.*)?$/i.test(req.headers['content-type'] || '')) return 'deny';
    if (req.headers['transfer-encoding']) return 'deny';
    const size = req.headers['content-length'];
    if (size !== undefined && (!/^\d{1,5}$/.test(size) || Number(size) > 16384)) return 'deny';
    return 'callback';
  }
  if (['localhost:5000', '127.0.0.1:5000', '[::1]:5000'].includes(host)) return 'local';
  return 'deny';
}
function ingress(req, res, next) {
  if (classify(req) !== 'deny') return next();
  res.statusCode = 404;
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}
module.exports = { tunnelHost, paths, classify, ingress };
