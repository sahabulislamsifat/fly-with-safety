import {randomUUID} from 'node:crypto';
import type {Pool, QueryResultRow} from 'pg';
import {PostgresCompatibleOutboxStore} from '../src/security/compatible-outbox.pg.js';
import {quarantineIncompatible, quarantineRestoredBatch, type QuarantineRecord} from '../src/security/notification-recovery.js';
import {serviceTarget} from './phase1-service.integration.js';
import type {CompatibleOutboxStore} from '../src/services/compatible-outbox.service.js';

const check = (value: unknown): void => {if (!value) throw new Error('PHASE1_ORDINARY_PROOF_FAILED');};
/** Real ordinary adapter proof; inert on import. Requires a separately reviewed
 * target-only permission delta. No grant, transport/provider, DELETE or cleanup.
 * Existing six-table service-role proof is not permission for these four tables.
 */
export async function verifyOrdinaryServiceAdapters(pool: Pick<Pool, 'connect'>, approval: {
  approved: boolean; syntheticOnly: boolean; permissionDeltaApproved: boolean;
  record(id: string): Promise<void>; completed?(stage: 'fencing' | 'safe-redrive' | 'legacy-quarantine' | 'restore-quarantine' | 'application-worker'): void;
  stage?(stage: 'fencing' | 'safe-redrive' | 'legacy-quarantine' | 'restore-quarantine' | 'application-worker'): void;
  applicationWorker?(store:CompatibleOutboxStore,id:string):Promise<void>;
  failure?(error: unknown): void;
}): Promise<void> {
  if (approval?.approved !== true || approval.syntheticOnly !== true || approval.permissionDeltaApproved !== true || typeof approval.record !== 'function')
    throw new Error('PHASE1_ORDINARY_APPROVAL_REQUIRED');
  if(approval.applicationWorker!==undefined && typeof approval.applicationWorker!=='function')throw new Error('PHASE1_ORDINARY_APPROVAL_REQUIRED');
  const query = async <T extends QueryResultRow>(sql: string, args: unknown[] = []) => {
    const db = await pool.connect(); try {return await db.query<T>(sql, args);} finally {db.release();}
  };
  const guard = await query<{ok: boolean}>(`SELECT current_database()=$1 AND current_user=$2 AND session_user=$2
    AND host(inet_server_addr())='127.0.0.1' AND inet_server_port()=5432
    AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolinherit
    AND NOT r.rolreplication AND NOT r.rolbypassrls AND r.rolconnlimit=20
    AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid OR roleid=r.oid)
    AND NOT has_database_privilege(current_user,current_database(),'CREATE,TEMP') AND NOT has_schema_privilege(current_user,'public','CREATE')
    AND NOT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid())
    AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['NotificationOutbox','CompatibleNotificationLease','NotificationSendIntent']) needed(name)
      WHERE NOT has_table_privilege(current_user,format('public.%I',needed.name),'SELECT')
       OR NOT has_table_privilege(current_user,format('public.%I',needed.name),'INSERT')
       OR NOT has_table_privilege(current_user,format('public.%I',needed.name),'UPDATE'))
    AND has_table_privilege(current_user,'public."NotificationQuarantine"','SELECT')
    AND has_table_privilege(current_user,'public."NotificationQuarantine"','INSERT')
    AND NOT has_any_column_privilege(current_user,'public."NotificationQuarantine"','UPDATE,REFERENCES')
    AND NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN('r','p')
      AND (c.relowner=r.oid OR has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR (c.relname<>ALL(ARRAY['User','AuthSecurityState','ProtectedCredential','ProtectedAuthJob','Session','AuthIssuanceRequest','NotificationQuarantine','NotificationOutbox','CompatibleNotificationLease','NotificationSendIntent'])
         AND has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))))
    AND NOT EXISTS(SELECT 1 FROM public."NotificationOutbox") AND NOT EXISTS(SELECT 1 FROM public."CompatibleNotificationLease")
    AND NOT EXISTS(SELECT 1 FROM public."NotificationSendIntent") AND NOT EXISTS(SELECT 1 FROM public."NotificationQuarantine") AS ok
    FROM pg_roles r WHERE rolname=current_user`, [serviceTarget.database, serviceTarget.role])
    .catch(() => {throw new Error('PHASE1_ORDINARY_PREFLIGHT_FAILED');});
  if (guard.rows.length !== 1 || guard.rows[0].ok !== true) throw new Error('PHASE1_ORDINARY_PREFLIGHT_FAILED');
  const store = new PostgresCompatibleOutboxStore(pool);
  const fixture = async (legacy = false) => {
    const id = randomUUID(); await approval.record(id); // Durable ID journal must precede INSERT.
    await query(`INSERT INTO public."NotificationOutbox" (id,recipient,subject,payload,"updatedAt")
      VALUES ($1,'synthetic@example.invalid','Synthetic integration',$2::jsonb,clock_timestamp() AT TIME ZONE 'UTC')`,
    [id, JSON.stringify({template: legacy ? 'EMAIL_VERIFICATION' : 'CONTACT_CONFIRMATION', params: {name: 'Synthetic'}})]);
    const snapshot = await store.load('ordinary', id); check(snapshot); return snapshot!;
  };
  const snapshot = async (id: string): Promise<QuarantineRecord> => {
    const row = await store.load('ordinary', id); check(row); return {source: 'ordinary', id, version: row!.version, state: row!.state};
  };
  try {
    approval.stage?.('fencing');
    const first = await fixture(), record = await snapshot(first.id);
    const contenders = await Promise.allSettled(Array.from({length: 16}, (_, index) => store.claimOrdinary(record, 'ordinary_' + index)));
    check(contenders.every(item => item.status === 'fulfilled'));
    const winners = contenders.flatMap(item => item.status === 'fulfilled' && item.value ? [item.value] : []); check(winners.length === 1);
    const lease = winners[0];
    check(!await store.beginOrdinarySend({...lease, workerId: 'stale_worker'}));
    check(await store.beginOrdinarySend(lease)); check(!await store.beginOrdinarySend(lease));
    check(await store.finishOrdinary(lease, 'ambiguous'));
    check(!await store.redriveOrdinary(await snapshot(first.id))); check(await store.claimOrdinary(await snapshot(first.id), 'redriver') === null);
    approval.completed?.('fencing');
    approval.stage?.('safe-redrive');
    const second = await fixture(), beforeSend = await store.claimOrdinary(await snapshot(second.id), 'safe_worker'); check(beforeSend);
    check(await store.failBeforeSend(beforeSend!));
    const failed = await snapshot(second.id);
    check(!await store.redriveOrdinary({...failed, version: second.version})); check(await store.redriveOrdinary(failed));
    check(!await store.redriveOrdinary(failed));
    const recovered = await store.claimOrdinary(await snapshot(second.id), 'safe_worker'); check(recovered);
    check(await store.beginOrdinarySend(recovered!)); check(await store.finishOrdinary(recovered!, 'suppressed'));
    check(!await store.redriveOrdinary(await snapshot(second.id)));
    approval.completed?.('safe-redrive');
    approval.stage?.('legacy-quarantine');
    const third = await fixture(true), thirdRecord = await snapshot(third.id);
    const legacy = await quarantineIncompatible(store, thirdRecord, third.payload);
    check(legacy.kind === 'quarantine' && legacy.reason === 'LEGACY_AUTH');
    check(await store.quarantineReason(thirdRecord) === 'LEGACY_AUTH');
    check(!await store.redriveOrdinary(await snapshot(third.id))); check(await store.claimOrdinary(await snapshot(third.id), 'denied_worker') === null);
    approval.completed?.('legacy-quarantine');
    approval.stage?.('restore-quarantine');
    const fourth = await fixture(), restoredRecord = await snapshot(fourth.id);
    check(await quarantineRestoredBatch(store, [restoredRecord]) === 1); check(await store.quarantineReason(restoredRecord) === 'RESTORED');
    check(!await store.redriveOrdinary(await snapshot(fourth.id))); check(await store.claimOrdinary(await snapshot(fourth.id), 'denied_worker') === null);
    check(!(await store.next(['ordinary'])).some(item => [first.id, second.id, third.id, fourth.id].includes(item.id)));
    approval.completed?.('restore-quarantine');
    if(approval.applicationWorker){
      approval.stage?.('application-worker');
      const fifth=await fixture();
      await approval.applicationWorker(store,fifth.id);
      const retained=await query<{ok:boolean}>(`SELECT n.status='FAILED' AND n.error='DELIVERY_SUPPRESSED' AND i.state='SUPPRESSED' AS ok
        FROM public."NotificationOutbox" n JOIN public."NotificationSendIntent" i ON i."recordId"=n.id WHERE n.id=$1`,[fifth.id]);
      check(retained.rows.length===1 && retained.rows[0].ok);
      check(!await store.redriveOrdinary(await snapshot(fifth.id)));
      approval.completed?.('application-worker');
    }
  } catch (error) {approval.failure?.(error); throw new Error('PHASE1_ORDINARY_PROOF_STOPPED_PRESERVE_LEDGER');}
}
