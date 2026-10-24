import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import {
  CryptoError, SyntheticProviderFailure, type CryptoEnvelopeV1, type DataKeyProvider,
  type DecryptionAuthorizationPolicy, type EncryptionContext, type SyntheticPassengerDocumentV1,
} from './contracts.js';
import { canonicalAAD, contextSnapshot, decodeBase64, decodePayload, encodePayload, identifier, parseEnvelope, record } from './envelope-codec.js';

/** Test grants have no authenticity: only internally supplied synthetic fixtures. */
export class SyntheticAuthorizationPolicy implements DecryptionAuthorizationPolicy {
  constructor(private readonly now: () => number = Date.now) {}
  assertAllowed(value: unknown, context: EncryptionContext): void {
    try {
      const g = record(value);
      const allowed = ['actorId', 'role', 'environmentId', 'bookingId', 'passengerId', 'purpose', 'expiresAtMs', 'stepUpVerified'];
      if (Object.keys(g).length !== allowed.length || Object.keys(g).some(k => !allowed.includes(k))
        || !identifier(g.actorId) || g.role !== 'FULFILLMENT' || g.purpose !== 'synthetic-fulfillment'
        || g.environmentId !== context.environmentId || g.bookingId !== context.bookingId || g.passengerId !== context.passengerId
        || typeof g.expiresAtMs !== 'number' || !Number.isSafeInteger(g.expiresAtMs)
        || g.expiresAtMs <= this.now() || g.stepUpVerified !== true) throw new CryptoError('FORBIDDEN');
    } catch { throw new CryptoError('FORBIDDEN'); }
  }
}

function validKey(key: Uint8Array): void {
  if (!(key instanceof Uint8Array) || key.byteLength !== 32) throw new CryptoError('KEY_UNAVAILABLE');
}

/** No key cache. Bounded immediate retries model the fake only, not real KMS timing. */
export class PassengerDocumentCrypto {
  constructor(private readonly provider: DataKeyProvider, private readonly policy: DecryptionAuthorizationPolicy,
    private readonly maxAttempts = 3) {
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) throw new CryptoError('INVALID_INPUT');
  }

  private async keyOperation<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      try { return await operation(); } catch (error: unknown) {
        if (error instanceof SyntheticProviderFailure) {
          if (error.kind === 'denied') throw new CryptoError('KEY_ACCESS_DENIED');
          if (error.kind === 'integrity') throw new CryptoError('INTEGRITY_FAILURE');
          if (attempt + 1 < this.maxAttempts) continue;
        }
        throw new CryptoError('KEY_UNAVAILABLE');
      }
    }
    throw new CryptoError('KEY_UNAVAILABLE');
  }

  async encrypt(value: unknown, inputContext: unknown): Promise<CryptoEnvelopeV1> {
    const context = contextSnapshot(inputContext);
    const plaintext = encodePayload(value);
    let dek: Uint8Array | undefined;
    try {
      const wrapped = await this.keyOperation(() => this.provider.createAndWrapDataKey(context));
      dek = wrapped.plaintextDek;
      validKey(dek);
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', dek, nonce, { authTagLength: 16 });
      cipher.setAAD(canonicalAAD(context));
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      return parseEnvelope({ payloadVersion: 1, algorithm: 'AES-256-GCM', aadVersion: 1,
        keyProvider: wrapped.keyProvider, keyRef: wrapped.keyRef,
        ...(wrapped.keyVersion === undefined ? {} : { keyVersion: wrapped.keyVersion }),
        wrapAlgorithm: wrapped.wrapAlgorithm, wrappedDek: wrapped.wrappedDek,
        nonce: nonce.toString('base64url'), ciphertext: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url') });
    } catch (error: unknown) {
      if (error instanceof CryptoError) throw error;
      throw new CryptoError('KEY_UNAVAILABLE');
    } finally { if (dek instanceof Uint8Array) dek.fill(0); plaintext.fill(0); }
  }

  async decrypt(input: unknown, inputContext: unknown, grant: unknown): Promise<SyntheticPassengerDocumentV1> {
    const context = contextSnapshot(inputContext);
    // Snapshot context/envelope before await; do not retain mutable caller objects.
    try { this.policy.assertAllowed(grant, context); } catch { throw new CryptoError('FORBIDDEN'); }
    const envelope = parseEnvelope(input);
    let dek: Uint8Array | undefined;
    let partial: Buffer | undefined;
    let plaintext: Buffer | undefined;
    try {
      dek = await this.keyOperation(() => this.provider.unwrapDataKey(envelope, context));
      validKey(dek);
      const decipher = createDecipheriv('aes-256-gcm', dek, decodeBase64(envelope.nonce, 12), { authTagLength: 16 });
      decipher.setAAD(canonicalAAD(context));
      decipher.setAuthTag(decodeBase64(envelope.tag, 16));
      try {
        partial = decipher.update(decodeBase64(envelope.ciphertext));
        // Never expose update() output until final() authenticates the complete ciphertext.
        plaintext = Buffer.concat([partial, decipher.final()]);
      } catch { throw new CryptoError('INTEGRITY_FAILURE'); }
      return decodePayload(plaintext);
    } catch (error: unknown) {
      if (error instanceof CryptoError) throw error;
      throw new CryptoError('KEY_UNAVAILABLE');
    } finally { if (dek instanceof Uint8Array) dek.fill(0); partial?.fill(0); plaintext?.fill(0); }
  }
}
