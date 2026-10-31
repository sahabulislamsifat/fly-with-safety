import { createHmac, timingSafeEqual } from 'node:crypto';
import { types } from 'node:util';

// New protected records only. Existing inquiry SHA-256 records keep their existing reader.
function canonical(value: unknown, seen: Set<object>, depth: number, budget: { nodes: number }): string {
  if (depth > 16 || --budget.nodes < 0 || typeof value === 'string' && value.length > 16384) throw new Error('DIGEST_INPUT_INVALID');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (!value || typeof value !== 'object' || types.isProxy(value) || seen.has(value)) throw new Error('DIGEST_INPUT_INVALID');
  const prototype = Object.getPrototypeOf(value);
  const array = Array.isArray(value);
  if (!array && prototype !== Object.prototype && prototype !== null) throw new Error('DIGEST_INPUT_INVALID');
  if (Object.getOwnPropertySymbols(value).length) throw new Error('DIGEST_INPUT_INVALID');
  seen.add(value);
  try {
    const keys = Object.getOwnPropertyNames(value).filter(key => !array || key !== 'length');
    if (keys.length > 256) throw new Error('DIGEST_INPUT_INVALID');
    if (array && (keys.length !== value.length || keys.some((key, i) => key !== String(i)))) throw new Error('DIGEST_INPUT_INVALID');
    const entries = (array ? keys : keys.sort()).map(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) throw new Error('DIGEST_INPUT_INVALID');
      const item = canonical(descriptor.value, seen, depth + 1, budget);
      return array ? item : `${JSON.stringify(key)}:${item}`;
    });
    return array ? `[${entries.join(',')}]` : `{${entries.join(',')}}`;
  } finally { seen.delete(value); }
}

export function logicalDigest(key: Uint8Array, keyVersion: string, operation: string, principal: string, value: unknown): string {
  if (!types.isUint8Array(key) || key.byteLength !== 32 || !/^[A-Za-z0-9_-]{1,48}$/.test(keyVersion) ||
      !/^[a-z][a-z0-9:-]{0,63}$/.test(operation) || typeof principal !== 'string' || !principal || principal.length > 256) throw new Error('DIGEST_INPUT_INVALID');
  const payload = canonical(value, new Set(), 0, { nodes: 2048 });
  if (Buffer.byteLength(payload) > 16384) throw new Error('DIGEST_INPUT_INVALID');
  const digest = createHmac('sha256', key).update(JSON.stringify(['fws-logical', 1, keyVersion, operation, principal, payload])).digest('hex');
  return `h1:${keyVersion}:${digest}`;
}

/** Snapshot before any asynchronous admission/storage call; rejects accessors and non-JSON values. */
export function snapshotLogicalInput(value:unknown):unknown {
  const json=canonical(value,new Set(),0,{nodes:2048});
  if(Buffer.byteLength(json)>16384)throw new Error('DIGEST_INPUT_INVALID');
  return JSON.parse(json);
}

export function sameLogicalDigest(a: string, b: string): boolean {
  const shape = /^h1:[A-Za-z0-9_-]{1,48}:[a-f0-9]{64}$/;
  return shape.test(a) && shape.test(b) && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
