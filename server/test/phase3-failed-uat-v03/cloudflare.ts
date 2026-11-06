import { randomUUID } from 'node:crypto';
import https from 'node:https';
import type { IncomingMessage } from 'node:http';
import { createRequire } from 'node:module';

const local = createRequire(__filename);
const { classify, tunnelHost } = local('../../../output/phase3/callback-preparation-20261103-01/ingress.cjs');
const { hostname } = local('../../../output/phase3/callback-tunnel-20261103-06/readiness.cjs');
const route = '/api/v1/payments/sslcommerz/fail';
const header = 'x-fws-uat-transport';

export function cloudflareAdmission(req: IncomingMessage) {
  if (classify(req) !== 'callback' || req.headers.host !== tunnelHost || req.headers['x-forwarded-proto'] !== 'https') return false;
  const count = (key: string) => req.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === key).length;
  const forwarded = req.headers.forwarded;
  // Cloudflare overwrites XFP. A separately supplied Forwarded value has no authority.
  return count('host') === 1 && count('x-forwarded-proto') === 1 && count('content-length') === 1 &&
    forwarded === undefined && count('forwarded') === 0;
}

export function cloudflareArgs(port: number, config: string) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || [3000, 5000].includes(port)) throw Error('ISOLATED_PORT_REQUIRED');
  return ['tunnel', '--config', config, '--no-autoupdate', '--url', `http://127.0.0.1:${port}`, '--http-host-header', tunnelHost,
    '--no-chunked-encoding', '--metrics', '127.0.0.1:0', '--loglevel', 'info', '--management-diagnostics=false'];
}

export function cloudflareOriginReader() {
  let tail = '', origin: string | undefined, registered = false;
  return (chunk: Buffer) => {
    tail = (tail + chunk.toString('utf8')).slice(-8192);
    const matches = tail.matchAll(/https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com\b/g);
    for (const [candidate] of matches) {
      hostname(candidate);
      if (origin && origin !== candidate) throw Error('CLOUDFLARE_ORIGIN_CHANGED');
      origin = candidate;
    }
    registered ||= tail.includes('Registered tunnel connection');
    return registered ? origin : undefined;
  };
}

type Probe = (url: URL, nonce: string) => Promise<{ status: number; marker: unknown }>;
const request: Probe = (url, nonce) => new Promise((resolve, reject) => {
  const req = https.request(url, { method: 'POST', rejectUnauthorized: true, servername: url.hostname, signal: AbortSignal.timeout(5000),
    headers: { [header]: nonce, 'x-forwarded-proto': 'http', 'content-type': 'application/x-www-form-urlencoded', 'content-length': '3' },
  }, res => {
    resolve({ status: res.statusCode ?? 0, marker: res.headers[header] });
    res.destroy();
  });
  req.once('error', reject);
  req.end('x=1');
});

export class CloudflareForwarding {
  private pending?: { nonce: string; reached: boolean };
  private checks = 0;
  private closed = false;

  constructor(private readonly origin: string, private readonly stop: (reason: string) => void,
    private readonly record: (value: object) => void, private readonly probe: Probe = request) { hostname(origin); }

  receive(req: IncomingMessage) {
    const pending = this.pending;
    if (this.closed || !pending || pending.reached || req.url !== route || req.headers[header] !== pending.nonce ||
      req.headers['content-length'] !== '3' || !cloudflareAdmission(req)) return undefined;
    pending.reached = true;
    return pending.nonce;
  }

  async check(stage: 'BEFORE_FIXTURES' | 'CHECKOUT_WATCH') {
    if (this.closed || this.pending) throw Error('FORWARDING_CHECK_UNAVAILABLE');
    if (this.checks >= 70) return this.fail(stage, 'FORWARDING_PROBE_CAP');
    this.checks++;
    const pending = { nonce: randomUUID(), reached: false };
    this.pending = pending;
    try {
      let response;
      try { response = await this.probe(new URL(route, this.origin), pending.nonce); }
      catch (error) {
        const code = (error as { code?: string })?.code;
        return this.fail(stage, 'CLOUDFLARE_HTTPS_CHECK_FAILED', undefined, code && /^(ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ABORT_ERR|ERR_TLS_CERT_ALTNAME_INVALID|CERT_HAS_EXPIRED|UNABLE_TO_VERIFY_LEAF_SIGNATURE)$/.test(code) ? code : 'OTHER');
      }
      if (this.closed) throw Error('FORWARDING_CHECK_STOPPED');
      if (!pending.reached || response.status !== 204 || response.marker !== pending.nonce) return this.fail(stage, 'CLOUDFLARE_ORIGIN_NOT_CORRELATED', response.status);
      this.record({ kind: 'forwarding-proof', stage, status: 204, originCorrelated: true, forwardedHttpsVerified: true });
    } finally { this.pending = undefined; }
  }

  close() { this.closed = true; }

  private fail(stage: string, reason: string, status?: number, detail?: string): never {
    this.close();
    this.record({ kind: 'forwarding-proof', stage, reason, status, detail, originCorrelated: false });
    this.stop(reason);
    throw Error(reason);
  }
}
