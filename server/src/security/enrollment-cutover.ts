import type { Pool, PoolClient } from 'pg';
import { types } from 'node:util';
import type { RecoveryAdmission } from './issuance-replay.js';

export interface EnrollmentTransaction {
  lockUser(id:string):Promise<'missing'|'legacy'|'enrolled'>;
  enroll(id:string):Promise<void>;
  retireLegacy(id:string):Promise<void>;
}
export interface EnrollmentStore {transaction<T>(work:(tx:EnrollmentTransaction)=>Promise<T>):Promise<T>}
export interface CutoverProbe {
  /** Trusted external verifier; not a request body or a flag in the restored DB.
   * Must verify deployment identity, stopped old processes, enrollment and review evidence.
   */
  verify(schemaHash:string,signal:AbortSignal):Promise<boolean>;
}
export class CutoverAdmission implements RecoveryAdmission {
  constructor(private readonly epoch:RecoveryAdmission,private readonly probe:CutoverProbe,private readonly schemaHash:string){
    if(typeof epoch?.admit!=='function'||typeof probe?.verify!=='function'||!/^[a-f0-9]{64}$/.test(schemaHash))throw new Error('CUTOVER_CONFIGURATION_INVALID');
  }
  async admit(action:'issue'|'consume'|'deliver'):Promise<boolean>{
    if(!['issue','consume','deliver'].includes(action))return false;
    const controller=new AbortController(),deadline=performance.now()+500;let timer:ReturnType<typeof setTimeout>|undefined;
    try{
      const ready=await Promise.race([
        Promise.resolve().then(()=>{if(controller.signal.aborted)throw new Error();return this.probe.verify(this.schemaHash,controller.signal);}),
        new Promise<false>(resolve=>{timer=setTimeout(()=>{controller.abort();resolve(false);},500);}),
      ]);
      return ready===true&&performance.now()<deadline&&await this.epoch.admit(action)===true;
    }catch{return false;}finally{clearTimeout(timer);controller.abort();}
  }
}
/** Exact manifest only. No enumeration/import of raw legacy credentials or arbitrary SQL. */
export async function enrollLegacyAccounts(store:EnrollmentStore,operator:string,manifest:readonly string[],
  authorize:(operator:string)=>Promise<boolean>,quiesced:CutoverProbe,schemaHash:string):Promise<{enrolled:number;alreadyEnrolled:number}>{
  try{
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(operator)||!Array.isArray(manifest)||types.isProxy(manifest)||
      manifest.length<1||manifest.length>100||!/^[a-f0-9]{64}$/.test(schemaHash))throw new Error();
    const ids:string[]=[];
    for(let i=0;i<manifest.length;i++){const d=Object.getOwnPropertyDescriptor(manifest,String(i));
      if(!d||!('value'in d)||typeof d.value!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(d.value))throw new Error();ids.push(d.value);}
    if(new Set(ids).size!==ids.length||await authorize(operator)!==true)throw new Error();
    // External quiescence proof must cover the whole operation, not merely one callback.
    const gate=new CutoverAdmission({admit:async()=>true},quiesced,schemaHash);
    if(!await gate.admit('issue'))throw new Error();
    return await store.transaction(async tx=>{
      let enrolled=0,alreadyEnrolled=0;
      for(const id of ids.sort()){
        const state=await tx.lockUser(id);if(state==='missing')throw new Error();
        if(state==='enrolled'){alreadyEnrolled++;continue;}
        await tx.enroll(id);await tx.retireLegacy(id);enrolled++;
      }
      if(!await gate.admit('issue'))throw new Error();
      return {enrolled,alreadyEnrolled};
    });
  }catch{throw new Error('ENROLLMENT_FAILED_REQUIRES_REVIEW');} // No automatic retry, including uncertain COMMIT.
}
/** Inert until explicitly supplied a reviewed isolated pool and invoked with owner-approved manifest. */
export class PostgresEnrollmentStore implements EnrollmentStore {
  private readonly target:{database:string;role:string};
  constructor(private readonly pool:Pick<Pool,'connect'>,target:{database:string;role:string}){
    if(!/^flywithsafe_phase1_[a-z0-9_]+_integration$/.test(target?.database)||! /^[a-z0-9_]{1,63}$/.test(target?.role))throw new Error('ENROLLMENT_TARGET_INVALID');
    this.target=Object.freeze({...target});
  }
  async transaction<T>(work:(tx:EnrollmentTransaction)=>Promise<T>):Promise<T>{
    let db:PoolClient|undefined,discard=false,committing=false;
    try{
      db=await this.pool.connect();const connection=db;
      await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='5s'");await db.query("SET LOCAL lock_timeout='5s'");
      await db.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      const identity=await db.query<{database:string;role:string;session_role:string;host:string;port:number}>(`SELECT current_database() AS database,current_user AS role,
        session_user AS session_role,host(inet_server_addr()) AS host,inet_server_port() AS port`);
      const actual=identity.rows[0];
      if(!actual||actual.database!==this.target.database||actual.role!==this.target.role||actual.session_role!==this.target.role||actual.host!=='127.0.0.1'||actual.port!==5432)throw new Error('ENROLLMENT_TARGET_MISMATCH');
      const locked=new Map<string,'legacy'|'prepared'|'enrolled'>();
      const result=await work({
        lockUser:async id=>{
          if(locked.has(id))throw new Error('ENROLLMENT_DUPLICATE_LOCK');
          const user=await connection.query('SELECT id FROM public."User" WHERE id=$1 FOR UPDATE',[id]);if(user.rowCount!==1)return 'missing';
          const state=await connection.query<{legacyRetiredAt:unknown}>('SELECT generation,"legacyRetiredAt" FROM public."AuthSecurityState" WHERE "userId"=$1 FOR UPDATE',[id]);
          const kind=state.rowCount===1&&state.rows[0]?.legacyRetiredAt!=null?'enrolled':'legacy';locked.set(id,kind);return kind;
        },
        enroll:async id=>{if(locked.get(id)!=='legacy')throw new Error();await connection.query('INSERT INTO public."AuthSecurityState" ("userId",generation) VALUES ($1,0) ON CONFLICT ("userId") DO NOTHING',[id]);locked.set(id,'prepared');},
        retireLegacy:async id=>{if(locked.get(id)!=='prepared')throw new Error();
          const marked=await connection.query('UPDATE public."AuthSecurityState" SET generation=generation+1,"legacyRetiredAt"=clock_timestamp() WHERE "userId"=$1 AND "legacyRetiredAt" IS NULL',[id]);
          if(marked.rowCount!==1)throw new Error('ENROLLMENT_MARK_FAILED');
          await connection.query('UPDATE public."ProtectedCredential" SET "revokedAt"=clock_timestamp() WHERE "userId"=$1 AND "consumedAt" IS NULL AND "revokedAt" IS NULL',[id]);
          for(const table of ['EmailVerificationToken','PasswordResetToken'])await connection.query(`UPDATE public."${table}" SET "usedAt"=clock_timestamp() AT TIME ZONE 'UTC' WHERE "userId"=$1 AND "usedAt" IS NULL`,[id]);
          await connection.query('UPDATE public."Session" SET "revokedAt"=clock_timestamp() AT TIME ZONE \'UTC\' WHERE "userId"=$1 AND "revokedAt" IS NULL',[id]);locked.set(id,'enrolled');
        },
      });
      if([...locked.values()].some(state=>state!=='enrolled'))throw new Error('ENROLLMENT_INCOMPLETE');
      committing=true;await db.query('COMMIT');return result;
    }catch{discard=committing;if(db){try{await db.query('ROLLBACK');}catch{discard=true;}}throw new Error('ENROLLMENT_STORAGE_FAILED');}
    finally{db?.release(discard);}
  }
}
