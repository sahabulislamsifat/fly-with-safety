'use strict';
// Allowlisted enums/booleans/numeric error codes only. Never serialize raw headers/body.
function describe(status, headers = {}, prefix = '', truncated = false) {
  const type = typeof headers['content-type'] === 'string' ? headers['content-type'].split(';')[0].trim().toLowerCase() : '';
  const media = ['text/html', 'application/json', 'text/plain', 'application/x-www-form-urlencoded'].includes(type) ? type : type ? 'OTHER' : 'ABSENT';
  const errorType = typeof headers['cf-error-type'] === 'string' && /^(?:1\d{3}|52[0-9]|52x)$/.test(headers['cf-error-type']) ? headers['cf-error-type'] : null;
  const text = String(prefix).slice(0, 8192).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const code = /\berror(?:\s+code)?\s*[:=]?\s*(1\d{3})\b/i.exec(text)?.[1] || null;
  return {
    ngrokErrorCode: /\bERR_NGROK_\d{1,8}\b/.exec(String(prefix).slice(0,8192))?.[0] || null,
    possibleBrowserInterstitial: /ERR_NGROK_6024|you are about to visit/i.test(String(prefix).slice(0,8192)),
    status, marker: headers['x-fws-callback-probe'] === 'callback-only-no-database', media,
    serverIsCloudflare: typeof headers.server === 'string' && headers.server.toLowerCase() === 'cloudflare',
    cfRayPresent: typeof headers['cf-ray'] === 'string', cfErrorType: errorType,
    cfErrorOriginPresent: typeof headers['cf-error-origin'] === 'string', cfBodyErrorCode: code,
    challenge: headers['cf-mitigated'] === 'challenge', redirect: status >= 300 && status < 400,
    locationPresent: typeof headers.location === 'string', bodyPrefixTruncated: truncated,
  };
}
function passes(item, observed) {
  // Original policy unchanged: a callback must work, not merely be denied safely.
  return item.denyOnly ? [400, 403, 404, 421].includes(observed.status) : observed.status === item.status && (item.status !== 204 || observed.marker);
}
module.exports = { describe, passes };
