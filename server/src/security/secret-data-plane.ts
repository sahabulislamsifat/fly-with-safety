import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { types } from 'node:util';

/** Internal building block only: no provider, persistence format or request-facing default. */
export type SecretPurpose = 'passenger-document' | 'auth-notification';
export interface SecretContext { readonly purpose: SecretPurpose; readonly aad: Uint8Array }
export interface SealedSecret { readonly nonce: Uint8Array; readonly ciphertext: Uint8Array; readonly tag: Uint8Array }
export interface SecretBoundary {
  /** Supplied by trusted server composition, never from request data. Default allow is forbidden. */
  authorize(action: 'seal' | 'open', context: SecretContext, signal: AbortSignal): Promise<boolean>;
  /** Transfer a fresh, owned 32-byte DEK buffer; the caller clears it, including late results. */
  acquireDataKey(action: 'seal' | 'open', context: SecretContext, signal: AbortSignal): Promise<Uint8Array>;
}
type Failure = 'INVALID_INPUT' | 'FORBIDDEN' | 'UNAVAILABLE' | 'INTEGRITY_FAILURE';
const failures = new WeakMap<object, Failure>();
export class SecretDataPlaneError extends Error {
  readonly code: Failure;
  constructor(code: Failure) {
    const safe = ['INVALID_INPUT', 'FORBIDDEN', 'UNAVAILABLE', 'INTEGRITY_FAILURE'].includes(code) ? code : 'UNAVAILABLE';
    super(safe); this.code = safe; this.name = 'SecretDataPlaneError'; failures.set(this, safe);
  }
}
const PAYLOAD_LIMIT = 4096, AAD_LIMIT = 2048;
const AUTH_MS = 250, KEY_MS = 500, TOTAL_MS = 1500;
const byteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), 'byteLength')!.get!;
function erase(value: unknown): void {
  // Native typed-array operations avoid arbitrary .fill() overrides and Proxy traps.
  try { if (types.isUint8Array(value)) Uint8Array.prototype.fill.call(value, 0); }
  catch { /* Best effort only: detached buffers and native copies cannot be erased here. */ }
}
function bytes(value: unknown, maximum: number, exact?: number): Buffer {
  if (!types.isUint8Array(value)) throw new SecretDataPlaneError('INVALID_INPUT');
  const length: number = byteLength.call(value);
  if (length === 0 || length > maximum || exact !== undefined && length !== exact) throw new SecretDataPlaneError('INVALID_INPUT');
  const result = Buffer.alloc(length); Uint8Array.prototype.set.call(result, value); return result;
}
function fields(value: unknown, names: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value)) throw new SecretDataPlaneError('INVALID_INPUT');
  if (Object.getOwnPropertyNames(value).length !== names.length) throw new SecretDataPlaneError('INVALID_INPUT');
  const result: Record<string, unknown> = {};
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !('value' in descriptor)) throw new SecretDataPlaneError('INVALID_INPUT');
    result[name] = descriptor.value;
  }
  return result;
}
async function bounded<T>(run: () => Promise<T>, stageMs: number, deadline: number,
  controller: AbortController, failure: Failure, late: (value: T) => void = () => {}): Promise<T> {
  const remaining = Math.min(stageMs, deadline - performance.now());
  if (remaining <= 0) throw new SecretDataPlaneError(failure);
  const stageDeadline = performance.now() + remaining;
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => { done = true; controller.abort(); reject(new SecretDataPlaneError(failure)); }, remaining);
    void Promise.resolve().then(() => {
      if (done || performance.now() >= stageDeadline || controller.signal.aborted) throw new SecretDataPlaneError(failure);
      return run();
    }).then(value => {
      if (done) { late(value); return; }
      done = true; clearTimeout(timer);
      if (performance.now() >= stageDeadline || performance.now() >= deadline || controller.signal.aborted) {
        late(value); controller.abort(); reject(new SecretDataPlaneError(failure));
      } else resolve(value);
    }, () => {
      if (!done) { done = true; clearTimeout(timer); controller.abort(); reject(new SecretDataPlaneError(failure)); }
    });
  });
}
async function operate<T>(action: 'seal' | 'open', context: SecretContext, boundary: SecretBoundary,
  operation: (key: Buffer, aad: Buffer) => T): Promise<T> {
  let aad: Buffer | undefined, authorizationAad: Buffer | undefined;
  let providerAad: Buffer | undefined, key: Buffer | undefined, ownedKey: Uint8Array | undefined;
  const controller = new AbortController(), deadline = performance.now() + TOTAL_MS;
  try {
    const snapshot = fields(context, ['purpose', 'aad']), purpose = snapshot.purpose;
    if (purpose !== 'passenger-document' && purpose !== 'auth-notification') throw new SecretDataPlaneError('INVALID_INPUT');
    const contextBytes = bytes(snapshot.aad, AAD_LIMIT);
    // Domain and purpose binding are local data-plane inputs, not a selected persisted envelope format.
    try { aad = Buffer.from(JSON.stringify(['flywithsafe-secret-data-plane', 1, purpose, contextBytes.toString('base64')]), 'utf8'); }
    finally { erase(contextBytes); }
    authorizationAad = Buffer.from(aad); providerAad = Buffer.from(aad);
    if (!boundary || typeof boundary.authorize !== 'function' || typeof boundary.acquireDataKey !== 'function') throw new SecretDataPlaneError('UNAVAILABLE');
    const allowed = await bounded(() => boundary.authorize(action,
      Object.freeze({ purpose, aad: authorizationAad! }), controller.signal), AUTH_MS, deadline, controller, 'FORBIDDEN');
    if (allowed !== true || !timingSafeEqual(aad, authorizationAad)) throw new SecretDataPlaneError('FORBIDDEN');
    ownedKey = await bounded(() => boundary.acquireDataKey(action,
      Object.freeze({ purpose, aad: providerAad! }), controller.signal), KEY_MS, deadline, controller, 'UNAVAILABLE', erase);
    try { key = bytes(ownedKey, 32, 32); } catch { throw new SecretDataPlaneError('UNAVAILABLE'); }
    if (!timingSafeEqual(aad, providerAad) || performance.now() >= deadline) throw new SecretDataPlaneError('UNAVAILABLE');
    const result = operation(key, aad);
    if (performance.now() >= deadline) { erase(result); throw new SecretDataPlaneError('UNAVAILABLE'); }
    return result;
  } catch (error) {
    const known = error !== null && typeof error === 'object' ? failures.get(error) : undefined;
    throw new SecretDataPlaneError(known ?? 'UNAVAILABLE');
  } finally {
    controller.abort(); erase(ownedKey); erase(key); erase(aad); erase(authorizationAad); erase(providerAad);
  }
}

/** Caller must supply canonical immutable-context AAD and provider wrapping metadata separately. */
export async function sealSecret(plaintext: Uint8Array, context: SecretContext, boundary: SecretBoundary): Promise<SealedSecret> {
  const snapshot = bytes(plaintext, PAYLOAD_LIMIT);
  try {
    return await operate('seal', context, boundary, (key, aad) => {
      const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
      cipher.setAAD(aad);
      return { nonce, ciphertext: Buffer.concat([cipher.update(snapshot), cipher.final()]), tag: cipher.getAuthTag() };
    });
  } finally { erase(snapshot); }
}

/** Returns owned plaintext to the authorized caller; caller must clear it after use. */
export async function openSecret(sealed: SealedSecret, context: SecretContext, boundary: SecretBoundary): Promise<Uint8Array> {
  let nonce: Buffer | undefined, ciphertext: Buffer | undefined, tag: Buffer | undefined;
  try {
    const snapshot = fields(sealed, ['nonce', 'ciphertext', 'tag']);
    nonce = bytes(snapshot.nonce, 12, 12); ciphertext = bytes(snapshot.ciphertext, PAYLOAD_LIMIT); tag = bytes(snapshot.tag, 16, 16);
    const input = { nonce, ciphertext, tag };
    return await operate('open', context, boundary, (key, aad) => {
      const decipher = createDecipheriv('aes-256-gcm', key, input.nonce); decipher.setAAD(aad); decipher.setAuthTag(input.tag);
      const tentative = decipher.update(input.ciphertext);
      try { return Buffer.concat([tentative, decipher.final()]); }
      catch { throw new SecretDataPlaneError('INTEGRITY_FAILURE'); }
      finally { erase(tentative); }
    });
  } finally { erase(nonce); erase(ciphertext); erase(tag); }
}
