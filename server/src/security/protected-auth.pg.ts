import type { Pool, PoolClient } from 'pg';
import type { AccountBinding, AuthTransaction, Credential, Lease, ProtectedAuthStore, ProtectedJob } from './protected-auth.js';
import { parseEnvelope } from './protected-envelope.js';

// No Pool constructor, environment loading, startup query or implicit connection.
// Only trusted composition may supply a separately approved pool after schema activation.
export class PostgresProtectedAuthStore implements ProtectedAuthStore {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  private async unit<T>(work: (db: PoolClient) => Promise<T>): Promise<T> {
    const db = await this.pool.connect();
    let discard = false;
    try {
      await db.query('BEGIN');
      await db.query("SET LOCAL statement_timeout='5s'");
      await db.query("SET LOCAL lock_timeout='5s'");
      const result = await work(db);
      await db.query('COMMIT');
      return result;
    } catch {
      // A failed COMMIT may be ambiguous; never retry the transaction automatically.
      try { await db.query('ROLLBACK'); } catch { discard = true; }
      throw new Error('PROTECTED_STORAGE_FAILED');
    } finally { db.release(discard); }
  }

  transaction<T>(work: (tx: AuthTransaction) => Promise<T>): Promise<T> {
    return this.unit(db => work({
      createAccount: async input => {
        await db.query(`INSERT INTO public."User" (id,email,password,name,role,"emailVerified","updatedAt")
          VALUES ($1,$2,$3,$4,'CUSTOMER',false,clock_timestamp() AT TIME ZONE 'UTC')`,[input.id,input.email,input.passwordHash,input.name]);
      },
      createSession: async input => {
        await db.query(`INSERT INTO public."Session" (id,"userId","refreshTokenHash","expiresAt") VALUES ($1,$2,$3,$4)`,
          [input.id,input.userId,input.digest,input.expiresAt]);
      },
      account: async userId => {
        await db.query('SELECT id FROM public."User" WHERE id=$1 FOR UPDATE', [userId]);
        const r = await db.query<AccountBinding>(`SELECT u.id AS "userId", s.generation, u.email AS recipient
          FROM public."User" u JOIN public."AuthSecurityState" s ON s."userId"=u.id
          WHERE u.id=$1 FOR UPDATE OF s`, [userId]);
        return r.rows[0] ?? null;
      },
      supersede: async (userId, purpose) => {
        await db.query(`UPDATE public."ProtectedCredential" SET "revokedAt"=clock_timestamp()
          WHERE "userId"=$1 AND purpose=$2 AND "consumedAt" IS NULL AND "revokedAt" IS NULL`, [userId, purpose]);
      },
      insertCredential: async c => {
        await db.query(`INSERT INTO public."ProtectedCredential"
          (id,"userId",generation,purpose,digest,"expiresAt","jobId") VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [c.id,c.userId,c.generation,c.purpose,c.digest,c.expiresAt,c.jobId]);
      },
      insertJob: async j => {
        await db.query(`INSERT INTO public."ProtectedAuthJob" (id,"credentialId",envelope)
          VALUES ($1,$2,$3::jsonb)`, [j.id,j.credentialId,JSON.stringify(j.envelope)]);
      },
      revoke: async userId => {
        await db.query(`UPDATE public."AuthSecurityState" SET generation=generation+1 WHERE "userId"=$1`, [userId]);
        await db.query(`UPDATE public."ProtectedCredential" SET "revokedAt"=clock_timestamp()
          WHERE "userId"=$1 AND "consumedAt" IS NULL AND "revokedAt" IS NULL`, [userId]);
        await db.query(`UPDATE public."Session" SET "revokedAt"=clock_timestamp() AT TIME ZONE 'UTC'
          WHERE "userId"=$1 AND "revokedAt" IS NULL`, [userId]);
      },
    }));
  }

  /** New protected-token reader only; existing AUTH-02 path remains pinned and unchanged. */
  consume(id: string, digest: string, purpose: 'verification' | 'reset', passwordHash?: string): Promise<boolean> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || !/^[a-f0-9]{64}$/.test(digest) ||
        purpose !== 'verification' && purpose !== 'reset' ||
        purpose === 'reset' && (!passwordHash || !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(passwordHash))) return Promise.resolve(false);
    return this.unit(async db => {
      await db.query(`SELECT u.id FROM public."User" u JOIN public."ProtectedCredential" c ON c."userId"=u.id WHERE c.id=$1 FOR UPDATE OF u`,[id]);
      await db.query(`SELECT s."userId" FROM public."AuthSecurityState" s JOIN public."ProtectedCredential" c ON c."userId"=s."userId" WHERE c.id=$1 FOR UPDATE OF s`,[id]);
      await db.query('SELECT id FROM public."ProtectedCredential" WHERE id=$1 FOR UPDATE',[id]);
      // Separate statement after lock acquisition: expiry is evaluated against the actual DB wall clock.
      const r = await db.query<{ userId: string }>(`UPDATE public."ProtectedCredential" c SET "consumedAt"=clock_timestamp()
        FROM public."AuthSecurityState" s WHERE c.id=$1 AND c.digest=$2 AND c.purpose=$3
          AND c."consumedAt" IS NULL AND c."revokedAt" IS NULL AND c."expiresAt">clock_timestamp()
          AND s."userId"=c."userId" AND s.generation=c.generation RETURNING c."userId"`,[id,digest,purpose]);
      const userId = r.rows[0]?.userId;
      if (!userId) return false;
      if (purpose === 'verification') await db.query('UPDATE public."User" SET "emailVerified"=true,"updatedAt"=clock_timestamp() AT TIME ZONE \'UTC\' WHERE id=$1',[userId]);
      else {
        await db.query('UPDATE public."User" SET password=$2,"updatedAt"=clock_timestamp() AT TIME ZONE \'UTC\' WHERE id=$1',[userId,passwordHash]);
        await db.query('UPDATE public."AuthSecurityState" SET generation=generation+1 WHERE "userId"=$1',[userId]);
        await db.query('UPDATE public."ProtectedCredential" SET "revokedAt"=clock_timestamp() WHERE "userId"=$1 AND "consumedAt" IS NULL AND "revokedAt" IS NULL',[userId]);
        await db.query('UPDATE public."Session" SET "revokedAt"=clock_timestamp() AT TIME ZONE \'UTC\' WHERE "userId"=$1 AND "revokedAt" IS NULL',[userId]);
      }
      return true;
    });
  }

  claim(jobId: string, workerId: string): Promise<Lease | null> {
    return this.unit(async db => {
      const r = await db.query<Lease>(`UPDATE public."ProtectedAuthJob" SET state='LEASED',
        version=version+1,"workerId"=$2,"leaseUntil"=clock_timestamp()+interval '5 minutes'
        WHERE id=$1 AND (state='PENDING' OR (state='LEASED' AND "leaseUntil"<clock_timestamp()))
        RETURNING id AS "jobId",version,"workerId"`, [jobId,workerId]);
      return r.rows[0] ?? null;
    });
  }

  admit(lease: Lease): Promise<{ credential: Credential; job: ProtectedJob } | null> {
    return this.unit(async db => {
      const r = await db.query<Credential & { envelope: unknown }>(`SELECT c.*, u.email AS recipient,j.envelope
        FROM public."ProtectedAuthJob" j JOIN public."ProtectedCredential" c ON c.id=j."credentialId" AND c."jobId"=j.id
        JOIN public."AuthSecurityState" s ON s."userId"=c."userId" AND s.generation=c.generation
        JOIN public."User" u ON u.id=s."userId"
        WHERE j.id=$1 AND j.version=$2 AND j."workerId"=$3 AND j.state='LEASED'
          AND j."leaseUntil">clock_timestamp() AND c."expiresAt">clock_timestamp()
          AND c."revokedAt" IS NULL AND c."consumedAt" IS NULL`, [lease.jobId,lease.version,lease.workerId]);
      const c = r.rows[0];
      if (!c) return null;
      return { credential: c, job: { id: lease.jobId, credentialId: c.id, envelope: parseEnvelope(c.envelope) } };
    });
  }

  beginSend(lease: Lease): Promise<boolean> {
    return this.unit(async db => {
      // Serialize send admission and all supported account-generation/revocation writers.
      await db.query(`SELECT u.id FROM public."User" u JOIN public."ProtectedCredential" c ON c."userId"=u.id
        WHERE c."jobId"=$1 FOR UPDATE OF u`, [lease.jobId]);
      await db.query(`SELECT s."userId" FROM public."AuthSecurityState" s
        JOIN public."ProtectedCredential" c ON c."userId"=s."userId"
        WHERE c."jobId"=$1 FOR UPDATE OF s`, [lease.jobId]);
      const r = await db.query(`UPDATE public."ProtectedAuthJob" j SET state='SENDING'
        FROM public."ProtectedCredential" c, public."AuthSecurityState" s, public."User" u
        WHERE j.id=$1 AND j.version=$2 AND j."workerId"=$3 AND j.state='LEASED'
          AND j."leaseUntil">clock_timestamp() AND c.id=j."credentialId" AND c."jobId"=j.id
          AND c."expiresAt">clock_timestamp() AND c."revokedAt" IS NULL AND c."consumedAt" IS NULL
          AND s."userId"=c."userId" AND s.generation=c.generation AND u.id=s."userId"`,
      [lease.jobId,lease.version,lease.workerId]);
      return r.rowCount === 1;
    });
  }

  finish(lease: Lease, outcome: 'submitted' | 'suppressed' | 'ambiguous'): Promise<boolean> {
    return this.unit(async db => {
      const r = await db.query(`UPDATE public."ProtectedAuthJob" SET state=$4
        WHERE id=$1 AND version=$2 AND "workerId"=$3 AND state='SENDING' AND "leaseUntil">clock_timestamp()`,
      [lease.jobId,lease.version,lease.workerId,{ submitted:'SUBMITTED',suppressed:'SUPPRESSED',ambiguous:'AMBIGUOUS' }[outcome]]);
      return r.rowCount === 1;
    });
  }
}
