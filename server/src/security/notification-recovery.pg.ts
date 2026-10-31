import type { Pool } from 'pg';
import type { NotificationCompatibilityStore, QuarantineRecord, QuarantineReason } from './notification-recovery.js';

export class PostgresNotificationQuarantineStore implements NotificationCompatibilityStore {
  constructor(protected readonly pool:Pick<Pool,'connect'>){}
  async quarantineReason(record:QuarantineRecord):Promise<QuarantineReason|null>{
    const db=await this.pool.connect();let discard=false;
    try{
      await db.query('BEGIN READ ONLY');await db.query("SET LOCAL statement_timeout='5s'");
      const r=await db.query<{reason:QuarantineReason}>(`SELECT reason FROM public."NotificationQuarantine" WHERE source=$1 AND "recordId"=$2`,[record.source,record.id]);
      await db.query('ROLLBACK');
      const reason=r.rows[0]?.reason;
      if(reason===undefined)return null;
      return ['LEGACY_AUTH','UNKNOWN_FORMAT','MALFORMED','RESTORED','AMBIGUOUS_SEND'].includes(reason)?reason:'MALFORMED';
    }catch{try{await db.query('ROLLBACK');}catch{discard=true;}throw new Error('NOTIFICATION_QUARANTINE_STORAGE_FAILED');}
    finally{db.release(discard);}
  }
  async quarantine(record:QuarantineRecord,reason:QuarantineReason):Promise<boolean>{
    const db=await this.pool.connect();let discard=false;
    try{
      await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='5s'");await db.query("SET LOCAL lock_timeout='5s'");
      const row=record.source==='ordinary'
        ? await db.query(`SELECT id FROM public."NotificationOutbox" WHERE id=$1 AND "updatedAt"=$2::timestamp AND status::text=$3 FOR UPDATE`,[record.id,record.version,record.state])
        : await db.query(`SELECT id FROM public."ProtectedAuthJob" WHERE id=$1 AND version=$2::integer AND state=$3 FOR UPDATE`,[record.id,record.version,record.state]);
      if(row.rowCount!==1){await db.query('ROLLBACK');return false;}
      await db.query(`INSERT INTO public."NotificationQuarantine" (source,"recordId",reason,"observedVersion")
        VALUES ($1,$2,$3,$4) ON CONFLICT (source,"recordId") DO NOTHING`,[record.source,record.id,reason,record.version]);
      if(record.source==='ordinary'&&record.state!=='DELIVERED')await db.query(`UPDATE public."NotificationOutbox"
        SET status='FAILED',error='NOTIFICATION_QUARANTINED',"updatedAt"=GREATEST(clock_timestamp() AT TIME ZONE 'UTC',"updatedAt"+interval '1 millisecond') WHERE id=$1`,[record.id]);
      if(record.source==='protected'&&!['SENDING','AMBIGUOUS','SUBMITTED','SUPPRESSED','QUARANTINED'].includes(record.state))await db.query(`UPDATE public."ProtectedAuthJob"
        SET state='QUARANTINED',version=version+1,"workerId"=NULL,"leaseUntil"=NULL WHERE id=$1`,[record.id]);
      await db.query('COMMIT');return true;
    }catch{
      try{await db.query('ROLLBACK');}catch{discard=true;}
      throw new Error('NOTIFICATION_QUARANTINE_STORAGE_FAILED');
    }finally{db.release(discard);}
  }
}
