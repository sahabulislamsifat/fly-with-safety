import { describe, expect, it } from 'vitest';
import { disposableTarget } from './p5-disposable-target.js';
const settings = () => ({ P5_DISPOSABLE_EXECUTION_APPROVED: 'true', P5_DISPOSABLE_DATABASE_URL: 'postgresql://p5_tester:synthetic@127.0.0.1:5432/flywithsafety_p5_disposable_example', P5_EXPECTED_DATABASE: 'flywithsafety_p5_disposable_example', P5_EXPECTED_ROLE: 'p5_tester', P5_EXPECTED_OID: '99999' });
describe('Disposable PostgreSQL execution boundary (pure, no connections)', () => {
  it('accepts explicitly designated disposable loopback target', () => { expect(disposableTarget(settings()).oid).toBe(99999); });
  it('requires separate execution approval', () => { expect(() => disposableTarget({ ...settings(), P5_DISPOSABLE_EXECUTION_APPROVED: '' })).toThrow('APPROVAL_REQUIRED'); });
  it('rejects the protected Phase3 database OID', () => { expect(() => disposableTarget({ ...settings(), P5_EXPECTED_OID: '34701' })).toThrow('TARGET_REJECTED'); });
  it.each(['postgresql://p5_tester:synthetic@cloud.example.invalid/flywithsafety_p5_disposable_example', 'postgresql://p5_tester:synthetic@127.0.0.1/flywithsafety_local_integration', 'postgresql://postgres:synthetic@127.0.0.1/flywithsafety_p5_disposable_example', 'postgresql://p5_tester:synthetic@127.0.0.1/flywithsafety_p5_disposable_example?host=cloud.example.invalid'])('rejects unsafe target %s', url => { expect(() => disposableTarget({ ...settings(), P5_DISPOSABLE_DATABASE_URL: url })).toThrow('TARGET_REJECTED'); });
  it('never falls back to normal DATABASE_URL', () => { expect(() => disposableTarget({ P5_DISPOSABLE_EXECUTION_APPROVED: 'true', DATABASE_URL: settings().P5_DISPOSABLE_DATABASE_URL })).toThrow(); });
  const designated = () => ({ ...settings(), P5_DISPOSABLE_DATABASE_URL: 'postgresql://fws_p5_identity_app:synthetic@127.0.0.1:5432/flywithsafety_p5_identity_scope_test', P5_EXPECTED_DATABASE: 'flywithsafety_p5_identity_scope_test', P5_EXPECTED_ROLE: 'fws_p5_identity_app' });
  it('accepts the newly designated exact database/application-role pair', () => { expect(disposableTarget(designated())).toMatchObject({ database: 'flywithsafety_p5_identity_scope_test', role: 'fws_p5_identity_app' }); });
  it('does not mix a legacy role into the newly designated database', () => { expect(() => disposableTarget({ ...designated(), P5_DISPOSABLE_DATABASE_URL: designated().P5_DISPOSABLE_DATABASE_URL.replace('fws_p5_identity_app', 'p5_tester'), P5_EXPECTED_ROLE: 'p5_tester' })).toThrow('TARGET_REJECTED'); });
  it('rejects a different port for the designated target', () => { expect(() => disposableTarget({ ...designated(), P5_DISPOSABLE_DATABASE_URL: designated().P5_DISPOSABLE_DATABASE_URL.replace(':5432/', ':5544/') })).toThrow('TARGET_REJECTED'); });
});
