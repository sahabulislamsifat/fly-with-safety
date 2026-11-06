'use strict';
const { execFile } = require('node:child_process');
const path = require('node:path');
const known = new Set(['ENOTFOUND','EAI_AGAIN','ENODATA','ETIMEOUT','DNS_LOOKUP_TIMEOUT']);
function hostname(origin) {
  const u = new URL(origin);
  if (u.protocol !== 'https:' || u.port || u.username || u.password || u.pathname !== '/' || u.search || u.hash || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(u.hostname) || u.hostname.split('.')[0].length > 63) throw Error('GENERATED_ORIGIN_INVALID');
  return u.hostname;
}
function systemLookup(host, timeout, signal) {
  return new Promise(resolve => {
    const env = Object.fromEntries(['SystemRoot','WINDIR','ComSpec','TEMP','TMP'].filter(k => process.env[k]).map(k => [k,process.env[k]]));
    execFile(process.execPath, [path.join(__dirname, 'lookup-once.cjs'), host], { env, timeout, signal, windowsHide: true, maxBuffer: 1024 }, (error, stdout) => {
      if (error?.killed) { resolve({ success: false, code: 'DNS_LOOKUP_TIMEOUT' }); return; }
      try {
        const r = JSON.parse(stdout);
        if (r.success === true && Number.isInteger(r.answers) && r.answers > 0 && Array.isArray(r.families) && r.families.every(f => f === 4 || f === 6)) { resolve({ success: true, answers: r.answers, families: r.families }); return; }
        if (known.has(r.code)) { resolve({ success: false, code: r.code }); return; }
      } catch { /* Never persist child stderr/error messages. */ }
      resolve({ success: false, code: 'DNS_LOOKUP_CHILD_FAILED' });
    });
  });
}
function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(Error('READINESS_ABORTED')); return; }
    const abort = () => { clearTimeout(timer); reject(Error('READINESS_ABORTED')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}
async function waitForDns(origin, { lookup = systemLookup, wait = pause, now = Date.now, signal, deadline = Infinity, journal = () => {} } = {}) {
  const host = hostname(origin), end = Math.min(now() + 30000, deadline);
  let consecutive = 0;
  const observations = [];
  for (let attempt = 1; attempt <= 8 && now() < end; attempt++) {
    if (signal?.aborted) throw Error('READINESS_ABORTED');
    const r = await lookup(host, Math.min(2000, end - now()), signal);
    consecutive = r.success && r.answers > 0 ? consecutive + 1 : 0;
    const event = { attempt, elapsedBudgetRemainingMs: Math.max(0, end - now()), success: consecutive > 0, answers: r.success ? r.answers : 0, families: r.success ? r.families : [], code: r.success ? null : known.has(r.code) ? r.code : 'DNS_LOOKUP_CHILD_FAILED' };
    observations.push(event); journal('dns-observation', event);
    if (signal?.aborted) throw Error('READINESS_ABORTED');
    if (now() >= end) break;
    if (consecutive >= 2) return { ready: true, observations };
    if (!r.success && !known.has(r.code)) break;
    if (attempt < 8 && end - now() >= 2000) await wait(2000, signal); else break;
  }
  return { ready: false, observations };
}
function correlatedReady(check) {
  return check.passed === true && check.response?.status === 204 && check.response.marker === true && check.origin?.reached === true && check.origin.hostClass === 'TUNNEL_MARKER' && check.origin.methodMatched === true && check.origin.pathMatched === true && check.origin.guard === 'callback' && check.origin.status === 204;
}
module.exports = { waitForDns, correlatedReady, hostname };
