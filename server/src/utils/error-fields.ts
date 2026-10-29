import { types } from 'node:util';

/** Unknown thrown values must not execute getters, coercion or Proxy traps. */
export function errorDataField(value: unknown, name: string): unknown {
  if (value === null || typeof value !== 'object' || types.isProxy(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

export function nativeSyntaxError(value: unknown): boolean {
  if (!types.isNativeError(value) || types.isProxy(value)) return false;
  try { return value instanceof SyntaxError; } catch { return false; }
}
