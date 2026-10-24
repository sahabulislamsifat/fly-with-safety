import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { SyntheticProviderFailure, type DataKeyProvider, type EncryptionContext, type WrappedDataKey, type WrappingMetadata } from './contracts.js';
import { canonicalAAD, decodeBase64 } from './envelope-codec.js';

/** Fake only. Keeps ephemeral wrapping KEKs, never caches returned plaintext DEKs. */
export class SyntheticKmsAdapter implements DataKeyProvider {
  private readonly keys = new Map<string, Buffer>([['v1', randomBytes(32)], ['v2', randomBytes(32)]]);
  activeVersion: 'v1' | 'v2' = 'v1';
  mode: 'available' | 'unavailable' | 'denied' = 'available';
  transientFailures = 0;
  readonly calls = { create: 0, unwrap: 0 };

  private admit(): void {
    if (this.mode === 'denied') throw new SyntheticProviderFailure('denied');
    if (this.mode === 'unavailable' || this.transientFailures-- > 0) throw new SyntheticProviderFailure('unavailable');
    this.transientFailures = Math.max(0, this.transientFailures);
  }

  private aad(context: EncryptionContext, version: string): Buffer {
    return Buffer.concat([Buffer.from(`synthetic-wrap:${version}:`), canonicalAAD(context)]);
  }

  async createAndWrapDataKey(context: EncryptionContext): Promise<WrappedDataKey> {
    this.calls.create++;
    this.admit();
    const version = this.activeVersion;
    const key = this.keys.get(version);
    if (!key) throw new SyntheticProviderFailure('unavailable');
    const plaintextDek = randomBytes(32);
    try {
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
      cipher.setAAD(this.aad(context, version));
      const ciphertext = Buffer.concat([cipher.update(plaintextDek), cipher.final()]);
      return { plaintextDek, keyProvider: 'synthetic', keyRef: 'synthetic-passenger-kek', keyVersion: version,
        wrapAlgorithm: 'SYNTHETIC-A256GCM', wrappedDek: Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString('base64url') };
    } catch { plaintextDek.fill(0); throw new SyntheticProviderFailure('integrity'); }
  }

  async unwrapDataKey(metadata: WrappingMetadata, context: EncryptionContext): Promise<Uint8Array> {
    this.calls.unwrap++;
    this.admit();
    const version = metadata.keyVersion ?? 'v1';
    const key = this.keys.get(version);
    if (!key) throw new SyntheticProviderFailure('unavailable');
    let partial: Buffer | undefined;
    try {
      if (metadata.keyProvider !== 'synthetic' || metadata.keyRef !== 'synthetic-passenger-kek'
        || metadata.wrapAlgorithm !== 'SYNTHETIC-A256GCM') throw new Error();
      const packed = decodeBase64(metadata.wrappedDek, 60);
      const decipher = createDecipheriv('aes-256-gcm', key, packed.subarray(0, 12), { authTagLength: 16 });
      decipher.setAAD(this.aad(context, version));
      decipher.setAuthTag(packed.subarray(12, 28));
      partial = decipher.update(packed.subarray(28));
      return Buffer.concat([partial, decipher.final()]);
    } catch { throw new SyntheticProviderFailure('integrity'); }
    finally { partial?.fill(0); }
  }

  retire(version: 'v1' | 'v2'): void {
    this.keys.get(version)?.fill(0);
    this.keys.delete(version);
  }
  dispose(): void { for (const key of this.keys.values()) key.fill(0); this.keys.clear(); }
}
