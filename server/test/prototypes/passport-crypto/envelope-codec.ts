import { TextDecoder } from 'node:util';
import {
  CryptoError, ENVELOPE_LIMIT, PLAINTEXT_LIMIT,
  type CryptoEnvelopeV1, type EncryptionContext, type SyntheticPassengerDocumentV1,
} from './contracts.js';

export function record(value: unknown, code: 'INVALID_INPUT' | 'INVALID_ENVELOPE' = 'INVALID_INPUT'): Record<string, unknown> {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new CryptoError(code);
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new CryptoError(code);
    const snapshot: Record<string, unknown> = {};
    // Copy data descriptors without invoking accessors or retaining a mutable proxy.
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== 'string' || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw new CryptoError(code);
      Object.defineProperty(snapshot, key, { enumerable: true, value: descriptor.value });
    }
    return snapshot;
  } catch { throw new CryptoError(code); }
}

export function identifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value);
}

export function contextSnapshot(value: unknown): EncryptionContext {
  const obj = record(value);
  if (Object.keys(obj).length !== 3 || !identifier(obj.environmentId)
    || !identifier(obj.bookingId) || !identifier(obj.passengerId)) throw new CryptoError('INVALID_INPUT');
  return Object.freeze({ environmentId: obj.environmentId, bookingId: obj.bookingId, passengerId: obj.passengerId });
}

export function canonicalAAD(context: unknown): Buffer {
  const c = contextSnapshot(context);
  return Buffer.from(JSON.stringify(['FlyWithSafe', 'passenger-document', '1', c.environmentId, c.bookingId, c.passengerId]), 'utf8');
}

function calendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function payloadSnapshot(value: unknown): SyntheticPassengerDocumentV1 {
  const obj = record(value);
  const keys = Object.keys(obj);
  if (!keys.length || keys.some(k => !['passportNumber', 'passportExpiry', 'dateOfBirth'].includes(k))) throw new CryptoError('INVALID_INPUT');
  const result: { passportNumber?: string; passportExpiry?: string; dateOfBirth?: string } = {};
  if (Object.hasOwn(obj, 'passportNumber')) {
    if (typeof obj.passportNumber !== 'string' || !obj.passportNumber.length
      || obj.passportNumber.trim() !== obj.passportNumber || /[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(obj.passportNumber)) throw new CryptoError('INVALID_INPUT');
    result.passportNumber = obj.passportNumber;
  }
  for (const key of ['passportExpiry', 'dateOfBirth'] as const) {
    if (Object.hasOwn(obj, key)) {
      if (!calendarDate(obj[key])) throw new CryptoError('INVALID_INPUT');
      result[key] = obj[key];
    }
  }
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > PLAINTEXT_LIMIT) throw new CryptoError('INVALID_INPUT');
  return Object.freeze(result);
}

export function encodePayload(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(payloadSnapshot(value)), 'utf8');
}

export function decodePayload(bytes: Uint8Array): SyntheticPassengerDocumentV1 {
  if (bytes.byteLength > PLAINTEXT_LIMIT) throw new CryptoError('INVALID_INPUT');
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const parsed: unknown = JSON.parse(text);
    const payload = payloadSnapshot(parsed);
    if (JSON.stringify(payload) !== text) throw new CryptoError('INVALID_INPUT');
    return payload;
  } catch { throw new CryptoError('INVALID_INPUT'); }
}

export function decodeBase64(value: unknown, length?: number): Buffer {
  if (typeof value !== 'string' || !value.length || value.length > ENVELOPE_LIMIT || !/^[A-Za-z0-9_-]+$/.test(value)) throw new CryptoError('INVALID_ENVELOPE');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.toString('base64url') !== value || (length !== undefined && bytes.length !== length)) throw new CryptoError('INVALID_ENVELOPE');
  return bytes;
}

export function parseEnvelope(input: unknown): CryptoEnvelopeV1 {
  let value: unknown = input;
  if (typeof input === 'string') {
    if (Buffer.byteLength(input, 'utf8') > ENVELOPE_LIMIT) throw new CryptoError('INVALID_ENVELOPE');
    try { value = JSON.parse(input); } catch { throw new CryptoError('INVALID_ENVELOPE'); }
  }
  const obj = record(value, 'INVALID_ENVELOPE');
  const required = ['payloadVersion', 'algorithm', 'aadVersion', 'keyProvider', 'keyRef', 'wrapAlgorithm', 'wrappedDek', 'nonce', 'ciphertext', 'tag'];
  if (required.some(k => !Object.hasOwn(obj, k)) || Object.keys(obj).some(k => !required.includes(k) && k !== 'keyVersion')) throw new CryptoError('INVALID_ENVELOPE');
  if (obj.payloadVersion !== 1 || obj.aadVersion !== 1) throw new CryptoError('UNSUPPORTED_VERSION');
  const keyVersion = obj.keyVersion;
  if (keyVersion !== undefined && keyVersion !== 'v1' && keyVersion !== 'v2') throw new CryptoError('INVALID_ENVELOPE');
  if (Object.hasOwn(obj, 'keyVersion') && keyVersion === undefined) throw new CryptoError('INVALID_ENVELOPE');
  if (obj.algorithm !== 'AES-256-GCM' || obj.keyProvider !== 'synthetic' || obj.keyRef !== 'synthetic-passenger-kek'
    || obj.wrapAlgorithm !== 'SYNTHETIC-A256GCM') throw new CryptoError('INVALID_ENVELOPE');
  // Type narrowing also ensures serialization cannot invoke user callbacks.
  if (typeof obj.wrappedDek !== 'string' || typeof obj.nonce !== 'string' || typeof obj.ciphertext !== 'string' || typeof obj.tag !== 'string') throw new CryptoError('INVALID_ENVELOPE');
  if (Buffer.byteLength(JSON.stringify(obj), 'utf8') > ENVELOPE_LIMIT) throw new CryptoError('INVALID_ENVELOPE');
  decodeBase64(obj.wrappedDek, 60); // fake wrap = 12-byte nonce + 16-byte tag + 32-byte DEK
  decodeBase64(obj.nonce, 12);
  decodeBase64(obj.tag, 16);
  const ciphertext = decodeBase64(obj.ciphertext);
  if (ciphertext.length > PLAINTEXT_LIMIT) throw new CryptoError('INVALID_ENVELOPE');
  return Object.freeze({ payloadVersion: 1, algorithm: 'AES-256-GCM', aadVersion: 1,
    keyProvider: 'synthetic', keyRef: 'synthetic-passenger-kek', wrapAlgorithm: 'SYNTHETIC-A256GCM',
    ...(keyVersion === undefined ? {} : { keyVersion }),
    wrappedDek: obj.wrappedDek, nonce: obj.nonce, ciphertext: obj.ciphertext, tag: obj.tag });
}
