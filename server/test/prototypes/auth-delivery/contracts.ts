import { randomUUID } from 'node:crypto';

/** Offline synthetic contracts only. No application credentials or provider integration. */
export type Purpose = 'EMAIL_VERIFY' | 'PASSWORD_RESET';
export interface DeliveryContext {
  readonly environmentId: string; readonly messageId: string; readonly tokenRecordId: string;
  readonly userId: string; readonly purpose: Purpose;
}
export interface Payload {
  readonly templateVersion: 2; readonly purpose: Purpose; readonly messageId: string;
  readonly tokenRecordId: string; readonly userId: string; readonly recipient: string;
  readonly issuedAt: string; readonly expiresAt: string; readonly token: string;
}
export type SyntheticAuthDeliveryPayloadV2 = Payload;
export interface WrappingMetadata {
  readonly keyProvider: 'synthetic-auth-delivery'; readonly keyRef: 'synthetic-auth-delivery-kek';
  readonly keyVersion: 'v1' | 'v2'; readonly wrapAlgorithm: 'SYNTHETIC-A256GCM'; readonly wrappedDek: string;
}
export interface AuthDeliveryEnvelopeV2 extends WrappingMetadata {
  readonly envelopeVersion: 2; readonly templateVersion: 2; readonly domain: 'flywithsafe.auth-delivery.v2';
  readonly algorithm: 'AES-256-GCM'; readonly aadVersion: 1;
  readonly nonce: string; readonly ciphertext: string; readonly tag: string;
}
export interface WrappedDataKey extends WrappingMetadata { readonly plaintextDek: Uint8Array }
export interface OperationControl { readonly signal: AbortSignal; readonly deadlineAtMonotonicMs: number }
export interface Limits {
  readonly authorizationMs?: number; readonly providerMs?: number; readonly totalMs?: number;
  readonly retryDelaysMs?: readonly [number, number]; readonly monotonicNow?: () => number; readonly wallNow?: () => number;
}
export interface KeyProvider {
  createAndWrapDataKey(context: DeliveryContext, control?: OperationControl): Promise<WrappedDataKey>;
  unwrapDataKey(metadata: WrappingMetadata, context: DeliveryContext, control?: OperationControl): Promise<Uint8Array>;
}
export interface WorkerGrant {
  readonly workerId: string; readonly environmentId: string; readonly messageId: string;
  readonly tokenRecordId: string; readonly purpose: Purpose; readonly role: 'AUTH_DELIVERY_WORKER'; readonly expiresAtMs: number;
}
export interface WorkerPolicy { assertAllowed(grant: WorkerGrant, context: DeliveryContext, control: OperationControl): Promise<void> }
export type Reason = 'INVALID_INPUT' | 'INVALID_ENVELOPE' | 'UNSUPPORTED_VERSION' | 'FORBIDDEN' | 'KEY_UNAVAILABLE'
  | 'INTEGRITY_FAILURE' | 'ISSUANCE_CONFLICT' | 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'TOKEN_CONSUMED' | 'TOKEN_REVOKED'
  | 'RECIPIENT_CHANGED' | 'LEASE_LOST' | 'DELIVERY_DISABLED' | 'TRANSPORT_TRANSIENT' | 'TRANSPORT_TERMINAL' | 'TRANSPORT_AMBIGUOUS';
export const reasons: readonly Reason[] = Object.freeze(['INVALID_INPUT','INVALID_ENVELOPE','UNSUPPORTED_VERSION','FORBIDDEN','KEY_UNAVAILABLE','INTEGRITY_FAILURE','ISSUANCE_CONFLICT','TOKEN_INVALID','TOKEN_EXPIRED','TOKEN_CONSUMED','TOKEN_REVOKED','RECIPIENT_CHANGED','LEASE_LOST','DELIVERY_DISABLED','TRANSPORT_TRANSIENT','TRANSPORT_TERMINAL','TRANSPORT_AMBIGUOUS']);
export const isReason = (v:unknown): v is Reason => typeof v === 'string' && reasons.some(r=>r===v);
export class AuthDeliveryError extends Error {
  readonly correlationId = randomUUID();
  constructor(readonly code: Reason) { super(isReason(code)?code:'KEY_UNAVAILABLE'); this.code=isReason(code)?code:'KEY_UNAVAILABLE'; this.name = 'AuthDeliveryError'; }
  toJSON() { return { code: this.code, correlationId: this.correlationId }; }
}
export class FakeKeyFailure extends Error {
  constructor(readonly kind: 'unavailable' | 'denied' | 'integrity') { super('SYNTHETIC_KEY_FAILURE'); }
}
export type Status = 'PENDING' | 'PROCESSING' | 'DELIVERED' | 'FAILED';
export interface Account { id: string; recipient: string; revision: number; emailVerified: boolean; passwordEffects: number; sessionEffects: number }
export interface TokenRow {
  id: string; userId: string; accountRevision: number; purpose: Purpose; tokenHash: string;
  issuedAtMs: number; expiresAtMs: number; consumedAtMs: number | null; revokedAtMs: number | null; messageId: string;
}
export interface OutboxRow {
  id: string; tokenRecordId: string; userId: string; purpose: Purpose; envelope: AuthDeliveryEnvelopeV2;
  status: Status; version: number; attempts: number; maxAttempts: number; nextAttemptAtMs: number;
  leaseOwnerId: string | null; leaseExpiresAtMs: number | null; reasonCode: Reason | null;
}
export interface IssuanceRequest {
  readonly issuanceId: string; readonly environmentId: string; readonly userId: string; readonly purpose: Purpose;
  readonly expectedAccountRevision: number; readonly expectedPurposeRevision: number; readonly expiresAtMs: number;
  readonly createAccount?: { readonly recipient: string };
}
export interface IssuanceReceipt { readonly issuanceId: string; readonly messageId: string; readonly tokenRecordId: string }
export interface Lease { readonly messageId: string; readonly workerId: string; readonly version: number; readonly expiresAtMs: number }
export interface DispatchResult { readonly messageId: string; readonly status: Status; readonly reasonCode: Reason | null }
export interface PersistentSnapshot {
  readonly environmentId: string; readonly lastClockMs: number; readonly accounts: Account[]; readonly tokens: TokenRow[]; readonly outbox: OutboxRow[];
  readonly revisions: Record<string, number>;
  readonly issuances: Record<string, { digest: string; receipt: IssuanceReceipt }>;
}
export type TransportOutcome = 'submitted' | 'suppressed' | 'transientFailure' | 'terminalFailure' | 'ambiguous';
export interface TransportMessage { readonly messageId: string; readonly recipient: string; readonly token: string; readonly purpose: Purpose }
export interface Transport { submit(message: TransportMessage): Promise<TransportOutcome> }
export interface DeliveryCodec {
  protect(payload: unknown, context: unknown): Promise<AuthDeliveryEnvelopeV2>;
  unprotect(envelope: unknown, context: unknown, grant: unknown): Promise<Payload>;
}
export type FaultPoint = 'account' | 'supersession' | 'token' | 'message' | 'registry' | 'publish' | 'effect' | 'afterSubmit';
