import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { openEnvelope, sealEnvelope, protectedContext, type Envelope, type EnvelopeKeys } from './protected-envelope.js';

export type Purpose = 'verification' | 'reset';
export interface AccountBinding { userId: string; generation: number; recipient: string }
export interface Credential extends AccountBinding {
  id: string; jobId: string; purpose: Purpose; digest: string; expiresAt: Date;
  consumedAt: Date | null; revokedAt: Date | null;
}
export interface ProtectedJob { id: string; credentialId: string; envelope: Envelope }
export interface Lease { jobId: string; version: number; workerId: string }
export interface AuthTransaction {
  createAccount(input: { id: string; email: string; passwordHash: string; name: string | null }): Promise<void>;
  createSession(input: { id: string; userId: string; digest: string; expiresAt: Date }): Promise<void>;
  account(userId: string): Promise<AccountBinding | null>;
  supersede(userId: string, purpose: Purpose): Promise<void>;
  insertCredential(credential: Credential): Promise<void>;
  insertJob(job: ProtectedJob): Promise<void>;
  revoke(userId: string): Promise<void>;
}
export interface ProtectedAuthStore {
  transaction<T>(work: (tx: AuthTransaction) => Promise<T>): Promise<T>;
  // Each method is a compare-and-set; implementation must use its database clock.
  claim(jobId: string, workerId: string): Promise<Lease | null>;
  admit(lease: Lease): Promise<{ credential: Credential; job: ProtectedJob } | null>;
  beginSend(lease: Lease): Promise<boolean>;
  finish(lease: Lease, outcome: 'submitted' | 'suppressed' | 'ambiguous'): Promise<boolean>;
}
const safe = () => new Error('PROTECTED_AUTH_FAILED');
const identifier = (v: string) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const recipient = (v: string) => typeof v === 'string' && v.length <= 254 && /^[^\s@<>]+@[^\s@<>]+$/.test(v) && v === v.trim().toLowerCase();
function context(c: Credential): Buffer {
  return protectedContext('auth-delivery', 'auth-notification', c.userId, c.generation, c.purpose, c.id, c.jobId);
}

/** No transport or direct-send fallback. Token and encrypted job persist in one transaction. */
export async function issueProtectedCredential(store: ProtectedAuthStore, keys: EnvelopeKeys, keyRef: string,
  binding: AccountBinding, purpose: Purpose, expiresAt: Date,
  registration?: { passwordHash: string; name: string | null; sessionId: string; sessionDigest: string; sessionExpiresAt: Date }): Promise<{ credentialId: string; jobId: string }> {
  let plaintext: Buffer | undefined;
  try {
    if (!identifier(binding.userId) || !recipient(binding.recipient) || !Number.isSafeInteger(binding.generation) || binding.generation < 0 ||
        (purpose !== 'verification' && purpose !== 'reset') || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) throw safe();
    const token = randomBytes(48).toString('base64url'), id = randomUUID(), jobId = randomUUID();
    const credential: Credential = { ...binding, id, jobId, purpose, expiresAt: new Date(expiresAt), digest: createHash('sha256').update(token).digest('hex'), consumedAt: null, revokedAt: null };
    const account = registration ? { ...registration, sessionExpiresAt: new Date(registration.sessionExpiresAt) } : undefined;
    if (account && (purpose !== 'verification' || credential.generation !== 0 || !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(account.passwordHash) ||
        account.name !== null && (typeof account.name !== 'string' || account.name.length > 256) ||
        !identifier(account.sessionId) || !/^[a-f0-9]{64}$/.test(account.sessionDigest) ||
        !Number.isFinite(account.sessionExpiresAt.getTime()) || account.sessionExpiresAt.getTime() <= Date.now())) throw safe();
    plaintext = Buffer.from(JSON.stringify({ token, recipient: binding.recipient }));
    const envelope = await sealEnvelope(plaintext, 'auth-notification', context(credential), keyRef, keys);
    await store.transaction(async tx => {
      if (account) await tx.createAccount({ id:credential.userId,email:credential.recipient,passwordHash:account.passwordHash,name:account.name });
      const current = await tx.account(credential.userId);
      if (!current || current.generation !== credential.generation || current.recipient !== credential.recipient) throw safe();
      await tx.supersede(credential.userId, purpose);
      await tx.insertCredential(credential);
      await tx.insertJob({ id: jobId, credentialId: id, envelope });
      if (account) await tx.createSession({ id:account.sessionId,userId:credential.userId,digest:account.sessionDigest,expiresAt:account.sessionExpiresAt });
    });
    return { credentialId: id, jobId };
  } catch { throw safe(); }
  finally { plaintext?.fill(0); }
}

/** Trusted registration composition hashes passwords before calling; no session returned before commit. */
export async function registerProtectedAccount(store: ProtectedAuthStore, keys: EnvelopeKeys, keyRef: string,
  input: { userId: string; recipient: string; passwordHash: string; name: string | null; verificationExpiresAt: Date; sessionExpiresAt: Date }):
  Promise<{ credentialId: string; jobId: string; sessionId: string; refreshToken: string }> {
  const sessionId = randomUUID(), refreshToken = randomBytes(48).toString('base64url');
  const issued = await issueProtectedCredential(store,keys,keyRef,{ userId:input.userId,recipient:input.recipient,generation:0 },'verification',input.verificationExpiresAt,
    { passwordHash:input.passwordHash,name:input.name,sessionId,sessionDigest:createHash('sha256').update(refreshToken).digest('hex'),sessionExpiresAt:input.sessionExpiresAt });
  return { ...issued,sessionId,refreshToken };
}

export async function revokeProtectedCredentials(store: ProtectedAuthStore, userId: string): Promise<void> {
  try {
    if (!identifier(userId)) throw safe();
    await store.transaction(async tx => { if (!await tx.account(userId)) throw safe(); await tx.revoke(userId); });
  } catch { throw safe(); }
}

export interface TrustedDelivery {
  // Must validate trusted workload identity, not a caller-provided boolean/request field.
  authorize(workerId: string, purpose: Purpose): Promise<boolean>;
  // Resolve only after actual transport settles; a thrown/rejected result is ambiguous.
  send(input: { purpose: Purpose; recipient: string; token: string }): Promise<'submitted' | 'suppressed'>;
}

/** Durable SENDING is terminal to automatic retry, including crash or lost acknowledgment. */
export async function deliverProtectedCredential(store: ProtectedAuthStore, keys: EnvelopeKeys, delivery: TrustedDelivery,
  jobId: string, workerId: string): Promise<'submitted' | 'suppressed' | 'ambiguous' | 'denied'> {
  let plaintext: Uint8Array | undefined;
  let sendIntent = false;
  try {
    if (!identifier(jobId) || !identifier(workerId)) return 'denied';
    // Workload admission before even claiming/reading the protected record.
    if (await delivery.authorize(workerId, 'verification') !== true && await delivery.authorize(workerId, 'reset') !== true) return 'denied';
    const lease = await store.claim(jobId, workerId);
    if (!lease) return 'denied';
    const admitted = await store.admit(lease);
    if (!admitted || await delivery.authorize(workerId, admitted.credential.purpose) !== true) return 'denied';
    const c = admitted.credential;
    if (c.jobId !== jobId || admitted.job.id !== jobId || admitted.job.credentialId !== c.id || c.consumedAt || c.revokedAt) return 'denied';
    plaintext = await openEnvelope(admitted.job.envelope, 'auth-notification', context(c), keys);
    const payload: unknown = JSON.parse(Buffer.from(plaintext).toString('utf8'));
    if (!payload || typeof payload !== 'object' || !('token' in payload) || !('recipient' in payload) ||
        Object.keys(payload).sort().join(',') !== 'recipient,token' || typeof payload.token !== 'string' ||
        !/^[A-Za-z0-9_-]{64}$/.test(payload.token) || payload.recipient !== c.recipient ||
        createHash('sha256').update(payload.token).digest('hex') !== c.digest) return 'denied';
    // Recheck generation, current recipient, revocation/consumption, expiry and lease atomically.
    if (!await store.beginSend(lease)) return 'denied';
    sendIntent = true;
    let outcome: 'submitted' | 'suppressed' | 'ambiguous';
    try {
      const result = await delivery.send({ purpose: c.purpose, recipient: c.recipient, token: payload.token });
      outcome = result === 'submitted' || result === 'suppressed' ? result : 'ambiguous';
    } catch { outcome = 'ambiguous'; }
    // No retry on an ambiguous result or failed acknowledgment. SENDING survives a crash.
    return await store.finish(lease, outcome) ? outcome : 'ambiguous';
  } catch { return sendIntent ? 'ambiguous' : 'denied'; }
  finally { plaintext?.fill(0); }
}
