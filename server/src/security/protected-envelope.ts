import { types } from 'node:util';
import { openSecret, sealSecret, type SecretBoundary, type SecretPurpose } from './secret-data-plane.js';

export interface Envelope { version: 1; keyRef: string; nonce: string; ciphertext: string; tag: string }
export interface EnvelopeKeys {
  // Trusted server composition must resolve an allowlisted reference, never arbitrary provider URLs.
  boundary(keyRef: string): SecretBoundary;
}
export function protectedContext(domain: string, purpose: SecretPurpose, ...identity: Array<string | number>): Buffer {
  if (!/^[a-z0-9-]{1,48}$/.test(domain) || identity.some(v => typeof v === 'number' ? !Number.isSafeInteger(v) || v < 0 : !v || v.length > 256)) throw new Error('PROTECTED_INPUT_INVALID');
  return Buffer.from(JSON.stringify(['fws-protected', 1, domain, purpose, ...identity]));
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getOwnPropertySymbols(value).length) throw new Error('PROTECTED_INPUT_INVALID');
  const result: Record<string, unknown> = {};
  for (const name of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !('value' in descriptor)) throw new Error('PROTECTED_INPUT_INVALID');
    result[name] = descriptor.value;
  }
  return result;
}
export function parseEnvelope(value: unknown): Envelope {
  const r = record(value);
  if (Object.keys(r).sort().join(',') !== 'ciphertext,keyRef,nonce,tag,version' || r.version !== 1 ||
      typeof r.keyRef !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(r.keyRef)) throw new Error('PROTECTED_INPUT_INVALID');
  const encoded = (value: unknown, exact?: number): string => {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value) || value.length > 5500) throw new Error('PROTECTED_INPUT_INVALID');
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.toString('base64url') !== value || !bytes.length || bytes.length > 4096 || exact && bytes.length !== exact) throw new Error('PROTECTED_INPUT_INVALID');
    return value;
  };
  return { version: 1, keyRef: r.keyRef, nonce: encoded(r.nonce, 12), ciphertext: encoded(r.ciphertext), tag: encoded(r.tag, 16) };
}
export async function sealEnvelope(data: Uint8Array, purpose: SecretPurpose, aad: Uint8Array, keyRef: string, keys: EnvelopeKeys): Promise<Envelope> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(keyRef)) throw new Error('PROTECTED_INPUT_INVALID');
  try {
    // Bind key routing metadata as well as immutable record context.
    const bound = Buffer.from(JSON.stringify([keyRef, Buffer.from(aad).toString('base64url')]));
    const sealed = await sealSecret(data, { purpose, aad: bound }, keys.boundary(keyRef));
    return { version: 1, keyRef, nonce: Buffer.from(sealed.nonce).toString('base64url'), ciphertext: Buffer.from(sealed.ciphertext).toString('base64url'), tag: Buffer.from(sealed.tag).toString('base64url') };
  } catch { throw new Error('PROTECTED_SEAL_FAILED'); }
}
export async function openEnvelope(value: unknown, purpose: SecretPurpose, aad: Uint8Array, keys: EnvelopeKeys): Promise<Uint8Array> {
  try {
    const e = parseEnvelope(value), bound = Buffer.from(JSON.stringify([e.keyRef, Buffer.from(aad).toString('base64url')]));
    return await openSecret({ nonce: Buffer.from(e.nonce, 'base64url'), ciphertext: Buffer.from(e.ciphertext, 'base64url'), tag: Buffer.from(e.tag, 'base64url') }, { purpose, aad: bound }, keys.boundary(e.keyRef));
  } catch { throw new Error('PROTECTED_OPEN_FAILED'); }
}

/** Classification only: caller must durably quarantine retained auth rows, never delete/downgrade. */
export function legacyDisposition(value: unknown): 'ordinary' | 'quarantine' {
  try {
    const r = record(value);
    return r.template === 'INQUIRY_CONFIRMATION' || r.template === 'BOOKING_CONFIRMATION' ||
      r.template === 'BOOKING_STATUS' || r.template === 'CONTACT_CONFIRMATION' ? 'ordinary' : 'quarantine';
  } catch { return 'quarantine'; }
}
