import {createHash} from 'node:crypto';
import {closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync, writeSync} from 'node:fs';
import {join} from 'node:path';
import {openCommitAckFault} from './phase1-fault-controls.js';
import {verifyRemainingFaults, type FaultEvidence, type FaultStage} from './phase1-fault.integration.js';
import {serviceTarget, type FixtureRecord} from './phase1-service.integration.js';
import {exactServiceTeardown} from './phase1-service-teardown.js';
import {appendProofCheckpoint, publishScenarioOutcome} from './phase1-proof-journal.js';
import {verifyOrdinaryServiceAdapters} from './phase1-ordinary.integration.js';
import {loadSyntheticApplication, type SyntheticApplication} from './phase1-application.integration.js';

/** New proof only; historical suites/callers/markers are never opened for writing.
 * No automatic cleanup (role intentionally has no DELETE) and no production startup.
 */
async function main(): Promise<void> {
  if (process.argv[2] !== '--execute') { console.log('PHASE1_FAULT_RUNNER_OFFLINE_NO_CONNECTION'); return; }
  if (process.env.PHASE1_FAULT_EXECUTION_APPROVED !== 'true' || process.env.PHASE1_SYNTHETIC_FIXTURES_APPROVED !== 'true' ||
      process.env.PHASE1_EQUIVALENT_METHOD_APPROVED !== 'true') throw new Error('FAULT_APPROVAL_REQUIRED');
  for (const name of Object.keys(process.env)) if (name.startsWith('PG') || /^(DATABASE_URL|DIRECT_URL|INTEGRATION_TEST_DATABASE_URL|NODE_OPTIONS|NODE_DEBUG|DEBUG)$/.test(name)) throw new Error('FAULT_AMBIENT_OVERRIDE');
  const password = process.env.PHASE1_SERVICE_PRIVATE_PASSWORD;
  delete process.env.PHASE1_SERVICE_PRIVATE_PASSWORD;
  if (!password || !process.env.USERPROFILE) throw new Error('FAULT_PRIVATE_AUTH_REQUIRED');
  // Future identity only; no replacement package/execution is authorized yet.
  const base = join(process.env.USERPROFILE, '.codex', 'visualizations', '2026', '10', '21', '01a15fd3-69ff-7843-bea7-539c3d6111f9', 'phase1-gatea-remaining-20261030-02');
  const pins = JSON.parse(readFileSync(join(base, 'proof-pins.json'), 'utf8')) as {files: Array<{path: string; sha256: string}>};
  if (!Array.isArray(pins.files) || pins.files.length < 5) throw new Error('FAULT_SOURCE_INTEGRITY');
  for (const pin of pins.files) if (createHash('sha256').update(readFileSync(pin.path)).digest('hex') !== pin.sha256) throw new Error('FAULT_SOURCE_INTEGRITY');
  const dir = join(base, 'execution-01');
  if (existsSync(dir)) throw new Error('EXISTING_FAULT_ATTEMPT_NO_RETRY');
  mkdirSync(dir); // Atomic single-execution claim.
  writeFileSync(join(dir, 'attempt-started.json'), JSON.stringify({startedUtc: new Date().toISOString(), target: serviceTarget}), {flag: 'wx'});
  const {Pool} = await import('pg');
  const applicationName = 'flywithsafe_phase1_fault_proof';
  const config = {host: serviceTarget.host, port: serviceTarget.port, database: serviceTarget.database, user: serviceTarget.role,
    password, ssl: false as const, connectionTimeoutMillis: 5000, idleTimeoutMillis: 5000, allowExitOnIdle: true,
    options: '-c statement_timeout=5000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=5000', application_name: applicationName};
  const pool = new Pool({...config, max: 18});
  let activePool = pool, poolClosed = false, poolCloseRequested = false;
  let poolFailed = false, passed = false, stage: FaultStage = 'preflight';
  pool.on('error', () => { poolFailed = true; });
  const evidence: FaultEvidence = {}, records: FixtureRecord[] = [];
  const ordinaryRecords: string[] = [];
  let operationFailure: unknown = null;
  let application:SyntheticApplication|undefined;
  const fatalMonitor = (error: Error) => {
    // Monitoring only: preserve bounded evidence; Node still terminates normally
    // on an uncaught exception. No recovery, raw stacks or swallowed fatal errors.
    try {appendProofCheckpoint(dir, 'fatal-monitor', stage, evidence, error);} catch { /* Preserve existing journal. */ }
  };
  process.on('uncaughtExceptionMonitor', fatalMonitor);
  try {
    application=loadSyntheticApplication(true);
    await verifyRemainingFaults(pool, {approved: true, syntheticOnly: true, ordinaryAccess: 'approved',
      applicationReplay:(service,input,id)=>application!.replay(service,input,id),
      // This separate approval is NOT inferred from EquivalentMethodApproved.
      expiryMethod: process.env.PHASE1_UTC_COMPOSED_METHOD_APPROVED === 'true' ? 'composed-post-lock' : 'legacy-expired',
      stage: value => {stage = value; appendProofCheckpoint(dir, 'stage-enter', stage, evidence);},
      checkpoint: error => appendProofCheckpoint(dir, error === undefined ? 'checkpoint' : 'operation-failed', stage, evidence, error),
      record: async record => {
        // Validate the complete bounded ledger before persisting or applying a fixture.
        exactServiceTeardown([...records, record]);
        const fd = openSync(join(dir, 'fixture-ledger.jsonl'), 'a');
        try { writeSync(fd, JSON.stringify(record) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
        records.push({...record});
        appendProofCheckpoint(dir, 'fixture-journaled', stage, evidence);
      },
      commitFault: async () => {
        const fault = await openCommitAckFault(true);
        const dedicated = new Pool({...config, port: fault.port, max: 1});
        // Intentional ACK drop kills a leased client; raw errors must never escape a listener.
        dedicated.on('error', () => {poolFailed = true;});
        return {pool: dedicated, arm: () => fault.arm(), observed: () => fault.observed(),
          async close() { try { await dedicated.end(); } finally { await fault.close(); } }};
      },
    }, evidence);
    if (poolFailed) throw new Error('FAULT_POOL_FAILED');
    publishScenarioOutcome(dir, {scenariosPassed: true, stage, evidence, fixtureRecords: records.length, failure: null}, 'fault');
    appendProofCheckpoint(dir, 'before-pool-close', stage, evidence);
    poolCloseRequested = true; await pool.end(); poolClosed = true;
    // Never hold two18-slot pools at once or exceed the role's connection cap20.
    const ordinaryPool = new Pool({...config, max: 18}); activePool = ordinaryPool; poolClosed = false; poolCloseRequested = false;
    ordinaryPool.on('error', () => {poolFailed = true;}); stage = 'ordinary';
    evidence.ordinary = {phase: 0, fencing: false, safeRedrive: false, legacyQuarantine: false, restoreQuarantine: false};
    appendProofCheckpoint(dir, 'stage-enter', stage, evidence);
    const ordinaryStages = ['fencing','safe-redrive','legacy-quarantine','restore-quarantine','application-worker'] as const;
    const ordinaryFields = ['fencing','safeRedrive','legacyQuarantine','restoreQuarantine','applicationWorker'] as const;
    await verifyOrdinaryServiceAdapters(ordinaryPool, {approved: true, syntheticOnly: true, permissionDeltaApproved: true,
      stage: value => {evidence.ordinary!.phase = ordinaryStages.indexOf(value); appendProofCheckpoint(dir, 'stage-enter', stage, evidence);},
      completed: value => {evidence.ordinary![ordinaryFields[ordinaryStages.indexOf(value)]] = true; appendProofCheckpoint(dir, 'checkpoint', stage, evidence);},
      failure: error => appendProofCheckpoint(dir, 'operation-failed', stage, evidence, error),
      applicationWorker:async(store,id)=>{
        const worker=application!.worker({store,recovery:{admit:async()=>true},
          authorize:async(actor,action)=>actor==='application_worker'&&action==='ordinary',
          protected:{store:new (await import('../src/security/protected-auth.pg.js')).PostgresProtectedAuthStore(ordinaryPool),
            keys:{boundary(){throw new Error('PHASE1_APPLICATION_PROTECTED_PATH_FORBIDDEN');}},frontendOrigin:'http://127.0.0.1',authorize:async()=>false}});
        if(await worker.process('ordinary',id,'untrusted_worker')!=='denied'||await worker.process('ordinary',id,'application_worker')!=='suppressed'||
          await worker.process('ordinary',id,'application_worker')!=='denied')throw new Error('PHASE1_APPLICATION_WORKER_FAILED');
      },
      record: async id => {
        if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id) || ordinaryRecords.includes(id) || ordinaryRecords.length >= 5) throw new Error('PHASE1_LEDGER_INVALID');
        const fd = openSync(join(dir,'ordinary-fixture-ledger.jsonl'),'a');
        try {writeSync(fd,JSON.stringify({source:'ordinary',id})+'\n'); fsyncSync(fd);} finally {closeSync(fd);}
        ordinaryRecords.push(id); appendProofCheckpoint(dir,'fixture-journaled',stage,evidence);
      },
    });
    if (poolFailed) throw new Error('FAULT_POOL_FAILED');
    passed = true;
  } catch (error) {
    operationFailure = error;
    appendProofCheckpoint(dir, 'operation-failed', stage, evidence, error);
  } finally {
    // Final scenario record precedes awaited final-pool shutdown. The separate
    // fault record/checkpoints already precede the earlier pool transition.
    publishScenarioOutcome(dir, {scenariosPassed: passed, stage, evidence, fixtureRecords: records.length, failure: operationFailure});
    appendProofCheckpoint(dir, 'before-pool-close', stage, evidence);
    try {
      if (!poolCloseRequested) {poolCloseRequested = true; await activePool.end(); poolClosed = true;}
      if (poolClosed) appendProofCheckpoint(dir, 'pool-closed', stage, evidence); else passed = false;
    } catch { passed = false; }
    finally {process.removeListener('uncaughtExceptionMonitor', fatalMonitor);application?.close();}
    if (poolFailed) passed = false;
    writeFileSync(join(dir, 'result.json'), JSON.stringify({finishedUtc: new Date().toISOString(), passed, stoppedStage: stage, evidence,
      fixtureRecords: records.length, ordinaryFixtureRecords: ordinaryRecords.length, cleanupExecuted: false, finalCleanVerified: false,
      poolCloseVerified: poolClosed, utcComposedMethodOwnerApproved: process.env.PHASE1_UTC_COMPOSED_METHOD_APPROVED === 'true',
      utcComposedEvidenceProduced: evidence.expiry?.composedBoundaryProved === true,
      utcFullServiceEqualityAccepted: false, historicalPinnedSuiteRerun: false,
      acceptance: 'Component equality is not FULL-SERVICE equality. Owner method disposition and exact-ledger administrator cleanup remain separate.'}, null, 2), {flag: 'wx'});
    // Teardown generation must never prevent scenario-result/result persistence.
    if (records.length) writeFileSync(join(dir, 'exact-teardown.review.sql'), exactServiceTeardown(records), {flag: 'wx'});
  }
  console.log(passed ? 'PHASE1_REMAINING_PROOF_SCENARIOS_PASS_CLEANUP_PENDING' : 'PHASE1_REMAINING_PROOF_STOPPED');
  if (!passed) process.exitCode = 1;
}
void main().catch(() => { console.error('PHASE1_REMAINING_PROOF_STOPPED_NO_RETRY_OR_CLEANUP'); process.exitCode = 1; });
