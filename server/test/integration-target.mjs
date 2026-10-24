/** Configuration checks only: this module never connects, migrates, or cleans data. */
export const phase1hDatabase = 'flywithsafe_phase1h_integration';

/** The 16-case suite is approved for one exact local endpoint, never the preserved database. */
export function assertPhase1hTarget(env) {
  const target = assertDisposableTarget(env);
  if (env.RUN_RELIABILITY_INTEGRATION !== 'true' ||
      env.APPROVED_DISPOSABLE_DATABASE !== phase1hDatabase ||
      !/^postgres(?:ql)?:\/\/[^/?#@]+@127\.0\.0\.1:5432\/flywithsafe_phase1h_integration$/.test(target)) {
    throw new Error('Phase 1H requires both opt-ins and the exact approved 127.0.0.1:5432 disposable database.');
  }
  return target;
}

export function assertDisposableTarget(env) {
  if (env.RUN_IDEMPOTENCY_INTEGRATION !== 'true' || env.EMAIL_DELIVERY_ENABLED !== 'false') {
    throw new Error('Integration tests require explicit opt-in and disabled email.');
  }
  let url;
  try { url = new URL(env.INTEGRATION_TEST_DATABASE_URL); } catch {
    throw new Error('A valid disposable PostgreSQL integration target is required.');
  }
  const name = url.pathname.slice(1);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['127.0.0.1', '[::1]'].includes(url.hostname) || url.search || url.hash ||
      !/^[A-Za-z0-9_]+_integration$/.test(name) ||
      env.APPROVED_DISPOSABLE_DATABASE !== name) {
    throw new Error('Approve an exact disposable *_integration database on a literal loopback address; URL overrides are forbidden.');
  }
  if (env.DATABASE_URL !== env.INTEGRATION_TEST_DATABASE_URL || env.DIRECT_URL !== env.INTEGRATION_TEST_DATABASE_URL) {
    throw new Error('Runtime, CLI and integration targets must match the approved local URL exactly.');
  }
  return env.INTEGRATION_TEST_DATABASE_URL;
}
