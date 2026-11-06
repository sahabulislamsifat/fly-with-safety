import { randomUUID } from 'node:crypto';
import type { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import https from 'node:https';
import { financialAdmission } from './phase3-negative-v01/ingress.js';

const probePath = '/api/v1/payments/sslcommerz/fail';
const probeHeader = 'x-fws-uat-transport';
type Reply = { status: number; marker: unknown };
type Probe = (url: URL, nonce: string) => Promise<Reply>;

export function probeHTTPS(url: URL, nonce: string): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: 'POST', rejectUnauthorized: true, servername: url.hostname,
      signal: AbortSignal.timeout(5000),
      headers: { [probeHeader]: nonce, 'content-type': 'application/x-www-form-urlencoded', 'content-length': '0' },
    }, response => {
      const status = response.statusCode ?? 0, marker = response.headers[probeHeader];
      // Only headers are evidence. Do not download or interpret an edge error page.
      resolve({ status, marker });
      response.destroy();
    });
    request.once('error', reject);
    request.end();
  });
}

export class UatForwardingGuard {
  private pending?: { nonce: string; observed: boolean };
  private checks = 0;
  private closed = false;
  private readonly origin: string;

  constructor(origin: string, private readonly stop: (reason: string) => void,
    private readonly record: (event: object) => void, private readonly probe: Probe = probeHTTPS) {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.port || url.origin !== origin || !/^([a-z0-9-]+\.)+(lhr\.life|localhost\.run)$/.test(url.hostname)) {
      throw Error('UNAPPROVED_CALLBACK_ORIGIN');
    }
    this.origin = origin;
  }

  /** The existing ingress policy is mandatory even for the in-memory probe nonce. */
  receive(request: IncomingMessage): string | undefined {
    const p = this.pending;
    if (this.closed || !p || p.observed || request.url !== probePath || request.headers[probeHeader] !== p.nonce ||
      request.headers['content-length'] !== '0' || !financialAdmission(request, this.origin).admitted) return undefined;
    p.observed = true;
    return p.nonce;
  }

  async check(stage: 'BEFORE_FIXTURES' | 'BEFORE_INITIATION' | 'CHECKOUT_WATCH' | 'BEFORE_RECONCILIATION') {
    if (this.closed || this.pending) throw Error('FORWARDING_CHECK_UNAVAILABLE');
    if (this.checks >= 70) return this.fail(stage, 'FORWARDING_PROBE_CAP');
    this.checks++;
    const p = { nonce: randomUUID(), observed: false };
    this.pending = p;
    try {
      let reply: Reply;
      try { reply = await this.probe(new URL(probePath, this.origin), p.nonce); }
      catch { return this.fail(stage, 'FORWARDING_HTTPS_FAILURE'); }
      if (this.closed) throw Error('FORWARDING_CHECK_STOPPED');
      if (!p.observed || reply.status !== 204 || reply.marker !== p.nonce) {
        return this.fail(stage, 'FORWARDING_ORIGIN_NOT_CORRELATED', reply.status);
      }
      this.record({ kind: 'forwarding-proof', stage, status: 204, originCorrelated: true });
    } finally { this.pending = undefined; }
  }

  close() { this.closed = true; }

  private fail(stage: string, reason: string, httpStatus?: number): never {
    this.close();
    this.record({ kind: 'forwarding-proof', stage, reason, httpStatus, originCorrelated: false });
    this.stop(reason);
    throw Error(reason);
  }
}

export function watchAllocatedConnector(child: Pick<EventEmitter, 'once' | 'removeListener'>, stop: (reason: string) => void) {
  const exit = () => stop('SSH_EXIT_AFTER_ALLOCATION');
  const error = () => stop('SSH_ERROR_AFTER_ALLOCATION');
  child.once('exit', exit);
  child.once('error', error);
  return () => { child.removeListener('exit', exit); child.removeListener('error', error); };
}
