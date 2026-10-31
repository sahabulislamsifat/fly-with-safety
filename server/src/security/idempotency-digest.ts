import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { logicalDigest, sameLogicalDigest } from './logical-digest.js';

export interface LogicalDigestPolicy {
  readonly currentVersion: string;
  /** Trusted composition supplies a fresh owned key for this exact retained version; never fallback. */
  acquireKey(version: string): Uint8Array;
}
export interface DigestScope { operation: string; principal: string }

// Preserve historical locale sorting and JSON behavior byte-for-byte for existing records.
function legacyValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(legacyValue);
  if (value !== null && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,legacyValue(item)]));
  return value;
}
function legacyHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(legacyValue(value))).digest('hex');
}
function keyed(policy: LogicalDigestPolicy, version: string, scope: DigestScope, payload: unknown): string {
  let owned: Uint8Array | undefined;
  try {
    if (!/^[A-Za-z0-9_-]{1,48}$/.test(version)) throw new Error();
    owned = policy.acquireKey(version);
    if (!types.isUint8Array(owned) || owned.byteLength !== 32) throw new Error();
    return logicalDigest(owned,version,scope.operation,scope.principal,payload);
  } catch { throw new Error('IDEMPOTENCY_DIGEST_UNAVAILABLE'); }
  finally { if (owned && types.isUint8Array(owned)) Uint8Array.prototype.fill.call(owned,0); }
}
export function inquiryDigest(payload: unknown, scope: DigestScope, policy?: LogicalDigestPolicy): string {
  return policy ? keyed(policy,policy.currentVersion,scope,payload) : legacyHash(payload);
}
export function matchesInquiryDigest(stored: string, payload: unknown, scope: DigestScope, policy?: LogicalDigestPolicy): boolean {
  if (/^[a-f0-9]{64}$/.test(stored)) return stored === legacyHash(payload);
  const match=/^h1:([A-Za-z0-9_-]{1,48}):[a-f0-9]{64}$/.exec(stored);
  if (!match || !policy) throw new Error('IDEMPOTENCY_DIGEST_UNAVAILABLE');
  // Read the original version, not the new writer's current key. No raw-SHA downgrade.
  return sameLogicalDigest(stored,keyed(policy,match[1],scope,payload));
}
