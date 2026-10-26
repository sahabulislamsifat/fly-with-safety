import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import {
  CryptoError, SyntheticProviderFailure, type CryptoEnvelopeV1, type CryptoOptions, type DataKeyProvider,
  type DecryptionAuthorizationPolicy, type EncryptionContext, type OperationControl,
  type SyntheticGrant, type SyntheticPassengerDocumentV1, type WrappedDataKey,
} from './contracts.js';
import { canonicalAAD, contextSnapshot, decodeBase64, decodePayload, encodePayload, identifier, parseEnvelope, record } from './envelope-codec.js';

function snapshotGrant(value: unknown, context: EncryptionContext): SyntheticGrant {
  try {
    const g = record(value);
    const fields = ['actorId', 'role', 'environmentId', 'bookingId', 'passengerId', 'purpose', 'expiresAtMs', 'stepUpVerified'];
    if (Object.keys(g).length !== fields.length || Object.keys(g).some(k => !fields.includes(k))
      || !identifier(g.actorId) || g.role !== 'FULFILLMENT' || g.purpose !== 'synthetic-fulfillment'
      || g.environmentId !== context.environmentId || g.bookingId !== context.bookingId || g.passengerId !== context.passengerId
      || typeof g.expiresAtMs !== 'number' || !Number.isSafeInteger(g.expiresAtMs) || g.stepUpVerified !== true) throw new Error();
    return Object.freeze({ actorId: g.actorId, role: 'FULFILLMENT', ...context,
      purpose: 'synthetic-fulfillment', expiresAtMs: g.expiresAtMs, stepUpVerified: true });
  } catch { throw new CryptoError('FORBIDDEN'); }
}

/** Async, internally supplied synthetic test policy; not a trusted grant issuer. */
export class SyntheticAuthorizationPolicy implements DecryptionAuthorizationPolicy {
  constructor(private readonly now: () => number = Date.now) {}
  async assertAllowed(value: unknown, context: EncryptionContext, control: OperationControl): Promise<void> {
    try {
      const g = snapshotGrant(value, context), now = this.now();
      if (control.signal.aborted || !Number.isFinite(now) || g.expiresAtMs <= now) throw new Error();
    } catch { throw new CryptoError('FORBIDDEN'); }
  }
}

type FailureCode = 'FORBIDDEN' | 'KEY_UNAVAILABLE';
interface Operation { active: boolean; deadline: number; last: number }
interface Limits {
  authorizationMs: number; providerMs: number; totalMs: number;
  retryDelaysMs: readonly [number, number]; monotonicNow: () => number; wallNow: () => number;
}

function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 5000;
}

function limits(input: unknown): Limits {
  try {
    const o = record(input);
    if (Object.keys(o).some(k => !['authorizationMs', 'providerMs', 'totalMs', 'retryDelaysMs', 'monotonicNow', 'wallNow'].includes(k))) throw new Error();
    const auth = Object.hasOwn(o, 'authorizationMs') ? o.authorizationMs : 250;
    const provider = Object.hasOwn(o, 'providerMs') ? o.providerMs : 250;
    const total = Object.hasOwn(o, 'totalMs') ? o.totalMs : 1500;
    const delays: unknown = Object.hasOwn(o, 'retryDelaysMs') ? o.retryDelaysMs : [25, 50];
    if (!positive(auth) || !positive(provider) || !positive(total) || auth > total || provider > total
      || !Array.isArray(delays) || delays.length !== 2 || !positive(delays[0]) || !positive(delays[1])
      || delays[0] > total || delays[1] > total) throw new Error();
    const mono = Object.hasOwn(o, 'monotonicNow') ? o.monotonicNow : () => performance.now();
    const wall = Object.hasOwn(o, 'wallNow') ? o.wallNow : Date.now;
    if (typeof mono !== 'function' || typeof wall !== 'function') throw new Error();
    return Object.freeze({ authorizationMs: auth, providerMs: provider, totalMs: total,
      retryDelaysMs: Object.freeze([delays[0], delays[1]] as const),
      monotonicNow: () => mono(), wallNow: () => wall() });
  } catch { throw new CryptoError('INVALID_INPUT'); }
}

function validKey(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array && value.byteLength === 32;
}

/** Only known owned buffers, no accessors or arbitrary provider callbacks. Never throws. */
function eraseKeyMaterial(value: unknown): void {
  try {
    if (value instanceof Uint8Array) value.fill(0);
    else if (typeof value === 'object' && value !== null) {
      const descriptor = Object.getOwnPropertyDescriptor(value, 'plaintextDek');
      if (descriptor && Object.hasOwn(descriptor, 'value') && descriptor.value instanceof Uint8Array) descriptor.value.fill(0);
    }
  } catch { /* Best effort only, including hostile/malformed test results. */ }
}

function createdKey(value: unknown): WrappedDataKey {
  try {
    const o = record(value);
    if (Object.keys(o).some(k => !['plaintextDek', 'keyProvider', 'keyRef', 'keyVersion', 'wrapAlgorithm', 'wrappedDek'].includes(k))
      || !validKey(o.plaintextDek) || o.keyProvider !== 'synthetic' || o.keyRef !== 'synthetic-passenger-kek'
      || o.wrapAlgorithm !== 'SYNTHETIC-A256GCM' || typeof o.wrappedDek !== 'string') throw new Error();
    const version = o.keyVersion;
    if ((Object.hasOwn(o, 'keyVersion') && version === undefined) || (version !== undefined && version !== 'v1' && version !== 'v2')) throw new Error();
    decodeBase64(o.wrappedDek, 60);
    return { plaintextDek: o.plaintextDek, keyProvider: 'synthetic', keyRef: 'synthetic-passenger-kek',
      wrapAlgorithm: 'SYNTHETIC-A256GCM', wrappedDek: o.wrappedDek, ...(version === undefined ? {} : { keyVersion: version }) };
  } catch { throw new CryptoError('KEY_UNAVAILABLE'); }
}

/** Offline bounded orchestration. No cache, SDK, persistence or real cancellation claim. */
export class PassengerDocumentCrypto {
  private readonly limits: Limits;
  constructor(private readonly provider: DataKeyProvider, private readonly policy: DecryptionAuthorizationPolicy,
    private readonly maxAttempts = 3, options: CryptoOptions = {}) {
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) throw new CryptoError('INVALID_INPUT');
    this.limits = limits(options);
  }

  private time(): number {
    try {
      const n: unknown = this.limits.monotonicNow();
      if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > Number.MAX_SAFE_INTEGER - 5000) throw new Error();
      return n;
    } catch { throw new CryptoError('KEY_UNAVAILABLE'); }
  }
  private begin(): Operation {
    const now = this.time();
    return { active: true, deadline: now + this.limits.totalMs, last: now };
  }
  private check(op: Operation, code: FailureCode = 'KEY_UNAVAILABLE'): number {
    let now: number;
    try { now = this.time(); } catch { op.active = false; throw new CryptoError(code); }
    if (!op.active || now < op.last || now >= op.deadline) { op.active = false; throw new CryptoError(code); }
    op.last = now;
    return now;
  }
  private grantLive(grant: SyntheticGrant): void {
    try {
      const now: unknown = this.limits.wallNow();
      if (typeof now !== 'number' || !Number.isFinite(now) || grant.expiresAtMs <= now) throw new Error();
    } catch { throw new CryptoError('FORBIDDEN'); }
  }

  /** One terminal stage outcome. Observers remain attached to discard late settlement. */
  private bounded(op: Operation, budget: number, invoke: (control: OperationControl) => unknown,
    code: FailureCode, cleanup: (value: unknown) => void = () => {}): Promise<unknown> {
    const start = this.check(op, code), deadline = Math.min(start + budget, op.deadline);
    const controller = new AbortController();
    const control = Object.freeze({ signal: controller.signal, deadlineAtMonotonicMs: deadline });
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const fail = (error: unknown, timedOut = false) => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        if (timedOut) op.active = false;
        // Abort is advisory; it is never interpreted as acknowledgment of cancellation.
        try { controller.abort(new CryptoError(code)); } catch { /* No raw abort error is exposed. */ }
        reject(error);
      };
      const expire = () => {
        try {
          const now = this.check(op, code);
          if (now < deadline) timer = setTimeout(expire, Math.ceil(deadline - now));
          else fail(new CryptoError(code), true);
        } catch { fail(new CryptoError(code), true); }
      };
      timer = setTimeout(expire, Math.ceil(deadline - start));
      let result: unknown;
      try {
        result = invoke(control);
        if ((typeof result !== 'object' && typeof result !== 'function') || result === null || typeof Reflect.get(result, 'then') !== 'function') {
          cleanup(result); fail(new CryptoError(code)); return;
        }
        // Both paths are observed immediately. Callback exceptions must not spawn unhandled promises.
        void Promise.resolve(result).then(value => {
          try {
            if (settled || !op.active) { cleanup(value); return; }
            const now = this.check(op, code);
            if (now >= deadline) { cleanup(value); fail(new CryptoError(code), true); return; }
            if (code === 'FORBIDDEN' && value !== undefined) { fail(new CryptoError(code)); return; }
            settled = true;
            if (timer !== undefined) clearTimeout(timer);
            resolve(value); // Key ownership transfers once; losing callbacks cannot clear it.
          } catch {
            cleanup(value); fail(new CryptoError(code), true);
          }
        }, error => {
          try {
            if (settled) return;
            if (this.check(op, code) >= deadline) fail(new CryptoError(code), true);
            else fail(error);
          } catch { fail(new CryptoError(code), true); }
        });
      } catch { cleanup(result); fail(new CryptoError(code)); }
    });
  }

  private async pause(op: Operation, delay: number): Promise<void> {
    const remaining = op.deadline - this.check(op);
    await new Promise<void>(resolve => setTimeout(resolve, Math.min(delay, remaining)));
    this.check(op);
  }

  private async keyOperation<T>(op: Operation, invoke: (control: OperationControl) => unknown,
    accept: (value: unknown) => T, grant?: SyntheticGrant): Promise<T> {
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      this.check(op);
      if (grant) this.grantLive(grant);
      try {
        const value = await this.bounded(op, this.limits.providerMs, invoke, 'KEY_UNAVAILABLE', eraseKeyMaterial);
        try {
          this.check(op);
          if (grant) this.grantLive(grant);
          return accept(value);
        } catch (error) { eraseKeyMaterial(value); throw error; }
      } catch (error: unknown) {
        if (error instanceof CryptoError) throw error;
        if (error instanceof SyntheticProviderFailure) {
          if (error.kind === 'denied') throw new CryptoError('KEY_ACCESS_DENIED');
          if (error.kind === 'integrity') throw new CryptoError('INTEGRITY_FAILURE');
          if (error.kind === 'unavailable' && attempt + 1 < this.maxAttempts) {
            await this.pause(op, this.limits.retryDelaysMs[Math.min(attempt, 1)]);
            continue; // Previous operation is settled. Never retry a timeout or pending call.
          }
        }
        throw new CryptoError('KEY_UNAVAILABLE');
      }
    }
    throw new CryptoError('KEY_UNAVAILABLE');
  }

  async encrypt(value: unknown, inputContext: unknown): Promise<CryptoEnvelopeV1> {
    const op = this.begin();
    let plaintext: Buffer | undefined, dek: Uint8Array | undefined;
    try {
      const context = contextSnapshot(inputContext);
      plaintext = encodePayload(value);
      const wrapped = await this.keyOperation(op, c => this.provider.createAndWrapDataKey(context, c), createdKey);
      dek = wrapped.plaintextDek;
      this.check(op);
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', dek, nonce, { authTagLength: 16 });
      cipher.setAAD(canonicalAAD(context));
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const result = parseEnvelope({ payloadVersion: 1, algorithm: 'AES-256-GCM', aadVersion: 1,
        keyProvider: wrapped.keyProvider, keyRef: wrapped.keyRef,
        ...(wrapped.keyVersion === undefined ? {} : { keyVersion: wrapped.keyVersion }),
        wrapAlgorithm: wrapped.wrapAlgorithm, wrappedDek: wrapped.wrappedDek,
        nonce: nonce.toString('base64url'), ciphertext: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url') });
      this.check(op);
      return result;
    } catch (error: unknown) {
      if (error instanceof CryptoError) throw error;
      throw new CryptoError('KEY_UNAVAILABLE');
    } finally { op.active = false; eraseKeyMaterial(dek); plaintext?.fill(0); }
  }

  async decrypt(input: unknown, inputContext: unknown, inputGrant: unknown): Promise<SyntheticPassengerDocumentV1> {
    const op = this.begin();
    let dek: Uint8Array | undefined, partial: Buffer | undefined, plaintext: Buffer | undefined;
    try {
      const context = contextSnapshot(inputContext), grant = snapshotGrant(inputGrant, context);
      let envelope: CryptoEnvelopeV1 | undefined, envelopeError: CryptoError | undefined;
      try { envelope = parseEnvelope(input); }
      catch (error) { envelopeError = error instanceof CryptoError ? error : new CryptoError('INVALID_ENVELOPE'); }
      let authorized: unknown;
      try {
        authorized = await this.bounded(op, this.limits.authorizationMs,
          c => this.policy.assertAllowed(grant, context, c), 'FORBIDDEN');
      } catch { throw new CryptoError('FORBIDDEN'); }
      if (authorized !== undefined) throw new CryptoError('FORBIDDEN');
      this.check(op, 'FORBIDDEN'); this.grantLive(grant);
      if (envelopeError) throw envelopeError;
      if (!envelope) throw new CryptoError('INVALID_ENVELOPE');
      const frozen = envelope;
      dek = await this.keyOperation(op, c => this.provider.unwrapDataKey(frozen, context, c), value => {
        if (!validKey(value)) throw new CryptoError('KEY_UNAVAILABLE');
        return value;
      }, grant);
      this.check(op); this.grantLive(grant);
      const decipher = createDecipheriv('aes-256-gcm', dek, decodeBase64(envelope.nonce, 12), { authTagLength: 16 });
      decipher.setAAD(canonicalAAD(context)); decipher.setAuthTag(decodeBase64(envelope.tag, 16));
      try {
        partial = decipher.update(decodeBase64(envelope.ciphertext));
        plaintext = Buffer.concat([partial, decipher.final()]);
      } catch { throw new CryptoError('INTEGRITY_FAILURE'); }
      const result = decodePayload(plaintext);
      this.check(op); this.grantLive(grant);
      return result;
    } catch (error: unknown) {
      if (error instanceof CryptoError) throw error;
      throw new CryptoError('KEY_UNAVAILABLE');
    } finally { op.active = false; eraseKeyMaterial(dek); partial?.fill(0); plaintext?.fill(0); }
  }
}
