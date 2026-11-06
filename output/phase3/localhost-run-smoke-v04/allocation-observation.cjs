'use strict';
const { createHash } = require('node:crypto');
const { inspectLine } = require('./discovery.cjs');

const fields = ['event', 'type', 'status', 'tls_termination', 'address', 'listen_host', 'url', 'public_url', 'publicUrl', 'message', 'msg'];
const knownEvents = new Set(['tcpip-forward', 'cancel-tcpip-forward', 'forwarded-tcpip', 'heartbeat', 'keepalive', 'auth', 'login', 'tunnel allocated']);
const knownStatuses = new Set(['success', 'failure', 'error', 'ready']);
const fingerprint = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
const fieldType = value => value === null ? 'NULL' : Array.isArray(value) ? 'ARRAY' : typeof value;

function shape(line) {
  let item;
  try { item = JSON.parse(line); } catch { return { format: line.trimStart().startsWith('{') ? 'INVALID_JSON' : 'TEXT' }; }
  if (!item || typeof item !== 'object' || Array.isArray(item)) return { format: 'NON_OBJECT_JSON' };
  const event = item.event;
  return { format: 'OBJECT_JSON',
    event: knownEvents.has(event) ? event : typeof event === 'string' ? 'OTHER' : 'ABSENT_OR_NON_STRING',
    ...(typeof event === 'string' && !knownEvents.has(event) ? { eventFingerprint: fingerprint(event) } : {}),
    status: knownStatuses.has(item.status) ? item.status : 'ABSENT_OR_OTHER',
    tlsTermination: typeof item.tls_termination === 'boolean' ? item.tls_termination : 'ABSENT_OR_NON_BOOLEAN',
    fieldTypes: Object.fromEntries(fields.filter(key => Object.hasOwn(item, key)).map(key => [key, fieldType(item[key])])) };
}

function observation() {
  const summaries = new Map();
  let buffer = '', omittedShapes = 0;
  const stderr = new Set();
  let stderrTail = '';
  const collect = value => {
    const key = JSON.stringify(value);
    if (summaries.has(key)) summaries.get(key).count++;
    else if (summaries.size < 24) summaries.set(key, { ...value, count: 1 });
    else omittedShapes++;
  };
  return {
    stdout(chunk) {
      buffer += chunk.toString('utf8');
      if (buffer.length > 32768) { collect({ classification: 'READINESS_LINE_LIMIT' }); throw Error('READINESS_LINE_LIMIT'); }
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      const candidates = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const candidate = inspectLine(line);
          collect({ ...shape(line), classification: candidate ? 'STRICT_ALLOCATION' : 'IGNORED' });
          if (candidate) candidates.push(candidate);
        } catch (error) {
          collect({ ...shape(line), classification: error.message === 'SSH_ALLOCATION_AMBIGUOUS' ? 'AMBIGUOUS' : 'MALFORMED' });
          throw error;
        }
      }
      return candidates;
    },
    stderr(chunk) {
      stderrTail = (stderrTail + chunk.toString('utf8')).slice(-2048);
      if (/^Host key verification failed\.?\r?$/m.test(stderrTail)) stderr.add('HOST_KEY_VERIFICATION_FAILED_TEXT');
      if (/^(?:[^\s]+@)?localhost\.run: Permission denied \([^\r\n]+\)\.?\r?$/m.test(stderrTail)) stderr.add('SSH_PERMISSION_DENIED_TEXT');
      if (/^Error: remote port forwarding failed\b/m.test(stderrTail)) stderr.add('REMOTE_FORWARD_REJECTED_TEXT');
      if (/Permission denied|authentication failed/i.test(stderrTail)) stderr.add('AUTH_TEXT_OBSERVED');
    },
    summary() {
      return { stdoutShapes: [...summaries.values()], omittedShapes, incompleteStdoutLine: buffer.trim().length > 0, stderrCategories: [...stderr] };
    },
  };
}

module.exports = { observation };
