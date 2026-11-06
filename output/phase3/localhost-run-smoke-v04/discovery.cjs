'use strict';
const { createHash } = require('node:crypto');
const { publicOrigin } = require('../localhost-run-smoke/transport.cjs');

const label = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const host = `${label}(?:\\.${label})+`;
const bareHost = new RegExp(`^${host}$`);
const httpsHost = new RegExp(`^https://${host}$`);
const tlsLine = new RegExp(`^(${host}) tunneled with tls termination, (https://${host})$`);
const tlsPrefix = new RegExp(`^${host} tunneled with tls termination,`);
const reserved = new Set(['admin.localhost.run', 'www.localhost.run', 'docs.localhost.run', 'status.localhost.run']);
const addresses = ['address', 'listen_host', 'url', 'public_url', 'publicUrl'];
const allocationKeys = new Set(['event', 'status', 'tls_termination', ...addresses]);

function endpoint(value) {
  if (typeof value !== 'string' || (!bareHost.test(value) && !httpsHost.test(value))) throw Error('SSH_ALLOCATION_MALFORMED');
  try {
    const origin = publicOrigin(bareHost.test(value) ? `https://${value}` : value);
    const hostname = new URL(origin).hostname;
    if (hostname.length > 253 || reserved.has(hostname)) throw Error();
    return origin;
  } catch { throw Error('SSH_ALLOCATION_MALFORMED'); }
}

function inspectLine(line) {
  line = line.trim();
  if (line.startsWith('{')) {
    let event;
    try { event = JSON.parse(line); }
    catch {
      if (/"event"\s*:\s*"tcpip-forward"/.test(line)) throw Error('SSH_ALLOCATION_MALFORMED');
      return null;
    }
    if (event?.event !== 'tcpip-forward') return null;
    const keys = [...line.matchAll(/[,{]\s*("(?:\\.|[^"\\])*")\s*:/g)]
      .map(match => JSON.parse(match[1])).filter(key => allocationKeys.has(key));
    if (new Set(keys).size !== keys.length) throw Error('SSH_ALLOCATION_AMBIGUOUS');
    if (event.status !== 'success' || event.tls_termination !== true) throw Error('SSH_ALLOCATION_MALFORMED');
    const origins = new Set(addresses.filter(key => Object.hasOwn(event, key)).map(key => endpoint(event[key])));
    if (origins.size > 1) throw Error('SSH_ALLOCATION_AMBIGUOUS');
    if (origins.size !== 1) throw Error('SSH_ALLOCATION_MALFORMED');
    return { origin: origins.values().next().value, eventType: 'tcpip-forward', source: 'SSH_STDOUT_JSON' };
  }
  const match = tlsLine.exec(line);
  if (!match) {
    if (tlsPrefix.test(line)) throw Error('SSH_ALLOCATION_MALFORMED');
    return null;
  }
  const origin = endpoint(match[2]);
  if (endpoint(match[1]) !== origin) throw Error('SSH_ALLOCATION_AMBIGUOUS');
  return { origin, eventType: 'tls-termination', source: 'SSH_STDOUT_EXACT_TEXT' };
}

function reader() {
  let buffer = '';
  return chunk => {
    buffer += chunk.toString('utf8');
    if (buffer.length > 32768) throw Error('READINESS_LINE_LIMIT');
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();
    return lines.map(inspectLine).filter(Boolean);
  };
}

function trackAllocation(record) {
  let origin;
  return candidate => {
    const fingerprint = value => createHash('sha256').update(new URL(value).hostname).digest('hex').slice(0, 16);
    const outcome = !origin ? 'INITIAL' : candidate.origin === origin ? 'REPEATED' : 'CHANGED';
    record({ kind: 'ssh-allocation-candidate', eventType: candidate.eventType, source: candidate.source, outcome,
      hostFingerprint: fingerprint(candidate.origin), ...(origin ? { pinnedHostFingerprint: fingerprint(origin) } : {}) });
    if (outcome === 'CHANGED') throw Error('SSH_ASSIGNED_ORIGIN_CHANGED');
    if (outcome === 'INITIAL') origin = candidate.origin;
    return outcome;
  };
}

module.exports = { inspectLine, reader, trackAllocation };
