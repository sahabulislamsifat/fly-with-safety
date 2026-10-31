import {describe, expect, it} from 'vitest';
import {mkdtempSync, readFileSync, readdirSync, rmdirSync, unlinkSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {appendProofCheckpoint, faultFailureLabel, faultSourceLocations, publishScenarioOutcome, safeFaultEvidence} from './phase1-proof-journal.js';
import type {FaultEvidence} from './phase1-fault.integration.js';

function temporary(work: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'fws-proof-journal-offline-'));
  try {work(dir);} finally {for (const name of readdirSync(dir)) unlinkSync(join(dir, name)); rmdirSync(dir);}
}
describe('durable bounded proof results — no live scenario or database', () => {
  it('forwards only bounded joined application and worker evidence',()=>{
    expect(safeFaultEvidence({application:{httpReplayWithoutCookies:true,httpConflictAndOriginDenied:true,noDuplicatePersistedRows:true,password:'PRIVATE'},
      ordinary:{phase:4,fencing:true,safeRedrive:true,legacyQuarantine:true,restoreQuarantine:true,applicationWorker:true,sql:'PRIVATE'}} as unknown as FaultEvidence))
      .toEqual({application:{httpReplayWithoutCookies:true,httpConflictAndOriginDenied:true,noDuplicatePersistedRows:true},ordinary:{phase:4,fencing:true,safeRedrive:true,legacyQuarantine:true,restoreQuarantine:true,applicationWorker:true}});
  });
  it('recognizes fixed failure labels without allowing arbitrary error text', () => {
    expect(faultFailureLabel(new Error('FAULT_COMMIT_ACK_NOT_PROVED'))).toBe('FAULT_COMMIT_ACK_NOT_PROVED');
    expect(faultFailureLabel(new Error('PASSWORD SQL TOKEN STACK'))).toBe('UNCLASSIFIED_FAILURE');
    expect(faultFailureLabel({message: 'FAULT_PRIVATE_SECRET'})).toBe('UNCLASSIFIED_FAILURE');
    expect(faultFailureLabel({code: 'ECONNRESET'})).toBe('TRANSPORT_ECONNRESET');
    expect(faultFailureLabel({code: 'PRIVATE_TOKEN'})).toBe('UNCLASSIFIED_FAILURE');
    expect(faultFailureLabel({code: '42501'})).toBe('SQLSTATE_42501');
    expect(faultFailureLabel({code: '42601'})).toBe('SQLSTATE_42601');
  });
  it('captures only allowlisted source locations, never exception text or arbitrary filenames', () => {
    const error = {stack: 'PRIVATE_PASSWORD_SQL\n at consume (E:\\Programming\\Project\\fly-with-safety\\server\\src\\security\\protected-auth.pg.ts:44:12)\n at PRIVATE (E:\\secret-token.ts:1:2)\n at x (E:/Programming/Project/fly-with-safety/server/test/phase1-fault.integration.ts:200:3)'};
    expect(faultSourceLocations(error)).toEqual([{file:'src/security/protected-auth.pg.ts',line:44,column:12},{file:'test/phase1-fault.integration.ts',line:200,column:3}]);
    let called=false; expect(faultSourceLocations({get stack(){called=true;throw new Error('PRIVATE');}})).toEqual([]); expect(called).toBe(false);
  });
  it('persists composed expiry flags without falsely marking physical equality proved', () => {
    expect(safeFaultEvidence({expiry:{databaseEqualityRejected:true,fullServiceExpiredRejected:true,fullServiceExactEqualityProved:false,
      postLockWaitObserved:true,expiredWhileLocked:true,passwordAndSessionUnchanged:true,composedBoundaryProved:true,lockPolls:2,totalElapsedMs:3500}})).toMatchObject({expiry:{fullServiceExactEqualityProved:false,composedBoundaryProved:true,postLockWaitObserved:true}});
  });
  it('does not evaluate exception accessors/coercion and survives throwing proxies', () => {
    let calls = 0; const value = {get message() {calls++; throw new Error('PRIVATE');}, get code() {calls++; throw new Error('PRIVATE');}};
    expect(faultFailureLabel(value)).toBe('UNCLASSIFIED_FAILURE'); expect(calls).toBe(0);
    expect(faultFailureLabel(new Proxy({}, {getOwnPropertyDescriptor() {throw new Error('PRIVATE');}}))).toBe('UNCLASSIFIED_FAILURE');
  });
  it('copies only bounded allowlisted numeric/boolean aggregates, never arbitrary payloads', () => {
    const evidence = {c16: {required: 16, maximumWaiters: 16, polls: NaN, pollElapsedMs: Infinity, private: 'TOKEN'},
      commitAck: {acknowledgementDropped: true, clientRejected: 'PASSWORD', rawSql: 'SQL'}} as unknown as FaultEvidence;
    expect(safeFaultEvidence(evidence)).toEqual({c16: {required: 16, maximumWaiters: 16}, commitAck: {acknowledgementDropped: true}});
  });
  it('persists earlier stage results before a later failure and redacts failure contents', () => temporary(dir => {
    const evidence: FaultEvidence = {interruption: {ownBackendTerminated: true, userAndTriggerRolledBack: true}};
    appendProofCheckpoint(dir, 'checkpoint', 'interruption', evidence);
    appendProofCheckpoint(dir, 'stage-enter', 'commit-ack', evidence);
    appendProofCheckpoint(dir, 'operation-failed', 'commit-ack', evidence, new Error('PASSWORD TOKEN'));
    const raw = readFileSync(join(dir, 'progress.jsonl'), 'utf8'), rows = raw.trim().split('\n').map(line => JSON.parse(line));
    expect(rows).toHaveLength(3); expect(rows[0].evidence.interruption.userAndTriggerRolledBack).toBe(true);
    expect(rows[2].failure).toBe('UNCLASSIFIED_FAILURE'); expect(raw).not.toMatch(/PASSWORD|TOKEN|stack/);
  }));
  it('preliminary publication survives a later shutdown failure without claiming cleanup or final acceptance', () => temporary(dir => {
    publishScenarioOutcome(dir, {scenariosPassed: false, stage: 'commit-ack', evidence: {}, fixtureRecords: 3, failure: new Error('FAULT_COMMIT_ACK_NOT_PROVED')});
    try {throw new Error('SYNTHETIC_SHUTDOWN');} catch { /* Simulated later shutdown cannot erase result. */ }
    const result = JSON.parse(readFileSync(join(dir, 'scenario-result.json'), 'utf8'));
    expect(result).toMatchObject({fixtureRecords: 3, stoppedStage: 'commit-ack', failure: 'FAULT_COMMIT_ACK_NOT_PROVED', resourceShutdownVerified: false, cleanupExecuted: false, finalCleanVerified: false});
  }));
  it('cannot overwrite an existing published outcome', () => temporary(dir => {
    const value = {scenariosPassed: true, stage: 'c16' as const, evidence: {}, fixtureRecords: 1, failure: null}; publishScenarioOutcome(dir, value);
    const before = readFileSync(join(dir, 'scenario-result.json'), 'utf8');
    expect(() => publishScenarioOutcome(dir, {...value, scenariosPassed: false})).toThrow(); expect(readFileSync(join(dir, 'scenario-result.json'), 'utf8')).toBe(before);
  }));
  it('runner publishes before pool close and monitors fatal errors without swallowing normal termination', () => {
    const source = readFileSync(resolve(__dirname, 'run-phase1-faults.ts'), 'utf8');
    expect(source.indexOf('publishScenarioOutcome(dir,')).toBeLessThan(source.indexOf('await pool.end()'));
    expect(source).toContain("process.on('uncaughtExceptionMonitor'"); expect(source).not.toContain("process.on('uncaughtException',");
    expect(source.indexOf("writeFileSync(join(dir, 'result.json')")).toBeLessThan(source.indexOf("writeFileSync(join(dir, 'exact-teardown.review.sql')"));
  });
});
