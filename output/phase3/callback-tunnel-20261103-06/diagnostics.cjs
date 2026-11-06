'use strict';
// Only fixed network/TLS codes may leave an Error object. No raw message/stack/URL.
const groups = Object.freeze({
  ENOTFOUND: 'DNS', EAI_AGAIN: 'DNS', EAI_FAIL: 'DNS',
  EACCES: 'PERMISSION', EPERM: 'PERMISSION',
  ECONNREFUSED: 'TCP', ECONNRESET: 'TCP', ECONNABORTED: 'TCP', ENETUNREACH: 'TCP', EHOSTUNREACH: 'TCP',
  ETIMEDOUT: 'TIMEOUT', ESOCKETTIMEDOUT: 'TIMEOUT', PROBE_TIMEOUT: 'TIMEOUT',
  ERR_TLS_CERT_ALTNAME_INVALID: 'TLS', CERT_HAS_EXPIRED: 'TLS', CERT_NOT_YET_VALID: 'TLS',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'TLS', UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'TLS',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'TLS', SELF_SIGNED_CERT_IN_CHAIN: 'TLS',
  ERR_SSL_WRONG_VERSION_NUMBER: 'TLS', ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR: 'TLS',
});
function networkFailure(error) {
  const candidates = [error, error?.cause, ...(Array.isArray(error?.errors) ? error.errors.slice(0, 8) : [])];
  const codes = [...new Set(candidates.map(e => e?.code).filter(code => typeof code === 'string' && Object.hasOwn(groups, code)))];
  return { classification: codes.length ? groups[codes[0]] : 'NETWORK_UNCLASSIFIED', codes };
}
function summary(checks, planned) {
  return { attempted: checks.length, completedHttp: checks.filter(c => Number.isInteger(c.observed)).length,
    pass: checks.filter(c => c.passed === true).length, fail: checks.filter(c => c.passed === false).length,
    unexecuted: planned - checks.length };
}
module.exports = { networkFailure, summary };
