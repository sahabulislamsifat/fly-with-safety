import {closeSync, fsyncSync, openSync, writeSync} from 'node:fs';
import {join} from 'node:path';
import type {FaultEvidence, FaultStage} from './phase1-fault.integration.js';

const stages: readonly string[] = ['preflight','c16','interruption','commit-ack','expiry','ordinary'];
const fields = {
  c16: ['required','maximumWaiters','polls','pollElapsedMs','transactionRequests','transactionBodyEntries','winners','invalid'],
  interruption: ['ownBackendTerminated','userAndTriggerRolledBack'],
  commitAck: ['acknowledgementDropped','clientRejected','persistedReceipt','replayWithoutPreparation'],
  expiry: ['databaseEqualityRejected','fullServiceExpiredRejected','fullServiceExactEqualityProved','postLockWaitObserved','expiredWhileLocked','passwordAndSessionUnchanged','composedBoundaryProved','lockPolls','totalElapsedMs'],
  encryption: ['persistedDecrypt','wrongContextDenied','unavailableKeyDenied','invalidEnvelopeDenied','corruptedEnvelopeDenied'],
  protectedDelivery: ['unauthorizedDenied','syntheticTransportCalls','suppressed','duplicateDenied'],
  ordinary: ['phase','fencing','safeRedrive','legacyQuarantine','restoreQuarantine','applicationWorker'],
  application: ['httpReplayWithoutCookies','httpConflictAndOriginDenied','noDuplicatePersistedRows'],
  session: ['utcExpiryRoundTrip'],
} as const;
const labels = new Set([
  'FAULT_C16_INCONCLUSIVE','FAULT_C16_PERSISTENCE_FAILED','FAULT_OWN_BACKEND_REQUIRED','FAULT_OWN_BACKEND_INTERRUPTION_FAILED',
  'FAULT_INTERRUPTION_NOT_PROVED','FAULT_COMMIT_ACK_NOT_PROVED','FAULT_COMMIT_NOT_PERSISTED','FAULT_REPLAY_NOT_PROVED',
  'FAULT_DELIVERY_CONTEXT_FAILED','FAULT_PROTECTED_DELIVERY_FAILED','FAULT_DB_BOUNDARY_FAILED','FAULT_EXPIRY_OBSERVATION_INCONCLUSIVE',
  'FAULT_SERVICE_EXPIRY_FAILED','FAULT_DECRYPT_FAILED','FAULT_CONTEXT_DENIAL_FAILED','FAULT_PREFLIGHT_FAILED',
  'FAULT_PREPARATION_BUDGET','FAULT_PREPARATION_INCONCLUSIVE','FAULT_GATE_CANCELLED','FAULT_LISTENER_FAILED','FAULT_ARM_INVALID',
  'PROTECTED_STORAGE_FAILED','ISSUANCE_REQUEST_FAILED','PHASE1_LEDGER_INVALID','FAULT_POOL_FAILED',
  'FAULT_UTC_LOCK_WAIT_INCONCLUSIVE','FAULT_UTC_POSTLOCK_DENIAL_FAILED',
  'FAULT_SESSION_UTC_MAPPING_FAILED',
  'PHASE1_APPLICATION_REPLAY_FAILED','PHASE1_APPLICATION_BOUNDARY_FAILED','PHASE1_APPLICATION_LOAD_FAILED',
  'PHASE1_APPLICATION_CLOSED','PHASE1_APPLICATION_ALREADY_LOADED','PHASE1_APPLICATION_LISTENER_FAILED',
  'PHASE1_APPLICATION_WORKER_FAILED',
  'PHASE1_ORDINARY_APPROVAL_REQUIRED','PHASE1_ORDINARY_PREFLIGHT_FAILED','PHASE1_ORDINARY_PROOF_FAILED','PHASE1_ORDINARY_PROOF_STOPPED_PRESERVE_LEDGER',
]);
const databaseCodes = new Set(['42501','42P01','42703','42601','23503','23514','23505','55P03','57014','28P01','28000','3D000','53300','57P03','08001']);
/** Reads own data properties only; never serialize unrestricted errors/stacks. */
export function faultFailureLabel(error: unknown): string {
  try {
    if (error && typeof error === 'object') {
      const message = Object.getOwnPropertyDescriptor(error, 'message');
      if (message && 'value' in message && labels.has(message.value)) return message.value as string;
      const code = Object.getOwnPropertyDescriptor(error, 'code');
      if (code && 'value' in code && ['57P01','08006','ECONNRESET','ETIMEDOUT','EPIPE'].includes(code.value)) return 'TRANSPORT_' + String(code.value);
      if (code && 'value' in code && databaseCodes.has(code.value)) return 'SQLSTATE_' + String(code.value);
    }
  } catch { /* Proxy/getter failures must not expose their contents. */ }
  return 'UNCLASSIFIED_FAILURE';
}
const sourceFiles = new Set(['test/phase1-fault.integration.ts','test/phase1-ordinary.integration.ts','test/run-phase1-faults.ts','test/phase1-proof-journal.ts',
  'src/security/protected-auth.pg.ts','src/security/protected-auth.ts','src/security/issuance-replay.ts','src/security/compatible-outbox.pg.ts',
  'src/security/notification-recovery.pg.ts','src/services/protected-auth.service.ts']);
/** Only own string stacks, fixed source paths and bounded line/column numbers.
 * Accessor/proxy stacks are unavailable; never call a foreign getter or log raw text.
 */
export function faultSourceLocations(error: unknown): Array<{file: string; line: number; column: number}> {
  const result: Array<{file: string; line: number; column: number}> = [];
  try {
    if (!error || typeof error !== 'object') return result;
    const own = Object.getOwnPropertyDescriptor(error, 'stack');
    if (!own || !('value' in own) || typeof own.value !== 'string') return result;
    for (const text of own.value.split('\n').slice(1, 21)) {
      const match = /server[\\/]((?:test|src)[\\/][A-Za-z0-9_.\\/-]+):(\d{1,6}):(\d{1,6})\)?$/.exec(text.trim());
      if (!match) continue; const file = match[1].replace(/\\/g, '/');
      if (sourceFiles.has(file) && Number(match[2]) > 0 && Number(match[3]) > 0) result.push({file, line: Number(match[2]), column: Number(match[3])});
      if (result.length === 5) break;
    }
  } catch { return []; }
  return result;
}
export function safeFaultEvidence(input: FaultEvidence): Record<string, Record<string, boolean | number>> {
  const result: Record<string, Record<string, boolean | number>> = {};
  for (const [section, allowed] of Object.entries(fields)) {
    const value = Object.getOwnPropertyDescriptor(input, section);
    if (!value || !('value' in value) || !value.value || typeof value.value !== 'object') continue;
    const safe: Record<string, boolean | number> = {};
    for (const name of allowed) {
      const entry = Object.getOwnPropertyDescriptor(value.value, name);
      if (!entry || !('value' in entry)) continue;
      if (typeof entry.value === 'boolean') safe[name] = entry.value;
      else if (typeof entry.value === 'number' && Number.isFinite(entry.value) && entry.value >= 0 && entry.value <= 120000) safe[name] = entry.value;
    }
    result[section] = safe;
  }
  return result;
}
export type ProofEvent = 'stage-enter' | 'checkpoint' | 'fixture-journaled' | 'operation-failed' | 'fatal-monitor' | 'before-pool-close' | 'pool-closed';
/** Caller must supply its new exclusively claimed attempt directory. Never used on historical attempts. */
export function appendProofCheckpoint(dir: string, event: ProofEvent, stage: FaultStage, evidence: FaultEvidence, failure?: unknown): void {
  if (!stages.includes(stage) || !['stage-enter','checkpoint','fixture-journaled','operation-failed','fatal-monitor','before-pool-close','pool-closed'].includes(event))
    throw new Error('FAULT_CHECKPOINT_INVALID');
  const record = {recordedUtc: new Date().toISOString(), event, stage, evidence: safeFaultEvidence(evidence),
    ...(failure === undefined ? {} : {failure: faultFailureLabel(failure), sourceLocations: faultSourceLocations(failure)})};
  const fd = openSync(join(dir, 'progress.jsonl'), 'a');
  try {writeSync(fd, JSON.stringify(record) + '\n'); fsyncSync(fd);} finally {closeSync(fd);}
}
/** Publish scenario outcome BEFORE asynchronous pool/proxy shutdown can fail.
 * A later final result may accept resource close; this preliminary record never does.
 */
export function publishScenarioOutcome(dir: string, value: {scenariosPassed: boolean; stage: FaultStage; evidence: FaultEvidence; fixtureRecords: number; failure: unknown}, scope: 'all' | 'fault' = 'all'): void {
  if (scope !== 'all' && scope !== 'fault') throw new Error('FAULT_CHECKPOINT_INVALID');
  const fd = openSync(join(dir, scope === 'fault' ? 'fault-scenario-result.json' : 'scenario-result.json'), 'wx');
  try {
    writeSync(fd, JSON.stringify({scope, scenariosPassed: value.scenariosPassed, stoppedStage: value.stage, evidence: safeFaultEvidence(value.evidence),
      fixtureRecords: value.fixtureRecords, failure: value.failure === null ? null : faultFailureLabel(value.failure),
      cleanupExecuted: false, finalCleanVerified: false, resourceShutdownVerified: false}, null, 2));
    fsyncSync(fd);
  } finally {closeSync(fd);}
}
