import type { PoolClient } from 'pg';
import { PostgresNotificationQuarantineStore } from './notification-recovery.pg.js';
import type { QuarantineRecord } from './notification-recovery.js';
import type { CompatibleOutboxStore, NotificationSnapshot, OrdinaryLease, DeliveryOutcome } from '../services/compatible-outbox.service.js';

const version=`to_char(n."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const noQuarantine=`NOT EXISTS(SELECT 1 FROM public."NotificationQuarantine" q WHERE q.source='ordinary' AND q."recordId"=n.id)`;
const noIntent=`NOT EXISTS(SELECT 1 FROM public."NotificationSendIntent" i WHERE i."recordId"=n.id)`;
const owned=`n.status='PROCESSING' AND n."updatedAt"=$2::timestamp AND l.version=n."updatedAt"
  AND l."workerId"=$3 AND l."leaseUntil">clock_timestamp()`;

/** Explicitly supplied pool; never constructed or selected by current worker startup. */
export class PostgresCompatibleOutboxStore extends PostgresNotificationQuarantineStore implements CompatibleOutboxStore {
  private async unit<T>(work:(db:PoolClient)=>Promise<T>):Promise<T>{
    let db:PoolClient|undefined,discard=false,committing=false;
    try{db=await this.pool.connect();await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='5s'");await db.query("SET LOCAL lock_timeout='5s'");
      await db.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');const result=await work(db);committing=true;await db.query('COMMIT');return result;
    }catch{discard=committing;if(db){try{await db.query('ROLLBACK');}catch{discard=true;}}throw new Error('COMPATIBLE_OUTBOX_STORAGE_FAILED');}
    finally{db?.release(discard);}
  }
  load(source:'ordinary'|'protected',id:string):Promise<NotificationSnapshot|null>{
    return this.unit(async db=>{
      const result=source==='ordinary'
        ? await db.query<NotificationSnapshot>(`SELECT 'ordinary' AS source,n.id,${version} AS version,n.status::text AS state,n.payload,n.recipient,n.subject,n.channel FROM public."NotificationOutbox" n WHERE n.id=$1`,[id])
        : await db.query<NotificationSnapshot>(`SELECT 'protected' AS source,id,version::text,state,envelope AS payload,NULL AS recipient,NULL AS subject,NULL AS channel FROM public."ProtectedAuthJob" WHERE id=$1`,[id]);
      return result.rows[0]??null;
    });
  }
  next(sources:readonly ('ordinary'|'protected')[]):Promise<Array<{source:'ordinary'|'protected';id:string}>>{
    return this.unit(async db=>{
      if(!sources.length||sources.length>2||new Set(sources).size!==sources.length||sources.some(s=>s!=='ordinary'&&s!=='protected'))throw new Error();
      const selects:string[]=[];
      if(sources.includes('ordinary'))selects.push(`SELECT 'ordinary' AS source,n.id,n."createdAt" AS queued FROM public."NotificationOutbox" n
        LEFT JOIN public."CompatibleNotificationLease" l ON l."recordId"=n.id
        WHERE n."nextAttemptAt"<=clock_timestamp() AT TIME ZONE 'UTC' AND n.attempts<n."maxAttempts" AND ${noQuarantine} AND ${noIntent}
          AND (n.status='PENDING' OR (n.status='PROCESSING' AND l.version=n."updatedAt" AND l."leaseUntil"<clock_timestamp()))`);
      if(sources.includes('protected'))selects.push(`SELECT 'protected' AS source,j.id,j."createdAt" AT TIME ZONE 'UTC' AS queued
        FROM public."ProtectedAuthJob" j JOIN public."ProtectedCredential" c ON c.id=j."credentialId"
        JOIN public."AuthSecurityState" s ON s."userId"=c."userId" AND s.generation=c.generation
        WHERE (j.state='PENDING' OR (j.state='LEASED' AND j."leaseUntil"<clock_timestamp())) AND c."expiresAt">clock_timestamp()
          AND c."consumedAt" IS NULL AND c."revokedAt" IS NULL AND s."legacyRetiredAt" IS NOT NULL
          AND NOT EXISTS(SELECT 1 FROM public."NotificationQuarantine" q WHERE q.source='protected' AND q."recordId"=j.id)`);
      // Every fragment above is a closed source branch, never request-provided SQL.
      return (await db.query<{source:'ordinary'|'protected';id:string}>(`SELECT source,id FROM (${selects.join(' UNION ALL ')}) candidates ORDER BY queued,id LIMIT 3`)).rows;
    });
  }
  claimOrdinary(record:QuarantineRecord,workerId:string):Promise<OrdinaryLease|null>{
    return this.unit(async db=>{
      const r=await db.query(`SELECT n.id FROM public."NotificationOutbox" n LEFT JOIN public."CompatibleNotificationLease" l ON l."recordId"=n.id
        WHERE n.id=$1 AND n."updatedAt"=$2::timestamp AND n.status::text=$3 AND n.attempts<n."maxAttempts"
          AND (n.status='PENDING' OR (n.status='PROCESSING' AND l.version=n."updatedAt" AND l."leaseUntil"<clock_timestamp()))
          AND ${noQuarantine} AND ${noIntent} FOR UPDATE OF n`,[record.id,record.version,record.state]);
      if(r.rowCount!==1)return null;
      const changed=await db.query<{version:string}>(`UPDATE public."NotificationOutbox" n SET status='PROCESSING',
        "updatedAt"=GREATEST(date_trunc('milliseconds',clock_timestamp() AT TIME ZONE 'UTC'),n."updatedAt"+interval '1 millisecond')
        WHERE id=$1 RETURNING ${version} AS version`,[record.id]);
      const v=changed.rows[0]?.version;if(!v)throw new Error();
      await db.query(`INSERT INTO public."CompatibleNotificationLease" ("recordId",version,"workerId","leaseUntil")
        VALUES ($1,$2::timestamp,$3,clock_timestamp()+interval '5 minutes') ON CONFLICT ("recordId")
        DO UPDATE SET version=EXCLUDED.version,"workerId"=EXCLUDED."workerId","leaseUntil"=EXCLUDED."leaseUntil"`,[record.id,v,workerId]);
      return {jobId:record.id,version:v,workerId};
    });
  }
  beginOrdinarySend(lease:OrdinaryLease):Promise<boolean>{
    return this.unit(async db=>{
      const args=[lease.jobId,lease.version,lease.workerId];
      const r=await db.query(`SELECT n.id FROM public."NotificationOutbox" n JOIN public."CompatibleNotificationLease" l ON l."recordId"=n.id
        WHERE n.id=$1 AND ${owned} AND ${noQuarantine} AND ${noIntent} AND n.attempts<n."maxAttempts" FOR UPDATE OF n`,args);
      if(r.rowCount!==1)return false;
      const intent=await db.query(`INSERT INTO public."NotificationSendIntent" ("recordId",version,state)
        VALUES ($1,$2::timestamp,'SENDING') ON CONFLICT DO NOTHING RETURNING "recordId"`,args.slice(0,2));
      if(intent.rowCount!==1)return false;
      await db.query('UPDATE public."NotificationOutbox" SET attempts=attempts+1 WHERE id=$1',[lease.jobId]);return true;
    });
  }
  finishOrdinary(lease:OrdinaryLease,outcome:DeliveryOutcome):Promise<boolean>{
    return this.unit(async db=>{
      const args=[lease.jobId,lease.version,lease.workerId];
      const r=await db.query(`SELECT n.id FROM public."NotificationOutbox" n JOIN public."CompatibleNotificationLease" l ON l."recordId"=n.id
        JOIN public."NotificationSendIntent" i ON i."recordId"=n.id AND i.version=n."updatedAt" AND i.state='SENDING'
        WHERE n.id=$1 AND ${owned} AND ${noQuarantine} FOR UPDATE OF n`,args);
      if(r.rowCount!==1)return false;
      await db.query(`UPDATE public."NotificationSendIntent" SET state=$3 WHERE "recordId"=$1 AND version=$2::timestamp`,[lease.jobId,lease.version,{submitted:'SUBMITTED',suppressed:'SUPPRESSED',ambiguous:'AMBIGUOUS'}[outcome]]);
      await db.query(`UPDATE public."NotificationOutbox" SET status=$2::public."NotificationStatus",error=$3,"processedAt"=clock_timestamp() AT TIME ZONE 'UTC',
        "updatedAt"=GREATEST(date_trunc('milliseconds',clock_timestamp() AT TIME ZONE 'UTC'),"updatedAt"+interval '1 millisecond') WHERE id=$1`,
        [lease.jobId,outcome==='submitted'?'DELIVERED':'FAILED',outcome==='submitted'?null:outcome==='suppressed'?'DELIVERY_SUPPRESSED':'AMBIGUOUS_SEND']);return true;
    });
  }
  failBeforeSend(lease:OrdinaryLease):Promise<boolean>{
    return this.unit(async db=>{
      const r=await db.query(`UPDATE public."NotificationOutbox" n SET status='FAILED',error='SAFE_PRE_SEND_FAILURE',attempts=attempts+1,
        "updatedAt"=GREATEST(date_trunc('milliseconds',clock_timestamp() AT TIME ZONE 'UTC'),n."updatedAt"+interval '1 millisecond')
        FROM public."CompatibleNotificationLease" l WHERE l."recordId"=n.id AND n.id=$1 AND ${owned} AND ${noIntent} AND ${noQuarantine}`,[lease.jobId,lease.version,lease.workerId]);
      return r.rowCount===1;
    });
  }
  redriveOrdinary(record:QuarantineRecord):Promise<boolean>{
    return this.unit(async db=>{
      const r=await db.query(`UPDATE public."NotificationOutbox" n SET status='PENDING',error=NULL,"nextAttemptAt"=clock_timestamp() AT TIME ZONE 'UTC',
        "updatedAt"=GREATEST(date_trunc('milliseconds',clock_timestamp() AT TIME ZONE 'UTC'),n."updatedAt"+interval '1 millisecond')
        WHERE n.id=$1 AND n."updatedAt"=$2::timestamp AND n.status='FAILED' AND n.error='SAFE_PRE_SEND_FAILURE'
          AND n.attempts<n."maxAttempts" AND ${noIntent} AND ${noQuarantine}`,[record.id,record.version]);return r.rowCount===1;
    });
  }
}
