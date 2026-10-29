import type { Pool } from 'pg';
import { types } from 'node:util';
import { openEnvelope, sealEnvelope, protectedContext, type Envelope, type EnvelopeKeys } from './protected-envelope.js';

export interface PassengerSecretRecord { passengerId: string; bookingId: string; revision: number; envelope: Envelope }
export interface PassengerSecretStore {
  load(passengerId: string, bookingId: string): Promise<PassengerSecretRecord | null>;
  compareAndSet(record: PassengerSecretRecord, expectedRevision: number): Promise<boolean>;
}
export interface PassengerAccess {
  authorize(action: 'read' | 'write', bookingId: string, passengerId: string): Promise<boolean>;
}
export interface DocumentFields { passportNumber: string; passportExpiry: string; dateOfBirth: string; nationality: string }
const names = ['dateOfBirth','nationality','passportExpiry','passportNumber'];
function document(value: unknown): DocumentFields {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getOwnPropertySymbols(value).length ||
      Object.getOwnPropertyNames(value).sort().join(',') !== names.join(',')) throw new Error('PASSENGER_SECRET_FAILED');
  const r: Record<string, string> = {};
  for (const name of names) {
    const d = Object.getOwnPropertyDescriptor(value, name);
    if (!d || !('value' in d) || typeof d.value !== 'string' || d.value.length > 64 || /[\x00-\x1f\x7f]/.test(d.value)) throw new Error('PASSENGER_SECRET_FAILED');
    r[name] = d.value;
  }
  return { passportNumber:r.passportNumber,passportExpiry:r.passportExpiry,dateOfBirth:r.dateOfBirth,nationality:r.nationality };
}
function aad(bookingId: string, passengerId: string, revision: number): Buffer {
  return protectedContext('passenger-record','passenger-document',bookingId,passengerId,revision);
}
export async function writePassengerSecret(store: PassengerSecretStore, access: PassengerAccess, keys: EnvelopeKeys,
  keyRef: string, bookingId: string, passengerId: string, expectedRevision: number, fields: DocumentFields): Promise<number> {
  let bytes: Buffer | undefined;
  try {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= 2147483646 ||
        await access.authorize('write',bookingId,passengerId) !== true) throw new Error();
    const revision = expectedRevision + 1;
    bytes = Buffer.from(JSON.stringify(document(fields)));
    const envelope = await sealEnvelope(bytes,'passenger-document',aad(bookingId,passengerId,revision),keyRef,keys);
    if (!await store.compareAndSet({ bookingId,passengerId,revision,envelope },expectedRevision)) throw new Error();
    return revision;
  } catch { throw new Error('PASSENGER_SECRET_FAILED'); }
  finally { bytes?.fill(0); }
}
export async function readPassengerSecret(store: PassengerSecretStore, access: PassengerAccess, keys: EnvelopeKeys,
  bookingId: string, passengerId: string): Promise<DocumentFields | null> {
  let bytes: Uint8Array | undefined;
  try {
    if (await access.authorize('read',bookingId,passengerId) !== true) throw new Error();
    const record = await store.load(passengerId,bookingId);
    if (!record) return null;
    if (record.bookingId !== bookingId || record.passengerId !== passengerId || !Number.isSafeInteger(record.revision) || record.revision < 1) throw new Error();
    bytes = await openEnvelope(record.envelope,'passenger-document',aad(bookingId,passengerId,record.revision),keys);
    return document(JSON.parse(Buffer.from(bytes).toString('utf8')));
  } catch { throw new Error('PASSENGER_SECRET_FAILED'); }
  finally { bytes?.fill(0); }
}

// No raw-field fallback, migration, default guest authorization or automatic read/decrypt on lists.
export class PostgresPassengerSecretStore implements PassengerSecretStore {
  constructor(private readonly pool: Pick<Pool,'query'>) {}
  async load(passengerId: string, bookingId: string): Promise<PassengerSecretRecord | null> {
    const r = await this.pool.query<PassengerSecretRecord>(`SELECT s.* FROM public."PassengerSecret" s
      JOIN public."BookingPassenger" p ON p.id=s."passengerId" AND p."bookingId"=s."bookingId"
      WHERE s."passengerId"=$1 AND s."bookingId"=$2`,[passengerId,bookingId]);
    return r.rows[0] ?? null;
  }
  async compareAndSet(r: PassengerSecretRecord, expected: number): Promise<boolean> {
    if (r.revision !== expected+1) return false;
    const result = expected === 0
      ? await this.pool.query(`INSERT INTO public."PassengerSecret" ("passengerId","bookingId",revision,envelope)
          SELECT id,"bookingId",$3,$4::jsonb FROM public."BookingPassenger" WHERE id=$1 AND "bookingId"=$2
          ON CONFLICT ("passengerId") DO NOTHING`,[r.passengerId,r.bookingId,r.revision,JSON.stringify(r.envelope)])
      : await this.pool.query(`UPDATE public."PassengerSecret" s SET revision=$3,envelope=$4::jsonb,"updatedAt"=clock_timestamp()
          FROM public."BookingPassenger" p WHERE s."passengerId"=$1 AND s."bookingId"=$2 AND s.revision=$5
          AND p.id=s."passengerId" AND p."bookingId"=s."bookingId"`,[r.passengerId,r.bookingId,r.revision,JSON.stringify(r.envelope),expected]);
    return result.rowCount === 1;
  }
}
