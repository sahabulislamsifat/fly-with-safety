import { expect, it } from 'vitest';
import { assertDisposableTarget, assertPhase1hTarget } from './integration-target.mjs';
const url = 'postgresql://synthetic:synthetic@127.0.0.1:5432/synthetic_integration';
const safe = () => ({ RUN_IDEMPOTENCY_INTEGRATION: 'true', EMAIL_DELIVERY_ENABLED: 'false',
  APPROVED_DISPOSABLE_DATABASE: 'synthetic_integration', DATABASE_URL: url, DIRECT_URL: url, INTEGRATION_TEST_DATABASE_URL: url });
const phaseUrl = url.replace('synthetic_integration', 'flywithsafe_phase1h_integration');
const phaseSafe = () => ({ ...safe(), RUN_RELIABILITY_INTEGRATION: 'true',
  APPROVED_DISPOSABLE_DATABASE: 'flywithsafe_phase1h_integration',
  DATABASE_URL: phaseUrl, DIRECT_URL: phaseUrl, INTEGRATION_TEST_DATABASE_URL: phaseUrl });
it('accepts only the approved Phase 1H endpoint without connecting', () => {
  expect(assertPhase1hTarget(phaseSafe())).toBe(phaseUrl);
});
it.each(['remote.example', 'localhost', '127.1', '2130706433', '[::1]'])('rejects Phase 1H host %s', host => {
  const candidate = phaseUrl.replace('127.0.0.1', host);
  expect(() => assertPhase1hTarget({ ...phaseSafe(), DATABASE_URL: candidate, DIRECT_URL: candidate, INTEGRATION_TEST_DATABASE_URL: candidate })).toThrow();
});
it.each(['flywithsafe_integration', 'other_integration'])('rejects even explicitly approved alternate database %s', name => {
  const candidate = phaseUrl.replace('flywithsafe_phase1h_integration', name);
  expect(() => assertPhase1hTarget({ ...phaseSafe(), APPROVED_DISPOSABLE_DATABASE: name, DATABASE_URL: candidate, DIRECT_URL: candidate, INTEGRATION_TEST_DATABASE_URL: candidate })).toThrow();
});
it.each(['5433', ''])('rejects wrong or implicit Phase 1H port %s', port => {
  const candidate = phaseUrl.replace(':5432', port ? `:${port}` : '');
  expect(() => assertPhase1hTarget({ ...phaseSafe(), DATABASE_URL: candidate, DIRECT_URL: candidate, INTEGRATION_TEST_DATABASE_URL: candidate })).toThrow();
});
it.each(['RUN_RELIABILITY_INTEGRATION', 'RUN_IDEMPOTENCY_INTEGRATION', 'EMAIL_DELIVERY_ENABLED',
  'APPROVED_DISPOSABLE_DATABASE', 'DATABASE_URL', 'DIRECT_URL', 'INTEGRATION_TEST_DATABASE_URL'])('requires Phase 1H %s', key => {
  const env = phaseSafe(); delete (env as Record<string, string>)[key];
  expect(() => assertPhase1hTarget(env)).toThrow();
});
it('accepts an explicitly approved matching loopback configuration without connecting', () => {
  expect(assertDisposableTarget(safe())).toBe(url);
});
it.each(['RUN_IDEMPOTENCY_INTEGRATION', 'EMAIL_DELIVERY_ENABLED', 'APPROVED_DISPOSABLE_DATABASE',
  'DATABASE_URL', 'DIRECT_URL', 'INTEGRATION_TEST_DATABASE_URL'])('rejects missing %s', key => {
  const env = safe(); delete (env as Record<string, string>)[key]; expect(() => assertDisposableTarget(env)).toThrow();
});
it.each(['postgresql://synthetic:synthetic@remote.example/synthetic_integration',
  'postgresql://synthetic:synthetic@localhost/synthetic_integration',
  `${url}?host=remote.example`, `${url}#override`, url.replace('synthetic_integration', 'postgres')])('rejects unsafe targets', candidate => {
  const env = { ...safe(), DATABASE_URL: candidate, DIRECT_URL: candidate, INTEGRATION_TEST_DATABASE_URL: candidate };
  expect(() => assertDisposableTarget(env)).toThrow();
});
