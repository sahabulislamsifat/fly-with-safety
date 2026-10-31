import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Pool, QueryResultRow } from 'pg';
import { PostgresProtectedAuthStore } from '../src/security/protected-auth.pg.js';
import { deliverProtectedCredential, prepareProtectedIssuance } from '../src/security/protected-auth.js';
import { openEnvelope, parseEnvelope, protectedContext, type EnvelopeKeys } from '../src/security/protected-envelope.js';
import { createProtectedAuthServices } from '../src/services/protected-auth.service.js';
import { executeIssuanceRequest } from '../src/security/issuance-replay.js';
import { AppError } from '../src/utils/errors.js';
import { PreparationGate } from './phase1-fault-controls.js';
import { serviceTarget, type FixtureRecord } from './phase1-service.integration.js';

export type FaultStage = 'preflight' | 'c16' | 'interruption' | 'commit-ack' | 'expiry' | 'ordinary';
export interface FaultApproval {
  approved: boolean; syntheticOnly: boolean;
  /** Closed reviewed permission states only, never arbitrary table allowances. */
  ordinaryAccess?: 'absent' | 'approved';
  /** Explicit owner method disposition required; never marks physical equality observed. */
  expiryMethod?: 'legacy-expired' | 'composed-post-lock';
  record(record: FixtureRecord): Promise<void>;
  stage?(value: FaultStage): void;
  checkpoint?(failure?: unknown): void;
  applicationReplay?(service: ReturnType<typeof createProtectedAuthServices>, input: {email:string;password:string;name:null}, requestId:string): Promise<void>;
  /** Creates a dedicated max:1 pool through the approved local fault proxy.
   * Caller owns credentials and all socket/pool teardown. No environment discovery here. */
  commitFault(): Promise<{pool: Pick<Pool, 'connect'>; arm(): void;
    observed(): {acknowledgementDropped: boolean; transportFailed: boolean}; close(): Promise<void>}>;
}
export interface FaultEvidence {
  c16?: { required: 16; maximumWaiters: number; polls: number; pollElapsedMs: number; transactionRequests: number; transactionBodyEntries: number; winners: number; invalid: number };
  interruption?: { ownBackendTerminated: boolean; userAndTriggerRolledBack: boolean };
  commitAck?: { acknowledgementDropped: boolean; clientRejected: boolean; persistedReceipt: boolean; replayWithoutPreparation: boolean };
  expiry?: { databaseEqualityRejected: boolean; fullServiceExpiredRejected: boolean; fullServiceExactEqualityProved: false;
    postLockWaitObserved?: boolean; expiredWhileLocked?: boolean; passwordAndSessionUnchanged?: boolean; composedBoundaryProved?: boolean; lockPolls?: number; totalElapsedMs?: number };
  encryption?: { persistedDecrypt: boolean; wrongContextDenied: boolean; unavailableKeyDenied: boolean; invalidEnvelopeDenied?:boolean; corruptedEnvelopeDenied?:boolean };
  protectedDelivery?: { unauthorizedDenied: boolean; syntheticTransportCalls: number; suppressed: boolean; duplicateDenied: boolean };
  ordinary?: {phase: number; fencing: boolean; safeRedrive: boolean; legacyQuarantine: boolean; restoreQuarantine: boolean; applicationWorker?:boolean};
  application?: {httpReplayWithoutCookies:boolean;httpConflictAndOriginDenied:boolean;noDuplicatePersistedRows:boolean};
  session?: {utcExpiryRoundTrip: boolean};
}

const assert = (ok: unknown, code: string): void => { if (!ok) throw new Error(code); };
export const expiryBoundarySql = `WITH t AS MATERIALIZED(SELECT clock_timestamp() AS wall_clock),
  cases AS(SELECT wall_clock,wall_clock+offset_us*interval '1 microsecond' AS expires_at,expected
    FROM t CROSS JOIN(VALUES(-1,false),(0,false),(1,true)) offsets(offset_us,expected))
  SELECT bool_and((expires_at>wall_clock)=expected) AS ok FROM cases`;
/** Inert proof entry point; no connections on import. Does not run historical G3-X,
 * mutate permissions, delete fixtures, or label component expiry proof FULL-SERVICE equality.
 * Must be paired with an immutable caller, exact ledger review and owner-approved teardown.
 */
export async function verifyRemainingFaults(pool: Pick<Pool, 'connect'>, approval: FaultApproval, evidence: FaultEvidence): Promise<void> {
  if (approval?.approved !== true || approval.syntheticOnly !== true || typeof approval.record !== 'function' ||
      typeof approval.commitFault !== 'function') throw new Error('FAULT_APPROVAL_REQUIRED');
  if (approval.ordinaryAccess !== undefined && !['absent','approved'].includes(approval.ordinaryAccess) ||
      approval.expiryMethod !== undefined && !['legacy-expired','composed-post-lock'].includes(approval.expiryMethod) ||
      approval.applicationReplay !== undefined && typeof approval.applicationReplay !== 'function') throw new Error('FAULT_APPROVAL_REQUIRED');
  const ordinaryApproved = approval.ordinaryAccess === 'approved';
  const query = async <T extends QueryResultRow>(sql: string, values: unknown[] = []) => {
    const client = await pool.connect(); try { return await client.query<T>(sql, values); } finally { client.release(); }
  };
  approval.stage?.('preflight');
  // Fresh connection identity, effective minimum privileges, empty scoped surface,
  // and no other target sessions. No fixture connection before all guards pass.
  const guard = await query<{ok: boolean}>(`SELECT current_database()=$1 AND current_user=$2 AND session_user=$2
    AND host(inet_server_addr())='127.0.0.1' AND inet_server_port()=5432
    AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolinherit
    AND NOT r.rolreplication AND NOT r.rolbypassrls AND r.rolconnlimit=20
    AND current_setting('statement_timeout')='5s' AND current_setting('lock_timeout')='5s'
    AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid OR roleid=r.oid)
    AND NOT has_database_privilege(current_user,current_database(),'CREATE,TEMP')
    AND NOT has_schema_privilege(current_user,'public','CREATE')
    AND has_table_privilege(current_user,'public."NotificationQuarantine"','SELECT')
    AND NOT has_any_column_privilege(current_user,'public."NotificationQuarantine"','UPDATE,REFERENCES')
    AND (NOT $3::boolean AND NOT has_any_column_privilege(current_user,'public."NotificationQuarantine"','INSERT')
      OR $3::boolean AND has_table_privilege(current_user,'public."NotificationQuarantine"','INSERT'))
    AND (NOT $3::boolean OR NOT EXISTS(SELECT 1 FROM unnest(ARRAY['NotificationOutbox','CompatibleNotificationLease','NotificationSendIntent']) needed(name)
      WHERE NOT has_table_privilege(current_user,format('public.%I',needed.name),'SELECT')
       OR NOT has_table_privilege(current_user,format('public.%I',needed.name),'INSERT')
       OR NOT has_table_privilege(current_user,format('public.%I',needed.name),'UPDATE')))
    AND NOT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid())
    AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['User','AuthSecurityState','ProtectedCredential','ProtectedAuthJob','Session','AuthIssuanceRequest']) needed(name)
      WHERE NOT has_table_privilege(current_user,format('public.%I',needed.name),'SELECT')
       OR NOT has_table_privilege(current_user,format('public.%I',needed.name),'INSERT')
       OR NOT has_table_privilege(current_user,format('public.%I',needed.name),'UPDATE'))
    AND NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN('r','p')
      AND (c.relowner=r.oid OR has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR(c.relname<>ALL(ARRAY['User','AuthSecurityState','ProtectedCredential','ProtectedAuthJob','Session','AuthIssuanceRequest','NotificationQuarantine'])
          AND NOT($3::boolean AND c.relname=ANY(ARRAY['NotificationOutbox','CompatibleNotificationLease','NotificationSendIntent']))
          AND has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))))
    AND NOT EXISTS(SELECT 1 FROM public."User") AND NOT EXISTS(SELECT 1 FROM public."AuthSecurityState")
    AND NOT EXISTS(SELECT 1 FROM public."ProtectedCredential") AND NOT EXISTS(SELECT 1 FROM public."ProtectedAuthJob")
    AND NOT EXISTS(SELECT 1 FROM public."Session") AND NOT EXISTS(SELECT 1 FROM public."AuthIssuanceRequest")
    AND NOT EXISTS(SELECT 1 FROM public."NotificationQuarantine") AS ok FROM pg_roles r WHERE rolname=current_user`, [serviceTarget.database, serviceTarget.role, ordinaryApproved])
    .catch(error => { approval.checkpoint?.(error); throw new Error('FAULT_PREFLIGHT_FAILED'); });
  assert(guard.rows.length === 1 && guard.rows[0].ok === true, 'FAULT_PREFLIGHT_FAILED');
  if (ordinaryApproved) {
    const empty = await query<{ok: boolean}>(`SELECT NOT EXISTS(SELECT 1 FROM public."NotificationOutbox")
      AND NOT EXISTS(SELECT 1 FROM public."CompatibleNotificationLease") AND NOT EXISTS(SELECT 1 FROM public."NotificationSendIntent") AS ok`)
      .catch(error => {approval.checkpoint?.(error); throw new Error('FAULT_PREFLIGHT_FAILED');});
    assert(empty.rows.length === 1 && empty.rows[0].ok, 'FAULT_PREFLIGHT_FAILED');
  }
  const key = randomBytes(32), digestKey = randomBytes(32), store = new PostgresProtectedAuthStore(pool);
  const keys: EnvelopeKeys = {boundary(ref) { assert(ref === 'local-fault-proof', 'FAULT_KEY_DENIED'); return {
    authorize: async (_action, context) => context.purpose === 'auth-notification', acquireDataKey: async () => Buffer.from(key),
  }; }};
  const recovery = {admit: async () => true}; // Explicit synthetic authority; no production fallback.
  const policy = {currentVersion: 'local-fault-proof', acquireKey(ref: string) { assert(ref === 'local-fault-proof', 'FAULT_KEY_DENIED'); return Buffer.from(digestKey); }};
  async function resetFixture(lifetimeMs = 600000) {
    const userId = randomUUID(), sessionId = randomUUID(), email = userId + '@example.invalid';
    const sessionExpiry = new Date(Date.now() + 600000);
    const prepared = await prepareProtectedIssuance(keys, 'local-fault-proof', {userId, recipient: email, generation: 0}, 'reset', new Date(Date.now() + lifetimeMs));
    await approval.record({userId, sessionId, credentialId: prepared.credentialId, jobId: prepared.jobId, requestHash: createHash('sha256').update(randomUUID()).digest('hex')});
    await store.transaction(async tx => {
      await tx.createAccount({id: userId, email, passwordHash: '$2b$12$' + '.'.repeat(53), name: null});
      await tx.createSession({id: sessionId, userId, digest: randomBytes(32).toString('hex'), expiresAt: sessionExpiry});
      await prepared.apply(tx);
    });
    const sessionMapping = await query<{ok: boolean}>(`SELECT abs(extract(epoch FROM (("expiresAt" AT TIME ZONE 'UTC')-$2::timestamptz)))<0.001 AS ok
      FROM public."Session" WHERE id=$1 AND "userId"=$3`, [sessionId, sessionExpiry, userId]);
    assert(sessionMapping.rows.length === 1 && sessionMapping.rows[0].ok, 'FAULT_SESSION_UTC_MAPPING_FAILED');
    evidence.session = {utcExpiryRoundTrip: true};
    approval.checkpoint?.();
    const persisted = await query<{envelope: unknown}>('SELECT envelope FROM public."ProtectedAuthJob" WHERE id=$1', [prepared.jobId]);
    const context = protectedContext('auth-delivery', 'auth-notification', userId, 0, 'reset', prepared.credentialId, prepared.jobId);
    const bytes = await openEnvelope(persisted.rows[0].envelope, 'auth-notification', context, keys);
    let token: string;
    try {
      const decoded = JSON.parse(Buffer.from(bytes).toString('utf8')) as {token: string; recipient: string};
      assert(decoded.recipient === email && /^[A-Za-z0-9_-]{64}$/.test(decoded.token), 'FAULT_DECRYPT_FAILED'); token = decoded.token;
    } finally { bytes.fill(0); }
    const deny = async (aad: Buffer, boundary: EnvelopeKeys, envelope: unknown = persisted.rows[0].envelope) => {
      let denied = false;
      try { const unexpected = await openEnvelope(envelope, 'auth-notification', aad, boundary); unexpected.fill(0); }
      catch { denied = true; }
      return denied;
    };
    const wrongContextDenied = await deny(protectedContext('auth-delivery', 'auth-notification', randomUUID(), 0, 'reset', prepared.credentialId, prepared.jobId), keys);
    const unavailableKeyDenied = await deny(context, {boundary() { throw new Error('FAULT_KEY_DENIED'); }});
    const shape=parseEnvelope(persisted.rows[0].envelope),tag=Buffer.from(shape.tag,'base64url'); tag[0]^=1;
    const invalidEnvelopeDenied=await deny(context,keys,{...shape,version:2});
    const corruptedEnvelopeDenied=await deny(context,keys,{...shape,tag:tag.toString('base64url')}); tag.fill(0);
    assert(wrongContextDenied && unavailableKeyDenied && invalidEnvelopeDenied && corruptedEnvelopeDenied, 'FAULT_CONTEXT_DENIAL_FAILED');
    evidence.encryption = {persistedDecrypt: true, wrongContextDenied, unavailableKeyDenied, invalidEnvelopeDenied, corruptedEnvelopeDenied};
    approval.checkpoint?.();
    return {userId, sessionId, token, credentialId: prepared.credentialId};
  }
  const services = (actor: PostgresProtectedAuthStore) => createProtectedAuthServices({store: actor, keys, keyRef: 'local-fault-proof',
    refreshTokenExpiresDays: 1, recovery, signAccessToken: () => 'synthetic-not-an-access-token'});
  try {
    approval.stage?.('c16');
    const began = performance.now(), fixture = await resetFixture(), gate = new PreparationGate(16);
    let transactionRequests = 0, transactionBodyEntries = 0;
    // Observe invocation of the actual adapter transaction body, not a fabricated callback.
    const consumePool: Pick<Pool, 'connect'> = {connect: async () => {
      const client = await pool.connect();
      return new Proxy(client, {get(target, prop) {
        if (prop === 'query') return (...args: unknown[]) => {
          if (typeof args[0] === 'string' && args[0].startsWith('SELECT u.id FROM public."User"')) transactionBodyEntries++;
          return Reflect.apply(target.query, target, args);
        };
        const value: unknown = Reflect.get(target, prop); return typeof value === 'function' ? value.bind(target) : value;
      }});
    }} as Pick<Pool, 'connect'>;
    const consumer = new PostgresProtectedAuthStore(consumePool);
    class SynchronizedStore extends PostgresProtectedAuthStore {
      override async consume(...args: Parameters<PostgresProtectedAuthStore['consume']>): Promise<boolean> {
        await gate.arrive(); transactionRequests++; return consumer.consume(...args);
      }
    }
    const actor = services(new SynchronizedStore(pool)), blocker = await pool.connect();
    let pending: PromiseSettledResult<void>[] = [], operations: Promise<void>[] = [];
    let barrierReady = false, maximumWaiters = 0, polls = 0, pollElapsedMs = 0;
    try {
      const blockerPid = (await blocker.query<{pid: number}>('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      operations = Array.from({length: 16}, () => actor.resetPassword({token: fixture.token, password: 'SyntheticProof12!'}).catch(error => {
        gate.cancel(); throw error;
      }));
      // Attach rejection handling immediately; all contenders are settled before any next scenario.
      const all = Promise.allSettled(operations);
      try {
        await gate.openWhenReady(Math.max(0, 6500 - (performance.now() - began)), async () => {
          // No idle blocker transaction while bcrypt runs. Acquire the actual lock
          // after preparation, before allowing ANY contender transaction to dispatch.
          await blocker.query('BEGIN');
          await blocker.query("SELECT set_config('statement_timeout',$1,true)", [String(Math.max(1, Math.floor(6500 - (performance.now() - began)))) + 'ms']);
          await blocker.query('SELECT id FROM public."User" WHERE id=$1 FOR UPDATE', [fixture.userId]);
        });
        const polling = performance.now();
        while (performance.now() - polling < 1500) {
          const remaining = Math.max(1, Math.floor(1500 - (performance.now() - polling)));
          const observer = await pool.connect();
          let count = 0;
          try {
            await observer.query('BEGIN READ ONLY');
            await observer.query("SELECT set_config('statement_timeout',$1,true)", [String(remaining) + 'ms']);
            const observed = await observer.query<{n: number}>(`SELECT count(*)::int AS n FROM pg_stat_activity
              WHERE datname=current_database() AND usename=current_user
              AND application_name=current_setting('application_name') AND wait_event_type='Lock'
              AND pid<>pg_backend_pid() AND pid<>$1`, [blockerPid]);
            count = observed.rows[0].n;
          } finally { try { await observer.query('ROLLBACK'); } finally { observer.release(); } }
          polls++; maximumWaiters = Math.max(maximumWaiters, count);
          if (count === 16 && performance.now() - polling <= 1500) { barrierReady = true; break; }
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        pollElapsedMs = Math.round(performance.now() - polling);
      } finally {
        gate.cancel();
        try { await blocker.query('ROLLBACK'); } finally { pending = await all; }
      }
    } finally {
      gate.cancel();
      try { await blocker.query('ROLLBACK'); } finally {
        blocker.release();
        if (operations.length && !pending.length) pending = await Promise.allSettled(operations);
        evidence.c16 = {required: 16, maximumWaiters, polls, pollElapsedMs, transactionRequests, transactionBodyEntries,
          winners: pending.filter(x => x.status === 'fulfilled').length,
          invalid: pending.filter(x => x.status === 'rejected' && x.reason instanceof AppError && x.reason.statusCode === 400).length};
      }
    }
    assert(barrierReady && evidence.c16.transactionBodyEntries === 16 && evidence.c16.winners === 1 && evidence.c16.invalid === 15 && performance.now() - began < 15000, 'FAULT_C16_INCONCLUSIVE');
    const persisted = await query<{password: string; generation: number; revoked: boolean}>(`SELECT u.password,s.generation,se."revokedAt" IS NOT NULL AS revoked
      FROM public."User" u JOIN public."AuthSecurityState" s ON s."userId"=u.id JOIN public."Session" se ON se.id=$2 WHERE u.id=$1`, [fixture.userId, fixture.sessionId]);
    assert(persisted.rows[0].generation === 1 && persisted.rows[0].revoked && await bcrypt.compare('SyntheticProof12!', persisted.rows[0].password) && performance.now() - began < 15000, 'FAULT_C16_PERSISTENCE_FAILED');
    approval.checkpoint?.();

    approval.stage?.('interruption');
    const rollbackUser = randomUUID();
    await approval.record({userId: rollbackUser, credentialId: '', jobId: '', sessionId: '', requestHash: ''});
    const owned = await pool.connect();
    const swallowOwnedSocketError = () => {}; owned.on('error', swallowOwnedSocketError);
    let terminated = false, transactionRejected = false;
    try {
      const identity = await owned.query<{pid: number; started: string; app: string}>(`SELECT pid,backend_start::text AS started,application_name AS app
        FROM pg_stat_activity WHERE pid=pg_backend_pid() AND usename=current_user AND datname=current_database()`);
      assert(identity.rows.length === 1, 'FAULT_OWN_BACKEND_REQUIRED');
      const id = identity.rows[0];
      // Release is owned here, not by adapter; session is discarded after the interruption.
      const pinned = new Proxy(owned, {get(target, prop) { if (prop === 'release') return () => {};
        const value: unknown = Reflect.get(target, prop); return typeof value === 'function' ? value.bind(target) : value;
      }});
      const interrupted = new PostgresProtectedAuthStore({connect: async () => pinned} as Pick<Pool, 'connect'>);
      try {
        await interrupted.transaction(async tx => {
          await tx.createAccount({id: rollbackUser, email: rollbackUser + '@example.invalid', passwordHash: 'synthetic-not-login', name: null});
          const kill = await query<{terminated: boolean}>(`SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity
            WHERE pid=$1 AND backend_start=$2::timestamptz AND application_name=$3 AND usename=current_user
              AND datname=current_database() AND pid<>pg_backend_pid()`, [id.pid, id.started, id.app]);
          terminated = kill.rows.length === 1 && kill.rows[0].terminated;
          assert(terminated, 'FAULT_OWN_BACKEND_INTERRUPTION_FAILED');
          // No injected throw: the real COMMIT on the terminated connection must fail.
        });
      } catch { transactionRejected = true; }
    } finally { owned.release(true); /* listener retained on destroyed socket: never print late raw errors */ }
    const absence = await query<{ok: boolean}>(`SELECT NOT EXISTS(SELECT 1 FROM public."User" WHERE id=$1)
      AND NOT EXISTS(SELECT 1 FROM public."AuthSecurityState" WHERE "userId"=$1) AS ok`, [rollbackUser]);
    assert(terminated && transactionRejected && absence.rows[0].ok, 'FAULT_INTERRUPTION_NOT_PROVED');
    evidence.interruption = {ownBackendTerminated: true, userAndTriggerRolledBack: true};
    approval.checkpoint?.();

    approval.stage?.('commit-ack');
    const wire = await approval.commitFault();
    try {
      const wireStore = new PostgresProtectedAuthStore(wire.pool), userId = randomUUID(), sessionId = randomUUID(), requestId = randomUUID();
      const email = userId + '@example.invalid', logical = {email,password:'SyntheticProof12!',name:null};
      const prepared = await prepareProtectedIssuance(keys, 'local-fault-proof', {userId, recipient: email, generation: 0}, 'verification', new Date(Date.now() + 600000),
        {passwordHash: '$2b$12$' + '.'.repeat(53), name: null, sessionId, sessionDigest: randomBytes(32).toString('hex'), sessionExpiresAt: new Date(Date.now() + 600000)});
      const receipt = {operation: 'register' as const, userId, credentialId: prepared.credentialId, jobId: prepared.jobId, sessionId};
      const requestHash = createHash('sha256').update(requestId).digest('hex');
      await approval.record({userId, sessionId, credentialId: prepared.credentialId, jobId: prepared.jobId, requestHash});
      let clientRejected = false;
      try {
        await executeIssuanceRequest(wireStore, policy, recovery, requestId, 'register', logical, async () => ({receipt, value: true,
          apply: async tx => { await prepared.apply(tx); wire.arm(); }}));
      } catch { clientRejected = true; }
      const seen = wire.observed();
      assert(seen.acknowledgementDropped && !seen.transportFailed && clientRejected, 'FAULT_COMMIT_ACK_NOT_PROVED');
      const counts = await query<{ok: boolean}>(`SELECT (SELECT count(*) FROM public."AuthIssuanceRequest" WHERE "keyHash"=$1 AND state='COMMITTED')=1
        AND (SELECT count(*) FROM public."User" WHERE id=$2)=1 AND (SELECT count(*) FROM public."Session" WHERE id=$3 AND "userId"=$2)=1 AS ok`, [requestHash, userId, sessionId]);
      assert(counts.rows[0].ok, 'FAULT_COMMIT_NOT_PERSISTED');
      let preparations = 0;
      const replay = await executeIssuanceRequest(store, policy, recovery, requestId, 'register', logical, async () => { preparations++; throw new Error('FAULT_REPLAY_REISSUED'); });
      assert(replay.replayed && preparations === 0, 'FAULT_REPLAY_NOT_PROVED');
      evidence.commitAck = {acknowledgementDropped: true, clientRejected, persistedReceipt: true, replayWithoutPreparation: true};
      approval.checkpoint?.();
      if(approval.applicationReplay){
        const service=createProtectedAuthServices({store,keys,keyRef:'local-fault-proof',refreshTokenExpiresDays:1,recovery,requests:{store,policy},
          signAccessToken:()=>{throw new Error('FAULT_REPLAY_REISSUED');}});
        await approval.applicationReplay(service,logical,requestId);
        const unchanged=await query<{ok:boolean}>(`SELECT
          (SELECT count(*) FROM public."Session" WHERE "userId"=$1)=1
          AND (SELECT count(*) FROM public."ProtectedCredential" WHERE "userId"=$1)=1
          AND (SELECT count(*) FROM public."ProtectedAuthJob" j JOIN public."ProtectedCredential" c ON c.id=j."credentialId" WHERE c."userId"=$1)=1
          AND (SELECT count(*) FROM public."AuthIssuanceRequest" WHERE "keyHash"=$2 AND state='COMMITTED')=1 AS ok`,[userId,requestHash]);
        assert(unchanged.rows[0].ok,'PHASE1_APPLICATION_REPLAY_FAILED');
        evidence.application={httpReplayWithoutCookies:true,httpConflictAndOriginDenied:true,noDuplicatePersistedRows:true}; approval.checkpoint?.();
      }
      // Exercise the actual protected worker/decrypt/fence path on this still-live
      // verification job; synthetic transport settles explicitly as suppressed.
      let syntheticTransportCalls = 0;
      const delivery = {authorize: async () => true, send: async (input: {purpose: 'verification' | 'reset'; recipient: string; token: string}) => {
        assert(input.purpose === 'verification' && input.recipient === email && /^[A-Za-z0-9_-]{64}$/.test(input.token), 'FAULT_DELIVERY_CONTEXT_FAILED');
        syntheticTransportCalls++; return 'suppressed' as const;
      }};
      const unauthorizedDenied = await deliverProtectedCredential(store, keys, {...delivery, authorize: async () => false}, prepared.jobId, 'fault_worker') === 'denied';
      const suppressed = await deliverProtectedCredential(store, keys, delivery, prepared.jobId, 'fault_worker') === 'suppressed';
      const duplicateDenied = await deliverProtectedCredential(store, keys, delivery, prepared.jobId, 'fault_worker') === 'denied';
      assert(unauthorizedDenied && suppressed && duplicateDenied && syntheticTransportCalls === 1, 'FAULT_PROTECTED_DELIVERY_FAILED');
      evidence.protectedDelivery = {unauthorizedDenied, syntheticTransportCalls, suppressed, duplicateDenied};
      approval.checkpoint?.();
    } finally { await wire.close(); }

    approval.stage?.('expiry');
    // Exact equality is genuinely evaluated by PostgreSQL, but it is component
    // evidence, not a claim that a black-box service hit a chosen wall-clock instant.
    const boundary = await query<{ok: boolean}>(expiryBoundarySql);
    assert(boundary.rows[0].ok, 'FAULT_DB_BOUNDARY_FAILED');
    if (approval.expiryMethod === 'composed-post-lock') {
      // Proposed equivalent proof: real service valid lookup, real row wait,
      // DB-observed expiry while blocked, then post-lock denial. No fake clock,
      // expiry rewrite, deadline increase or production time hook.
      const started = performance.now(), expired = await resetFixture(3500), gate = new PreparationGate(1);
      class ExpiryGatedStore extends PostgresProtectedAuthStore {
        override async consume(...args: Parameters<PostgresProtectedAuthStore['consume']>): Promise<boolean> {
          await gate.arrive(); return store.consume(...args);
        }
      }
      const blocker = await pool.connect(); let attempt: Promise<'success' | 'invalid' | 'internal'> | undefined;
      let outcome: 'success' | 'invalid' | 'internal' | undefined, observedWait = false, actuallyExpired = false, polls = 0;
      try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT id FROM public."User" WHERE id=$1 FOR UPDATE', [expired.userId]);
        attempt = services(new ExpiryGatedStore(pool)).resetPassword({token: expired.token, password: 'SyntheticProof12!'})
          .then(() => 'success' as const, error => {gate.cancel(); return error instanceof AppError && error.statusCode === 400 ? 'invalid' as const : 'internal' as const;});
        await gate.openWhenReady(1500);
        const polling = performance.now();
        while (performance.now() - polling < 1500) {
          const observation = await query<{n: number}>(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database()
            AND usename=current_user AND application_name=current_setting('application_name') AND wait_event_type='Lock' AND pid<>pg_backend_pid()`);
          polls++;
          if (observation.rows[0].n === 1 && performance.now() - polling <= 1500) {observedWait = true; break;}
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert(observedWait, 'FAULT_UTC_LOCK_WAIT_INCONCLUSIVE');
        while (performance.now() - started < 5000) {
          // Volatile DB clock is observed on the owned blocker; polling also
          // avoids an idle blocker while preserving the existing5s limits.
          const clock = await blocker.query<{expired: boolean}>('SELECT "expiresAt"<=clock_timestamp() AS expired FROM public."ProtectedCredential" WHERE id=$1', [expired.credentialId]);
          if (clock.rows[0].expired) {actuallyExpired = true; break;}
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert(actuallyExpired, 'FAULT_EXPIRY_OBSERVATION_INCONCLUSIVE');
      } finally {
        gate.cancel();
        try {await blocker.query('ROLLBACK');} finally {blocker.release(); if (attempt) outcome = await attempt;}
      }
      const retained = await query<{ok: boolean}>(`SELECT c."consumedAt" IS NULL AND s.generation=0 AND se."revokedAt" IS NULL AND u.password=$2 AS ok
        FROM public."ProtectedCredential" c JOIN public."AuthSecurityState" s ON s."userId"=c."userId"
        JOIN public."User" u ON u.id=c."userId" JOIN public."Session" se ON se.id=$3 WHERE c.id=$1`,
      [expired.credentialId, '$2b$12$' + '.'.repeat(53), expired.sessionId]);
      assert(outcome === 'invalid' && observedWait && actuallyExpired && retained.rows[0].ok && performance.now() - started < 15000, 'FAULT_UTC_POSTLOCK_DENIAL_FAILED');
      evidence.expiry = {databaseEqualityRejected: true, fullServiceExpiredRejected: true, fullServiceExactEqualityProved: false,
        postLockWaitObserved: observedWait, expiredWhileLocked: actuallyExpired, passwordAndSessionUnchanged: true, composedBoundaryProved: true,
        lockPolls: polls, totalElapsedMs: Math.round(performance.now() - started)};
      approval.checkpoint?.();
      return;
    }
    const expired = await resetFixture(1000);
    // Expiry is immutable in the accepted schema. Observe actual DB expiry of
    // the original credential; never UPDATE the timestamp or disable its trigger.
    const expiryStarted = performance.now(); let actuallyExpired = false;
    while (performance.now() - expiryStarted < 2000) {
      const observation = await query<{expired: boolean}>('SELECT "expiresAt"<=clock_timestamp() AS expired FROM public."ProtectedCredential" WHERE id=$1', [expired.credentialId]);
      if (observation.rows[0].expired) { actuallyExpired = true; break; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert(actuallyExpired, 'FAULT_EXPIRY_OBSERVATION_INCONCLUSIVE');
    let denied = false;
    try { await services(store).resetPassword({token: expired.token, password: 'SyntheticProof12!'}); }
    catch (error) { denied = error instanceof AppError && error.statusCode === 400; }
    const unused = await query<{ok: boolean}>(`SELECT c."consumedAt" IS NULL AND s.generation=0 AS ok
      FROM public."ProtectedCredential" c JOIN public."AuthSecurityState" s ON s."userId"=c."userId" WHERE c.id=$1`, [expired.credentialId]);
    assert(denied && unused.rows[0].ok, 'FAULT_SERVICE_EXPIRY_FAILED');
    evidence.expiry = {databaseEqualityRejected: true, fullServiceExpiredRejected: true, fullServiceExactEqualityProved: false};
    approval.checkpoint?.();
  } catch (error) { approval.checkpoint?.(error); throw new Error('PHASE1_FAULT_PROOF_STOPPED_PRESERVE_LEDGER'); }
  finally { key.fill(0); digestKey.fill(0); }
}
