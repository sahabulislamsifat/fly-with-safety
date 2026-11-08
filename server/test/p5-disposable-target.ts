/** Pure target guard. Never discovers DATABASE_URL, DIRECT_URL or private files. */
export function disposableTarget(values: NodeJS.ProcessEnv) {
  if (values.P5_DISPOSABLE_EXECUTION_APPROVED !== 'true') throw Error('P5_DISPOSABLE_APPROVAL_REQUIRED');
  const url = new URL(values.P5_DISPOSABLE_DATABASE_URL || '');
  const database = decodeURIComponent(url.pathname.slice(1)), role = decodeURIComponent(url.username), oid = Number(values.P5_EXPECTED_OID);
  const namedTarget = database === 'flywithsafety_p5_identity_scope_test' && role === 'fws_p5_identity_app' && url.hostname === '127.0.0.1' && (url.port || '5432') === '5432';
  const legacyDisposable = /^flywithsafety_p5_disposable_[a-z0-9_]{1,40}$/.test(database) && /^p5_[a-z0-9_]{1,50}$/.test(role);
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.search || url.hash ||
    !(namedTarget || legacyDisposable) || database !== values.P5_EXPECTED_DATABASE ||
    role !== values.P5_EXPECTED_ROLE || !url.password ||
    !Number.isSafeInteger(oid) || oid <= 0 || oid === 34701) throw Error('P5_DISPOSABLE_TARGET_REJECTED');
  return { connectionString: url.href, database, role, oid };
}
