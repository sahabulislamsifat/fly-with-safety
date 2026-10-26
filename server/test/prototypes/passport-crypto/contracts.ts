import { randomUUID } from 'node:crypto';

/** Offline D-1 contracts only. Never import these into application code. */
export interface EncryptionContext {
  readonly environmentId: string;
  readonly bookingId: string;
  readonly passengerId: string;
}

export interface SyntheticPassengerDocumentV1 {
  readonly passportNumber?: string;
  readonly passportExpiry?: string;
  readonly dateOfBirth?: string;
}

export interface WrappingMetadata {
  readonly keyProvider: 'synthetic';
  readonly keyRef: 'synthetic-passenger-kek';
  readonly keyVersion?: 'v1' | 'v2';
  readonly wrapAlgorithm: 'SYNTHETIC-A256GCM';
  readonly wrappedDek: string;
}

export interface CryptoEnvelopeV1 extends WrappingMetadata {
  readonly payloadVersion: 1;
  readonly algorithm: 'AES-256-GCM';
  readonly aadVersion: 1;
  readonly nonce: string;
  readonly ciphertext: string;
  readonly tag: string;
}

export interface WrappedDataKey extends WrappingMetadata {
  /** Ownership transfers to the cipher, which clears this buffer in finally. */
  readonly plaintextDek: Uint8Array;
}

export interface DataKeyProvider {
  createAndWrapDataKey(context: EncryptionContext, control?: OperationControl): Promise<WrappedDataKey>;
  unwrapDataKey(metadata: WrappingMetadata, context: EncryptionContext, control?: OperationControl): Promise<Uint8Array>;
}

/** Advisory signal: the unchanged fake does not support cancellation. */
export interface OperationControl {
  readonly signal: AbortSignal;
  readonly deadlineAtMonotonicMs: number;
}

export interface CryptoOptions {
  readonly authorizationMs?: number;
  readonly providerMs?: number;
  readonly totalMs?: number;
  readonly retryDelaysMs?: readonly [number, number];
  readonly monotonicNow?: () => number;
  readonly wallNow?: () => number;
}

export interface SyntheticGrant {
  readonly actorId: string;
  readonly role: 'FULFILLMENT';
  readonly environmentId: string;
  readonly bookingId: string;
  readonly passengerId: string;
  readonly purpose: 'synthetic-fulfillment';
  readonly expiresAtMs: number;
  readonly stepUpVerified: true;
}

export interface DecryptionAuthorizationPolicy {
  assertAllowed(grant: unknown, context: EncryptionContext, control: OperationControl): Promise<void>;
}

export type CryptoErrorCode = 'INVALID_INPUT' | 'INVALID_ENVELOPE' | 'UNSUPPORTED_VERSION'
  | 'FORBIDDEN' | 'KEY_UNAVAILABLE' | 'KEY_ACCESS_DENIED' | 'INTEGRITY_FAILURE';

/** No raw cause, provider message, material or contextual values are attached. */
export class CryptoError extends Error {
  readonly correlationId = randomUUID();
  constructor(readonly code: CryptoErrorCode) {
    super(code);
    this.name = 'CryptoError';
  }
  toJSON(): { code: CryptoErrorCode; correlationId: string } {
    return { code: this.code, correlationId: this.correlationId };
  }
}

/** Narrow internal signal used by the fake, never returned to callers. */
export class SyntheticProviderFailure extends Error {
  constructor(readonly kind: 'unavailable' | 'denied' | 'integrity') {
    super('SYNTHETIC_PROVIDER_FAILURE');
  }
}

export const PLAINTEXT_LIMIT = 4 * 1024;
export const ENVELOPE_LIMIT = 16 * 1024;
